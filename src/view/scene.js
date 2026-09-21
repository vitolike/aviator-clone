import { Container, Graphics } from '../../vendor/pixi.min.mjs';
import { COLORS, RULES, CURRENCY, pickLayout, LAYOUT_PC, LAYOUT_MOBILE } from '../config.js';
import { PHASE } from '../core/engine.js';
import { SLOT } from '../core/game.js';
import { TopBar, HistoryBar } from './chrome.js';
import { FlightView } from './flight.js';
import { Feed } from './feed.js';
import { BetPanel } from './betpanel.js';
import { Keypad } from './keypad.js';
import { Modal } from './modals.js';
import { DevTools } from '../dev/devtools.js';
import { txt, panelBg, fmt } from './ui.js';

export class Scene extends Container {
  constructor(app, engine, game, bots, sfx, planeTexture) {
    super();
    this.app = app;
    this.engine = engine;
    this.game = game;
    this.bots = bots;
    this.sfx = sfx;
    this.settings = { bgAnim: true };

    const { mobile, L } = pickLayout(app.screen.width, app.screen.height);
    this.mobile = mobile;
    this.L = L;
    this.forcedMode = null;

    this.topbar = new TopBar(game, () => this.openMenu(), () => this.modal.open('help', this.ctx()));
    this.history = new HistoryBar(engine, (round) => this.modal.open('round', { ...this.ctx(), round }));
    this.flight = new FlightView(engine, bots, L, planeTexture);
    this.feed = new Feed(game, bots, mobile);
    this.keypad = new Keypad();
    this.modal = new Modal(app);

    this.panels = [0, 1].map((i) => new BetPanel(game, i, this.keypad, () => this.toggleSecond()));

    // Cash out toast notification
    this.toast = new Container();
    this.toastBg = new Graphics();
    this.toastText = txt('', 14, COLORS.text, '800');
    this.toastText.anchor.set(0.5);
    this.toast.addChild(this.toastBg, this.toastText);
    this.toast.visible = false;
    this.toastT = 0;

    this.addChild(this.flight, this.feed, this.history, this.topbar);
    this.panels.forEach((p) => this.addChild(p));
    this.addChild(this.toast, this.keypad, this.modal);

    this.dev = new DevTools(this);
    this.addChild(this.dev);

    this.bindEvents();
    this.relayout();
    this.history.refresh();
  }

  ctx() {
    return { engine: this.engine, game: this.game, sfx: this.sfx, settings: this.settings, scene: this };
  }

  openMenu() { this.sfx.click(); this.modal.open('menu', this.ctx()); }

