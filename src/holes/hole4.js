// Hole 4 — Carnival Pinball: a tilted pinball table of pop bumpers under the evening lights.
import * as THREE from 'three';
import { toon, textures, glow } from '../engine/materials.js';
import { Builder, circlePts, bakeGroup } from '../course/Builder.js';
import { mesh, rng, lamp, bird } from '../course/props.js';
import { ground, scatter, live, horizon } from '../course/decor.js';
import { Surfaces, surface } from '../physics/Physics.js';

const TOP = 0.35;

function bumperVisual(color) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.08, 20), toon(0x2a2340), { pos: [0, 0.04, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 20), toon(0xffffff), { pos: [0, 0.23, 0] }));
  g.add(mesh(new THREE.TorusGeometry(0.31, 0.05, 8, 24), toon(color), { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] }));
  const cap = mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 20), glow(color, 1.2), { pos: [0, 0.44, 0], noOutline: true });
  g.add(cap);
  const star = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 5), glow(0xffffff, 2), { pos: [0, 0.51, 0], noOutline: true });
  g.add(star);
  g.userData.cap = cap;
  g.userData.hot = glow(color, 4);
  g.userData.cold = cap.material;
  g.userData.flash = 0;
  return g;
}

function stripedTent() {
  const g = new THREE.Group();
  const stripes = toon(0xffffff, { map: textures.stripes('#ffffff', '#e8413c', 1.2, 0) });
  const base = new THREE.CylinderGeometry(3.2, 3.2, 2.2, 16, 1, true);
  base.translate(0, 1.1, 0);
  g.add(mesh(base, stripes));
  const roof = new THREE.ConeGeometry(3.6, 2.6, 16, 1, true);
  roof.translate(0, 3.5, 0);
  g.add(mesh(roof, toon(0xffffff, { map: textures.stripes('#ffd23f', '#e8413c', 1.4, 0), side: THREE.DoubleSide })));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), toon(0xdddddd), { pos: [0, 5.3, 0] }));
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.35, 0.02), toon(0x3fa9f5, { side: THREE.DoubleSide }), { pos: [0.3, 5.8, 0], noOutline: true }));
  g.add(mesh(new THREE.BoxGeometry(1.2, 1.6, 0.1), toon(0x2a1840), { pos: [0, 0.8, 3.18] }));
  // scalloped trim
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(mesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(i % 2 ? 0xffd23f : 0x3fa9f5), { pos: [Math.cos(a) * 3.35, 2.25, Math.sin(a) * 3.35], rot: [Math.PI, 0, 0], noOutline: true }));
  }
  return g;
}

function ferrisWheel() {
  const g = new THREE.Group();
  const frame = toon(0xf0f0f5);
  const R = 4.6;
  for (const s of [-1, 1]) {
    for (const lx of [-1.6, 1.6]) {
      const leg = new THREE.CylinderGeometry(0.1, 0.14, 6.2, 8);
      const len = Math.hypot(lx, 5.6);
      leg.rotateZ(Math.atan2(lx, 5.6));
      leg.translate(lx / 2, 2.8, s * 0.6);
      g.add(mesh(leg, frame));
    }
  }
  const wheel = new THREE.Group();
  wheel.position.y = 5.8;
  for (const z of [-0.45, 0.45]) {
    wheel.add(mesh(new THREE.TorusGeometry(R, 0.08, 6, 48), frame, { pos: [0, 0, z] }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      wheel.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, R, 5), frame, { pos: [Math.cos(a) * R / 2, Math.sin(a) * R / 2, z], rot: [0, 0, a - Math.PI / 2] }));
    }
  }
  wheel.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.3, 12), toon(0xe8413c), { rot: [Math.PI / 2, 0, 0] }));
  const bulbColors = [0xff4b4b, 0xffd23f, 0x4bd5ff, 0x7dff6a, 0xff6ad5];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    wheel.add(mesh(new THREE.SphereGeometry(0.09, 6, 4), glow(bulbColors[i % 5], 3), { pos: [Math.cos(a) * R, Math.sin(a) * R, 0.5], noOutline: true, noShadow: true }));
  }
  bakeGroup(wheel);
  g.add(wheel);
  const cars = [];
  const carColors = [0xff5a5a, 0x3fa9f5, 0xffd23f, 0x7ddc5a, 0xb57cff, 0xff8a3d];
  for (let i = 0; i < 12; i++) {
    const car = new THREE.Group();
    car.add(mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.5, 10), toon(carColors[i % 6]), { pos: [0, -0.55, 0] }));
    car.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), toon(0xffffff), { pos: [0, -0.02, 0] }));
    car.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), toon(0xdddddd), { pos: [0, -0.18, 0] }));
    g.add(car);
    cars.push(car);
  }
  g.userData.update = (t) => {
    const ang = t * 0.12;
    wheel.rotation.z = ang;
    cars.forEach((c, i) => {
      const a = ang + (i / 12) * Math.PI * 2;
      c.position.set(Math.cos(a) * R, 5.8 + Math.sin(a) * R, 0);
      c.rotation.z = Math.sin(t * 1.3 + i) * 0.08;
    });
  };
  return g;
}

