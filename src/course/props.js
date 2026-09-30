// Procedural props and critters. Everything here is generated in code.
import * as THREE from 'three';
import { toon, glow, addOutline } from '../engine/materials.js';
import { flameMaterial, grassMaterial, grassBladeGeometry, fallMaterial } from '../engine/shaders.js';
import { setSway } from './Builder.js';

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function mesh(geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) typeof opts.scale === 'number' ? m.scale.setScalar(opts.scale) : m.scale.set(...opts.scale);
  if (opts.noOutline) m.userData.noOutline = true;
  if (opts.noShadow) m.userData.noShadow = true;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export { mesh };

function blob(r, detail = 1, seed = 1, jitter = 0.12) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const rand = rng(seed);
  const pos = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let s = map.get(k);
    if (s === undefined) { s = 1 + (rand() - 0.5) * jitter * 2; map.set(k, s); }
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}
export { blob };

// ---------------------------------------------------------------------------
// Vegetation

export function tree({ height = 3, canopy = 1.1, trunk = 0x8a5a3c, leaves = 0x4fb848, seed = 1, style = 'round' } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const th = height * 0.55;
  const tg = new THREE.CylinderGeometry(canopy * 0.09, canopy * 0.15, th, 7);
  tg.translate(0, th / 2, 0);
  g.add(mesh(tg, toon(trunk)));
  const lm = toon(leaves, { sway: 0.05 });
  const n = style === 'round' ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const r = canopy * (0.55 + rand() * 0.35) * (i === 0 ? 1.15 : 1);
    const bg = blob(r, 1, seed * 7 + i);
    const a = rand() * Math.PI * 2;
    const off = i === 0 ? 0 : canopy * 0.5;
    bg.translate(Math.cos(a) * off, th + canopy * 0.35 + (i === 0 ? canopy * 0.25 : rand() * canopy * 0.4), Math.sin(a) * off);
    setSway(bg, th * 0.7, height + canopy);
    g.add(mesh(bg, lm));
  }
  return g;
}

export function pineTree({ height = 3.5, radius = 1.0, trunk = 0x7a4b2a, leaves = 0x2e8b57, snow = false, seed = 1 } = {}) {
  const g = new THREE.Group();
  const tg = new THREE.CylinderGeometry(0.08, 0.14, height * 0.3, 6);
  tg.translate(0, height * 0.15, 0);
  g.add(mesh(tg, toon(trunk)));
  const lm = toon(leaves, { sway: 0.035 });
  const sm = toon(0xffffff, { sway: 0.035 });
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const r = radius * (1 - i * 0.26);
    const h = height * 0.42;
    const y = height * 0.2 + i * height * 0.24;
    const cg = new THREE.ConeGeometry(r, h, 8);
    cg.translate(0, y + h / 2, 0);
    setSway(cg, height * 0.15, height);
    g.add(mesh(cg, lm));
    if (snow) {
      const sg = new THREE.ConeGeometry(r * 0.62, h * 0.45, 8);
      sg.translate(0, y + h * 0.78, 0);
      setSway(sg, height * 0.15, height);
      g.add(mesh(sg, sm, { noOutline: true }));
    }
  }
  return g;
}

export function palmTree({ height = 4, lean = 0.5, trunk = 0xb5895a, leaves = 0x3fae45, seed = 1, coconuts = true } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const segs = 7;
  const tm = toon(trunk, { sway: 0.08 });
  const dir = rand() * Math.PI * 2;
  const top = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const x0 = Math.pow(t0, 2) * lean, x1 = Math.pow(t1, 2) * lean;
    const y0 = t0 * height, y1 = t1 * height;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const cg = new THREE.CylinderGeometry(0.1 - t1 * 0.03, 0.13 - t0 * 0.03, len * 1.05, 7);
    const ang = Math.atan2(x1 - x0, y1 - y0);
    cg.rotateZ(-ang);
    cg.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    setSway(cg, 0, height, 1.5);
    g.add(mesh(cg, tm));
    top.set(x1, y1, 0);
  }
  const lm = toon(leaves, { sway: 0.08, side: THREE.DoubleSide });
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rand() * 0.3;
    // frond: a bent strip
    const pts = [];
    const L = 1.5 + rand() * 0.4;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(L * 0.5, 0.28, L, 0);
    shape.quadraticCurveTo(L * 0.5, -0.28, 0, 0);
    const fg = new THREE.ShapeGeometry(shape, 6);
    fg.rotateX(-Math.PI / 2);
    // droop
    const p = fg.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      p.setY(k, p.getY(k) + 0.25 * x - 0.35 * x * x);
    }
    fg.rotateY(a);
    fg.translate(top.x, top.y, top.z);
    fg.computeVertexNormals();
    setSway(fg, 0, height + 0.5, 1.5);
    pts.push(fg);
    g.add(mesh(fg, lm, { noOutline: true }));
  }
  if (coconuts) {
    const cm = toon(0x6b4423, { sway: 0.08 });
    for (let i = 0; i < 3; i++) {
      const cgeo = new THREE.SphereGeometry(0.1, 8, 6);
      const a = (i / 3) * Math.PI * 2;
      cgeo.translate(top.x + Math.cos(a) * 0.14, top.y - 0.12, top.z + Math.sin(a) * 0.14);
      setSway(cgeo, 0, height + 0.5, 1.5);
      g.add(mesh(cgeo, cm));
    }
  }
  g.rotation.y = dir;
  return g;
}

