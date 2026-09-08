import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARC_RADII, ARC_SPAN, SEAT_Y, YAW_FOR_THIRD, ARRIVAL, PULSE_TAIL, WAVE_MAX_T, WAVE_SPEED, BPS,
  PIVOT_REST, DIR_DEFAULT, DIR_REST,
  seats, movements, cue, thirdLit, thirdEmber, cameraRig, release, releaseRadius, cutoffLatch,
  wavefront, lock, pulse, amplitude, seatPulse, rebaseSeat, arrivalRate, batonPose,
  stageHit, beamWeight, BEAM_COS_OUTER, BEAM_COS_INNER, copyMask, newConductor,
} from "./choreography.ts";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: number[]) => Math.hypot(a[0], a[1], a[2]);

test("seating: counts, radii, sections, spacing, tuning", () => {
  for (const [low, total] of [[false, 126], [true, 84]] as const) {
    const s = seats(low);
    assert.equal(s.length, total);
    const byThird = [0, 0, 0];
    s.forEach((st, i) => {
      assert.equal(st.i, i);
      assert.ok(near(Math.hypot(st.x, st.z), ARC_RADII[st.arc], 1e-9), "on its arc");
      assert.ok(st.z < 0, "in front of the podium");
      assert.ok(st.section >= 0 && st.section <= 11);
      assert.ok(st.tuneHz >= 0.8 && st.tuneHz <= 1.5, `tuneHz ${st.tuneHz}`);
      assert.ok(Math.abs(st.angle) <= ARC_SPAN + 1e-9);
      byThird[st.third]++;
    });
    const spread = Math.max(...byThird) - Math.min(...byThird);
    assert.ok(spread <= 6, `thirds ${byThird}`);
    // neighbour spacing on each arc — the 126-seat layout only; low-power is
    // deliberately sparser (10 seats on a 7.5-unit arc space at ~0.84)
    if (low) continue;
    for (let i = 1; i < s.length; i++) {
      if (s[i].arc !== s[i - 1].arc) continue;
      const d = Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z);
      assert.ok(d >= 0.45 && d <= 0.65, `spacing ${d.toFixed(3)} on arc ${s[i].arc}`);
    }
  }
});

test("movements partition at 0.35 and 0.70, each monotone", () => {
  let prev = movements(0);
  for (let i = 1; i <= 1000; i++) {
    const m = movements(i / 1000);
    assert.ok(m.downbeat >= prev.downbeat && m.entries >= prev.entries && m.cutoff >= prev.cutoff);
    prev = m;
  }
  assert.equal(movements(0.35).downbeat, 1); assert.equal(movements(0.35).entries, 0);
  assert.equal(movements(0.7).entries, 1); assert.equal(movements(0.7).cutoff, 0);
  assert.equal(movements(1).cutoff, 1);
});

test("cue walks 0→3; thirds light in order; ember is exclusive", () => {
  assert.ok(near(cue(0.45), 1, 1e-9)); assert.ok(near(cue(0.55), 2, 1e-9)); assert.ok(near(cue(0.65), 3, 1e-9));
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000;
    const e = thirdEmber(p, 0) + thirdEmber(p, 1) + thirdEmber(p, 2);
    assert.ok(e <= 1 + 1e-9, `Σ ember ${e} at ${p}`);
    assert.ok(thirdLit(p, 0) >= thirdLit(p, 1) && thirdLit(p, 1) >= thirdLit(p, 2));
  }
  assert.equal(thirdEmber(0.9, 2), 0); assert.equal(thirdLit(0.9, 2), 1);
});