function carousel() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(2.6, 2.7, 0.35, 20), toon(0xf4e3c1), { pos: [0, 0.18, 0] }));
  const spin = new THREE.Group();
  spin.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 12), toon(0xffd23f), { pos: [0, 1.8, 0] }));
  const roof = new THREE.ConeGeometry(3.0, 1.2, 20, 1, true);
  roof.translate(0, 3.9, 0);
  spin.add(mesh(roof, toon(0xffffff, { map: textures.stripes('#ffffff', '#3fa9f5', 1.1, 0), side: THREE.DoubleSide })));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    spin.add(mesh(new THREE.SphereGeometry(0.08, 6, 4), glow(i % 2 ? 0xffd23f : 0xff6ad5, 3), { pos: [Math.cos(a) * 2.95, 3.3, Math.sin(a) * 2.95], noOutline: true, noShadow: true }));
  }
  const horses = [];
  const hColors = [0xffffff, 0xffb3c6, 0xb3e0ff, 0xfff0a0, 0xd5b3ff, 0xb3ffcf];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pole = mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 6), toon(0xffd23f), { pos: [Math.cos(a) * 1.9, 1.8, Math.sin(a) * 1.9] });
    spin.add(pole);
    const horse = new THREE.Group();
    const hm = toon(hColors[i]);
    horse.add(mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), hm, { rot: [0, 0, Math.PI / 2] }));
    horse.add(mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), hm, { pos: [0.42, 0.25, 0], rot: [0, 0, -0.6] }));
    horse.add(mesh(new THREE.BoxGeometry(0.28, 0.15, 0.16), hm, { pos: [0.58, 0.42, 0] }));
    for (const [x, z] of [[0.25, 0.1], [0.25, -0.1], [-0.25, 0.1], [-0.25, -0.1]]) horse.add(mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.45, 5), hm, { pos: [x, -0.32, z] }));
    horse.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), toon(0xe8413c), { pos: [0, 0.2, 0] }));
    horse.position.set(Math.cos(a) * 1.9, 1.2, Math.sin(a) * 1.9);
    horse.rotation.y = -a;
    spin.add(horse);
    horses.push(horse);
  }
  g.add(spin);
  g.userData.update = (t) => {
    spin.rotation.y = t * 0.5;
    horses.forEach((h, i) => { h.position.y = 1.2 + Math.sin(t * 2 + i * 1.3) * 0.25; });
  };
  return g;
}

