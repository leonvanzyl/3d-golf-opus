// Hole 2 — Windmill Farm: time your putt through the door under the spinning sails.
import * as THREE from 'three';
import { toon, textures } from '../engine/materials.js';
import { Builder, roundRectPts, setSway } from '../course/Builder.js';
import { tree, bush, rock, chicken, butterfly, bird, fence, mesh, rng, eye } from '../course/props.js';
import { ground, scatter, grass, live, courseMask, horizon } from '../course/decor.js';

const HUB = new THREE.Vector3(0, 4.3, -6.6);
const OMEGA = (Math.PI * 2) / 7; // one turn every 7 s
const BLADE_R0 = 0.4, BLADE_R1 = 4.26;

function tulipField(b, { rows, colors, seed = 1 }) {
  const stemG = new THREE.CylinderGeometry(0.012, 0.014, 0.34, 4);
  stemG.translate(0, 0.17, 0);
  setSway(stemG, 0, 0.4);
  const headG = new THREE.CylinderGeometry(0.06, 0.035, 0.1, 6);
  headG.translate(0, 0.38, 0);
  setSway(headG, 0, 0.4);
  const leafG = new THREE.ConeGeometry(0.03, 0.2, 3);
  leafG.translate(0.02, 0.1, 0);
  setSway(leafG, 0, 0.4);
  const rand = rng(seed);
  const all = [];
  const byColor = colors.map(() => []);
  rows.forEach((row, ri) => {
    const [x0, z0, x1, z1] = row;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / 0.22);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3(x0 + (x1 - x0) * t + (rand() - 0.5) * 0.08, b.terrainHeight(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) - 0.02, z0 + (z1 - z0) * t + (rand() - 0.5) * 0.08);
      const s = 0.85 + rand() * 0.4;
      const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), new THREE.Vector3(s, s, s));
      all.push(m);
      byColor[ri % colors.length].push(m);
    }
  });
  const stems = new THREE.InstancedMesh(stemG, toon(0x3f9a37, { sway: 0.1 }), all.length);
  const leaves = new THREE.InstancedMesh(leafG, toon(0x4fb043, { sway: 0.1 }), all.length);
  all.forEach((m, i) => { stems.setMatrixAt(i, m); leaves.setMatrixAt(i, m); });
  b.group.add(stems, leaves);
  colors.forEach((c, ci) => {
    if (!byColor[ci].length) return;
    const im = new THREE.InstancedMesh(headG, toon(c, { sway: 0.1 }), byColor[ci].length);
    byColor[ci].forEach((m, i) => im.setMatrixAt(i, m));
    b.group.add(im);
  });
  b.group.children.slice(-colors.length - 2).forEach((o) => { o.frustumCulled = false; });
}

function sheep(pos, seed) {
  const g = new THREE.Group();
  const wool = toon(0xfbfbf5);
  const body = new THREE.Group();
  const rand = rng(seed);
  for (let i = 0; i < 7; i++) {
    const s = mesh(new THREE.IcosahedronGeometry(0.17 + rand() * 0.05, 1), wool, { pos: [(rand() - 0.5) * 0.3, 0.42 + (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.45] });
    body.add(s);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.36);
  head.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0x2d2d35), { scale: [0.85, 1, 1.15] }));
  for (const s of [-1, 1]) {
    const e = eye(0.025); e.position.set(s * 0.06, 0.03, 0.1); head.add(e);
    head.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), toon(0x2d2d35), { pos: [s * 0.12, 0.04, -0.02], scale: [1.4, 0.5, 0.8] }));
  }
  body.add(head);
  for (const [x, z] of [[-0.1, -0.15], [0.1, -0.15], [-0.1, 0.18], [0.1, 0.18]]) body.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), toon(0x2d2d35), { pos: [x, 0.15, z] }));
  g.add(body);
  g.position.set(...pos);
  g.rotation.y = rand() * 6;
  const ph = rand() * 10;
  g.userData.update = (t) => {
    head.rotation.x = Math.max(0, Math.sin(t * 0.6 + ph)) * 0.6;
    head.position.y = 0.5 - Math.max(0, Math.sin(t * 0.6 + ph)) * 0.18;
    body.position.y = Math.abs(Math.sin(t * 1.3 + ph)) * 0.01;
  };
  return g;
}

