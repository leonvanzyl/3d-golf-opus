// Custom ball physics for mini golf.
//
// The ball is a sphere simulated with small fixed sub-steps (1/480 s). Every
// sub-step moves the ball less than its radius, so it can never tunnel through
// walls or floors. Static geometry is stored as triangles in a uniform grid;
// moving obstacles are analytic shapes (boxes, cylinders, spheres, capsules)
// driven by an update(t) function so they stay in lock-step with the visuals.

import * as THREE from 'three';

export const BALL_RADIUS = 0.07;
export const GRAVITY = 9.81;
export const FIXED_DT = 1 / 480;
const R = BALL_RADIUS;

// Surface presets. kind 'floor' surfaces always apply rolling friction (even
// upside-down in a loop); any contact whose normal points upward is treated as
// ground as well.
export const Surfaces = {
  grass: { kind: 'floor', roll: 0.075, drag: 0.22, bounce: 0.3, restitution: 0.4, friction: 0.2, sound: 'soft' },
  felt: { kind: 'floor', roll: 0.075, drag: 0.22, bounce: 0.3, restitution: 0.4, friction: 0.2, sound: 'soft' },
  wood: { kind: 'floor', roll: 0.08, drag: 0.22, bounce: 0.35, restitution: 0.5, friction: 0.2, sound: 'wood' },
  stone: { kind: 'floor', roll: 0.08, drag: 0.2, bounce: 0.4, restitution: 0.55, friction: 0.2, sound: 'stone' },
  metal: { kind: 'floor', roll: 0.06, drag: 0.16, bounce: 0.4, restitution: 0.55, friction: 0.15, sound: 'metal' },
  ice: { kind: 'floor', roll: 0.014, drag: 0.035, bounce: 0.25, restitution: 0.5, friction: 0.05, sound: 'ice' },
  snow: { kind: 'floor', roll: 0.16, drag: 0.6, bounce: 0.1, restitution: 0.2, friction: 0.3, sound: 'soft' },
  sand: { kind: 'floor', roll: 0.45, drag: 1.6, bounce: 0.05, restitution: 0.1, friction: 0.5, sound: 'sand' },
  track: { kind: 'floor', roll: 0.05, drag: 0.1, bounce: 0.2, restitution: 0.4, friction: 0.1, sound: 'metal' },
  wall: { kind: 'wall', roll: 0.09, drag: 0.3, bounce: 0.3, restitution: 0.72, friction: 0.14, sound: 'wall' },
  woodWall: { kind: 'wall', roll: 0.09, drag: 0.3, bounce: 0.3, restitution: 0.68, friction: 0.14, sound: 'wood' },
  stoneWall: { kind: 'wall', roll: 0.09, drag: 0.3, bounce: 0.3, restitution: 0.62, friction: 0.16, sound: 'stone' },
  metalWall: { kind: 'wall', roll: 0.09, drag: 0.3, bounce: 0.3, restitution: 0.7, friction: 0.12, sound: 'metal' },
  softWall: { kind: 'wall', roll: 0.09, drag: 0.3, bounce: 0.2, restitution: 0.45, friction: 0.25, sound: 'soft' },
  rubber: { kind: 'wall', roll: 0.09, drag: 0.3, bounce: 0.6, restitution: 0.95, friction: 0.05, sound: 'bumper', kick: 2.4 },
  ob: { kind: 'floor', roll: 0.2, drag: 1, bounce: 0.1, restitution: 0.2, friction: 0.3, sound: 'soft', ob: true },
};

export function surface(base, overrides) {
  return Object.assign({}, typeof base === 'string' ? Surfaces[base] : base, overrides);
}

// ---------------------------------------------------------------------------
// Geometry helpers

const _cp = { x: 0, y: 0, z: 0 };