function balloons(pos, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const colors = [0xff4b4b, 0xffd23f, 0x3fa9f5, 0x7ddc5a, 0xff6ad5, 0xb57cff];
  const items = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    b.add(mesh(new THREE.SphereGeometry(0.28, 12, 10), toon(colors[Math.floor(rand() * 6)], { rim: 0.6 }), { scale: [1, 1.18, 1] }));
    b.add(mesh(new THREE.ConeGeometry(0.05, 0.08, 6), toon(0xffffff), { pos: [0, -0.35, 0], rot: [Math.PI, 0, 0], noOutline: true }));
    const str = mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.6, 3), toon(0xffffff), { pos: [0, -1.15, 0], noOutline: true, noShadow: true });
    b.add(str);
    b.position.set((rand() - 0.5) * 0.6, 1.8 + rand() * 0.5, (rand() - 0.5) * 0.6);
    g.add(b);
    items.push({ b, ph: rand() * 10, base: b.position.clone() });
  }
  g.position.set(...pos);
  g.userData.update = (t) => {
    for (const it of items) {
      it.b.position.y = it.base.y + Math.sin(t * 1.3 + it.ph) * 0.08;
      it.b.rotation.z = Math.sin(t * 0.9 + it.ph) * 0.12;
      it.b.rotation.x = Math.cos(t * 0.7 + it.ph) * 0.1;
    }
  };
  return g;
}

// catenary string of glowing bulbs
function stringLights(b, from, to, count = 16, sag = 0.6) {
  const g = new THREE.Group();
  const colors = [0xff4b4b, 0xffd23f, 0x4bd5ff, 0x7dff6a, 0xff6ad5];
  const a = new THREE.Vector3(...from), c = new THREE.Vector3(...to);
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = a.clone().lerp(c, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
    if (i > 0 && i < count) g.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), glow(colors[i % 5], 3.2), { pos: [p.x, p.y - 0.08, p.z], noOutline: true, noShadow: true }));
  }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), count * 2, 0.012, 4);
  g.add(mesh(tube, toon(0x222222), { noOutline: true, noShadow: true }));
  b.addStaticObject(g, { outline: false, castShadow: false });
}

