import express from 'express';
import { getOrCreateUser, createSession, getUserById, getUserByToken, adjustBalance } from '../db.js';

export const seamlessRouter = express.Router();

/**
 * POST /api/seamless/session
 * Operator integration endpoint: Create or authenticate player and generate a launch session
 * Payload: { playerId || external_player_id, username, currency, balance || initial_balance, operatorId, returnUrl }
 */
seamlessRouter.post('/session', (req, res) => {
  try {
    const playerId = req.body.playerId || req.body.external_player_id || req.body.player_id;
    const username = req.body.username;
    const currency = req.body.currency;
    const rawBalance = req.body.balance !== undefined ? req.body.balance : req.body.initial_balance;
    const operatorId = req.body.operatorId || req.body.operator_id;
    const returnUrl = req.body.returnUrl || req.body.return_url;

    if (!playerId) {
      return res.status(400).json({ success: false, error: 'playerId (or external_player_id) is required' });
    }

    const initialBalance = rawBalance !== undefined ? parseFloat(rawBalance) : 30000;
    const userCurrency = (currency || 'USD').toUpperCase();
    const playerName = username || `Player_${String(playerId).slice(0, 6)}`;

    // Get existing user or create a new user record
    const user = getOrCreateUser(String(playerId), playerName, userCurrency, initialBalance);

    // If operator provided an explicit balance sync, update it
    if (rawBalance !== undefined && parseFloat(rawBalance) !== user.balance) {
      const diff = parseFloat(rawBalance) - user.balance;
      adjustBalance(user.id, diff, 'operator_sync', 'seamless_session');
    }

    // Generate unique session token
    const token = createSession(user.id, operatorId || 'default', returnUrl || null);
    const host = req.get('host');
    const protocol = req.protocol;
    const launchUrl = `${protocol}://${host}/?token=${token}`;

    const refreshedUser = getUserById(user.id);

    return res.status(200).json({
      success: true,
      token,
      launchUrl,
      user: {
        id: refreshedUser.id,
        username: refreshedUser.username,
        currency: refreshedUser.currency,
        balance: refreshedUser.balance,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/seamless/balance
 * Check balance for a player by playerId or session token
 * Query: ?playerId=xxx OR ?token=xxx
 */
seamlessRouter.get('/balance', (req, res) => {
  try {
    const playerId = req.query.playerId || req.query.player_id;
    const token = req.query.token;

    let user = null;
    if (token) {
      user = getUserByToken(String(token));
    } else if (playerId) {
      user = getUserById(String(playerId));
    } else {
      return res.status(400).json({ success: false, error: 'playerId or token query param required' });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      playerId: user.id,
      balance: user.balance,
      currency: user.currency,
      username: user.username,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/seamless/transaction
 * Operator balance credit/debit transaction
 * Payload: { playerId || token, amount, type ('DEBIT'|'CREDIT'|'ADJUST'), referenceId || transaction_id }
 */
seamlessRouter.post('/transaction', (req, res) => {
  try {
    const playerId = req.body.playerId || req.body.player_id;
    const token = req.body.token;
    const type = (req.body.type || 'ADJUST').toUpperCase();
    const referenceId = req.body.referenceId || req.body.transaction_id || req.body.reference_id;
    let amount = parseFloat(req.body.amount);

    if (isNaN(amount)) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    let targetUserId = null;
    if (token) {
      const user = getUserByToken(String(token));
      if (!user) return res.status(404).json({ success: false, error: 'Invalid session token' });
      targetUserId = user.id;
    } else if (playerId) {
      targetUserId = String(playerId);
    } else {
      return res.status(400).json({ success: false, error: 'playerId or token is required' });
    }

    // Convert DEBIT to negative delta if positive
    let delta = amount;
    if (type === 'DEBIT' && delta > 0) {
      delta = -delta;
    }

    const result = adjustBalance(targetUserId, delta, type, referenceId || null);

    return res.status(200).json({
      success: true,
      playerId: targetUserId,
      type,
      delta,
      balanceBefore: result.before,
      balanceAfter: result.after,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});