function buildBlades() {
  const g = new THREE.Group();
  const wood = toon(0x7a4a2a), cloth = toon(0xfff4e0, { side: THREE.DoubleSide }), trim = toon(0xd9412f);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const arm = new THREE.Group();
    arm.rotation.z = a;
    // blade points down (-y) at a = 0
    const len = BLADE_R1 - BLADE_R0;
    arm.add(mesh(new THREE.BoxGeometry(0.12, len + 0.3, 0.1), wood, { pos: [0, -(BLADE_R0 + len / 2) + 0.15, 0] }));
    arm.add(mesh(new THREE.BoxGeometry(0.86, len - 0.2, 0.03), cloth, { pos: [0.02, -(BLADE_R0 + len / 2) - 0.05, 0.03] }));
    for (let i = 0; i <= 5; i++) {
      const y = -(BLADE_R0 + 0.1 + (i * (len - 0.2)) / 5);
      arm.add(mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), wood, { pos: [0.02, y, 0.05] }));
    }
    for (const x of [-0.43, 0.47]) arm.add(mesh(new THREE.BoxGeometry(0.05, len - 0.2, 0.05), wood, { pos: [x, -(BLADE_R0 + len / 2) - 0.05, 0.05] }));
    arm.add(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.06), trim, { pos: [0.02, -BLADE_R1 + 0.06, 0.05] }));
    g.add(arm);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.35, 12), toon(0x5a3520), { rot: [Math.PI / 2, 0, 0] }));
  g.add(mesh(new THREE.SphereGeometry(0.2, 12, 8), toon(0xd9412f), { pos: [0, 0, 0.22] }));
  g.traverse((m) => { if (m.isMesh) m.userData.outlineWidth = 0.8; });
  return g;
}