export default {
  name: 'Carnival Pinball',
  par: 3,
  theme: 'carnival',
  tip: 'A pinball table! Ride the ramp, then let the pop bumpers bounce you toward the cup.',
  env: {
    sky: { top: 0x2a1a5e, horizon: 0xff9a62, bottom: 0x5a2d6e, sunDir: [-0.2, 0.06, -0.95], sunColor: 0xffb070, sunSize: 3, clouds: 0.45, cloudColor: 0xffc2a8, cloudShade: 0x8a5a9e, stars: 0.35 },
    fog: { color: 0xc07a8a, near: 40, far: 150 },
    sun: { color: 0xffb88a, intensity: 1.9, dir: [-0.4, 0.5, -0.6] },
    hemi: { sky: 0x9a8cff, ground: 0x5a3a4a, intensity: 1.25 },
    bloom: 0.85,
  },
  build(b) {
    const M = {
      floor: toon(0xffffff, { map: textures.checker('#3a2a8a', '#4b36a8', 1.2, 2) }),
      lane: toon(0xffffff, { map: textures.checker('#2c5fb8', '#3570d1', 1.2, 2) }),
      wall: toon(0xff4b6e),
      cap: toon(0xffd23f),
      side: toon(0x2a1f4a),
      neon: glow(0x4bd5ff, 2.2),
      rubber: toon(0x39e67a),
    };
    const W = { mat: M.wall, capMat: M.cap };

    // --- launch lane
    b.track([[0, 0, 1.3], [0, 0, -2.5]], { width: 1.8, mat: M.lane, sideMat: M.side, wallMat: M.wall, capMat: M.cap });
    b.wall([[-1.02, 1.3], [1.02, 1.3]], { ...W, align: 'right' });
    // shoulders where the table widens
    b.wall([[-2.42, -2.5], [-0.9, -2.5]], { ...W, align: 'right' });
    b.wall([[0.9, -2.5], [2.42, -2.5]], { ...W, align: 'right' });

    // --- the table: ramp up, then a flat plateau with bumpers
    b.track([[0, 0, -2.5], [0, TOP, -6], [0, TOP, -9.2]], { width: 4.6, mat: M.floor, sideMat: M.side, wallMat: M.wall, capMat: M.cap, spacing: 0.15, wallHeight: 0.26 });
    const arc = [];
    for (let i = 0; i <= 20; i++) { const a = Math.PI - (i / 20) * Math.PI; arc.push([Math.cos(a) * 2.3, -9.2 - Math.sin(a) * 2.3]); }
    b.floor(arc, { y: TOP, holes: [Builder.cupHole(0, -10.5)], mat: M.floor, sideMat: M.side });
    b.wall(arc, { y: TOP, ...W, align: 'left', height: 0.26 });
    b.cup(0, TOP, -10.5, { flagColor: 0xff4bd8, poleColor: 0xffd23f });

    // slingshot kickers (rubber, adds speed)
    const rubber = Surfaces.rubber;
    // walls follow the ramp surface underneath them
    const tri = (pts) => b.wall(pts.map(([x, z]) => [x, b.world.heightAt(x, z, 5, true), z]), { mat: M.rubber, capMat: M.cap, surface: rubber, closed: true, thickness: 0.1, height: 0.26 });
    tri([[-2.25, -3.3], [-2.25, -4.8], [-1.55, -4.5]]);
    tri([[2.25, -3.3], [1.55, -4.5], [2.25, -4.8]]);

    // --- pop bumpers
    const bumpers = [];
    const addBumper = (x, z, color, update = null) => {
      const vis = b.visual ? bumperVisual(color) : null;
      const body = b.mover({
        object: vis,
        shapes: [{ type: 'cyl', r: 0.3, h: 0.5, position: [0, 0.25, 0] }],
        surface: rubber,
        update: update || ((t, m) => m.makeTranslation(x, TOP, z)),
        onHit: () => { if (vis) vis.userData.flash = 1; },
      });
      bumpers.push(vis);
      return body;
    };
    addBumper(-1.25, -6.9, 0xff4b4b);
    addBumper(1.25, -6.9, 0x4bd5ff);
    addBumper(0, -8.2, 0xffd23f, (t, m) => m.makeTranslation(Math.sin(t * 1.25) * 1.15, TOP, -8.2));
    addBumper(-1.35, -9.7, 0x7dff6a);
    addBumper(1.35, -9.7, 0xff6ad5);
    if (b.visual) {
      b.animate((dt) => {
        for (const v of bumpers) {
          if (!v) continue;
          const f = v.userData.flash;
          v.userData.cap.material = f > 0.05 ? v.userData.hot : v.userData.cold;
          v.userData.cap.scale.setScalar(1 + f * 0.35);
          v.userData.flash = Math.max(0, f - dt * 3);
        }
      });
    }

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, 0, -2.5], [0, TOP, -6], [0, TOP, -10.5]]);

    // --- scenery
    ground(b, { y: -0.4, color: 0x3d6b4a, map: textures.fairway('#40704c', '#3b6a47', 5), hills: 2.5, hillStart: 20 });

    if (b.visual) {
      // neon strips along the table walls
      const neon = new THREE.Group();
      for (const s of [-1, 1]) {
        neon.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 3.6), M.neon, { pos: [s * 2.42, 0.38, -4.3], rot: [-0.1, 0, 0], noOutline: true, noShadow: true }));
        neon.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 3.2), M.neon, { pos: [s * 2.42, TOP + 0.3, -7.6], noOutline: true, noShadow: true }));
      }
      // glowing arrows on the ramp
      for (let i = 0; i < 3; i++) {
        const ag = new THREE.ConeGeometry(0.22, 0.4, 3);
        ag.rotateX(-Math.PI / 2);
        ag.scale(1, 0.05, 1);
        const y = 0.02 + (i / 3) * TOP * 0.7;
        neon.add(mesh(ag, glow(0xffd23f, 2), { pos: [0, y + 0.02, -3.2 - i * 0.8], rot: [-0.1, 0, 0], noOutline: true, noShadow: true }));
      }
      b.addStaticObject(neon, { outline: false, castShadow: false });

      const tent = stripedTent();
      tent.position.set(-8.5, -0.4, -14);
      b.addStaticObject(tent);
      const fw = ferrisWheel();
      fw.position.set(9.5, -0.4, -13);
      fw.rotation.y = -0.4;
      live(b, fw);
      const car = carousel();
      car.position.set(-8.5, -0.4, 1.5);
      bakeGroup(car.children[1], car.children[1].children.filter((c) => c.isGroup));
      live(b, car);
      for (const [x, z, s] of [[4.5, 2.5, 1], [-4.2, -6, 2], [5, -8, 3], [-3.8, 4, 4]]) live(b, balloons([x, -0.4, z], s));
      // string light poles
      const poles = [[-3.4, 2.5], [3.4, 2.5], [-3.4, -12.5], [3.4, -12.5], [-3.4, -5], [3.4, -5]];
      const pg = new THREE.Group();
      for (const [x, z] of poles) pg.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), toon(0x2a2340), { pos: [x, 1.3, z] }));
      b.addStaticObject(pg);
      stringLights(b, [-3.4, 3, 2.5], [3.4, 3, 2.5], 18);
      stringLights(b, [-3.4, 3, 2.5], [-3.4, 3, -5], 16);
      stringLights(b, [3.4, 3, 2.5], [3.4, 3, -5], 16);
      stringLights(b, [-3.4, 3, -5], [-3.4, 3, -12.5], 16);
      stringLights(b, [3.4, 3, -5], [3.4, 3, -12.5], 16);
      stringLights(b, [-3.4, 3, -12.5], [3.4, 3, -12.5], 18);
      stringLights(b, [-3.4, 3, -5], [3.4, 3, -5], 18, 0.8);
      for (const [x, z] of [[-6, -4], [6, -4], [0, 6]]) {
        const l = lamp({ height: 2.4, bulb: 0xffe7a8 });
        l.position.set(x, -0.4, z);
        b.add(l, { outline: true });
      }
      // popcorn cart
      const cartG = new THREE.Group();
      cartG.add(mesh(new THREE.BoxGeometry(1.2, 0.9, 0.8), toon(0xffffff, { map: textures.stripes('#ffffff', '#e8413c', 0.5, 0) }), { pos: [0, 0.75, 0] }));
      cartG.add(mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), toon(0xfff3c4, { transparent: true, opacity: 0.6 }), { pos: [0, 1.55, 0], noOutline: true }));
      for (let i = 0; i < 12; i++) cartG.add(mesh(new THREE.IcosahedronGeometry(0.08, 0), toon(0xfff1b8), { pos: [(i % 4 - 1.5) * 0.2, 1.3 + Math.floor(i / 4) * 0.12, ((i * 7) % 3 - 1) * 0.15], noOutline: true }));
      cartG.add(mesh(new THREE.ConeGeometry(0.8, 0.4, 4), toon(0xe8413c), { pos: [0, 2.1, 0], rot: [0, Math.PI / 4, 0] }));
      for (const x of [-0.45, 0.45]) cartG.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12), toon(0x333333), { pos: [x, 0.2, 0.42] }));
      cartG.position.set(5.2, -0.4, -1.5);
      cartG.rotation.y = -0.6;
      b.addStaticObject(cartG);
      live(b, bird({ center: [0, 10, -6], radius: 11, speed: 0.2, seed: 9, color: 0x2a2340 }));
    }
    horizon(b, { radius: 120, count: 12, color: 0x6a4a8a, snowCaps: false, height: 18, seed: 12 });
  },
};
