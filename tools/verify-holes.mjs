// Proves every hole can be completed using the real game physics.
// A beam search samples putt directions / powers (and waits for moving
// obstacles) from the tee until the ball drops into the cup.
//
//   node tools/verify-holes.mjs          (all holes)
//   node tools/verify-holes.mjs 3 5      (only holes 3 and 5, 1-based)

// ---- minimal DOM stubs so the (visual) hole code can run in Node ----------
const stub = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'width' || k === 'height' ? 256 : stub),
  apply: () => stub,
  set: () => true,
  construct: () => stub,
});
globalThis.document = { createElement: () => stub, addEventListener() {}, hidden: false };
globalThis.window = globalThis;
globalThis.console.warn = () => {};

const THREE = await import('three');
const { Builder } = await import('../src/course/Builder.js');
const { FIXED_DT, BALL_RADIUS } = await import('../src/physics/Physics.js');
const { HOLES } = await import('../src/holes/index.js');

const MAX_SPEED = 10.5;
const only = process.argv.slice(2).map((s) => parseInt(s, 10) - 1).filter((n) => !Number.isNaN(n));

function pathTools(path) {
  const arc = [0];
  for (let i = 1; i < path.length; i++) arc.push(arc[i - 1] + path[i].distanceTo(path[i - 1]));
  const L = arc[arc.length - 1];
  function project(p) {
    let best = Infinity, bestS = 0, bestLat = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const ab = b.clone().sub(a);
      const l2 = ab.lengthSq();
      let t = l2 > 0 ? p.clone().sub(a).dot(ab) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const q = a.clone().addScaledVector(ab, t);
      const dy = (p.y - q.y) * 2.5;
      const d = Math.hypot(p.x - q.x, p.z - q.z, dy);
      if (d < best) { best = d; bestS = arc[i] + Math.sqrt(l2) * t; bestLat = d; }
    }
    return { s: bestS, lat: bestLat };
  }
  function at(s) {
    if (s <= 0) return path[0].clone();
    for (let i = 0; i < path.length - 1; i++) if (s <= arc[i + 1]) return path[i].clone().lerp(path[i + 1], (s - arc[i]) / Math.max(1e-6, arc[i + 1] - arc[i]));
    return path[path.length - 1].clone();
  }
  return { L, project, at };
}

function simulate(world, start, yaw, speed, t0, maxT = 30) {
  world.setTime(t0);
  world.placeBall(start);
  world.events.length = 0;
  world.shoot(Math.sin(yaw), -Math.cos(yaw), speed);
  let t = 0, stopT = 0;
  const b = world.ball;
  while (t < maxT) {
    world.step(FIXED_DT);
    t += FIXED_DT;
    for (const e of world.events) {
      if (e.type === 'holed') return { holed: true, t };
      if (e.type === 'hazard') return { hazard: e.kind, t };
    }
    world.events.length = 0;
    const sp = b.vel.length();
    if (sp < 0.06 && (b.grounded || b.resting)) stopT += FIXED_DT; else stopT = 0;
    if (stopT > 0.35) {
      if (b.groundMat && b.groundMat.kind === 'wall') return { hazard: 'unplayable', t };
      return { pos: b.pos.clone(), t };
    }
  }
  return { pos: b.pos.clone(), t, timeout: true };
}

// Terrain (an out-of-bounds surface) must never poke through playable floors.
function checkTerrain(b) {
  if (!b.terrainHeight) return [];
  const t = b.world.tris;
  const bad = [];
  for (let i = 0; i < t.count; i++) {
    const m = t.mats[i];
    if (m.ob || m.kind !== 'floor') continue;
    const o = i * 9, v = t.verts;
    const x = (v[o] + v[o + 3] + v[o + 6]) / 3, y = (v[o + 1] + v[o + 4] + v[o + 7]) / 3, z = (v[o + 2] + v[o + 5] + v[o + 8]) / 3;
    if (b.terrainHeight(x, z) > y - 0.03) bad.push([x.toFixed(2), y.toFixed(2), z.toFixed(2)]);
  }
  return bad;
}

