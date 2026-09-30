// Hole 3 — Pirate Cove: walk the plank for a shortcut, or take the long boardwalk around.
import * as THREE from 'three';
import { toon, textures, glow } from '../engine/materials.js';
import { Builder, circlePts, rectPts, bakeGroup } from '../course/Builder.js';
import { palmTree, rock, crab, bird, fish, barrel, crate, mesh, waterfall, rng } from '../course/props.js';
import { ground, scatter, live, horizon } from '../course/decor.js';

const WY = -0.35; // sea level
const IC = [0, -10.5]; // island centre
const IR = 2.2;

function islandPolygon() {
  const pts = [];
  const deg = Math.PI / 180;
  const P = (a) => [IC[0] + Math.cos(a * deg) * IR, IC[1] + Math.sin(a * deg) * IR];
  const aPlank = Math.acos(0.25 / IR) / deg; // 83.47
  const aWalk = 180 - Math.asin(0.7 / IR) / deg; // 161.45
  for (let a = 0; a < aPlank; a += 7) pts.push(P(a));
  pts.push(P(aPlank), [0.25, -8.2], [-0.25, -8.2], P(180 - aPlank));
  for (let a = Math.ceil((180 - aPlank) / 7) * 7; a < aWalk; a += 7) pts.push(P(a));
  pts.push(P(aWalk), [-2.3, -9.8], [-2.3, -11.2], P(360 - aWalk));
  for (let a = Math.ceil((360 - aWalk) / 7) * 7; a < 360; a += 7) pts.push(P(a));
  return pts;
}

function arcPts(a0, a1, step = 6) {
  const pts = [];
  const n = Math.max(2, Math.ceil((a1 - a0) / step));
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    pts.push([IC[0] + Math.cos(a) * IR, IC[1] + Math.sin(a) * IR]);
  }
  return pts;
}

function flagTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#16161c'; x.fillRect(0, 0, 128, 96);
  x.fillStyle = '#f4f1e8';
  x.beginPath(); x.arc(64, 40, 18, 0, Math.PI * 2); x.fill();
  x.fillRect(54, 50, 20, 12);
  x.fillStyle = '#16161c';
  x.beginPath(); x.arc(57, 40, 5, 0, Math.PI * 2); x.arc(71, 40, 5, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#f4f1e8'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(34, 64); x.lineTo(94, 88); x.moveTo(94, 64); x.lineTo(34, 88); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pirateShip() {
  const ship = new THREE.Group();
  const hullG = new THREE.BoxGeometry(2.2, 1.3, 6.2, 2, 3, 10);
  const p = hullG.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const bow = THREE.MathUtils.smoothstep(z, 1.0, 3.1);
    x *= 1 - bow * 0.88;
    if (y < 0) x *= 0.62 + (y + 0.65) * 0.3;
    y += Math.pow(Math.abs(z) / 3.1, 2) * 0.45; // sheer line
    if (z < -2.5 && y > 0) y += 0.3; // raised stern
    p.setXYZ(i, x, y, z);
  }
  hullG.computeVertexNormals();
  const wood = toon(0xffffff, { map: textures.planks('#8a5530', '#4a2a14', 0.8, true) });
  ship.add(mesh(hullG, wood));
  ship.add(mesh(new THREE.BoxGeometry(2.25, 0.12, 5.4), toon(0xf2c14e), { pos: [0, 0.35, -0.2] }));
  ship.add(mesh(new THREE.BoxGeometry(1.9, 0.08, 5.2), toon(0xffffff, { map: textures.planks('#c9965f', '#7a4f2a', 0.7) }), { pos: [0, 0.62, -0.1] }));
  // stern cabin
  ship.add(mesh(new THREE.BoxGeometry(2.0, 0.9, 1.3), wood, { pos: [0, 1.1, -2.4] }));
  for (const x of [-0.5, 0.5]) ship.add(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), glow(0xffd27a, 1.6), { pos: [x, 1.15, -1.73], noOutline: true }));
  // masts & sails
  const sailM = toon(0xfff8ea, { side: THREE.DoubleSide });
  const stripe = toon(0xd93a3a, { side: THREE.DoubleSide });
  const masts = [[0.6, 4.6], [-1.0, 3.8]];
  const sails = [];
  for (const [z, h] of masts) {
    ship.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, h, 8), toon(0x5a3520), { pos: [0, 0.6 + h / 2, z] }));
    for (const [y, w, hh] of [[0.6 + h * 0.42, 2.0, 1.2], [0.6 + h * 0.75, 1.5, 0.9]]) {
      const sg = new THREE.PlaneGeometry(w, hh, 6, 3);
      const sp = sg.attributes.position;
      for (let i = 0; i < sp.count; i++) sp.setZ(i, 0.25 * (1 - (sp.getX(i) / (w / 2)) ** 2));
      sg.computeVertexNormals();
      const s = mesh(sg, sailM, { pos: [0, y, z + 0.08] });
      sails.push(s);
      ship.add(s);
      ship.add(mesh(new THREE.PlaneGeometry(w, 0.18), stripe, { pos: [0, y, z + 0.34], noOutline: true }));
      ship.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, w + 0.3, 6), toon(0x5a3520), { pos: [0, y + hh / 2, z], rot: [0, 0, Math.PI / 2] }));
    }
  }
  ship.add(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.3, 10, 1, true), toon(0x5a3520, { side: THREE.DoubleSide }), { pos: [0, 4.4, 0.6] }));
  const flag = mesh(new THREE.PlaneGeometry(0.8, 0.55, 6, 2), toon(0xffffff, { map: flagTexture(), side: THREE.DoubleSide }), { pos: [0, 5.35, 0.6 - 0.45], rot: [0, Math.PI / 2, 0], noOutline: true });
  ship.add(flag);
  // bowsprit
  ship.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 6), toon(0x5a3520), { pos: [0, 1.0, 3.3], rot: [Math.PI / 2.6, 0, 0] }));
  // cannons
  const cannons = [];
  for (const s of [-1, 1]) for (const z of [-0.9, 0.2, 1.2]) {
    const c = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.6, 10), toon(0x2a2a30), { pos: [s * 1.1, 0.25, z], rot: [0, 0, s * Math.PI / 2] });
    ship.add(c);
    if (s > 0) cannons.push(c);
  }
  ship.userData.flag = flag;
  ship.userData.cannons = cannons;
  return ship;
}

