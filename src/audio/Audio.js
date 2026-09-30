// All sound is synthesised with the Web Audio API — no audio files.
import { storage } from '../game/Storage.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = storage.getMuted();
    this.ambient = null;
    this.rollGain = null;
    this.lastHit = 0;
  }

  // Must be called from a user gesture
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.amb = ctx.createGain();
    this.amb.gain.value = 0.35;
    this.amb.connect(this.master);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // rolling noise (continuous, gain driven by ball speed)
    const rs = ctx.createBufferSource();
    rs.buffer = this.noiseBuf; rs.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'lowpass'; rf.frequency.value = 500; rf.Q.value = 0.7;
    this.rollFilter = rf;
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    rs.connect(rf).connect(this.rollGain).connect(this.sfx);
    rs.start();
  }

  setMuted(m) {
    this.muted = m;
    storage.setMuted(m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  get t() { return this.ctx.currentTime; }

  // ---- building blocks -------------------------------------------------------

  tone(freq, dur, { type = 'sine', gain = 0.3, attack = 0.005, freqEnd = null, delay = 0, dest = null, curve = 'exp' } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
      else o.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  noise(dur, { type = 'bandpass', freq = 1000, freqEnd = null, Q = 1, gain = 0.3, attack = 0.003, delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = Q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur + 0.05);
  }

  // ---- game sounds -----------------------------------------------------------

  putt(power) {
    const p = Math.min(1, power);
    this.tone(1400, 0.05, { type: 'triangle', gain: 0.25 + p * 0.35, freqEnd: 500 });
    this.tone(220, 0.09, { type: 'sine', gain: 0.2 + p * 0.3, freqEnd: 90 });
    this.noise(0.04, { type: 'highpass', freq: 3000, gain: 0.1 + p * 0.25 });
  }

  hit(speed, sound = 'wall') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.04) return;
    this.lastHit = now;
    const v = Math.min(1, speed / 6);
    const g = 0.08 + v * 0.45;
    switch (sound) {
      case 'metal':
        for (const [f, k] of [[820, 1], [1310, 0.6], [2150, 0.4]]) this.tone(f * (0.95 + Math.random() * 0.1), 0.35, { type: 'sine', gain: g * 0.35 * k });
        this.noise(0.03, { type: 'highpass', freq: 2500, gain: g * 0.3 });
        break;
      case 'stone':
        this.noise(0.08, { type: 'lowpass', freq: 700, gain: g * 0.9 });
        this.tone(140, 0.08, { type: 'sine', gain: g * 0.5, freqEnd: 70 });
        break;
      case 'bumper':
        this.tone(260, 0.28, { type: 'square', gain: 0.12, freqEnd: 720 });
        this.tone(520, 0.25, { type: 'sine', gain: 0.22, freqEnd: 1300, delay: 0.02 });
        this.noise(0.05, { type: 'bandpass', freq: 2000, gain: 0.15 });
        break;
      case 'ice':
        this.tone(2400 + Math.random() * 400, 0.18, { type: 'sine', gain: g * 0.35 });
        this.tone(3700, 0.12, { type: 'sine', gain: g * 0.2 });
        break;
      case 'soft':
        this.noise(0.06, { type: 'lowpass', freq: 500, gain: g * 0.7 });
        break;
      case 'wood':
      case 'wall':
      default:
        this.tone(sound === 'wood' ? 380 : 520, 0.07, { type: 'triangle', gain: g * 0.7, freqEnd: 180 });
        this.noise(0.05, { type: 'bandpass', freq: sound === 'wood' ? 900 : 1500, Q: 2, gain: g * 0.6 });
    }
  }

  land(speed) {
    const v = Math.min(1, speed / 5);
    this.noise(0.07, { type: 'lowpass', freq: 400, gain: 0.1 + v * 0.3 });
    this.tone(110, 0.08, { type: 'sine', gain: 0.1 + v * 0.2, freqEnd: 60 });
  }

  setRoll(speed, grounded, sound) {
    if (!this.rollGain) return;
    const v = grounded ? Math.min(1, speed / 6) : 0;
    const target = v * v * 0.35 + (grounded && speed > 0.05 ? 0.015 : 0);
    this.rollGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    const f = sound === 'metal' ? 1600 : sound === 'wood' ? 800 : sound === 'ice' ? 2600 : sound === 'stone' ? 900 : 380;
    this.rollFilter.frequency.setTargetAtTime(f + v * 500, this.ctx.currentTime, 0.1);
  }

  lip() {
    this.tone(700, 0.05, { type: 'triangle', gain: 0.2, freqEnd: 400 });
    this.tone(500, 0.05, { type: 'triangle', gain: 0.15, freqEnd: 300, delay: 0.06 });
  }

  cup() {
    // rattle into the cup, then a happy chime
    const hits = [0, 0.09, 0.16, 0.21, 0.245];
    hits.forEach((d, i) => {
      this.tone(900 - i * 90, 0.06, { type: 'triangle', gain: 0.3 - i * 0.04, freqEnd: 350, delay: d });
      this.noise(0.03, { type: 'bandpass', freq: 1800, Q: 3, gain: 0.15, delay: d });
    });
    this.tone(160, 0.2, { type: 'sine', gain: 0.35, freqEnd: 70, delay: 0.26 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', gain: 0.14, delay: 0.35 + i * 0.07 }));
  }

  splash() {
    this.noise(0.6, { type: 'lowpass', freq: 4000, freqEnd: 250, gain: 0.5, attack: 0.01 });
    this.noise(0.25, { type: 'highpass', freq: 2500, gain: 0.2 });
    for (let i = 0; i < 6; i++) {
      const f = 400 + Math.random() * 600;
      this.tone(f, 0.08, { type: 'sine', gain: 0.12, freqEnd: f * 2.2, delay: 0.15 + Math.random() * 0.5 });
    }
  }

  sizzle() {
    this.noise(1.1, { type: 'highpass', freq: 3000, freqEnd: 6000, gain: 0.35, attack: 0.01 });
    this.noise(0.8, { type: 'lowpass', freq: 200, gain: 0.4 });
    for (let i = 0; i < 5; i++) this.tone(90 + Math.random() * 60, 0.15, { type: 'sine', gain: 0.18, freqEnd: 40, delay: Math.random() * 0.6 });
  }

  outOfBounds() {
    this.tone(400, 0.3, { type: 'triangle', gain: 0.2, freqEnd: 150 });
    this.noise(0.3, { type: 'bandpass', freq: 800, freqEnd: 200, gain: 0.2 });
  }

  portal() {
    this.noise(0.6, { type: 'bandpass', freq: 400, freqEnd: 4000, Q: 4, gain: 0.35 });
    this.tone(300, 0.5, { type: 'sine', gain: 0.25, freqEnd: 1500 });
    this.tone(450, 0.5, { type: 'triangle', gain: 0.1, freqEnd: 2250, delay: 0.05 });
  }

  boost() {
    this.tone(200, 0.3, { type: 'sawtooth', gain: 0.1, freqEnd: 900 });
    this.noise(0.3, { type: 'bandpass', freq: 800, freqEnd: 3000, gain: 0.2 });
  }

  click() { this.tone(900, 0.04, { type: 'triangle', gain: 0.15, freqEnd: 700 }); }

  swish() { this.noise(0.5, { type: 'bandpass', freq: 500, freqEnd: 250, Q: 2, gain: 0.05, attack: 0.2 }); }

  whoosh() { this.noise(1.2, { type: 'bandpass', freq: 300, freqEnd: 1600, Q: 1.5, gain: 0.2, attack: 0.4 }); }

  penalty() {
    this.tone(330, 0.18, { type: 'square', gain: 0.08 });
    this.tone(247, 0.3, { type: 'square', gain: 0.08, delay: 0.18 });
  }

  roar() {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.linearRampToValueAtTime(85, t0 + 0.4);
    o.frequency.linearRampToValueAtTime(60, t0 + 1.4);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 23;
    const lg = ctx.createGain(); lg.gain.value = 18;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 1.4;
    f.frequency.linearRampToValueAtTime(300, t0 + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t0); lfo.start(t0);
    o.stop(t0 + 1.6); lfo.stop(t0 + 1.6);
    this.noise(1.3, { type: 'bandpass', freq: 700, freqEnd: 250, Q: 1, gain: 0.25, attack: 0.1 });
  }

  cannon() {
    this.noise(0.9, { type: 'lowpass', freq: 600, freqEnd: 80, gain: 0.3, attack: 0.005 });
    this.tone(90, 0.5, { type: 'sine', gain: 0.25, freqEnd: 35 });
  }

  thump() {
    this.tone(70, 0.25, { type: 'sine', gain: 0.35, freqEnd: 40 });
    this.noise(0.15, { type: 'lowpass', freq: 300, gain: 0.25 });
  }

  steam() { this.noise(0.7, { type: 'highpass', freq: 2500, gain: 0.12, attack: 0.05 }); }

  clank() {
    this.tone(180, 0.2, { type: 'square', gain: 0.06, freqEnd: 90 });
    this.noise(0.1, { type: 'bandpass', freq: 1200, Q: 3, gain: 0.12 });
  }

  firework(delay = 0) {
    this.noise(0.15, { type: 'lowpass', freq: 1200, gain: 0.35, delay });
    for (let i = 0; i < 8; i++) this.noise(0.03, { type: 'highpass', freq: 4000, gain: 0.08, delay: delay + 0.1 + Math.random() * 0.5 });
  }

  // Short fanfares for the score
  celebrate(kind) {
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const play = (notes, type = 'square', g = 0.09, step = 0.11) => notes.forEach((n, i) => {
      if (n === null) return;
      const [note, len = 1] = Array.isArray(n) ? n : [n];
      this.tone(N(note), step * len * 1.6, { type, gain: g, delay: i * step });
      this.tone(N(note) * 2, step * len * 1.4, { type: 'triangle', gain: g * 0.6, delay: i * step });
    });
    switch (kind) {
      case 'hio':
        play([60, 64, 67, 72, 67, 72, [76, 2], null, 79, [84, 4]], 'square', 0.1, 0.12);
        for (let i = 0; i < 6; i++) this.firework(0.4 + i * 0.35);
        break;
      case 'albatross':
      case 'eagle':
        play([60, 64, 67, 72, 76, [79, 4]], 'square', 0.1, 0.11);
        this.firework(0.5); this.firework(0.9);
        break;
      case 'birdie':
        play([67, 72, 76, [79, 3]], 'square', 0.09, 0.1);
        break;
      case 'par':
        play([64, 67, [72, 3]], 'triangle', 0.14, 0.12);
        break;
      default:
        play([67, 64, [60, 3]], 'triangle', 0.12, 0.16);
    }
  }

  // ---- ambience ----------------------------------------------------------------

  startAmbient(theme) {
    this.stopAmbient();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const nodes = [];
    const timers = [];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
    out.connect(this.amb);
    const loopNoise = (type, freq, gain, lfoRate = 0.1, lfoDepth = 0.5, Q = 0.7) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q;
      const g = ctx.createGain(); g.gain.value = gain;
      const lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate;
      const lg = ctx.createGain(); lg.gain.value = gain * lfoDepth;
      lfo.connect(lg).connect(g.gain);
      s.connect(f).connect(g).connect(out);
      s.start(); lfo.start();
      nodes.push(s, lfo);
    };
    const drone = (freq, gain, type = 'sine') => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = gain;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.1;
      const lg = ctx.createGain(); lg.gain.value = gain * 0.6;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(out); o.start(); lfo.start();
      nodes.push(o, lfo);
    };
    const every = (min, max, fn) => {
      const tick = () => {
        if (!this.muted) fn();
        timers.push(setTimeout(tick, (min + Math.random() * (max - min)) * 1000));
      };
      timers.push(setTimeout(tick, (min * 0.5 + Math.random() * max * 0.5) * 1000));
    };
    const chirp = () => {
      const base = 2200 + Math.random() * 1800;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.tone(base, 0.07, { type: 'sine', gain: 0.05, freqEnd: base * (1.2 + Math.random() * 0.4), delay: i * 0.1, dest: out });
    };
    switch (theme) {
      case 'meadow':
      case 'farm':
        loopNoise('lowpass', 500, 0.05, 0.08, 0.7);
        every(2, 6, chirp);
        break;
      case 'pirate':
        loopNoise('lowpass', 700, 0.12, 0.12, 0.9);
        every(5, 10, () => { const f = 1100 + Math.random() * 300; this.tone(f, 0.25, { type: 'sine', gain: 0.04, freqEnd: f * 0.7, dest: out }); this.tone(f * 0.9, 0.25, { type: 'sine', gain: 0.03, freqEnd: f * 0.6, delay: 0.3, dest: out }); });
        break;
      case 'carnival': {
        loopNoise('bandpass', 900, 0.03, 0.2, 0.4);
        // gentle calliope loop
        const notes = [67, 71, 74, 71, 67, 71, 74, 79, 76, 72, 69, 72, 76, 74, 71, 67];
        let i = 0;
        every(0.3, 0.3, () => { const n = notes[i++ % notes.length]; this.tone(440 * Math.pow(2, (n - 69) / 12), 0.28, { type: 'triangle', gain: 0.03, dest: out }); });
        break;
      }
      case 'ice':
        loopNoise('bandpass', 1200, 0.06, 0.06, 0.8, 0.5);
        every(4, 9, () => { const f = 3000 + Math.random() * 2000; this.tone(f, 0.4, { type: 'sine', gain: 0.02, dest: out }); });
        break;
      case 'jungle':
        loopNoise('bandpass', 4500, 0.02, 3, 0.4, 2);
        loopNoise('lowpass', 400, 0.04, 0.05, 0.5);
        every(1.5, 4, chirp);
        every(6, 12, () => { const f = 500 + Math.random() * 200; this.tone(f, 0.3, { type: 'sine', gain: 0.04, freqEnd: f * 1.5, dest: out }); });
        break;
      case 'factory':
        drone(55, 0.04, 'sawtooth');
        every(1.2, 1.2, () => this.tone(120, 0.12, { type: 'square', gain: 0.025, freqEnd: 60, dest: out }));
        every(3, 7, () => this.noise(0.6, { type: 'highpass', freq: 3000, gain: 0.03, attack: 0.05, dest: out }));
        break;
      case 'space':
        drone(65.4, 0.05); drone(98, 0.03); drone(130.8, 0.02, 'triangle');
        every(3, 6, () => { const f = 1200 + Math.random() * 1500; this.tone(f, 1.2, { type: 'sine', gain: 0.02, freqEnd: f * 1.01, attack: 0.3, dest: out }); });
        break;
      case 'volcano':
        loopNoise('lowpass', 120, 0.2, 0.07, 0.8);
        loopNoise('bandpass', 2500, 0.015, 2, 0.8, 1);
        every(5, 11, () => this.noise(1.5, { type: 'lowpass', freq: 90, gain: 0.35, attack: 0.3, dest: out }));
        break;
      default:
        loopNoise('lowpass', 500, 0.05, 0.08, 0.7);
    }
    this.ambient = { nodes, timers, out };
  }

  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const { nodes, timers, out } = this.ambient;
    timers.forEach(clearTimeout);
    out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); out.disconnect(); }, 1500);
    this.ambient = null;
  }
}

export const audio = new AudioSystem();
