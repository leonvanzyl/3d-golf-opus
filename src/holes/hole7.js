// Hole 7 — Clockwork Factory: conveyor belts, a lift, a spinning gear turntable and punching pistons.
import * as THREE from 'three';
import { toon, textures, glow } from '../engine/materials.js';
import { Builder, roundRectPts, bakeGroup, circlePts } from '../course/Builder.js';
import { mesh, rng, gearGeometry, pipe, barrel, crate, eye, ambientParticles, lamp } from '../course/props.js';
import { ground, scatter, live, horizon, courseMask } from '../course/decor.js';
import { surface } from '../physics/Physics.js';

const UP_Y = 1.2; // upper deck height
const TT = new THREE.Vector3(1.2, UP_Y, -11.2); // turntable centre
const TT_R = 1.0;
const TT_W = 1.3; // rad/s

function pistonExt(t, phase) {
  const p = ((t + phase) % 2.6) / 2.6; // 0..1
  if (p < 0.1) return THREE.MathUtils.smoothstep(p / 0.1, 0, 1);
  if (p < 0.22) return 1;
  if (p < 0.55) return 1 - THREE.MathUtils.smoothstep((p - 0.22) / 0.33, 0, 1);
  return 0;
}

function robot(path, y, seed) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const m = toon(0xd0d6de), dark = toon(0x3a3f4a);
  body.add(mesh(new THREE.BoxGeometry(0.34, 0.3, 0.28), m, { pos: [0, 0.3, 0] }));
  body.add(mesh(new THREE.BoxGeometry(0.26, 0.2, 0.22), m, { pos: [0, 0.57, 0] }));
  body.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02), toon(0x1a2230), { pos: [0, 0.58, 0.115], noOutline: true }));
  for (const s of [-1, 1]) body.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), glow(0x5ff0ff, 3), { pos: [s * 0.05, 0.58, 0.13], noOutline: true }));
  body.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 4), dark, { pos: [0, 0.74, 0], noOutline: true }));
  const bulb = mesh(new THREE.SphereGeometry(0.035, 6, 4), glow(0xff4b4b, 3), { pos: [0, 0.83, 0], noOutline: true });
  body.add(bulb);
  for (const s of [-1, 1]) {
    body.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), dark, { pos: [s * 0.19, 0.08, 0], rot: [0, 0, Math.PI / 2] }));
    body.add(mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), m, { pos: [s * 0.21, 0.32, 0], rot: [0, 0, s * 0.3] }));
  }
  g.add(body);
  const rand = rng(seed);
  let seg = 0, k = 0, wait = rand();
  g.userData.update = (t, dt) => {
    bulb.visible = Math.sin(t * 6 + seed) > 0;
    if (wait > 0) { wait -= dt; body.rotation.z = 0; return; }
    const a = path[seg], b2 = path[(seg + 1) % path.length];
    const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
    k += (dt * 0.6) / Math.max(0.2, len);
    if (k >= 1) { k = 0; seg = (seg + 1) % path.length; wait = 0.8 + rand() * 1.5; }
    g.position.set(a[0] + (b2[0] - a[0]) * k, y, a[1] + (b2[1] - a[1]) * k);
    g.rotation.y = Math.atan2(b2[0] - a[0], b2[1] - a[1]);
    body.rotation.z = Math.sin(t * 14) * 0.03;
  };
  return g;
}

