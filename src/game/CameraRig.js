// Camera modes: first-person aim, chase during the shot, flyover, overview, orbit.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

function damp(k, dt) { return 1 - Math.exp(-k * dt); }

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'aim';
    this.pos = new THREE.Vector3(0, 2, 4);
    this.look = new THREE.Vector3();
    this.zoom = 1.6;
    this.followDir = new THREE.Vector3(0, 0, -1);
    this.fly = null;
    this.orbitCenter = new THREE.Vector3();
    this.orbitRadius = 12;
    this.orbitHeight = 8;
    this.orbitAngle = 0;
    this.overview = null;
    this.heightAt = null; // (x, z, fromY) => y
    this.snapNext = false;
    this.shake = 0;
  }

  forward(yaw) { return _v.set(Math.sin(yaw), 0, -Math.cos(yaw)); }

  aimPose(ball, yaw, outPos, outLook) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const z = this.zoom;
    const h = 0.32 + z * 0.46;
    outPos.copy(ball).addScaledVector(f, -z).addScaledVector(UP, h);
    outLook.copy(ball).addScaledVector(f, 2.4 + z * 0.3).addScaledVector(UP, 0.18);
    return [outPos, outLook];
  }

  startFlyover(path, ball, yaw, duration) {
    // camera travels backwards from the cup to the tee while facing down the course
    const pts = path.map((p) => p.clone());
    const curve = pts.length > 1 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : null;
    const endPos = new THREE.Vector3(), endLook = new THREE.Vector3();
    this.aimPose(ball, yaw, endPos, endLook);
    this.fly = { curve, t: 0, duration, endPos, endLook, length: curve ? curve.getLength() : 1 };
    this.mode = 'flyover';
  }

  update(dt, ctx) {
    const cam = this.camera;
    const { ball, yaw } = ctx;
    const desiredPos = new THREE.Vector3(), desiredLook = new THREE.Vector3();
    let kPos = 8, kLook = 10;

    if (this.mode === 'aim') {
      this.aimPose(ball, yaw, desiredPos, desiredLook);
      kPos = 14; kLook = 18;
    } else if (this.mode === 'follow') {
      const v = ctx.vel;
      const hv = new THREE.Vector3(v.x, 0, v.z);
      const sp = hv.length();
      if (sp > 0.25) {
        hv.normalize();
        this.followDir.lerp(hv, damp(sp > 2 ? 2.2 : 1.2, dt)).normalize();
      }
      const back = 2.6 + Math.min(1.6, sp * 0.18);
      if (ctx.hint) {
        desiredPos.copy(ctx.hint.pos);
        desiredLook.copy(ball);
        if (ctx.hint.look) desiredLook.lerp(ctx.hint.look, 0.5);
        kPos = 2.6; kLook = 6;
      } else {
        desiredPos.copy(ball).addScaledVector(this.followDir, -back).addScaledVector(UP, 1.5 + Math.min(1, sp * 0.1));
        desiredLook.copy(ball).addScaledVector(this.followDir, 0.8);
        kPos = 3.2; kLook = 7;
      }
    } else if (this.mode === 'flyover' && this.fly) {
      const f = this.fly;
      f.t = Math.min(1, f.t + dt / f.duration);
      const u = f.t;
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; // easeInOutCubic
      if (f.curve) {
        const L = f.length;
        const sCam = THREE.MathUtils.clamp(1 - e, 0, 1);
        const p = f.curve.getPointAt(sCam);
        const lookS = THREE.MathUtils.clamp(sCam + (3.5 / L), 0, 1);
        const lp = f.curve.getPointAt(lookS);
        const tan = f.curve.getTangentAt(sCam);
        const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
        const height = THREE.MathUtils.lerp(6.5, 2.5, e);
        const flyPos = p.clone().addScaledVector(side, (1 - e) * 3.0).addScaledVector(UP, height).addScaledVector(tan, -2.5);
        const flyLook = lp.clone();
        const blend = THREE.MathUtils.smoothstep(u, 0.72, 1.0);
        desiredPos.lerpVectors(flyPos, f.endPos, blend);
        desiredLook.lerpVectors(flyLook, f.endLook, blend);
      } else {
        desiredPos.copy(f.endPos); desiredLook.copy(f.endLook);
      }
      if (this.snapNext || f.t < 0.02) { this.pos.copy(desiredPos); this.look.copy(desiredLook); this.snapNext = false; }
      kPos = 30; kLook = 30;
    } else if (this.mode === 'overview' && this.overview) {
      desiredPos.copy(this.overview.pos);
      desiredLook.copy(this.overview.look);
      kPos = 4; kLook = 5;
    } else if (this.mode === 'orbit') {
      this.orbitAngle += dt * 0.12;
      desiredPos.set(
        this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius,
        this.orbitCenter.y + this.orbitHeight,
        this.orbitCenter.z + Math.sin(this.orbitAngle) * this.orbitRadius,
      );
      desiredLook.copy(this.orbitCenter);
      kPos = 2; kLook = 3;
    } else if (this.mode === 'cup') {
      // slow orbit around the cup for the celebration
      this.orbitAngle += dt * 0.35;
      const c = ctx.cup;
      desiredPos.set(c.x + Math.cos(this.orbitAngle) * 2.4, c.y + 1.3, c.z + Math.sin(this.orbitAngle) * 2.4);
      desiredLook.set(c.x, c.y + 0.1, c.z);
      kPos = 2.5; kLook = 4;
    }

    if (this.snapNext) {
      this.pos.copy(desiredPos); this.look.copy(desiredLook); this.snapNext = false;
    } else {
      this.pos.lerp(desiredPos, damp(kPos, dt));
      this.look.lerp(desiredLook, damp(kLook, dt));
    }

    // keep the camera above the ground it is flying over
    if (this.heightAt && this.mode !== 'flyover') {
      const gy = this.heightAt(this.pos.x, this.pos.z, this.pos.y + 3);
      if (gy > -1e6 && this.pos.y < gy + 0.35) this.pos.y = gy + 0.35;
    }

    cam.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.08;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.08;
    }
    cam.lookAt(this.look);
  }
}
