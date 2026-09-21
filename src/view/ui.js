// Pure PixiJS UI component library (no DOM inputs)
import { Container, Graphics, Rectangle, Sprite, Text } from '../../vendor/pixi.min.mjs';
import { COLORS, FONT } from '../config.js';
import { roundedGradient } from './textures.js';

export function txt(str, size = 14, color = COLORS.text, weight = '600', align = 'left') {
  return new Text({
    text: str,
    style: { fontFamily: FONT, fontSize: size, fill: color, fontWeight: weight, align, lineHeight: size * 1.2 },
  });
}

export function panelBg(g, w, h, r = 10, color = COLORS.panel, line = COLORS.panelLine, alpha = 1) {
  g.clear();
  g.roundRect(0, 0, w, h, r).fill({ color, alpha });
  if (line !== null) g.roundRect(0.5, 0.5, w - 1, h - 1, r).stroke({ width: 1, color: line, alpha: 0.9 });
  return g;
}

export class Button extends Container {
  constructor(o = {}) {
    super();
    this.o = Object.assign({
      w: 120, h: 44, r: 22, top: COLORS.greenLight, bottom: COLORS.greenDark,
      border: 0xffffff, borderAlpha: 0.35, label: '', labelSize: 18, labelColor: COLORS.text,
      sub: '', subSize: 13, onTap: null, shadow: true,
    }, o);
    this.bg = new Sprite();
    this.bg.anchor.set(0);
    this.addChild(this.bg);
    this.label = txt(this.o.label, this.o.labelSize, this.o.labelColor, '800');
    this.label.anchor.set(0.5);
    this.sub = txt(this.o.sub, this.o.subSize, this.o.labelColor, '700');
    this.sub.anchor.set(0.5);
    this.addChild(this.label, this.sub);
    this.enabled = true;
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this._pressed = false;
    this.on('pointerdown', () => { if (!this.enabled) return; this._pressed = true; this.alpha = 0.82; });
    this.on('pointerupoutside', () => { this._pressed = false; this.alpha = 1; });
    this.on('pointerup', () => {
      this.alpha = 1;
      if (this._pressed && this.enabled && this.o.onTap) this.o.onTap();
      this._pressed = false;
    });
    this.redraw();
  }

  setTheme(top, bottom, border = this.o.border) {
    this.o.top = top; this.o.bottom = bottom; this.o.border = border;
    this.redraw();
  }

  setLabel(label, sub = '') {
    if (this.o.label !== label) { this.o.label = label; this.label.text = label; }
    if (this.o.sub !== sub) { this.o.sub = sub; this.sub.text = sub; }
    this.layout();
  }

  setSize2(w, h) {
    if (this.o.w === w && this.o.h === h) return;
    this.o.w = w; this.o.h = h;
    this.redraw();
  }

  setEnabled(v) {
    this.enabled = v;
    this.alpha = v ? 1 : 0.42;
    this.cursor = v ? 'pointer' : 'default';
  }

  setFontSize(labelSize, subSize = this.o.subSize) {
    this.o.labelSize = labelSize; this.o.subSize = subSize;
    this.label.style.fontSize = labelSize;
    this.sub.style.fontSize = subSize;
    this.layout();
  }

  redraw() {
    const { w, h, r, top, bottom, border, borderAlpha } = this.o;
    this.bg.texture = roundedGradient(w, h, r, top, bottom, border, borderAlpha);
    this.bg.width = w; this.bg.height = h;
    this.hitArea = new Rectangle(0, 0, w, h);
    this.layout();
  }

  layout() {
    const { w, h } = this.o;
    const hasSub = !!this.o.sub;
    this.label.position.set(w / 2, hasSub ? h * 0.34 : h / 2);
    this.sub.position.set(w / 2, h * 0.7);
    this.sub.visible = hasSub;
  }
}

// Small tab control (Bet / Auto)
export class Tabs extends Container {
  constructor(items, w, h, onChange) {
    super();
    this.items = items;
    this.value = items[0].id;
    this.w = w; this.h = h;
    this.onChange = onChange;
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.btns = items.map((it) => {
      const c = new Container();
      const g = new Graphics();
      const t = txt(it.label, 12, COLORS.textDim, '700');
      t.anchor.set(0.5);
      c.addChild(g, t);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointertap', () => this.set(it.id));
      c._g = g; c._t = t;
      this.addChild(c);
      return c;
    });
    this.resize(w, h);
  }

  set(id) {
    if (this.value === id) return;
    this.value = id;
    this.draw();
    this.onChange?.(id);
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.draw();
  }

