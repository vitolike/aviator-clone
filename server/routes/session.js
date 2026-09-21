import express from 'express';
import crypto from 'node:crypto';
import { getUserByToken, getOrCreateUser, createSession, db } from '../db.js';
import { serverEngine } from '../engine.js';

export const sessionRouter = express.Router();

/**
 * GET /api/session/me
 * Authenticates current player by session token or generates an instant guest session
 */
sessionRouter.get('/me', (req, res) => {
  try {
    let token = req.query.token || (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    let user = null;

    if (token) {
      user = getUserByToken(token);
    }

    // Use a stable demo user for direct local testing; keep guests elsewhere.
    if (!user) {
      const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(req.hostname);
      if (isLocal) {
        user = getOrCreateUser('demo', 'Demo', 'USD', 30000);
        token = createSession(user.id, 'local_demo', null);
      } else {
        const guestId = `guest_${crypto.randomBytes(6).toString('hex')}`;
        const guestName = `Guest_${guestId.slice(6, 10)}`;
        user = getOrCreateUser(guestId, guestName, 'USD', 30000);
        token = createSession(user.id, 'guest', null);
      }
    }

    const round = serverEngine.currentRound;
    const history = db.prepare(`
      SELECT id, nonce, hash, server_seed, client_seed, crash_multiplier, crashed_at
      FROM rounds
      WHERE status = 'crashed'
      ORDER BY id DESC
      LIMIT 35
    `).all().map((item) => ({
      ...item,
      result_hash: crypto.createHmac('sha256', item.server_seed)
        .update(`${item.client_seed}:${item.nonce}`)
        .digest('hex'),
    }));

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        currency: user.currency,
        balance: user.balance,
      },
      history,
      round: {
        id: round ? round.id : 0,
        phase: serverEngine.phase,
        mult: serverEngine.mult,
        hash: round ? round.hash : '',
        countdownEndsAt: serverEngine.bettingEndsAt || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/session/history
 * Returns historical crash multipliers for top pill bar
 */
sessionRouter.get('/history', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '35', 10), 100);
    const rows = db.prepare(`
      SELECT id, nonce, hash, crash_multiplier as m, crashed_at
      FROM rounds
      WHERE status = 'crashed'
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    return res.status(200).json({ success: true, history: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/session/my-bets
 * Returns current player's personal bets
 */
sessionRouter.get('/my-bets', (req, res) => {
  try {
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    if (!token) return res.status(401).json({ success: false, error: 'Token required' });

    const user = getUserByToken(token);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid session' });

    const rows = db.prepare(`
      SELECT b.id, b.round_id, b.amount, b.cashout_mult, b.win_amount, b.status, b.created_at, r.crash_multiplier
      FROM bets b
      JOIN rounds r ON b.round_id = r.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
      LIMIT 50
    `).all(user.id);

    return res.status(200).json({ success: true, bets: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
