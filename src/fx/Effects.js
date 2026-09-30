// Pooled CPU particle system (splashes, sparks, confetti, fireworks, dust).
import * as THREE from 'three';

const MAX = 2500;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.baseSize = new Float32Array(MAX);
    this.flutter = new Float32Array(MAX);
    this.shape = new Float32Array(MAX); // 0 = round, 1 = square (confetti)
    this.count = 0;
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float size;
        attribute float alpha;
        attribute float shape;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vShape;
        void main() {
          vColor = color; vAlpha = alpha; vShape = shape;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * uScale / max(0.3, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vShape;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          if (vShape > 0.5) {
            // confetti: a thin fluttering rectangle
            if (abs(c.x) > 0.45 || abs(c.y) > 0.22) discard;
            gl_FragColor = vec4(vColor, vAlpha);
          } else {
            float d = length(c);
            if (d > 0.5) discard;
            gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.3, d));
          }
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  setScale(h) { this.material.uniforms.uScale.value = h * 0.45; }

  emit(p, { count = 20, speed = 2, spread = 1, up = 1, colors = [0xffffff], size = 0.08, life = 1, gravity = 9.8, drag = 1, flutter = 0, dir = null, hdr = 1, square = false } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.count >= MAX) this._removeOldest();
      const k = this.count++;
      this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z;
      let vx = (Math.random() - 0.5) * 2, vy = (Math.random() - 0.5) * 2, vz = (Math.random() - 0.5) * 2;
      if (dir) { vx = dir.x + vx * spread; vy = dir.y + vy * spread; vz = dir.z + vz * spread; }
      else { vx *= spread; vz *= spread; vy = Math.abs(vy) * up + (1 - spread) * 0.2; }
      const l = Math.hypot(vx, vy, vz) || 1;
      const s = speed * (0.5 + Math.random() * 0.7);
      this.vel[k * 3] = (vx / l) * s; this.vel[k * 3 + 1] = (vy / l) * s; this.vel[k * 3 + 2] = (vz / l) * s;
      this._c.set(colors[Math.floor(Math.random() * colors.length)]).multiplyScalar(hdr);
      this.col[k * 3] = this._c.r; this.col[k * 3 + 1] = this._c.g; this.col[k * 3 + 2] = this._c.b;
      this.baseSize[k] = size * (0.6 + Math.random() * 0.8);
      this.maxLife[k] = life * (0.6 + Math.random() * 0.6);
      this.life[k] = this.maxLife[k];
      this.grav[k] = gravity;
      this.drag[k] = drag;
      this.flutter[k] = flutter;
      this.shape[k] = square ? 1 : 0;
    }
  }

  _removeOldest() {
    // overwrite the particle with the least life left
    let best = 0, bl = Infinity;
    for (let i = 0; i < this.count; i++) if (this.life[i] < bl) { bl = this.life[i]; best = i; }
    this._kill(best);
  }

  _kill(i) {
    const j = --this.count;
    if (i === j) return;
    for (const [arr, n] of [[this.pos, 3], [this.col, 3], [this.vel, 3]]) for (let k = 0; k < n; k++) arr[i * n + k] = arr[j * n + k];
    for (const arr of [this.life, this.maxLife, this.drag, this.grav, this.baseSize, this.flutter, this.size, this.alpha, this.shape]) arr[i] = arr[j];
  }

  update(dt, t) {
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      if (this.flutter[i] > 0) {
        this.vel[i * 3] += Math.sin(t * 7 + i) * this.flutter[i] * dt;
        this.vel[i * 3 + 2] += Math.cos(t * 5 + i * 1.3) * this.flutter[i] * dt;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, k * 2.5);
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * Math.min(1, k * 1.5));
    }
    this.geo.setDrawRange(0, this.count);
    for (const n of ['position', 'color', 'size', 'alpha', 'shape']) this.geo.attributes[n].needsUpdate = true;
  }

  clear() { this.count = 0; this.geo.setDrawRange(0, 0); }

  // ---- presets ----
  splash(p) {
    this.emit(p, { count: 60, speed: 3.5, spread: 0.5, up: 1.5, colors: [0xffffff, 0xbfe9ff, 0x7fd3ff], size: 0.09, life: 1.0, gravity: 9.8, drag: 0.5 });
    this.emit(p, { count: 25, speed: 1.2, spread: 1, up: 0.3, colors: [0xffffff], size: 0.14, life: 0.6, gravity: 0, drag: 3 });
  }
  lava(p) {
    this.emit(p, { count: 60, speed: 4, spread: 0.5, up: 1.6, colors: [0xffd54f, 0xff8f00, 0xff3d00], size: 0.08, life: 1.2, gravity: 7, drag: 0.4, hdr: 3 });
    this.emit(p, { count: 30, speed: 0.8, spread: 1, up: 1, colors: [0x555555, 0x333333], size: 0.25, life: 1.5, gravity: -1.5, drag: 1 });
  }
  dust(p, color = 0xdddddd) {
    this.emit(p, { count: 10, speed: 0.8, spread: 1, up: 0.3, colors: [color], size: 0.1, life: 0.5, gravity: 0, drag: 3 });
  }
  sparks(p, colors = [0xfff176, 0xffffff, 0x80deea]) {
    this.emit(p, { count: 18, speed: 3, spread: 1, up: 1, colors, size: 0.06, life: 0.4, gravity: 4, drag: 2, hdr: 2.5 });
  }
  confetti(p, count = 150) {
    this.emit(p, { count, speed: 5, spread: 0.6, up: 2, colors: [0xff5252, 0xffd740, 0x69f0ae, 0x40c4ff, 0xe040fb, 0xffffff], size: 0.11, life: 3.2, gravity: 3, drag: 1.4, flutter: 4, square: true });
  }
  trail(p) {
    this.emit(p, { count: 1, speed: 0.05, spread: 1, up: 0.2, colors: [0xffffff], size: 0.07, life: 0.35, gravity: 0, drag: 4 });
  }
  firework(p) {
    const palettes = [[0xff5252, 0xffab40], [0x69f0ae, 0xb2ff59], [0x40c4ff, 0xe040fb], [0xffd740, 0xffffff]];
    const colors = palettes[Math.floor(Math.random() * palettes.length)];
    this.emit(p, { count: 90, speed: 5, spread: 1, up: 1, colors, size: 0.13, life: 1.4, gravity: 2.5, drag: 1.3, hdr: 3, dir: new THREE.Vector3(0, 0, 0) });
  }
  portal(p) {
    this.emit(p, { count: 40, speed: 2, spread: 1, up: 1, colors: [0xb388ff, 0x40c4ff, 0xffffff], size: 0.08, life: 0.8, gravity: -1, drag: 2, hdr: 2.5 });
  }
  cupSparkle(p) {
    this.emit(p, { count: 40, speed: 2.4, spread: 0.3, up: 2.5, colors: [0xffd740, 0xffffff, 0xfff59d], size: 0.07, life: 1.2, gravity: 3, drag: 1.2, hdr: 2.5 });
  }
}