export function bush({ radius = 0.6, color = 0x3f9d3a, seed = 1, berries = null } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const m = toon(color, { sway: 0.03 });
  for (let i = 0; i < 4; i++) {
    const r = radius * (0.5 + rand() * 0.4);
    const bg = blob(r, 1, seed * 13 + i, 0.1);
    const a = rand() * Math.PI * 2;
    bg.translate(Math.cos(a) * radius * 0.45, r * 0.75, Math.sin(a) * radius * 0.45);
    setSway(bg, 0, radius * 2);
    g.add(mesh(bg, m));
  }
  if (berries) {
    const bm = toon(berries);
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2;
      const bg = new THREE.SphereGeometry(0.05, 6, 5);
      bg.translate(Math.cos(a) * radius * 0.7, radius * (0.5 + rand() * 0.6), Math.sin(a) * radius * 0.7);
      g.add(mesh(bg, bm, { noOutline: true }));
    }
  }
  return g;
}

export function rock({ size = 0.6, color = 0x9a9aa5, seed = 1, squash = 0.7 } = {}) {
  const g = blob(size, 0, seed, 0.25);
  g.scale(1, squash, 1);
  g.translate(0, size * squash * 0.55, 0);
  const m = mesh(g, toon(color, { steps: 3 }));
  const grp = new THREE.Group();
  grp.add(m);
  return grp;
}

export function mushroom({ height = 0.5, cap = 0xe8413c, seed = 1 } = {}) {
  const g = new THREE.Group();
  const sg = new THREE.CylinderGeometry(height * 0.12, height * 0.16, height, 8);
  sg.translate(0, height / 2, 0);
  g.add(mesh(sg, toon(0xfff3e0)));
  const cg = new THREE.SphereGeometry(height * 0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  cg.scale(1, 0.7, 1);
  cg.translate(0, height * 0.95, 0);
  g.add(mesh(cg, toon(cap)));
  const dm = toon(0xffffff);
  const rand = rng(seed);
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2, e = 0.3 + rand() * 0.8;
    const dg = new THREE.SphereGeometry(height * 0.06, 6, 4);
    dg.translate(Math.cos(a) * Math.sin(e) * height * 0.45, height * 0.95 + Math.cos(e) * height * 0.31, Math.sin(a) * Math.sin(e) * height * 0.45);
    g.add(mesh(dg, dm, { noOutline: true }));
  }
  return g;
}

// Instanced flowers scattered in an area. place(rand) -> [x, y, z] or null
export function flowerField({ count = 60, place, colors = [0xff5c8a, 0xffd23f, 0xffffff, 0xb07cff, 0xff8c42], seed = 3, size = 1 } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const stemG = new THREE.CylinderGeometry(0.012 * size, 0.012 * size, 0.3 * size, 4);
  stemG.translate(0, 0.15 * size, 0);
  setSway(stemG, 0, 0.35 * size);
  const headG = new THREE.IcosahedronGeometry(0.06 * size, 0);
  headG.scale(1, 0.55, 1);
  headG.translate(0, 0.31 * size, 0);
  setSway(headG, 0, 0.35 * size);
  const centerG = new THREE.SphereGeometry(0.028 * size, 6, 4);
  centerG.translate(0, 0.335 * size, 0);
  setSway(centerG, 0, 0.35 * size);
  const positions = [];
  for (let i = 0; i < count * 3 && positions.length < count; i++) {
    const p = place(rand);
    if (p) positions.push(p);
  }
  const stems = new THREE.InstancedMesh(stemG, toon(0x3e9b3a, { sway: 0.12 }), positions.length);
  const centers = new THREE.InstancedMesh(centerG, toon(0xffe066, { sway: 0.12 }), positions.length);
  const byColor = colors.map(() => []);
  const m4 = new THREE.Matrix4();
  positions.forEach((p, i) => {
    const s = 0.7 + rand() * 0.6;
    m4.compose(V(...p), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rand() * 6.28), V(s, s, s));
    stems.setMatrixAt(i, m4);
    centers.setMatrixAt(i, m4);
    byColor[Math.floor(rand() * colors.length)].push(m4.clone());
  });
  g.add(stems, centers);
  colors.forEach((c, ci) => {
    if (!byColor[ci].length) return;
    const im = new THREE.InstancedMesh(headG, toon(c, { sway: 0.12 }), byColor[ci].length);
    byColor[ci].forEach((m, i) => im.setMatrixAt(i, m));
    g.add(im);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  return g;
}

// Instanced swaying grass blades
export function grassField({ count = 4000, place, base, tip, height = 0.35, seed = 5, wind = 1 } = {}) {
  const geo = grassBladeGeometry();
  const mat = grassMaterial({ base, tip, wind });
  const rand = rng(seed);
  const mats = [];
  for (let i = 0; i < count * 2 && mats.length < count; i++) {
    const p = place(rand);
    if (!p) continue;
    const h = height * (0.6 + rand() * 0.8);
    const w = 0.035 + rand() * 0.03;
    mats.push(new THREE.Matrix4().compose(V(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3)), V(w, h, w)));
  }
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.frustumCulled = false;
  im.castShadow = false;
  im.receiveShadow = false;
  return im;
}

