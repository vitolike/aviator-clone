// Authentic audio effects with WebAudio synthesis fallback
export class Sfx {
  constructor() {
    this.enabled = localStorage.getItem('av_sfx') === '1';
    this.musicEnabled = localStorage.getItem('av_music') === '1';
    this.ctx = null;
    this.engineNodes = null;
    this.bgSource = null;
    this.bgGain = null;
    this.buffers = {};
    this.sampleUrls = {
      start: 'assets/audio/game-start.mp3',
      cashout: 'assets/audio/cashout.mp3',
      crash: 'assets/audio/plane-crash.mp3',
      bg: 'assets/audio/background.mp3',
    };
  }

  setEnabled(v) {
    this.enabled = v;
    localStorage.setItem('av_sfx', v ? '1' : '0');
  }

  setMusicEnabled(v) {
    this.musicEnabled = v;
    localStorage.setItem('av_music', v ? '1' : '0');
    if (!v) this.stopEngine();
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Pre-fetch and decode real audio buffers in background
    Object.entries(this.sampleUrls).forEach(([k, url]) => {
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuffer) => { this.buffers[k] = audioBuffer; })
        .catch(() => {});
    });
  }

  playBuffer(key, { loop = false, rate = 1, volume = 0.7 } = {}) {
    if (!(key === 'bg' ? this.musicEnabled : this.enabled) || !this.ctx || !this.buffers[key]) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[key];
    src.loop = loop;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    src.start();
    return { src, gain: g };
  }

  blip(freq = 660, dur = 0.08, type = 'sine', vol = 0.25) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  click() { this.blip(420, 0.05, 'square', 0.14); }
  tick() { this.blip(880, 0.04, 'sine', 0.10); }

  gameStart() {
    if (!this.enabled) return;
    if (this.buffers.start) {
      this.playBuffer('start', { volume: 0.65 });
    } else {
      this.blip(580, 0.12, 'triangle', 0.2);
    }
  }

  cashOut() {
    if (!this.enabled) return;
    if (this.buffers.cashout) {
      this.playBuffer('cashout', { volume: 0.85 });
    } else if (this.ctx) {
      [784, 1047, 1319].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'sine', 0.22), i * 70));
    }
  }

  bet() { this.blip(520, 0.09, 'triangle', 0.18); }

  startEngine() {
    if (!this.musicEnabled || !this.ctx) return;
    this.stopEngine();

    // Try real background audio sample first
    if (this.buffers.bg) {
      const p = this.playBuffer('bg', { loop: true, volume: 0.45, rate: 1.0 });
      if (p) {
        this.bgSource = p.src;
        this.bgGain = p.gain;
        return;
      }
    }

    // Synthesizer fallback
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 68;
    o2.type = 'square'; o2.frequency.value = 102;
    f.type = 'lowpass'; f.frequency.value = 520;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.4);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o2.start(t);
    this.engineNodes = { o, o2, g, f };
  }

  stopEngine() {
    if (this.bgSource && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        this.bgGain.gain.setValueAtTime(this.bgGain.gain.value, t);
        this.bgGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        this.bgSource.stop(t + 0.22);
      } catch {}
      this.bgSource = null;
      this.bgGain = null;
    }
    if (this.engineNodes && this.ctx) {
      const { o, o2, g } = this.engineNodes;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.stop(t + 0.3); o2.stop(t + 0.3);
      this.engineNodes = null;
    }
  }

  crash() {
    if (!this.enabled || !this.ctx) return;
    this.stopEngine();

    if (this.buffers.crash) {
      this.playBuffer('crash', { volume: 0.95 });
      return;
    }

    // Synthesizer explosion fallback
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    this.blip(180, 0.35, 'sawtooth', 0.18);
  }
}
