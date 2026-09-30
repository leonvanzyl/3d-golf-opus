// Course builder: every helper creates matching visual geometry and physics
// colliders. Static visual geometry is batched per material and merged at the
// end to keep draw calls low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PhysicsWorld, Surfaces, Body, hazardZone, surface as mkSurface, BALL_RADIUS } from '../physics/Physics.js';
import { toon, addOutline, computeOutlineNormals, outlineMaterial, glow } from '../engine/materials.js';
import { waterMaterial, lavaMaterial } from '../engine/shaders.js';

export const CUP_RADIUS = 0.17;
export const CUP_DEPTH = 0.24;

const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// small geometry helpers

export function circlePts(cx, cz, r, n = 32, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const count = full ? n : n + 1;
  for (let i = 0; i < count; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

export function rectPts(x0, z0, x1, z1) {
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}

export function roundRectPts(x0, z0, x1, z1, r, seg = 6) {
  const pts = [];
  const corners = [
    [x1 - r, z1 - r, 0], [x0 + r, z1 - r, Math.PI / 2], [x0 + r, z0 + r, Math.PI], [x1 - r, z0 + r, Math.PI * 1.5],
  ];
  for (const [cx, cz, a] of corners) {
    for (let i = 0; i <= seg; i++) {
      const t = a + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]);
    }
  }
  return pts;
}

// Offset a 2D polyline sideways (positive = right of travel direction)
export function offsetPolyline(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    // right of direction (tx,tz) in xz with y up is (-tz, tx)
    out.push([p[0] - tz * d, p[1] + tx * d]);
  }
  return out;
}

// Assign a 0..1 "sway" weight from local height
export function setSway(geometry, y0, y1, power = 1) {
  const pos = geometry.attributes.position;
  const arr = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / (y1 - y0), 0, 1);
    arr[i] = Math.pow(t, power);
  }
  geometry.setAttribute('sway', new THREE.BufferAttribute(arr, 1));
  return geometry;
}

function ensureAttributes(g, withSway) {
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'sway', 'outlineNormal'].includes(name)) g.deleteAttribute(name);
  }
  if (withSway && !g.attributes.sway) g.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
  if (!withSway && g.attributes.sway) g.deleteAttribute('sway');
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

// Sweep a 2D profile [[r,u],...] along frames [{p, r, u}] -> BufferGeometry
// Each profile segment becomes its own smooth strip; edges stay sharp.
function sweepProfile(frames, profile, { vScale = 1, closedProfile = false } = {}) {
  const segs = [];
  const np = profile.length;
  const segCount = closedProfile ? np : np - 1;
  // cumulative distance along the path
  const dist = [0];
  for (let i = 1; i < frames.length; i++) dist.push(dist[i - 1] + frames[i].p.distanceTo(frames[i - 1].p));
  let uAcc = 0;
  for (let s = 0; s < segCount; s++) {
    const a = profile[s], b = profile[(s + 1) % np];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      for (const [k, q] of [[0, a], [1, b]]) {
        const v = f.p.clone().addScaledVector(f.r, q[0]).addScaledVector(f.u, q[1]);
        pos.push(v.x, v.y, v.z);
        uv.push(uAcc + k * segLen, dist[i] * vScale);
      }
    }
    for (let i = 0; i < frames.length - 1; i++) {
      const i0 = i * 2, i1 = i * 2 + 1, i2 = (i + 1) * 2, i3 = (i + 1) * 2 + 1;
      idx.push(i0, i1, i2, i1, i3, i2);
    }
    uAcc += segLen;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    segs.push(g);
  }
  return segs;
}