// ---------------------------------------------------------------------------
// Structures

export function fence({ points, height = 0.7, color = 0xffffff, post = 0xf0f0f0, spacing = 1.0 }) {
  const g = new THREE.Group();
  const pm = toon(post), rm = toon(color);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k <= n; k++) {
      if (k === n && i < points.length - 2) continue;
      const t = k / n;
      const pg = new THREE.BoxGeometry(0.09, height, 0.09);
      pg.translate(x0 + (x1 - x0) * t, height / 2, z0 + (z1 - z0) * t);
      g.add(mesh(pg, pm));
      const cap = new THREE.ConeGeometry(0.075, 0.12, 4);
      cap.rotateY(Math.PI / 4);
      cap.translate(x0 + (x1 - x0) * t, height + 0.06, z0 + (z1 - z0) * t);
      g.add(mesh(cap, pm));
    }
    for (const h of [height * 0.35, height * 0.75]) {
      const rg = new THREE.BoxGeometry(len, 0.07, 0.035);
      rg.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      rg.translate((x0 + x1) / 2, h, (z0 + z1) / 2);
      g.add(mesh(rg, rm));
    }
  }
  return g;
}

export function barrel({ color = 0x9c6a3c, band = 0x444450 } = {}) {
  const g = new THREE.Group();
  const bg = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
  const p = bg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = 1 + 0.12 * (1 - (y / 0.4) ** 2);
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  bg.computeVertexNormals();
  bg.translate(0, 0.4, 0);
  g.add(mesh(bg, toon(color)));
  for (const y of [0.15, 0.65]) {
    const tg = new THREE.TorusGeometry(0.33, 0.025, 6, 16);
    tg.rotateX(Math.PI / 2);
    tg.translate(0, y, 0);
    g.add(mesh(tg, toon(band), { noOutline: true }));
  }
  return g;
}

export function crate({ size = 0.6, color = 0xc8964f } = {}) {
  const g = new THREE.Group();
  const bg = new THREE.BoxGeometry(size, size, size);
  bg.translate(0, size / 2, 0);
  g.add(mesh(bg, toon(color)));
  const dm = toon(new THREE.Color(color).multiplyScalar(0.7).getHex());
  for (const s of [-1, 1]) {
    const pg = new THREE.BoxGeometry(size * 1.02, size * 0.12, size * 1.02);
    pg.translate(0, size / 2 + s * size * 0.38, 0);
    g.add(mesh(pg, dm, { noOutline: true }));
  }
  return g;
}

export function torch({ height = 1.4, color = 0x5a3a22, flame = true, light = true, seed = Math.random() * 10 } = {}) {
  const g = new THREE.Group();
  const pg = new THREE.CylinderGeometry(0.05, 0.07, height, 6);
  pg.translate(0, height / 2, 0);
  g.add(mesh(pg, toon(color)));
  const cg = new THREE.CylinderGeometry(0.13, 0.07, 0.18, 8);
  cg.translate(0, height + 0.05, 0);
  g.add(mesh(cg, toon(0x3b2a20)));
  const fl = new THREE.Group();
  fl.position.y = height + 0.12;
  if (flame) {
    const fg = new THREE.ConeGeometry(0.12, 0.45, 10, 4, true);
    fg.translate(0, 0.22, 0);
    const f = new THREE.Mesh(fg, flameMaterial({ seed }));
    f.userData.noOutline = true; f.userData.noShadow = true;
    fl.add(f);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow(0xffd070, 3));
    core.position.y = 0.05;
    core.userData.noOutline = true; core.userData.noShadow = true;
    fl.add(core);
  }
  g.add(fl);
  g.userData.flame = fl;
  if (light) {
    const pl = new THREE.PointLight(0xff8a30, 1.8, 5, 1.6);
    pl.position.y = height + 0.35;
    g.add(pl);
    g.userData.light = pl;
  }
  g.userData.update = (t) => {
    if (g.userData.light) g.userData.light.intensity = 1.5 + Math.sin(t * 17 + seed) * 0.25 + Math.sin(t * 7.3 + seed * 2) * 0.2;
  };
  return g;
}

