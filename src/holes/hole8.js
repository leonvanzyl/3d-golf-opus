// Hole 8 — Cosmic Portal: loop-the-loop and a jump across the void, or a narrow bridge to a portal.
import * as THREE from 'three';
import { toon, textures, glow } from '../engine/materials.js';
import { Builder, roundRectPts, bakeGroup, rectPts } from '../course/Builder.js';
import { mesh, rng, blob, ambientParticles } from '../course/props.js';
import { live } from '../course/decor.js';
import { portalMaterial, beamMaterial } from '../engine/shaders.js';
import { portalZone } from '../physics/Physics.js';

const LOOP_E = [0, 0, -6.0];
const LAT = 1.3;
const CUP = [1.35, 0, -15.4];
const PORTAL_A = [-4.45, 0.07, 0];
const PORTAL_B = [-0.1, 0.07, -13.0];

function portalGate(color1, color2) {
  const g = new THREE.Group();
  const disc = mesh(new THREE.CircleGeometry(0.42, 32), portalMaterial(color1, color2), { noOutline: true, noShadow: true });
  disc.position.y = 0.45;
  g.add(disc);
  const ring = mesh(new THREE.TorusGeometry(0.46, 0.06, 10, 32), glow(color2, 2.2), { pos: [0, 0.45, 0], noOutline: true, noShadow: true });
  g.add(ring);
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 0.3), toon(0x3a3f5a), { pos: [0, 0.03, 0] }));
  g.userData.update = (t) => { disc.rotation.z = -t * 2; ring.rotation.z = t * 0.5; };
  return g;
}

function planet(r, color, ringColor = null) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(r, 32, 20), toon(color, { rim: 0.6 }), { noOutline: true, noShadow: true }));
  if (ringColor) {
    const rg = new THREE.RingGeometry(r * 1.35, r * 2.0, 48);
    rg.rotateX(-Math.PI / 2);
    g.add(mesh(rg, toon(ringColor, { side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), { rot: [0.35, 0, 0.2], noOutline: true, noShadow: true }));
  }
  return g;
}

function ufo() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const hull = new THREE.SphereGeometry(0.9, 24, 12);
  hull.scale(1, 0.28, 1);
  body.add(mesh(hull, toon(0xc7ccd8)));
  body.add(mesh(new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8ff0ff, { transparent: true, opacity: 0.7 }), { pos: [0, 0.12, 0] }));
  const alien = new THREE.Group();
  alien.add(mesh(new THREE.SphereGeometry(0.16, 12, 10), toon(0x7dff6a), { pos: [0, 0.3, 0] }));
  for (const s of [-1, 1]) alien.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), toon(0x111111), { pos: [s * 0.06, 0.33, 0.13], noOutline: true }));
  alien.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 4), toon(0x7dff6a), { pos: [0, 0.5, 0], noOutline: true }));
  alien.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), glow(0xff6ad5, 3), { pos: [0, 0.58, 0], noOutline: true }));
  body.add(alien);
  const lights = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const l = mesh(new THREE.SphereGeometry(0.06, 6, 4), glow([0xffd23f, 0x5ff0ff, 0xff6ad5][i % 3], 3), { pos: [Math.cos(a) * 0.82, -0.02, Math.sin(a) * 0.82], noOutline: true, noShadow: true });
    body.add(l);
    lights.push(l);
  }
  g.add(body);
  const beamG = new THREE.CylinderGeometry(0.25, 0.9, 3.2, 20, 1, true);
  beamG.translate(0, -1.7, 0);
  const beam = mesh(beamG, beamMaterial(0x7cf7ff, 0.8), { noOutline: true, noShadow: true });
  g.add(beam);
  g.userData.update = (t) => {
    body.rotation.y = t * 1.2;
    lights.forEach((l, i) => { l.visible = Math.sin(t * 8 - i) > -0.3; });
    beam.visible = Math.sin(t * 0.5) > -0.2;
  };
  return g;
}

function asteroidUnder(w, d, seed) {
  // rocky underside for floating platforms
  const g = new THREE.Group();
  const rand = rng(seed);
  const m = toon(0x6a5f7e);
  for (let i = 0; i < 5; i++) {
    const s = 0.5 + rand() * 0.5;
    const r = Math.min(w, d) * 0.35 * s;
    // keep the top of each rock below the platform slab
    const bm = mesh(blob(r, 1, seed * 3 + i, 0.25), m, { pos: [(rand() - 0.5) * w * 0.6, -0.42 - r * 0.8 * 1.25 - rand() * 0.3, (rand() - 0.5) * d * 0.6], scale: [1.2, 0.8, 1.2] });
    g.add(bm);
  }
  const cryst = glow(0xb68cff, 1.8);
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.OctahedronGeometry(0.12, 0), cryst, { pos: [(rand() - 0.5) * w * 0.7, -0.4 - rand() * 0.6, (rand() - 0.5) * d * 0.7], scale: [0.6, 1.8, 0.6], noOutline: true, noShadow: true }));
  return g;
}

