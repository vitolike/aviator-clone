// Live betting panel bots with masked nicknames and realistic USD amounts
import { RULES } from '../config.js';

// Prevalent 'd' prefix matching authentic Spribe Aviator screenshot
const HEAD = 'ddddddddabcefghjklmnprstvwxyz';
const AMOUNTS = [
  100, 100, 100, 100, 100, 100, 92.25, 91.88, 83.34, 83.34, 81.43, 75, 50, 50, 40,
  35.5, 30, 25, 20, 20, 15, 12.5, 10, 10, 10, 8, 5, 5, 2, 1, 1
];
const AVATAR = [0x28a909, 0xe21c3d, 0x34b4ff, 0x913ef8, 0xd07206, 0xc017b4, 0x00b3a4, 0xf3901c, 0xffd60a];

function maskName() {
  const a = HEAD[(Math.random() * HEAD.length) | 0];
  const d = (Math.random() * 10) | 0;
  return `${a}***${d}`;
}

// Multiplier target distribution
function targetMult() {
  const r = Math.random();
  if (r < 0.42) return 1.1 + Math.random() * 0.9;      // 1.10 ~ 2.00
  if (r < 0.75) return 2 + Math.random() * 2;          // 2 ~ 4
  if (r < 0.92) return 4 + Math.random() * 6;          // 4 ~ 10
  if (r < 0.99) return 10 + Math.random() * 40;        // 10 ~ 50
  return 50 + Math.random() * 450;                     // rare moon shots
}

export class Bots {
  constructor() {
    this.list = [];
    this.newRound();
  }

  newRound() {
    const n = 175 + ((Math.random() * 16) | 0); // Dense 175-190 range from the reference feed.
    this.list = Array.from({ length: n }, () => ({
      name: maskName(),
      color: AVATAR[(Math.random() * AVATAR.length) | 0],
      avatarId: 1 + ((Math.random() * 72) | 0),
      amount: AMOUNTS[(Math.random() * AMOUNTS.length) | 0],
      target: targetMult(),
      m: 0, win: 0, cashed: false, cashedAt: 0, mine: false, lost: false,
    }));
    this.list.sort((a, b) => b.amount - a.amount);
  }

  // Insert player's own active bet at top
  addMine(amount, slotIndex) {
    const avId = this.userAvatarId || parseInt(localStorage.getItem('aviator_user_avatar') || '1', 10);
    this.list.unshift({
      name: 'You',
      color: 0xffd60a,
      avatarId: avId,
      amount,
      target: Infinity,
      m: 0,
      win: 0,
      cashed: false,
      cashedAt: 0,
      mine: true,
      lost: false,
      slotIndex
    });
  }

  cashMine(slotIndex, m, win) {
    const b = this.list.find((x) => x.mine && x.slotIndex === slotIndex && !x.cashed);
    if (b) {
      b.cashed = true;
      b.cashedAt = Date.now();
      b.m = m;
      b.win = win;
    }
  }

  removeMine(slotIndex) {
    const i = this.list.findIndex((x) => x.mine && x.slotIndex === slotIndex && !x.cashed);
    if (i >= 0) this.list.splice(i, 1);
  }

  update(mult) {
    let changed = false;
    const now = Date.now();
    for (const b of this.list) {
      if (!b.cashed && !b.mine && mult >= b.target) {
        b.cashed = true;
        b.cashedAt = now;
        b.m = Math.floor(b.target * 100) / 100;
        b.win = Math.min(b.amount * b.m, RULES.maxWinPerBet);
        changed = true;
      }
    }
    return changed;
  }

  crash() {
    for (const b of this.list) if (!b.cashed) b.lost = true;
  }

  get stats() {
    const total = this.list.length;
    const cashed = this.list.filter((b) => b.cashed).length;
    const totalBet = this.list.reduce((s, b) => s + b.amount, 0);
    const totalWin = this.list.reduce((s, b) => s + b.win, 0);
    return { total, cashed, totalBet, totalWin };
  }
}
