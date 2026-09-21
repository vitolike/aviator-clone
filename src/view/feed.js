import { Container, Graphics, Sprite, Texture, Rectangle, Assets } from '../../vendor/pixi.min.mjs';
import { COLORS, multColor, CURRENCY } from '../config.js';
import { playerAvatar } from './textures.js';
import { ScrollBox, txt, panelBg, fmt } from './ui.js';

const avatarCache = new Map();
function getAvatarTexture(id) {
  const num = (Math.abs(id - 1) % 72) + 1;
  const path = `assets/images/avatars/av-${num}.png`;
  if (!avatarCache.has(num)) {
    const tex = Assets.get(path) || Texture.from(path);
    avatarCache.set(num, tex);
  }
  return avatarCache.get(num);
}

class Row extends Container {
  constructor() {
    super();
    this.bg = new Graphics();
    this.avatar = new Sprite();
    this.avatar.anchor.set(0.5);
    this.avatarRing = new Graphics();

    this.name = txt('', 14, 0xd2d6dc, '500');
    this.name.anchor.set(0, 0.5);

    this.amount = txt('', 14, 0xc5c9cf, '400');
    this.amount.anchor.set(1, 0.5);

    this.mult = txt('', 14, 0x34b4ff, '700');
    this.mult.anchor.set(0.5, 0.5);

    this.win = txt('', 14, 0xc5c9cf, '500');
    this.win.anchor.set(1, 0.5);

    this.flashG = new Graphics();

    this.addChild(this.bg, this.avatar, this.avatarRing, this.name, this.amount, this.mult, this.win, this.flashG);
  }
}