export function lamp({ height = 2.2, color = 0x2f3440, bulb = 0xffe08a, light = true } = {}) {
  const g = new THREE.Group();
  const pg = new THREE.CylinderGeometry(0.05, 0.08, height, 8);
  pg.translate(0, height / 2, 0);
  g.add(mesh(pg, toon(color)));
  const hg = new THREE.ConeGeometry(0.22, 0.25, 8, 1, true);
  hg.translate(0, height + 0.08, 0);
  g.add(mesh(hg, toon(color, { side: THREE.DoubleSide })));
  const bm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), glow(bulb, 3));
  bm.position.y = height - 0.02;
  bm.userData.noOutline = true; bm.userData.noShadow = true;
  g.add(bm);
  if (light) {
    const pl = new THREE.PointLight(bulb, 1.4, 6, 1.5);
    pl.position.y = height - 0.1;
    g.add(pl);
  }
  return g;
}

export function sign({ text = 'HOLE 1', color = 0xffe7b0, post = 0x7a4b2a, width = 1.4, height = 0.6, textColor = '#4a2e14' } = {}) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const pg = new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6);
    pg.translate(s * width * 0.38, 0.55, 0);
    g.add(mesh(pg, toon(post)));
  }
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * (height / width));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.round(c.height * 0.45)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bg = new THREE.BoxGeometry(width, height, 0.06);
  bg.translate(0, 1.1, 0);
  const board = mesh(bg, [toon(color), toon(color), toon(color), toon(color), toon(0xffffff, { map: tex }), toon(color)]);
  board.userData.dynamicOnly = true;
  g.add(board);
  return g;
}

// ---------------------------------------------------------------------------
// Terrain & scenery

// Ground disc around the course (visual only). heightFn adds rolling hills.
export function terrain({ radius = 45, y = -0.5, color = 0x6cc24a, map = null, heightFn = null, segments = 64, rings = 22 } = {}) {
  const g = new THREE.CircleGeometry(radius, segments, 0, Math.PI * 2);
  // replace with a ring-subdivided disc for smooth hills
  const pos = [];
  const idx = [];
  const uv = [];
  pos.push(0, y + (heightFn ? heightFn(0, 0) : 0), 0);
  uv.push(0, 0);
  for (let r = 1; r <= rings; r++) {
    const rad = radius * Math.pow(r / rings, 1.35);
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      pos.push(x, y + (heightFn ? heightFn(x, z) : 0), z);
      uv.push(x, -z);
    }
  }
  for (let s = 0; s < segments; s++) idx.push(0, 1 + ((s + 1) % segments), 1 + s);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segments, a1 = 1 + r * segments;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      idx.push(a0 + s, a0 + s1, a1 + s);
      idx.push(a0 + s1, a1 + s1, a1 + s);
    }
  }
  g.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, toon(color, { map }));
  m.receiveShadow = true;
  m.name = 'terrain';
  return m;
}

// Ring of stylised mountains on the horizon
export function mountains({ radius = 120, count = 14, color = 0x7fa6c9, snow = 0xffffff, height = 30, seed = 9, snowCaps = true } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const m = toon(color, { rim: 0 });
  const sm = toon(snow, { rim: 0 });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.3;
    const h = height * (0.6 + rand() * 0.7);
    const r = h * (0.9 + rand() * 0.5);
    const cg = new THREE.ConeGeometry(r, h, 7);
    const x = Math.cos(a) * radius * (0.9 + rand() * 0.2), z = Math.sin(a) * radius * (0.9 + rand() * 0.2);
    cg.translate(x, h / 2 - 2, z);
    g.add(mesh(cg, m, { noOutline: true, noShadow: true }));
    if (snowCaps) {
      const sg = new THREE.ConeGeometry(r * 0.32, h * 0.32, 7);
      sg.translate(x, h - h * 0.16 - 2 + 0.05, z);
      g.add(mesh(sg, sm, { noOutline: true, noShadow: true }));
    }
  }
  return g;
}

// Stylised waterfall: sheet + splash foam (visual). Returns group.
export function waterfall({ width = 1.2, height = 2.5, a = 0x5fd0ff, b = 0xffffff, glowAmt = 1, speed = 1.4 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(width, height, 1, 8);
  // slight outward bulge
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (height / 2 - p.getY(i)) / height;
    p.setZ(i, Math.sin(t * Math.PI * 0.5) * 0.25);
  }
  geo.computeVertexNormals();
  geo.translate(0, height / 2, 0);
  // uv.y should increase downward
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const sheet = new THREE.Mesh(geo, fallMaterial({ a, b, glow: glowAmt, speed }));
  sheet.userData.noOutline = true; sheet.userData.noShadow = true;
  g.add(sheet);
  const foam = new THREE.Group();
  const fm = toon(b);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + Math.random() * 0.1, 0), fm);
    s.position.set((i / 4 - 0.5) * width, 0.05, 0.3);
    s.userData.noShadow = true;
    foam.add(s);
  }
  g.add(foam);
  g.userData.update = (t) => {
    foam.children.forEach((s, i) => {
      const k = (t * 1.7 + i * 0.37) % 1;
      s.scale.setScalar(0.6 + k * 0.8);
      s.position.y = 0.05 + k * 0.15;
    });
  };
  return g;
}

// ---------------------------------------------------------------------------
// Particles (Points) for ambience

