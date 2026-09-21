import { Container, Graphics, Rectangle, Sprite } from '../../vendor/pixi.min.mjs';
import { COLORS, multColor, CURRENCY } from '../config.js';
import { txt, panelBg, iconGfx, fmt } from './ui.js';

export class TopBar extends Container {
  constructor(game, onMenu, onHelp) {
    super();
    this.game = game;
    this.onHelp = onHelp;
    this.bg = new Graphics();
    this.addChild(this.bg);

    // Authentic Spribe Aviator Logo Sprite
    this.logo = new Container();
    this.logoSprite = Sprite.from('assets/images/spribe_aviator_logo.png');
    this.logo.addChild(this.logoSprite);
    this.logo.eventMode = 'static';
    this.logo.cursor = 'pointer';
    this.logo.on('pointertap', onHelp);
    this.addChild(this.logo);

    // Balance Widget (Green Cash Icon + 30,000.00 USD)
    this.balBg = new Graphics();
    this.balIcon = new Graphics();
    this.balText = txt('30,000.00 USD', 15, COLORS.green, '800');
    this.balText.anchor.set(1, 0.5);
    this.addChild(this.balBg, this.balIcon, this.balText);

    // Three-dot menu button (...)
    this.menuBtn = new Container();
    const mg = new Graphics();
    const md1 = new Graphics().circle(0, 0, 1.8).fill(0xffffff);
    const md2 = new Graphics().circle(-5, 0, 1.8).fill(0xffffff);
    const md3 = new Graphics().circle(5, 0, 1.8).fill(0xffffff);
    this.menuBtn.addChild(mg, md1, md2, md3);
    this.menuBtn.eventMode = 'static';
    this.menuBtn.cursor = 'pointer';
    this.menuBtn.on('pointertap', onMenu);
    this.menuBtn._g = mg;
    this.addChild(this.menuBtn);
  }

  drawWalletIcon(x, y) {
    const g = this.balIcon;
    g.clear();
    // Two small overlapping banknotes/cards in green
    g.roundRect(x - 14, y - 6, 13, 10, 2).fill({ color: COLORS.green, alpha: 0.9 });
    g.roundRect(x - 11, y - 8, 13, 10, 2).stroke({ width: 1.2, color: COLORS.greenLight });
    g.circle(x - 4.5, y - 3, 1.6).fill(0x101112);
  }

  refresh() {
    this.balText.text = `${fmt(this.game.balance)} ${CURRENCY}`;
  }

  resize(w, h, mobile) {
    panelBg(this.bg, w, h, 0, 0x000000, null);
    const logoH = mobile ? 20 : 25;
    this.logoSprite.scale.set(logoH / 112);
    this.logo.position.set(14, (h - logoH) / 2);

    this.refresh();
    const tw = this.balText.width;
    const bw = Math.max(mobile ? 130 : 160, tw + 46);
    const bx = w - bw - 44;
    panelBg(this.balBg, bw, h - 14, (h - 14) / 2, 0x101112, 0x2c2d30);
    this.balBg.position.set(bx, 7);
    this.drawWalletIcon(bx + 22, h / 2);
    this.balText.position.set(bx + bw - 12, h / 2);

    this.menuBtn._g.clear();
    this.menuBtn._g.circle(0, 0, 14).fill(0x2a2b2e);
    this.menuBtn.position.set(w - 22, h / 2);
    this.menuBtn.hitArea = { contains: (x, y) => x * x + y * y <= 18 * 18 };
  }
}

export class HistoryBar extends Container {
  constructor(engine, onRound) {
    super();
    this.engine = engine;
    this.onRound = onRound;
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.wrap = new Container();
    this.maskG = new Graphics();
    this.wrap.mask = this.maskG;
    this.addChild(this.wrap, this.maskG);
    this.pills = [];
    this.expanded = false;

    this.moreBtn = new Container();
    this.moreG = new Graphics();
    this.moreIcon = txt('•••', 9, COLORS.textDim, '800');
    this.moreIcon.anchor.set(0.5);
    this.moreBtn.addChild(this.moreG, this.moreIcon);
    this.moreBtn.eventMode = 'static';
    this.moreBtn.cursor = 'pointer';
    this.moreBtn.on('pointertap', () => { this.expanded = !this.expanded; this.layout(); });
    this.addChild(this.moreBtn);
  }

  pill(round) {
    const c = new Container();
    const m = round.m;
    const t = txt(`${m.toFixed(2)}x`, 14, multColor(m), '500');
    t.anchor.set(0.5);
    const w = t.width + 18, h = 22;
    t.position.set(w / 2, h / 2);
    c.addChild(t);
    c._w = w;
    c.hitArea = new Rectangle(0, 0, w, h);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', () => this.onRound?.(round));
    return c;
  }

  refresh() {
    this.wrap.removeChildren();
    this.pills = this.engine.history.map((h) => this.pill(h));
    this.pills.forEach((p) => this.wrap.addChild(p));
    this.layout();
  }

  layout() {
    const w = this.w || 600, h = this.h || 40;
    const rows = this.expanded ? 4 : 1;
    const boxH = this.expanded ? h * 4 : h;
    panelBg(this.bg, w, boxH, 0, 0x0d0d0e, null);
    this.maskG.clear();
    this.maskG.rect(0, 0, w - 34, boxH).fill(0xffffff);
    let x = 7, y = (h - 22) / 2, row = 0;
    for (const p of this.pills) {
      if (x + p._w > w - 40) {
        row += 1;
        if (row >= rows) { p.visible = false; continue; }
        x = 7; y += 24;
      }
      p.visible = true;
      p.position.set(x, y);
      x += p._w;
    }
    this.moreG.clear();
    this.moreG.roundRect(-15, -11, 30, 22, 11).fill(0x2a2b2e);
    this.moreBtn.position.set(w - 18, h / 2);
    this.moreBtn.hitArea = { contains: (px, py) => px * px + py * py <= 16 * 16 };
    this.moreIcon.text = this.expanded ? '×' : '•••';
    this.boxH = boxH;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.refresh();
  }
}