// Cap a closed profile polygon at a frame (for wall ends)
function capProfile(frame, profile, flip) {
  const contour = profile.map(([r, u]) => new THREE.Vector2(r, u));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const pos = [];
  for (const t of tris) {
    const order = flip ? [t[0], t[2], t[1]] : t;
    for (const i of order) {
      const v = frame.p.clone().addScaledVector(frame.r, profile[i][0]).addScaledVector(frame.u, profile[i][1]);
      pos.push(v.x, v.y, v.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Fix winding so the triangle normal points roughly along `dir` (for caps)
function orientCap(g, dir) {
  const p = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.dot(dir) < 0) {
      p.setXYZ(i + 1, c.x, c.y, c.z); p.setXYZ(i + 2, b.x, b.y, b.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------

export class Builder {
  constructor({ visual = true } = {}) {
    this.visual = visual;
    this.world = new PhysicsWorld();
    this.group = new THREE.Group();
    this.group.name = 'hole';
    this.batches = new Map();
    this.animators = [];
    this.movers = [];
    this.bounds = new THREE.Box3();
    this.path = [];
    this.tee = { pos: new THREE.Vector3(), yaw: 0 };
    this.cupInfo = null;
    this.lights = [];
    this.flyover = null;
    this.hazardsY = [];
    this.disposables = [];
    this.camHints = [];
  }

  // ---- batching -----------------------------------------------------------

  // Queue geometry (already in world space) for merging.
  addStatic(geometry, material, { outline = true, castShadow = true, receiveShadow = true, outlineWidth = 1 } = {}) {
    if (!this.visual || !material) return;
    const sway = (material.userData && material.userData.sway) > 0;
    const key = material.uuid + (outline ? ':o' + outlineWidth : '') + (castShadow ? ':c' : '') + (receiveShadow ? ':r' : '');
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { material, outline, castShadow, receiveShadow, outlineWidth, geoms: [], sway };
      this.batches.set(key, batch);
    }
    const g = ensureAttributes(geometry, sway);
    if (outline) computeOutlineNormals(g);
    batch.geoms.push(g);
  }

  // Bake a (static) object hierarchy into the batches.
  addStaticObject(obj, opts = {}) {
    if (!this.visual) return;
    obj.updateMatrixWorld(true);
    obj.traverse((m) => {
      if (!m.isMesh || m.name === 'outline') return;
      if (Array.isArray(m.material) || m.userData.dynamicOnly || m.isInstancedMesh) {
        const c = m.isInstancedMesh ? m : new THREE.Mesh(m.geometry, m.material);
        if (!m.isInstancedMesh) { c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); }
        c.castShadow = !m.userData.noShadow;
        c.receiveShadow = true;
        if (opts.outline !== false && !m.userData.noOutline && !m.isInstancedMesh) addOutline(c);
        this.group.add(c);
        return;
      }
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const o = { ...opts };
      if (m.userData.noOutline) o.outline = false;
      if (m.userData.noShadow) o.castShadow = false;
      this.addStatic(g, m.material, o);
    });
  }

  finalize() {
    if (this.visual) {
      for (const batch of this.batches.values()) {
        const merged = mergeGeometries(batch.geoms, false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, batch.material);
        mesh.castShadow = batch.castShadow;
        mesh.receiveShadow = batch.receiveShadow;
        if (batch.outline) {
          const o = new THREE.Mesh(merged, outlineMaterial(0x1b1530, batch.sway ? batch.material.userData.sway : 0, batch.outlineWidth));
          o.name = 'outline';
          mesh.add(o);
        }
        this.group.add(mesh);
        this.disposables.push(merged);
      }
      this.batches.clear();
    }
    // bounds from physics geometry if nothing else
    if (this.bounds.isEmpty()) this.bounds.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 1, 5));
    return this;
  }

  expand(x, y, z) { this.bounds.expandByPoint(new THREE.Vector3(x, y, z)); }

  // Add a dynamic (non-merged) object to the scene
  add(obj, { outline = false, shadow = true } = {}) {
    if (!this.visual) return obj;
    obj.traverse((m) => {
      if (m.isMesh && m.name !== 'outline') {
        m.castShadow = shadow && !m.userData.noShadow;
        m.receiveShadow = true;
        if (outline && !m.userData.noOutline) addOutline(m, { width: m.userData.outlineWidth || 1 });
      }
    });
    this.group.add(obj);
    return obj;
  }

  animate(fn) { this.animators.push(fn); }

  // ---- course primitives ---------------------------------------------------

  // Flat slab from a polygon. points: [[x,z],...]. holes: [[[x,z],...], ...]
  floor(points, { y = 0, depth = 0.5, holes = [], mat, sideMat, surface = 'grass', sideSurface = 'wall', physics = true, outline = true } = {}) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 8 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y - depth, 0);
    const ni = geo.index ? geo.toNonIndexed() : geo;
    const pos = ni.attributes.position, uv = ni.attributes.uv;
    const top = { p: [], uv: [] }, side = { p: [], uv: [] };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      if (n.y < -0.99) continue;
      const tgt = n.y > 0.99 ? top : side;
      for (let k = 0; k < 3; k++) {
        tgt.p.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
        if (tgt === top) tgt.uv.push(pos.getX(i + k), -pos.getZ(i + k));
        else tgt.uv.push(uv.getX(i + k), uv.getY(i + k));
      }
    }
    const mk = (d) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
      g.computeVertexNormals();
      return g;
    };
    const topG = mk(top), sideG = mk(side);
    if (physics) {
      const s = typeof surface === 'string' ? Surfaces[surface] : surface;
      const ss = typeof sideSurface === 'string' ? Surfaces[sideSurface] : sideSurface;
      this.world.addGeometry(topG, s);
      this.world.addGeometry(sideG, ss);
    }
    this.addStatic(topG, mat, { outline: false, castShadow: false });
    this.addStatic(sideG, sideMat || mat, { outline, castShadow: false });
    for (const [x, z] of points) { this.expand(x, y, z); this.expand(x, y - depth, z); }
    geo.dispose();
    return { top: topG, side: sideG };
  }

  // Walls along a polyline. points: [[x,z]] or [[x,y,z]] (y = floor height)
  wall(points, { y = 0, height = 0.22, thickness = 0.12, mat, capMat, surface = 'wall', closed = false, embed = 0.08, outline = true, physics = true, align = 'center' } = {}) {
    const pts = points.map((p) => (p.length === 2 ? new THREE.Vector3(p[0], y, p[1]) : new THREE.Vector3(p[0], p[1], p[2])));
    if (closed) pts.push(pts[0].clone());
    const frames = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = i > 0 ? pts[i - 1] : (closed ? pts[n - 2] : null);
      const next = i < n - 1 ? pts[i + 1] : (closed ? pts[1] : null);
      const d1 = prev ? new THREE.Vector3(pts[i].x - prev.x, 0, pts[i].z - prev.z).normalize() : null;
      const d2 = next ? new THREE.Vector3(next.x - pts[i].x, 0, next.z - pts[i].z).normalize() : null;
      const r1 = d1 ? new THREE.Vector3(-d1.z, 0, d1.x) : null;
      const r2 = d2 ? new THREE.Vector3(-d2.z, 0, d2.x) : null;
      let r;
      if (r1 && r2) {
        r = r1.clone().add(r2);
        if (r.lengthSq() < 1e-8) r = r1.clone(); else r.normalize();
        const cos = Math.max(0.35, r.dot(r1));
        r.multiplyScalar(1 / cos);
      } else r = (r1 || r2).clone();
      frames.push({ p: pts[i], r, u: UP });
    }
    const t = thickness;
    const off = align === 'center' ? -t / 2 : align === 'left' ? -t : 0;
    const r0 = off, r1 = off + t;
    const h = height;
    // profile: right face (r1) up, top, left face down (open profile, bottom hidden)
    const sideProfileA = [[r1, h], [r1, -embed]];
    const topProfile = [[r0, h], [r1, h]];
    const sideProfileB = [[r0, -embed], [r0, h]];
    const sA = sweepProfile(frames, sideProfileA)[0];
    const sT = sweepProfile(frames, topProfile)[0];
    const sB = sweepProfile(frames, sideProfileB)[0];
    const geoms = [sA, sB];
    if (!closed) {
      const prof = [[r0, -embed], [r1, -embed], [r1, h], [r0, h]];
      const f0 = frames[0], f1 = frames[frames.length - 1];
      const dir0 = pts[0].clone().sub(pts[1]).setY(0).normalize();
      const dir1 = pts[n - 1].clone().sub(pts[n - 2]).setY(0).normalize();
      geoms.push(orientCap(capProfile(f0, prof, false), dir0));
      geoms.push(orientCap(capProfile(f1, prof, false), dir1));
    }
    const s = typeof surface === 'string' ? Surfaces[surface] : surface;
    if (physics) {
      for (const g of geoms) this.world.addGeometry(g, s);
      this.world.addGeometry(sT, s);
    }
    for (const g of geoms) this.addStatic(g, mat, { outline });
    this.addStatic(sT, capMat || mat, { outline });
    for (const p of pts) this.expand(p.x, p.y + h, p.z);
  }

  // Swept track along a ground path. The horizontal path is a centripetal
  // Catmull-Rom spline through the points; heights use monotone cubic
  // interpolation so ramps never overshoot (ends are flat unless endSlopes given).
  // points: [[x,y,z], ...]; walls: 'both' | 'left' | 'right' | 'none'
  track(points, opts = {}) {
    const { spacing = 0.2, bank = null, flatEnds = true } = opts;
    const pts = pathPoints(points, spacing, flatEnds);
    const frames = [];
    const n = pts.length - 1;
    for (let i = 0; i <= n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      const T = b.clone().sub(a).normalize();
      const Rt = new THREE.Vector3().crossVectors(T, UP);
      if (Rt.lengthSq() < 1e-8) Rt.set(1, 0, 0);
      Rt.normalize();
      const Up = new THREE.Vector3().crossVectors(Rt, T).normalize();
      const u = i / n;
      if (bank) {
        const ang = typeof bank === 'function' ? bank(u) : bank;
        const q = new THREE.Quaternion().setFromAxisAngle(T, -ang);
        Rt.applyQuaternion(q); Up.applyQuaternion(q);
      }
      frames.push({ p, r: Rt, u: Up, t: T, s: u });
    }
    return this.trackFrames(frames, opts);
  }

  // Vertical loop-the-loop with lead-in/out, offset sideways so it exits beside the entry.
  loop({ entry, yaw = 0, radius = 1.2, lateral = 0.9, leadIn = 1.5, leadOut = 1.5, ...opts }) {
    const E = new THREE.Vector3(...entry);
    const F = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const S = new THREE.Vector3().crossVectors(F, UP).normalize();
    const frames = [];
    const push = (p, T, U) => {
      const Rt = new THREE.Vector3().crossVectors(T, U).normalize();
      frames.push({ p, t: T.clone().normalize(), r: Rt, u: new THREE.Vector3().crossVectors(Rt, T).normalize() });
    };
    const step = 0.15;
    for (let d = -leadIn; d < 0; d += step) push(E.clone().addScaledVector(F, d), F, UP);
    const circ = Math.PI * 2 * radius;
    const n = Math.ceil(circ / 0.1);
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      // lateral shift eased so the entry and exit are straight
      const e = 0.5 - 0.5 * Math.cos(th / 2);
      const de = 0.25 * Math.sin(th / 2);
      const p = E.clone().addScaledVector(F, radius * Math.sin(th)).addScaledVector(UP, radius * (1 - Math.cos(th))).addScaledVector(S, lateral * e);
      const T = F.clone().multiplyScalar(radius * Math.cos(th)).addScaledVector(UP, radius * Math.sin(th)).addScaledVector(S, lateral * de);
      const U = F.clone().multiplyScalar(-Math.sin(th)).addScaledVector(UP, Math.cos(th));
      push(p, T, U);
    }
    const X = E.clone().addScaledVector(S, lateral);
    for (let d = step; d <= leadOut + 1e-6; d += step) push(X.clone().addScaledVector(F, d), F, UP);
    frames.forEach((f, i) => { f.s = i / (frames.length - 1); });
    const res = this.trackFrames(frames, opts);
    res.exit = X.clone().addScaledVector(F, leadOut);
    return res;
  }

  trackFrames(frames, opts = {}) {
    const {
      width = 1.6, mat, sideMat, wallMat, capMat,
      walls = 'both', wallHeight = 0.22, wallThickness = 0.12, skirt = 0.35, surface = 'grass',
      wallSurface = 'wall', physics = true, outline = true, widthFn = null, bottom = true, vScale = 1,
    } = opts;
    const len = frames.reduce((acc, f, i) => acc + (i ? f.p.distanceTo(frames[i - 1].p) : 0), 0);
    const wFn = widthFn || (() => width);
    const surf = typeof surface === 'string' ? Surfaces[surface] : surface;
    const wsurf = typeof wallSurface === 'string' ? Surfaces[wallSurface] : wallSurface;

    // floor strip (per-frame width)
    const floorFrames = frames.map((f) => f);
    const floorPos = [], floorUv = [], floorIdx = [];
    let dist = 0;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (i > 0) dist += f.p.distanceTo(frames[i - 1].p);
      const w = wFn(f.s) / 2;
      const L = f.p.clone().addScaledVector(f.r, -w), Rr = f.p.clone().addScaledVector(f.r, w);
      floorPos.push(L.x, L.y, L.z, Rr.x, Rr.y, Rr.z);
      floorUv.push(-w, dist * vScale, w, dist * vScale);
      f.w = w;
    }
    for (let i = 0; i < frames.length - 1; i++) {
      const i0 = i * 2, i1 = i * 2 + 1, i2 = (i + 1) * 2, i3 = (i + 1) * 2 + 1;
      floorIdx.push(i0, i1, i2, i1, i3, i2);
    }
    const floorG = new THREE.BufferGeometry();
    floorG.setAttribute('position', new THREE.Float32BufferAttribute(floorPos, 3));
    floorG.setAttribute('uv', new THREE.Float32BufferAttribute(floorUv, 2));
    floorG.setIndex(floorIdx);
    floorG.computeVertexNormals();
    if (physics) this.world.addGeometry(floorG, surf);
    this.addStatic(floorG, mat, { outline: false, castShadow: false });

    // skirt (visual only + physics for the sides)
    if (skirt > 0) {
      const mkSide = (sign) => {
        const fr = frames.map((f) => ({ p: f.p.clone().addScaledVector(f.r, sign * f.w), r: f.r, u: f.u }));
        return sweepProfile(fr, sign > 0 ? [[0, 0], [0, -skirt]] : [[0, -skirt], [0, 0]])[0];
      };
      const sL = mkSide(-1), sR = mkSide(1);
      if (physics) { this.world.addGeometry(sL, Surfaces.wall); this.world.addGeometry(sR, Surfaces.wall); }
      this.addStatic(sL, sideMat || mat, { outline, castShadow: false });
      this.addStatic(sR, sideMat || mat, { outline, castShadow: false });
      if (bottom) {
        const fr = frames.map((f) => ({ p: f.p.clone().addScaledVector(f.u, -skirt), r: f.r, u: f.u }));
        const wmax = Math.max(...frames.map((f) => f.w));
        const bot = sweepProfile(fr, [[wmax, 0], [-wmax, 0]])[0];
        this.addStatic(bot, sideMat || mat, { outline: false, castShadow: false });
      }
    }

    // walls
    const mkWall = (sign, hFn) => {
      const fr = frames.map((f) => ({ p: f.p.clone().addScaledVector(f.r, sign * f.w), r: f.r.clone().multiplyScalar(sign), u: f.u, s: f.s }));
      const t = wallThickness;
      const h = wallHeight;
      // local r axis points outward
      const inner = sweepProfile(fr, [[0, -0.05], [0, h]])[0];
      const top = sweepProfile(fr, [[0, h], [t, h]])[0];
      const outer = sweepProfile(fr, [[t, h], [t, -skirt]])[0];
      const prof = [[0, -0.05], [t, -0.05], [t, h], [0, h]];
      const c0 = orientCap(capProfile(fr[0], prof, false), frames[0].t.clone().negate());
      const c1 = orientCap(capProfile(fr[fr.length - 1], prof, false), frames[frames.length - 1].t.clone());
      // fix winding of the mirrored side
      const parts = [inner, outer, c0, c1];
      if (sign < 0) for (const g of [inner, top, outer]) flipWinding(g);
      if (physics) { for (const g of parts) this.world.addGeometry(g, wsurf); this.world.addGeometry(top, wsurf); }
      for (const g of parts) this.addStatic(g, wallMat || mat, { outline });
      this.addStatic(top, capMat || wallMat || mat, { outline });
    };
    if (walls === 'both' || walls === 'left') mkWall(-1);
    if (walls === 'both' || walls === 'right') mkWall(1);

    for (const f of frames) { this.expand(f.p.x, f.p.y, f.p.z); }
    return { frames, length: len };
  }

  // Static box collider + visual
  box(center, size, { rotY = 0, rot = null, mat, surface = 'wall', outline = true, physics = true, visual = true, castShadow = true, topMat = null } = {}) {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...center),
      new THREE.Quaternion().setFromEuler(rot ? new THREE.Euler(...rot) : new THREE.Euler(0, rotY, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    if (physics) this.world.addGeometry(g, typeof surface === 'string' ? Surfaces[surface] : surface);
    if (visual) {
      if (topMat) {
        // split top face (+y group 2 in BoxGeometry) to another material
        const ni = g.toNonIndexed();
        const top = extractByNormal(ni, (n) => n.y > 0.9);
        const rest = extractByNormal(ni, (n) => n.y <= 0.9);
        this.addStatic(top, topMat, { outline, castShadow });
        this.addStatic(rest, mat, { outline, castShadow });
      } else this.addStatic(g, mat, { outline, castShadow });
    }
    this.expand(center[0], center[1] + size[1] / 2, center[2]);
    return g;
  }

  cylinder(center, r, h, { mat, surface = 'wall', segments = 20, outline = true, physics = true, r2 = null, castShadow = true } = {}) {
    const g = new THREE.CylinderGeometry(r2 ?? r, r, h, segments);
    g.translate(center[0], center[1] + h / 2, center[2]);
    if (physics) this.world.addGeometry(g, typeof surface === 'string' ? Surfaces[surface] : surface);
    this.addStatic(g, mat, { outline, castShadow });
    return g;
  }

  // Arbitrary mesh geometry (world space) as static collider and/or visual
  mesh(geometry, { mat, surface = 'wall', physics = true, outline = true, castShadow = true, receiveShadow = true, filter = null } = {}) {
    if (physics) this.world.addGeometry(geometry, typeof surface === 'string' ? Surfaces[surface] : surface, null, filter);
    this.addStatic(geometry, mat, { outline, castShadow, receiveShadow });
    return geometry;
  }

  // The cup: floor must have a matching hole (use cupHole()).
  cup(x, y, z, { flagColor = 0xff3b3b, poleColor = 0xffffff, rimColor = 0xffffff } = {}) {
    const r = CUP_RADIUS, d = CUP_DEPTH;
    const liner = new THREE.CylinderGeometry(r, r, d, 32, 1, true);
    liner.translate(x, y - d / 2, z);
    this.world.addGeometry(liner, Surfaces.softWall);
    const bottom = new THREE.CircleGeometry(r + 0.01, 32);
    bottom.rotateX(-Math.PI / 2);
    bottom.translate(x, y - d, z);
    this.world.addGeometry(bottom, Surfaces.felt);
    this.world.setCup(x, y, z, r);
    this.cupInfo = { x, y, z, r };
    if (this.visual) {
      const linerMat = toon(0xf4f4f4, { side: THREE.BackSide });
      const lm = new THREE.Mesh(liner, linerMat);
      lm.receiveShadow = true;
      this.group.add(lm);
      const bm = new THREE.Mesh(bottom, toon(0x2a2a3a));
      this.group.add(bm);
      const ring = new THREE.RingGeometry(r, r + 0.035, 40);
      ring.rotateX(-Math.PI / 2);
      ring.translate(x, y + 0.004, z);
      this.group.add(new THREE.Mesh(ring, toon(rimColor)));
      // flag
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 8), toon(poleColor));
      pole.position.y = 0.8 - d + 0.02;
      flag.add(pole);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), toon(0xffd84a));
      ball.position.y = 1.6 - d + 0.04;
      flag.add(ball);
      const clothGeo = new THREE.PlaneGeometry(0.5, 0.32, 10, 4);
      clothGeo.translate(0.25, 0, 0);
      const cloth = new THREE.Mesh(clothGeo, toon(flagColor, { side: THREE.DoubleSide }));
      cloth.position.y = 1.6 - d - 0.18;
      flag.add(cloth);
      addOutline(pole, { width: 0.7 });
      flag.position.set(x, y, z);
      flag.traverse((m) => { if (m.isMesh && m.name !== 'outline') m.castShadow = true; });
      this.group.add(flag);
      const base = clothGeo.attributes.position.array.slice();
      this.flag = { group: flag, cloth, raise: 0, target: 0 };
      this.animate((dt, t) => {
        const p = clothGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const bx = base[i * 3], by = base[i * 3 + 1];
          const k = bx / 0.5;
          p.setZ(i, Math.sin(t * 5 + bx * 9) * 0.06 * k + Math.sin(t * 3.1 + by * 6) * 0.02 * k);
          p.setY(i, by + Math.sin(t * 4 + bx * 6) * 0.015 * k);
        }
        p.needsUpdate = true;
        clothGeo.computeVertexNormals();
        const f = this.flag;
        f.raise += (f.target - f.raise) * Math.min(1, dt * 4);
        f.group.position.y = y + f.raise * 0.9;
        f.group.rotation.y = f.raise * t * 6;
      });
    }
  }

  // Circular hole polygon for floors
  static cupHole(x, z) { return circlePts(x, z, CUP_RADIUS, 32); }

  // Camera hint: while the ball is inside [min, max] the chase camera moves to pos looking at look
  camHint(min, max, pos, look = null) {
    this.camHints.push({ min: new THREE.Vector3(...min), max: new THREE.Vector3(...max), pos: new THREE.Vector3(...pos), look: look ? new THREE.Vector3(...look) : null });
  }

  // Water surface + hazard zone (triggers as the ball sinks into it). poly: [[x,z]...]
  water(poly, y, opts = {}) {
    this.world.addZone(hazardZone('water', poly, y + BALL_RADIUS * 0.5));
    this.hazardsY.push(y);
    if (!this.visual) return;
    const mat = waterMaterial(opts);
    const geo = polyGeometry(poly, y, opts.segments ?? 0.5);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    this.group.add(m);
    this.disposables.push(geo, mat);
    return m;
  }

  lava(poly, y, opts = {}) {
    this.world.addZone(hazardZone('lava', poly, y + BALL_RADIUS * 0.5));
    this.hazardsY.push(y);
    if (!this.visual) return;
    const mat = lavaMaterial(opts);
    const geo = polyGeometry(poly, y, opts.segments ?? 0.5);
    const m = new THREE.Mesh(geo, mat);
    this.group.add(m);
    this.disposables.push(geo, mat);
    return m;
  }

  // Out-of-bounds plane (touching it resets the ball with a penalty)
  outOfBounds(y, size = 200) {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    this.world.addGeometry(g, Surfaces.ob);
    this.world.killY = y - 5;
  }

  // Moving obstacle. object: visual Object3D (placed at origin; its matrix is driven by the body)
  mover({ object = null, shapes, surface = 'wall', update, onHit = null, name = '' }) {
    const body = new Body({ shapes, material: typeof surface === 'string' ? Surfaces[surface] : surface, update, onHit, name });
    this.world.addBody(body);
    if (object && this.visual) {
      object.matrixAutoUpdate = false;
      object.matrix.copy(body.matrix);
      this.add(object, { outline: false });
      this.movers.push({ body, object });
    }
    return body;
  }

  setPath(points) { this.path = points.map((p) => new THREE.Vector3(p[0], p[1] ?? 0, p[2])); }
  setTee(x, y, z, yaw) { this.tee.pos.set(x, y, z); this.tee.yaw = yaw; }
}

