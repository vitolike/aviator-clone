import { Container, Graphics, Rectangle, Sprite, Texture } from '../../vendor/pixi.min.mjs';
import { COLORS, RULES } from '../config.js';
import { PHASE } from '../core/engine.js';
import { curveFill, sunburst, planeFallback, radialGlow, centralSpotlight, fanRaysTexture } from './textures.js';
import { txt, panelBg } from './ui.js';

export class FlightView extends Container {
  constructor(engine, bots, L, planeTexture) {
    super();
    this.engine = engine;
    this.bots = bots;
    this.L = L;
    this.w = 800; this.h = 500;
    this.time = 0;
    this.crashAnim = 0;
    this.shake = 0;

    // Dark rounded background
    this.bgG = new Graphics();
    this.addChild(this.bgG);

    // Next Round Screen (Authentic UFC x Aviator Official Partners)
    this.nextRoundScreen = new Container();
    this.nrRays = new Sprite(fanRaysTexture());
    this.nrRays.anchor.set(0.5);
    this.nrLockup = new Container();
    this.nrUfcLockup = Sprite.from('assets/images/ufc.svg');
    this.nrUfcLockup.anchor.set(0.5);
    this.nrUfcLockup.width = 375;
    this.nrUfcLockup.height = 148;
    this.nrUfcLockup.position.set(0, -68);
    this.nrOfficial = Sprite.from('assets/images/official.svg');
    this.nrOfficial.anchor.set(0.5);
    this.nrOfficial.width = 132;
    this.nrOfficial.height = 92;
    this.nrOfficial.position.set(0, 96);
    this.nrLockup.addChild(this.nrUfcLockup, this.nrOfficial);

    this.nextRoundScreen.addChild(this.nrRays, this.nrLockup);
    this.nextRoundScreen.visible = false;
    this.addChild(this.nextRoundScreen);

    // Subtle sunburst rays rotating from bottom-left origin
    this.burst = new Sprite(sunburst());
    this.burst.anchor.set(0.5);
    this.burst.alpha = 0.45;
    this.addChild(this.burst);

    // Deep cyan/blue central spotlight behind the multiplier (Authentic Spribe glow)
    this.spotlight = new Sprite(centralSpotlight());
    this.spotlight.anchor.set(0.5);
    this.spotlight.alpha = 0.85;
    this.addChild(this.spotlight);

    // Star specks
    this.stars = new Graphics();
    this.addChild(this.stars);
    this._stars = Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.4,
    }));

    // Grid axis lines
    this.axis = new Graphics();
    this.addChild(this.axis);

    // Filled area under red curve
    this.fillSprite = new Sprite(curveFill());
    this.fillMask = new Graphics();
    this.fillSprite.mask = this.fillMask;
    this.addChild(this.fillSprite, this.fillMask);

    // Red flight trajectory curve
    this.curve = new Graphics();
    this.addChild(this.curve);

    // Soft plane halo glow
    this.glow = new Sprite(radialGlow('plane', 0xff3b57, 0.5));
    this.glow.anchor.set(0.5);
    this.glow.alpha = 0;
    this.addChild(this.glow);

    // Official Spribe Aviator 4-frame Animated Propeller Plane
    this.planeFrames = [
      Texture.from('assets/images/plane/plane_frame_0.png'),
      Texture.from('assets/images/plane/plane_frame_1.png'),
      Texture.from('assets/images/plane/plane_frame_2.png'),
      Texture.from('assets/images/plane/plane_frame_3.png'),
    ];
    this.frameIdx = 0;
    this.frameTimer = 0;
    this.plane = new Sprite(this.planeFrames[0]);
    this.plane.anchor.set(0.5);
    this.addChild(this.plane);

    // Central Big Multiplier (e.g. 1.18x)
    this.mult = txt('1.00x', 84, COLORS.text, '900');
    this.mult.anchor.set(0.5);
    this.addChild(this.mult);

    // Status text (WAITING FOR NEXT ROUND / FLEW AWAY!)
    this.status = txt('', 22, COLORS.text, '800');
    this.status.anchor.set(0.5);
    this.addChild(this.status);

    // Waiting countdown bar
    this.barBg = new Graphics();
    this.bar = new Graphics();
    this.addChild(this.barBg, this.bar);

    // Bottom-right In-flight active players badge
    this.inFlightBadge = new Container();
    this.inFlightBg = new Graphics();
    this.inFlightAvatars = new Container();
    this.inFlightAvatarRings = new Graphics();
    this.inFlightAvatarSprites = [16, 2, 5].map((id) => {
      const avatar = Sprite.from(`assets/images/avatars/av-${id}.png`);
      avatar.anchor.set(0.5);
      this.inFlightAvatars.addChild(avatar);
      return avatar;
    });
    this.inFlightCount = txt('0', 16, COLORS.text, '700');
    this.inFlightCount.anchor.set(0, 0.5);
    this.inFlightBadge.addChild(this.inFlightBg, this.inFlightAvatars, this.inFlightAvatarRings, this.inFlightCount);
    this.addChild(this.inFlightBadge);

    // DEV crosshair
    this.devHint = new Graphics();
    this.devHint.visible = false;
    this.addChild(this.devHint);
  }

  enableDevDrag(on, onChange) {
    this.eventMode = on ? 'static' : 'none';
    this.hitArea = on ? new Rectangle(0, 0, this.w, this.h) : null;
    this.devHint.visible = on;
    if (on && !this._devBound) {
      this._devBound = true;
      const move = (e) => {
        if (!this._devDrag) return;
        const p = e.getLocalPosition(this);
        this._onDevChange?.(
          Math.max(0.3, Math.min(0.97, p.x / this.w)),
          Math.max(0.03, Math.min(0.7, p.y / this.h)),
        );
      };
      this.on('pointerdown', (e) => { this._devDrag = true; move(e); });
      this.on('globalpointermove', move);
      this.on('pointerup', () => { this._devDrag = false; });
      this.on('pointerupoutside', () => { this._devDrag = false; });
    }
    this._onDevChange = onChange;
  }

  resize(w, h, L) {
    this.w = w; this.h = h; this.L = L;
    if (this.hitArea) this.hitArea = new Rectangle(0, 0, w, h);

    this.burst.position.set(w * L.originX, h * L.originY);
    this.burst.width = this.burst.height = Math.max(w, h) * 2.1;

    this.spotlight.position.set(w * 0.58, h * 0.38);
    this.spotlight.width = Math.max(w, h) * 1.3;
    this.spotlight.height = Math.max(w, h) * 1.3;

    this.mult.style.fontSize = L.multSize;
    this.status.style.fontSize = L.statusSize;
    this.plane.scale.set((h / 500) * L.planeScale * 1.5);
    this.glow.width = this.glow.height = h * 0.45;
    this.fillSprite.width = w;
    this.fillSprite.height = h;


    // Layout Next Round screen
    this.nrRays.width = w;
    this.nrRays.height = h;
    this.nrRays.position.set(w / 2, h / 2);
    const lockupScale = Math.min(1, Math.min((w * 0.82) / 375, (h * 0.72) / 308));
    this.nrScale = lockupScale;
    this.nrLockup.scale.set(lockupScale);
    this.nrLockup.position.set(w / 2, h / 2);

    // Layout In-Flight badge at bottom right
    const badgeW = 114, badgeH = 40;
    this.inFlightBadge.position.set(w - badgeW - 14, h - badgeH - 12);
    panelBg(this.inFlightBg, badgeW, badgeH, badgeH / 2, 0x141517, 0x2a2b2e);
    this.inFlightAvatarRings.clear();
    const ringColors = [0x55bd32, 0xf3c52b, 0x55bd32];
    this.inFlightAvatarSprites.forEach((avatar, i) => {
      const x = 18 + i * 18;
      avatar.position.set(x, badgeH / 2);
      avatar.width = avatar.height = 30;
      this.inFlightAvatarRings.circle(x, badgeH / 2, 15).stroke({ width: 1.5, color: ringColors[i] });
    });
    this.inFlightCount.position.set(74, badgeH / 2);

    this.drawBg();
  }

  drawBg() {
    const { w, h } = this;
    const r = 18;
    panelBg(this.bgG, w, h, r, 0x090a0d, 0x1f2126);
    this.stars.clear();
    for (const s of this._stars) {
      this.stars.circle(s.x * w, s.y * h * 0.92, s.r).fill({ color: 0xffffff, alpha: 0.28 });
    }
  }

  planePos(tMs, phase) {
    const { w, h, L } = this;
    const ox = w * L.originX, oy = h * L.originY;
    const tx = w * L.planeX, ty = h * L.planeY;
    const p = Math.max(0, Math.min(1, tMs / RULES.reachMs));
    const e = 1 - (1 - p) ** 2.2;
    let x = ox + (tx - ox) * e;
    let y = oy + (ty - oy) * (1 - (1 - p) ** 1.5);
    if (p >= 1) {
      const t = this.time / 1000;
      x += Math.sin(t * 1.7) * w * 0.016;
      y += Math.sin(t * 2.3 + 1) * h * 0.032;
    }
    return { x, y, p };
  }

  update(dt) {
    const { engine, w, h, L } = this;
    this.time += dt;
    const phase = engine.phase;
    const flying = phase === PHASE.FLYING;
    const crashed = phase === PHASE.CRASHED;
    this.inFlightCount.text = String(this.bots.stats.total);

    if (this.animateBackground !== false) this.burst.rotation += dt * (flying ? 0.00022 : 0.00007);
    this.stars.alpha = this.animateBackground === false ? 0.5 : 0.5 + Math.sin(this.time / 700) * 0.15;
    this.spotlight.alpha = flying ? 0.95 : (crashed ? 0.4 : 0.65);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.004);
    const sx = (Math.random() - 0.5) * this.shake * 8;
    const sy = (Math.random() - 0.5) * this.shake * 8;
    this.curve.position.set(sx, sy);
    this.fillSprite.position.set(sx, sy);
    this.plane.position.set(sx, sy);

    const showFlight = flying || crashed;
    this.curve.visible = this.fillSprite.visible = showFlight && this.crashAnim < 0.6;
    this.plane.visible = showFlight;
    this.glow.visible = showFlight;

    if (flying) {
      // Crash fades the sprite out; reset that transient state for each flight.
      this.plane.alpha = 1;
      this.nextRoundScreen.visible = false;
      this.spotlight.visible = true;
      this.stars.visible = true;
      this.burst.visible = true;
      this.axis.visible = true;
      this.crashAnim = 0;
      this.frameTimer += dt;
      if (this.frameTimer >= 40) {
        this.frameTimer = 0;
        this.frameIdx = (this.frameIdx + 1) % 4;
        this.plane.texture = this.planeFrames[this.frameIdx];
      }
      const pos = this.planePos(engine.t, phase);
      this.drawCurve(pos);
      this.plane.position.set(pos.x + sx, pos.y + sy);
      const tilt = pos.p < 1 ? -0.32 * (1 - pos.p) : Math.sin(this.time / 420) * 0.04;
      this.plane.rotation = tilt;
      this.glow.position.set(pos.x, pos.y);
      this.glow.alpha = 0.35;
      this.mult.text = `${engine.mult.toFixed(2)}x`;
      this.mult.style.fill = COLORS.text;
      this.mult.scale.set(1 + Math.min(0.12, (engine.mult - 1) * 0.006));
      this.status.text = '';
      this.setWaitVisible(false);
    } else if (crashed) {
      this.nextRoundScreen.visible = false;
      this.spotlight.visible = true;
      this.stars.visible = true;
      this.burst.visible = true;
      this.axis.visible = true;
      // Fly away animation: plane rockets off-screen top-right
      this.crashAnim += dt / 900;
      const k = this.crashAnim;
      const pos = this.planePos(RULES.reachMs, phase);
      this.plane.position.set(pos.x + w * 1.25 * k * k + sx, pos.y - h * 0.45 * k * k + sy);
      this.plane.rotation = -0.15 * k;
      this.plane.alpha = Math.max(0, 1 - k * 1.2);
      this.glow.alpha = Math.max(0, 0.35 - k * 0.5);
      this.mult.text = `${engine.mult.toFixed(2)}x`;
      this.mult.style.fill = COLORS.red;

      const multY = h * L.multY + 22;
      this.mult.position.set(w * 0.58, multY);
      this.status.text = 'FLEW AWAY!';
      this.status.style.fill = COLORS.red;
      this.status.style.fontSize = Math.max(28, L.statusSize * 1.45);
      this.status.position.set(w * 0.58, multY - 68);
      this.status.alpha = Math.min(1, this.crashAnim * 2.5);

      this.setWaitVisible(false);
      if (this.crashAnim > 0.6) { this.curve.clear(); this.fillMask.clear(); }
    } else {
      // NEXT ROUND (BETTING PHASE) - Authentic UFC Official Partners screen
      this.nextRoundScreen.visible = true;
      this.spotlight.visible = false;
      this.stars.visible = false;
      this.burst.visible = false;
      this.axis.visible = false;
      this.plane.visible = false;
      this.curve.clear();
      this.fillMask.clear();
      this.mult.text = '';
      this.status.text = '';
      this.setWaitVisible(true);
      this.drawWait();

    }

    if (!crashed) {
      this.mult.position.set(w * 0.58, h * L.multY);
    }
    this.drawAxis(flying ? engine.t : 0);

    if (this.devHint.visible) {
      const hx = w * L.planeX, hy = h * L.planeY;
      this.devHint.clear();
      this.devHint.moveTo(hx - 18, hy).lineTo(hx + 18, hy).stroke({ width: 1.5, color: 0xffd60a, alpha: 0.9 });
      this.devHint.moveTo(hx, hy - 18).lineTo(hx, hy + 18).stroke({ width: 1.5, color: 0xffd60a, alpha: 0.9 });
      this.devHint.circle(hx, hy, 22).stroke({ width: 1.5, color: 0xffd60a, alpha: 0.5 });
    }
  }

  setWaitVisible(v) {
    this.barBg.visible = this.bar.visible = v;
  }

  drawWait() {
    const { w, h, engine } = this;
    const bw = Math.min(w * 0.34, 300), bh = 6;
    const bx = (w - bw) / 2;
    // Below the UFC/Official lockup image (lockup half-height ~142 * scale)
    const by = h / 2 + 142 * (this.nrScale || 1) + 20;
    panelBg(this.barBg, bw, bh, 3, 0x222327, null);
    this.barBg.position.set(bx, by);
    const p = 1 - engine.bettingProgress;
    this.bar.clear();
    this.bar.roundRect(0, 0, Math.max(2, bw * p), bh, 3).fill(COLORS.red);
    this.bar.position.set(bx, by);
  }

  drawCurve(pos) {
    const { w, h, L } = this;
    const ox = w * L.originX, oy = h * L.originY;
    const cx = ox + (pos.x - ox) * 0.62;
    const cy = oy;

    this.curve.clear();
    // Outer red glow
    this.curve.moveTo(ox, oy).quadraticCurveTo(cx, cy, pos.x, pos.y)
      .stroke({ width: 10, color: COLORS.curveFill, alpha: 0.22 });
    // Core bold red line
    this.curve.moveTo(ox, oy).quadraticCurveTo(cx, cy, pos.x, pos.y)
      .stroke({ width: 4, color: COLORS.curve, alpha: 1 });

    // Under-curve gradient mask
    this.fillMask.clear();
    this.fillMask.moveTo(ox, oy).quadraticCurveTo(cx, cy, pos.x, pos.y)
      .lineTo(pos.x, oy).lineTo(ox, oy).closePath().fill(0xffffff);
  }

  drawAxis(t) {
    const { w, h, L } = this;
    const ox = w * L.originX, oy = h * L.originY;
    this.axis.clear();
    this.axis.moveTo(ox, oy).lineTo(w - 8, oy).stroke({ width: 1.5, color: 0x222428 });
    this.axis.moveTo(ox, oy).lineTo(ox, 10).stroke({ width: 1.5, color: 0x222428 });
    const off = (t / 26) % 60;
    for (let x = ox + 60 - off; x < w - 10; x += 60) {
      this.axis.moveTo(x, oy).lineTo(x, oy + 5).stroke({ width: 1.5, color: 0x2d2f34 });
    }
    for (let y = oy - 50 + ((t / 34) % 50); y > 12; y -= 50) {
      this.axis.moveTo(ox, y).lineTo(ox - 5, y).stroke({ width: 1.5, color: 0x2d2f34 });
    }
  }
}
