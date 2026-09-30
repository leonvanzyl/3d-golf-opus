// Hole 9 — Volcano Summit: ride sliding rafts over a lava river, climb, then jump the lava pit (or go around).
import * as THREE from 'three';
import { toon, textures, glow } from '../engine/materials.js';
import { Builder, bakeGroup, rectPts } from '../course/Builder.js';
import { mesh, rng, rock, torch, blob, ambientParticles, waterfall, eye } from '../course/props.js';
import { ground, scatter, live, horizon, courseMask } from '../course/decor.js';
import { surface } from '../physics/Physics.js';

const J_Y = 0.8; // junction / summit height
const PITCH = -0.14; // raft tilt (tops slope down toward -z)
const RAFT_T = 5.5;

function raftMatrix(m, x, topFront, zc) {
  // place a tilted box so the centre of its top face sits at (x, topCentre, zc)
  const topCentre = topFront - 0.8 * Math.sin(-PITCH);
  const c = Math.cos(PITCH), s = Math.sin(PITCH);
  m.makeRotationX(PITCH);
  m.setPosition(x, topCentre - 0.15 * c, zc - 0.15 * s);
}

function tiki(seed) {
  const g = new THREE.Group();
  const stone = toon(0x6a6470);
  g.add(mesh(new THREE.BoxGeometry(0.9, 2.0, 0.8), stone, { pos: [0, 1.0, 0] }));
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.25, 0.9), stone, { pos: [0, 2.05, 0] }));
  g.add(mesh(new THREE.BoxGeometry(0.22, 0.6, 0.3), stone, { pos: [0, 1.15, 0.5] }));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), glow(0xff5a14, 2.5), { pos: [s * 0.22, 1.55, 0.41], noOutline: true }));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.05), toon(0x2a2228), { pos: [0, 0.72, 0.41], noOutline: true }));
  return g;
}

function deadTree(seed) {
  const g = new THREE.Group();
  const m = toon(0x2e2426);
  const rand = rng(seed);
  const h = 1.6 + rand() * 1.2;
  const tg = new THREE.CylinderGeometry(0.05, 0.12, h, 6);
  tg.translate(0, h / 2, 0);
  g.add(mesh(tg, m));
  for (let i = 0; i < 3; i++) {
    const l = 0.5 + rand() * 0.6;
    const bg = new THREE.CylinderGeometry(0.02, 0.05, l, 5);
    bg.translate(0, l / 2, 0);
    bg.rotateZ((rand() - 0.5) * 2);
    bg.rotateY(rand() * 6);
    bg.translate(0, h * (0.5 + rand() * 0.4), 0);
    g.add(mesh(bg, m));
  }
  return g;
}