// Merge the static meshes of a (moving) prop into one mesh per material, keeping
// the listed objects (and their descendants) as separate animatable parts.
export function bakeGroup(group, keep = []) {
  const keepSet = new Set(keep);
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map();
  const remove = [];
  group.traverse((m) => {
    if (!m.isMesh || m.name === 'outline' || m.isInstancedMesh || Array.isArray(m.material)) return;
    for (let p = m; p && p !== group; p = p.parent) if (keepSet.has(p)) return;
    const sway = (m.material.userData && m.material.userData.sway) > 0;
    const key = m.material.uuid + (m.userData.noOutline ? ':n' : ':o') + (m.userData.noShadow ? ':s' : '');
    let bk = buckets.get(key);
    if (!bk) { bk = { material: m.material, geoms: [], noOutline: m.userData.noOutline, noShadow: m.userData.noShadow }; buckets.set(key, bk); }
    const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    bk.geoms.push(ensureAttributes(g, sway));
    remove.push(m);
  });
  for (const m of remove) m.parent.remove(m);
  for (const bk of buckets.values()) {
    const merged = mergeGeometries(bk.geoms, false);
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, bk.material);
    mm.userData.noOutline = bk.noOutline;
    mm.userData.noShadow = bk.noShadow;
    group.add(mm);
  }
  return group;
}