// Closest point on triangle (Ericson, Real-Time Collision Detection 5.1.5)
function closestPtTri(px, py, pz, t, o, out) {
  const ax = t[o], ay = t[o + 1], az = t[o + 2];
  const bx = t[o + 3], by = t[o + 4], bz = t[o + 5];
  const cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out.x = ax; out.y = ay; out.z = az; return; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out.x = bx; out.y = by; out.z = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out.x = ax + v * abx; out.y = ay + v * aby; out.z = az + v * abz; return;
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out.x = cx; out.y = cy; out.z = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out.x = ax + w * acx; out.y = ay + w * acy; out.z = az + w * acz; return;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    out.x = bx + w * (cx - bx); out.y = by + w * (cy - by); out.z = bz + w * (cz - bz); return;
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  out.x = ax + abx * v + acx * w;
  out.y = ay + aby * v + acy * w;
  out.z = az + abz * v + acz * w;
}

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Static triangle soup with a uniform grid broad-phase

const CELL = 1.0;
function cellKey(ix, iz) { return (ix + 32768) * 65536 + (iz + 32768); }

class TriangleGrid {
  constructor() {
    this.count = 0;
    this.cap = 4096;
    this.verts = new Float64Array(this.cap * 9);
    this.boxes = new Float64Array(this.cap * 6);
    this.mats = [];
    this.cells = new Map();
    this.stamp = new Uint32Array(this.cap);
    this.query = 1;
  }

  grow() {
    this.cap *= 2;
    const v = new Float64Array(this.cap * 9); v.set(this.verts); this.verts = v;
    const b = new Float64Array(this.cap * 6); b.set(this.boxes); this.boxes = b;
    const s = new Uint32Array(this.cap); s.set(this.stamp); this.stamp = s;
  }

  add(ax, ay, az, bx, by, bz, cx, cy, cz, mat) {
    // skip degenerate triangles
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-14) return;
    if (this.count >= this.cap) this.grow();
    const i = this.count++;
    const o = i * 9;
    const v = this.verts;
    v[o] = ax; v[o + 1] = ay; v[o + 2] = az;
    v[o + 3] = bx; v[o + 4] = by; v[o + 5] = bz;
    v[o + 6] = cx; v[o + 7] = cy; v[o + 8] = cz;
    const b = this.boxes, q = i * 6;
    b[q] = Math.min(ax, bx, cx); b[q + 1] = Math.min(ay, by, cy); b[q + 2] = Math.min(az, bz, cz);
    b[q + 3] = Math.max(ax, bx, cx); b[q + 4] = Math.max(ay, by, cy); b[q + 5] = Math.max(az, bz, cz);
    this.mats[i] = mat;
    const ix0 = Math.floor(b[q] / CELL), ix1 = Math.floor(b[q + 3] / CELL);
    const iz0 = Math.floor(b[q + 2] / CELL), iz1 = Math.floor(b[q + 5] / CELL);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = cellKey(ix, iz);
        let arr = this.cells.get(k);
        if (!arr) { arr = []; this.cells.set(k, arr); }
        arr.push(i);
      }
    }
  }

  // Calls fn(index) for each triangle whose AABB overlaps the sphere AABB
  forEachNear(x, y, z, r, fn) {
    const q = ++this.query;
    const ix0 = Math.floor((x - r) / CELL), ix1 = Math.floor((x + r) / CELL);
    const iz0 = Math.floor((z - r) / CELL), iz1 = Math.floor((z + r) / CELL);
    const b = this.boxes;
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const arr = this.cells.get(cellKey(ix, iz));
        if (!arr) continue;
        for (let n = 0; n < arr.length; n++) {
          const i = arr[n];
          if (this.stamp[i] === q) continue;
          this.stamp[i] = q;
          const o = i * 6;
          if (x + r < b[o] || x - r > b[o + 3] || y + r < b[o + 1] || y - r > b[o + 4] || z + r < b[o + 2] || z - r > b[o + 5]) continue;
          fn(i);
        }
      }
    }
  }

  // Ray cast straight down, returns highest surface y below (x, y, z) or -Infinity
  heightBelow(x, y, z, skipOB = false) {
    let best = -Infinity;
    const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL);
    const arr = this.cells.get(cellKey(ix, iz));
    if (!arr) return best;
    const v = this.verts;
    for (let n = 0; n < arr.length; n++) {
      if (skipOB && this.mats[arr[n]].ob) continue;
      const o = arr[n] * 9;
      const ax = v[o], az = v[o + 2], bx = v[o + 3], bz = v[o + 5], cx = v[o + 6], cz = v[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const hy = l1 * v[o + 1] + l2 * v[o + 4] + l3 * v[o + 7];
      if (hy <= y + 1e-4 && hy > best) best = hy;
    }
    return best;
  }
}