export class Feed extends Container {
  constructor(game, bots, mobile) {
    super();
    this.game = game;
    this.engine = game.engine;
    this.bots = bots;
    this.tab = 'all';

    // Animation states
    this.targetProgress = 0;
    this.currentProgress = 0;
    this.targetTotalWin = 0;
    this.displayedTotalWin = 0;

    // Card background
    this.bg = new Graphics();
    this.addChild(this.bg);

    // Top Navigation Tabs (Pill style matching authentic Aviator)
    this.tabsContainer = new Container();
    this.tabsBg = new Graphics();
    this.tabsContainer.addChild(this.tabsBg);
    this.tabItems = [
      { id: 'all', label: 'All Bets' },
      { id: 'mine', label: 'Previous' },
      { id: 'top', label: 'Top' },
    ];
    this.tabBtns = [];
    this.tabItems.forEach((it) => {
      const btn = new Container();
      const bg = new Graphics();
      const label = txt(it.label, 14, 0xaeb3bc, '400');
      label.anchor.set(0.5);
      btn.addChild(bg, label);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.on('pointertap', () => {
        if (this.tab !== it.id) {
          this.tab = it.id;
          this.scroll.content.y = 0;
          this.updateTabs();
          this.render();
        }
      });
      btn._bg = bg;
      btn._label = label;
      btn._id = it.id;
      this.tabBtns.push(btn);
      this.tabsContainer.addChild(btn);
    });
    this.addChild(this.tabsContainer);

    // Sub-header stats container
    this.subStrip = new Container();

    // 3 Overlapping circular avatars
    this.subAvatars = new Container();
    const avatarConfigs = [
      { id: 16, border: 0x28a909, x: 15 },
      { id: 2, border: 0xe21c3d, x: 30 },
      { id: 5, border: 0x34c60c, x: 45 }
    ];
    this.subAvSprites = avatarConfigs.map((cfg) => {
      const c = new Container();
      const sp = new Sprite(getAvatarTexture(cfg.id));
      sp.anchor.set(0.5);
      sp.scale.set(30 / 120);
      const ring = new Graphics();
      ring.circle(0, 0, 15).stroke({ width: 1.5, color: cfg.border });
      c.addChild(sp, ring);
      c.position.set(cfg.x, 16);
      this.subAvatars.addChild(c);
      return c;
    });
    this.subStrip.addChild(this.subAvatars);

    // Left stats: 87/132 Bets & Progress bar
    this.betsCountNum = txt('0/0', 16, 0xffffff, '500');
    this.betsCountNum.anchor.set(0, 0.5);
    this.betsCountLabel = txt(' Bets', 14, 0x8e9299, '400');
    this.betsCountLabel.anchor.set(0, 0.5);
    this.subStrip.addChild(this.betsCountNum, this.betsCountLabel);

    // Horizontal Progress bar
    this.progressBar = new Graphics();
    this.subStrip.addChild(this.progressBar);

    // Right stats: Large Total Win USD
    this.totalWinVal = txt('0.00', 22, 0xdce1e7, '700');
    this.totalWinVal.anchor.set(1, 0.5);
    this.totalWinLabel = txt(`Total win ${CURRENCY}`, 14, 0x8e9299, '400');
    this.totalWinLabel.anchor.set(1, 0.5);
    this.subStrip.addChild(this.totalWinVal, this.totalWinLabel);

    this.addChild(this.subStrip);

    // Round Result card (Previous tab header, like the official client)
    this.roundCard = new Container();
    this.roundBg = new Graphics();
    this.roundLabel = txt('Round Result', 13, 0x8e9299, '400');
    this.roundLabel.anchor.set(0.5, 0);
    this.roundValue = txt('—', 26, 0xab57ff, '800');
    this.roundValue.anchor.set(0.5, 0);
    this.roundCard.addChild(this.roundBg, this.roundLabel, this.roundValue);
    this.roundCard.visible = false;
    this.addChild(this.roundCard);

    // Empty-state message
    this.emptyText = txt('No bets yet', 14, 0x8e9299, '500');
    this.emptyText.anchor.set(0.5);
    this.emptyText.visible = false;
    this.addChild(this.emptyText);

    // Table Header (Player | Bet USD | X | Win USD)
    this.head = new Container();
    this.h1 = txt('Player', 13, 0x888d95, '400');
    this.h2 = txt(`Bet ${CURRENCY}`, 13, 0x888d95, '400');
    this.h3 = txt('X', 13, 0x888d95, '400');
    this.h4 = txt(`Win ${CURRENCY}`, 13, 0x888d95, '400');
    this.h2.anchor.set(1, 0.5);
    this.h3.anchor.set(0.5, 0.5);
    this.h4.anchor.set(1, 0.5);
    this.h1.anchor.set(0, 0.5);
    this.head.addChild(this.h1, this.h2, this.h3, this.h4);
    this.addChild(this.head);

    // Scrollable rows
    this.scroll = new ScrollBox(280, 300);
    this.addChild(this.scroll);
    this.pool = [];
    this.rowH = 32;
    this.data = [];

    // Footer: Provably Fair Game & Powered by SPRIBE
    this.footer = new Container();
    this.footerLine = new Graphics();
    this.fairShield = new Graphics();
    this.fairText = txt('Provably Fair Game', 12, 0xc2c6cc, '400');
    this.fairText.anchor.set(0, 0.5);

    this.spribeContainer = new Container();
    this.spribePre = txt('Powered by ', 12, 0x676b72, '400');
    this.spribePre.anchor.set(1, 0.5);
    this.spribeLogo = Sprite.from('assets/images/spribe.png');
    this.spribeLogo.anchor.set(1, 0.5);
    this.spribeContainer.addChild(this.spribePre, this.spribeLogo);

    this.footer.addChild(this.footerLine, this.fairShield, this.fairText, this.spribeContainer);
    this.addChild(this.footer);

    this.drawFairShield();
  }

  drawFairShield() {
    const g = this.fairShield;
    g.clear();
    const x = 5, y = 0;
    // Shield polygon
    g.moveTo(x - 5, y - 5.5)
      .lineTo(x + 5, y - 5.5)
      .lineTo(x + 5, y)
      .quadraticCurveTo(x + 4, y + 6, x, y + 7.5)
      .quadraticCurveTo(x - 4, y + 6, x - 5, y)
      .closePath()
      .fill({ color: 0x36383e, alpha: 0.9 })
      .stroke({ width: 1, color: 0x50535c });

    // Green checkmark
    g.moveTo(x - 2.5, y - 0.2)
      .lineTo(x - 0.5, y + 2.2)
      .lineTo(x + 3, y - 2.2)
      .stroke({ width: 1.4, color: 0x28a909 });
  }

  setRowCount(n) {
    while (this.pool.length < n) {
      const r = new Row();
      this.pool.push(r);
      this.scroll.content.addChild(r);
    }
    this.pool.forEach((r, i) => { r.visible = i < n; });
  }