export default {
  name: 'Clockwork Factory',
  par: 4,
  theme: 'factory',
  tip: 'Ride the lift belt up, spin across the gear turntable, and slip past the pistons.',
  env: {
    sky: { top: 0x39476a, horizon: 0xf2a86a, bottom: 0x6a5060, sunDir: [0.6, 0.18, -0.75], sunColor: 0xffb070, sunSize: 2.5, clouds: 0.55, cloudColor: 0xf0c0a0, cloudShade: 0x7a6a80 },
    fog: { color: 0xc89a80, near: 35, far: 140 },
    sun: { color: 0xffcf9a, intensity: 2.3, dir: [0.55, 0.55, -0.45] },
    hemi: { sky: 0xd8e0f4, ground: 0x8a7a6a, intensity: 1.35 },
    bloom: 0.7,
  },
  build(b) {
    const M = {
      metal: toon(0xffffff, { map: textures.metal('#9aa3ae', 1.4) }),
      darkMetal: toon(0xffffff, { map: textures.metal('#6d7580', 1.4) }),
      wall: toon(0xffffff, { map: textures.stripes('#ffcf33', '#2b2b30', 0.5, 45) }),
      cap: toon(0x3a3f4a),
      brass: toon(0xd9a441),
      copper: toon(0xc87a4a),
      side: toon(0xffffff, { map: textures.bricks('#8e5a46', '#5a3a2e', 1.2, 9) }),
    };
    const lane = { width: 2.2, mat: M.metal, sideMat: M.side, wallMat: M.wall, capMat: M.cap, wallSurface: 'metalWall', surface: 'metal' };

    // --- conveyors (animated textures)
    const belts = [];
    const beltMat = (rot) => {
      const tex = textures.conveyor().clone();
      tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1 / 0.8, 1 / 0.8);
      tex.center.set(0.5, 0.5);
      tex.rotation = rot;
      const m = toon(0xffffff, { map: tex });
      belts.push(tex);
      return { m, tex };
    };

    // --- lower lane with a sideways belt
    b.track([[0, 0, 1.3], [0, 0, -2.0]], lane);
    b.wall([[-1.22, 1.3], [1.22, 1.3]], { mat: M.wall, capMat: M.cap, surface: 'metalWall', align: 'right' });
    const side = beltMat(-Math.PI / 2);
    const sideBelt = surface('metal', { roll: 0.08, drag: 1.1, surfaceVel: new THREE.Vector3(1.3, 0, 0), sound: 'metal' });
    b.track([[0, 0, -2.0], [0, 0, -3.6]], { ...lane, mat: side.m, surface: sideBelt });
    b.track([[0, 0, -3.6], [0, 0, -5.0]], lane);

    // --- lift belt up to the upper deck (constant slope so the belt is tangent)
    const liftDir = new THREE.Vector3(0, UP_Y, -4.0).normalize();
    const lift = beltMat(0);
    const liftBelt = surface('metal', { roll: 0.1, drag: 6, surfaceVel: liftDir.clone().multiplyScalar(2.2), sound: 'metal' });
    b.track([[0, 0, -5.0], [0, UP_Y, -9.0]], { ...lane, mat: lift.m, surface: liftBelt, flatEnds: false, wallHeight: 0.3, skirt: 1.4, spacing: 0.1 });

    // --- upper deck with the gear turntable
    const deck = [[-1.1, -9.0], [3.4, -9.0], [3.4, -13.3], [-1.1, -13.3]];
    b.floor(deck, { y: UP_Y, depth: 1.5, holes: [circlePts(TT.x, TT.z, TT_R, 40)], mat: M.metal, sideMat: M.side, surface: 'metal' });
    const WW = { y: UP_Y, mat: M.wall, capMat: M.cap, surface: 'metalWall' };
    b.wall([[1.1, -9.0], [3.4, -9.0], [3.4, -10.55]], { ...WW, align: 'right' });
    b.wall([[3.4, -11.85], [3.4, -13.3], [-1.1, -13.3], [-1.1, -9.0]], { ...WW, align: 'right' });
    const ttVis = new THREE.Group();
    if (b.visual) {
      const gg = gearGeometry({ radius: TT_R + 0.12, teeth: 16, depth: 0.2, toothDepth: 0.14, hole: 0 });
      gg.rotateX(-Math.PI / 2);
      ttVis.add(mesh(gg, M.brass, { pos: [0, -0.112, 0] }));
      const top = new THREE.CircleGeometry(TT_R, 40);
      top.rotateX(-Math.PI / 2);
      ttVis.add(mesh(top, toon(0xffffff, { map: textures.checker('#c9902f', '#e0ad4a', 0.5, 2) }), { pos: [0, 0.002, 0], noOutline: true }));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const sg = new THREE.BoxGeometry(0.9, 0.012, 0.08);
        sg.translate(0.45, 0, 0);
        ttVis.add(mesh(sg, toon(0x7a4f1e), { pos: [0, 0.008, 0], rot: [0, a, 0], noOutline: true }));
      }
      ttVis.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 16), glow(0xffd23f, 1.4), { pos: [0, 0.012, 0], noOutline: true }));
    }
    b.mover({
      object: b.visual ? ttVis : null,
      shapes: [{ type: 'cyl', r: TT_R, h: 0.3, position: [0, -0.15, 0] }],
      surface: surface('metal', { roll: 0.08, drag: 0.8 }),
      update: (t, m) => { m.makeRotationY(-t * TT_W); m.setPosition(TT.x, TT.y, TT.z); },
    });

    // --- catwalk with pistons, bending into the down ramp
    b.track([[3.38, UP_Y, -11.2], [6.0, UP_Y, -11.2], [6.8, UP_Y, -11.0], [7.2, UP_Y, -10.4], [7.2, UP_Y, -9.6]], { ...lane, width: 1.3, skirt: 0.25, spacing: 0.1 });
    b.track([[7.2, UP_Y, -9.6], [7.2, 0, -5.6]], { ...lane, width: 1.3, skirt: 1.4, spacing: 0.12 });
    const pistons = [];
    for (const [px, phase] of [[4.5, 0], [5.6, 1.3]]) {
      const pv = new THREE.Group();
      if (b.visual) {
        pv.add(mesh(new THREE.BoxGeometry(0.55, 0.28, 0.95), M.darkMetal));
        pv.add(mesh(new THREE.BoxGeometry(0.56, 0.29, 0.04), toon(0xffffff, { map: textures.stripes('#ffcf33', '#2b2b30', 0.25, 45) }), { pos: [0, 0, 0.48], noOutline: true }));
        pv.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 10), toon(0xdfe4ea), { pos: [0, 0, -0.9], rot: [Math.PI / 2, 0, 0] }));
      }
      b.mover({
        object: b.visual ? pv : null,
        shapes: [{ type: 'box', size: [0.55, 0.28, 0.95] }],
        surface: 'metalWall',
        update: (t, m) => { m.makeTranslation(px, UP_Y + 0.15, -12.35 + pistonExt(t, phase) * 0.8); },
      });
      pistons.push({ px, phase, last: 0 });
    }

    // --- green below
    const arcG = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; arcG.push([7.2 + Math.cos(a) * 1.4, -2.6 + Math.sin(a) * 1.4]); }
    const green = [[5.8, -5.6], [8.6, -5.6], ...arcG];
    b.floor(green, { y: 0, holes: [Builder.cupHole(7.2, -2.6)], mat: toon(0xffffff, { map: textures.fairway('#5cc86a', '#50bb5e', 2) }), sideMat: M.side });
    b.wall([[7.85, -5.6], [8.6, -5.6], ...arcG, [5.8, -5.6], [6.55, -5.6]], { mat: M.wall, capMat: M.cap, surface: 'metalWall', align: 'left' });
    b.cup(7.2, 0, -2.6, { flagColor: 0xffcf33, poleColor: 0x3a3f4a });

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, 0, -5], [0, UP_Y, -9], [TT.x, UP_Y, -11.2], [6.0, UP_Y, -11.2], [7.2, UP_Y, -9.6], [7.2, 0, -5.6], [7.2, 0, -2.6]]);
    b.camHint([-1.2, -0.5, -9.2], [1.2, 1.6, -4.8], [-2.8, 2.6, -4.2], [0, 1, -8]);

    // --- scenery
    ground(b, { y: -0.3, color: 0xb0aaa2, map: textures.tiles('#b8b0a6', '#aaa298', 2, 2), hills: 2, hillStart: 20 });
    const onCourse = courseMask(b, 0.8);

    if (b.visual) {
      // animate belts, pistons sounds
      b.animate((dt, t) => {
        side.tex.offset.x = (t * 1.3) / 0.8;
        lift.tex.offset.y = -(t * 2.2) / 0.8;
        for (const p of pistons) {
          const e = pistonExt(t, p.phase);
          if (e > 0.9 && p.last <= 0.9) b.world.emit('sound', { name: 'clank' });
          p.last = e;
        }
      });
      // piston housings behind the catwalk
      const housing = new THREE.Group();
      for (const px of [4.5, 5.6]) housing.add(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.9), M.darkMetal, { pos: [px, UP_Y + 0.2, -12.85] }));
      housing.add(mesh(new THREE.BoxGeometry(2.4, 0.2, 1.1), M.cap, { pos: [5.05, UP_Y - 0.15, -12.8] }));
      // catwalk support pillars
      for (const [x, z] of [[4.2, -11.2], [5.9, -11.2], [7.2, -9.8], [7.2, -8.2], [7.2, -7.0]]) housing.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, UP_Y + 0.3, 8), M.darkMetal, { pos: [x, (UP_Y - 0.3) / 2 - 0.15, z] }));
      b.addStaticObject(housing);

      // giant wall gears (spinning)
      const gears = [];
      const gearSpecs = [[-3.2, 2.4, -8, 1.6, 0.3, 18], [-3.0, 1.2, -4.5, 1.0, -0.48, 12], [-3.1, 3.5, -5.8, 0.8, 0.6, 10], [10.2, 2.2, -8.5, 1.8, -0.25, 20], [10.0, 3.6, -5.8, 0.9, 0.5, 11], [3.0, 3.8, -15.4, 2.2, 0.2, 22], [0.4, 2.6, -15.3, 1.1, -0.4, 12]];
      for (const [x, y, z, r, speed, teeth] of gearSpecs) {
        const gm = mesh(gearGeometry({ radius: r, teeth, depth: 0.22, toothDepth: r * 0.14, hole: r * 0.18 }), [M.brass, M.copper][teeth % 2]);
        gm.position.set(x, y, z);
        if (Math.abs(x) > 5 || x < -2) gm.rotation.y = Math.PI / 2;
        const grp = new THREE.Group();
        grp.add(gm);
        grp.add(mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.3, 12), M.darkMetal, { pos: [x, y, z], rot: [Math.abs(x) > 5 || x < -2 ? 0 : Math.PI / 2, 0, Math.abs(x) > 5 || x < -2 ? Math.PI / 2 : 0] }));
        b.add(grp, { outline: true });
        gears.push({ gm, speed, axisY: Math.abs(x) > 5 || x < -2 });
      }
      b.animate((dt, t) => { for (const g of gears) g.gm.rotation.z = t * g.speed; });

      // back walls of the factory
      const walls = new THREE.Group();
      const brick = toon(0xffffff, { map: textures.bricks('#a35e44', '#6e3f2e', 1.4, 13) });
      walls.add(mesh(new THREE.BoxGeometry(18, 6, 0.5), brick, { pos: [3.5, 2.7, -16.2] }));
      walls.add(mesh(new THREE.BoxGeometry(0.5, 6, 20), brick, { pos: [-4.2, 2.7, -6] }));
      walls.add(mesh(new THREE.BoxGeometry(0.5, 6, 20), brick, { pos: [11.2, 2.7, -6] }));
      for (let i = 0; i < 5; i++) {
        walls.add(mesh(new THREE.BoxGeometry(1.4, 1.6, 0.1), glow(0xffc070, 1.3), { pos: [-2.5 + i * 3.4, 3.8, -15.9], noOutline: true }));
        for (const dx of [-0.35, 0.35]) walls.add(mesh(new THREE.BoxGeometry(0.06, 1.6, 0.12), M.cap, { pos: [-2.5 + i * 3.4 + dx, 3.8, -15.88], noOutline: true }));
      }
      // chimneys
      for (const [x, z] of [[-1, -17.5], [6, -17.8]]) walls.add(mesh(new THREE.CylinderGeometry(0.7, 0.9, 9, 12), brick, { pos: [x, 4.2, z] }));
      // pipes
      walls.add(pipe({ from: [-3.8, 0.5, 1], to: [-3.8, 0.5, -15.5], radius: 0.18, color: 0xc87a4a }));
      walls.add(pipe({ from: [-3.8, 4.8, -15.8], to: [10.8, 4.8, -15.8], radius: 0.22, color: 0xb8913a }));
      walls.add(pipe({ from: [10.8, 0.4, 1], to: [10.8, 0.4, -15.5], radius: 0.16, color: 0xc87a4a }));
      walls.add(pipe({ from: [2.4, -0.3, -13.8], to: [2.4, 4.8, -15.6], radius: 0.14, color: 0xb8913a }));
      b.addStaticObject(walls, { castShadow: false });
      for (const [x, z] of [[-1, -17.5], [6, -17.8]]) live(b, ambientParticles({ count: 60, area: [1.5, 8, 1.5], center: [x, 12.5, z], color: 0x8a8490, size: 1.2, mode: 'embers', opacity: 0.55 }), { outline: false, shadow: false });

      // blinking warning lamps
      const blinkers = [];
      for (const [x, y, z] of [[3.5, UP_Y + 0.5, -9.0], [3.5, UP_Y + 0.5, -13.4], [-1.25, 0.5, -5.0], [1.25, 0.5, -5.0], [8.7, 0.5, -5.6]]) {
        const bl = mesh(new THREE.SphereGeometry(0.09, 10, 8), glow(0xff5a1a, 3.5), { pos: [x, y, z], noOutline: true, noShadow: true });
        const basePole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), M.cap, { pos: [x, y - 0.25, z] });
        b.group.add(bl); b.group.add(basePole);
        blinkers.push(bl);
      }
      b.animate((dt, t) => blinkers.forEach((bl, i) => { bl.visible = Math.sin(t * 5 + i * 1.7) > -0.2; }));

      // clutter
      const clutter = new THREE.Group();
      for (const [x, z, s] of [[2.2, 0.4, 0.5], [2.7, -0.3, 0.4], [2.4, 1.0, 0.45], [-2.3, -1.2, 0.55], [4.6, -3.3, 0.5]]) {
        const c = crate({ size: s, color: 0xb08650 }); c.position.set(x, -0.3, z); c.rotation.y = x * 2; clutter.add(c);
      }
      for (const [x, z] of [[-2.2, 1.0], [-2.5, 0.3], [4.2, -4.4]]) { const br = barrel({ color: 0x3a6a9a, band: 0x222228 }); br.position.set(x, -0.3, z); br.scale.setScalar(0.7); clutter.add(br); }
      b.addStaticObject(clutter);
      live(b, robot([[2.4, -1.2], [4.6, -1.4], [4.8, 1.2], [2.8, 2.0]], -0.3, 3));
      live(b, robot([[-2.6, -3.0], [-2.6, -8.0]], -0.3, 7));
      const l1 = lamp({ height: 2.6, bulb: 0xffd8a0 }); l1.position.set(-2.4, -0.3, -2.5); b.add(l1, { outline: true });
      const l2 = lamp({ height: 2.6, bulb: 0xffd8a0 }); l2.position.set(4.6, -0.3, -6.8); b.add(l2, { outline: true });
    }
    horizon(b, { radius: 110, count: 12, color: 0x7a6a7a, snowCaps: false, height: 20, seed: 17 });
  },
};
