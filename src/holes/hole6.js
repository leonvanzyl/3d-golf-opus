// Hole 6 — Jurassic Jungle: putt between a T-Rex's feet, dodge its sweeping tail, climb to the nest.
import * as THREE from 'three';
import { toon, textures, glow } from '../engine/materials.js';
import { Builder, bakeGroup, setSway, rectPts } from '../course/Builder.js';
import { palmTree, rock, mushroom, bird, dragonfly, mesh, rng, eye, waterfall, blob, ambientParticles } from '../course/props.js';
import { ground, scatter, grass, live, horizon, courseMask } from '../course/decor.js';

const PIVOT = new THREE.Vector3(0, 2.5, -8.2);
const TAIL = [[0, 0, 0], [0, -0.45, -1.4], [0, -1.2, -2.6], [0, -1.9, -3.7], [0, -2.3, -4.7], [0, -2.38, -5.5]];
const TAIL_R = [0.55, 0.45, 0.34, 0.24, 0.16, 0.1];
const SWEEP = 0.5, PERIOD = 5;
const tailAngle = (t) => Math.sin((t * Math.PI * 2) / PERIOD) * SWEEP;

// capsule between two local points -> physics shape
function capsuleShape(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const c = A.clone().add(B).multiplyScalar(0.5);
  return { type: 'capsule', r, h: len, position: [c.x, c.y, c.z], rotation: [e.x, e.y, e.z] };
}