  collect() {
    if (this.tab === 'all') return this.bots.list;
    if (this.tab === 'mine') {
      return this.game.myBets.map((b) => ({
        name: b.nonce != null ? `#${b.nonce}` : new Date(b.t).toLocaleTimeString('en-US', { hour12: false }),
        color: 0xffd60a,
        avatarId: 99,
        amount: b.amount,
        m: b.m,
        win: b.win,
        cashed: b.win > 0,
        lost: b.win === 0,
        mine: true,
      }));
    }
    return [...this.engine.history]
      .map((h, i) => ({
        name: `#${h.nonce ?? i}`,
        color: multColor(h.m),
        avatarId: (i % 72) + 1,
        amount: 0,
        m: h.m,
        win: 0,
        cashed: true,
        top: true,
      }))
      .sort((a, b) => b.m - a.m);
  }

  updateTabs() {
    const tw = this.innerW || 280;
    const tabW = tw / this.tabItems.length;
    const h = 42;
    this.tabsBg.clear();
    this.tabsBg.roundRect(0, 0, tw, h, h / 2).fill(0x141516);
    this.tabBtns.forEach((btn, i) => {
      const active = this.tab === btn._id;
      btn.position.set(tabW * i, 0);
      btn.hitArea = new Rectangle(0, 0, tabW, h);
      btn._bg.clear();
      if (active) {
        btn._bg.roundRect(4, 6, tabW - 8, 30, 15).fill({ color: 0x2b2d32 });
      }
      btn._label.style.fill = active ? 0xffffff : 0x8c8f96;
      btn._label.position.set(tabW / 2, h / 2);
    });
  }