export function ambientParticles({ count = 300, area = [30, 8, 30], center = [0, 3, 0], color = 0xffffff, size = 0.12, mode = 'snow', opacity = 0.9 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * area[0];
    pos[i * 3 + 1] = Math.random() * area[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * area[2];
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const modes = { snow: 0, embers: 1, fireflies: 2, dust: 3, stars: 4 };
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size },
      uArea: { value: new THREE.Vector3(...area) },
      uCenter: { value: new THREE.Vector3(...center) },
      uMode: { value: modes[mode] ?? 0 },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uSize, uMode;
      uniform vec3 uArea, uCenter;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime;
        if (uMode < 0.5) { // snow: fall + drift
          p.y = mod(p.y - t * (0.5 + seed * 0.5), uArea.y);
          p.x += sin(t * 0.8 + seed * 20.0) * 0.4;
          p.z += cos(t * 0.6 + seed * 13.0) * 0.4;
          vA = 1.0;
        } else if (uMode < 1.5) { // embers: rise
          p.y = mod(p.y + t * (0.6 + seed * 0.8), uArea.y);
          p.x += sin(t * 1.5 + seed * 20.0) * 0.3;
          vA = 1.0 - p.y / uArea.y;
        } else if (uMode < 2.5) { // fireflies: wander and blink
          p.x += sin(t * 0.4 + seed * 30.0) * 1.2;
          p.y += sin(t * 0.7 + seed * 10.0) * 0.4;
          p.z += cos(t * 0.5 + seed * 20.0) * 1.2;
          vA = smoothstep(0.3, 1.0, sin(t * 2.0 + seed * 40.0));
        } else if (uMode < 3.5) { // dust motes
          p.x += sin(t * 0.2 + seed * 30.0) * 0.8;
          p.y += sin(t * 0.3 + seed * 10.0) * 0.5;
          vA = 0.6;
        } else { // twinkling
          vA = 0.5 + 0.5 * sin(t * 3.0 + seed * 50.0);
        }
        p += uCenter - vec3(0.0, 0.0, 0.0);
        p.x -= 0.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * 400.0 / max(0.5, -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uMode, uOpacity;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.2, d) * vA * uOpacity;
        vec3 col = uColor * (uMode > 0.5 && uMode < 2.5 ? 2.5 : 1.0);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: mode === 'snow' || mode === 'dust' ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  // position offset so the area is centred
  const p = geo.attributes.position;
  for (let i = 0; i < count; i++) p.setY(i, p.getY(i));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  // centre offset (x/z already centred)
  mat.uniforms.uCenter.value.set(center[0], center[1] - area[1] / 2, center[2]);
  return pts;
}

// ---------------------------------------------------------------------------
// Critters. Each returns a Group with userData.update(t, dt)

function eye(size = 0.03) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(size, 8, 6), toon(0xffffff), { noOutline: true, noShadow: true }));
  g.add(mesh(new THREE.SphereGeometry(size * 0.6, 8, 6), toon(0x111111), { pos: [0, 0, size * 0.55], noOutline: true, noShadow: true }));
  return g;
}
export { eye };

export function bunny({ color = 0xf5f0e8, path = [[0, 0]], y = 0, seed = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const m = toon(color);
  body.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), m, { pos: [0, 0.16, 0], scale: [1, 0.9, 1.2] }));
  body.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), m, { pos: [0, 0.3, 0.14] }));
  for (const s of [-1, 1]) {
    body.add(mesh(new THREE.CapsuleGeometry(0.03, 0.14, 3, 6), m, { pos: [s * 0.05, 0.46, 0.12], rot: [-0.25, 0, s * 0.2] }));
    body.add(mesh(new THREE.CapsuleGeometry(0.018, 0.1, 3, 6), toon(0xffb3c6), { pos: [s * 0.05, 0.46, 0.135], rot: [-0.25, 0, s * 0.2], noOutline: true }));
    const e = eye(0.022); e.position.set(s * 0.055, 0.33, 0.23); body.add(e);
  }
  body.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), toon(0xffffff), { pos: [0, 0.2, -0.2] }));
  body.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), toon(0xff8fa8), { pos: [0, 0.3, 0.25], noOutline: true }));
  g.add(body);
  const rand = rng(seed);
  let target = 0, from = V(path[0][0], y, path[0][1]), to = from.clone(), phase = 0, wait = rand() * 2;
  g.position.copy(from);
  g.userData.update = (t, dt) => {
    if (wait > 0) {
      wait -= dt;
      body.position.y = 0;
      body.rotation.x = Math.sin(t * 8) * 0.03;
      if (wait <= 0) {
        target = (target + 1) % path.length;
        from.copy(g.position);
        to.set(path[target][0] + (rand() - 0.5) * 0.5, y, path[target][1] + (rand() - 0.5) * 0.5);
        phase = 0;
        g.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      }
      return;
    }
    const dist = from.distanceTo(to);
    phase += dt * 2.4 / Math.max(0.3, dist);
    const hopCount = Math.max(1, Math.round(dist / 0.5));
    const k = Math.min(1, phase);
    g.position.lerpVectors(from, to, k);
    body.position.y = Math.abs(Math.sin(k * Math.PI * hopCount)) * 0.18;
    if (k >= 1) wait = 1 + rand() * 3;
  };
  return g;
}

