// Authentic Aviator Win Toast Notification
// Exactly matching the official Spribe Aviator design from the user screenshot
import { Container, Graphics } from '../../vendor/pixi.min.mjs';
import { COLORS, CURRENCY } from '../config.js';
import { txt, panelBg, iconGfx, fmt } from './ui.js';

// Draw an outlined 5-pointed star
function drawOutlinedStar(g, cx, cy, outerRadius, innerRadius, strokeColor = 0xffffff, strokeWidth = 1.3, alpha = 0.42) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const spikes = 5;
  const step = Math.PI / spikes;

  g.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    g.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    g.lineTo(x, y);
    rot += step;
  }
  g.lineTo(cx, cy - outerRadius);
  g.closePath();
  g.stroke({ width: strokeWidth, color: strokeColor, alpha });
}

// Particle burst effect on cashout
class WinParticleBurst extends Container {
  constructor(x, y, isBigWin = false) {
    super();
    this.position.set(x, y);
    this.particles = [];
    const count = isBigWin ? 16 : 10;
    const colors = isBigWin ? [COLORS.gold, 0xffffff, 0xffa500] : [0x4eaf11, 0x85e622, 0xffffff];

    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 1.6 + Math.random() * 2.4;
      const size = 1.8 + Math.random() * 2.0;
      const col = colors[Math.floor(Math.random() * colors.length)];

      if (Math.random() > 0.5) {
        drawOutlinedStar(g, 0, 0, size * 1.5, size * 0.7, col, 1, 0.95);
      } else {
        g.circle(0, 0, size).fill({ color: col, alpha: 0.95 });
      }

      this.addChild(g);
      this.particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: (Math.random() - 0.5) * 0.15,
        alpha: 1,
      });
    }

    this.life = 600;
    this.t = 0;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    const p = this.t / this.life;
    if (p >= 1) {
      this.dead = true;
      this.visible = false;
      return;
    }

    const fade = 1 - p * p;
    for (const pt of this.particles) {
      pt.g.x += pt.vx;
      pt.g.y += pt.vy;
      pt.vy += 0.035;
      pt.g.rotation += pt.rot;
      pt.g.alpha = fade;
    }
  }
}

// Single Win Toast Item matching reference screenshot exactly
export class WinToastItem extends Container {
  constructor(data, onDismiss) {
    super();
    this.data = data;
    this.onDismiss = onDismiss;
    this.slotIndex = data.slotIndex ?? 0;
    this.mult = data.mult || 1.0;
    this.win = data.win || 0;
    this.currency = data.currency || CURRENCY;
    this.isBigWin = this.mult >= 10 || this.win >= 100;

    // Responsive toast dimensions matching screenshot
    const maxW = (data.arenaW || 380) - 20;
    this.tw = Math.min(380, Math.max(280, maxW));
    this.th = 48; // Sleek capsule height
    this.targetY = 10;
    this.startY = -65;
    this.currentY = -65;

    // Animation phases: 'in', 'hold', 'out'
    this.phase = 'in';
    this.animT = 0;
    this.holdDuration = this.isBigWin ? 3800 : 3200;
    this.dead = false;

    this.build();
  }

