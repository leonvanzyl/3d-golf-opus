// Hole 5 — Frosty Peaks: a slippery ice slalom, a banked hairpin and a glittering ice cave.
import * as THREE from 'three';
import { toon, textures, glow } from '../engine/materials.js';
import { Builder, roundRectPts, bakeGroup } from '../course/Builder.js';
import { pineTree, rock, penguin, mesh, rng, ambientParticles, blob } from '../course/props.js';
import { ground, scatter, live, horizon, courseMask } from '../course/decor.js';

function snowman(seed) {
  const g = new THREE.Group();
  const snow = toon(0xf7fbff);
  g.add(mesh(blob(0.34, 1, seed, 0.04), snow, { pos: [0, 0.3, 0] }));
  const upper = new THREE.Group();
  upper.position.y = 0.6;
  upper.add(mesh(blob(0.25, 1, seed + 1, 0.04), snow, { pos: [0, 0.18, 0] }));
  const head = new THREE.Group();
  head.position.y = 0.5;
  head.add(mesh(blob(0.18, 1, seed + 2, 0.03), snow));
  head.add(mesh(new THREE.ConeGeometry(0.035, 0.2, 6), toon(0xff8a1f), { pos: [0, 0, 0.26], rot: [Math.PI / 2, 0, 0], noOutline: true }));
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), toon(0x1a1a22), { pos: [s * 0.065, 0.05, 0.16], noOutline: true }));
  head.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 12), toon(0x22222a), { pos: [0, 0.14, 0] }));
  head.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 12), toon(0x22222a), { pos: [0, 0.23, 0] }));
  head.add(mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.04, 12), toon(0xd93a3a), { pos: [0, 0.17, 0], noOutline: true }));
  upper.add(head);
  for (let i = 0; i < 3; i++) upper.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), toon(0x1a1a22), { pos: [0, 0.3 - i * 0.1, 0.23], noOutline: true }));
  upper.add(mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 14), toon(0xd93a3a), { pos: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0] }));
  for (const s of [-1, 1]) upper.add(mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.45, 4), toon(0x6b4226), { pos: [s * 0.35, 0.25, 0], rot: [0, 0, s * 1.0] }));
  g.add(upper);
  const ph = rng(seed)() * 6;
  g.userData.update = (t) => {
    upper.rotation.z = Math.sin(t * 1.5 + ph) * 0.05;
    head.rotation.y = Math.sin(t * 0.6 + ph) * 0.35;
  };
  return g;
}

function igloo() {
  const g = new THREE.Group();
  const ice = toon(0xffffff, { map: textures.bricks('#f2f8ff', '#b9d4ee', 0.9, 7) });
  const dome = new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(mesh(dome, ice));
  const tun = new THREE.CylinderGeometry(0.6, 0.6, 1.1, 14, 1, true, 0, Math.PI);
  tun.rotateZ(Math.PI / 2); tun.rotateY(Math.PI / 2);
  g.add(mesh(tun, ice, { pos: [0, 0, 1.55] }));
  g.add(mesh(new THREE.CircleGeometry(0.5, 14, 0, Math.PI), toon(0x1a2a44), { pos: [0, 0.01, 2.1], noOutline: true }));
  return g;
}

function crystal(color, s) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.OctahedronGeometry(0.25 * s, 0), glow(color, 1.8), { scale: [0.6, 1.8, 0.6], pos: [0, 0.4 * s, 0], noShadow: true }));
  g.add(mesh(new THREE.OctahedronGeometry(0.15 * s, 0), glow(color, 1.8), { scale: [0.6, 1.8, 0.6], pos: [0.2 * s, 0.25 * s, 0.05], rot: [0, 0, -0.5], noShadow: true }));
  g.add(mesh(new THREE.OctahedronGeometry(0.13 * s, 0), glow(color, 1.8), { scale: [0.6, 1.8, 0.6], pos: [-0.18 * s, 0.22 * s, -0.05], rot: [0, 0, 0.6], noShadow: true }));
  return g;
}

