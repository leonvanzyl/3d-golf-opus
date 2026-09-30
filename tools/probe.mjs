// Probe specific shots on a hole: node tools/probe.mjs <hole#> <yawDeg> <speed1,speed2,...> [x,y,z] [wait]
const stub = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'width' || k === 'height' ? 256 : stub),
  apply: () => stub, set: () => true, construct: () => stub,
});
globalThis.document = { createElement: () => stub, addEventListener() {}, hidden: false };
globalThis.window = globalThis;
console.warn = () => {};
const THREE = await import('three');
const { Builder } = await import('../src/course/Builder.js');
const { FIXED_DT, BALL_RADIUS } = await import('../src/physics/Physics.js');
const { HOLES } = await import('../src/holes/index.js');

const [hn, yawDeg, speedsArg, posArg, waitArg] = process.argv.slice(2);
const b = new Builder({ visual: false });
HOLES[+hn - 1].build(b);
b.finalize();
const w = b.world;
const start = posArg ? new THREE.Vector3(...posArg.split(',').map(Number)) : b.tee.pos.clone().add(new THREE.Vector3(0, BALL_RADIUS, 0));
const yaw = (+yawDeg * Math.PI) / 180;
for (const sp of speedsArg.split(',').map(Number)) {
  w.setTime(10 + (+waitArg || 0));
  w.placeBall(start);
  w.events.length = 0;
  w.shoot(Math.sin(yaw), -Math.cos(yaw), sp);
  let t = 0, stopT = 0, ev = [], res = 'timeout';
  while (t < 30) {
    w.step(FIXED_DT); t += FIXED_DT;
    for (const e of w.events) if (['holed', 'hazard', 'portal'].includes(e.type)) ev.push(e.type + (e.kind ? ':' + e.kind : '') + '@' + t.toFixed(2));
    w.events.length = 0;
    if (ev.some((e) => e.startsWith('holed') || e.startsWith('hazard'))) { res = ev[ev.length - 1]; break; }
    const b2 = w.ball;
    if (b2.vel.length() < 0.06 && (b2.grounded || b2.resting)) stopT += FIXED_DT; else stopT = 0;
    if (stopT > 0.35) { res = 'stopped'; break; }
  }
  console.log(`speed ${sp}: ${res} at ${w.ball.pos.toArray().map((v) => v.toFixed(2)).join(',')}  events=${ev.join(' ')}  t=${t.toFixed(1)}`);
}
