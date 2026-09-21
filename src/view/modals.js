// In-engine modal dialogs: Menu, Game Rules & How to Play, Provably Fair, Avatar Picker
import { Container, Graphics, Sprite } from '../../vendor/pixi.min.mjs';
import { COLORS, RULES } from '../config.js';
import { verify, randomSeed } from '../core/fair.js';
import { Button, ScrollBox, Toggle, txt, panelBg, iconGfx, fmt } from './ui.js';

export class Modal extends Container {
  constructor(app) {
    super();
    this.app = app;
    this.visible = false;
    this.dim = new Graphics();
    this.dim.eventMode = 'static';
    this.dim.on('pointertap', () => this.close());
    this.addChild(this.dim);

    this.box = new Container();
    this.box.eventMode = 'static';
    this.addChild(this.box);
    this.bg = new Graphics();
    this.roundChrome = new Container();
    this.title = txt('', 16, COLORS.text, '800');
    this.closeBtn = new Container();
    this.closeG = new Graphics();
    this.closeBtn.addChild(this.closeG, iconGfx('close', 12, COLORS.textDim));
    this.closeBtn.eventMode = 'static';
    this.closeBtn.cursor = 'pointer';
    this.closeBtn.on('pointertap', () => this.close());
    this.scroll = new ScrollBox(300, 300);
    this.box.addChild(this.bg, this.roundChrome, this.title, this.closeBtn, this.scroll);
  }

  close() { this.visible = false; }

  open(kind, ctx) {
    this.kind = kind;
    this.ctx = ctx;
    this.visible = true;
    this.build();
    this.layout();
  }

  clearContent() {
    this.scroll.content.removeChildren();
    this._y = 0;
  }

  addText(str, size = 13, color = COLORS.textDim, weight = '600') {
    const t = txt(str, size, color, weight);
    t.style.wordWrap = true;
    t.style.wordWrapWidth = this.scroll.w - 12;
    t.position.set(4, this._y);
    this.scroll.content.addChild(t);
    this._y += t.height + 6;
    return t;
  }

  addImage(path, w = 240, h = 120) {
    const s = Sprite.from(path);
    s.width = w;
    s.height = h;
    s.position.set((this.scroll.w - w) / 2, this._y);
    this.scroll.content.addChild(s);
    this._y += h + 8;
    return s;
  }

  addRow(label, value, valueColor = COLORS.text) {
    const g = new Graphics();
    g.position.set(4, this._y);
    const l = txt(label, 11, COLORS.textFaint, '700');
    l.position.set(12, this._y + 6);
    const v = txt(value, 12, valueColor, '700');
    v.style.wordWrap = true;
    v.style.breakWords = true;
    v.style.wordWrapWidth = this.scroll.w - 32;
    v.position.set(12, this._y + 20);
    panelBg(g, this.scroll.w - 8, Math.max(40, v.height + 26), 8, 0x151618, COLORS.panelLine);
    g.position.set(4, this._y);
    this.scroll.content.addChild(g, l, v);
    this._y += Math.max(46, v.height + 32);
    return v;
  }

  addButton(label, onTap, color = [COLORS.greenLight, COLORS.greenDark], w = null) {
    const b = new Button({
      w: w || this.scroll.w - 8, h: 40, r: 20, top: color[0], bottom: color[1],
      label, labelSize: 14, onTap,
    });
    b.position.set(4, this._y);
    this.scroll.content.addChild(b);
    this._y += 48;
    return b;
  }

  addToggleRow(label, value, onChange) {
    const g = new Graphics();
    panelBg(g, this.scroll.w - 8, 38, 8, 0x151618, COLORS.panelLine);
    g.position.set(4, this._y);
    const l = txt(label, 13, COLORS.text, '700');
    l.position.set(12, this._y + 12);
    const t = new Toggle(34, 18, value, onChange);
    t.position.set(this.scroll.w - 50, this._y + 10);
    this.scroll.content.addChild(g, l, t);
    this._y += 44;
  }

