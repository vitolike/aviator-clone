import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { db, getUserByToken, getUserById } from './db.js';
import { serverEngine, PHASE } from './engine.js';
import { seamlessRouter } from './routes/seamless.js';
import { sessionRouter } from './routes/session.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    phase: serverEngine.phase,
    multiplier: serverEngine.mult,
  });
});

// API Routes
app.use('/api/seamless', seamlessRouter);
app.use('/api/session', sessionRouter);
app.use('/api/admin', adminRouter);

// Serve Admin Dashboard
app.use('/admin', express.static(path.resolve(process.cwd(), 'admin')));

// Serve Game Front-End and Static Assets
app.use(express.static(path.resolve(process.cwd()), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  },
}));

// Route fallback for client-side navigation
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.resolve(process.cwd(), 'admin', 'index.html'));
  }
  return res.sendFile(path.resolve(process.cwd(), 'index.html'));
});

// WebSocket Client Tracking
const clients = new Map(); // ws -> { userId, username, token }

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function sendToUser(userId, payload) {
  const data = JSON.stringify(payload);
  for (const [ws, meta] of clients.entries()) {
    if (meta.userId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

// Attach Server Engine Events to WebSocket Broadcasts
serverEngine.on('round_betting', (data) => {
  broadcast({ type: 'phase', phase: PHASE.BETTING, ...data });
});

serverEngine.on('round_flying', (data) => {
  broadcast({ type: 'phase', phase: PHASE.FLYING, ...data });
});

serverEngine.on('tick', (data) => {
  broadcast({ type: 'tick', ...data });
});

serverEngine.on('round_crashed', (data) => {
  broadcast({ type: 'phase', phase: PHASE.CRASHED, ...data });
});

serverEngine.on('bet_placed', (bet) => {
  broadcast({
    type: 'live_bet_placed',
    bet: {
      id: bet.id,
      userId: bet.userId,
      username: bet.username,
      amount: bet.amount,
      targetMult: bet.targetMult,
    },
  });
  sendToUser(bet.userId, { type: 'balance_update', balance: bet.newBalance });
});

serverEngine.on('bet_cancelled', (data) => {
  sendToUser(data.userId, { type: 'balance_update', balance: data.newBalance });
});

serverEngine.on('bet_cashed', (data) => {
  broadcast({
    type: 'live_bet_cashed',
    bet: {
      id: data.betId,
      userId: data.userId,
      username: data.username,
      amount: data.amount,
      mult: data.mult,
      winAmount: data.winAmount,
    },
  });
  sendToUser(data.userId, { type: 'balance_update', balance: data.newBalance });
});

// WebSocket Connection Handling
wss.on('connection', (ws, req) => {
  clients.set(ws, { userId: null, username: 'Anonymous', token: null });

  // Extract initial token from query if available (?token=xxx)
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (token) {
    const user = getUserByToken(token);
    if (user) {
      clients.set(ws, { userId: user.id, username: user.username, token });
    }
  }

  // Send initial welcome state
  const round = serverEngine.currentRound;
  ws.send(JSON.stringify({
    type: 'state',
    phase: serverEngine.phase,
    mult: serverEngine.mult,
    roundId: round ? round.id : 0,
    hash: round ? round.hash : '',
    countdownEndsAt: serverEngine.bettingEndsAt || 0,
  }));

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === 'auth') {
        const user = getUserByToken(msg.token);
        if (user) {
          clients.set(ws, { userId: user.id, username: user.username, token: msg.token });
          ws.send(JSON.stringify({
            type: 'auth_success',
            user: { id: user.id, username: user.username, balance: user.balance, currency: user.currency },
          }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid session token' }));
        }
      } else if (msg.type === 'place_bet') {
        const meta = clients.get(ws);
        if (!meta || !meta.userId) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
        }
        try {
          const res = serverEngine.placeBet(meta.userId, msg.slotIndex || 0, parseFloat(msg.amount), parseFloat(msg.targetMult || 0));
          ws.send(JSON.stringify({ type: 'bet_confirmed', bet: res.bet, balance: res.balance }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'bet_error', message: err.message, slotIndex: msg.slotIndex }));
        }
      } else if (msg.type === 'cancel_bet') {
        const meta = clients.get(ws);
        if (!meta || !meta.userId) return;
        try {
          const res = serverEngine.cancelBet(meta.userId, msg.betId);
          ws.send(JSON.stringify({ type: 'cancel_confirmed', betId: msg.betId, balance: res.balance }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'cancel_error', message: err.message }));
        }
      } else if (msg.type === 'cash_out') {
        const meta = clients.get(ws);
        if (!meta || !meta.userId) return;
        try {
          const res = serverEngine.cashOut(meta.userId, msg.betId);
          ws.send(JSON.stringify({ type: 'cashout_confirmed', betId: msg.betId, mult: res.mult, winAmount: res.winAmount, balance: res.balance }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'cashout_error', message: err.message }));
        }
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message payload' }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

const PORT = parseInt(process.env.PORT || '80', 10);
server.listen(PORT, () => {
  console.log(`🚀 Aviator High-Performance Server running on port ${PORT}`);
  console.log(`📊 Admin Panel accessible at http://localhost:${PORT}/admin`);
  console.log(`🎮 Game Front-End accessible at http://localhost:${PORT}/`);
});