  draw() {
    const { w, h } = this;
    panelBg(this.bg, w, h, h / 2, COLORS.panelDeep, null);
    const bw = w / this.items.length;
    this.items.forEach((it, i) => {
      const c = this.btns[i];
      const on = this.value === it.id;
      c.position.set(bw * i, 0);
      c.hitArea = new Rectangle(0, 0, bw, h);
      panelBg(c._g, bw, h, h / 2, on ? 0x2c2d30 : COLORS.panelDeep, on ? 0x3d3f42 : null);
      c._g.alpha = on ? 1 : 0.001;
      c._t.style.fill = on ? COLORS.text : COLORS.textDim;
      c._t.position.set(bw / 2, h / 2);
    });
  }
}

// Switch / Toggle control
export class Toggle extends Container {
  constructor(w = 34, h = 18, value = false, onChange = null) {
    super();
    this.w = w; this.h = h; this.value = value; this.onChange = onChange;
    this.bg = new Graphics();
    this.knob = new Graphics();
    this.addChild(this.bg, this.knob);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => { this.set(!this.value); this.onChange?.(this.value); });
    this.hitArea = new Rectangle(-4, -4, w + 8, h + 8);
    this.draw();
  }
  set(v) { this.value = v; this.draw(); }
  draw() {
    const { w, h } = this;
    panelBg(this.bg, w, h, h / 2, this.value ? COLORS.green : 0x3a3b3e, null);
    this.knob.clear();
    this.knob.circle(this.value ? w - h / 2 : h / 2, h / 2, h / 2 - 2).fill(0xffffff);
  }
}

// Scrollable container box
export class ScrollBox extends Container {
  constructor(w, h) {
    super();
    this.w = w; this.h = h;
    this.content = new Container();
    this.maskG = new Graphics();
    this.addChild(this.content, this.maskG);
    this.content.mask = this.maskG;
    this.eventMode = 'static';
    this._drag = null;
    this._vy = 0;
    this.on('pointerdown', (e) => { this._drag = { y: e.global.y, oy: this.content.y, moved: 0 }; this._vy = 0; });
    this.on('globalpointermove', (e) => {
      if (!this._drag) return;
      const dy = e.global.y - this._drag.y;
      this._drag.moved = Math.max(this._drag.moved, Math.abs(dy));
      this._vy = dy - (this.content.y - this._drag.oy);
      this.content.y = this._drag.oy + dy;
      this.clamp();
    });
    const end = () => { this._drag = null; };
    this.on('pointerup', end);
    this.on('pointerupoutside', end);
    this.resize(w, h);
  }

  onWheel(dy) { this.content.y -= dy; this.clamp(); }

  clamp() {
    const min = Math.min(0, this.h - this.contentHeight);
    this.content.y = Math.max(min, Math.min(0, this.content.y));
  }

  get contentHeight() { return this._ch || 0; }
  set contentHeight(v) { this._ch = v; this.clamp(); }

  update() {
    if (!this._drag && Math.abs(this._vy) > 0.1) {
      this.content.y += this._vy;
      this._vy *= 0.92;
      this.clamp();
    }
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.maskG.clear();
    this.maskG.rect(0, 0, w, h).fill(0xffffff);
    this.hitArea = new Rectangle(0, 0, w, h);
    this.clamp();
  }
}

// Vector icons (plus, minus, close, menu, check, clock)
export function iconGfx(name, size, color = COLORS.text) {
  const g = new Graphics();
  const s = size;
  if (name === 'plus') {
    g.rect(-s / 2, -1.2, s, 2.4).fill(color);
    g.rect(-1.2, -s / 2, 2.4, s).fill(color);
  } else if (name === 'minus') {
    g.rect(-s / 2, -1.2, s, 2.4).fill(color);
  } else if (name === 'close') {
    g.moveTo(-s / 2, -s / 2).lineTo(s / 2, s / 2).stroke({ width: 2.4, color });
    g.moveTo(s / 2, -s / 2).lineTo(-s / 2, s / 2).stroke({ width: 2.4, color });
  } else if (name === 'menu') {
    for (let i = -1; i <= 1; i++) g.rect(-s / 2, i * (s / 3) - 1, s, 2).fill(color);
  } else if (name === 'check') {
    g.moveTo(-s / 2, 0).lineTo(-s / 6, s / 3).lineTo(s / 2, -s / 3).stroke({ width: 2.2, color });
  } else if (name === 'clock') {
    g.circle(0, 0, s / 2).stroke({ width: 1.6, color });
    g.moveTo(0, 0).lineTo(0, -s / 3).stroke({ width: 1.6, color });
    g.moveTo(0, 0).lineTo(s / 4, 0).stroke({ width: 1.6, color });
  }
  return g;
}

export function fmt(n, dec = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