  buildRound() {
    const r = this.ctx.round;
    const w = this.scroll.w;
    const ink = 0xf5f5f5, muted = 0xa4a7ad, surface = 0x191a1a;
    const time = r.crashedAt ? new Date(r.crashedAt).toLocaleTimeString('pt-BR') : '--:--:--';
    this.title.text = `ROUND ${r.id ?? r.nonce ?? '—'}`;
    this.roundTime = time;

    const heading = (icon, label, subtitle) => {
      const y = this._y;
      const g = new Graphics();
      if (icon === 'server') {
        g.roundRect(3, 1, 30, 12, 2).stroke({ width: 1, color: ink });
        g.roundRect(3, 16, 30, 12, 2).stroke({ width: 1, color: ink });
        g.circle(8, 7, 1.5).fill(ink).circle(8, 22, 1.5).fill(ink);
        g.moveTo(18, 30).lineTo(18, 36).moveTo(3, 36).lineTo(33, 36).stroke({ width: 1, color: ink });
      } else if (icon === 'client') {
        g.rect(4, 2, 29, 23).stroke({ width: 1, color: ink });
        g.moveTo(1, 30).lineTo(36, 30).lineTo(33, 35).lineTo(4, 35).closePath().stroke({ width: 1, color: ink });
      } else {
        g.moveTo(18, 4).lineTo(33, 10).lineTo(29, 28).lineTo(18, 36).lineTo(7, 28).lineTo(3, 10).closePath().stroke({ width: 1, color: ink });
        g.roundRect(13, 16, 10, 11, 2).stroke({ width: 1, color: ink });
        g.circle(18, 21, 1.5).fill(ink);
        for (const x of [4, 18, 32]) g.circle(x, 2, 2).stroke({ width: 1, color: ink });
      }
      g.position.set(4, y);
      const a = txt(label, 17, ink, '500'); a.position.set(54, y);
      const b = txt(subtitle, 16, muted, '400'); b.position.set(54, y + 22);
      this.scroll.content.addChild(g, a, b);
      this._y += 50;
    };
    const strip = (items, height = 49) => {
      const y = this._y;
      const g = new Graphics().roundRect(0, y, w, height, 8).fill(surface);
      this.scroll.content.addChild(g);
      for (const [value, x, color = ink] of items) {
        const t = txt(String(value), 16, color, '500');
        t.position.set(x, y + (height - t.height) / 2);
        this.scroll.content.addChild(t);
      }
      this._y += height + 8;
    };

    heading('server', 'Server Seed:', 'Generated on our side');
    strip([[r.serverSeed || 'Not available', 24]]);
    this._y += 14;
    heading('client', 'Client Seed:', 'Generated on player’s side');
    strip([['Player N1:', 24, muted], [this.ctx.game.username || 'Demo', w * .19], ['Seed:', w * .4, muted], [r.clientSeed || 'Not available', w * .47]]);
    this._y += 22;
    heading('hash', 'Combined SHA256 Hash:', 'Above seeds combined and converted to SHA256 Hash. This is your game result');
    const hash = r.resultHash || r.hash || 'Not available';
    strip([[hash, 24]]);
    this._y += 12;
    const labels = [['Hex:', .25], ['Decimal:', .5], ['Result:', .75]];
    for (const [label, fraction] of labels) {
      const t = txt(label, 16, muted, '400'); t.anchor.set(.5, 0); t.position.set(w * fraction, this._y);
      this.scroll.content.addChild(t);
    }
    this._y += 25;
    const hex = hash.slice(0, 13);
    const decimal = /^[0-9a-f]{13}$/i.test(hex) ? String(parseInt(hex, 16)) : '—';
    strip([[hex, w * .13], [decimal, w * .42], [String(r.m), w * .74]]);
    this.scroll.contentHeight = this._y;
  }

