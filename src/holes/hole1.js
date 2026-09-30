// Hole 1 — Sunny Meadow: a gentle warm-up over a grassy hump and a brook bridge.
import * as THREE from 'three';
import { toon, textures } from '../engine/materials.js';
import { Builder, circlePts, rectPts } from '../course/Builder.js';
import { tree, bush, rock, bunny, butterfly, bird, sign, waterfall, frog, mushroom, duck } from '../course/props.js';
import { ground, scatter, grass, flowers, live, courseMask, horizon } from '../course/decor.js';

export default {
  name: 'Sunny Meadow',
  par: 2,
  theme: 'meadow',
  tip: 'A gentle warm-up: roll over the hump and across the brook bridge.',
  env: {
    sky: { top: 0x3a8ee6, horizon: 0xc8eeff, bottom: 0xa6daf5, sunDir: [0.5, 0.62, 0.3], clouds: 0.55 },
    fog: { color: 0xc8eeff, near: 50, far: 170 },
    sun: { color: 0xfff1d6, intensity: 2.5 },
    hemi: { sky: 0xd4ecff, ground: 0x6f9a4a, intensity: 1.15 },
  },
  build(b) {
    const M = {
      fairway: toon(0xffffff, { map: textures.fairway('#66d24f', '#5ac545', 2.5) }),
      wall: toon(0xffffff, { map: textures.planks('#e8a95c', '#99612c', 0.9, true) }),
      cap: toon(0xfff1d0),
      side: toon(0xffffff, { map: textures.dirt('#9a6a3e') }),
      wood: toon(0xffffff, { map: textures.planks('#c98f55', '#6e4523', 1.0) }),
      rail: toon(0xa8703e),
    };
    const lane = { width: 2, mat: M.fairway, sideMat: M.side, wallMat: M.wall, capMat: M.cap };

    // tee box
    b.track([[0, 0, 1.3], [0, 0, -2.5]], lane);
    b.wall([[-1.12, 1.3], [1.12, 1.3]], { mat: M.wall, capMat: M.cap, align: 'right' });
    // grassy hump
    b.track([[0, 0, -2.5], [0, 0.3, -4.6], [0, 0, -6.6]], { ...lane, spacing: 0.15 });
    // wooden bridge over the brook
    b.track([[0, 0, -6.6], [0, 0, -8.8]], { ...lane, mat: M.wood, sideMat: M.wood, wallMat: M.rail, capMat: M.wood, skirt: 0.14, wallHeight: 0.24 });
    // green with the cup
    const arc = circlePts(0, -11.4, 1, 16, 0, Math.PI).map(([x, z]) => [x, -11.4 - (z + 11.4)]);
    const green = [[-1, -8.8], [1, -8.8], ...arc];
    b.floor(green, { y: 0, holes: [Builder.cupHole(0, -11.3)], mat: M.fairway, sideMat: M.side });
    b.wall([[-1, -8.8], ...arc.slice().reverse(), [1, -8.8]], { mat: M.wall, capMat: M.cap, align: 'left' });
    b.cup(0, 0, -11.3, { flagColor: 0xff4d4d });

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, 0.3, -4.6], [0, 0, -11.3]]);

    // ---- scenery
    ground(b, { y: -0.3, color: 0x6fcf4f, map: textures.fairway('#72d152', '#6bc94c', 6) });
    b.water(rectPts(-40, -8.5, 40, -6.9), -0.26, { deep: 0x2a8fd8, shallow: 0x62d2ff, flow: [0.12, 0.0] });
    const onCourse = courseMask(b, 0.7);
    const mask = (x, z) => onCourse(x, z) || Math.abs(z + 7.7) < 1.3;

    if (b.visual) {
      // brook banks
      const bankRocks = new THREE.Group();
      for (let x = -26; x <= 26; x += 0.9) {
        if (Math.abs(x) < 1.5) continue;
        for (const z of [-6.75, -8.65]) {
          const r = rock({ size: 0.22 + Math.abs(Math.sin(x * 3.1 + z)) * 0.18, color: 0xa7a3a0, seed: Math.round(x * 10 + z) });
          r.position.set(x + Math.sin(x * 7) * 0.2, -0.32, z + Math.cos(x * 5) * 0.12);
          r.rotation.y = x;
          bankRocks.add(r);
        }
      }
      b.addStaticObject(bankRocks);
      // cliff with waterfall
      const cliff = new THREE.Group();
      const cliffRocks = [[-13, 0.2, -7.7, 1.5], [-13.4, 1.3, -8.4, 1.1], [-13.2, 1.4, -6.9, 1.0], [-14.2, 0.6, -9.3, 1.3], [-14.1, 0.6, -6.1, 1.2], [-13.6, 2.3, -7.7, 0.9]];
      for (const [x, y, z, s] of cliffRocks) {
        const r = rock({ size: s, color: 0x9d98a6, seed: Math.round(x * 13 + z * 7), squash: 1.1 });
        r.position.set(x, y - 0.4, z);
        cliff.add(r);
      }
      b.addStaticObject(cliff);
      const wf = waterfall({ width: 1.3, height: 2.3 });
      wf.position.set(-12.1, -0.26, -7.7);
      wf.rotation.y = Math.PI / 2;
      live(b, wf, { outline: false });
      // welcome sign
      const s = sign({ text: 'HOLE 1', color: 0xffe7a8 });
      s.position.set(-1.9, -0.3, 0.6);
      s.rotation.y = 0.5;
      b.addStaticObject(s);
    }

    scatter(b, { count: 16, rMin: 5, rMax: 17, center: [0, -5], mask: (x, z) => mask(x, z) || Math.abs(x) < 2.5, seed: 11, minDist: 2.2,
      make: (r, x, z, i) => tree({ height: 2.6 + r() * 1.6, canopy: 0.9 + r() * 0.5, leaves: [0x4fb848, 0x5cc653, 0x3fa845, 0x7ccf4a][i % 4], seed: i + 3 }) });
    scatter(b, { count: 14, rMin: 2.2, rMax: 12, center: [0, -5], mask, seed: 21, minDist: 1,
      make: (r, x, z, i) => bush({ radius: 0.35 + r() * 0.3, color: [0x3f9d3a, 0x4caf50][i % 2], seed: i, berries: i % 3 === 0 ? 0xff4d6d : null }) });
    scatter(b, { count: 10, rMin: 2.5, rMax: 14, center: [0, -5], mask, seed: 31,
      make: (r, x, z, i) => rock({ size: 0.2 + r() * 0.35, color: 0xb0aab5, seed: i }) });
    scatter(b, { count: 7, rMin: 2, rMax: 10, center: [0, -5], mask, seed: 41,
      make: (r, x, z, i) => mushroom({ height: 0.25 + r() * 0.25, cap: [0xe8413c, 0xff9f1c][i % 2], seed: i }) });
    grass(b, { count: 7000, rMin: 0.5, rMax: 19, center: [0, -5], mask, base: 0x3b9a2e, tip: 0xb5ec63 });
    flowers(b, { count: 170, rMin: 1.2, rMax: 15, center: [0, -5], mask });
    horizon(b, { radius: 110, count: 16, color: 0x86b98a, snowCaps: false, height: 22, seed: 4 });

    if (b.visual) {
      live(b, bunny({ path: [[3, 1], [4.5, -2], [3.2, -4.5], [2.2, -1]], y: -0.3, seed: 1 }));
      live(b, bunny({ path: [[-3.5, -12], [-5, -10], [-3, -9.8]], y: -0.3, seed: 2, color: 0xc9a27e }));
      const bcol = [0xffa726, 0xff5ca8, 0x8fd3ff, 0xfff176, 0xc38bff];
      for (let i = 0; i < 5; i++) live(b, butterfly({ color: bcol[i], center: [(i - 2) * 3, 0.6, -4 - i], radius: 1.5 + i * 0.3, seed: i + 1 }), { outline: false });
      live(b, bird({ center: [0, 7, -6], radius: 10, speed: 0.25, seed: 1, color: 0xffffff, wingColor: 0xe0e0e0 }));
      live(b, bird({ center: [4, 9, -2], radius: 7, speed: -0.3, seed: 2, color: 0xffffff }));
      live(b, frog({ pos: [2.8, -0.3, -6.3], seed: 3 }));
      live(b, duck({ center: [7, -7.7], radius: 0.4, y: -0.26, seed: 1 }));
      live(b, duck({ center: [-6, -7.7], radius: 0.35, y: -0.26, seed: 2 }));
    }
  },
};
