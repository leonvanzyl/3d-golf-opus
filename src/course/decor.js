// Shared scenery helpers: ground, scattering, grass, critter registration.
import * as THREE from 'three';
import { terrain, grassField, flowerField, rng, mountains } from './props.js';
import { Surfaces } from '../physics/Physics.js';

// Register an object whose userData.update(t, dt) should run every frame
export function live(b, obj, opts = {}) {
  b.add(obj, { outline: opts.outline ?? true, shadow: opts.shadow ?? true });
  const objs = [];
  obj.traverse((o) => { if (o.userData.update) objs.push(o); });
  if (objs.length) b.animate((dt, t) => { for (const o of objs) o.userData.update(t, dt); });
  return obj;
}

// Returns (x, z) => true when (x, z) is on or close to playable geometry
export function courseMask(b, margin = 0.5, floorY = -50) {
  const offs = [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin], [margin * 0.7, margin * 0.7], [-margin * 0.7, -margin * 0.7], [margin * 0.7, -margin * 0.7], [-margin * 0.7, margin * 0.7]];
  return (x, z) => {
    for (const [dx, dz] of offs) {
      if (b.world.heightAt(x + dx, z + dz, 50, true) > floorY) return true;
    }
    return false;
  };
}

// Ground disc: visual terrain that is also an out-of-bounds surface.
// bumps: [{ x, z, r, h, plateau }] add smooth mounds (plateau = flat-top fraction).
export function ground(b, { y = -0.3, color = 0x67c24a, map = null, radius = 70, hills = 3, hillStart = 16, obY = null, seed = 1, bumps = [], center = [0, 0], visible = true } = {}) {
  const r = rng(seed);
  const p1 = r() * 10, p2 = r() * 10;
  const heightFn = (x, z) => {
    const d = Math.hypot(x - center[0], z - center[1]);
    const k = THREE.MathUtils.smoothstep(d, hillStart, hillStart + 20);
    let h = k * hills * (0.6 + 0.4 * Math.sin(x * 0.08 + p1) * Math.cos(z * 0.07 + p2)) + k * k * hills * 1.5;
    for (const bp of bumps) {
      const dd = Math.hypot(x - bp.x, z - bp.z);
      h += bp.h * (1 - THREE.MathUtils.smoothstep(dd, bp.r * (bp.plateau ?? 0.5), bp.r));
    }
    return h;
  };
  const t = terrain({ radius, y: y - 0.005, color, map, heightFn: (lx, lz) => heightFn(lx + center[0], lz + center[1]), segments: 72, rings: 26 });
  t.position.set(center[0], 0, center[1]);
  t.updateMatrix();
  // world-space uvs for the texture
  const p = t.geometry.attributes.position, uv = t.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + center[0], -(p.getZ(i) + center[1]));
  b.world.addGeometry(t.geometry, Surfaces.ob, t.matrix);
  b.outOfBounds((obY ?? y) - 0.6);
  b.terrainHeight = (x, z) => y + heightFn(x, z);
  if (!b.visual || !visible) return;
  b.group.add(t);
  b.disposables.push(t.geometry);
}

export function scatter(b, { count = 10, center = [0, 0], rMin = 5, rMax = 15, mask = null, make, seed = 1, y = null, heightFn = null, minDist = 0 } = {}) {
  if (!b.visual) return;
  const rand = rng(seed);
  const placed = [];
  for (let i = 0; i < count * 8 && placed.length < count; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rMin * rMin + rand() * (rMax * rMax - rMin * rMin));
    const x = center[0] + Math.cos(a) * rr, z = center[1] + Math.sin(a) * rr;
    if (mask && mask(x, z)) continue;
    if (minDist > 0 && placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < minDist * minDist)) continue;
    placed.push([x, z]);
    const obj = make(rand, x, z, placed.length - 1);
    if (!obj) continue;
    const gy = y ?? (heightFn ? heightFn(x, z) : b.terrainHeight ? b.terrainHeight(x, z) : 0);
    obj.position.set(x, gy, z);
    obj.rotation.y = rand() * Math.PI * 2;
    b.addStaticObject(obj);
  }
  return placed;
}

export function grass(b, { count = 5000, rMin = 0, rMax = 16, center = [0, 0], mask = null, base = 0x2f8f2a, tip = 0xa6e35a, height = 0.32, seed = 5, y = null } = {}) {
  if (!b.visual) return;
  const im = grassField({
    count, base, tip, height, seed,
    place: (rand) => {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rMin * rMin + rand() * (rMax * rMax - rMin * rMin));
      const x = center[0] + Math.cos(a) * rr, z = center[1] + Math.sin(a) * rr;
      if (mask && mask(x, z)) return null;
      const gy = y ?? (b.terrainHeight ? b.terrainHeight(x, z) : 0);
      return [x, gy - 0.02, z];
    },
  });
  b.group.add(im);
  b.disposables.push(im.geometry);
}

export function flowers(b, { count = 80, rMin = 1, rMax = 12, center = [0, 0], mask = null, colors, seed = 3, size = 1, y = null } = {}) {
  if (!b.visual) return;
  const f = flowerField({
    count, colors, seed, size,
    place: (rand) => {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rMin * rMin + rand() * (rMax * rMax - rMin * rMin));
      const x = center[0] + Math.cos(a) * rr, z = center[1] + Math.sin(a) * rr;
      if (mask && mask(x, z)) return null;
      const gy = y ?? (b.terrainHeight ? b.terrainHeight(x, z) : 0);
      return [x, gy, z];
    },
  });
  b.group.add(f);
}

export function horizon(b, opts) {
  if (!b.visual) return;
  const m = mountains(opts);
  b.addStaticObject(m, { outline: false, castShadow: false });
}