function taperedLimb(a, b, r0, r1, mat, seg = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg);
  const m = mesh(g, mat);
  m.position.copy(A).lerp(B, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

function buildTRex() {
  const skin = toon(0x5cbf4a);
  const belly = toon(0xf2df8a);
  const stripe = toon(0x3d8f33);
  const claw = toon(0xfff3dc);
  const mouth = toon(0xb8323a);
  const root = new THREE.Group();
  const HIP = new THREE.Vector3(0, 2.7, -7.7);

  // --- legs (static, baked)
  const legs = new THREE.Group();
  // --- upper body leans about the hips (baked); built in world coords then re-parented
  const body = new THREE.Group();
  body.add(mesh(new THREE.SphereGeometry(1, 18, 14), skin, { pos: [0, 3.25, -7.5], scale: [1.25, 1.2, 2.0], rot: [0.18, 0, 0] }));
  body.add(mesh(new THREE.SphereGeometry(1, 16, 12), belly, { pos: [0, 2.95, -7.1], scale: [0.95, 0.9, 1.6], rot: [0.25, 0, 0] }));
  for (let i = 0; i < 5; i++) body.add(mesh(new THREE.SphereGeometry(0.5, 10, 6), stripe, { pos: [0, 4.32 - i * 0.05, -6.6 - i * 0.45], scale: [1.6, 0.25, 0.35], rot: [0.2, 0, 0], noOutline: true }));
  body.add(taperedLimb([0, 3.7, -6.2], [0, 4.55, -5.4], 0.75, 0.55, skin, 14));
  body.add(taperedLimb([0, 3.5, -6.0], [0, 4.3, -5.3], 0.55, 0.42, belly, 12));
  for (const s of [-1, 1]) {
    // legs
    legs.add(mesh(new THREE.SphereGeometry(1, 14, 10), skin, { pos: [s * 1.0, 2.55, -7.75], scale: [0.62, 1.0, 0.85] }));
    legs.add(taperedLimb([s * 1.05, 2.0, -7.75], [s * 1.05, 0.25, -7.4], 0.42, 0.3, skin, 12));
    legs.add(mesh(new THREE.SphereGeometry(0.33, 10, 8), skin, { pos: [s * 1.05, 0.25, -7.4] }));
    legs.add(mesh(new THREE.BoxGeometry(0.55, 0.22, 0.95), skin, { pos: [s * 1.05, 0.11, -7.1] }));
    for (const dx of [-0.19, 0, 0.19]) legs.add(mesh(new THREE.ConeGeometry(0.07, 0.24, 6), claw, { pos: [s * 1.05 + dx, 0.08, -6.55], rot: [Math.PI / 2, 0, 0], noOutline: true }));
    // tiny arms
    body.add(taperedLimb([s * 0.7, 3.4, -6.1], [s * 0.85, 2.95, -5.7], 0.13, 0.1, skin, 8));
    body.add(taperedLimb([s * 0.85, 2.95, -5.7], [s * 0.8, 3.05, -5.35], 0.1, 0.08, skin, 8));
    for (const dz of [-0.06, 0.06]) body.add(mesh(new THREE.ConeGeometry(0.035, 0.12, 5), claw, { pos: [s * 0.8 + dz * 0.5, 3.02, -5.25], rot: [Math.PI / 2 + 0.4, 0, 0], noOutline: true }));
  }
  // back spikes
  for (let i = 0; i < 6; i++) body.add(mesh(new THREE.ConeGeometry(0.16 - i * 0.012, 0.42, 4), toon(0xff9f40), { pos: [0, 4.45 - i * 0.07, -5.9 - i * 0.45], rot: [-0.3, 0, 0] }));
  bakeGroup(legs);
  root.add(legs);
  const upper = new THREE.Group();
  upper.position.copy(HIP);
  body.position.copy(HIP).negate();
  upper.add(body);
  root.add(upper);

  // --- head (animated)
  const head = new THREE.Group();
  head.position.set(0, 4.6, -5.4);
  const skull = new THREE.Group();
  skull.add(mesh(new THREE.SphereGeometry(1, 16, 12), skin, { pos: [0, 0.2, 0.55], scale: [0.62, 0.55, 0.95] }));
  skull.add(mesh(new THREE.BoxGeometry(0.95, 0.42, 1.2), skin, { pos: [0, 0.05, 1.05] }));
  skull.add(mesh(new THREE.SphereGeometry(0.5, 12, 8), skin, { pos: [0, 0.07, 1.6], scale: [0.95, 0.5, 0.6] }));
  for (const s of [-1, 1]) {
    const e = eye(0.15);
    e.position.set(s * 0.42, 0.45, 0.55);
    e.rotation.y = s * 0.7;
    skull.add(e);
    skull.add(mesh(new THREE.BoxGeometry(0.32, 0.1, 0.25), stripe, { pos: [s * 0.4, 0.62, 0.55], rot: [0, 0, -s * 0.3], noOutline: true }));
    skull.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), toon(0x1a1a22), { pos: [s * 0.18, 0.2, 1.85], noOutline: true }));
    for (let i = 0; i < 5; i++) skull.add(mesh(new THREE.ConeGeometry(0.04, 0.12, 4), claw, { pos: [s * 0.4, -0.18, 0.75 + i * 0.22], rot: [Math.PI, 0, 0], noOutline: true }));
  }
  bakeGroup(skull, skull.children.filter((c) => c.isGroup));
  head.add(skull);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.12, 0.35);
  jaw.add(mesh(new THREE.BoxGeometry(0.85, 0.22, 1.35), skin, { pos: [0, -0.1, 0.65] }));
  jaw.add(mesh(new THREE.BoxGeometry(0.7, 0.05, 1.2), mouth, { pos: [0, 0.02, 0.62], noOutline: true }));
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) jaw.add(mesh(new THREE.ConeGeometry(0.035, 0.1, 4), claw, { pos: [s * 0.36, 0.07, 0.4 + i * 0.22], noOutline: true }));
  bakeGroup(jaw);
  head.add(jaw);
  head.position.sub(HIP); // head rides on the leaning upper body
  upper.add(head);

  // --- tail (animated, rotates about the hip pivot)
  const tail = new THREE.Group();
  tail.position.copy(PIVOT);
  for (let i = 0; i < TAIL.length - 1; i++) {
    tail.add(taperedLimb(TAIL[i], TAIL[i + 1], TAIL_R[i] * 1.02, TAIL_R[i + 1] * 1.02, skin, 12));
    tail.add(mesh(new THREE.SphereGeometry(TAIL_R[i + 1] * 1.02, 10, 8), skin, { pos: TAIL[i + 1] }));
    if (i < 4) tail.add(mesh(new THREE.ConeGeometry(0.12 - i * 0.02, 0.3, 4), toon(0xff9f40), { pos: [0, TAIL[i + 1][1] + TAIL_R[i + 1] + 0.05, TAIL[i + 1][2] + 0.3], rot: [-0.5, 0, 0] }));
  }
  bakeGroup(tail);
  root.add(tail);
  bakeGroup(body);
  root.userData = { head, jaw, tail, body, upper, headBase: head.position.clone() };
  return root;
}

