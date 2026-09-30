// Game controller: state machine, input, scoring, hole loading and rendering.
import * as THREE from 'three';
import { Renderer } from '../engine/Renderer.js';
import { globalUniforms, toon, addOutline, glow } from '../engine/materials.js';
import { createSky } from '../engine/shaders.js';
import { Builder } from '../course/Builder.js';
import { BALL_RADIUS } from '../physics/Physics.js';
import { Effects } from '../fx/Effects.js';
import { audio } from '../audio/Audio.js';
import { storage } from './Storage.js';
import { UI, scoreName, relText } from '../ui/UI.js';
import { CameraRig } from './CameraRig.js';
import { HOLES } from '../holes/index.js';

const MAX_STROKES = 10;
const MAX_SPEED = 10.5;
const UP = new THREE.Vector3(0, 1, 0);

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas, storage.getQuality());
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 900);
    this.rig = new CameraRig(this.camera);
    this.ui = new UI();
    this.effects = new Effects(this.scene);
    this.effects.setScale(window.innerHeight);

    this.state = 'loading';
    this.mode = 'round';
    this.holeIndex = 0;
    this.scores = new Array(HOLES.length).fill(null);
    this.strokes = 0;
    this.yaw = 0;
    this.power = 0;
    this.dragAcc = 0;
    this.lastPos = new THREE.Vector3();
    this.hole = null;
    this.world = null;
    this.paused = false;
    this.pointerLocked = false;
    this.lockDenied = false;
    this.keys = {};
    this.stateTime = 0;
    this.stopTimer = 0;
    this.rollTime = 0;
    this.overview = false;
    this.elapsed = 0;
    this.introSeen = new Set();

    this.setupScene();
    this.setupBall();
    this.setupInput();
    this.setupUI();

    window.addEventListener('resize', () => this.onResize());
    this.renderer.onLevelChange = () => { this.applyShadowSize(); };
    this.clock = new THREE.Timer();
    this.clock.connect(document);
  }

  // ---------------------------------------------------------------------------
  // setup

  setupScene() {
    this.sky = createSky();
    this.scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a8f4e, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.applyShadowSize();
    this.scene.fog = new THREE.Fog(0xbfe6ff, 40, 160);
  }

  applyShadowSize() {
    const s = this.renderer.shadowSize || 2048;
    if (this.sun.shadow.mapSize.x !== s) {
      this.sun.shadow.mapSize.set(s, s);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }

  setupBall() {
    const g = new THREE.SphereGeometry(BALL_RADIUS, 24, 16);
    this.ballMesh = new THREE.Mesh(g, toon(0xffffff, { steps: 3, rim: 0.5 }));
    this.ballMesh.castShadow = true;
    addOutline(this.ballMesh, { width: 1.2 });
    // a painted stripe so rolling is visible
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS * 0.99, BALL_RADIUS * 0.06, 6, 32), toon(0xff5a5a));
    this.ballMesh.add(stripe);
    this.scene.add(this.ballMesh);

    // marker ring under the ball while aiming
    const rg = new THREE.RingGeometry(BALL_RADIUS * 1.6, BALL_RADIUS * 2.1, 32);
    rg.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);

    // aim guide dots
    const dg = new THREE.CircleGeometry(0.035, 12);
    dg.rotateX(-Math.PI / 2);
    this.aimDots = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), 40);
    this.aimDots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3), 3);
    this.aimDots.frustumCulled = false;
    this.aimDots.renderOrder = 4;
    this.scene.add(this.aimDots);
    const ag = new THREE.ConeGeometry(0.07, 0.16, 3);
    ag.rotateX(-Math.PI / 2);
    this.aimArrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    this.aimArrow.renderOrder = 4;
    this.scene.add(this.aimArrow);

    // putter
    const putter = new THREE.Group();
    const shaftGroup = new THREE.Group();
    shaftGroup.position.set(0.07, 0.05, 0);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.9, 8), toon(0xc9ced6));
    shaft.position.set(0, 0.45, 0);
    shaftGroup.add(shaft);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.017, 0.25, 8), toon(0x2b2b38));
    grip.position.set(0, 0.82, 0);
    shaftGroup.add(grip);
    putter.add(shaftGroup);
    this.shaftGroup = shaftGroup;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), toon(0x38b6ff));
    head.position.set(0, 0.025, 0);
    putter.add(head);
    addOutline(head, { width: 0.8 });
    addOutline(shaft, { width: 0.6 });
    putter.traverse((m) => { if (m.isMesh && m.name !== 'outline') m.castShadow = true; });
    this.putterPivot = new THREE.Group();
    this.putterPivot.add(putter);
    this.putter = putter;
    this.scene.add(this.putterPivot);
    this.putterSwing = 0;
    this.putterVisible = 0;
    this.putterBase = null;
  }

  setupUI() {
    const ui = this.ui;
    ui.setMuted(audio.muted);
    ui.setBestRound(storage.getBestRound(), HOLES.reduce((a, h) => a + h.par, 0));
    ui.on('play', () => { this.gesture(); audio.click(); this.startRound(); });
    ui.on('showPractice', () => {
      this.gesture(); audio.click();
      ui.renderHoleGrid(HOLES, (i) => { audio.click(); this.startPractice(i); }, {
        title: 'Choose a Hole',
        sub: 'Play any hole on its own — you can carry on to the next one afterwards.',
      });
      ui.showScreen('practice');
    });
    ui.on('showHoles', () => {
      audio.click();
      const round = this.mode === 'round';
      ui.renderHoleGrid(HOLES, (i) => { audio.click(); this.jumpToHole(i); }, {
        title: 'Jump to Hole',
        sub: round ? 'Your round continues from the hole you pick — scores so far are kept.' : 'Switch to any hole.',
        current: this.holeIndex,
        scores: round ? this.scores : null,
      });
      ui.showScreen('practice');
    });
    ui.on('showHowto', () => { this.gesture(); audio.click(); ui.showScreen('howto'); });
    ui.on('back', () => { audio.click(); ui.showScreen(this.paused ? 'pause' : 'menu'); });
    ui.on('resume', () => { audio.click(); this.resume(); });
    ui.on('restart', () => { this.gesture(); audio.click(); this.restartHole(); });
    ui.on('pauseCard', () => {
      audio.click();
      ui.renderScorecard({
        holes: HOLES, scores: this.scores, current: this.holeIndex, title: 'Scorecard',
        buttons: [{ label: 'Back', primary: true, action: () => { audio.click(); ui.showScreen('pause'); } }],
      });
    });
    ui.on('menu', () => { audio.click(); this.toMenu(); });
    ui.on('toggleSound', () => { this.gesture(); this.toggleMute(); });
    ui.on('toggleView', () => { audio.click(); this.toggleOverview(); });
    ui.on('pause', () => { audio.click(); this.pause(); });
    ui.on('quality', (q) => { storage.setQuality(q); this.renderer.setQuality(q); this.applyShadowSize(); });
  }

  gesture() { audio.init(); }

  toggleMute() {
    audio.setMuted(!audio.muted);
    this.ui.setMuted(audio.muted);
    if (!audio.muted) audio.click();
  }

  setupInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.rig.zoom = THREE.MathUtils.clamp(this.rig.zoom + Math.sign(e.deltaY) * 0.25, 0.9, 4.5);
    }, { passive: false });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === c;
      this.pointerLocked = locked;
      if (locked) this.lockEverSucceeded = true;
      if (!locked && ['aim', 'power', 'rolling'].includes(this.state) && !this.paused && !this.suppressUnlockPause) {
        this.pause();
      }
      this.suppressUnlockPause = false;
      this.updateLockHint();
    });
    // Only fall back to unlocked aiming if pointer lock has never worked here (e.g. embedded
    // browsers). Browsers briefly refuse re-locking right after Esc; the next click retries.
    document.addEventListener('pointerlockerror', () => { if (!this.lockEverSucceeded) this.lockDenied = true; this.updateLockHint(); });
    // touch: drag to aim, second finger/long drag down for power (basic support)
    let touchStart = null;
    c.addEventListener('touchstart', (e) => {
      this.gesture();
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, lastX: t.clientX, lastY: t.clientY, powering: t.clientY > window.innerHeight * 0.55 };
      if (this.state === 'intro') { this.skipIntro(); return; }
      if (this.state === 'aim' && touchStart.powering) { this.beginPower(); }
      e.preventDefault();
    }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      if (!touchStart) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStart.lastX, dy = t.clientY - touchStart.lastY;
      touchStart.lastX = t.clientX; touchStart.lastY = t.clientY;
      if (this.state === 'aim') this.yaw += dx * 0.006;
      else if (this.state === 'power') this.addPower(dy * 1.6);
      e.preventDefault();
    }, { passive: false });
    c.addEventListener('touchend', () => {
      if (this.state === 'power') this.releasePower();
      touchStart = null;
    });
  }

  requestLock() {
    if (this.lockDenied || this.pointerLocked || !this.canvas.requestPointerLock) return false;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { if (!this.lockEverSucceeded) this.lockDenied = true; this.updateLockHint(); });
    } catch (e) {
      if (!this.lockEverSucceeded) this.lockDenied = true;
    }
    return true;
  }

  exitLock() {
    if (document.pointerLockElement) { this.suppressUnlockPause = true; document.exitPointerLock(); }
  }

  updateLockHint() {
    const show = this.state === 'aim' && !this.pointerLocked && !this.lockDenied && !this.paused;
    this.ui.setLockHint(show);
    if (this.state === 'aim') this.ui.setHint(this.aimHint());
  }

  aimHint() {
    if (this.pointerLocked || this.lockDenied) return 'Move mouse to aim · click & drag back to putt · V overview · scroll to zoom';
    return 'Click to take control, then move the mouse to aim';
  }

  onMouseDown(e) {
    this.gesture();
    this.canvas.focus();
    if (this.state === 'intro') { this.skipIntro(); if (!this.pointerLocked) this.requestLock(); return; }
    if (this.state === 'holed' && this.stateTime > 0.8) { this.finishHole(); return; }
    if (this.state !== 'aim') {
      if (e.button === 2 && this.state === 'power') this.cancelPower();
      return;
    }
    if (e.button !== 0) return;
    if (!this.pointerLocked && !this.lockDenied) {
      this.requestLock();
      return;
    }
    this.beginPower();
  }

  onMouseUp(e) {
    if (e.button === 0 && this.state === 'power') this.releasePower();
  }

  onMouseMove(e) {
    const dx = e.movementX || 0, dy = e.movementY || 0;
    if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return; // ignore spikes on lock changes
    const sens = storage.getSensitivity();
    if (this.state === 'aim' && (this.pointerLocked || this.lockDenied)) {
      const fine = this.keys.ShiftLeft || this.keys.ShiftRight ? 0.25 : 1;
      this.yaw += dx * 0.0022 * sens * fine;
    } else if (this.state === 'power') {
      this.addPower(dy);
    }
  }

  onKey(e, down) {
    const k = e.code;
    this.keys[k] = down;
    if (!down) {
      if (k === 'Space' && this.state === 'power' && this.keyPower) { this.releasePower(); this.keyPower = false; }
      return;
    }
    if (e.repeat) return;
    this.gesture();
    if (k === 'Space') {
      e.preventDefault();
      if (this.state === 'intro') this.skipIntro();
      else if (this.state === 'holed' && this.stateTime > 0.8) this.finishHole();
      else if (this.state === 'aim') { this.beginPower(); this.keyPower = true; }
    } else if (k === 'KeyR') {
      if (['aim', 'power', 'rolling', 'intro', 'hazard'].includes(this.state) || this.paused) this.restartHole();
    } else if (k === 'KeyM') {
      this.toggleMute();
    } else if (k === 'KeyV') {
      this.toggleOverview();
    } else if (k === 'KeyP' || k === 'Escape') {
      if (this.state === 'power') { this.cancelPower(); return; }
      if (this.paused) this.resume(); else if (['aim', 'rolling', 'intro', 'hazard'].includes(this.state)) this.pause();
    }
  }

  // ---------------------------------------------------------------------------
  // power / shooting

  beginPower() {
    if (this.state !== 'aim') return;
    this.setState('power');
    this.dragAcc = 0;
    this.power = 0;
    this.ui.setPower(0);
    this.ui.setHint('Drag back to set power · release to putt · right-click to cancel');
  }

  addPower(dy) {
    this.dragAcc = Math.max(-40, this.dragAcc + dy);
    this.power = THREE.MathUtils.clamp(this.dragAcc / 260, 0, 1);
    this.ui.setPower(this.power);
  }

  cancelPower() {
    this.power = 0;
    this.ui.setPower(null);
    this.setState('aim');
  }

  releasePower() {
    if (this.state !== 'power') return;
    if (this.power < 0.02) { this.cancelPower(); return; }
    this.shoot(this.power);
  }

  shoot(power) {
    const speed = Math.max(0.35, MAX_SPEED * Math.pow(power, 1.3));
    const b = this.world.ball;
    this.lastPos.copy(b.pos);
    this.strokes++;
    this.updateHud();
    this.world.shoot(Math.sin(this.yaw), -Math.cos(this.yaw), speed);
    audio.putt(power);
    this.putterSwing = 1;
    this.putterBase = b.pos.clone();
    this.putterYaw = this.yaw;
    this.ui.setPower(null);
    this.ui.setHint(null);
    this.rig.followDir.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.setState('rolling');
  }

  // ---------------------------------------------------------------------------
  // flow

  async loadHole(index) {
    this.setState('loading');
    this.ui.showScreen('loading');
    // let the loading screen paint (setTimeout, not rAF, so hidden tabs don't stall)
    await new Promise((r) => setTimeout(r, 40));
    if (this.hole) {
      this.scene.remove(this.hole.group);
      this.hole.group.traverse((o) => {
        if (o.geometry && o.name !== 'outline') o.geometry.dispose();
        if (o.isPointLight || o.isSpotLight) o.dispose?.();
      });
      for (const d of this.hole.disposables) d.dispose?.();
    }
    this.effects.clear();
    const def = HOLES[index];
    const b = new Builder({ visual: true });
    def.build(b);
    b.finalize();
    this.hole = b;
    this.def = def;
    this.world = b.world;
    this.holeIndex = index;
    this.scene.add(b.group);
    this.applyEnv(def.env || {});
    this.preparePath();
    this.resetBall();
    // warm up shaders to avoid hitches
    try {
      await Promise.race([
        this.renderer.renderer.compileAsync(this.scene, this.camera),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* not critical */ }
  }

  resetBall() {
    const b = this.hole;
    this.world.placeBall(b.tee.pos.clone().add(new THREE.Vector3(0, BALL_RADIUS, 0)));
    this.world.events.length = 0;
    this.lastPos.copy(this.world.ball.pos);
    this.yaw = b.tee.yaw;
    this.ballMesh.position.copy(this.world.ball.pos);
    this.ballMesh.visible = true;
    if (b.flag) b.flag.target = 0;
    this.effects.clear();
  }

  applyEnv(env) {
    const sky = env.sky || {};
    const u = this.sky.material.uniforms;
    const set = (name, v, def) => { if (u[name].value.set) u[name].value.set(v ?? def); else u[name].value = v ?? def; };
    set('uTop', sky.top, 0x3f8fe8);
    set('uHorizon', sky.horizon, 0xbfe6ff);
    set('uBottom', sky.bottom, 0x8fc4e8);
    u.uSunDir.value.set(...(sky.sunDir || env.sunDir || [0.4, 0.55, -0.6])).normalize();
    set('uSunColor', sky.sunColor, 0xfff3c4);
    set('uCloudColor', sky.cloudColor, 0xffffff);
    set('uCloudShade', sky.cloudShade, 0xc9dcf0);
    u.uCloud.value = sky.clouds ?? 0.5;
    u.uStars.value = sky.stars ?? 0;
    u.uAurora.value = sky.aurora ?? 0;
    u.uNebula.value = sky.nebula ?? 0;
    u.uSunSize.value = sky.sunSize ?? 1;
    const fog = env.fog || {};
    this.scene.fog.color.set(fog.color ?? sky.horizon ?? 0xbfe6ff);
    this.scene.fog.near = fog.near ?? 45;
    this.scene.fog.far = fog.far ?? 180;
    const hemi = env.hemi || {};
    this.hemi.color.set(hemi.sky ?? 0xcfe8ff);
    this.hemi.groundColor.set(hemi.ground ?? 0x6a8f4e);
    this.hemi.intensity = hemi.intensity ?? 1.1;
    const sun = env.sun || {};
    this.sun.color.set(sun.color ?? 0xffffff);
    this.sun.intensity = sun.intensity ?? 2.4;
    this.renderer.renderer.toneMappingExposure = env.exposure ?? 1.0;
    if (this.renderer.bloomPass) this.renderer.bloomPass.strength = env.bloom ?? 0.55;
    // fit the shadow camera around the hole
    const box = this.hole.bounds;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dir = new THREE.Vector3(...(sun.dir || sky.sunDir || [0.4, 0.55, -0.6])).normalize();
    if (dir.y < 0.35) dir.y = 0.35;
    dir.normalize();
    const radius = Math.max(size.x, size.z) * 0.62 + 3;
    this.sun.position.copy(center).addScaledVector(dir, radius + 20);
    this.sun.target.position.copy(center);
    const sc = this.sun.shadow.camera;
    sc.left = -radius; sc.right = radius; sc.top = radius; sc.bottom = -radius;
    sc.near = 1; sc.far = radius * 2 + 45;
    sc.updateProjectionMatrix();
    this.renderer.renderer.shadowMap.needsUpdate = true;
    this.holeCenter = center;
    this.holeRadius = radius;
    // overview framing
    const ovDir = new THREE.Vector3(Math.sin(this.hole.tee.yaw), 0, -Math.cos(this.hole.tee.yaw));
    const span = Math.max(size.x, size.z);
    this.rig.overview = {
      pos: center.clone().addScaledVector(ovDir, -span * 0.35).add(new THREE.Vector3(0, span * 0.85 + 4, 0)),
      look: center.clone().addScaledVector(ovDir, span * 0.05),
    };
    this.rig.heightAt = (x, z, fromY) => this.world.heightAt(x, z, fromY);
  }

  preparePath() {
    const b = this.hole;
    let pts = b.path.length ? b.path.map((p) => p.clone()) : [b.tee.pos.clone(), new THREE.Vector3(b.cupInfo.x, b.cupInfo.y, b.cupInfo.z)];
    this.path = pts;
    this.pathArc = [0];
    for (let i = 1; i < pts.length; i++) this.pathArc.push(this.pathArc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }

  closestArc(p) {
    let best = Infinity, bestS = 0;
    const pts = this.path;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ab = tmp.subVectors(b, a);
      const l2 = ab.lengthSq();
      let t = l2 > 0 ? ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / l2 : 0;
      t = THREE.MathUtils.clamp(t, 0, 1);
      const q = a.clone().addScaledVector(ab, t);
      const dy = (p.y - q.y) * 2.5;
      const d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2 + dy * dy;
      if (d < best) { best = d; bestS = this.pathArc[i] + Math.sqrt(l2) * t; }
    }
    return bestS;
  }

  pointAtArc(s) {
    const pts = this.path, arc = this.pathArc;
    if (s <= 0) return pts[0].clone();
    for (let i = 0; i < pts.length - 1; i++) {
      if (s <= arc[i + 1]) {
        const t = (s - arc[i]) / Math.max(1e-6, arc[i + 1] - arc[i]);
        return pts[i].clone().lerp(pts[i + 1], t);
      }
    }
    return pts[pts.length - 1].clone();
  }

  defaultYaw() {
    const p = this.world.ball.pos;
    const cup = this.hole.cupInfo;
    const toCup = new THREE.Vector3(cup.x - p.x, 0, cup.z - p.z);
    let target;
    if (toCup.length() < 4 && Math.abs(cup.y - (p.y - BALL_RADIUS)) < 0.3) target = new THREE.Vector3(cup.x, cup.y, cup.z);
    else target = this.pointAtArc(this.closestArc(p) + 2.5);
    const dx = target.x - p.x, dz = target.z - p.z;
    if (dx * dx + dz * dz < 1e-4) return this.yaw;
    return Math.atan2(dx, -dz);
  }

  startRound() {
    this.mode = 'round';
    this.scores = new Array(HOLES.length).fill(null);
    this.beginHole(0);
  }

  startPractice(i) {
    this.mode = 'practice';
    this.scores = new Array(HOLES.length).fill(null);
    this.beginHole(i);
  }

  // From the pause menu: go straight to another hole. In a round the scorecard is
  // kept (the abandoned hole stays unscored and can be replayed later).
  jumpToHole(i) {
    this.paused = false;
    if (this.mode === 'round') this.scores[i] = null;
    this.beginHole(i);
  }

  async beginHole(index, { intro = true } = {}) {
    const token = (this.loadToken = (this.loadToken || 0) + 1);
    this.paused = false;
    this.overview = false;
    this.ui.setViewActive(false);
    this.ui.hideCelebrate();
    this.ui.hideToast();
    this.ui.setPower(null);
    this.ui.setHint(null);
    this.ui.setLockHint(false);
    if (this.hole && this.holeIndex === index) this.resetBall();
    else await this.loadHole(index);
    if (token !== this.loadToken) return; // a newer request superseded this one
    this.strokes = 0;
    this.ui.showScreen(null);
    this.ui.showHud(true);
    this.updateHud();
    audio.startAmbient(this.def.theme);
    if (intro) this.startIntro(); else this.enterAim(true);
  }

  startIntro() {
    this.setState('intro');
    this.ui.showBanner(this.holeIndex, this.def);
    const len = this.pathArc[this.pathArc.length - 1];
    const duration = THREE.MathUtils.clamp(3.0 + len * 0.16, 4.5, 7.5);
    this.rig.startFlyover(this.path, this.world.ball.pos, this.yaw, duration);
    this.rig.snapNext = true;
    audio.whoosh();
  }

  skipIntro() {
    if (this.state !== 'intro') return;
    this.ui.hideBanner();
    this.enterAim(false);
  }

  enterAim(snap) {
    this.setState('aim');
    this.rig.mode = this.overview ? 'overview' : 'aim';
    if (snap) this.rig.snapNext = true;
    this.updateLockHint();
  }

  restartHole() {
    if (this.state === 'loading') return;
    this.paused = false;
    this.ui.showScreen(null);
    this.ui.hideCelebrate();
    this.ui.hideToast();
    this.ui.setPower(null);
    this.effects.clear();
    this.strokes = 0;
    this.updateHud();
    this.resetBall();
    this.startIntro();
  }

  toMenu() {
    this.paused = false;
    this.exitLock();
    this.setState('menu');
    this.ui.showHud(false);
    this.ui.setHint(null);
    this.ui.setPower(null);
    this.ui.setLockHint(false);
    this.ui.hideBanner();
    this.ui.hideCelebrate();
    this.ui.hideToast();
    this.ui.setBestRound(storage.getBestRound(), HOLES.reduce((a, h) => a + h.par, 0));
    this.ui.showScreen('menu');
    this.setMenuCamera();
    audio.startAmbient(this.def ? this.def.theme : 'meadow');
  }

  setMenuCamera() {
    this.rig.mode = 'orbit';
    this.rig.orbitCenter.copy(this.holeCenter);
    this.rig.orbitRadius = this.holeRadius * 0.75 + 3;
    this.rig.orbitHeight = this.holeRadius * 0.38 + 2.2;
  }

  pause() {
    if (this.paused || ['menu', 'loading', 'scorecard', 'final', 'holed'].includes(this.state)) return;
    if (this.state === 'power') this.cancelPower();
    this.paused = true;
    this.exitLock();
    this.ui.setLockHint(false);
    this.ui.showScreen('pause');
  }

  resume() {
    this.paused = false;
    this.ui.showScreen(null);
    if (this.state === 'aim' || this.state === 'rolling') this.requestLock();
    this.updateLockHint();
  }

  toggleOverview() {
    if (!['aim', 'power', 'rolling'].includes(this.state)) return;
    this.overview = !this.overview;
    this.ui.setViewActive(this.overview);
    if (this.state === 'aim' || this.state === 'power') this.rig.mode = this.overview ? 'overview' : 'aim';
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.updateLockHint();
  }

  updateHud() {
    const played = this.scores.map((s, i) => (s != null ? i : -1)).filter((i) => i >= 0);
    const rel = played.reduce((a, i) => a + this.scores[i] - HOLES[i].par, 0);
    this.ui.setHud({
      index: this.holeIndex, name: this.def ? this.def.name : '', par: this.def ? this.def.par : 0,
      strokes: this.strokes, total: `Total ${relText(rel)}`,
    });
  }

  // ---------------------------------------------------------------------------
  // events

  handleEvents() {
    const w = this.world;
    for (const e of w.events) {
      switch (e.type) {
        case 'hit':
          audio.hit(e.speed, e.sound);
          if (e.kick) { this.effects.sparks(e.pos); this.rig.shake = Math.min(1, this.rig.shake + 0.3); }
          else if (e.speed > 2) this.effects.dust(e.pos, 0xffffff);
          break;
        case 'land':
          audio.land(e.speed);
          this.effects.dust(e.pos, 0xe8e0d0);
          break;
        case 'lip':
          audio.lip();
          break;
        case 'portal':
          audio.portal();
          this.effects.portal(e.zone.from);
          this.effects.portal(e.zone.to);
          break;
        case 'hazard':
          this.onHazard(e.kind, e.pos);
          break;
        case 'holed':
          this.onHoled();
          break;
        case 'sound':
          if (audio[e.name]) audio[e.name](...(e.args || []));
          break;
        case 'shake':
          this.rig.shake = Math.min(1.2, this.rig.shake + (e.amount || 0.5));
          break;
        default:
      }
    }
    w.events.length = 0;
  }

  onHazard(kind, pos) {
    if (this.state === 'holed') return;
    this.setState('hazard');
    this.ui.setPower(null);
    this.ballMesh.visible = kind === 'ob';
    let msg = this.def.obMessage || 'Out of Bounds!';
    if (kind === 'water') { audio.splash(); this.effects.splash(pos); msg = 'Splash!'; }
    else if (kind === 'lava') { audio.sizzle(); this.effects.lava(pos); msg = 'Toasted!'; this.rig.shake = 0.6; }
    else { audio.outOfBounds(); this.effects.dust(pos); }
    this.strokes = Math.min(MAX_STROKES, this.strokes + 1);
    this.updateHud();
    setTimeout(() => audio.penalty(), 350);
    const capped = this.strokes >= MAX_STROKES;
    this.ui.toast(msg, capped ? 'Stroke limit reached' : '+1 stroke penalty', 1700);
    this.hazardCapped = capped;
  }

  onHoled() {
    if (this.state === 'holed') return;
    this.setState('holed');
    this.ui.setPower(null);
    this.ui.setHint(null);
    audio.cup();
    const cup = this.hole.cupInfo;
    const cp = new THREE.Vector3(cup.x, cup.y + 0.05, cup.z);
    this.effects.cupSparkle(cp);
    if (this.hole.flag) this.hole.flag.target = 1;
    const par = this.def.par;
    const s = this.strokes;
    const name = scoreName(s, par);
    const d = s - par;
    let cls = 'small', sound = 'bogey';
    if (s === 1) { cls = 'hio'; sound = 'hio'; }
    else if (d <= -3) { cls = ''; sound = 'albatross'; }
    else if (d === -2) { cls = ''; sound = 'eagle'; }
    else if (d === -1) { cls = ''; sound = 'birdie'; }
    else if (d === 0) { cls = 'small'; sound = 'par'; }
    setTimeout(() => audio.celebrate(sound), 450);
    const sub = s === 1 ? 'Incredible!' : `${s} stroke${s === 1 ? '' : 's'} · par ${par}`;
    setTimeout(() => this.ui.celebrate(name.toUpperCase(), sub, cls, 3400), 250);
    if (s === 1 || d <= -1) {
      const bursts = s === 1 ? 7 : d <= -2 ? 4 : 2;
      for (let i = 0; i < bursts; i++) {
        setTimeout(() => {
          const p = cp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 4));
          this.effects.firework(p);
        }, 400 + i * 380);
      }
      this.effects.confetti(cp.clone().add(new THREE.Vector3(0, 0.3, 0)), s === 1 ? 260 : 140);
    }
    this.rig.mode = 'cup';
    this.rig.orbitAngle = Math.atan2(this.camera.position.z - cup.z, this.camera.position.x - cup.x);
    this.holeScore = s;
  }

  finishHole(score = this.holeScore) {
    if (this.state === 'scorecard') return;
    this.setState('scorecard');
    this.exitLock();
    this.ui.hideCelebrate();
    this.ui.hideToast();
    this.ui.setHint(null);
    this.scores[this.holeIndex] = score;
    const isBest = storage.recordHole(this.holeIndex, score);
    this.updateHud();
    const par = this.def.par;
    const rel = score - par;
    const cls = rel < 0 ? 'good' : rel > 0 ? 'bad' : '';
    let summary = `Hole ${this.holeIndex + 1}: <span class="${cls}">${score} (${scoreName(score, par)})</span>`;
    if (isBest) summary += '<span class="best">New hole best!</span>';
    const last = this.holeIndex === HOLES.length - 1;
    if (this.mode === 'round') {
      // next unplayed hole (holes can be skipped via "Jump to Hole")
      let next = -1;
      for (let k = 1; k <= HOLES.length; k++) {
        const j = (this.holeIndex + k) % HOLES.length;
        if (this.scores[j] == null) { next = j; break; }
      }
      if (next < 0) { this.showFinal(); return; }
      this.ui.renderScorecard({
        holes: HOLES, scores: this.scores, current: this.holeIndex, title: 'Scorecard', summary,
        buttons: [
          { label: 'Replay Hole', action: () => { audio.click(); this.scores[this.holeIndex] = null; this.beginHole(this.holeIndex); } },
          { label: `Hole ${next + 1} ▶`, primary: true, action: () => { audio.click(); this.beginHole(next); } },
        ],
      });
    } else {
      this.ui.renderScorecard({
        holes: HOLES, scores: this.scores, current: this.holeIndex, title: 'Practice', summary,
        buttons: [
          { label: 'Main Menu', action: () => { audio.click(); this.toMenu(); } },
          { label: 'Replay Hole', action: () => { audio.click(); this.beginHole(this.holeIndex); } },
          ...(!last ? [{ label: 'Next Hole ▶', primary: true, action: () => { audio.click(); this.beginHole(this.holeIndex + 1); } }] : []),
        ],
      });
    }
  }

  showFinal() {
    this.setState('final');
    const total = this.scores.reduce((a, b) => a + (b || 0), 0);
    const par = HOLES.reduce((a, h) => a + h.par, 0);
    const { newBestRound } = storage.recordRound(this.scores);
    const rel = total - par;
    const cls = rel < 0 ? 'good' : rel > 0 ? 'bad' : '';
    const hio = this.scores.filter((s) => s === 1).length;
    let summary = `Final score: <span class="${cls}">${total} (${relText(rel)})</span>`;
    if (hio) summary += ` · ${hio} hole${hio > 1 ? 's' : ''} in one!`;
    if (newBestRound) summary += '<span class="best">New best round!</span>';
    const best = storage.getBestRound();
    if (!newBestRound && best != null) summary += `<br><small>Best round: ${best} (${relText(best - par)})</small>`;
    this.ui.renderScorecard({
      holes: HOLES, scores: this.scores, title: 'Final Scorecard', summary,
      buttons: [
        { label: 'Main Menu', action: () => { audio.click(); this.toMenu(); } },
        { label: 'Play Again', primary: true, action: () => { audio.click(); this.startRound(); } },
      ],
    });
    if (rel <= 0) {
      audio.celebrate(rel < 0 ? 'eagle' : 'par');
      for (let i = 0; i < 5; i++) setTimeout(() => this.effects.firework(this.camera.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 2, -6).applyQuaternion(this.camera.quaternion))), i * 300);
    }
    this.rig.mode = 'orbit';
    this.setMenuCamera();
  }

  // ---------------------------------------------------------------------------
  // main loop

  start() {
    const token = (this.loadToken = (this.loadToken || 0) + 1);
    this.loadHole(0).then(() => {
      if (token !== this.loadToken) return;
      this.toMenu();
      this.rig.snapNext = true;
    });
    const loop = (ts) => {
      requestAnimationFrame(loop);
      this.clock.update(ts);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    if (!this.world) return;
    this.renderer.trackFrame(dt);
    const running = !this.paused;
    const w = this.world;
    const ball = w.ball;
    if (running) {
      this.stateTime += dt;
      // keyboard aim
      if (this.state === 'aim') {
        const rate = (this.keys.ShiftLeft || this.keys.ShiftRight) ? 0.35 : 1.3;
        if (this.keys.KeyA || this.keys.ArrowLeft) this.yaw -= rate * dt;
        if (this.keys.KeyD || this.keys.ArrowRight) this.yaw += rate * dt;
      }
      if (this.state === 'power' && this.keyPower) this.addPower(dt * 180);
      w.update(dt);
      this.handleEvents();
      this.updateState(dt);
      const t = w.time;
      for (const fn of this.hole.animators) fn(dt, t);
      for (const m of this.hole.movers) { m.object.matrix.copy(m.body.matrix); m.object.matrixWorldNeedsUpdate = true; }
      globalUniforms.uTime.value = t;
    }

    // ball visuals (a faint trail when it's really moving)
    if (running && this.state === 'rolling' && ball.vel.lengthSq() > 9 && this.ballMesh.visible) this.effects.trail(ball.pos);
    this.updateBallVisual(dt);
    this.updateAimGuide();
    this.updatePutter(dt);

    const cup = this.hole.cupInfo;
    let hint = null;
    for (const h of this.hole.camHints) {
      const p = ball.pos;
      if (p.x > h.min.x && p.x < h.max.x && p.y > h.min.y && p.y < h.max.y && p.z > h.min.z && p.z < h.max.z) { hint = h; break; }
    }
    this.rig.update(dt, { ball: ball.pos, vel: ball.vel, yaw: this.yaw, cup, hint });
    this.sky.position.copy(this.camera.position);
    this.effects.update(running ? dt : 0, w.time);
    if (running) audio.setRoll(ball.vel.length(), ball.grounded && this.state === 'rolling', ball.groundMat ? ball.groundMat.sound : 'soft');
    else audio.setRoll(0, false);
    this.renderer.render(this.scene, this.camera);
  }

  updateState(dt) {
    const w = this.world, ball = w.ball;
    const speed = ball.vel.length();
    switch (this.state) {
      case 'intro':
        if (this.rig.fly && this.rig.fly.t >= 1) { this.ui.hideBanner(); this.enterAim(false); }
        break;
      case 'aim':
      case 'power':
        // an obstacle may knock the resting ball: watch it roll without a stroke
        if (speed > 0.35 && ball.active && !ball.resting) {
          if (this.state === 'power') { this.ui.setPower(null); }
          this.lastPos.copy(ball.pos);
          this.setState('rolling');
        }
        break;
      case 'rolling': {
        this.rollTime += dt;
        if (this.rig.mode !== 'follow' && !this.overview) this.rig.mode = 'follow';
        if (this.overview) this.rig.mode = 'overview';
        // at rest relative to the surface underneath (which may itself be moving, e.g. a turntable)
        const onMoving = ball.groundVel.lengthSq() > 0.0025;
        const rel = onMoving ? ball.vel.distanceTo(ball.groundVel) : speed;
        // stopped in the world (e.g. pinned against a wall by a belt) or riding the surface
        const slow = (speed < 0.06 || rel < 0.06) && (ball.grounded || ball.resting);
        this.stopTimer = slow ? this.stopTimer + dt : 0;
        const forced = this.stateTime > 30;
        if ((this.stopTimer > (onMoving ? 0.6 : 0.35) || forced) && !ball.inCup) {
          if (forced || onMoving) {
            // park the ball so it doesn't ride the moving surface while the player aims
            ball.vel.set(0, 0, 0);
            ball.active = false;
          }
          this.stopTimer = 0;
          if (this.strokes >= MAX_STROKES) {
            this.ui.toast('Stroke limit reached', `Max ${MAX_STROKES} strokes per hole`, 1800);
            this.setState('capped');
            return;
          }
          // resting on top of a wall: unplayable lie, return the ball without penalty
          if (ball.groundMat && ball.groundMat.kind === 'wall') {
            this.ui.toast('Unplayable lie', 'Ball returned — no penalty', 1600);
            w.placeBall(this.lastPos);
            this.effects.portal(this.lastPos);
          }
          this.yaw = this.defaultYaw();
          this.enterAim(false);
        }
        break;
      }
      case 'hazard':
        if (this.stateTime > 1.7) {
          if (this.hazardCapped) { this.setState('capped'); return; }
          w.placeBall(this.lastPos);
          this.ballMesh.visible = true;
          this.effects.portal(this.lastPos);
          this.yaw = this.defaultYaw();
          this.enterAim(false);
          this.rig.snapNext = false;
        }
        break;
      case 'capped':
        if (this.stateTime > 1.6) this.finishHole(MAX_STROKES);
        break;
      case 'holed':
        if (this.stateTime > 0.8 && ball.active) {
          // let the ball settle in the cup, then freeze it
          const c = this.hole.cupInfo;
          if (this.stateTime > 1.2) { ball.active = false; ball.pos.set(c.x, c.y - 0.24 + BALL_RADIUS, c.z); }
        }
        if (this.stateTime > 4.2) this.finishHole();
        break;
      default:
    }
  }

  updateBallVisual(dt) {
    const ball = this.world.ball;
    const m = this.ballMesh;
    const prev = m.position.clone();
    m.position.copy(ball.pos);
    const d = m.position.clone().sub(prev);
    const dist = d.length();
    if (dist > 1e-5 && dist < 1) {
      const n = ball.grounded ? ball.groundNormal : UP;
      const axis = new THREE.Vector3().crossVectors(n, d).normalize();
      if (axis.lengthSq() > 0.5) {
        const q = new THREE.Quaternion().setFromAxisAngle(axis, dist / BALL_RADIUS);
        m.quaternion.premultiply(q);
      }
    }
    const showRing = this.state === 'aim' || this.state === 'power';
    this.ring.visible = showRing && m.visible;
    if (showRing) {
      this.ring.position.set(ball.pos.x, ball.pos.y - BALL_RADIUS + 0.008, ball.pos.z);
      const s = 1 + Math.sin(this.elapsed * 5) * 0.12;
      this.ring.scale.setScalar(s);
    }
    this.elapsed += dt;
  }

  updateAimGuide() {
    const show = (this.state === 'aim' || this.state === 'power') && !this.paused;
    this.aimDots.visible = show;
    this.aimArrow.visible = show;
    if (!show) return;
    const ball = this.world.ball.pos;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const p = this.state === 'power' ? this.power : 0;
    const count = Math.round(7 + p * 26);
    const spacing = 0.17;
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const white = new THREE.Color(0xffffff), yellow = new THREE.Color(0xffd23f), red = new THREE.Color(0xff4b4b);
    let y = ball.y - BALL_RADIUS;
    let last = new THREE.Vector3();
    for (let i = 0; i < 40; i++) {
      if (i >= count) { m4.makeScale(0, 0, 0); this.aimDots.setMatrixAt(i, m4); continue; }
      const dd = 0.22 + i * spacing;
      const x = ball.x + f.x * dd, z = ball.z + f.z * dd;
      const gy = this.world.heightAt(x, z, y + 0.4);
      if (gy > -1e6 && Math.abs(gy - y) < 0.5) y = gy;
      const fade = 1 - i / Math.max(count, 1) * 0.6;
      const s = (0.7 + p * 0.6) * fade;
      m4.compose(new THREE.Vector3(x, y + 0.012, z), new THREE.Quaternion(), new THREE.Vector3(s, 1, s));
      this.aimDots.setMatrixAt(i, m4);
      const k = i / 32;
      if (p > 0) col.copy(white).lerp(k < 0.5 ? yellow : red, Math.min(1, p * 1.5 * (k < 0.5 ? k * 2 : 1)));
      else col.copy(white);
      this.aimDots.setColorAt(i, col);
      last.set(x, y + 0.02, z);
    }
    this.aimDots.instanceMatrix.needsUpdate = true;
    this.aimDots.instanceColor.needsUpdate = true;
    this.aimArrow.position.copy(last).addScaledVector(f, 0.12);
    this.aimArrow.rotation.set(0, -this.yaw + Math.PI, 0);
    this.aimArrow.material.color.copy(p > 0.6 ? red : p > 0.25 ? yellow : white);
  }

  updatePutter(dt) {
    const aiming = this.state === 'aim' || this.state === 'power';
    const target = aiming ? 1 : 0;
    if (this.putterSwing > 0) this.putterSwing = Math.max(0, this.putterSwing - dt * 3);
    this.putterVisible += ((aiming || this.putterSwing > 0 ? 1 : 0) - this.putterVisible) * Math.min(1, dt * (target ? 8 : 5));
    const vis = this.putterVisible > 0.02 && this.ballMesh.visible && !this.paused;
    this.putterPivot.visible = vis;
    if (!vis) return;
    const swinging = this.putterSwing > 0 && !aiming && this.putterBase;
    const ball = swinging ? this.putterBase : this.world.ball.pos;
    const yaw = swinging ? this.putterYaw : this.yaw;
    const f = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    let back = 0.02;
    if (this.state === 'power') back = 0.02 + this.power * 0.42;
    if (swinging) {
      const s = this.putterSwing; // 1 -> 0
      back = s > 0.85 ? THREE.MathUtils.lerp(-0.1, 0.3, (s - 0.85) / 0.15) : -0.1 * (s / 0.85);
    }
    const base = ball.clone().addScaledVector(f, -(BALL_RADIUS + 0.05 + back));
    base.y = ball.y - BALL_RADIUS;
    this.putterPivot.position.copy(base);
    this.putterPivot.rotation.set(0, -yaw, 0);
    // shaft leans toward the player's hands (to the right and back)
    this.shaftGroup.rotation.set(0.25, 0, -0.42);
    this.putter.scale.setScalar(Math.min(1, this.putterVisible * 1.2));
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.resize();
    this.effects.setScale(window.innerHeight);
  }
}