// Monotone cubic (Fritsch-Carlson) interpolation. Returns f(x).
export function monotoneCubic(xs, ys, flatEnds = true) {
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]));
  m[0] = flatEnds ? 0 : d[0];
  m[n - 1] = flatEnds ? 0 : d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-12) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Resample a control polygon into evenly spaced 3D points (xz spline, monotone y).
export function pathPoints(points, spacing = 0.2, flatEnds = true) {
  const n = points.length;
  const xz = points.map((p) => new THREE.Vector3(p[0], 0, p[2]));
  const curve = n === 2 ? new THREE.LineCurve3(xz[0], xz[1]) : new THREE.CatmullRomCurve3(xz, false, 'centripetal');
  const perSeg = 60;
  const M = perSeg * (n - 1);
  const dense = [];
  const arc = [0];
  for (let k = 0; k <= M; k++) {
    const p = curve.getPoint(k / M);
    dense.push(p);
    if (k > 0) arc.push(arc[k - 1] + p.distanceTo(dense[k - 1]));
  }
  const knots = points.map((_, i) => arc[i * perSeg]);
  const fy = monotoneCubic(knots, points.map((p) => p[1]), flatEnds);
  const total = arc[M];
  const count = Math.max(2, Math.ceil(total / spacing));
  const out = [];
  let k = 0;
  for (let j = 0; j <= count; j++) {
    const s = (j / count) * total;
    while (k < M - 1 && arc[k + 1] < s) k++;
    const seg = arc[k + 1] - arc[k];
    const t = seg > 1e-9 ? (s - arc[k]) / seg : 0;
    const p = dense[k].clone().lerp(dense[k + 1], THREE.MathUtils.clamp(t, 0, 1));
    p.y = fy(s);
    out.push(p);
  }
  return out;
}