function fern(seed, size = 1) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const m = toon([0x3fae45, 0x2f9a3f, 0x56c04b][seed % 3], { sway: 0.07, side: THREE.DoubleSide });
  const n = 7 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const L = (0.9 + rand() * 0.5) * size;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(L * 0.5, 0.16 * size, L, 0);
    shape.quadraticCurveTo(L * 0.5, -0.16 * size, 0, 0);
    const fg = new THREE.ShapeGeometry(shape, 5);
    fg.rotateX(-Math.PI / 2);
    const p = fg.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k); p.setY(k, x * 0.9 - x * x * 0.55 / size); }
    fg.rotateY((i / n) * Math.PI * 2 + rand() * 0.3);
    fg.computeVertexNormals();
    setSway(fg, 0, 0.8 * size);
    g.add(mesh(fg, m, { noOutline: true }));
  }
  return g;
}

function volcano() {
  const g = new THREE.Group();
  const cone = new THREE.CylinderGeometry(4, 16, 18, 10, 1, true);
  cone.translate(0, 9, 0);
  g.add(mesh(cone, toon(0x6b5448), { noOutline: true, noShadow: true }));
  const top = new THREE.CircleGeometry(4, 10);
  top.rotateX(-Math.PI / 2);
  top.translate(0, 17.6, 0);
  g.add(mesh(top, glow(0xff6a1a, 2.5), { noOutline: true, noShadow: true }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const lg = new THREE.PlaneGeometry(0.9, 8);
    lg.translate(0, -4, 0);
    const lm = mesh(lg, glow(0xff5a14, 2.2), { noOutline: true, noShadow: true });
    lm.position.set(Math.cos(a) * 5.5, 17.2, Math.sin(a) * 5.5);
    lm.rotation.set(-0.35, -a + Math.PI / 2, 0, 'YXZ');
    g.add(lm);
  }
  return g;
}

function eggNest() {
  const g = new THREE.Group();
  const nest = new THREE.TorusGeometry(0.62, 0.22, 8, 18);
  nest.rotateX(Math.PI / 2);
  g.add(mesh(nest, toon(0x9a6b3f), { pos: [0, 0.15, 0] }));
  g.add(mesh(new THREE.CircleGeometry(0.62, 16), toon(0x7a5230), { pos: [0, 0.06, 0], rot: [-Math.PI / 2, 0, 0], noOutline: true }));
  const eggs = [];
  for (const [x, z, c] of [[-0.2, 0.05, 0xfff5e0], [0.22, -0.1, 0xd7f0c8], [0.02, 0.28, 0xfff0f0]]) {
    const e = mesh(new THREE.SphereGeometry(0.2, 12, 10), toon(c), { pos: [x, 0.3, z], scale: [1, 1.3, 1] });
    g.add(e);
    eggs.push(e);
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), toon(0x7ac25a), { pos: [x + Math.cos(i * 2) * 0.17, 0.3 + (i - 1) * 0.1, z + Math.sin(i * 2) * 0.17], noOutline: true }));
  }
  g.userData.update = (t) => {
    eggs.forEach((e, i) => { e.rotation.z = Math.sin(t * 9 + i * 2) * 0.12 * Math.max(0, Math.sin(t * 0.8 + i * 1.7)); });
  };
  return g;
}