  build() {
    this.clearContent();
    const { kind, ctx } = this;
    if (kind === 'menu') {
      this.title.text = 'Game Menu';
      this.addButton('Game Rules & How to Play', () => this.open('help', ctx), [0x3a3b3e, 0x2a2b2e]);
      this.addButton('Choose Game Avatar', () => this.open('avatars', ctx), [0x3a3b3e, 0x2a2b2e]);
      this.addButton('Provably Fair Verification', () => this.open('fair', ctx), [0x3a3b3e, 0x2a2b2e]);
      this.addToggleRow('Sound Effects', ctx.sfx.enabled, (v) => ctx.sfx.setEnabled(v));
      this.addToggleRow('Background Animation', ctx.settings.bgAnim, (v) => { ctx.settings.bgAnim = v; });
      this.addText('DEV Tuning Tools: Press D to open the layout inspector', 11, COLORS.textFaint);
      this.addButton(`Reset Balance to $${fmt(RULES.startBalance, 0)}`, () => {
        ctx.game.balance = RULES.startBalance;
        ctx.game.save();
        ctx.game.emit('change');
        this.close();
      }, [COLORS.orangeLight, COLORS.orange]);
      this.addText('This project is an authentic Spribe Aviator crash game demonstration for entertainment purposes.', 11, COLORS.textFaint);
    } else if (kind === 'avatars') {
      this.title.text = 'CHOOSE GAME AVATAR';
      this.addText('Pick your personal avatar for the live bet feed:', 12, COLORS.textDim);
      this._y += 6;

      const cols = 5;
      const size = 48;
      const innerW = this.scroll.w - 16;
      const gap = Math.max(8, (innerW - cols * size) / (cols - 1));
      const curAvatar = ctx.game.myAvatarId || 1;
      const grid = new Container();
      grid.position.set(8, this._y);

      for (let i = 1; i <= 72; i++) {
        const col = (i - 1) % cols;
        const row = Math.floor((i - 1) / cols);
        const x = col * (size + gap);
        const y = row * (size + 12);

        const item = new Container();
        item.position.set(x, y);
        item.eventMode = 'static';
        item.cursor = 'pointer';

        const bg = new Graphics();
        const isSel = curAvatar === i;
        bg.circle(size / 2, size / 2, size / 2 + 3).fill(isSel ? COLORS.green : 0x1c1d20);
        if (isSel) bg.circle(size / 2, size / 2, size / 2 + 4).stroke({ width: 2, color: COLORS.greenLight });

        const s = Sprite.from(`assets/images/avatars/av-${i}.png`);
        s.width = size;
        s.height = size;

        item.addChild(bg, s);
        item.on('pointertap', () => {
          ctx.game.setAvatar(i);
          this.build();
        });
        grid.addChild(item);
      }
      this.scroll.content.addChild(grid);
      this._y += Math.ceil(72 / cols) * (size + 12) + 20;
    } else if (kind === 'help') {
      this.title.text = 'GAME RULES';
      
      this.addText('HOW TO PLAY', 15, COLORS.text, '900');
      this.addText('Aviator is as easy to play as 1-2-3:', 12, COLORS.textDim);
      this._y += 6;

      this.addImage('assets/images/step-01.png', 240, 120);
      this.addText('1. BET', 13, COLORS.greenLight, '800');
      this.addText('Select an amount and press the "Bet" button to place a bet before the round starts.', 12, COLORS.textDim);
      this._y += 6;

      this.addImage('assets/images/step-02.png', 240, 120);
      this.addText('2. MULTIPLY', 13, COLORS.cyan, '800');
      this.addText('Watch the Lucky Plane take off and multiplier climb from 1.00x upwards.', 12, COLORS.textDim);
      this._y += 6;

      this.addImage('assets/images/step-03.png', 240, 120);
      this.addText('3. CASH OUT', 13, COLORS.gold, '800');
      this.addText('Press the "Cash Out" button before the plane flies away! Your win = Bet × Cash Out multiplier.', 12, COLORS.textDim);
      this._y += 10;

      this.addText('GAME FUNCTIONS', 15, COLORS.text, '900');
      this.addText('• Bet & Cash Out: You can make two bets simultaneously by adding a second bet panel with the plus (+) button. Your bet is lost if you did not cash out before the plane flies away.', 12, COLORS.textDim);
      this._y += 4;
      this.addText('• Auto Play & Auto Cash Out: Available from the "Auto" tab. Auto Bet automatically queues each round. Auto Cash Out automatically collects winnings when your target multiplier is reached.', 12, COLORS.textDim);
      this._y += 4;
      this.addText('• Live Bets & Statistics: The left-side feed displays all live bets in real-time, your previous round records, and top historical crash multipliers.', 12, COLORS.textDim);
      this._y += 10;

      this.addText('RANDOMISATION & PROVABLY FAIR', 15, COLORS.text, '900');
      this.addText('The multiplier for each round is generated by a 100% Provably Fair cryptographic algorithm using SHA-256 with committed hashes. Outcomes are predetermined before takeoff and can be verified by anyone after the round.', 12, COLORS.textDim);
      this._y += 10;

      this.addText('RETURN TO PLAYER (RTP)', 15, COLORS.text, '900');
      this.addText(`The overall theoretical return to player (RTP) is ${RULES.rtp * 100}%. Min Bet: $${RULES.minBet.toFixed(2)}, Max Bet: $${fmt(RULES.maxBet, 0)}, Max Win: $${fmt(RULES.maxWinPerBet, 0)}, Max Multiplier: ${fmt(RULES.maxMultiplier, 0)}x.`, 12, COLORS.textDim);
      this._y += 10;

      this.addText('DISCONNECTION / OTHER RULES', 15, COLORS.text, '900');
      this.addText('If your internet connection drops during an active in-flight bet, the game automatically cashes out at the current multiplier and credits your balance. In the event of gaming software malfunction, all affected bets are refunded.', 12, COLORS.textDim);
    } else if (kind === 'fair') {
      this.title.text = 'Provably Fair Verification';
      const e = ctx.engine;
      const last = e.history.find((h) => h.serverSeed);
      this.addText('Every round outcome is predetermined cryptographically with SHA-256 before takeoff. When the round completes, the server seed is revealed so anyone can verify.', 12, COLORS.textDim);
      this.addRow('Client Seed (Customizable)', e.clientSeed, COLORS.cyan);
      this.addButton('Generate New Client Seed', () => {
        e.setClientSeed(randomSeed(8));
        this.build();
        this.layout();
      }, [0x3a3b3e, 0x2a2b2e]);
      if (e.next) this.addRow('Next Round Commitment Hash (SHA-256)', e.next.commit, COLORS.gold);
      if (last) {
        this.addText('Previous Round', 14, COLORS.text, '800');
        this.addRow('Nonce', String(last.nonce));
        this.addRow('Server Seed', last.serverSeed);
        this.addRow('Result Hash', last.hash);
        this.addRow('Crash Multiplier', `${last.m.toFixed(2)}x`, COLORS.red);
        const res = this.addRow('Verification Status', 'Unverified', COLORS.textDim);
        this.addButton('Recalculate & Verify', async () => {
          const v = await verify(last.serverSeed, last.clientSeed, last.nonce);
          const ok = v.hash === last.hash && Math.abs(v.crash - last.m) < 1e-9;
          res.text = ok ? `✓ Verified: Hash and crash match ${v.crash.toFixed(2)}x` : `✗ Mismatch (${v.crash.toFixed(2)}x)`;
          res.style.fill = ok ? COLORS.green : COLORS.red;
        });
      }
      this.addText(`Distribution: P(multiplier ≥ m) = RTP / m, RTP = ${RULES.rtp * 100}%`, 11, COLORS.textFaint);
    } else if (kind === 'freeBets') {
      this.title.text = 'Free Bets';
      this.addText('No free bets available for this account.', 14, COLORS.textDim, '500');
    } else if (kind === 'betHistory') {
      this.title.text = 'My Bet History';
      if (!ctx.game.myBets.length) this.addText('No bets recorded yet.', 14, COLORS.textDim, '500');
      for (const bet of ctx.game.myBets.slice(0, 30)) {
        const when = new Date(bet.t).toLocaleString('pt-BR');
        this.addRow(when, `${fmt(bet.amount)} USD  ·  ${bet.m ? `${bet.m.toFixed(2)}x` : 'Lost'}  ·  ${fmt(bet.win)} USD`);
      }
    } else if (kind === 'limits') {
      this.title.text = 'Game Limits';
      this.addRow('Minimum Bet', `${fmt(RULES.minBet)} USD`);
      this.addRow('Maximum Bet', `${fmt(RULES.maxBet)} USD`);
      this.addRow('Maximum Win Per Bet', `${fmt(RULES.maxWinPerBet)} USD`);
      this.addRow('Maximum Multiplier', `${fmt(RULES.maxMultiplier, 0)}x`);
    } else if (kind === 'round') {
      this.buildRound();
    }
    this.scroll.contentHeight = this._y;
  }

