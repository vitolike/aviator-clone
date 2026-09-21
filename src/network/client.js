// Network client for Aviator: seamlessly bridges Game & Engine with Node.js Express & WebSocket backend
import { PHASE } from '../core/engine.js';
import { SLOT } from '../core/game.js';

export class NetworkClient {
  constructor(engine, game, bots) {
    this.engine = engine;
    this.game = game;
    this.bots = bots;
    this.ws = null;
    this.token = null;
    this.user = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.activeBets = {}; // slot_index -> bet_id
  }

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token') || localStorage.getItem('av_session_token');

    try {
      const res = await fetch(`/api/session/me${this.token ? `?token=${encodeURIComponent(this.token)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('av_session_token', this.token);
        
        // Keep the URL aligned when the backend replaces an expired/invalid token.
        if (params.get('token') !== this.token) {
          const newUrl = new URL(window.location);
          newUrl.searchParams.set('token', this.token);
          window.history.replaceState({}, '', newUrl);
        }

        // Apply server balance to game
        this.game.balance = data.user.balance;
        this.game.currency = data.user.currency || 'USD';
        this.game.username = data.user.username;
        this.game.emit('change');

        // Load recent rounds history from server
        if (Array.isArray(data.history) && data.history.length > 0) {
          this.engine.history = data.history.map(r => ({
            m: r.crash_multiplier,
            hash: r.hash,
            serverSeed: r.server_seed,
            clientSeed: r.client_seed,
            nonce: r.nonce,
            id: r.id,
            resultHash: r.result_hash,
            crashedAt: r.crashed_at
          }));
          this.engine.emit('history_synced', this.engine.history);
        }
      }
    } catch (err) {
      console.warn('[NetworkClient] Backend session API not reachable, running in offline mode:', err.message);
    }

    this.connectWs();
    this.interceptGameActions();
  }

  connectWs() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    if (!host) return; // e.g. file:// preview