test("camera rig: continuous, correct yaws, never below eye height, arcs in fov after the lift", () => {
  let prev = cameraRig(0);
  for (let i = 1; i <= 1000; i++) {
    const r = cameraRig(i / 1000);
    assert.ok(Math.abs(r.y - prev.y) < 0.02 && Math.abs(r.z - prev.z) < 0.02, `Δpos at ${i / 1000}`);
    assert.ok(Math.abs(r.pitch - prev.pitch) < 0.01 && Math.abs(r.yaw - prev.yaw) < 0.01, `Δrot at ${i / 1000}`);
    assert.ok(r.y >= 1.55 - 1e-9);
    prev = r;
  }
  assert.ok(near(cameraRig(0.47).yaw, YAW_FOR_THIRD[0], 1e-6));
  assert.ok(near(cameraRig(0.67).yaw, YAW_FOR_THIRD[2], 1e-6));
  assert.ok(near(cameraRig(1).yaw, 0, 1e-9));
  const r = cameraRig(0.35);
  const half = (r.fov / 2) * (Math.PI / 180);
  for (const rad of ARC_RADII) {
    const el = Math.atan2(SEAT_Y - r.y, -(rad + r.z));
    // elevation of the arc centre relative to the camera's forward pitch
    const rel = Math.atan2(SEAT_Y - r.y, rad + r.z) - r.pitch;
    assert.ok(Math.abs(rel) <= half, `arc ${rad} outside fov: ${rel.toFixed(3)} vs ±${half.toFixed(3)} (${el.toFixed(3)})`);
  }
});

test("clock: lock reaches 1 within WAVE_MAX_T from every origin; arc times increase", () => {
  const s = seats();
  for (const o of [[0, 0], [7.4, -2.4], [-7.4, -2.4], [0, -7.8]]) {
    for (const st of s) {
      const d = Math.hypot(st.x - o[0], st.z - o[1]);
      assert.ok(lock(d, wavefront(WAVE_MAX_T)) >= 1 - 1e-9, `unreached from ${o}`);
    }
  }
  let prevT = -1;
  for (const rad of ARC_RADII) {
    let t = 0;
    while (lock(rad, wavefront(t)) < 1 - 1e-9) t += 0.001;
    assert.ok(t > prevT, "arc lock times strictly increasing");
    prevT = t;
  }
  assert.ok(prevT < 1.4, `t(7.8)=${prevT.toFixed(3)}`);
});

test("pulse: periodic, bounded, continuous, correct at 0 and 0.12", () => {
  assert.ok(near(pulse(0), PULSE_TAIL, 1e-9)); assert.ok(near(pulse(0.12), 1, 1e-9));
  assert.ok(near(pulse(0), pulse(1), 1e-9) && near(pulse(0.3), pulse(2.3), 1e-9));
  let prev = pulse(0);
  for (let i = 1; i <= 3000; i++) {
    const v = pulse(i / 1000);
    assert.ok(v >= 0 && v <= 1);
    assert.ok(Math.abs(v - prev) < 0.01, `Δpulse ${Math.abs(v - prev)} at ${i / 1000}`);
    prev = v;
  }
});

test("amplitude worst case ≤ 7.3, zero when released", () => {
  const worst = amplitude({ tune: 1, pulse: 1, lock: 1, beam: 1, energy: 1, lit: 1, released: 0 });
  assert.ok(worst <= 7.3, `worst ${worst}`);
  assert.equal(amplitude({ tune: 1, pulse: 1, lock: 1, beam: 1, energy: 1, lit: 1, released: 1 }), 0);
});

test("rebaseSeat keeps a locked seat's pulse continuous across a second downbeat, never pre-locks", () => {
  const s = seats();
  const seat = s[40];
  const c0 = { lockPrev: 0, phase0: 0, dist: seat.radius };
  const clockOld = 2.2; // first wave has passed every seat
  const before = seatPulse(c0, clockOld);
  const c1 = rebaseSeat(seat, c0, clockOld, [6.5, SEAT_Y, -2.0]);
  const after = seatPulse(c1, 0);
  assert.ok(near(before, after, 1e-9), `pulse jumped ${before} → ${after}`);
  assert.ok(c1.lockPrev >= 1 - 1e-9);
  // a seat the FIRST wave had not reached must not be locked by the rebase
  const far = s[125];
  const cf = { lockPrev: 0, phase0: 0, dist: far.radius };
  const cf1 = rebaseSeat(far, cf, 0.1, [0, SEAT_Y, 0]);
  assert.equal(cf1.lockPrev, 0);
  assert.equal(seatPulse(cf1, 0), 0);
});

