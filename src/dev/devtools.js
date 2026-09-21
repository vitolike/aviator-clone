// DEV Tuning Tools (Press 'D' to toggle)
// Live layout tweaking, PC/Mobile switching, forced crash simulation, JSON export
import { Container, Graphics } from '../../vendor/pixi.min.mjs';
import { COLORS, RULES } from '../config.js';
import { Button, ScrollBox, txt, panelBg } from '../view/ui.js';

class Slider extends Container {
  constructor(label, value, min, max, step, w, onChange) {
    super();
    this.min = min; this.max = max; this.step = step; this.value = value;
    this.w = w; this.onChange = onChange;
    this.label = txt(label, 10, COLORS.textDim, '700');
    this.val = txt('', 10, COLORS.gold, '800');
    this.val.anchor.set(1, 0);
    this.track = new Graphics();
    this.knob = new Graphics();
    this.addChild(this.label, this.val, this.track, this.knob);
    this.label.position.set(0, 0);
    this.val.position.set(w, 0);
    this.track.position.set(0, 16);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = { contains: (x, y) => x >= -6 && x <= w + 6 && y >= 8 && y <= 30 };
    const setFromX = (x) => {
      const p = Math.max(0, Math.min(1, x / this.w));
      let v = min + p * (max - min);
      v = Math.round(v / step) * step;
      this.value = Math.round(v * 10000) / 10000;
      this.draw();
      this.onChange(this.value);
    };
    this.on('pointerdown', (e) => { this._d = true; setFromX(e.getLocalPosition(this).x); });
    this.on('globalpointermove', (e) => { if (this._d) setFromX(e.getLocalPosition(this).x); });
    this.on('pointerup', () => { this._d = false; });
    this.on('pointerupoutside', () => { this._d = false; });
    this.draw();
  }

  draw() {
    const p = (this.value - this.min) / (this.max - this.min);
    this.track.clear();
    this.track.roundRect(0, 0, this.w, 4, 2).fill(0x3a3b3e);
    this.track.roundRect(0, 0, this.w * p, 4, 2).fill(COLORS.red);
    this.knob.clear();
    this.knob.circle(this.w * p, 18, 7).fill(0xffffff);
    this.val.text = String(this.value);
  }
}

export class DevTools extends Container {
  constructor(scene) {
    super();
    this.scene = scene;
    this.visible = false;
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.title = txt('DEV Tuning Tools (Press D to Close)', 12, COLORS.text, '800');
    this.addChild(this.title);
    this.scroll = new ScrollBox(250, 400);
    this.addChild(this.scroll);
    this.rows = [];
    this.build();
  }