export default {
  name: 'Cosmic Portal',
  par: 4,
  theme: 'space',
  obMessage: 'Lost in space!',
  tip: 'Power through the loop and jump the void — or thread the narrow bridge into the portal.',
  env: {
    sky: { top: 0x05040f, horizon: 0x1b1540, bottom: 0x0a0820, sunDir: [-0.5, 0.4, -0.7], sunColor: 0xcfe0ff, sunSize: 0.8, clouds: 0, stars: 1.2, nebula: 1 },
    fog: { color: 0x120e30, near: 60, far: 220 },
    sun: { color: 0xdfe6ff, intensity: 2.3, dir: [-0.4, 0.7, 0.3] },
    hemi: { sky: 0x9f8cff, ground: 0x3a2a6a, intensity: 1.2 },
    bloom: 1.0,
  },
  build(b) {
    const M = {
      floor: toon(0xffffff, { map: textures.spacePanel('#23265a', '#59e8ff', 1.2) }),
      floor2: toon(0xffffff, { map: textures.spacePanel('#2c1f55', '#ff6ad5', 1.2) }),
      under: toon(0x3a3f5a),
      neon: glow(0x59e8ff, 1.7),
      neonPink: glow(0xff6ad5, 1.7),
      cap: glow(0xffffff, 1.3),
      track: toon(0xffffff, { map: textures.spacePanel('#1c3a5a', '#7dff6a', 0.8) }),
    };
    const neonWalls = { wallMat: M.neon, capMat: M.cap, wallSurface: 'metalWall' };

    // --- tee platform
    b.floor(rectPts(-1.4, -2.5, 1.4, 1.2), { y: 0, depth: 0.4, mat: M.floor, sideMat: M.under, surface: 'metal' });
    const WW = { mat: M.neon, capMat: M.cap, surface: 'metalWall' };
    b.wall([[1.4, 1.2], [-1.4, 1.2]], { ...WW, align: 'left' });
    b.wall([[-1.4, 1.2], [-1.4, 0.275]], { ...WW, align: 'left' });
    b.wall([[-1.4, -0.275], [-1.4, -2.5], [-0.5, -2.5]], { ...WW, align: 'left' });
    b.wall([[0.5, -2.5], [1.4, -2.5], [1.4, 1.2]], { ...WW, align: 'left' });

    // --- main route: lane -> loop -> kicker
    b.track([[0, 0, -2.5], [0, 0, -5.0]], { width: 1.0, mat: M.track, sideMat: M.under, ...neonWalls, surface: 'track' });
    b.loop({ entry: LOOP_E, yaw: 0, radius: 1.05, lateral: LAT, leadIn: 1.0, leadOut: 1.2, width: 1.0, mat: M.track, sideMat: M.under, ...neonWalls, surface: 'track', wallHeight: 0.32, skirt: 0.12 });
    const kx = LAT;
    b.track([[kx, 0, -7.2], [kx, 0, -9.0], [kx, 0.08, -9.8], [kx, 0.36, -10.5]], { width: 1.0, mat: M.track, sideMat: M.under, ...neonWalls, surface: 'track', flatEnds: false, spacing: 0.1 });

    // --- landing platform (green)
    const green = roundRectPts(-0.8, -17.4, 3.5, -12.3, 0.8);
    b.floor(green, { y: 0, depth: 0.4, holes: [Builder.cupHole(CUP[0], CUP[2])], mat: M.floor2, sideMat: M.under, surface: 'felt' });
    b.wall(green, { closed: true, mat: M.neonPink, capMat: M.cap, surface: 'metalWall', height: 0.1, align: 'left', embed: 0.06 });
    // tall backboard at the far end catches long jumps
    b.wall([[3.5, -16.5], [3.5, -17.4], [-0.8, -17.4], [-0.8, -16.5]], { mat: M.neonPink, capMat: M.cap, surface: 'metalWall', height: 0.6, align: 'left' });
    b.cup(CUP[0], 0, CUP[2], { flagColor: 0x7dff6a, poleColor: 0xcfd6ff });

    // --- portal route: a narrow bridge with no rails, guarded by a sliding block
    b.track([[-1.38, 0, 0], [-3.92, 0, 0]], { width: 0.55, walls: 'none', mat: M.track, sideMat: M.under, surface: 'track', skirt: 0.1 });
    b.floor(rectPts(-4.95, -0.5, -3.9, 0.5), { y: 0, depth: 0.35, mat: M.floor, sideMat: M.under, surface: 'metal' });
    b.wall([[-3.9, 0.5], [-4.95, 0.5], [-4.95, -0.5], [-3.9, -0.5]], { ...WW, align: 'right' });
    // exit aims a little left of the cup: close, but you still have to putt
    b.world.addZone(portalZone(PORTAL_A, 0.4, PORTAL_B, [CUP[0] - 0.75 - PORTAL_B[0], 0, CUP[2] + 0.2 - PORTAL_B[2]], { minSpeed: 1.2 }));
    const blockVis = new THREE.Group();
    if (b.visual) {
      blockVis.add(mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), toon(0x3a3f5a)));
      blockVis.add(mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), glow(0xff6ad5, 2.2), { noOutline: true }));
    }
    b.mover({
      object: b.visual ? blockVis : null,
      shapes: [{ type: 'box', size: [0.34, 0.34, 0.34] }],
      surface: 'metalWall',
      update: (t, m) => { m.makeRotationY(t * 0.8); m.setPosition(-2.65, 0.17, Math.sin(t * 2.1) * 1.0); },
    });

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, 0, -5.0], [LAT, 0, -7.2], [LAT, 0.36, -10.5], [LAT, 0, -12.8], [CUP[0], 0, CUP[2]]]);
    b.outOfBounds(-2.2);

    if (b.visual) {
      const pa = portalGate(0x9b5cff, 0x3ee8ff);
      pa.position.set(-4.62, 0, 0);
      pa.rotation.y = Math.PI / 2;
      live(b, pa, { outline: false });
      const pb = portalGate(0x3ee8ff, 0x9b5cff);
      pb.position.set(PORTAL_B[0] - 0.25, 0, PORTAL_B[2] + 0.35);
      pb.rotation.y = Math.atan2(CUP[0] - PORTAL_B[0], CUP[2] - PORTAL_B[2]) + Math.PI;
      live(b, pb, { outline: false });

      // rocky undersides
      const rocks = new THREE.Group();
      const u1 = asteroidUnder(2.8, 3.7, 1); u1.position.set(0, 0, -0.65); rocks.add(u1);
      const u2 = asteroidUnder(4.3, 5.1, 2); u2.position.set(1.35, 0, -14.85); rocks.add(u2);
      const u3 = asteroidUnder(1.1, 1.0, 3); u3.position.set(-4.4, 0, 0); rocks.add(u3);
      const u4 = asteroidUnder(2.4, 5.5, 4); u4.position.set(0.65, 0, -7.3); rocks.add(u4);
      b.addStaticObject(rocks, { castShadow: false });

      // planets & moons
      const p1 = planet(14, 0xff9a5a, 0xffd9a8); p1.position.set(-60, 18, -90); b.group.add(p1);
      const p2 = planet(6, 0x5ab8ff); p2.position.set(55, 30, -70); b.group.add(p2);
      const p3 = planet(3, 0xb68cff, 0xffffff); p3.position.set(35, 10, 40); b.group.add(p3);
      const moon = planet(1.2, 0xd8d8e8); b.group.add(moon);
      b.animate((dt, t) => {
        moon.position.set(55 + Math.cos(t * 0.2) * 12, 30 + Math.sin(t * 0.2) * 3, -70 + Math.sin(t * 0.2) * 12);
        p1.rotation.y = t * 0.02;
      });

      // floating asteroids
      const floaters = [];
      const fr = rng(7);
      for (let i = 0; i < 18; i++) {
        const a = fr() * Math.PI * 2, r = 7 + fr() * 14;
        const s = 0.3 + fr() * 1.1;
        const ast = mesh(blob(s, 1, i + 90, 0.3), toon([0x6a5f7e, 0x7e6f5f, 0x5f6a7e][i % 3]), { noShadow: true });
        ast.position.set(Math.cos(a) * r, -3 + fr() * 8, -7 + Math.sin(a) * r);
        b.group.add(ast);
        floaters.push({ ast, sp: (fr() - 0.5) * 0.6, base: ast.position.y, ph: fr() * 6 });
      }
      b.animate((dt, t) => { for (const f of floaters) { f.ast.rotation.x = t * f.sp; f.ast.rotation.y = t * f.sp * 0.7; f.ast.position.y = f.base + Math.sin(t * 0.4 + f.ph) * 0.3; } });

      const u = ufo();
      live(b, u);
      b.animate((dt, t) => { u.position.set(CUP[0] + Math.cos(t * 0.3) * 3.2, 3.6 + Math.sin(t * 0.9) * 0.25, CUP[2] - 1 + Math.sin(t * 0.3) * 2.2); });
      live(b, ambientParticles({ count: 400, area: [40, 16, 40], center: [0, 2, -7], color: 0xcfe0ff, size: 0.06, mode: 'stars' }), { outline: false, shadow: false });

      // satellite
      const sat = new THREE.Group();
      sat.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), toon(0xd9a441)));
      for (const s of [-1, 1]) sat.add(mesh(new THREE.BoxGeometry(1.4, 0.04, 0.6), toon(0x2a4a9a), { pos: [s * 0.95, 0, 0] }));
      sat.add(mesh(new THREE.ConeGeometry(0.3, 0.3, 12, 1, true), toon(0xffffff, { side: THREE.DoubleSide }), { pos: [0, 0.4, 0] }));
      live(b, sat);
      b.animate((dt, t) => { sat.position.set(-7 + Math.sin(t * 0.15) * 2, 5, -12 + Math.cos(t * 0.15) * 2); sat.rotation.set(t * 0.2, t * 0.3, 0); });
    }
  },
};
