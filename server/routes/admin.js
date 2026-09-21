import express from 'express';
import { db, getSetting, setSetting, getOrCreateUser, createSession } from '../db.js';
import { serverEngine } from '../engine.js';

export const adminRouter = express.Router();

// Simple admin auth middleware
function checkAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey || bearerKey;
  const configuredPassword = getSetting('admin_password', 'admin123');

  if (!adminKey || adminKey !== configuredPassword) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid admin key' });
  }
  next();
}

/**
 * POST /api/admin/login
 * Validates admin password
 */
adminRouter.post('/login', (req, res) => {
  const { password } = req.body;
  const configuredPassword = getSetting('admin_password', 'admin123');

  if (password === configuredPassword) {
    return res.status(200).json({ success: true, adminKey: configuredPassword });
  }
  return res.status(401).json({ success: false, error: 'Incorrect password' });
});

/**
 * GET /api/admin/stats
 * Real-time casino performance metrics (GGR, RTP, Volume, Active Round)
 */
adminRouter.get('/stats', checkAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalRounds = db.prepare('SELECT COUNT(*) as c FROM rounds').get().c;

    const betStats = db.prepare(`
      SELECT 
        COUNT(*) as totalBets,
        COALESCE(SUM(amount), 0) as totalWagered,
        COALESCE(SUM(win_amount), 0) as totalPaidOut
      FROM bets
    `).get();

    const ggr = Math.round((betStats.totalWagered - betStats.totalPaidOut) * 100) / 100;
    const realRtp = betStats.totalWagered > 0
      ? Math.round((betStats.totalPaidOut / betStats.totalWagered) * 10000) / 100
      : parseFloat(getSetting('rtp', '97.0'));

    const activeRound = serverEngine.currentRound;

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalRounds,
        totalBets: betStats.totalBets,
        totalWagered: Math.round(betStats.totalWagered * 100) / 100,
        totalPaidOut: Math.round(betStats.totalPaidOut * 100) / 100,
        ggr,
        realRtp,
        configuredRtp: parseFloat(getSetting('rtp', '97.0')),
        forceNextCrash: parseFloat(getSetting('force_next_crash', '0')),
      },
      live: {
        roundId: activeRound ? activeRound.id : 0,
        phase: serverEngine.phase,
        mult: serverEngine.mult,
        crashMultiplier: activeRound ? activeRound.crashMultiplier : 0,
        betsCount: activeRound ? activeRound.bets.size : 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/settings & POST /api/admin/settings
 * Read and update game configuration & forced multiplier
 */
adminRouter.get('/settings', checkAdmin, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach((r) => { settings[r.key] = r.value; });
  return res.status(200).json({ success: true, settings });
});

adminRouter.post('/settings', checkAdmin, (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, val] of entries) {
      if (val !== undefined && val !== null) {
        setSetting(key, String(val));
      }
    }
    return res.status(200).json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/rounds
 * Audit trail of historical rounds with Provably Fair secrets
 */
adminRouter.get('/rounds', checkAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const rows = db.prepare(`
      SELECT id, server_seed, client_seed, nonce, hash, crash_multiplier, status, started_at, crashed_at
      FROM rounds
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    return res.status(200).json({ success: true, rounds: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/bets
 * List of recent bets with filters
 */
adminRouter.get('/bets', checkAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const rows = db.prepare(`
      SELECT b.*, u.username, r.crash_multiplier as round_crash_mult
      FROM bets b
      JOIN users u ON b.user_id = u.id
      JOIN rounds r ON b.round_id = r.id
      ORDER BY b.created_at DESC
      LIMIT ?
    `).all(limit);

    return res.status(200).json({ success: true, bets: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/players
 * List players and balances
 */
adminRouter.get('/players', checkAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const rows = db.prepare(`
      SELECT id, username, currency, balance, created_at, updated_at
      FROM users
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit);

    return res.status(200).json({ success: true, players: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/sessions
 * Quick session creator for testing
 */
adminRouter.post('/sessions', checkAdmin, (req, res) => {
  try {
    const { username, balance, currency } = req.body;
    const playerId = `usr_${Date.now()}`;
    const initialBalance = balance !== undefined ? parseFloat(balance) : 1000;

    const user = getOrCreateUser(playerId, username || 'Tester', currency || 'USD', initialBalance);
    const token = createSession(user.id, 'admin_panel');

    const host = req.get('host');
    const protocol = req.protocol;
    const launchUrl = `${protocol}://${host}/?token=${token}`;

    return res.status(200).json({
      success: true,
      token,
      launchUrl,
      user,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