// ---------------------------------------------------------------------------
// Moving / analytic bodies

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class Body {
  // shapes: [{ type: 'box', size: [x,y,z] } | { type: 'cyl', r, h } | { type: 'sphere', r } | { type: 'capsule', r, h }]
  // each shape may have: position [x,y,z], rotation [x,y,z] (euler), material
  constructor({ shapes, material = Surfaces.wall, update = null, name = '', onHit = null, enabled = true }) {
    this.name = name;
    this.material = material;
    this.update = update;
    this.onHit = onHit;
    this.enabled = enabled;
    this.matrix = new THREE.Matrix4();
    this.prevMatrix = new THREE.Matrix4();
    this.shapes = shapes.map((s) => {
      const off = new THREE.Matrix4();
      const pos = s.position ? new THREE.Vector3(...s.position) : new THREE.Vector3();
      const rot = s.rotation ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.rotation)) : new THREE.Quaternion();
      off.compose(pos, rot, new THREE.Vector3(1, 1, 1));
      const shape = {
        type: s.type,
        offset: off,
        world: new THREE.Matrix4(),
        inv: new THREE.Matrix4(),
        prevWorld: new THREE.Matrix4(),
        material: s.material || null,
        bound: 0,
      };
      if (s.type === 'box') { shape.hx = s.size[0] / 2; shape.hy = s.size[1] / 2; shape.hz = s.size[2] / 2; shape.bound = Math.hypot(shape.hx, shape.hy, shape.hz); }
      else if (s.type === 'cyl') { shape.r = s.r; shape.hh = s.h / 2; shape.bound = Math.hypot(s.r, s.h / 2); }
      else if (s.type === 'sphere') { shape.r = s.r; shape.bound = s.r; }
      else if (s.type === 'capsule') { shape.r = s.r; shape.hh = s.h / 2; shape.bound = s.r + s.h / 2; }
      return shape;
    });
    if (update) update(0, this.matrix);
    this.refresh(true);
  }

  setMatrix(m) { this.matrix.copy(m); this.refresh(true); }

  refresh(resetPrev) {
    for (const s of this.shapes) {
      if (resetPrev) s.prevWorld.multiplyMatrices(this.matrix, s.offset);
      else s.prevWorld.copy(s.world);
      s.world.multiplyMatrices(this.matrix, s.offset);
      s.inv.copy(s.world).invert();
      s.cx = s.world.elements[12]; s.cy = s.world.elements[13]; s.cz = s.world.elements[14];
    }
  }

  step(t) {
    if (!this.update) return;
    this.prevMatrix.copy(this.matrix);
    this.update(t, this.matrix);
    this.refresh(false);
  }
}

// ---------------------------------------------------------------------------

const _local = new THREE.Vector3();
const _q = new THREE.Vector3();
const _n = new THREE.Vector3();
const _prevP = new THREE.Vector3();

export class PhysicsWorld {
  constructor() {
    this.tris = new TriangleGrid();
    this.bodies = [];
    this.zones = [];
    this.cup = null;
    this.killY = -20;
    this.time = 0;
    this.gravity = GRAVITY;
    this.events = [];
    this.ball = {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      active: false, // simulate the ball?
      grounded: false,
      rolling: false,
      groundNormal: new THREE.Vector3(0, 1, 0),
      groundMat: null,
      groundVel: new THREE.Vector3(),
      resting: false,
      inCup: false,
      lipState: false,
      portalCooldown: 0,
    };
    this._contact = { nx: 0, ny: 0, nz: 0 };
    this._accum = 0;
  }

  // ---- building -----------------------------------------------------------

