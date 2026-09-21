// Single betting panel (can exist as dual bet panels matching Spribe)
import { Container, Graphics } from '../../vendor/pixi.min.mjs';
import { COLORS, RULES, CURRENCY } from '../config.js';
import { PHASE } from '../core/engine.js';
import { SLOT } from '../core/game.js';
import { Button, Tabs, Toggle, txt, panelBg, iconGfx, fmt } from './ui.js';

export class BetPanel extends Container {
  constructor(game, index, keypad, onToggleSecond) {
    super();
    this.game = game;
    this.engine = game.engine;
    this.slot = game.slots[index];
    this.index = index;
    this.keypad = keypad;
    this.onToggleSecond = onToggleSecond;

    this.bg = new Graphics();
    this.addChild(this.bg);

    // Hidden tabs (reference screenshot does not display tabs)
    this.tabs = new Tabs(
      [{ id: 'bet', label: 'Bet' }, { id: 'auto', label: 'Auto' }],
      120, 24, (id) => { this.slot.tab = id; this.refresh(); },
    );
    this.tabs.visible = false;
    this.addChild(this.tabs);

    // Top-right close/minimize button for panel 2
    this.sideBtn = new Container();
    this.sideG = new Graphics();
    this.sideIcon = iconGfx(index === 0 ? 'plus' : 'minus', 8, 0x8e9198);
    this.sideBtn.addChild(this.sideG, this.sideIcon);
    this.sideBtn.eventMode = 'static';
    this.sideBtn.cursor = 'pointer';
    this.sideBtn.on('pointertap', () => onToggleSecond());
    this.addChild(this.sideBtn);

    // Amount row (Stepper)
    this.amtBg = new Graphics();
    this.amtText = txt('1.00', 18, 0xffffff, '800');
    this.amtText.anchor.set(0.5);
    this.amtHit = new Container();
    this.amtHit.eventMode = 'static';
    this.amtHit.cursor = 'pointer';
    this.amtHit.on('pointertap', () => this.openAmountPad());
    this.minusBtn = this.circleBtn('minus', () => this.game.setAmount(this.slot, this.slot.amount - this.step()));
    this.plusBtn = this.circleBtn('plus', () => this.game.setAmount(this.slot, this.slot.amount + this.step()));
    this.addChild(this.amtBg, this.amtText, this.amtHit, this.minusBtn, this.plusBtn);

    // Quick USD preset buttons (1, 2, 5, 10)
    this.quick = RULES.quickBets.map((v) => new Button({
      w: 60, h: 22, r: 11, top: 0x18191d, bottom: 0x141518, border: 0x22242a, borderAlpha: 0.9,
      label: String(v), labelSize: 12, labelColor: 0x787b84,
      onTap: () => this.game.setAmount(this.slot, v),
    }));
    this.quick.forEach((b) => this.addChild(b));

    // Big Main Bet / Cash Out Button
    this.mainBtn = new Button({
      w: 180, h: 74, r: 16, top: 0x28a909, bottom: 0x229608,
      label: 'Bet', labelSize: 22, sub: `1.00 ${CURRENCY}`, subSize: 14,
      onTap: () => this.onMain(),
    });
    this.addChild(this.mainBtn);

    // Enhanced cash out floating win badge
    this.winBadge = new Container();
    this.winBadgeBg = new Graphics();
    this.winBadgeText = txt('', 13, 0xffffff, '800');
    this.winBadgeText.anchor.set(0.5);
    this.winBadge.addChild(this.winBadgeBg, this.winBadgeText);
    this.winBadge.alpha = 0;
    this.addChild(this.winBadge);
    this.winBadgeT = 0;

    this.refresh();
  }

  circleBtn(icon, onTap) {
    const c = new Container();
    const g = new Graphics();
    const ic = iconGfx(icon, 8, 0x82858f);
    c.addChild(g, ic);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', onTap);
    c._g = g; c._ic = ic;
    return c;
  }

  step() {
    const a = this.slot.amount;
    if (a < 1) return 0.1;
    if (a < 10) return 1;
    if (a < 100) return 5;
    return 10;
  }

  openAmountPad() {
    this.keypad.open({
      title: `Bet Amount ($${RULES.minBet.toFixed(2)} ~ $${fmt(RULES.maxBet, 0)})`,
      value: this.slot.amount.toFixed(2),
      min: RULES.minBet,
      max: RULES.maxBet,
      dec: 2,
      onDone: (v) => this.game.setAmount(this.slot, v),
    });
  }

  onMain() {
    const s = this.slot;
    if (s.state === SLOT.ACTIVE) this.game.cashOut(s);
    else if (s.state === SLOT.QUEUED) this.game.cancel(s);
    else this.game.place(s);
  }

  showFlash(text) {
    this.winBadgeText.text = text;
    const bw = Math.max(130, this.winBadgeText.width + 24);
    const bh = 26;
    panelBg(this.winBadgeBg, bw, bh, bh / 2, 0x123405, 0x4eaf11);
    this.winBadgeText.position.set(bw / 2, bh / 2);
    this.winBadgeBg.position.set(0, 0);
    this.winBadge.pivot.set(bw / 2, bh / 2);
    this.winBadge.position.set(this.btnCenterX || this.w / 2, this.flashY);
    this.winBadgeT = 1800;
  }

  refresh() {
    const s = this.slot;
    this.amtText.text = fmt(s.amount);
    this.updateMain();
  }