  layout() {
    const W = this.app.screen.width / this.app.stage.scale.x;
    const H = this.app.screen.height / this.app.stage.scale.y;
    this.dim.clear();
    this.dim.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.7 });
    const isRound = this.kind === 'round';
    const bw = Math.min(isRound ? 1000 : 420, W - 32);
    const bh = Math.min(isRound ? 710 : 560, H - 32);
    this.box.position.set((W - bw) / 2, (H - bh) / 2);
    panelBg(this.bg, bw, bh, isRound ? 9 : 14, isRound ? 0x202121 : COLORS.panel, isRound ? null : COLORS.panelLine);
    this.roundChrome.removeChildren();
    if (isRound) {
      const chrome = new Graphics();
      chrome.roundRect(0, 0, bw, 44, 9).fill(0x2d2e30);
      chrome.rect(0, 34, bw, 10).fill(0x2d2e30);
      chrome.roundRect(0, bh - 61, bw, 61, 9).fill(0x2d2e30);
      chrome.rect(0, bh - 61, bw, 10).fill(0x2d2e30);
      this.roundChrome.addChild(chrome);
      const footer = txt('For instructions check', 17, 0xa4a7ad, '400');
      const link = txt('What is Provably Fair', 17, 0xff3154, '400');
      const total = footer.width + link.width + 15;
      footer.position.set((bw - total) / 2, bh - 41);
      link.position.set(footer.x + footer.width + 15, bh - 41);
      link.eventMode = 'static'; link.cursor = 'pointer';
      link.on('pointertap', () => this.open('fair', this.ctx));
      this.roundChrome.addChild(footer, link);
    }
    this.title.style.fontSize = isRound ? 18 : 16;
    this.title.position.set(13, isRound ? 10 : 14);
    if (isRound) {
      const pillX = this.title.x + this.title.width + 10;
      const pill = new Graphics().roundRect(pillX, 10, 55, 25, 13).fill(0x191a1d);
      const mult = txt(`${this.ctx.round.m.toFixed(2)}x`, 14, 0x39a9ff, '700');
      mult.anchor.set(.5); mult.position.set(pillX + 27.5, 22.5);
      const clock = txt(this.roundTime, 18, 0xffffff, '400');
      clock.position.set(pillX + 62, 10);
      this.roundChrome.addChild(pill, mult, clock);
    }
    this.closeG.clear();
    if (!isRound) this.closeG.circle(0, 0, 14).fill(0x2a2b2e);
    this.closeBtn.position.set(bw - 22, isRound ? 22 : 26);
    this.closeBtn.hitArea = { contains: (x, y) => x * x + y * y <= 18 * 18 };
    this.scroll.position.set(isRound ? 62 : 12, isRound ? 62 : 48);
    this.scroll.resize(isRound ? bw - 124 : bw - 24, isRound ? bh - 140 : bh - 60);
    if (this.visible) this.build();
  }

  update() { if (this.visible) this.scroll.update(); }
}