  render() {
    this.data = this.collect();
    this.scroll.contentHeight = this.data.length * this.rowH;
    const visible = Math.min(this.data.length, Math.ceil(this.scroll.h / this.rowH) + 2);
    this.setRowCount(visible);
    const first = Math.max(0, Math.floor(-this.scroll.content.y / this.rowH));
    const w = this.scroll.w;
    const now = Date.now();

    for (let i = 0; i < visible; i++) {
      const idx = first + i;
      const r = this.pool[i];
      const d = this.data[idx];
      if (!d) { r.visible = false; continue; }
      r.visible = true;
      r.y = idx * this.rowH;

      const rowH = this.rowH - 5;
      const pillRadius = rowH / 2;
      const isCashed = d.cashed && !d.top;

      // Capsule Background (Previous-tab rows stay dark like the reference)
      r.bg.clear();
      if (isCashed && !d.mine) {
        // Dark olive green translucent pill with clean green outline
        const bgCol = d.mine ? 0x183815 : 0x142410;
        const lineCol = d.mine ? 0x3db82a : 0x28551c;
        r.bg.roundRect(0, 0, w, rowH, pillRadius)
          .fill({ color: bgCol })
          .stroke({ width: 1, color: lineCol });
      } else {
        // Dark charcoal uncashed pill
        const bgCol = d.mine ? 0x242013 : 0x121316;
        const lineCol = d.mine ? 0x5a4816 : null;
        r.bg.roundRect(0, 0, w, rowH, pillRadius).fill({ color: bgCol });
        if (lineCol) r.bg.stroke({ width: 1, color: lineCol });
      }

      // Circular Avatar
      r.avatar.texture = d.mine ? playerAvatar(99, 0xffd60a) : getAvatarTexture(d.avatarId ?? idx);
      r.avatar.position.set(16, rowH / 2);
      r.avatar.width = 32;
      r.avatar.height = 32;

      // Colored Avatar Ring Border
      r.avatarRing.clear();
      r.avatarRing.circle(16, rowH / 2, 16.5).stroke({ width: 1.2, color: d.color || 0x28a909 });

      // Player Name (e.g. d***3)
      r.name.text = d.name;
      r.name.style.fill = 0xe4e6eb;
      r.name.position.set(41, rowH / 2);

      // Bet Amount USD (e.g. 100.00)
      r.amount.text = d.amount ? fmt(d.amount) : (d.mine ? '0.00' : '—');
      r.amount.style.fill = d.lost ? 0x6e717a : 0xffffff;
      r.amount.position.set(w * 0.475, rowH / 2);

      // Multiplier (X) and Win USD (own previous bets always show values)
      r.flashG.clear();
      if ((isCashed || d.mine) && d.m) {
        r.mult.text = `${d.m.toFixed(2)}x`;

        // Color scheme matching Aviator screenshot: <2x cyan, 2x-10x purple, >=10x pink
        if (d.m < 2) {
          r.mult.style.fill = 0x34b4ff; // Cyan
        } else if (d.m < 10) {
          r.mult.style.fill = 0xab57ff; // Vibrant purple
        } else {
          r.mult.style.fill = 0xc017b4; // Pink / Magenta
        }

        r.win.text = d.win ? fmt(d.win) : '0.00';
        r.win.style.fill = 0xffffff;

        // Functional Cashout Flash & Scale Pop Animation
        if (d.cashedAt && (now - d.cashedAt < 600)) {
          const anim = 1 - (now - d.cashedAt) / 600;
          r.flashG.roundRect(0, 0, w, rowH, pillRadius).fill({ color: 0x28a909, alpha: anim * 0.42 });
          const pop = 1 + anim * 0.22;
          r.mult.scale.set(pop);
          r.win.scale.set(pop);
        } else {
          r.mult.scale.set(1);
          r.win.scale.set(1);
        }
      } else if (d.mine) {
        // Lost own bet: no multiplier, but keep the 0.00 win like the reference
        r.mult.text = '';
        r.win.text = fmt(d.win || 0);
        r.win.style.fill = 0xffffff;
        r.mult.scale.set(1);
        r.win.scale.set(1);
      } else if (d.top) {
        r.mult.text = `${d.m.toFixed(2)}x`;
        r.mult.style.fill = multColor(d.m);
        r.win.text = '';
        r.mult.scale.set(1);
        r.win.scale.set(1);
      } else {
        // Uncashed: both X and Win USD columns are completely blank, matching screenshot!
        r.mult.text = '';
        r.win.text = '';
        r.mult.scale.set(1);
        r.win.scale.set(1);
      }

      r.mult.position.set(w * 0.72, rowH / 2);
      r.win.position.set(w - 10, rowH / 2);
    }

    // Update Sub-Header Stats
    const st = this.bots.stats;
    this.roundCard.visible = this.tab === 'mine';
    if (this.tab === 'mine') {
      // Round Result header: last completed round multiplier
      const last = this.engine.history[0];
      if (last) {
        this.roundValue.text = `${last.m.toFixed(2)}x`;
        this.roundValue.style.fill = multColor(last.m);
      } else {
        this.roundValue.text = '—';
        this.roundValue.style.fill = 0x8e9299;
      }
    }
    if (this.tab === 'all') {
      this.betsCountNum.text = `${st.cashed}/${st.total}`;
      this.betsCountLabel.text = ' Bets';
      this.betsCountLabel.position.set(this.betsCountNum.x + this.betsCountNum.width, this.betsCountNum.y);

      this.targetProgress = st.total > 0 ? (st.cashed / st.total) : 0;
      this.targetTotalWin = st.totalWin;

      this.subAvatars.visible = true;
      this.betsCountNum.visible = true;
      this.betsCountLabel.visible = true;
      this.progressBar.visible = true;
      this.totalWinVal.visible = true;
      this.totalWinLabel.visible = true;
    } else if (this.tab === 'mine') {
      this.targetProgress = 0;
      this.currentProgress = 0;
      this.targetTotalWin = 0;

      this.subAvatars.visible = false;
      this.betsCountNum.visible = false;
      this.betsCountLabel.visible = false;
      this.progressBar.visible = false;
      this.totalWinVal.visible = false;
      this.totalWinLabel.visible = false;
    } else {
      this.betsCountNum.text = `Top Multipliers`;
      this.betsCountLabel.text = '';

      this.targetProgress = 0;
      this.currentProgress = 0;
      this.targetTotalWin = 0;

      this.subAvatars.visible = false;
      this.betsCountNum.visible = true;
      this.betsCountLabel.visible = false;
      this.progressBar.visible = false;
      this.totalWinVal.visible = false;
      this.totalWinLabel.visible = false;
    }

    this.drawProgressBar();
    this.emptyText.visible = this.data.length === 0;
    if (this.data.length === 0) {
      this.emptyText.text = this.tab === 'mine' ? 'No previous bets yet' : (this.tab === 'top' ? 'No rounds yet' : 'No bets yet');
    }
  }

  drawProgressBar() {
    if (!this.progressBar.visible) return;
    const g = this.progressBar;
    g.clear();
    const barW = this.cardW - 40;
    const barH = 8;
    const r = 4;
    // Dark track
    g.roundRect(0, 0, barW, barH, r).fill({ color: 0x101112 });
    // Animated green fill
    const fillW = Math.max(0, Math.min(barW, barW * this.currentProgress));
    if (fillW > 0) {
      g.roundRect(0, 0, fillW, barH, r).fill({ color: 0x28a909 });
    }
  }