  build() {
    this.scroll.content.removeChildren();
    const L = this.scene.L;
    const W = 232;
    let y = 0;
    const add = (key, min, max, step) => {
      const s = new Slider(key, L[key], min, max, step, W, (v) => {
        this.scene.L[key] = v;
        this.scene.relayout();
      });
      s.position.set(0, y);
      this.scroll.content.addChild(s);
      y += 34;
      this.rows.push(s);
    };
    const label = (str) => {
      const t = txt(str, 11, COLORS.gold, '800');
      t.position.set(0, y);
      this.scroll.content.addChild(t);
      y += 18;
    };

    label(`Current Layout: ${this.scene.mobile ? 'MOBILE' : 'PC'}`);
    label('— Layout Dimensions —');
    add('topbarH', 30, 70, 1);
    add('historyH', 24, 60, 1);
    if (!this.scene.mobile) add('sideW', 220, 460, 2);
    add('gap', 0, 24, 1);
    add('betPanelH', 110, 260, 2);
    label('— Flight Arena —');
    add('planeX', 0.4, 0.95, 0.01);
    add('planeY', 0.05, 0.6, 0.01);
    add('planeScale', 0.08, 0.8, 0.01);
    add('originX', 0.01, 0.3, 0.005);
    add('originY', 0.6, 0.98, 0.005);
    add('multSize', 28, 140, 1);
    add('multY', 0.15, 0.75, 0.01);
    add('statusSize', 10, 34, 1);
    label('— Betting Panels —');
    add('betBtnH', 40, 100, 1);
    add('amountH', 26, 60, 1);
    add('quickH', 16, 44, 1);
    add('feedRowH', 20, 46, 1);

    label('— Engine Rules —');
    const addRule = (key, min, max, step) => {
      const s = new Slider(key, RULES[key], min, max, step, W, (v) => { RULES[key] = v; });
      s.position.set(0, y);
      this.scroll.content.addChild(s);
      y += 34;
    };
    addRule('growth', 0.03, 0.2, 0.001);
    addRule('reachMs', 1000, 6000, 100);
    addRule('bettingMs', 2000, 12000, 250);
    addRule('crashedMs', 1000, 6000, 250);

    label('— State Simulation —');
    const mkBtn = (text, onTap, color = [0x3a3b3e, 0x2a2b2e]) => {
      const b = new Button({ w: W, h: 30, r: 8, top: color[0], bottom: color[1], label: text, labelSize: 12, onTap });
      b.position.set(0, y);
      this.scroll.content.addChild(b);
      y += 36;
    };
    mkBtn('🎯 Drag screen to position cruising point', () => this.scene.toggleDevDrag(), [COLORS.orangeLight, COLORS.orange]);
    mkBtn('Trigger Immediate Crash', () => this.scene.forceCrash());
    mkBtn('Force Next Round 1.00x (Instant Crash)', () => this.scene.forceNext(1.0));
    mkBtn('Force Next Round 2.00x', () => this.scene.forceNext(2));
    mkBtn('Force Next Round 10.00x', () => this.scene.forceNext(10));
    mkBtn('Force Next Round 100.00x', () => this.scene.forceNext(100));
    mkBtn(`Switch Layout (Currently ${this.scene.mobile ? 'MOBILE' : 'PC'})`, () => this.scene.toggleLayoutMode());
    mkBtn('Reset Current Layout Values', () => { this.scene.resetLayout(); this.build(); });
    mkBtn('💾 Export JSON (Copy to Clipboard)', () => this.exportJson(), [COLORS.greenLight, COLORS.greenDark]);

    this.status = txt('', 10, COLORS.textDim, '600');
    this.status.style.wordWrap = true;
    this.status.style.wordWrapWidth = W;
    this.status.position.set(0, y);
    this.scroll.content.addChild(this.status);
    y += 40;
    this.scroll.contentHeight = y;
  }

  exportJson() {
    const name = this.scene.mobile ? 'LAYOUT_MOBILE' : 'LAYOUT_PC';
    const rules = ['growth', 'reachMs', 'bettingMs', 'crashedMs']
      .map((k) => `  ${k}: ${RULES[k]},`).join('\n');
    const json = `export const ${name} = ${JSON.stringify(this.scene.L, null, 2)};\n\n// RULES Override\n{\n${rules}\n}`;
    console.log(json);
    navigator.clipboard?.writeText(json).then(
      () => { this.status.text = `Copied ${name} to clipboard. Paste into src/config.js.`; },
      () => { this.status.text = 'Output to console (clipboard permission denied).'; },
    );
  }

  toggle() {
    this.visible = !this.visible;
    if (this.visible) this.build();
    else this.scene.setDevDrag(false);
  }

  update() { if (this.visible) this.scroll.update(); }

  resize(w, h) {
    const bw = 256;
    const bh = Math.min(h - 20, 560);
    this.position.set(w - bw - 10, 10);
    panelBg(this.bg, bw, bh, 12, 0x16171a, COLORS.gold);
    this.title.position.set(12, 10);
    this.scroll.position.set(12, 32);
    this.scroll.resize(bw - 24, bh - 44);
  }
}