export default {
  name: 'Jurassic Jungle',
  par: 4,
  theme: 'jungle',
  tip: 'Sneak between the T-Rex’s feet and dodge its sweeping tail — the river is waiting on the right!',
  env: {
    sky: { top: 0x3f8fd4, horizon: 0xdaf3cf, bottom: 0x9fcf9a, sunDir: [0.55, 0.55, 0.3], clouds: 0.65, cloudShade: 0xc9dcc0 },
    fog: { color: 0xcfe9c2, near: 35, far: 150 },
    sun: { color: 0xfff0c8, intensity: 2.5 },
    hemi: { sky: 0xd8f0ff, ground: 0x5a8a3a, intensity: 1.1 },
  },
  build(b) {
    const M = {
      fairway: toon(0xffffff, { map: textures.fairway('#58c447', '#4db83d', 2.4) }),
      wall: toon(0xffffff, { map: textures.planks('#a8743f', '#5a3a1e', 0.7, true) }),
      cap: toon(0xd8c28a),
      side: toon(0xffffff, { map: textures.dirt('#86593a') }),
      rockSide: toon(0xffffff, { map: textures.bricks('#9a9088', '#6e655e', 1.4, 5) }),
    };
    const W = { mat: M.wall, capMat: M.cap, surface: 'woodWall' };

    // --- approach fairway
    b.track([[0, 0, 3.3], [0, 0, -6.4]], { width: 2.4, mat: M.fairway, sideMat: M.side, wallMat: M.wall, capMat: M.cap, wallSurface: 'woodWall' });
    b.wall([[-1.32, 3.3], [1.32, 3.3]], { ...W, align: 'right' });

    // --- the clearing under / behind the dinosaur
    const clearing = [[-1.2, -6.4], [1.2, -6.4], [2.6, -7.6], [2.6, -13.2], [1.6, -14.2], [-2.2, -14.2], [-3.2, -13.2], [-3.2, -7.6]];
    b.floor(clearing, { y: 0, mat: M.fairway, sideMat: M.side });
    b.wall([[1.2, -6.4], [2.6, -7.6], [2.6, -8.0]], { ...W, align: 'right' });
    b.wall([[2.6, -12.8], [2.6, -13.2], [1.6, -14.2], [-2.2, -14.2], [-3.2, -13.2], [-3.2, -12.0]], { ...W, align: 'right' });
    b.wall([[-3.2, -10.6], [-3.2, -7.6], [-1.2, -6.4]], { ...W, align: 'right' });
    // river bank boulders (partial barrier)
    for (const z of [-9.0, -11.4]) b.cylinder([2.42, -0.05, z], 0.22, 0.4, { mat: null, surface: 'stoneWall', outline: false });

    // --- dinosaur legs & feet (static colliders)
    for (const s of [-1, 1]) {
      b.cylinder([s * 1.05, -0.05, -7.4], 0.32, 2.2, { mat: null, surface: 'softWall' });
      b.box([s * 1.05, 0.11, -7.1], [0.55, 0.22, 0.95], { surface: 'softWall', visual: false });
    }

    // --- the sweeping tail (moving collider)
    const dino = b.visual ? buildTRex() : null;
    const tailShapes = [2, 3, 4].map((i) => capsuleShape(TAIL[i], TAIL[i + 1], (TAIL_R[i] + TAIL_R[i + 1]) / 2));
    const tailBody = b.mover({
      shapes: tailShapes,
      surface: 'softWall',
      update: (t, m) => { m.makeRotationY(tailAngle(t)); m.setPosition(PIVOT.x, PIVOT.y, PIVOT.z); },
      onHit: (s) => { if (s > 0.6) b.world.emit('sound', { name: 'thump' }); },
    });

    // --- ramp up to the nest plateau and the green
    b.track([[-3.2, 0, -11.3], [-4.0, 0, -11.3], [-6.4, 0.6, -11.3], [-7.2, 0.6, -11.3]], { width: 1.4, mat: M.fairway, sideMat: M.rockSide, wallMat: M.wall, capMat: M.cap, wallSurface: 'woodWall', skirt: 1.2, spacing: 0.15 });
    const arc1 = [], arc2 = [];
    for (let i = 0; i <= 6; i++) {
      const a1 = Math.PI / 2 + (i / 6) * (Math.PI / 2);
      arc1.push([-9.9 + Math.cos(a1) * 0.9, -10.6 + Math.sin(a1) * 0.9]);
      const a2 = Math.PI + (i / 6) * (Math.PI / 2);
      arc2.push([-9.9 + Math.cos(a2) * 0.9, -12.0 + Math.sin(a2) * 0.9]);
    }
    const green = [[-7.2, -12.9], [-7.2, -9.7], ...arc1, ...arc2];
    b.floor(green, { y: 0.6, holes: [Builder.cupHole(-9.6, -11.3)], mat: M.fairway, sideMat: M.rockSide, depth: 1.6 });
    b.wall([[-7.2, -10.6], [-7.2, -9.7], ...arc1, ...arc2, [-7.2, -12.9], [-7.2, -12.0]], { y: 0.6, ...W, align: 'left' });
    b.cup(-9.6, 0.6, -11.3, { flagColor: 0xff9f40 });

    b.setTee(0, 0, 2, 0);
    b.setPath([[0, 0, 2], [0, 0, -7.4], [-0.6, 0, -10.2], [-3.2, 0, -11.3], [-7.2, 0.6, -11.3], [-9.6, 0.6, -11.3]]);
    b.camHint([-1.6, -1, -8.8], [1.6, 1.5, -6.0], [3.4, 1.4, -4.6], [0, 0.3, -9]);
    b.camHint([-3.25, -1, -14.3], [2.7, 1.5, -8.8], [-5.6, 3.4, -7.6], [-0.5, 0, -11]);

    // --- river on the open side
    ground(b, { y: -0.5, color: 0x4f9a3a, map: textures.fairway('#539c3c', '#4d9437', 5), hills: 4, hillStart: 18,
      bumps: [{ x: -9.4, z: -11.3, r: 4, h: 0.8, plateau: 0.7 }] });
    b.water(rectPts(2.55, -40, 6.2, 30), -0.36, { deep: 0x2b8a9e, shallow: 0x55c9b8, flow: [0, -0.12] });
    const onCourse = courseMask(b, 0.7);
    const mask = (x, z) => onCourse(x, z) || (x > 2.2 && x < 6.8);

    if (b.visual) {
      // the T-Rex
      const { head, jaw, tail, upper, headBase } = dino.userData;
      live(b, dino);
      let nextRoar = 4, roarT = -1;
      b.animate((dt, t) => {
        tail.rotation.y = tailAngle(t);
        let lean = Math.sin(t * 1.6) * 0.02;
        if (t > nextRoar && roarT < 0) {
          roarT = 0;
          nextRoar = t + 9 + Math.random() * 5;
          b.world.emit('sound', { name: 'roar' });
          b.world.emit('shake', { amount: 0.5 });
        }
        let jawOpen = 0.08 + Math.max(0, Math.sin(t * 1.3)) * 0.1;
        let pitch = Math.sin(t * 0.7) * 0.08, yaw = Math.sin(t * 0.45) * 0.35;
        if (roarT >= 0) {
          roarT += dt;
          // lean down toward the player, roar, then straighten up
          const k = Math.sin(Math.min(1, roarT / 2.2) * Math.PI);
          const kk = THREE.MathUtils.smoothstep(k, 0, 0.6);
          lean += kk * 0.55;
          jawOpen += kk * 0.8;
          pitch -= kk * 0.5;
          yaw *= 1 - kk;
          head.position.x = headBase.x + Math.sin(roarT * 40) * 0.05 * kk;
          if (roarT > 2.2) roarT = -1;
        }
        upper.rotation.x = lean;
        jaw.rotation.x = jawOpen;
        head.rotation.set(pitch, yaw, 0);
      });

      // volcano on the horizon with smoke
      const vol = volcano();
      vol.position.set(-30, -1, -55);
      b.addStaticObject(vol, { outline: false, castShadow: false });
      live(b, ambientParticles({ count: 80, area: [6, 18, 6], center: [-30, 26, -55], color: 0x6a6070, size: 1.6, mode: 'embers', opacity: 0.5 }), { outline: false, shadow: false });

      // nest beside the green
      const nest = eggNest();
      nest.position.set(-12.0, b.terrainHeight(-12.0, -11.3), -11.3);
      live(b, nest);

      // upstream waterfall
      const cliff = new THREE.Group();
      for (const [x, y, z, s] of [[4.4, 0.4, -19.8, 1.8], [2.6, 1.6, -20.4, 1.2], [6.2, 1.4, -20.2, 1.3], [4.3, 2.5, -20.8, 1.1]]) {
        const r = rock({ size: s, color: 0x8a8f86, seed: Math.round(x * 5 + z), squash: 1.1 });
        r.position.set(x, y - 0.5, z);
        cliff.add(r);
      }
      b.addStaticObject(cliff);
      const wf = waterfall({ width: 2.2, height: 2.6, a: 0x5fd6c9 });
      wf.position.set(4.4, -0.36, -18.6);
      live(b, wf, { outline: false });
    }

    // jungle vegetation
    scatter(b, { count: 18, rMin: 5, rMax: 20, center: [-2, -8], mask, seed: 61, minDist: 2.2,
      make: (r, x, z, i) => palmTree({ height: 3.5 + r() * 2.5, lean: 0.3 + r() * 0.8, leaves: [0x3fae45, 0x2f9a3f, 0x56c04b][i % 3], seed: i + 11, coconuts: i % 2 === 0 }) });
    scatter(b, { count: 30, rMin: 2.5, rMax: 16, center: [-2, -8], mask, seed: 62, minDist: 0.9,
      make: (r, x, z, i) => fern(i, 0.8 + r() * 0.7) });
    scatter(b, { count: 8, rMin: 3, rMax: 14, center: [-2, -8], mask, seed: 63,
      make: (r, x, z, i) => mushroom({ height: 0.5 + r() * 0.9, cap: [0xff6a3d, 0xb57cff, 0xffd23f][i % 3], seed: i }) });
    scatter(b, { count: 10, rMin: 3, rMax: 15, center: [-2, -8], mask, seed: 64,
      make: (r, x, z, i) => rock({ size: 0.3 + r() * 0.5, color: 0x8a8f86, seed: i + 70 }) });
    grass(b, { count: 5500, rMin: 0.5, rMax: 20, center: [-2, -8], mask, base: 0x2f7f28, tip: 0x8fd85a, height: 0.45 });
    horizon(b, { radius: 115, count: 14, color: 0x5f8f6a, snowCaps: false, height: 24, seed: 16 });

    if (b.visual) {
      live(b, bird({ center: [-2, 11, -10], radius: 12, speed: 0.18, seed: 21, color: 0xc9744a, wingColor: 0xe8a060, scale: 3 }));
      live(b, bird({ center: [3, 13, -4], radius: 9, speed: -0.22, seed: 22, color: 0xb05a3a, wingColor: 0xd88a50, scale: 2.6 }));
      for (let i = 0; i < 4; i++) live(b, dragonfly({ center: [3 + (i % 2) * 1.5, 0.4, -9 - i * 2], radius: 1.2 + i * 0.3, color: [0x3de0ff, 0x7dff6a, 0xff6ad5, 0xffd23f][i], seed: i + 1 }), { outline: false });
    }
  },
};
