// WebGL renderer + post-processing (MSAA, bloom, tone mapping) with adaptive quality.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const LEVELS = {
  high: { ratio: 2, samples: 4, bloom: true, shadow: 2048 },
  medium: { ratio: 1.25, samples: 4, bloom: true, shadow: 2048 },
  low: { ratio: 1, samples: 2, bloom: false, shadow: 1024 },
  potato: { ratio: 0.75, samples: 0, bloom: false, shadow: 1024 },
};
const ORDER = ['high', 'medium', 'low', 'potato'];

export class Renderer {
  constructor(canvas, quality = 'auto') {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setClearColor(0x87ceeb, 1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;
    this.auto = quality === 'auto';
    this.level = this.auto ? Renderer.autoStart() : quality;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.frameTimes = [];
    this.lastDrop = performance.now();
    this.onLevelChange = null;
    this._build();
  }

  _build() {
    const cfg = LEVELS[this.level];
    const dpr = Math.min(window.devicePixelRatio || 1, cfg.ratio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.bloomPass?.dispose();
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: cfg.samples });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.width, this.height);
    this.renderPass = new RenderPass(null, null);
    this.composer.addPass(this.renderPass);
    if (cfg.bloom) {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width / 2, this.height / 2), 0.55, 0.45, 1.4);
      this.composer.addPass(this.bloomPass);
    } else this.bloomPass = null;
    this.composer.addPass(new OutputPass());
    this.shadowSize = cfg.shadow;
  }

  // High-DPI screens start at medium (1.25x) — full-res MSAA + bloom is costly on laptops.
  static autoStart() {
    return (window.devicePixelRatio || 1) > 1.3 ? 'medium' : 'high';
  }

  setQuality(q) {
    this.auto = q === 'auto';
    const lvl = this.auto ? Renderer.autoStart() : q;
    if (lvl !== this.level) { this.level = lvl; this._build(); this.onLevelChange?.(this.level); }
    this.frameTimes = [];
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
  }

  render(scene, camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }

  // Track frame times and step quality down when the frame rate is too low.
  trackFrame(dt) {
    if (!this.auto) return;
    if (document.hidden) { this.frameTimes = []; return; }
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 150) return;
    const sorted = this.frameTimes.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.frameTimes = [];
    const now = performance.now();
    if (median > 1 / 50 && now - this.lastDrop > 2500) {
      const i = ORDER.indexOf(this.level);
      if (i < ORDER.length - 1) {
        this.level = ORDER[i + 1];
        this.lastDrop = now;
        this._build();
        this.onLevelChange?.(this.level);
      }
    }
  }
}
