// Provably Fair System
// Standard Crash algorithm procedure:
//   1. Generate serverSeed before round starts, publishing only its SHA-256 commitment hash
//   2. Multiplier is determined by SHA-256(serverSeed:clientSeed:nonce), predetermined before takeoff
//   3. After round crashes, reveal serverSeed so players can independently verify
// Distribution: P(crash >= m) = RTP / m -> Expected return rate equals RTP (97%)

import { RULES } from '../config.js';

const enc = new TextEncoder();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return toHex(buf);
}

export function randomSeed(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a.buffer);
}

// Pure function to calculate crash multiplier from hash (used in game and verification dialog)
export function crashFromHash(hash) {
  // Take first 13 hex characters (52 bits) and convert to uniform random [0, 1)
  const h = parseInt(hash.slice(0, 13), 16);
  const r = h / 2 ** 52;
  const raw = RULES.rtp / (1 - r);
  if (!isFinite(raw) || raw < 1) return 1.0;
  const m = Math.round(raw * 100) / 100; // Round to 2 decimal places
  return Math.min(m, RULES.maxMultiplier);
}

// Generate provably fair data for a round
export async function makeRound(clientSeed, nonce) {
  const serverSeed = randomSeed(16);
  const commit = await sha256Hex(serverSeed);
  const hash = await sha256Hex(`${serverSeed}:${clientSeed}:${nonce}`);
  return { serverSeed, commit, clientSeed, nonce, hash, crash: crashFromHash(hash) };
}

// Used by the verification panel
export async function verify(serverSeed, clientSeed, nonce) {
  const hash = await sha256Hex(`${serverSeed}:${clientSeed}:${nonce}`);
  return { hash, crash: crashFromHash(hash), commit: await sha256Hex(serverSeed) };
}