test("baton: unit dir, continuous, present/aim timings, default and rest poses", () => {
  let prev = batonPose(0, -1, 0.5);
  for (let t = 0; t <= 8; t += 0.005) {
    const b = batonPose(t, -1, 0.5);
    assert.ok(near(len(b.dir), 1, 1e-6));
    assert.ok(len([b.dir[0] - prev.dir[0], b.dir[1] - prev.dir[1], b.dir[2] - prev.dir[2]]) < 0.06, `dir jump at ${t}`);
    prev = b;
  }
  assert.equal(batonPose(2.0, -1, 0).present, 0);
  assert.ok(near(batonPose(3.0, -1, 0).present, 1, 1e-9));
  assert.equal(batonPose(ARRIVAL.handoff, -1, 0).aim, 0);
  assert.ok(near(batonPose(ARRIVAL.live, -1, 0).aim, 1, 1e-9));
  const mid = batonPose(6, -1, 0.5);
  assert.ok(dot(mid.dir, DIR_DEFAULT) > 0.9999, "default dir at p 0.5");
  const rest = batonPose(6, -1, 0.9);
  assert.ok(dot(rest.dir, DIR_REST) > 0.9999, "rest dir at p 0.9");
  assert.ok(near(rest.x, PIVOT_REST[0]) && near(rest.y, PIVOT_REST[1]) && near(rest.z, PIVOT_REST[2]));
  assert.equal(rest.aim, 0);
});

test("cut-off latch hysteresis; arrival rate; release radius", () => {
  assert.equal(cutoffLatch(false, 0.71), false);
  assert.equal(cutoffLatch(false, 0.72), true);
  assert.equal(cutoffLatch(true, 0.69), true);
  assert.equal(cutoffLatch(true, 0.68), false);
  assert.equal(arrivalRate(0.1, 1), 4); assert.equal(arrivalRate(0, 1), 1); assert.equal(arrivalRate(0.5, 6), 1);
  assert.equal(releaseRadius(0.72), 0); assert.ok(releaseRadius(0.85) >= 8.4 - 1e-9);
  assert.equal(release(0.72), 0); assert.ok(near(release(0.85), 1, 1e-9));
});

test("stage hit lands on the stage plane and clamps when aimed up", () => {
  const h = stageHit([0, 5.4, 2.6], [0, -0.6, -0.8]);
  assert.ok(near(h[1], SEAT_Y, 1e-9));
  const l = Math.hypot(0, 0.3, -0.95);
  const up = stageHit([0, 5.4, 2.6], [0, 0.3 / l, -0.95 / l]);
  assert.ok(near(len([up[0], up[1] - 5.4, up[2] - 2.6]), 12, 1e-6), "clamped to far");
});

test("beam weight edges and copy mask", () => {
  assert.equal(beamWeight(BEAM_COS_OUTER, 1), 0);
  assert.ok(near(beamWeight(BEAM_COS_INNER, 1), 1, 1e-9));
  assert.equal(beamWeight(1, 0), 0);
  const m = [-0.9, -0.5, -0.1, 0.9];
  assert.ok(near(copyMask(-0.5, 0.2, m), 0.35, 1e-9));
  assert.ok(near(copyMask(0.6, 0.2, m), 1, 1e-9));
  assert.ok(near(copyMask(0.3, 0.3, [-2, -2, -2, -2]), 1, 1e-9));
});

test("newConductor shape", () => {
  const c = newConductor();
  assert.equal(c.clock, -1); assert.equal(c.beatT, -1);
  assert.deepEqual(c.copyMask, [-2, -2, -2, -2]);
  assert.equal(c.lockByArc.length, 5); assert.equal(c.pulseByArc.length, 5);
  assert.equal(c.waveOrigin[1], SEAT_Y);
  assert.equal(c.beamDir[2], -1);
  void BPS;
});