export default {
  name: 'Windmill Farm',
  par: 3,
  theme: 'farm',
  tip: 'Putt through the windmill door — but time it between the spinning sails!',
  env: {
    sky: { top: 0x4a9bef, horizon: 0xd6f0ff, bottom: 0xb0dcf5, sunDir: [-0.45, 0.55, 0.4], clouds: 0.62 },
    fog: { color: 0xd6f0ff, near: 50, far: 180 },
    sun: { color: 0xfff0d0, intensity: 2.5 },
    hemi: { sky: 0xd8ecff, ground: 0x7a9a50, intensity: 1.15 },
  },
  build(b) {
    const M = {
      fairway: toon(0xffffff, { map: textures.fairway('#6fd352', '#62c747', 2.4) }),
      wall: toon(0xffffff),
      wallRed: toon(0xe0503c),
      cap: toon(0xffffff),
      side: toon(0xffffff, { map: textures.dirt('#94653b') }),
      brick: toon(0xffffff, { map: textures.bricks('#f1e6d2', '#b8a88f', 1.1) }),
      wood: toon(0xffffff, { map: textures.planks('#b98450', '#6e4523', 0.9) }),
      tower: toon(0xfbf7ee),
      roof: toon(0xd9412f),
      darkWood: toon(0x6b4226),
      window: toon(0x3a4a6b),
    };
    const lane = { width: 2.2, mat: M.fairway, sideMat: M.side, wallMat: M.wallRed, capMat: M.cap };

    // --- approach lane
    b.track([[0, 0, 1.3], [0, 0, -6.98]], lane);
    b.wall([[-1.22, 1.3], [1.22, 1.3]], { mat: M.wallRed, capMat: M.cap, align: 'right' });

    // --- windmill base: two blocks and a lintel leave a door-shaped tunnel
    const baseZ0 = -7.0, baseZ1 = -10.2, door = 0.5;
    const bz = (baseZ0 + baseZ1) / 2, bd = baseZ0 - baseZ1;
    b.box([-(door + 1.7) / 2 - 0.0, 1.0, bz], [1.7 - door, 4.0, bd], { mat: M.brick, surface: 'stoneWall' });
    b.box([(door + 1.7) / 2, 1.0, bz], [1.7 - door, 4.0, bd], { mat: M.brick, surface: 'stoneWall' });
    b.box([0, 1.87, bz], [door * 2, 2.26, bd], { mat: M.brick, surface: 'stoneWall' });
    b.track([[0, 0, -6.95], [0, 0, -10.25]], { width: door * 2, mat: M.wood, sideMat: M.wood, walls: 'none', skirt: 0.3 });

    // --- exit ramp and green
    b.track([[0, 0, -10.2], [0, -0.6, -12.62]], { ...lane, width: 1.6 });
    const green = roundRectPts(-1.6, -16.8, 1.6, -12.6, 0.8);
    b.floor(green, { y: -0.6, holes: [Builder.cupHole(0.3, -15.5)], mat: M.fairway, sideMat: M.side });
    const c = 7; // points per corner
    const wallPts = [...green.slice(c), ...green.slice(0, c)];
    b.wall(wallPts, { y: -0.6, mat: M.wallRed, capMat: M.cap, align: 'left' });
    b.cup(0.3, -0.6, -15.5, { flagColor: 0xffd23f });

    // --- spinning sails (moving obstacle)
    const bladeShapes = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const rc = (BLADE_R0 + BLADE_R1) / 2;
      bladeShapes.push({ type: 'box', size: [0.9, BLADE_R1 - BLADE_R0, 0.1], position: [Math.sin(a) * rc, -Math.cos(a) * rc, 0], rotation: [0, 0, a] });
    }
    let lastPass = 0;
    b.mover({
      object: b.visual ? buildBlades() : null,
      shapes: bladeShapes,
      surface: 'woodWall',
      update: (t, m) => {
        const ang = t * OMEGA;
        m.makeRotationZ(ang);
        m.setPosition(HUB.x, HUB.y, HUB.z);
        const pass = Math.floor((ang + Math.PI / 4) / (Math.PI / 2));
        if (pass !== lastPass) { lastPass = pass; b.world.emit('sound', { name: 'swish' }); }
      },
    });

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, 0, -8.6], [0, -0.3, -11.4], [0.3, -0.6, -15.5]]);
    b.camHint([-0.7, -1, -10.3], [0.7, 1, -6.9], [2.4, 1.7, -13.6], [0, -0.2, -10.8]);
    b.camHint([-1, -1, -13.1], [1, 1, -10.3], [2.0, 1.4, -14.2], [0, -0.4, -12]);

    // --- scenery
    ground(b, { y: -0.9, color: 0x74c94f, map: textures.fairway('#78cd55', '#70c64e', 6), bumps: [{ x: 0, z: -3, r: 9, h: 0.6, plateau: 0.45 }] });
    const onCourse = courseMask(b, 0.7);

    if (b.visual) {
      // windmill tower, cap and details
      const mill = new THREE.Group();
      const tw = new THREE.CylinderGeometry(1.2, 1.65, 3.6, 8);
      tw.translate(0, 3.0 + 1.8, bz);
      mill.add(mesh(tw, M.tower));
      const roof = new THREE.ConeGeometry(1.5, 1.7, 8);
      roof.translate(0, 6.6 + 0.85, bz);
      mill.add(mesh(roof, M.roof));
      mill.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0xffd23f), { pos: [0, 8.35, bz] }));
      const balcony = new THREE.TorusGeometry(1.75, 0.07, 6, 24);
      balcony.rotateX(Math.PI / 2);
      balcony.translate(0, 3.2, bz);
      mill.add(mesh(balcony, M.darkWood));
      const deck = new THREE.CylinderGeometry(1.75, 1.75, 0.12, 16);
      deck.translate(0, 3.05, bz);
      mill.add(mesh(deck, M.wood));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        mill.add(mesh(new THREE.BoxGeometry(0.05, 0.35, 0.05), M.darkWood, { pos: [Math.cos(a) * 1.75, 3.3, bz + Math.sin(a) * 1.75] }));
      }
      // hub housing
      mill.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 1.4), M.roof, { pos: [0, HUB.y, -7.4] }));
      // windows
      for (const [y, a] of [[4.6, 0.6], [5.6, -0.8], [4.3, Math.PI - 0.5], [5.4, Math.PI + 0.7]]) {
        const w = mesh(new THREE.BoxGeometry(0.4, 0.55, 0.1), M.window, { pos: [Math.sin(a) * 1.46, y, bz - Math.cos(a) * 1.46], rot: [0, -a, 0] });
        mill.add(w);
      }
      // door arches
      for (const z of [baseZ0 - 0.02, baseZ1 + 0.02]) {
        const arch = new THREE.TorusGeometry(door + 0.08, 0.08, 6, 16, Math.PI);
        arch.translate(0, 0.72, z);
        mill.add(mesh(arch, M.darkWood));
        for (const s of [-1, 1]) mill.add(mesh(new THREE.BoxGeometry(0.14, 0.75, 0.16), M.darkWood, { pos: [s * (door + 0.08), 0.37, z] }));
      }
      // brick base roof trim
      mill.add(mesh(new THREE.BoxGeometry(3.6, 0.2, 3.4), M.darkWood, { pos: [0, 3.0, bz] }));
      b.addStaticObject(mill);
      // hint of warm light inside the tunnel
      const pl = new THREE.PointLight(0xffc56b, 1.5, 3.5, 1.5);
      pl.position.set(0, 0.5, bz);
      b.group.add(pl);

      // barn
      const barn = new THREE.Group();
      barn.add(mesh(new THREE.BoxGeometry(3.2, 2.2, 2.6), toon(0xc63b2b), { pos: [0, 1.1, 0] }));
      const rf = new THREE.CylinderGeometry(1.55, 1.55, 3.3, 3, 1, false);
      rf.rotateZ(Math.PI / 2); rf.rotateX(Math.PI / 6);
      barn.add(mesh(rf, toon(0x6b4226), { pos: [0, 2.6, 0], scale: [1, 0.55, 1.05] }));
      barn.add(mesh(new THREE.BoxGeometry(1.1, 1.5, 0.08), toon(0xffffff), { pos: [0, 0.75, 1.31] }));
      barn.add(mesh(new THREE.BoxGeometry(0.95, 1.35, 0.08), toon(0x9e2b20), { pos: [0, 0.72, 1.33] }));
      barn.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), toon(0xffffff), { pos: [0, 1.85, 1.31] }));
      barn.position.set(-8.5, b.terrainHeight(-8.5, -12), -12);
      barn.rotation.y = 0.5;
      b.addStaticObject(barn);
      // hay bales
      for (const [x, z, r] of [[-6.2, -10.5, 0.3], [-6.8, -9.4, 1.2], [-5.9, -9.8, 2.2], [5.8, -2.5, 0.6]]) {
        const h = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 14), toon(0xf2c94c), { rot: [0, r, Math.PI / 2] });
        h.position.set(x, b.terrainHeight(x, z) + 0.42, z);
        const g = new THREE.Group(); g.add(h);
        b.addStaticObject(g);
      }
      // fences
      b.addStaticObject(fence({ points: [[-4, 3.5], [-4, -5], [-5.5, -8]].map(([x, z]) => [x, z]), height: 0.6 }).translateY(b.terrainHeight(-4, 0)));
      b.addStaticObject(fence({ points: [[4, 3.5], [4, -5]], height: 0.6 }).translateY(b.terrainHeight(4, 0)));
      // tulip fields on both sides
      const colors = [0xff3b5c, 0xffd23f, 0xff8ac2, 0xff6a2b, 0xb57cff, 0xffffff];
      const rows = [];
      for (let i = 0; i < 8; i++) {
        rows.push([5 + i * 0.55, 2.5, 6.5 + i * 0.55, -9]);
        rows.push([-5 - i * 0.55, 2.5, -6.8 - i * 0.55, -6]);
      }
      tulipField(b, { rows, colors, seed: 5 });
    }

    scatter(b, { count: 12, rMin: 9, rMax: 20, center: [0, -7], mask: onCourse, seed: 12, minDist: 3,
      make: (r, x, z, i) => tree({ height: 3 + r() * 1.5, canopy: 1 + r() * 0.5, leaves: [0x5cc653, 0x4fb848, 0x74cf4a][i % 3], seed: i + 20 }) });
    scatter(b, { count: 10, rMin: 3, rMax: 14, center: [0, -7], mask: (x, z) => onCourse(x, z) || (Math.abs(x) > 4.5 && Math.abs(x) < 11 && z > -10 && z < 3), seed: 22,
      make: (r, x, z, i) => bush({ radius: 0.35 + r() * 0.3, seed: i + 5, berries: i % 2 ? 0xffffff : null }) });
    grass(b, { count: 5500, rMin: 0.5, rMax: 22, center: [0, -7], mask: (x, z) => onCourse(x, z) || (Math.abs(x) > 4.7 && Math.abs(x) < 11 && z > -10 && z < 3), base: 0x3d9a31, tip: 0xb8ec6a });
    horizon(b, { radius: 120, count: 14, color: 0x8dbb8a, snowCaps: false, height: 20, seed: 8 });

    if (b.visual) {
      live(b, chicken({ path: [[-5.5, -11], [-4.5, -12.5], [-6, -13.5]], y: b.terrainHeight(-5.5, -12), seed: 1 }));
      live(b, chicken({ path: [[-7, -9], [-6, -8]], y: b.terrainHeight(-6.5, -8.5), seed: 2 }));
      live(b, chicken({ path: [[3.5, -12], [5, -13], [4.2, -14.5]], y: b.terrainHeight(4, -13), seed: 3 }));
      live(b, sheep([13, b.terrainHeight(13, -6), -6], 1));
      live(b, sheep([12, b.terrainHeight(12, -9), -9], 2));
      live(b, sheep([-13, b.terrainHeight(-13, 0), 0], 3));
      for (let i = 0; i < 4; i++) live(b, butterfly({ color: [0xffffff, 0xffd23f, 0xff8ac2, 0x8fd3ff][i], center: [i % 2 ? 7 : -7, 0, -3 - i * 2], radius: 1.8, seed: i + 7 }), { outline: false });
      live(b, bird({ center: [0, 9, -8], radius: 9, speed: 0.22, seed: 4 }));
    }
  },
};