  bindEvents() {
    const { engine, game, bots, sfx } = this;

    engine.on('history_synced', () => {
      this.history.refresh();
      this.relayoutHistory();
    });

    engine.on('phase', (p) => {
      if (p === PHASE.FLYING) {
        bots.newRound();
        game.slots.forEach((s) => { if (s.state === SLOT.ACTIVE) bots.addMine(s.amount, s.index); });
        sfx.startEngine();
        this.flight.shake = 0.6;
        this.panels.forEach((pn) => pn.refresh());
      } else if (p === PHASE.CRASHED) {
        bots.crash();
        sfx.stopEngine();
        sfx.crash();
        this.flight.shake = 1;
        this.history.refresh();
        this.relayoutHistory();
        this.panels.forEach((pn) => pn.refresh());
      } else if (p === PHASE.BETTING) {
        sfx.gameStart();
        this.panels.forEach((pn) => pn.refresh());
      }
      this.feed.render();
    });

    engine.on('tick', (m) => {
      if (bots.update(m)) this.feed.render();
    });

    game.on('change', () => {
      this.topbar.refresh();
      this.panels.forEach((p) => p.refresh());
    });

    game.on('placed', () => sfx.bet());

    game.on('cashed', ({ slot, m, win }) => {
      sfx.cashOut();
      bots.cashMine(slot.index, m, win);
      this.panels[slot.index].showFlash(`+${fmt(win)}`);
      this.showToast(`Cashed out at ${m.toFixed(2)}x Won ${fmt(win)} ${CURRENCY}`);
      this.feed.render();
    });

    // Mouse wheel scroll handling
    this.app.canvas.addEventListener('wheel', (e) => {
      const x = e.offsetX, y = e.offsetY;
      const target = this.modal.visible ? this.modal.scroll : (this.dev.visible && x > this.dev.x ? this.dev.scroll : this.feed.scroll);
      const gp = target.getGlobalPosition();
      if (x >= gp.x && x <= gp.x + target.w && y >= gp.y && y <= gp.y + target.h) {
        target.onWheel(e.deltaY);
        e.preventDefault();
      }
    }, { passive: false });

    // Align with official rules: Auto cash out at current multiplier if tab loses visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) game.slots.forEach((s) => { if (s.state === SLOT.ACTIVE) game.cashOut(s); });
    });

    // Keyboard shortcuts: 'D' for devtools, Space to bet / cash out
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') { this.dev.toggle(); this.dev.resize(this.w, this.h); }
      if (e.code === 'Space') { e.preventDefault(); this.panels[0].onMain(); }
    });
  }

  showToast(text) {
    this.toastText.text = text;
    const w = this.toastText.width + 28;
    panelBg(this.toastBg, w, 34, 17, 0x1a5c1a, COLORS.green);
    this.toastText.position.set(w / 2, 17);
    this.toast.position.set(this.flightRect.x + (this.flightRect.w - w) / 2, this.flightRect.y + this.flightRect.h - 48);
    this.toast.visible = true;
    this.toastT = 2600;
  }

  toggleSecond() {
    this.sfx.click();
    const g = this.game;
    if (g.showSecond) {
      const s = g.slots[1];
      if (s.state === SLOT.QUEUED) g.cancel(s);
      if (s.state === SLOT.ACTIVE) return; // Cannot remove active in-flight bet
      g.showSecond = false;
    } else {
      g.showSecond = true;
    }
    g.save();
    this.relayout();
  }

  toggleDevDrag() { this.setDevDrag(!this._devDrag); }

  setDevDrag(on) {
    this._devDrag = on;
    this.flight.enableDevDrag(on, (px, py) => {
      this.L.planeX = Math.round(px * 100) / 100;
      this.L.planeY = Math.round(py * 100) / 100;
      this.dev.build();
    });
  }

  toggleLayoutMode() {
    this.forcedMode = this.mobile ? 'pc' : 'mobile';
    this.relayout();
    this.dev.build();
  }

  resetLayout() {
    this.L = { ...(this.mobile ? LAYOUT_MOBILE : LAYOUT_PC) };
    this.relayout();
  }

  forceCrash() {
    if (this.engine.phase === PHASE.FLYING) this.engine.round.crash = this.engine.mult;
  }

  forceNext(m) {
    if (this.engine.next) this.engine.next.crash = m;
  }

  relayoutHistory() {
    this.history.resize(this.history.w, this.L.historyH);
  }

  relayout() {
    const w = this.app.screen.width / this.app.stage.scale.x;
    const h = this.app.screen.height / this.app.stage.scale.y;
    this.w = w; this.h = h;

    const auto = pickLayout(w, h);
    const wantMobile = this.forcedMode ? this.forcedMode === 'mobile' : auto.mobile;
    if (wantMobile !== this.mobile) {
      this.mobile = wantMobile;
      this.L = { ...(wantMobile ? LAYOUT_MOBILE : LAYOUT_PC) };
    }
    const L = this.L;
    const gap = L.gap;
    const showSecond = this.game.showSecond;

    this.topbar.visible = false;

    if (!this.mobile) {
      // Match the reference's ~26.5% feed while keeping useful size limits.
      const sideW = Math.min(512, Math.max(L.sideW, w * 0.265));
      const bodyY = L.topbarH + gap;
      const bodyH = h - bodyY - gap;
      this.feed.position.set(0, bodyY);
      this.feed.resize(sideW, bodyH, L);
      this.feed.visible = true;

      const rx = gap + sideW + gap;
      const rw = w - rx - gap;
      this.history.position.set(rx, bodyY);
      this.history.resize(rw, L.historyH);

      const fy = bodyY + L.historyH + gap;
      const betH = L.betPanelH;
      const fh = h - fy - gap - betH - gap;
      this.flight.position.set(rx, fy);
      this.flight.resize(rw, fh, L);
      this.flightRect = { x: rx, y: fy, w: rw, h: fh };

      const by = fy + fh + gap;
      if (showSecond) {
        const pw = (rw - gap) / 2;
        this.panels.forEach((p, i) => {
          p.visible = true;
          p.position.set(rx + i * (pw + gap), by);
          p.resize(pw, betH, L, false);
        });
      } else {
        const pw = Math.min(rw, 480);
        this.panels[0].visible = true;
        this.panels[1].visible = false;
        this.panels[0].position.set(rx + (rw - pw) / 2, by);
        this.panels[0].resize(pw, betH, L, false);
      }
    } else {
      const cw = w - gap * 2;
      let y = L.topbarH + 4;
      this.history.position.set(gap, y);
      this.history.resize(cw, L.historyH);
      y += L.historyH + gap;

      const betH = L.betPanelH;
      const betsH = betH * (showSecond ? 2 : 1) + (showSecond ? gap : 0);
      const feedMin = 172;
      const fh = Math.max(190, h - y - betsH - feedMin - gap * 3);
      this.flight.position.set(gap, y);
      this.flight.resize(cw, fh, L);
      this.flightRect = { x: gap, y, w: cw, h: fh };
      y += fh + gap;

      this.panels.forEach((p, i) => {
        p.visible = i === 0 || showSecond;
        if (!p.visible) return;
        p.position.set(gap, y);
        p.resize(cw, betH, L, true);
        y += betH + gap;
      });

      const feedH = Math.max(feedMin, h - y - gap);
      this.feed.position.set(gap, y);
      this.feed.resize(cw, feedH, L);
      this.feed.visible = true;
    }

    this.keypad.resize(w, h);
    this.modal.layout();
    this.dev.resize(w, h);
  }

  update(dt) {
    this.engine.update(dt);
    this.flight.animateBackground = this.settings.bgAnim;
    this.flight.update(dt);
    this.panels.forEach((p) => p.update(dt));
    this.feed.update(dt);
    this.modal.update();
    this.dev.update();
    if (this.toastT > 0) {
      this.toastT -= dt;
      this.toast.alpha = Math.min(1, this.toastT / 400);
      if (this.toastT <= 0) this.toast.visible = false;
    }
  }
}
