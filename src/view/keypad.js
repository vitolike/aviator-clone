// In-engine numeric keypad dialog (modal keypad without DOM inputs)
import { Container, Graphics } from '../../vendor/pixi.min.mjs';
import { COLORS } from '../config.js';
import { Button, txt, panelBg } from './ui.js';

export class Keypad extends Container {
  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'static';
    this.dim = new Graphics();
    this.dim.eventMode = 'static';
    this.addChild(this.dim);
    this.dim.on('pointertap', () => this.close(false));

    this.box = new Container();
    this.addChild(this.box);
    this.bg = new Graphics();
    this.box.addChild(this.bg);
    this.title = txt('', 14, COLORS.textDim, '700');
    this.value = txt('', 30, COLORS.text, '800');
    this.value.anchor.set(0.5, 0);
    this.title.anchor.set(0.5, 0);
    this.box.addChild(this.title, this.value);

    this.keys = [];
    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
    labels.forEach((k) => {
      const b = new Button({
        w: 70, h: 46, r: 10, top: 0x303134, bottom: 0x232427, border: 0x45464a, borderAlpha: 0.8,
        label: k, labelSize: 20, onTap: () => this.press(k),
      });
      this.box.addChild(b);
      this.keys.push(b);
    });
    this.okBtn = new Button({ w: 100, h: 42, r: 21, top: COLORS.greenLight, bottom: COLORS.greenDark, label: 'OK', labelSize: 16, onTap: () => this.close(true) });
    this.cancelBtn = new Button({ w: 100, h: 42, r: 21, top: 0x3a3b3e, bottom: 0x2a2b2e, label: 'Cancel', labelSize: 16, onTap: () => this.close(false) });
    this.box.addChild(this.okBtn, this.cancelBtn);
  }

  open({ title, value, min, max, dec, onDone }) {
    this.opts = { title, min, max, dec, onDone };
    this.buf = String(value);
    this.fresh = true;
    this.title.text = title;
    this.value.text = this.buf;
    this.visible = true;
    this.layout();
  }

  press(k) {
    if (this.fresh) { this.buf = ''; this.fresh = false; }
    if (k === '⌫') this.buf = this.buf.slice(0, -1);
    else if (k === '.') { if (!this.buf.includes('.') && this.opts.dec > 0) this.buf += this.buf ? '.' : '0.'; }
    else if (this.buf.length < 9) this.buf += k;
    this.value.text = this.buf || '0';
  }

  close(ok) {
    this.visible = false;
    if (!ok) return;
    let v = parseFloat(this.buf || '0');
    if (!isFinite(v)) v = this.opts.min;
    v = Math.max(this.opts.min, Math.min(this.opts.max, v));
    this.opts.onDone(v);
  }

  layout() {
    const W = this.parentW || 800, H = this.parentH || 600;
    this.dim.clear();
    this.dim.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.72 });
    const bw = Math.min(300, W - 40);
    const pad = 14;
    const kw = (bw - pad * 2 - 12) / 3;
    const kh = Math.min(46, H * 0.075);
    const bh = 96 + (kh + 8) * 4 + 46;
    this.box.position.set((W - bw) / 2, (H - bh) / 2);
    panelBg(this.bg, bw, bh, 14, COLORS.panel, COLORS.panelLine);
    this.title.position.set(bw / 2, 12);
    this.value.position.set(bw / 2, 34);
    this.keys.forEach((b, i) => {
      b.setSize2(kw, kh);
      b.position.set(pad + (i % 3) * (kw + 6), 86 + ((i / 3) | 0) * (kh + 8));
    });
    const by = 86 + (kh + 8) * 4;
    const half = (bw - pad * 2 - 10) / 2;
    this.cancelBtn.setSize2(half, 42);
    this.okBtn.setSize2(half, 42);
    this.cancelBtn.position.set(pad, by);
    this.okBtn.position.set(pad + half + 10, by);
  }

  resize(w, h) {
    this.parentW = w; this.parentH = h;
    if (this.visible) this.layout();
    else { this.dim.clear(); this.dim.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.72 }); }
  }
}