function flipWinding(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
}

function extractByNormal(ni, pred) {
  const pos = ni.attributes.position, uv = ni.attributes.uv;
  const p = [], u = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (!pred(n)) continue;
    for (let k = 0; k < 3; k++) { p.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)); u.push(uv.getX(i + k), uv.getY(i + k)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.computeVertexNormals();
  return g;
}

// Horizontal polygon geometry, subdivided on a grid for vertex waves
export function polyGeometry(poly, y, cell = 0.5) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  let g = new THREE.ShapeGeometry(shape, 8);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  if (cell > 0) g = subdivideFlat(g, cell);
  return g;
}

// Subdivide triangles (midpoint split) until edges are shorter than maxLen
function subdivideFlat(g, maxLen) {
  let tris = [];
  const ni = g.index ? g.toNonIndexed() : g;
  const p = ni.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    tris.push([new THREE.Vector3().fromBufferAttribute(p, i), new THREE.Vector3().fromBufferAttribute(p, i + 1), new THREE.Vector3().fromBufferAttribute(p, i + 2)]);
  }
  for (let iter = 0; iter < 6; iter++) {
    const out = [];
    let changed = false;
    for (const [a, b, c] of tris) {
      const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a);
      const m = Math.max(ab, bc, ca);
      if (m <= maxLen) { out.push([a, b, c]); continue; }
      changed = true;
      // split longest edge
      if (m === ab) { const mid = a.clone().lerp(b, 0.5); out.push([a, mid, c], [mid, b, c]); }
      else if (m === bc) { const mid = b.clone().lerp(c, 0.5); out.push([a, b, mid], [a, mid, c]); }
      else { const mid = c.clone().lerp(a, 0.5); out.push([a, b, mid], [mid, b, c]); }
    }
    tris = out;
    if (!changed || tris.length > 20000) break;
  }
  const pos = new Float32Array(tris.length * 9);
  const uv = new Float32Array(tris.length * 6);
  tris.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      pos[i * 9 + k * 3] = t[k].x; pos[i * 9 + k * 3 + 1] = t[k].y; pos[i * 9 + k * 3 + 2] = t[k].z;
      uv[i * 6 + k * 2] = t[k].x; uv[i * 6 + k * 2 + 1] = -t[k].z;
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeVertexNormals();
  return out;
}
