import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'aviator.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency and performance
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
`);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    balance REAL DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    operator_id TEXT,
    return_url TEXT,
    active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_seed TEXT NOT NULL,
    client_seed TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    hash TEXT NOT NULL,
    crash_multiplier REAL NOT NULL,
    status TEXT DEFAULT 'betting',
    started_at INTEGER NOT NULL,
    crashed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS bets (
    id TEXT PRIMARY KEY,
    round_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    slot_index INTEGER DEFAULT 0,
    amount REAL NOT NULL,
    target_mult REAL DEFAULT 0,
    cashout_mult REAL DEFAULT 0,
    win_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'placed',
    created_at INTEGER NOT NULL,
    cashed_at INTEGER,
    FOREIGN KEY(round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance_before REAL NOT NULL,
    balance_after REAL NOT NULL,
    reference_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed default settings if empty
const defaultSettings = [
  ['rtp', '97.0'],
  ['min_bet', '0.10'],
  ['max_bet', '1000.00'],
  ['max_win', '10000.00'],
  ['force_next_crash', '0'],
  ['growth_rate', '0.0865'],
  ['betting_countdown_ms', '5000'],
  ['admin_password', 'admin123'],
];

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

for (const [key, val] of defaultSettings) {
  if (!getSettingStmt.get(key)) {
    setSettingStmt.run(key, val);
  }
}

// Helpers for settings
export function getSetting(key, defaultValue = null) {
  const row = getSettingStmt.get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  setSettingStmt.run(key, String(value));
}

// User / Account Helpers
export function getOrCreateUser(id, username = 'Player', currency = 'USD', initialBalance = 30000) {
  const selectStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  let user = selectStmt.get(id);
  const now = Date.now();

  if (!user) {
    const insertStmt = db.prepare(`
      INSERT INTO users (id, username, currency, balance, is_admin, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `);
    insertStmt.run(id, username, currency, initialBalance, now, now);
    user = selectStmt.get(id);
  }
  return user;
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByToken(token) {
  const query = `
    SELECT u.*, s.token as session_token, s.operator_id, s.return_url
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.active = 1
  `;
  return db.prepare(query).get(token);
}

// Session Creation Helper
export function createSession(userId, operatorId = null, returnUrl = null, expiresInMs = 86400000) {
  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const expiresAt = now + expiresInMs;

  db.prepare(`
    INSERT INTO sessions (token, user_id, operator_id, return_url, active, created_at, expires_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(token, userId, operatorId, returnUrl, now, expiresAt);

  return token;
}

// Atomic Balance Adjustment with Ledger Transaction Log
export function adjustBalance(userId, amount, type, referenceId = null) {
  const user = getUserById(userId);
  if (!user) throw new Error('User not found');

  const before = user.balance;
  const after = Math.round((before + amount) * 100) / 100;
  if (after < 0) throw new Error('Insufficient balance');

  const now = Date.now();

  db.prepare('UPDATE users SET balance = ?, updated_at = ? WHERE id = ?').run(after, now, userId);
  db.prepare(`
    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, type, amount, before, after, referenceId, now);

  return { before, after };
}