export function butterfly({ color = 0xffa726, center = [0, 1, 0], radius = 2, seed = 1, speed = 0.6 } = {}) {
  const g = new THREE.Group();
  const wingG = new THREE.CircleGeometry(0.09, 8);
  wingG.scale(1, 1.3, 1);
  wingG.translate(0.08, 0, 0);
  const wm = toon(color, { side: THREE.DoubleSide });
  const w1 = mesh(wingG, wm, { noOutline: true, noShadow: true });
  const w2 = mesh(wingG, wm, { noOutline: true, noShadow: true });
  w2.scale.x = -1;
  const pivot1 = new THREE.Group(); pivot1.add(w1); pivot1.rotation.x = -Math.PI / 2;
  const pivot2 = new THREE.Group(); pivot2.add(w2); pivot2.rotation.x = -Math.PI / 2;
  const holder1 = new THREE.Group(); holder1.add(pivot1);
  const holder2 = new THREE.Group(); holder2.add(pivot2);
  g.add(holder1, holder2);
  g.add(mesh(new THREE.CapsuleGeometry(0.012, 0.08, 2, 4), toon(0x222222), { rot: [Math.PI / 2, 0, 0], noOutline: true, noShadow: true }));
  const rand = rng(seed);
  const ph = rand() * 10;
  g.userData.update = (t) => {
    const tt = t * speed + ph;
    const x = center[0] + Math.sin(tt) * radius + Math.sin(tt * 2.3) * 0.4;
    const z = center[2] + Math.cos(tt * 0.8) * radius;
    const y = center[1] + Math.sin(tt * 3.1) * 0.3;
    const nx = center[0] + Math.sin(tt + 0.05) * radius + Math.sin((tt + 0.05) * 2.3) * 0.4;
    const nz = center[2] + Math.cos((tt + 0.05) * 0.8) * radius;
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(nx - x, nz - z);
    const f = Math.sin(t * 22 + ph) * 0.9;
    holder1.rotation.z = f;
    holder2.rotation.z = -f;
  };
  return g;
}

export function bird({ color = 0xffffff, center = [0, 6, 0], radius = 8, height = 0, speed = 0.3, seed = 1, scale = 1, wingColor = null } = {}) {
  const g = new THREE.Group();
  const m = toon(color);
  const body = mesh(new THREE.CapsuleGeometry(0.08, 0.25, 3, 8), m, { rot: [Math.PI / 2, 0, 0] });
  g.add(body);
  g.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 6), toon(0xffa000), { pos: [0, 0, 0.23], rot: [Math.PI / 2, 0, 0], noOutline: true }));
  const wingG = new THREE.BoxGeometry(0.45, 0.02, 0.16);
  wingG.translate(0.24, 0, 0);
  const wm = toon(wingColor ?? color);
  const l = new THREE.Group(), r = new THREE.Group();
  l.add(mesh(wingG, wm)); const rw = mesh(wingG, wm); rw.scale.x = -1; r.add(rw);
  g.add(l, r);
  g.scale.setScalar(scale);
  const ph = rng(seed)() * 10;
  g.userData.update = (t) => {
    const a = t * speed + ph;
    g.position.set(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a * 2) * 0.5 + height, center[2] + Math.sin(a) * radius);
    g.rotation.y = -a + (speed > 0 ? 0 : Math.PI);
    g.rotation.z = -0.25;
    const f = Math.sin(t * 7 + ph) * 0.6;
    l.rotation.z = f; r.rotation.z = -f;
  };
  return g;
}

export function chicken({ path = [[0, 0], [1, 0]], y = 0, seed = 1 } = {}) {
  const g = new THREE.Group();
  const wm = toon(0xffffff);
  const body = new THREE.Group();
  body.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), wm, { pos: [0, 0.2, 0], scale: [0.9, 0.9, 1.15] }));
  body.add(mesh(new THREE.ConeGeometry(0.08, 0.16, 6), wm, { pos: [0, 0.3, -0.16], rot: [-2.2, 0, 0] }));
  const head = new THREE.Group();
  head.position.set(0, 0.34, 0.12);
  head.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), wm));
  head.add(mesh(new THREE.ConeGeometry(0.025, 0.07, 5), toon(0xffb300), { pos: [0, 0, 0.09], rot: [Math.PI / 2, 0, 0], noOutline: true }));
  head.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), toon(0xe53935), { pos: [0, 0.08, 0.01], scale: [0.6, 1.2, 1.3], noOutline: true }));
  for (const s of [-1, 1]) { const e = eye(0.016); e.position.set(s * 0.05, 0.02, 0.05); e.rotation.y = s * 0.5; head.add(e); }
  body.add(head);
  for (const s of [-1, 1]) body.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4), toon(0xffb300), { pos: [s * 0.05, 0.05, 0], noOutline: true }));
  g.add(body);
  const rand = rng(seed);
  let seg = 0, k = 0, peck = 0;
  g.userData.update = (t, dt) => {
    const a = path[seg], b = path[(seg + 1) % path.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (peck > 0) {
      peck -= dt;
      head.rotation.x = Math.abs(Math.sin(t * 14)) * 0.9;
      head.position.y = 0.34 - Math.abs(Math.sin(t * 14)) * 0.08;
      return;
    }
    head.rotation.x = 0; head.position.y = 0.34 + Math.sin(t * 12) * 0.01;
    k += (dt * 0.5) / Math.max(0.2, len);
    if (k >= 1) { k = 0; seg = (seg + 1) % path.length; peck = 0.8 + rand() * 1.5; }
    g.position.set(a[0] + (b[0] - a[0]) * k, y, a[1] + (b[1] - a[1]) * k);
    g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    body.rotation.z = Math.sin(t * 12) * 0.08;
  };
  return g;
}