  build() {
    const w = this.tw;
    const h = this.th;
    const r = h / 2; // Pill shape (24px)

    this.body = new Container();
    this.addChild(this.body);

    // 1. Main outer pill background: deep dark translucent forest/olive green with emerald border
    this.bgG = new Graphics();
    const bgColor = this.isBigWin ? 0x1f1402 : 0x0f2905;
    const borderColor = this.isBigWin ? 0xffd60a : 0x3ea816;
    panelBg(this.bgG, w, h, r, bgColor, borderColor, 0.96);
    this.body.addChild(this.bgG);

    // Halo glow for high multiplier wins
    if (this.isBigWin) {
      this.glowG = new Graphics();
      this.glowG.roundRect(-2, -2, w + 4, h + 4, r + 2).stroke({ width: 2, color: 0xffd60a, alpha: 0.4 });
      this.body.addChildAt(this.glowG, 0);
    }

    // Right elements placement:
    // Close button (far right circle)
    const closeR = 15;
    const closeX = w - closeR - 8;
    const closeY = h / 2;

    // Right "Win USD" pill (got-block)
    const gw = Math.min(142, Math.max(124, w * 0.38));
    const gh = 38;
    const gr = gh / 2;
    const gx = closeX - closeR - 8 - gw;
    const gy = (h - gh) / 2;

    // 2. Left block: "You have cashed out!" + multiplier (centered horizontally in left area)
    const leftW = gx;
    this.leftSec = new Container();
    this.leftSec.position.set(0, 0);

    const titleColor = this.isBigWin ? 0xf4e287 : 0xa4aba0;
    this.titleText = txt('You have cashed out!', 12, titleColor, '500', 'center');
    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(leftW / 2 + 6, 7);
    this.leftSec.addChild(this.titleText);

    this.multText = txt(`${this.mult.toFixed(2)}x`, 16, 0xffffff, '800', 'center');
    this.multText.anchor.set(0.5, 0);
    this.multText.position.set(leftW / 2 + 6, 23);
    this.leftSec.addChild(this.multText);

    this.body.addChild(this.leftSec);

    // 3. Right Section: Authentic "Win USD" pill with stars
    this.gotBlock = new Container();
    this.gotBlock.position.set(gx, gy);

    this.gotBg = new Graphics();
    const gotBgColor = this.isBigWin ? 0xc86a05 : 0x4a8522; // Authentic olive-green capsule
    panelBg(this.gotBg, gw, gh, gr, gotBgColor, null, 1);
    this.gotBlock.addChild(this.gotBg);

    // Draw the 2 outlined stars on left and 2 outlined stars on right matching screenshot!
    this.starsG = new Graphics();
    const starStroke = 0xffffff;

    // Left pair: top-left bigger star, bottom-right smaller star
    drawOutlinedStar(this.starsG, 16, 13, 8.5, 3.8, starStroke, 1.25, 0.45);
    drawOutlinedStar(this.starsG, 24, 25, 5.5, 2.5, starStroke, 1.15, 0.40);

    // Right pair: top-right bigger star, bottom-left smaller star
    drawOutlinedStar(this.starsG, gw - 16, 13, 8.5, 3.8, starStroke, 1.25, 0.45);
    drawOutlinedStar(this.starsG, gw - 24, 25, 5.5, 2.5, starStroke, 1.15, 0.40);

    this.gotBlock.addChild(this.starsG);

    // Top text: "Win USD"
    const winTitle = `Win ${this.currency}`;
    this.gotLabel = txt(winTitle, 12, 0xffffff, '800', 'center');
    this.gotLabel.anchor.set(0.5, 0);
    this.gotLabel.position.set(gw / 2, 4);
    this.gotBlock.addChild(this.gotLabel);

    // Bottom text: Amount e.g. "1.11"
    const amtStr = fmt(this.win);
    const amtSize = amtStr.length > 9 ? 14 : 17;
    this.amtText = txt(amtStr, amtSize, 0xffffff, '900', 'center');
    this.amtText.anchor.set(0.5, 0);
    this.amtText.position.set(gw / 2, 18);
    this.gotBlock.addChild(this.amtText);

    this.body.addChild(this.gotBlock);

    // 4. Close Button (circular button with white X)
    this.closeBtn = new Container();
    this.closeBtn.position.set(closeX, closeY);

    this.closeCircle = new Graphics();
    this.closeCircle.circle(0, 0, closeR).fill({ color: 0x1f3d13, alpha: 0.95 });
    this.closeCircle.circle(0, 0, closeR).stroke({ width: 1, color: 0x3ea816, alpha: 0.4 });

    this.closeIcon = iconGfx('close', 9, 0xffffff);

    this.closeBtn.addChild(this.closeCircle, this.closeIcon);
    this.closeBtn.eventMode = 'static';
    this.closeBtn.cursor = 'pointer';

    this.closeBtn.on('pointerenter', () => {
      this.closeCircle.tint = 0x2e591c;
      this.closeBtn.scale.set(1.1);
    });
    this.closeBtn.on('pointerleave', () => {
      this.closeCircle.tint = 0xffffff;
      this.closeBtn.scale.set(1);
    });
    this.closeBtn.on('pointertap', (e) => {
      e?.stopPropagation?.();
      this.dismiss();
    });

    this.body.addChild(this.closeBtn);

    // Hover pauses auto-dismiss
    this.body.eventMode = 'static';
    this.body.on('pointerenter', () => { this._hovered = true; });
    this.body.on('pointerleave', () => { this._hovered = false; });

    // Initial positioning: center horizontally around x = 0
    this.body.position.set(-w / 2, this.currentY);
    this.alpha = 0;

    // Celebratory burst particles
    this.burst = new WinParticleBurst(gx - w / 2 + gw / 2, gy + gh / 2, this.isBigWin);
    this.addChild(this.burst);
  }

