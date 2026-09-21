// Round state machine: betting -> flying -> crashed -> loop
import { RULES } from '../config.js';
import { makeRound, randomSeed } from './fair.js';

// Initial seed history for demonstration upon first load (same distribution as live rounds)
function seedHistory(n) {
  return Array.from({ length: n }, () => {
    const r = Math.random();
    const m = Math.max(1, Math.floor((RULES.rtp / (1 - r)) * 100) / 100);
    return { m: Math.min(m, RULES.maxMultiplier), seeded: true };
  });
}

export const PHASE = { BETTING: 'betting', FLYING: 'flying', CRASHED: 'crashed' };

export class Engine {
  constructor() {
    this.phase = PHASE.BETTING;
    this.t = 0;              // Elapsed time in current phase (ms)
    this.mult = 1;           // Current multiplier
    this.round = null;       // Current round provably fair data (including crash multiplier)
    this.next = null;        // Pre-generated next round provably fair commitment
    this.nonce = Number(localStorage.getItem('av_nonce') || 0);
    this.clientSeed = localStorage.getItem('av_clientseed') || randomSeed(8);
    this.history = JSON.parse(localStorage.getItem('av_history') || '[]');
    if (!this.history.length) this.history = seedHistory(14);
    this.listeners = {};
    this.serverControlled = false;
    this.ready = false;
    this._prepare().then(() => { this.ready = true; });
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  emit(evt, payload) { (this.listeners[evt] || []).forEach((f) => f(payload)); }

  setClientSeed(seed) {
    this.clientSeed = seed || randomSeed(8);
    localStorage.setItem('av_clientseed', this.clientSeed);
    this._prepare(true);
  }

  // Pre-generate the next round (determined before takeoff to satisfy provably fair requirement)
  async _prepare(force = false) {
    if (this.next && !force) return;
    this.nonce += 1;
    this.next = await makeRound(this.clientSeed, this.nonce);
    localStorage.setItem('av_nonce', String(this.nonce));
    this.emit('prepared', this.next);
  }

  // Flight duration until crash (ms)
  get crashMs() {
    if (!this.round) return 0;
    return (Math.log(this.round.crash) / RULES.growth) * 1000;
  }

  update(dt) {
    this.t += dt;
    if (this.serverControlled) {
      // In server-controlled mode, server ticks and WebSocket dictate round transitions
      return;
    }
    if (this.phase === PHASE.BETTING) {
      if (this.t >= RULES.bettingMs && this.next) this._startFlight();
    } else if (this.phase === PHASE.FLYING) {
      const m = Math.exp(RULES.growth * (this.t / 1000));
      if (m >= this.round.crash) {
        this.mult = this.round.crash;
        this._crash();
      } else {
        this.mult = m;
        this.emit('tick', this.mult);
      }
    } else if (this.phase === PHASE.CRASHED) {
      if (this.t >= RULES.crashedMs) this._startBetting();
    }
  }

  _startFlight() {
    this.round = this.next;
    this.next = null;
    this.phase = PHASE.FLYING;
    this.t = 0;
    this.mult = 1;
    this._prepare();
    this.emit('phase', PHASE.FLYING);
  }

  _crash() {
    this.phase = PHASE.CRASHED;
    this.t = 0;
    const rec = { m: this.round.crash, hash: this.round.hash, serverSeed: this.round.serverSeed, clientSeed: this.round.clientSeed, nonce: this.round.nonce };
    this.history.unshift(rec);
    if (this.history.length > RULES.historyMax) this.history.length = RULES.historyMax;
    localStorage.setItem('av_history', JSON.stringify(this.history));
    this.emit('crash', rec);
    this.emit('phase', PHASE.CRASHED);
  }

  _startBetting() {
    this.phase = PHASE.BETTING;
    this.t = 0;
    this.mult = 1;
    this.emit('phase', PHASE.BETTING);
  }

  // Progress ratio of betting phase (0..1)
  get bettingProgress() {
    return Math.min(1, this.t / RULES.bettingMs);
  }
}
