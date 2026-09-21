import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { db, getSetting, setSetting, adjustBalance, getUserById } from './db.js';

export const PHASE = {
  BETTING: 'BETTING',
  FLYING: 'FLYING',
  CRASHED: 'CRASHED',
};

export class ServerGameEngine extends EventEmitter {
  constructor() {
    super();
    this.phase = PHASE.BETTING;
    this.currentRound = null;
    this.nonce = 0;
    this.growth = 0.0865;
    this.startTime = 0;
    this.mult = 1.0;
    this.tickInterval = null;
    this.bettingTimer = null;
    this.crashTimer = null;

    // Load last nonce from database
    const lastRound = db.prepare('SELECT id, nonce FROM rounds ORDER BY id DESC LIMIT 1').get();
    if (lastRound) {
      this.nonce = lastRound.nonce;
    }

    // Recover or start fresh round
    this.initNextRound();
  }

  generateProvablyFair(clientSeed = '0000000000000000000') {
    this.nonce++;
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    // Check if admin has set a forced multiplier for the next round
    const forced = parseFloat(getSetting('force_next_crash', '0'));
    let crashMultiplier;

    if (forced >= 1.0) {
      crashMultiplier = Math.round(forced * 100) / 100;
      setSetting('force_next_crash', '0'); // reset after consumption
    } else {
      // Authentic Provably Fair Crash calculation
      const hmac = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${this.nonce}`).digest('hex');
      const hex = hmac.slice(0, 13);
      const e = parseInt(hex, 16);
      const rtp = parseFloat(getSetting('rtp', '97.0')) / 100;

      // 1-in-33 chance for instant crash at 1.00x
      if (e % 33 === 0) {
        crashMultiplier = 1.0;
      } else {
        const raw = (rtp * Math.pow(2, 52)) / (Math.pow(2, 52) - e);
        crashMultiplier = Math.max(1.0, Math.floor(raw * 100) / 100);
      }
    }

    const maxMult = parseFloat(getSetting('max_multiplier', '100000.0'));
    crashMultiplier = Math.min(crashMultiplier, maxMult);

    return { serverSeed, clientSeed, nonce: this.nonce, hash, crashMultiplier };
  }

  initNextRound() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.bettingTimer) clearTimeout(this.bettingTimer);
    if (this.crashTimer) clearTimeout(this.crashTimer);

    const pf = this.generateProvablyFair();
    const now = Date.now();

    const insertStmt = db.prepare(`
      INSERT INTO rounds (server_seed, client_seed, nonce, hash, crash_multiplier, status, started_at)
      VALUES (?, ?, ?, ?, ?, 'betting', ?)
    `);
    const info = insertStmt.run(pf.serverSeed, pf.clientSeed, pf.nonce, pf.hash, pf.crashMultiplier, now);

    this.currentRound = {
      id: Number(info.lastInsertRowid),
      serverSeed: pf.serverSeed,
      clientSeed: pf.clientSeed,
      nonce: pf.nonce,
      hash: pf.hash,
      crashMultiplier: pf.crashMultiplier,
      status: 'betting',
      startedAt: now,
      bets: new Map(), // active in-memory bets for fast lookup
    };

    this.phase = PHASE.BETTING;
    this.mult = 1.0;

    const countdownMs = parseInt(getSetting('betting_countdown_ms', '5000'), 10);
    this.bettingEndsAt = now + countdownMs;

    this.emit('round_betting', {
      roundId: this.currentRound.id,
      hash: this.currentRound.hash,
      countdownMs,
      endsAt: this.bettingEndsAt,
    });

    this.bettingTimer = setTimeout(() => this.startFlight(), countdownMs);
  }

  startFlight() {
    this.phase = PHASE.FLYING;
    this.startTime = Date.now();
    this.mult = 1.0;
    this.growth = parseFloat(getSetting('growth_rate', '0.0865'));

    db.prepare("UPDATE rounds SET status = 'flying' WHERE id = ?").run(this.currentRound.id);

    this.emit('round_flying', {
      roundId: this.currentRound.id,
      startTime: this.startTime,
    });

    const tickIntervalMs = 40; // 25 fps sync tick
    this.tickInterval = setInterval(() => this.tick(), tickIntervalMs);
  }

  tick() {
    if (this.phase !== PHASE.FLYING) return;

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    this.mult = Math.floor(Math.exp(this.growth * elapsedSeconds) * 100) / 100;

    // Check Auto-Cashout for active bets
    for (const [betId, b] of this.currentRound.bets.entries()) {
      if (b.status === 'placed' && b.targetMult > 1.0 && this.mult >= b.targetMult) {
        this.cashOut(b.userId, betId, b.targetMult);
      }
    }

    if (this.mult >= this.currentRound.crashMultiplier) {
      this.triggerCrash();
    } else {
      this.emit('tick', {
        roundId: this.currentRound.id,
        mult: this.mult,
        elapsed: elapsedSeconds,
      });
    }
  }

  triggerCrash() {
    if (this.phase === PHASE.CRASHED) return;
    clearInterval(this.tickInterval);

    this.phase = PHASE.CRASHED;
    const now = Date.now();
    const crashM = this.currentRound.crashMultiplier;

    // Update round status in DB
    db.prepare("UPDATE rounds SET status = 'crashed', crashed_at = ? WHERE id = ?").run(now, this.currentRound.id);

    // Settle remaining uncashed bets as lost
    const markLostStmt = db.prepare("UPDATE bets SET status = 'lost' WHERE round_id = ? AND status = 'placed'");
    markLostStmt.run(this.currentRound.id);

    for (const b of this.currentRound.bets.values()) {
      if (b.status === 'placed') {
        b.status = 'lost';
      }
    }

    this.emit('round_crashed', {
      roundId: this.currentRound.id,
      crashMultiplier: crashM,
      serverSeed: this.currentRound.serverSeed,
      clientSeed: this.currentRound.clientSeed,
      nonce: this.currentRound.nonce,
      hash: this.currentRound.hash,
      resultHash: crypto.createHmac('sha256', this.currentRound.serverSeed)
        .update(`${this.currentRound.clientSeed}:${this.currentRound.nonce}`)
        .digest('hex'),
    });

    // 3 second cooldown before next round begins
    this.crashTimer = setTimeout(() => this.initNextRound(), 3000);
  }

  placeBet(userId, slotIndex, amount, targetMult = 0) {
    if (this.phase !== PHASE.BETTING) {
      throw new Error('Bets can only be placed during betting phase');
    }

    const minBet = parseFloat(getSetting('min_bet', '0.10'));
    const maxBet = parseFloat(getSetting('max_bet', '1000.00'));

    if (amount < minBet || amount > maxBet) {
      throw new Error(`Bet amount must be between ${minBet} and ${maxBet}`);
    }

    const betId = crypto.randomUUID();
    const now = Date.now();

    // Deduct balance atomically
    const balanceResult = adjustBalance(userId, -amount, 'bet', betId);

    db.prepare(`
      INSERT INTO bets (id, round_id, user_id, slot_index, amount, target_mult, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'placed', ?)
    `).run(betId, this.currentRound.id, userId, slotIndex, amount, targetMult, now);

    const user = getUserById(userId);
    const betRecord = {
      id: betId,
      roundId: this.currentRound.id,
      userId,
      username: user ? user.username : 'Player',
      slotIndex,
      amount,
      targetMult,
      cashoutMult: 0,
      winAmount: 0,
      status: 'placed',
      createdAt: now,
    };

    this.currentRound.bets.set(betId, betRecord);

    this.emit('bet_placed', {
      ...betRecord,
      newBalance: balanceResult.after,
    });

    return { bet: betRecord, balance: balanceResult.after };
  }

  cancelBet(userId, betId) {
    if (this.phase !== PHASE.BETTING) {
      throw new Error('Bets can only be cancelled during betting phase');
    }

    const bet = this.currentRound.bets.get(betId);
    if (!bet || bet.userId !== userId || bet.status !== 'placed') {
      throw new Error('Active bet not found');
    }

    // Refund balance
    const balanceResult = adjustBalance(userId, bet.amount, 'rollback', betId);

    db.prepare("UPDATE bets SET status = 'cancelled' WHERE id = ?").run(betId);
    bet.status = 'cancelled';
    this.currentRound.bets.delete(betId);

    this.emit('bet_cancelled', {
      betId,
      userId,
      newBalance: balanceResult.after,
    });

    return { success: true, balance: balanceResult.after };
  }

  cashOut(userId, betId, forceMultiplier = null) {
    if (this.phase !== PHASE.FLYING) {
      throw new Error('Cash out is only available during flight');
    }

    const bet = this.currentRound.bets.get(betId);
    if (!bet || bet.userId !== userId || bet.status !== 'placed') {
      throw new Error('Active bet not found');
    }

    const mult = forceMultiplier ? Math.min(this.mult, forceMultiplier) : this.mult;
    if (mult >= this.currentRound.crashMultiplier) {
      throw new Error('Round already crashed');
    }

    const maxWin = parseFloat(getSetting('max_win', '10000.00'));
    const winAmount = Math.min(Math.round(bet.amount * mult * 100) / 100, maxWin);
    const now = Date.now();

    // Credit balance atomically
    const balanceResult = adjustBalance(userId, winAmount, 'win', betId);

    db.prepare(`
      UPDATE bets SET status = 'cashed', cashout_mult = ?, win_amount = ?, cashed_at = ?
      WHERE id = ?
    `).run(mult, winAmount, now, betId);

    bet.status = 'cashed';
    bet.cashoutMult = mult;
    bet.winAmount = winAmount;
    bet.cashedAt = now;

    this.emit('bet_cashed', {
      betId,
      userId,
      username: bet.username,
      slotIndex: bet.slotIndex,
      amount: bet.amount,
      mult,
      winAmount,
      newBalance: balanceResult.after,
    });

    return { success: true, mult, winAmount, balance: balanceResult.after };
  }
}

export const serverEngine = new ServerGameEngine();