  dismiss() {
    if (this.phase === 'out' || this.dead) return;
    this.phase = 'out';
    this.animT = 0;
  }

  update(dt) {
    if (this.dead) return;

    if (this.burst) {
      this.burst.update(dt);
      if (this.burst.dead) {
        this.removeChild(this.burst);
        this.burst = null;
      }
    }

    if (this.phase === 'in') {
      this.animT += dt;
      const dur = 280;
      const t = Math.min(1, this.animT / dur);

      // Smooth spring bounce
      const overshoot = 1.06;
      const ease = Math.sin((t * Math.PI) / 2) * overshoot;

      const fromY = this.startY;
      this.currentY = fromY + (this.targetY - fromY) * Math.min(1, ease);
      this.alpha = Math.min(1, t * 1.6);
      this.body.scale.set(0.94 + 0.06 * Math.min(1, t * 1.2));

      if (t >= 1) {
        this.phase = 'hold';
        this.animT = 0;
        this.currentY = this.targetY;
        this.alpha = 1;
        this.body.scale.set(1);
      }
    } else if (this.phase === 'hold') {
      if (!this._hovered) {
        this.animT += dt;
        if (this.animT >= this.holdDuration) {
          this.phase = 'out';
          this.animT = 0;
        }
      }

      // Smooth position interpolation if other toasts close
      this.currentY += (this.targetY - this.currentY) * 0.22;
    } else if (this.phase === 'out') {
      this.animT += dt;
      const dur = 220;
      const t = Math.min(1, this.animT / dur);

      this.currentY -= dt * 0.25;
      this.alpha = Math.max(0, 1 - t);
      this.body.scale.set(1 - t * 0.08);

      if (t >= 1) {
        this.dead = true;
        this.onDismiss?.(this);
      }
    }

    this.body.y = this.currentY;
  }
}

// Global Toast Manager Container
export class ToastManager extends Container {
  constructor() {
    super();
    this.toasts = [];
    this.cx = 0;
    this.arenaY = 0;
    this.arenaW = 800;
  }

  showWin({ slotIndex = 0, mult = 1.0, win = 0, currency = CURRENCY } = {}) {
    const existing = this.toasts.find((t) => t.slotIndex === slotIndex && !t.dead);
    if (existing) existing.dismiss();

    const toast = new WinToastItem({ slotIndex, mult, win, currency, arenaW: this.arenaW }, (item) => {
      this.removeToast(item);
    });

    this.addChild(toast);
    this.toasts.push(toast);
    this.relayoutToasts();
    return toast;
  }

  removeToast(item) {
    const idx = this.toasts.indexOf(item);
    if (idx >= 0) {
      this.toasts.splice(idx, 1);
      this.removeChild(item);
      this.relayoutToasts();
    }
  }

  relayoutToasts() {
    // Stack active toasts overlapping the history line (like official Spribe screenshot)
    const topMargin = 8;
    const gap = 6;
    let y = (this.arenaY || 0) + topMargin;

    for (const t of this.toasts) {
      if (t.dead) continue;
      t.position.x = this.cx;
      t.targetY = y;
      if (t.phase === 'in' && t.startY === -65) {
        t.startY = -65;
        t.currentY = t.startY;
      }
      y += t.th + gap;
    }
  }

  resize(arenaX, arenaY, arenaW, arenaH, mobile) {
    // Centered horizontally over the flight & history area
    this.cx = arenaX + arenaW / 2;
    this.arenaY = arenaY;
    this.arenaW = arenaW;
    this.relayoutToasts();
  }

  update(dt) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.update(dt);
      if (t.dead) {
        this.removeToast(t);
      }
    }
  }

  clear() {
    for (const t of this.toasts) {
      t.dismiss();
    }
  }
}