export default {
  name: 'Frosty Peaks',
  par: 3,
  theme: 'ice',
  tip: 'The ice is slippery! Weave past the snowmen, ride the banked hairpin, then glide through the ice cave.',
  env: {
    sky: { top: 0x081634, horizon: 0x3d6f9e, bottom: 0x1f3a5c, sunDir: [0.35, 0.32, -0.85], sunColor: 0xe8f0ff, sunSize: 2.2, clouds: 0.2, cloudColor: 0x9ab8d8, cloudShade: 0x4a6a8e, stars: 1, aurora: 1 },
    fog: { color: 0x3d6f9e, near: 35, far: 140 },
    sun: { color: 0xd0e0ff, intensity: 1.9, dir: [0.45, 0.6, -0.4] },
    hemi: { sky: 0x98b8f0, ground: 0xc8d8f0, intensity: 1.05 },
    bloom: 0.8,
  },
  build(b) {
    const M = {
      snowFelt: toon(0xffffff, { map: textures.snow(1.6) }),
      ice: toon(0xffffff, { map: textures.ice('#b8e6ff', 3) }),
      wall: toon(0x7fc8ff),
      cap: toon(0xffffff),
      cliff: toon(0xffffff, { map: textures.bricks('#dcecff', '#9fbfe0', 1.6, 11) }),
      caveIce: toon(0xa8e4ff, { transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    };
    const base = { sideMat: M.cliff, wallMat: M.wall, capMat: M.cap, skirt: 1.3 };

    // --- tee pad (packed snow)
    b.track([[0, 0, 1.3], [0, 0, -1.5]], { ...base, width: 2.4, mat: M.snowFelt, surface: 'felt' });
    b.wall([[-1.32, 1.3], [1.32, 1.3]], { mat: M.wall, capMat: M.cap, align: 'right' });

    // --- ice slalom, gently downhill
    b.track([[0, 0, -1.5], [0, -0.25, -5], [0, -0.5, -8.6]], { ...base, width: 2.4, mat: M.ice, surface: 'ice', wallSurface: 'metalWall', spacing: 0.15 });

    // --- banked hairpin (left turn, outside edge raised)
    const C = [-2.3, -8.6], R = 2.3;
    const turn = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; turn.push([C[0] + Math.cos(a) * R, -0.5, C[1] - Math.sin(a) * R]); }
    b.track(turn, { ...base, width: 2.4, mat: M.ice, surface: 'ice', wallSurface: 'metalWall', bank: (u) => 0.26 * Math.sin(Math.PI * u), wallHeight: 0.3, spacing: 0.12 });

    // --- ice cave passage (snow, slows the ball) and the green
    b.track([[-4.6, -0.5, -8.6], [-4.6, -0.5, -5.2]], { ...base, width: 2.4, mat: M.snowFelt, surface: 'felt' });
    // square where the cave passage joins, rounded at the far end
    const arcA = [], arcB = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      arcA.push([-4.5 + Math.cos(a) * 1.1, -0.5 + Math.sin(a) * 1.1]);
      arcB.push([-4.7 + Math.cos(a + Math.PI / 2) * 1.1, -0.5 + Math.sin(a + Math.PI / 2) * 1.1]);
    }
    const green = [[-5.8, -5.2], [-3.4, -5.2], ...arcA, ...arcB];
    b.floor(green, { y: -0.5, holes: [Builder.cupHole(-4.6, -0.7)], mat: M.snowFelt, sideMat: M.cliff, depth: 1.3 });
    b.wall([[-3.4, -5.2], ...arcA, ...arcB, [-5.8, -5.2]], { y: -0.5, mat: M.wall, capMat: M.cap, align: 'left' });
    b.cup(-4.6, -0.5, -0.7, { flagColor: 0x2d8cff });

    // snowmen obstacles on the ice
    const snowmen = [[-0.5, -3.9, 1], [0.62, -5.8, 2], [-0.3, -7.6, 3]];
    for (const [x, z, s] of snowmen) {
      const y = b.world.heightAt(x, z, 5, true);
      b.cylinder([x, y - 0.05, z], 0.3, 0.95, { mat: null, surface: 'softWall', physics: true, outline: false });
      if (b.visual) {
        const sm = snowman(s * 5);
        sm.position.set(x, y, z);
        sm.rotation.y = Math.PI + (s - 2) * 0.4;
        live(b, sm);
      }
    }

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, -0.25, -5], [0, -0.5, -8.6], [-2.3, -0.5, -10.9], [-4.6, -0.5, -8.6], [-4.6, -0.5, -0.7]]);

    // --- scenery
    ground(b, { y: -1.1, color: 0xf2f7ff, map: textures.snow(4), hills: 5, hillStart: 14,
      bumps: [{ x: -2.3, z: -3.5, r: 2.2, h: 0.35, plateau: 0.3 }] });
    const onCourse = courseMask(b, 0.9);

    if (b.visual) {
      // ice cave arch over the passage
      const cave = new THREE.Group();
      const arch = new THREE.CylinderGeometry(1.5, 1.5, 3.2, 20, 1, true, -Math.PI / 2, Math.PI);
      arch.rotateX(-Math.PI / 2);
      arch.translate(-4.6, -0.5, -6.9);
      cave.add(mesh(arch, M.caveIce, { noShadow: true }));
      const rimG = new THREE.TorusGeometry(1.5, 0.12, 6, 20, Math.PI);
      for (const z of [-8.5, -5.3]) cave.add(mesh(rimG.clone().translate(0, 0, 0), toon(0xdff4ff), { pos: [-4.6, -0.5, z] }));
      const rand = rng(4);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * (0.1 + 0.8 * (i / 13));
        const z = i % 2 ? -8.5 : -5.3;
        const len = 0.2 + rand() * 0.35;
        cave.add(mesh(new THREE.ConeGeometry(0.05, len, 5), toon(0xe6f7ff), { pos: [-4.6 + Math.cos(a) * 1.42, -0.5 + Math.sin(a) * 1.42 - len / 2, z], rot: [Math.PI, 0, 0], noOutline: true }));
      }
      b.addStaticObject(cave, { castShadow: false });
      for (const [x, z, s, col] of [[-6.4, -7.4, 1.2, 0x5ff0ff], [-2.9, -6.2, 0.9, 0xb68cff], [-6.3, -5.8, 0.8, 0x5ff0ff], [2.2, -8.8, 1.1, 0xb68cff], [-7.6, 0.5, 1.3, 0x5ff0ff]]) {
        const cr = crystal(col, s);
        cr.position.set(x, b.terrainHeight(x, z), z);
        cr.rotation.y = x;
        b.addStaticObject(cr, { castShadow: false });
      }
      const ig = igloo();
      ig.position.set(-8.4, b.terrainHeight(-8.4, -2.5), -2.5);
      ig.rotation.y = 1.3;
      b.addStaticObject(ig);
      // frozen pond
      const pond = new THREE.Mesh(new THREE.CircleGeometry(3, 28), toon(0xffffff, { map: textures.ice('#9fd8f5', 2) }));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(5.5, b.terrainHeight(5.5, -3) + 0.03, -3);
      pond.receiveShadow = true;
      b.group.add(pond);
      // snowdrifts
      const drifts = new THREE.Group();
      const dr = rng(8);
      for (let i = 0; i < 14; i++) {
        const a = dr() * Math.PI * 2, r = 4 + dr() * 10;
        const x = -2 + Math.cos(a) * r, z = -4 + Math.sin(a) * r;
        if (onCourse(x, z)) continue;
        const d = mesh(blob(0.5 + dr() * 0.6, 1, i + 40, 0.1), toon(0xf7fbff), { scale: [1.4, 0.45, 1.1] });
        d.position.set(x, b.terrainHeight(x, z) - 0.05, z);
        drifts.add(d);
      }
      b.addStaticObject(drifts);
      live(b, ambientParticles({ count: 900, area: [36, 12, 36], center: [-2, 4, -4], color: 0xffffff, size: 0.05, mode: 'snow' }), { outline: false, shadow: false });
      live(b, penguin({ path: [[3.5, -1.5], [6.5, -2], [7, -4.5], [4, -4.8]], y: b.terrainHeight(5.5, -3) + 0.03, seed: 1 }));
      live(b, penguin({ path: [[-7.5, -4.5], [-7.2, -0.8]], y: b.terrainHeight(-7.4, -2.6), seed: 2 }));
      live(b, penguin({ path: [[2.8, -10.5], [4, -12], [2.5, -12.5]], y: b.terrainHeight(3.2, -11.5), seed: 3 }));
    }

    scatter(b, { count: 22, rMin: 4, rMax: 20, center: [-2, -4], mask: (x, z) => onCourse(x, z) || Math.hypot(x - 5.5, z + 3) < 3.4 || Math.hypot(x + 8.4, z + 2.5) < 2.5, seed: 17, minDist: 1.8,
      make: (r, x, z, i) => pineTree({ height: 2.5 + r() * 2.5, radius: 0.8 + r() * 0.5, snow: true, leaves: [0x2e8b57, 0x2a7d5a, 0x35946a][i % 3], seed: i }) });
    scatter(b, { count: 8, rMin: 4, rMax: 15, center: [-2, -4], mask: onCourse, seed: 27,
      make: (r, x, z, i) => rock({ size: 0.3 + r() * 0.4, color: 0x8fa3bf, seed: i + 50 }) });
    horizon(b, { radius: 110, count: 15, color: 0x6f8fb8, snow: 0xffffff, height: 34, seed: 5 });
  },
};