    const wsUrl = `${proto}//${host}/ws${this.token ? `?token=${encodeURIComponent(this.token)}` : ''}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[NetworkClient] Connected to Aviator WebSocket server');
        this.connected = true;
        this.engine.serverControlled = true;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[NetworkClient] Message parsing error:', e);
        }
      };

      this.ws.onclose = () => {
        if (this.connected) {
          console.warn('[NetworkClient] WebSocket disconnected. Reconnecting in 3s...');
        }
        this.connected = false;
        this.engine.serverControlled = false;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectWs(), 3000);
      };

      this.ws.onerror = (e) => {
        this.ws?.close();
      };
    } catch (e) {
      console.warn('[NetworkClient] WebSocket init failed:', e.message);
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'state':
        this.syncServerPhase(String(msg.phase).toLowerCase(), msg.mult, {
          id: msg.roundId,
          hash: msg.hash,
        });
        break;

      case 'tick':
        if (this.engine.phase === PHASE.FLYING) {
          this.engine.mult = msg.mult;
          this.engine.emit('tick', msg.mult);
        }
        break;

      case 'phase': {
        const phase = String(msg.phase).toLowerCase();
        if (phase === PHASE.CRASHED) {
          this.engine.phase = PHASE.CRASHED;
          this.engine.t = 0;
          this.engine.mult = msg.crashMultiplier;
          const rec = {
            m: msg.crashMultiplier,
            hash: msg.hash,
            resultHash: msg.resultHash,
            serverSeed: msg.serverSeed,
            clientSeed: msg.clientSeed,
            nonce: msg.nonce,
            id: msg.roundId,
            crashedAt: Date.now(),
          };
          this.engine.history.unshift(rec);
          if (this.engine.history.length > 60) this.engine.history.length = 60;
          this.engine.emit('crash', rec);
          this.engine.emit('phase', PHASE.CRASHED);
          this.activeBets = {};
        } else {
          this.syncServerPhase(phase, 1, {
            id: msg.roundId,
            hash: msg.hash,
            nonce: msg.nonce,
          });
        }
        break;
      }

      case 'hello':
        if (msg.user) {
          this.game.balance = msg.user.balance;
          this.game.username = msg.user.username;
          this.game.emit('change');
        }
        if (msg.phase) {
          this.syncServerPhase(msg.phase, msg.mult, msg.round);
        }
        break;

      case 'engine_tick':
        if (this.engine.phase === PHASE.FLYING) {
          this.engine.mult = msg.mult;
          this.engine.emit('tick', msg.mult);
        }
        break;

      case 'phase_change':
        this.syncServerPhase(msg.phase, 1.0, msg.round);
        break;

      case 'round_crashed':
        this.engine.phase = PHASE.CRASHED;
        this.engine.t = 0;
        this.engine.mult = msg.crash;
        const rec = {
          m: msg.crash,
          hash: msg.hash,
          serverSeed: msg.server_seed,
          clientSeed: msg.client_seed,
          nonce: msg.nonce,
          id: msg.round_id
        };
        this.engine.history.unshift(rec);
        if (this.engine.history.length > 60) this.engine.history.length = 60;
        this.engine.emit('crash', rec);
        this.engine.emit('phase', PHASE.CRASHED);
        this.activeBets = {};
        break;

      case 'bet_confirmed':
        const slot = this.game.slots[msg.slot_index];
        if (slot) {
          slot.betId = msg.bet_id;
          slot.state = this.engine.phase === PHASE.FLYING ? SLOT.ACTIVE : SLOT.QUEUED;
          this.activeBets[msg.slot_index] = msg.bet_id;
        }
        if (typeof msg.balance === 'number') {
          this.game.balance = msg.balance;
        }
        this.game.emit('change');
        break;

      case 'bet_cancelled':
        const cancelSlot = this.game.slots[msg.slot_index];
        if (cancelSlot) {
          cancelSlot.state = SLOT.IDLE;
          delete this.activeBets[msg.slot_index];
        }
        if (typeof msg.balance === 'number') {
          this.game.balance = msg.balance;
        }
        this.game.emit('change');
        break;

      case 'cash_out_success':
        const cashSlot = this.game.slots[msg.slot_index];
        if (cashSlot) {
          cashSlot.state = SLOT.IDLE;
          cashSlot.lastWin = msg.win;
          cashSlot.lastMult = msg.multiplier;
          this.game.myBets.unshift({
            t: Date.now(),
            amount: cashSlot.amount,
            m: msg.multiplier,
            win: msg.win,
            nonce: this.engine.round?.nonce
          });
          delete this.activeBets[msg.slot_index];
        }
        if (typeof msg.balance === 'number') {
          this.game.balance = msg.balance;
        }
        this.game.emit('change');
        this.game.emit('cashed', { slot: cashSlot, m: msg.multiplier, win: msg.win });
        break;

      case 'balance_update':
        if (typeof msg.balance === 'number') {
          this.game.balance = msg.balance;
          this.game.emit('change');
        }
        break;

      case 'live_bets_update':
        if (this.bots && Array.isArray(msg.bets)) {
          // Sync real community bets with feed
          msg.bets.forEach(b => {
            this.bots.feed.unshift({
              name: b.username || `Player_${b.user_id}`,
              amount: b.amount,
              avatar: ((b.user_id || 1) % 72) + 1,
              cashed: b.status === 'WON',
              mult: b.cashout_mult,
              win: b.win_amount,
              t: Date.now()
            });
          });
          if (this.bots.feed.length > 50) this.bots.feed.length = 50;
          this.bots.emit?.('feed_update');
        }
        break;

      case 'live_cashout':
        if (this.bots) {
          const existing = this.bots.feed.find(f => f.name === msg.username && !f.cashed);
          if (existing) {
            existing.cashed = true;
            existing.mult = msg.multiplier;
            existing.win = msg.win;
          }
          this.bots.emit?.('feed_update');
        }
        break;

      case 'error':
        console.warn('[NetworkClient] Server error message:', msg.message);
        break;
    }
  }

  syncServerPhase(phase, mult = 1.0, round = null) {
    if (round) {
      this.engine.round = {
        id: round.id,
        hash: round.hash,
        nonce: round.nonce
      };
    }
    this.engine.phase = phase;
    this.engine.t = 0;
    this.engine.mult = mult;

    if (phase === PHASE.FLYING) {
      this.game.slots.forEach(s => {
        if (s.state === SLOT.QUEUED) s.state = SLOT.ACTIVE;
      });
    } else if (phase === PHASE.BETTING) {
      this.game.slots.forEach(s => {
        if (s.state === SLOT.CASHED) s.state = SLOT.IDLE;
        if (s.autoBet && s.state === SLOT.IDLE) this.place(s);
      });
    }

    this.engine.emit('phase', phase);
    this.game.emit('change');
  }

  interceptGameActions() {
    const originalPlace = this.game.place.bind(this.game);
    const originalCancel = this.game.cancel.bind(this.game);
    const originalCashOut = this.game.cashOut.bind(this.game);

    this.game.place = (slot) => {
      if (!this.connected) {
        return originalPlace(slot);
      }
      if (!this.game.canPlace(slot)) return false;

      // Optimistically queue slot
      slot.state = SLOT.QUEUED;
      this.game.emit('change');

      this.ws.send(JSON.stringify({
        action: 'place_bet',
        slot_index: slot.index,
        amount: slot.amount,
        auto_cash_out: slot.autoCash ? slot.autoCashAt : null
      }));
      return true;
    };

    this.game.cancel = (slot) => {
      if (!this.connected) {
        return originalCancel(slot);
      }
      if (slot.state !== SLOT.QUEUED) return false;

      const betId = this.activeBets[slot.index] || slot.betId;
      if (betId) {
        this.ws.send(JSON.stringify({
          action: 'cancel_bet',
          bet_id: betId,
          slot_index: slot.index
        }));
      } else {
        slot.state = SLOT.IDLE;
        this.game.emit('change');
      }
      return true;
    };

    this.game.cashOut = (slot, mult = this.engine.mult) => {
      if (!this.connected) {
        return originalCashOut(slot, mult);
      }
      if (slot.state !== SLOT.ACTIVE) return false;

      const betId = this.activeBets[slot.index] || slot.betId;
      if (betId) {
        this.ws.send(JSON.stringify({
          action: 'cash_out',
          bet_id: betId,
          slot_index: slot.index
        }));
      } else {
        return originalCashOut(slot, mult);
      }
      return true;
    };
  }
}