export function crab({ path = [[0, 0], [1, 0]], y = 0, seed = 1 } = {}) {
  const g = new THREE.Group();
  const m = toon(0xff5a36);
  g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), m, { pos: [0, 0.1, 0], scale: [1.3, 0.6, 1] }));
  const claws = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(s * 0.18, 0.12, 0.1);
    c.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), m, { scale: [1, 0.7, 1.3] }));
    g.add(c); claws.push(c);
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 4), m, { pos: [s * 0.17, 0.05, -0.05 + i * 0.06], rot: [0, 0, s * 1.0], noOutline: true }));
    const e = eye(0.022); e.position.set(s * 0.05, 0.22, 0.08); g.add(e);
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 4), m, { pos: [s * 0.05, 0.17, 0.08], noOutline: true }));
  }
  const rand = rng(seed);
  let dir = 1, k = rand(), wait = 0;
  g.userData.update = (t, dt) => {
    claws.forEach((c, i) => { c.rotation.x = Math.sin(t * 6 + i) * 0.3; });
    if (wait > 0) { wait -= dt; return; }
    const a = path[0], b = path[1];
    k += dir * dt * 0.35;
    if (k > 1 || k < 0) { dir *= -1; k = Math.max(0, Math.min(1, k)); wait = 0.5 + rand() * 2; }
    g.position.set(a[0] + (b[0] - a[0]) * k, y + Math.abs(Math.sin(t * 20)) * 0.01, a[1] + (b[1] - a[1]) * k);
    g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2;
  };
  return g;
}

export function penguin({ path = [[0, 0], [1, 0]], y = 0, seed = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(mesh(new THREE.SphereGeometry(0.18, 12, 10), toon(0x22263a), { pos: [0, 0.25, 0], scale: [1, 1.35, 0.95] }));
  body.add(mesh(new THREE.SphereGeometry(0.15, 12, 10), toon(0xffffff), { pos: [0, 0.23, 0.05], scale: [0.95, 1.25, 0.9], noOutline: true }));
  body.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 6), toon(0xffa000), { pos: [0, 0.42, 0.18], rot: [Math.PI / 2, 0, 0], noOutline: true }));
  for (const s of [-1, 1]) {
    const e = eye(0.02); e.position.set(s * 0.06, 0.46, 0.14); body.add(e);
    body.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), toon(0x22263a), { pos: [s * 0.18, 0.25, 0], scale: [0.4, 1.4, 0.9] }));
    body.add(mesh(new THREE.SphereGeometry(0.045, 6, 4), toon(0xffa000), { pos: [s * 0.07, 0.02, 0.06], scale: [1, 0.4, 1.5], noOutline: true }));
  }
  g.add(body);
  const rand = rng(seed);
  let seg = 0, k = rand(), wait = 0;
  g.userData.update = (t, dt) => {
    const a = path[seg], b = path[(seg + 1) % path.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (wait > 0) { wait -= dt; body.rotation.z = 0; return; }
    k += (dt * 0.35) / Math.max(0.2, len);
    if (k >= 1) { k = 0; seg = (seg + 1) % path.length; wait = 1 + rand() * 2; }
    g.position.set(a[0] + (b[0] - a[0]) * k, y, a[1] + (b[1] - a[1]) * k);
    g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    body.rotation.z = Math.sin(t * 9) * 0.15;
  };
  return g;
}