  update(dt = 16) {
    this.scroll.update();
    const y = this.scroll.content.y;
    if (y !== this._lastY) {
      this._lastY = y;
      this.render();
    }

    // Smooth Progress Bar Animation
    if (Math.abs(this.currentProgress - this.targetProgress) > 0.002) {
      this.currentProgress += (this.targetProgress - this.currentProgress) * 0.12;
      this.drawProgressBar();
    }

    // Smooth Total Win Counter Animation
    if (Math.abs(this.displayedTotalWin - this.targetTotalWin) > 0.05) {
      this.displayedTotalWin += (this.targetTotalWin - this.displayedTotalWin) * 0.14;
      this.totalWinVal.text = fmt(this.displayedTotalWin);
    } else if (this.displayedTotalWin !== this.targetTotalWin) {
      this.displayedTotalWin = this.targetTotalWin;
      this.totalWinVal.text = fmt(this.displayedTotalWin);
    }

    // Check if any visible row is currently playing cashout flash animation
    if (this.tab === 'all') {
      const now = Date.now();
      let hasActiveAnim = false;
      const visible = Math.min(this.data.length, Math.ceil(this.scroll.h / this.rowH) + 2);
      const first = Math.max(0, Math.floor(-this.scroll.content.y / this.rowH));
      for (let i = 0; i < visible; i++) {
        const d = this.data[first + i];
        if (d && d.cashedAt && (now - d.cashedAt < 600)) {
          hasActiveAnim = true;
          break;
        }
      }
      if (hasActiveAnim) {
        this.render();
      }
    }
  }

  resize(w, h, L) {
    this.cardW = w;
    this.cardH = h;
    const pad = 8;
    const tw = w - pad * 2;
    this.innerW = tw;

    // Card background with rounded corners matching screenshot
    panelBg(this.bg, w, h, 20, 0x1b1c1d, null);

    // Tabs under top padding
    this.tabsContainer.position.set(pad, pad);
    this.updateTabs();

    // Sub-strip under tabs
    const sy = 68;
    this.subStrip.position.set(pad, sy);

    // Align 3 circular avatars
    this.subAvatars.position.set(0, 0);

    // Bets count right under avatars
    this.betsCountNum.position.set(8, 41);
    this.betsCountLabel.position.set(8 + this.betsCountNum.width, 41);

    // Progress bar right under bets count
    this.progressBar.position.set(8, 55);

    // Total win right aligned
    this.totalWinVal.position.set(tw - 4, 14);
    this.totalWinLabel.position.set(tw - 4, 41);

    this.rowH = L.feedRowH || 32;

    // Table Header (Player | Bet USD | X | Win USD)
    const hy = 139;
    this.head.position.set(pad, hy);
    this.h1.position.set(7, 20);
    this.h2.position.set(tw * 0.475, 20);
    this.h3.position.set(tw * 0.72, 20);
    this.h4.position.set(tw - 10, 20);

    // Round Result card fills the sub-strip area on the Previous tab
    const cardH = hy - sy - 8;
    this.roundCard.position.set(pad, sy);
    panelBg(this.roundBg, tw, cardH, 12, 0x101114, null);
    this.roundLabel.position.set(tw / 2, 6);
    this.roundValue.position.set(tw / 2, 22);

    // Footer at bottom
    const footerH = 42;
    const fy = h - footerH;
    this.footer.position.set(pad, fy);
    this.footerLine.clear();
    this.footerLine.rect(6, 0, tw - 12, 1).fill(0x101112);
    this.fairShield.position.set(14, footerH / 2 + 1);
    this.fairText.position.set(28, footerH / 2 + 1);

    this.spribeContainer.position.set(tw - 12, footerH / 2 + 1);
    this.spribeLogo.width = 44;
    this.spribeLogo.height = 15;
    this.spribeLogo.position.set(0, 0);
    this.spribePre.position.set(-this.spribeLogo.width - 5, 0);

    // Scroll box in-between
    const scrollY = hy + 40;
    const scrollH = fy - scrollY - 4;
    this.scroll.position.set(pad, scrollY);
    this.scroll.resize(tw, scrollH);
    this.emptyText.position.set(pad + tw / 2, scrollY + Math.max(40, scrollH / 2));
    this.pool.forEach((r) => { r.visible = false; });
    this.render();
  }
}