function bigVolcano() {
  const g = new THREE.Group();
  const cone = new THREE.CylinderGeometry(6, 26, 26, 12, 3, true);
  const p = cone.attributes.position;
  const r = rng(5);
  for (let i = 0; i < p.count; i++) { const k = 1 + (r() - 0.5) * 0.12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  cone.computeVertexNormals();
  cone.translate(0, 13, 0);
  g.add(mesh(cone, toon(0x3a2a2c), { noOutline: true, noShadow: true }));
  const crater = new THREE.CircleGeometry(6, 12);
  crater.rotateX(-Math.PI / 2);
  crater.translate(0, 25.6, 0);
  g.add(mesh(crater, glow(0xff5a14, 3), { noOutline: true, noShadow: true }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const lg = new THREE.PlaneGeometry(1.4, 14, 1, 4);
    lg.translate(0, -7, 0);
    const lm = mesh(lg, glow(0xff4a0a, 2.4), { noOutline: true, noShadow: true });
    lm.position.set(Math.cos(a) * 7.5, 25.2, Math.sin(a) * 7.5);
    lm.rotation.set(-0.42, -a + Math.PI / 2, 0, 'YXZ');
    g.add(lm);
  }
  return g;
}

export default {
  name: 'Volcano Summit',
  par: 5,
  theme: 'volcano',
  obMessage: 'Tumbled off the mountain!',
  tip: 'Time your crossing on the sliding rafts, climb the torch-lit ramp, then jump the lava pit — or take the long way round.',
  env: {
    sky: { top: 0x1a0b22, horizon: 0xd9481e, bottom: 0x3a1410, sunDir: [0.4, 0.07, -0.9], sunColor: 0xff7a3a, sunSize: 3.5, clouds: 0.55, cloudColor: 0x7a4a44, cloudShade: 0x2e1a1e, stars: 0.5 },
    fog: { color: 0x5a2630, near: 35, far: 140 },
    sun: { color: 0xffb080, intensity: 2.5, dir: [0.4, 0.6, 0.4] },
    hemi: { sky: 0xffb08a, ground: 0x5a2a2a, intensity: 1.45 },
    bloom: 0.6,
  },
  build(b) {
    const M = {
      floor: toon(0xffffff, { map: textures.basalt('#4a3c40', 1.6) }),
      path: toon(0xffffff, { map: textures.tiles('#8a6a5a', '#7a5c4e', 1, 3) }),
      wall: toon(0xffffff, { map: textures.bricks('#5a4a50', '#2e2428', 0.9, 21) }),
      cap: toon(0xd9a07a),
      side: toon(0xffffff, { map: textures.basalt('#3a2e32', 2) }),
      green: toon(0xffffff, { map: textures.fairway('#6ab04a', '#5fa541', 2) }),
      raft: toon(0xffffff, { map: textures.bricks('#7a6a60', '#4a3e38', 0.7, 31) }),
    };
    const lane = { width: 1.8, mat: M.floor, sideMat: M.side, wallMat: M.wall, capMat: M.cap, wallSurface: 'stoneWall', surface: 'stone', skirt: 1.6 };

    // --- A: tee lane
    b.track([[0, 0, 1.3], [0, 0, -3.0]], lane);
    b.wall([[-1.02, 1.3], [1.02, 1.3]], { mat: M.wall, capMat: M.cap, surface: 'stoneWall', align: 'right' });

    // --- B: the lava river with two tilted, sliding stone rafts
    const raftTopFront = [0, -0.111 * 2];
    const rafts = [{ zc: -3.8, top: 0, phase: 0 }, { zc: -5.4, top: -0.222, phase: 2.2 }];
    for (const r of rafts) {
      const vis = new THREE.Group();
      if (b.visual) {
        vis.add(mesh(new THREE.BoxGeometry(1.5, 0.3, 1.6), M.raft));
        vis.add(mesh(new THREE.BoxGeometry(1.52, 0.06, 1.62), toon(0xffb46a), { pos: [0, -0.16, 0], noOutline: true }));
      }
      b.mover({
        object: b.visual ? vis : null,
        shapes: [{ type: 'box', size: [1.5, 0.3, 1.6] }],
        surface: surface('stone', { roll: 0.09, drag: 0.35 }),
        update: (t, m) => raftMatrix(m, Math.sin((t * Math.PI * 2) / RAFT_T + r.phase) * 1.7, r.top, r.zc),
      });
    }
    b.lava(rectPts(-30, -6.2, 30, -3.0), -0.6, { flow: [0.05, 0] });

    // --- C: far bank and D: ramp up to the junction
    const bankY = -0.333;
    b.track([[0, bankY, -6.2], [0, bankY, -7.6]], lane);
    b.track([[0, bankY, -7.6], [0, J_Y, -12.0]], { ...lane, spacing: 0.15, skirt: 2.2 });

    // --- E: junction plateau
    b.floor(rectPts(-0.9, -14.0, 5.3, -12.0), { y: J_Y, depth: 2.2, mat: M.floor, sideMat: M.side, surface: 'stone' });
    const WW = { y: J_Y, mat: M.wall, capMat: M.cap, surface: 'stoneWall' };
    b.wall([[0.9, -12.0], [5.3, -12.0], [5.3, -14.0], [5.1, -14.0]], { ...WW, align: 'right' });
    b.wall([[3.7, -14.0], [0.9, -14.0]], { ...WW, align: 'right' });
    b.wall([[-0.9, -14.0], [-0.9, -12.0]], { ...WW, align: 'right' });

    // --- risky: kicker ramp over the lava pit
    b.track([[0, J_Y, -14.0], [0, J_Y + 0.06, -14.6], [0, J_Y + 0.32, -15.2]], { ...lane, flatEnds: false, spacing: 0.08, skirt: 0.4 });
    b.lava(rectPts(-2.6, -17.0, 3.65, -14.0), 0.2, { flow: [0.02, 0.03] });

    // --- safe: the long way round
    b.track([[4.4, J_Y, -14.0], [4.4, J_Y, -17.0], [4.1, J_Y, -17.8], [3.2, J_Y, -18.1]], { ...lane, width: 1.4, mat: M.path, spacing: 0.12, skirt: 2.2 });

    // --- F: summit green
    const arcA = [], arcB = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * (Math.PI / 2);
      arcA.push([-0.6 + Math.cos(a) * 1.0, -19.6 + Math.sin(a) * 1.0]);
      const a2 = Math.PI * 1.5 + (i / 8) * (Math.PI / 2);
      arcB.push([2.2 + Math.cos(a2) * 1.0, -19.6 + Math.sin(a2) * 1.0]);
    }
    const green = [[3.2, -17.0], [-1.6, -17.0], ...arcA, ...arcB];
    b.floor(green, { y: J_Y, depth: 2.2, holes: [Builder.cupHole(0.6, -19.3)], mat: M.green, sideMat: M.side, surface: 'felt' });
    // low curb along the landing edge, full walls elsewhere (opening on the right for the safe path)
    b.wall([[-1.6, -17.0], [3.2, -17.0]], { ...WW, align: 'right', height: 0.1 });
    b.wall([[3.2, -17.4], [3.2, -17.0]], { ...WW, align: 'right' });
    b.wall([[3.2, -18.8], ...arcB.slice().reverse(), ...arcA.slice().reverse(), [-1.6, -17.0]], { ...WW, align: 'right' });
    b.cup(0.6, J_Y, -19.3, { flagColor: 0xff3b1a, poleColor: 0x2a2228 });

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, 0, -3.0], [0, bankY, -6.2], [0, bankY, -7.6], [0, J_Y, -12.0], [0, J_Y, -14.0], [0, J_Y + 0.3, -15.2], [0.3, J_Y, -17.4], [0.6, J_Y, -19.3]]);

    // --- scenery
    ground(b, { y: -1.4, color: 0x5a4648, map: textures.basalt('#5a4648', 3), hills: 6, hillStart: 16 });
    const onCourse = courseMask(b, 1.0);

    if (b.visual) {
      // torches along the climb (a few with real lights)
      const torchSpots = [[-1.35, 0, -1.5, true], [1.35, 0, -1.5, false], [-1.35, bankY, -7.0, true], [1.35, 0.1, -9.3, false], [-1.35, 0.55, -11.3, true], [5.75, J_Y, -12.4, false], [-2.0, J_Y, -18.0, true], [3.6, J_Y, -19.6, false]];
      torchSpots.forEach(([x, y, z, light], i) => {
        const tr = torch({ height: 1.2, light, seed: i * 3.1 });
        tr.position.set(x, y - 0.1, z);
        live(b, tr);
      });
      // tiki statues
      for (const [x, z, ry] of [[-2.4, -13.4, 0.6], [6.4, -15.6, -0.9], [-3.2, -19.8, 0.4]]) {
        const tk = tiki(x);
        tk.position.set(x, b.terrainHeight(x, z) < J_Y - 0.5 ? J_Y - 0.2 : b.terrainHeight(x, z), z);
        tk.rotation.y = ry;
        b.addStaticObject(tk);
      }
      // rock pillars under the high ground
      const pillars = new THREE.Group();
      for (const [x, z, s] of [[-1.7, -13, 1.2], [6.1, -13.5, 1.2], [-2.5, -18.6, 1.3], [3.9, -20.6, 1.2], [5.7, -17.2, 1.1]]) {
        const rp = mesh(blob(s, 1, Math.round(x * 10 + z), 0.25), toon(0x3a2e32), { scale: [1, 1.4, 1] });
        rp.position.set(x, -1.2, z);
        pillars.add(rp);
      }
      b.addStaticObject(pillars);
      // lavafalls into the river
      for (const [x, rot] of [[-9, 0.2], [8.5, -0.3]]) {
        const cliff = new THREE.Group();
        for (const [dx, y, dz, s] of [[0, 0.2, -1.0, 1.6], [-1.1, 1.0, -1.4, 1.2], [1.1, 1.1, -1.3, 1.2], [0, 2.1, -1.6, 1.0]]) {
          const rr = rock({ size: s, color: 0x3a2e32, seed: Math.round(x * 3 + dx * 7), squash: 1.2 });
          rr.position.set(x + dx, y - 0.8, -7.2 + dz);
          cliff.add(rr);
        }
        b.addStaticObject(cliff);
        const lf = waterfall({ width: 1.1, height: 2.4, a: 0xff5a14, b: 0xffd070, glowAmt: 2.4, speed: 0.8 });
        lf.position.set(x, -0.6, -6.5);
        lf.rotation.y = Math.PI + rot;
        live(b, lf, { outline: false });
      }
      // glow from the lava
      const ll = new THREE.PointLight(0xff5a1a, 3, 9, 1.4);
      ll.position.set(0, 0.6, -4.6);
      b.group.add(ll);
      const ll2 = new THREE.PointLight(0xff5a1a, 2.4, 7, 1.4);
      ll2.position.set(0.5, 1.4, -15.5);
      b.group.add(ll2);
      // the erupting volcano
      const vol = bigVolcano();
      vol.position.set(6, -2, -48);
      b.addStaticObject(vol, { outline: false, castShadow: false });
      live(b, ambientParticles({ count: 120, area: [10, 24, 10], center: [6, 36, -48], color: 0x5a4a50, size: 2.2, mode: 'embers', opacity: 0.45 }), { outline: false, shadow: false });
      // lava bombs arcing out of the crater
      const bombs = [];
      for (let i = 0; i < 6; i++) {
        const bm = mesh(new THREE.SphereGeometry(0.6, 8, 6), glow(0xff7a1a, 3), { noOutline: true, noShadow: true });
        b.group.add(bm);
        bombs.push({ bm, ph: i * 1.3, dir: new THREE.Vector3(Math.cos(i * 2.1), 0, Math.sin(i * 2.1)) });
      }
      b.animate((dt, t) => {
        for (const bb of bombs) {
          const k = ((t + bb.ph) % 5) / 5;
          const tt = k * 3.2;
          bb.bm.visible = k < 0.9;
          bb.bm.position.set(6 + bb.dir.x * tt * 6, 24 + tt * 12 - tt * tt * 5.5, -48 + bb.dir.z * tt * 6);
        }
      });
      live(b, ambientParticles({ count: 350, area: [30, 10, 30], center: [0, 3, -9], color: 0xff8a3a, size: 0.07, mode: 'embers' }), { outline: false, shadow: false });
      // obsidian crystals
      const crystals = new THREE.Group();
      const cr = rng(12);
      for (let i = 0; i < 16; i++) {
        const a = cr() * Math.PI * 2, rr = 4 + cr() * 12;
        const x = Math.cos(a) * rr, z = -9 + Math.sin(a) * rr;
        if (onCourse(x, z)) continue;
        crystals.add(mesh(new THREE.OctahedronGeometry(0.25 + cr() * 0.3, 0), toon(0x2a1a3a, { rim: 0.8 }), { pos: [x, b.terrainHeight(x, z) + 0.3, z], scale: [0.6, 1.8, 0.6], rot: [cr() * 0.4, cr() * 6, cr() * 0.4] }));
      }
      b.addStaticObject(crystals);
    }
    scatter(b, { count: 14, rMin: 3, rMax: 16, center: [0, -9], mask: onCourse, seed: 91, minDist: 1.5, make: (r, x, z, i) => deadTree(i) });
    scatter(b, { count: 16, rMin: 3, rMax: 16, center: [0, -9], mask: onCourse, seed: 92, make: (r, x, z, i) => rock({ size: 0.3 + r() * 0.6, color: 0x4a3c40, seed: i + 7 }) });
    horizon(b, { radius: 110, count: 14, color: 0x4a2a2e, snowCaps: false, height: 26, seed: 21 });
  },
};