export default {
  name: 'Pirate Cove',
  par: 3,
  theme: 'pirate',
  tip: 'Brave the narrow plank for a shortcut, or play it safe along the boardwalk.',
  env: {
    sky: { top: 0x2b93e6, horizon: 0xc2f4ff, bottom: 0x8fe0f0, sunDir: [0.3, 0.7, -0.5], clouds: 0.4 },
    fog: { color: 0xc2f4ff, near: 45, far: 170 },
    sun: { color: 0xfff4dc, intensity: 2.6 },
    hemi: { sky: 0xd6f4ff, ground: 0xd9c38f, intensity: 1.15 },
  },
  build(b) {
    const M = {
      deck: toon(0xffffff, { map: textures.planks('#c9965f', '#7a4f2a', 0.8) }),
      deckSide: toon(0xffffff, { map: textures.planks('#9a6a3e', '#5a3a1e', 0.8, true) }),
      plank: toon(0xffffff, { map: textures.planks('#d8a86a', '#7a4f2a', 0.6, true) }),
      grass: toon(0xffffff, { map: textures.fairway('#5fd35a', '#54c74f', 2.2) }),
      rail: toon(0x8a5530),
      railCap: toon(0xd8b07a),
      sand: toon(0xffffff, { map: textures.sand('#f0d79a') }),
      post: toon(0x6b4226),
    };

    // --- tee dock
    b.floor(rectPts(-1, -1.4, 1, 1.2), { y: 0, mat: M.deck, sideMat: M.deckSide, surface: 'wood', depth: 0.3 });
    const W = { mat: M.rail, capMat: M.railCap, surface: 'woodWall' };
    b.wall([[-1.12, 1.2], [1.12, 1.2]], { ...W, align: 'right' });
    b.wall([[1, 1.2], [1, -1.52]], { ...W, align: 'right' });
    b.wall([[-1, 1.2], [-1, 0]], { ...W, align: 'left' });
    b.wall([[-1.12, -1.4], [-0.26, -1.4]], { ...W, align: 'left' });
    b.wall([[0.26, -1.4], [1.12, -1.4]], { ...W, align: 'left' });

    // --- the plank (no rails!)
    b.track([[0, 0, -1.38], [0, 0, -8.22]], { width: 0.5, walls: 'none', skirt: 0.1, mat: M.plank, sideMat: M.plank, surface: 'wood', bottom: true });

    // --- safe boardwalk around the lagoon
    b.track([[-0.98, 0, -0.7], [-3.1, 0, -0.7], [-4.25, 0, -1.4], [-4.6, 0, -2.8], [-4.6, 0, -8.4], [-4.25, 0, -9.8], [-3.2, 0, -10.5], [-2.3, 0, -10.5]], {
      width: 1.4, mat: M.deck, sideMat: M.deckSide, wallMat: M.rail, capMat: M.railCap, surface: 'wood', wallSurface: 'woodWall', skirt: 0.25, wallHeight: 0.2, spacing: 0.15,
    });
    b.wall([[-2.32, -9.74], [-1.98, -9.74]], { ...W, thickness: 0.12 });
    b.wall([[-2.32, -11.26], [-1.98, -11.26]], { ...W, thickness: 0.12 });

    // --- treasure island green
    b.floor(islandPolygon(), { y: 0, holes: [Builder.cupHole(0.5, -11.2)], mat: M.grass, sideMat: M.sand, depth: 0.4 });
    const aP = (Math.asin(0.27 / IR) * 180) / Math.PI;
    const aW = 180 - (Math.asin(0.7 / IR) * 180) / Math.PI;
    b.wall(arcPts(90 + aP, aW), { ...W, surface: 'woodWall' });
    b.wall(arcPts(360 - aW, 450 - aP), { ...W, surface: 'woodWall' });
    b.cup(0.5, 0, -11.2, { flagColor: 0x16161c });

    b.setTee(0, 0, 0, 0);
    b.setPath([[0, 0, 0], [0, 0, -8.3], [0.5, 0, -11.2]]);

    // --- sea, seabed and islets
    ground(b, { y: -1.1, color: 0xe8cf8e, map: textures.sand('#e8cf8e', 3), hills: 1.5, hillStart: 22,
      bumps: [
        { x: 0, z: -10.5, r: 3.8, h: 0.8, plateau: 0.62 },
        { x: -8.5, z: -13, r: 4.5, h: 1.9, plateau: 0.5 },
        { x: 8.5, z: 3, r: 3.2, h: 1.55, plateau: 0.45 },
        { x: -9, z: 2.5, r: 2.6, h: 1.45, plateau: 0.4 },
        { x: 10, z: -15, r: 3, h: 1.5, plateau: 0.4 },
      ] });
    b.water(rectPts(-45, -45, 45, 45), WY, { deep: 0x0f86c4, shallow: 0x3fd6e0, flow: [0.03, 0.02], segments: 2.5, wave: 0.04 });

    if (b.visual) {
      // dock posts
      const posts = new THREE.Group();
      const addPost = (x, z) => posts.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.0, 6), M.post, { pos: [x, -0.75, z] }));
      for (const [x, z] of [[-0.9, 1.1], [0.9, 1.1], [-0.9, -1.3], [0.9, -1.3]]) addPost(x, z);
      for (let z = -2.5; z > -8.2; z -= 1.6) addPost(0, z);
      for (let x = -1.8; x > -4.6; x -= 1.4) { addPost(x, 0.05); addPost(x, -1.45); }
      for (let z = -2.2; z > -9.5; z -= 1.4) { addPost(-3.85, z); addPost(-5.35, z); }
      b.addStaticObject(posts);

      // ship
      const ship = pirateShip();
      bakeGroup(ship, [ship.userData.flag, ...ship.userData.cannons]);
      ship.position.set(7.2, WY + 0.25, -7.5);
      ship.rotation.y = -0.35;
      live(b, ship);
      const smoke = [];
      const smokeM = toon(0xf0f0f0, { transparent: true, opacity: 0.8 });
      for (let i = 0; i < 6; i++) {
        const s = mesh(new THREE.IcosahedronGeometry(0.25, 1), smokeM, { noShadow: true });
        s.visible = false;
        b.group.add(s);
        smoke.push(s);
      }
      let nextShot = 6, shotT = -1;
      const muzzle = new THREE.Vector3();
      b.animate((dt, t) => {
        ship.position.y = WY + 0.25 + Math.sin(t * 0.9) * 0.08;
        ship.rotation.z = Math.sin(t * 0.7) * 0.04;
        ship.rotation.x = Math.sin(t * 0.55 + 1) * 0.025;
        const f = ship.userData.flag;
        f.rotation.y = Math.PI / 2 + Math.sin(t * 4) * 0.2;
        if (t > nextShot) {
          nextShot = t + 8 + Math.random() * 5;
          shotT = 0;
          const c = ship.userData.cannons[Math.floor(Math.random() * 3)];
          c.getWorldPosition(muzzle);
          b.world.emit('sound', { name: 'cannon' });
        }
        if (shotT >= 0) {
          shotT += dt;
          smoke.forEach((s, i) => {
            const k = shotT - i * 0.05;
            s.visible = k > 0 && k < 2.2;
            if (!s.visible) return;
            s.position.set(muzzle.x + k * 1.2 + i * 0.1, muzzle.y + k * 0.6 + Math.sin(i) * 0.1, muzzle.z + Math.cos(i * 2) * 0.2);
            s.scale.setScalar(0.5 + k * 1.2);
          });
          if (shotT > 2.6) shotT = -1;
        }
      });

      // treasure chest behind the green
      const chest = new THREE.Group();
      chest.position.set(-0.6, -0.12, -12.95);
      chest.rotation.y = 0.2;
      chest.add(mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), toon(0x8a5530), { pos: [0, 0.225, 0] }));
      chest.add(mesh(new THREE.BoxGeometry(0.84, 0.08, 0.54), toon(0xe0b43a), { pos: [0, 0.3, 0] }));
      const lid = new THREE.Group();
      lid.position.set(0, 0.45, -0.25);
      const lidG = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 12, 1, false, 0, Math.PI);
      lidG.rotateZ(Math.PI / 2);
      lidG.translate(0, 0, 0.25);
      lid.add(mesh(lidG, toon(0x8a5530)));
      chest.add(lid);
      for (let i = 0; i < 9; i++) chest.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), glow(0xffcf3f, 1.6), { pos: [(i % 3 - 1) * 0.2, 0.46 + Math.floor(i / 3) * 0.03, (Math.floor(i / 3) - 1) * 0.1], noOutline: true }));
      bakeGroup(chest, [lid]);
      live(b, chest);
      b.animate((dt, t) => { lid.rotation.x = -Math.max(0, Math.sin(t * 0.5)) * 1.1; });

      // barrels & crates on the dock
      const deckProps = new THREE.Group();
      const br = barrel(); br.position.set(0.72, 0, 0.95); br.scale.setScalar(0.5); deckProps.add(br);
      const cr = crate({ size: 0.36 }); cr.position.set(-0.72, 0, 0.95); cr.rotation.y = 0.3; deckProps.add(cr);
      b.addStaticObject(deckProps);

      // islet cliff with waterfall
      const cliff = new THREE.Group();
      for (const [x, y, z, s] of [[-9.5, 0.3, -14.2, 1.6], [-8.8, 1.6, -14.5, 1.1], [-10.3, 1.4, -13.4, 1.0], [-9.4, 2.4, -14.6, 0.8]]) {
        const r = rock({ size: s, color: 0x8e8a97, seed: Math.round(x * 7 + z), squash: 1.1 });
        r.position.set(x, y, z);
        cliff.add(r);
      }
      b.addStaticObject(cliff);
      const wf = waterfall({ width: 1.0, height: 2.6, a: 0x4fd6f0 });
      wf.position.set(-8.1, WY, -13.6);
      wf.rotation.y = 0.9;
      live(b, wf, { outline: false });

      // skull rock
      const skull = new THREE.Group();
      skull.add(mesh(new THREE.SphereGeometry(1.1, 14, 10), toon(0xd9d2c3), { pos: [0, 1.0, 0], scale: [1, 0.95, 0.9] }));
      skull.add(mesh(new THREE.BoxGeometry(1.1, 0.6, 0.9), toon(0xd9d2c3), { pos: [0, 0.3, 0.1] }));
      for (const x of [-0.38, 0.38]) skull.add(mesh(new THREE.SphereGeometry(0.26, 10, 8), toon(0x1a1a22), { pos: [x, 1.05, 0.85], noOutline: true }));
      skull.add(mesh(new THREE.ConeGeometry(0.14, 0.25, 3), toon(0x1a1a22), { pos: [0, 0.7, 0.92], rot: [Math.PI, 0, 0], noOutline: true }));
      skull.position.set(10.2, -0.2, -15.2);
      skull.rotation.y = -0.8;
      b.addStaticObject(skull);
    }

    // palms on the islets and the island
    const palmSpots = [[-7.5, -11.8], [-9.8, -11.5], [-7.2, -14.6], [8.2, 2.2], [9.3, 3.8], [-9, 2], [9.4, -14.2], [1.9, -12.9], [-2.3, -12.3]];
    if (b.visual) {
      palmSpots.forEach(([x, z], i) => {
        const pt = palmTree({ height: 3 + (i % 3) * 0.6, lean: 0.4 + (i % 2) * 0.4, seed: i + 3 });
        pt.position.set(x, b.terrainHeight(x, z) - 0.05, z);
        b.addStaticObject(pt);
      });
    }
    scatter(b, { count: 10, rMin: 6, rMax: 16, center: [0, -6], seed: 51,
      mask: (x, z) => b.terrainHeight(x, z) < WY + 0.1,
      make: (r, x, z, i) => rock({ size: 0.25 + r() * 0.4, color: 0x9d98a6, seed: i + 30 }) });
    horizon(b, { radius: 120, count: 9, color: 0x5fae7a, snowCaps: false, height: 16, seed: 3 });

    if (b.visual) {
      live(b, crab({ path: [[7.5, 2.5], [9.2, 3.2]], y: b.terrainHeight(8.4, 2.9), seed: 1 }));
      live(b, crab({ path: [[-8, -12.5], [-9.2, -11.8]], y: b.terrainHeight(-8.6, -12.2), seed: 2 }));
      live(b, crab({ path: [[-8.4, 2], [-9.6, 3]], y: b.terrainHeight(-9, 2.5), seed: 3 }));
      live(b, bird({ center: [2, 7, -7], radius: 8, speed: 0.3, seed: 5, color: 0xffffff, wingColor: 0xdfe6ee }));
      live(b, bird({ center: [-3, 8.5, -5], radius: 6, speed: -0.35, seed: 6 }));
      live(b, bird({ center: [6, 6, -9], radius: 4, speed: 0.4, seed: 7 }));
      live(b, fish({ center: [-2.2, 0, -5], y: WY, seed: 1, color: 0xff9f1c }));
      live(b, fish({ center: [2.5, 0, -4], y: WY, seed: 2, color: 0xff5ca8, period: 6 }));
      live(b, fish({ center: [3, 0, -12], y: WY, seed: 3, color: 0x7cf0ff, period: 7 }));
    }
  },
};