  updateMain() {
    const s = this.slot;
    const phase = this.engine.phase;
    const b = this.mainBtn;
    if (s.state === SLOT.ACTIVE) {
      b.setTheme(COLORS.orangeLight, COLORS.orange);
      const win = Math.min(s.amount * this.engine.mult, RULES.maxWinPerBet);
      b.setLabel('Cash Out', `${fmt(win)} ${CURRENCY}`);
      b.setEnabled(true);
    } else if (s.state === SLOT.QUEUED) {
      b.setTheme(COLORS.redLight, COLORS.red);
      b.setLabel('Cancel', phase === PHASE.BETTING ? `${fmt(s.amount)} ${CURRENCY}` : 'Waiting for next round');
      b.setEnabled(true);
    } else {
      b.setTheme(0x28a909, 0x229608);
      b.setLabel('Bet', `${fmt(s.amount)} ${CURRENCY}`);
      b.setEnabled(this.game.balance >= s.amount && s.amount >= RULES.minBet);
    }
    const editable = s.state === SLOT.IDLE;
    [this.minusBtn, this.plusBtn, this.amtHit].forEach((c) => {
      c.eventMode = editable ? 'static' : 'none';
      c.alpha = editable ? 1 : 0.5;
    });
    this.quick.forEach((q) => q.setEnabled(editable));
    this.amtText.alpha = editable ? 1 : 0.5;
  }

  update(dt) {
    if (this.slot.state === SLOT.ACTIVE) this.updateMain();
    if (this.winBadgeT > 0) {
      this.winBadgeT -= dt;
      const progress = 1 - this.winBadgeT / 1800;
      this.winBadge.alpha = Math.min(1, this.winBadgeT / 400);
      this.winBadge.y = this.flashY - Math.sin(Math.min(1, progress * 1.5) * Math.PI / 2) * 20;
      const s = progress < 0.18 ? 0.8 + (progress / 0.18) * 0.25 : Math.max(1, 1.05 - (progress - 0.18) * 0.08);
      this.winBadge.scale.set(s);
      if (this.winBadgeT <= 0) this.winBadge.alpha = 0;
    }
  }

  resize(w, h, L, mobile) {
    this.w = w;
    this.h = h;

    // Panel background: deep charcoal with rounded corners
    panelBg(this.bg, w, h, 16, 0x141518, 0x1e2025);

    // Top-right button handling:
    // Panel 1: hidden when dual panels are open (matching screenshot)
    // Panel 2: shows small minus close button at top right
    const showSecond = this.game.showSecond;
    if (this.index === 0) {
      this.sideBtn.visible = !showSecond;
    } else {
      this.sideBtn.visible = true;
    }

    if (this.sideBtn.visible) {
      const sbW = 20, sbH = 20;
      this.sideG.clear();
      this.sideG.roundRect(-sbW / 2, -sbH / 2, sbW, sbH, 6)
        .fill({ color: 0x1f2126 })
        .stroke({ width: 1, color: 0x33363f });
      this.sideBtn.position.set(w - 20, 16);
      this.sideBtn.hitArea = { contains: (x, y) => Math.abs(x) <= sbW && Math.abs(y) <= sbH };
    }

    // Proportional dimensions matching screenshot
    const padX = 14;
    const amtH = L.amountH || 34;
    const qh = L.quickH || 22;
    const totalLeftH = amtH + 6 + qh + 5 + qh; // ~89px
    const startY = (h - totalLeftH) / 2;

    const leftW = Math.min(164, Math.max(136, (w - padX * 2 - 12) * 0.44));

    // Amount row (stepper pill)
    panelBg(this.amtBg, leftW, amtH, amtH / 2, 0x0f1013, 0x1c1d22);
    this.amtBg.position.set(padX, startY);
    this.amtText.position.set(padX + leftW / 2, startY + amtH / 2);

    this.amtHit.position.set(padX + leftW * 0.25, startY);
    this.amtHit.hitArea = { contains: (x, y) => x >= 0 && x <= leftW * 0.5 && y >= 0 && y <= amtH };

    const cr = amtH * 0.35;
    this.minusBtn._g.clear();
    this.minusBtn._g.circle(0, 0, cr).fill(0x1e2025);
    this.plusBtn._g.clear();
    this.plusBtn._g.circle(0, 0, cr).fill(0x1e2025);

    this.minusBtn.position.set(padX + cr + 4, startY + amtH / 2);
    this.plusBtn.position.set(padX + leftW - cr - 4, startY + amtH / 2);

    const hit = (r) => ({ contains: (x, y) => x * x + y * y <= (r + 4) ** 2 });
    this.minusBtn.hitArea = hit(cr);
    this.plusBtn.hitArea = hit(cr);

    // Quick USD preset buttons 2x2 grid
    const qw = (leftW - 6) / 2;
    this.quick.forEach((b, i) => {
      b.setSize2(qw, qh);
      const col = i % 2;
      const row = (i / 2) | 0;
      b.position.set(padX + col * (qw + 6), startY + amtH + 6 + row * (qh + 5));
    });

    // Big Main Bet / Cash Out Button
    const btnX = padX + leftW + 12;
    const btnW = w - btnX - padX;
    const btnH = totalLeftH;

    this.mainBtn.setSize2(btnW, btnH);
    this.mainBtn.setFontSize(mobile ? 18 : 22, mobile ? 12 : 14);
    this.mainBtn.position.set(btnX, startY);

    this.btnCenterX = btnX + btnW / 2;
    this.flashY = startY - 14;
    this.winBadge.position.set(this.btnCenterX, this.flashY);
    this.refresh();
  }
}