export function fish({ color = 0xff9f1c, center = [0, 0, 0], y = 0, seed = 1, period = 5 } = {}) {
  const g = new THREE.Group();
  const m = toon(color);
  const inner = new THREE.Group();
  inner.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), m, { scale: [0.6, 1, 1.4] }));
  inner.add(mesh(new THREE.ConeGeometry(0.1, 0.14, 4), m, { pos: [0, 0, -0.2], rot: [-Math.PI / 2, 0, 0] }));
  for (const s of [-1, 1]) { const e = eye(0.02); e.position.set(s * 0.06, 0.03, 0.1); e.rotation.y = s * 0.6; inner.add(e); }
  g.add(inner);
  const rand = rng(seed);
  const ph = rand() * period;
  let dir = rand() * Math.PI * 2;
  let lastCycle = -1;
  g.userData.update = (t) => {
    const tt = (t + ph) % period;
    const cycle = Math.floor((t + ph) / period);
    if (cycle !== lastCycle) { lastCycle = cycle; dir = rand() * Math.PI * 2; }
    const jump = 1.1;
    if (tt < jump) {
      const k = tt / jump;
      g.visible = true;
      const d = (k - 0.5) * 1.4;
      g.position.set(center[0] + Math.cos(dir) * d, y + Math.sin(k * Math.PI) * 0.9 - 0.1, center[2] + Math.sin(dir) * d);
      g.rotation.set(0, -dir + Math.PI / 2, 0);
      inner.rotation.x = (k - 0.5) * 2.2;
    } else g.visible = false;
  };
  return g;
}

export function duck({ center = [0, 0], radius = 1, y = 0, seed = 1 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), toon(0xffe14d), { pos: [0, 0.08, 0], scale: [1, 0.75, 1.3] }));
  g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), toon(0xffe14d), { pos: [0, 0.24, 0.12] }));
  g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), toon(0xff8a00), { pos: [0, 0.22, 0.22], scale: [1, 0.5, 1.4], noOutline: true }));
  for (const s of [-1, 1]) { const e = eye(0.018); e.position.set(s * 0.05, 0.27, 0.19); g.add(e); }
  const ph = rng(seed)() * 10;
  g.userData.update = (t) => {
    const a = t * 0.25 + ph;
    g.position.set(center[0] + Math.cos(a) * radius, y + Math.sin(t * 2 + ph) * 0.02, center[1] + Math.sin(a) * radius);
    g.rotation.y = -a;
    g.rotation.z = Math.sin(t * 2.5 + ph) * 0.06;
  };
  return g;
}

export function frog({ pos = [0, 0, 0], seed = 1 } = {}) {
  const g = new THREE.Group();
  const m = toon(0x5ccf3c);
  const body = new THREE.Group();
  body.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), m, { pos: [0, 0.09, 0], scale: [1.1, 0.75, 1.1] }));
  for (const s of [-1, 1]) {
    body.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), m, { pos: [s * 0.06, 0.17, 0.06] }));
    const e = eye(0.028); e.position.set(s * 0.06, 0.18, 0.08); body.add(e);
    body.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), m, { pos: [s * 0.1, 0.04, -0.05], scale: [0.8, 0.6, 1.4] }));
  }
  g.add(body);
  g.position.set(...pos);
  const rand = rng(seed);
  let next = 1 + rand() * 3, hopT = -1;
  const base = V(...pos);
  g.userData.update = (t, dt) => {
    body.scale.y = 1 + Math.sin(t * 3) * 0.04;
    next -= dt;
    if (next <= 0 && hopT < 0) { hopT = 0; next = 2 + rand() * 4; }
    if (hopT >= 0) {
      hopT += dt * 2.2;
      body.position.y = Math.sin(Math.min(1, hopT) * Math.PI) * 0.3;
      if (hopT >= 1) { hopT = -1; body.position.y = 0; g.rotation.y = rand() * Math.PI * 2; }
    }
    g.position.copy(base);
  };
  return g;
}

export function dragonfly({ center = [0, 1, 0], radius = 1.5, color = 0x3de0ff, seed = 1 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(0.015, 0.2, 2, 5), glow(color, 1.5), { rot: [Math.PI / 2, 0, 0], noOutline: true, noShadow: true }));
  const wm = new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const wings = [];
  for (const z of [0.03, -0.03]) for (const s of [-1, 1]) {
    const wg = new THREE.PlaneGeometry(0.2, 0.04);
    wg.translate(0.1 * s, 0, 0);
    const w = mesh(wg, wm, { pos: [0, 0.01, z], rot: [-Math.PI / 2, 0, 0], noOutline: true, noShadow: true });
    g.add(w); wings.push(w);
  }
  const ph = rng(seed)() * 10;
  g.userData.update = (t) => {
    const a = t * 0.7 + ph;
    const jitter = Math.sin(t * 3 + ph) > 0.7 ? 0.3 : 0;
    g.position.set(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a * 3) * 0.2 + jitter * 0.3, center[2] + Math.sin(a * 1.3) * radius);
    g.rotation.y = -a;
    wings.forEach((w, i) => { w.rotation.y = Math.sin(t * 60 + i) * 0.4; });
  };
  return g;
}

// ---------------------------------------------------------------------------
// Mechanical

export function gearGeometry({ radius = 1, teeth = 12, depth = 0.2, toothDepth = 0.18, hole = 0.25 } = {}) {
  const shape = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const phase = i % 4;
    const r = phase === 1 || phase === 2 ? radius : radius - toothDepth;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export function pipe({ from, to, radius = 0.12, color = 0xb87333 }) {
  const a = V(...from), b = V(...to);
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(radius, radius, len, 10);
  const m = mesh(g, toon(color));
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