function solveHole(def, index) {
  const b = new Builder({ visual: false });
  def.build(b);
  b.finalize();
  const world = b.world;
  const bad = checkTerrain(b);
  if (bad.length) console.log(`  ⚠ terrain above ${bad.length} floor triangles, e.g. ${JSON.stringify(bad.slice(0, 4))}`);
  const cup = new THREE.Vector3(b.cupInfo.x, b.cupInfo.y, b.cupInfo.z);
  const path = b.path.length ? b.path : [b.tee.pos.clone(), cup.clone()];
  const P = pathTools(path);
  const dynamic = world.bodies.some((x) => x.update);
  const start = b.tee.pos.clone().add(new THREE.Vector3(0, BALL_RADIUS, 0));

  const score = (p) => {
    const { s, lat } = P.project(p);
    const dc = p.distanceTo(cup);
    let h = (P.L - s) + lat * 1.5;
    if (dc < 3 && Math.abs(p.y - BALL_RADIUS - cup.y) < 0.2) h = Math.min(h, dc);
    return h;
  };

  const speeds = [0.8, 1.2, 1.6, 2.0, 2.5, 3.0, 3.6, 4.3, 5.0, 5.8, 6.6, 7.5, 8.5, 9.5, 10.5];
  const phases = dynamic ? [0, 0.35, 0.7, 1.05, 1.4, 1.75, 2.1] : [0];
  let beam = [{ pos: start, strokes: 0, shots: [], h: score(start), t: 0 }];
  const t0 = performance.now();
  let sims = 0;
  for (let depth = 1; depth <= 9; depth++) {
    const candidates = [];
    for (const node of beam) {
      const { s } = P.project(node.pos);
      const tgt = P.at(s + 2.5);
      const dcup = node.pos.distanceTo(cup);
      const baseYaws = [Math.atan2(tgt.x - node.pos.x, -(tgt.z - node.pos.z))];
      if (dcup < 8) baseYaws.push(Math.atan2(cup.x - node.pos.x, -(cup.z - node.pos.z)));
      const yaws = new Set();
      for (const by of baseYaws) {
        for (let d = -80; d <= 80; d += (Math.abs(d) < 20 ? 2 : 5)) yaws.add(Math.round((by + (d * Math.PI) / 180) * 1000) / 1000);
      }
      for (const phase of phases) {
        for (const yaw of yaws) {
          for (const sp of speeds) {
            sims++;
            const r = simulate(world, node.pos, yaw, sp, 10 + node.t + phase);
            const shot = { yaw: +yaw.toFixed(3), speed: sp, wait: phase };
            if (r.holed) {
              return { ok: true, strokes: depth, shots: [...node.shots, shot], sims, ms: performance.now() - t0 };
            }
            if (r.hazard || r.timeout) continue;
            candidates.push({ pos: r.pos, strokes: depth, shots: [...node.shots, shot], h: score(r.pos), t: node.t + phase + r.t });
          }
        }
      }
    }
    candidates.sort((a, b2) => a.h - b2.h);
    // keep a diverse beam
    const next = [];
    for (const c of candidates) {
      if (next.every((n) => n.pos.distanceTo(c.pos) > 0.6)) next.push(c);
      if (next.length >= 4) break;
    }
    if (!next.length) return { ok: false, reason: 'no legal shots', sims };
    beam = next;
    process.stdout.write(`  hole ${index + 1} depth ${depth}: best h=${beam[0].h.toFixed(2)} at ${beam[0].pos.toArray().map((v) => v.toFixed(2)).join(',')}\n`);
  }
  return { ok: false, reason: 'not holed within 9 strokes', best: beam[0], sims, ms: performance.now() - t0 };
}

let allOk = true;
for (let i = 0; i < HOLES.length; i++) {
  if (only.length && !only.includes(i)) continue;
  const def = HOLES[i];
  console.log(`Hole ${i + 1}: ${def.name} (par ${def.par})`);
  const r = solveHole(def, i);
  if (r.ok) {
    console.log(`  ✔ holed in ${r.strokes} stroke(s)  [${r.sims} sims, ${(r.ms / 1000).toFixed(1)}s]  shots=${JSON.stringify(r.shots)}`);
  } else {
    allOk = false;
    console.log(`  ✘ FAILED: ${r.reason}`, r.best ? r.best.pos.toArray() : '');
  }
}
process.exit(allOk ? 0 : 1);
