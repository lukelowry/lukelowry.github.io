import assert from "node:assert/strict";
import { createSpringWave } from "../assets/js/grids/spring-wave.mjs";

function fixture(curved = false) {
  const coords = new Float32Array([0, 0, 40, 0, 80, 0, 140, 0, 250, 0, 400, 0, 20, 0, 20, 40]);
  const model = {
    topology: {
      vertexCount: 8,
      vertexCoords: coords,
      edges: new Uint32Array([1, 2]),
      polylinePoints: curved ? new Float32Array([60, 0]) : undefined,
    },
    visibleVertices: new Float32Array([1, 1, 1, 1, 1, 1, 0, 1]),
  };
  const uploads = [];
  const effect = createSpringWave(model, (channel, values) => uploads.push({ channel, values: values?.slice() ?? null }));
  effect.reframe((id) => [300 + coords[id * 2] * 2, 400 - coords[id * 2 + 1] * 2], 1440, 1000);
  return { effect, uploads, coords };
}
for (const curved of [false, true]) {
  const { effect, uploads, coords } = fixture(curved);
  const host = new Float32Array(64);
  effect.move(340, 400, 0);
  let positive = false,
    negative = false,
    peak = 0;
  for (let time = 16; time < 2300; time += 16) {
    effect.paint(host, time);
    const values = uploads.findLast((u) => u.channel === "vertexPosition")?.values;
    if (!values) continue;
    const dx = (values[2] - coords[2]) * 2;
    positive ||= dx > 1;
    negative ||= dx < -0.1;
    for (let id = 0; id < 8; id++) {
      const distance = Math.hypot((values[id * 2] - coords[id * 2]) * 2, (values[id * 2 + 1] - coords[id * 2 + 1]) * 2);
      peak = Math.max(peak, distance);
      assert.ok(distance <= (curved ? 5 : 9) + 0.0001, "Combined displacement is bounded in CSS pixels");
    }
    assert.deepEqual([...values.slice(8, 14)], [...coords.slice(8, 14)], "Distant and hidden vertices remain at rest");
  }
  assert.ok(positive && negative, "A real outward spring and smaller reverse movement occur");
  assert.ok(peak > (curved ? 2 : 4), "Movement is clearly visible");
  assert.equal(uploads.findLast((u) => u.channel === "vertexPosition").values, null, "Parked pointer returns to exact native coordinates");
  assert.equal(uploads.findLast((u) => u.channel === "vertexShade").values, null);
  const idle = uploads.length;
  assert.equal(effect.paint(host, 3000), false);
  assert.equal(uploads.length, idle, "No uploads at rest");
  assert.deepEqual(effect.nearest(382, 400, 28), { kind: "vertex", index: 1 }, "Dwell uses cached visible rest positions");
  effect.leave();
  effect.move(450, 400, 3100);
  effect.paint(host, 3300);
  assert.equal(effect.press(), true, "A press reports moving geometry");
  const frozen = uploads.length;
  effect.paint(host, 3500);
  assert.equal(uploads.length, frozen, "Press preserves the visible native picking geometry");
  effect.release();
  effect.paint(host, 3550);
  effect.reset();
  assert.equal(uploads.findLast((u) => u.channel === "vertexPosition").values, null, "Switch/Off/resize cancels displacement");
  effect.move(340, 400, 4000);
  effect.pulse(null, { kind: "edge", index: 0 }, 4100, 1);
  effect.move(390, 400, 4200);
  effect.paint(host, 4350);
  const overlap = uploads.findLast((u) => u.channel === "vertexPosition").values;
  assert.ok(overlap.every(Number.isFinite));
  effect.reframe((id) => [300 + coords[id * 2] * 4, 400 - coords[id * 2 + 1] * 4], 1440, 1000);
  assert.equal(uploads.findLast((u) => u.channel === "vertexPosition").values, null, "Reframing resets before calibrating");
}
console.log("Spring: visible rebound, bounds, locality, masks, pixel calibration, native press freeze, exact restoration and idle passed.");

// Fast reversals and stopping retain field momentum instead of replacing pulses.
{
  const { effect, uploads } = fixture();
  const host = new Float32Array(64);
  let previous = null,
    largestStep = 0;
  for (let frame = 0; frame < 500; frame++) {
    const time = frame * 8;
    if (frame < 80) effect.move(340 + 120 * Math.sin(time / 80), 400);
    effect.paint(host, time);
    const values = uploads.findLast((u) => u.channel === "vertexPosition")?.values;
    if (values && previous) for (let i = 0; i < values.length; i++) largestStep = Math.max(largestStep, Math.abs(values[i] - previous[i]) * 2);
    previous = values?.slice() ?? null;
  }
  assert.ok(largestStep < 1.5, `Fast sweeps and reversals stay continuous: ${largestStep}px per 8ms`);
  assert.equal(uploads.findLast((u) => u.channel === "vertexPosition").values, null, "Stopping dissipates displacement and velocity completely");
  console.log(`Continuous field: fast reversal changes <=${largestStep.toFixed(3)}px per 8ms, then settles exactly.`);
}

// Returning across the panel must not invent a sweep through the intervening gap.
{
  const { effect, uploads } = fixture();
  const host = new Float32Array(64);
  effect.move(340, 400);
  effect.paint(host, 0);
  effect.paint(host, 16);
  effect.leave();
  effect.move(1100, 400);
  effect.paint(host, 32);
  const positions = uploads.findLast((u) => u.channel === "vertexPosition")?.values;
  if (positions) assert.equal(positions[6], 140, "Re-entry preserves the old field without pulling through the skipped gap");
}