  addTriangle(a, b, c, mat) {
    this.tris.add(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, mat);
  }

  // Add every triangle of a BufferGeometry (optionally transformed).
  // filter(nx, ny, nz) may reject triangles (e.g. bottom faces).
  addGeometry(geometry, mat, matrix = null, filter = null) {
    const pos = geometry.attributes.position;
    const idx = geometry.index;
    const n = idx ? idx.count : pos.count;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
      if (matrix) { a.applyMatrix4(matrix); b.applyMatrix4(matrix); c.applyMatrix4(matrix); }
      if (filter) {
        e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
        const l = e1.length();
        if (l < 1e-12) continue;
        e1.divideScalar(l);
        if (!filter(e1.x, e1.y, e1.z, a, b, c)) continue;
      }
      this.tris.add(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, mat);
    }
  }

  addBody(body) { this.bodies.push(body); return body; }
  addZone(zone) { this.zones.push(zone); return zone; }
  setCup(x, y, z, r) { this.cup = { x, y, z, r }; }

  heightAt(x, z, fromY = 100, skipOB = false) { return this.tris.heightBelow(x, fromY, z, skipOB); }

  // ---- simulation -----------------------------------------------------------

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  placeBall(p) {
    const b = this.ball;
    b.pos.copy(p);
    b.vel.set(0, 0, 0);
    b.active = true;
    b.inCup = false;
    b.resting = true;
    b.lipState = false;
    b.portalCooldown = 0;
    b.grounded = true;
    b.rolling = true;
    b.groundNormal.set(0, 1, 0);
  }

  // Advance world time (and simulate the ball if active) by dt using fixed sub-steps.
  update(dt) {
    this._accum += Math.min(dt, 0.1);
    let steps = 0;
    while (this._accum >= FIXED_DT && steps < 60) {
      this._accum -= FIXED_DT;
      this.step(FIXED_DT);
      steps++;
    }
  }

  stepBodies(t) {
    for (let i = 0; i < this.bodies.length; i++) this.bodies[i].step(t);
  }

  // Jump the world clock (used by the solver); keeps body velocities consistent.
  setTime(t) {
    for (const b of this.bodies) { b.step(t - FIXED_DT); b.step(t); }
    for (const z of this.zones) z._inside = false;
    this.time = t;
    this._accum = 0;
  }

  step(dt) {
    this.time += dt;
    this.stepBodies(this.time);
    const b = this.ball;
    if (!b.active) return;
    if (b.portalCooldown > 0) b.portalCooldown -= dt;

    const g = this.gravity;
    const v = b.vel, p = b.pos;

    // gravity (rolling balls accelerate at 5/7 of the slope component)
    v.y -= g * dt;
    if (b.rolling) {
      const n = b.groundNormal;
      const k = (2 / 7) * g * n.y * dt; // (2/7) * g_t * dt, g_t = g*ny*n + (0,-g,0)
      v.x -= k * n.x;
      v.y -= k * n.y - (2 / 7) * g * dt;
      v.z -= k * n.z;
    }
    // light air drag
    if (!b.grounded) v.multiplyScalar(1 - 0.03 * dt);
    const sp = v.length();
    if (sp > 24) v.multiplyScalar(24 / sp);

    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;

    // --- contacts
    let rolling = false, grounded = false;
    let gnx = 0, gny = 0, gnz = 0, gcount = 0;
    let rollMat = null;
    const gvel = b.groundVel.set(0, 0, 0);
    let touchedOB = false;

    for (let iter = 0; iter < 2; iter++) {
      // static triangles
      const tris = this.tris;
      const verts = tris.verts;
      tris.forEachNear(p.x, p.y, p.z, R + 0.01, (i) => {
        closestPtTri(p.x, p.y, p.z, verts, i * 9, _cp);
        const dx = p.x - _cp.x, dy = p.y - _cp.y, dz = p.z - _cp.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R || d2 < 1e-16) return;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d, nz = dz / d;
        const mat = tris.mats[i];
        const sv = mat.surfaceVel;
        const res = this._resolve(nx, ny, nz, R - d, mat, sv ? sv.x : 0, sv ? sv.y : 0, sv ? sv.z : 0, iter, null);
        if (res) {
          if (mat.ob) touchedOB = true;
          if (res === 2) {
            rolling = true; rollMat = mat;
            if (ny > 0.55) { grounded = true; }
            gnx += nx; gny += ny; gnz += nz; gcount++;
            if (sv) gvel.copy(sv);
          }
        }
      });

      // bodies
      for (let bi = 0; bi < this.bodies.length; bi++) {
        const body = this.bodies[bi];
        if (!body.enabled) continue;
        for (let si = 0; si < body.shapes.length; si++) {
          const s = body.shapes[si];
          const dxc = p.x - s.cx, dyc = p.y - s.cy, dzc = p.z - s.cz;
          const lim = s.bound + R;
          if (dxc * dxc + dyc * dyc + dzc * dzc > lim * lim) continue;
          _local.copy(p).applyMatrix4(s.inv);
          let inside = false;
          if (s.type === 'box') {
            _q.set(
              Math.max(-s.hx, Math.min(s.hx, _local.x)),
              Math.max(-s.hy, Math.min(s.hy, _local.y)),
              Math.max(-s.hz, Math.min(s.hz, _local.z)),
            );
            if (_q.equals(_local)) {
              inside = true;
              // push out along the axis with least penetration
              const px = s.hx - Math.abs(_local.x), py = s.hy - Math.abs(_local.y), pz = s.hz - Math.abs(_local.z);
              if (px <= py && px <= pz) _q.x = Math.sign(_local.x || 1) * s.hx;
              else if (py <= pz) _q.y = Math.sign(_local.y || 1) * s.hy;
              else _q.z = Math.sign(_local.z || 1) * s.hz;
            }
          } else if (s.type === 'cyl') {
            const rd = Math.hypot(_local.x, _local.z);
            const cy = Math.max(-s.hh, Math.min(s.hh, _local.y));
            if (rd <= s.r && Math.abs(_local.y) <= s.hh) {
              inside = true;
              if (s.r - rd < s.hh - Math.abs(_local.y)) {
                const k = rd > 1e-9 ? s.r / rd : 0;
                _q.set(rd > 1e-9 ? _local.x * k : s.r, _local.y, _local.z * k);
              } else {
                _q.set(_local.x, Math.sign(_local.y || 1) * s.hh, _local.z);
              }
            } else {
              const k = rd > s.r ? s.r / rd : 1;
              _q.set(_local.x * k, cy, _local.z * k);
            }
          } else if (s.type === 'sphere') {
            const l = _local.length();
            if (l < 1e-9) _q.set(0, s.r, 0);
            else _q.copy(_local).multiplyScalar(s.r / l);
            if (l < s.r) inside = true;
          } else if (s.type === 'capsule') {
            const cy = Math.max(-s.hh, Math.min(s.hh, _local.y));
            _n.set(_local.x, _local.y - cy, _local.z);
            const l = _n.length();
            if (l < 1e-9) _n.set(1, 0, 0); else _n.divideScalar(l);
            _q.set(_n.x * s.r, cy + _n.y * s.r, _n.z * s.r);
            if (l < s.r) inside = true;
          }
          // world-space closest point and normal
          _v.copy(_q).applyMatrix4(s.world);
          _n.subVectors(p, _v);
          let d = _n.length();
          if (inside) {
            // normal must point from the inside toward the surface
            _n.negate();
            if (d < 1e-9) continue;
            _n.divideScalar(d);
            d = -d;
          } else {
            if (d >= R || d < 1e-9) continue;
            _n.divideScalar(d);
          }
          // velocity of the body at the contact point
          _w.copy(_q).applyMatrix4(s.prevWorld);
          const vx = (_v.x - _w.x) / dt, vy = (_v.y - _w.y) / dt, vz = (_v.z - _w.z) / dt;
          const mat = s.material || body.material;
          const res = this._resolve(_n.x, _n.y, _n.z, R - d, mat, vx, vy, vz, iter, body);
          if (res === 2) {
            rolling = true; rollMat = mat;
            if (_n.y > 0.55) grounded = true;
            gnx += _n.x; gny += _n.y; gnz += _n.z; gcount++;
            gvel.set(vx, vy, vz);
          }
        }
      }
    }

    b.grounded = grounded;
    b.rolling = rolling;
    if (gcount > 0) {
      b.groundNormal.set(gnx, gny, gnz).normalize();
      b.groundMat = rollMat;
    } else {
      b.groundNormal.set(0, 1, 0);
    }

    // --- rolling friction (relative to the surface)
    b.resting = false;
    if (rolling && rollMat) {
      const n = b.groundNormal;
      let rvx = v.x - gvel.x, rvy = v.y - gvel.y, rvz = v.z - gvel.z;
      const rvn = rvx * n.x + rvy * n.y + rvz * n.z;
      let tx = rvx - rvn * n.x, ty = rvy - rvn * n.y, tz = rvz - rvn * n.z;
      const ts = Math.sqrt(tx * tx + ty * ty + tz * tz);
      const decel = rollMat.roll * g + rollMat.drag * ts;
      const ns = Math.max(0, ts - decel * dt);
      const k = ts > 1e-9 ? ns / ts : 0;
      tx *= k; ty *= k; tz *= k;
      // slope pull on the ball
      const gt = g * Math.sqrt(Math.max(0, 1 - n.y * n.y)) * (5 / 7);
      if (ns < 0.03 && n.y > 0.55 && gt < rollMat.roll * g * 1.02) {
        tx = 0; ty = 0; tz = 0;
        b.resting = true;
      }
      const keepN = Math.max(0, rvn); // keep separating velocity
      v.set(gvel.x + tx + keepN * n.x, gvel.y + ty + keepN * n.y, gvel.z + tz + keepN * n.z);
    }

    // conveyor-style zones and hazards
    for (let zi = 0; zi < this.zones.length; zi++) {
      const z = this.zones[zi];
      if (z.enabled === false) continue;
      if (!z.test(p, b)) continue;
      if (z.type === 'hazard') {
        b.active = false;
        this.emit('hazard', { kind: z.kind, pos: p.clone() });
        return;
      } else if (z.type === 'portal') {
        if (b.portalCooldown <= 0) {
          const speed = Math.max(z.minSpeed || 1.5, Math.hypot(v.x, v.z));
          p.copy(z.to);
          v.copy(z.dir).multiplyScalar(speed);
          b.portalCooldown = 0.6;
          this.emit('portal', { zone: z });
        }
      } else if (z.type === 'force') {
        z.apply(v, dt, b);
      } else if (z.type === 'trigger') {
        if (!z._inside) { z._inside = true; if (z.onEnter) z.onEnter(b); this.emit('trigger', { zone: z }); }
      }
    }
    for (let zi = 0; zi < this.zones.length; zi++) {
      const z = this.zones[zi];
      if (z.type === 'trigger' && z._inside && !z.test(p, b)) z._inside = false;
    }

    if (touchedOB) {
      b.active = false;
      this.emit('hazard', { kind: 'ob', pos: p.clone() });
      return;
    }
    if (p.y < this.killY) {
      b.active = false;
      this.emit('hazard', { kind: 'ob', pos: p.clone() });
      return;
    }

    // cup: fast balls skip across the hole ("lip out"), slow ones drop in
    const c = this.cup;
    if (c && !b.inCup) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < c.r * c.r) {
        if (!b.lipState && p.y > c.y + R * 0.5 && p.y < c.y + R * 1.6) {
          b.lipState = true;
          const hs = Math.hypot(v.x, v.z);
          if (hs > 0.05) {
            const ux = v.x / hs, uz = v.z / hs;
            const cross = dx * uz - dz * ux;
            const off = Math.abs(cross);
            const chord = 2 * Math.sqrt(Math.max(0, c.r * c.r - off * off));
            const vmax = Math.max(0.45, chord * 7.2);
            if (hs > vmax) {
              const ns = hs * 0.88;
              const tFly = (chord / ns) * 1.35;
              // deflect away from the centre, more for glancing hits
              const a = 0.35 * (off / c.r) + 0.04;
              const ca = Math.cos(a), sa = Math.sin(a);
              const r1x = ux * ca - uz * sa, r1z = ux * sa + uz * ca;
              const r2x = ux * ca + uz * sa, r2z = -ux * sa + uz * ca;
              const toCx = -dx, toCz = -dz;
              const pick1 = r1x * toCx + r1z * toCz < r2x * toCx + r2z * toCz;
              v.x = (pick1 ? r1x : r2x) * ns;
              v.z = (pick1 ? r1z : r2z) * ns;
              v.y = Math.max(v.y, 0.5 * g * tFly);
              this.emit('lip', { speed: hs });
            }
          }
        }
        if (p.y < c.y - R * 0.6) {
          b.inCup = true;
          this.emit('holed', {});
        }
      } else if (d2 > (c.r + R) * (c.r + R)) {
        b.lipState = false;
      }
    }
  }

  // Resolve a single contact. Returns 0 if ignored, 1 for wall contact, 2 for rolling contact.
  _resolve(nx, ny, nz, depth, mat, svx, svy, svz, iter, body) {
    const b = this.ball;
    const p = b.pos, v = b.vel;
    // positional correction
    p.x += nx * depth; p.y += ny * depth; p.z += nz * depth;
    const isRoll = mat.kind === 'floor' || ny > 0.55;
    // relative velocity
    const rvx = v.x - svx, rvy = v.y - svy, rvz = v.z - svz;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn < 0) {
      const impact = -vn;
      let e;
      if (isRoll) e = impact > 1.1 ? mat.bounce : 0;
      else e = impact > 0.08 ? mat.restitution : 0;
      // tangential part
      let tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz;
      if (!isRoll) {
        const ts = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (ts > 1e-9) {
          const loss = Math.min(ts, mat.friction * (1 + e) * impact);
          const k = (ts - loss) / ts;
          tx *= k; ty *= k; tz *= k;
        }
      }
      let out = e * impact;
      if (mat.kick && impact > 0.15 && iter === 0) out += mat.kick;
      v.x = svx + tx + nx * out;
      v.y = svy + ty + ny * out;
      v.z = svz + tz + nz * out;
      if (iter === 0) {
        if (!isRoll && impact > 0.2) {
          this.emit('hit', { speed: impact, sound: mat.sound, body, kick: !!mat.kick, pos: p.clone() });
          if (body && body.onHit) body.onHit(impact);
        } else if (isRoll && impact > 1.1) {
          this.emit('land', { speed: impact, sound: mat.sound, pos: p.clone() });
        }
      }
    }
    return isRoll ? 2 : 1;
  }

  // ---- helpers for game logic -------------------------------------------------

  shoot(dirX, dirZ, speed) {
    const b = this.ball;
    b.vel.set(dirX * speed, 0, dirZ * speed);
    // project onto the ground plane so shots on slopes follow the surface
    const n = b.groundNormal;
    const vn = b.vel.dot(n);
    b.vel.addScaledVector(n, -vn);
    b.vel.setLength(speed);
    b.active = true;
    b.resting = false;
  }
}

// ---------------------------------------------------------------------------
// Zone factories

export function hazardZone(kind, poly, surfaceY) {
  return {
    type: 'hazard', kind,
    test: (p) => p.y < surfaceY && pointInPolygon(p.x, p.z, poly),
  };
}

export function boxZone(type, min, max, extra = {}) {
  return Object.assign({
    type,
    test: (p) => p.x > min[0] && p.x < max[0] && p.y > min[1] && p.y < max[1] && p.z > min[2] && p.z < max[2],
  }, extra);
}

export function portalZone(from, radius, to, dir, extra = {}) {
  const f = new THREE.Vector3(...from);
  return Object.assign({
    type: 'portal',
    from: f,
    radius,
    to: new THREE.Vector3(...to),
    dir: new THREE.Vector3(...dir).normalize(),
    test: (p) => p.distanceToSquared(f) < radius * radius,
  }, extra);
}
