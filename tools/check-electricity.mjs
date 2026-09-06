import { createVertexRipple } from "../assets/js/grids/vertex-ripple.mjs";
import { effectsEnabled } from "../assets/js/grids/effect-preference.mjs";
import assert from "node:assert/strict";
import { createPulseField } from "../assets/js/grids/pulse.mjs";
import { createElectricShade } from "../assets/js/grids/electricity.mjs";

// A fork, a cycle, a hidden bridge, and a disconnected component.
const model = {
  topology: { vertexCount: 8, edges: new Uint32Array([0, 1, 1, 2, 1, 3, 3, 4, 4, 1, 3, 5, 6, 7]) },
  visibleVertices: new Float32Array([1, 1, 1, 1, 1, 0, 1, 1]),
  visibleEdges: new Float32Array([1, 1, 1, 1, 1, 0, 1]),
};
const field = createPulseField(model);
const first = field.from({ kind: "vertex", index: 0 });
assert.deepEqual([...first.vertices], [0, 1, 2, 2, 2, -1, -1, -1]);
assert.deepEqual([...first.branches], [0.5, 1.5, 1.5, 2, 1.5, -1, -1]);
assert.equal(first.max, 2);
const next = field.from({ kind: "edge", index: 2 });
assert.equal(first.vertices, next.vertices, "Pulse sources reuse their buffers");
assert.equal(first.branches, next.branches);
assert.deepEqual([...next.vertices], [1, 0, 1, 0, 1, -1, -1, -1]);
assert.equal(next.branches[2], 0, "A selected branch starts with both endpoints");
assert.equal(field.from({ kind: "vertex", index: 5 }), null, "Hidden vertices cannot seed a pulse");
assert.equal(field.from({ kind: "edge", index: 5 }), null, "Hidden branches cannot seed a pulse");
assert.equal(field.from({ kind: "vertex", index: 100 }), null);
assert.equal(field.from({ kind: "invalid", index: 0 }), null);
assert.deepEqual([...field.from({ kind: "vertex", index: 0 }, 1).vertices], [0, 1, -1, -1, -1, -1, -1, -1]);
assert.deepEqual([...field.from({ kind: "vertex", index: 6 }).vertices], [-1, -1, -1, -1, -1, -1, 0, 1]);

const host = new Float32Array(64);
let dwells = 0;
const shade = createElectricShade(() => dwells++);
const frame = (timeMs) => {
  const active = shade.tick(host, { timeMs });
  assert.ok(host.every(Number.isFinite), "Every shader uniform must stay finite");
  return active;
};
assert.equal(frame(0), false, "An untouched scene stays idle");
shade.move(100, 100, 0);
for (let time = 16; time < 2200; time += 16) frame(time);
assert.equal(dwells, 1, "A stationary pointer produces one dwell, not repeating pulses");
assert.equal(frame(2200), false, "A settled light stops scheduling frames");
shade.move(105, 102, 2200);
for (let time = 2216; time < 3100; time += 16) frame(time);
assert.equal(dwells, 1, "Small hand tremors must not rearm a dwell");
shade.move(300, 100, 3100, false);
for (let time = 3116; time < 3300; time += 16) frame(time);
assert.ok(
  [...host].some((value, i) => i >= 23 && (i - 23) % 4 === 0 && value > 0.1),
  "A sweep leaves a visible wake"
);
shade.leave();
for (let time = 3300; time < 4800; time += 16) frame(time);
assert.equal(frame(4800), false, "The wake and light stop after leaving");
assert.equal(host[3], 0);
assert.equal(dwells, 1, "Leaving or dragging never generates a dwell pulse");
shade.pulse(5000, 18);
assert.equal(frame(5100), true);
assert.ok(host[12] > 0);
assert.equal(frame(7600), false, "A graph pulse finishes without perpetual animation");
assert.equal(host[12], 0);
shade.move(80, 90, 7700);
shade.pulse(7700, 18);
shade.reset();
assert.equal(frame(7716), false, "Reset cancels the pulse, dwell, and wake together");
assert.equal(host[3], 0);
assert.equal(host[12], 0);
console.log("Electricity checks passed: visible graph propagation, reusable fields, dwell, wake, cancellation, and idle.");

assert.equal(effectsEnabled(null), true, "New visitors get working effects without an opt-in");
assert.equal(effectsEnabled("on"), true);
assert.equal(effectsEnabled("off"), false, "A deliberate pause is remembered");

// Radius waves must change real, visible vertices and restore exactly to rest.
const sizeUploads = [];
const ripple = createVertexRipple(5, [1, 1, 1, 0, 1], (values) => sizeUploads.push(values && [...values]));
ripple.reframe(
  (id) =>
    [
      [100, 100],
      [180, 100],
      [260, 100],
      [100, 100],
      [800, 800],
    ][id],
  1000,
  1000
);
const sizeHost = new Float32Array(64);
sizeHost.set([100, 100, 190, 1]);
ripple.paint(sizeHost, 0);
assert.ok(sizeUploads.at(-1)[0] > 1.6, "The pointer visibly swells the nearest bus");
assert.ok(sizeUploads.at(-1)[1] > 1 && sizeUploads.at(-1)[1] < sizeUploads.at(-1)[0]);
assert.equal(sizeUploads.at(-1)[2], 1, "Pressure is local");
assert.equal(sizeUploads.at(-1)[3], 1, "Hidden buses never change size");
const settledUploads = sizeUploads.length;
ripple.paint(sizeHost, 16);
assert.equal(sizeUploads.length, settledUploads, "Stationary sizes do not keep uploading");
ripple.reset();
assert.equal(sizeUploads.at(-1), null, "Cancellation unbinds the size field and restores native radii");
sizeHost.fill(0);
ripple.move(40, 100, 0);
ripple.move(100, 100, 50);
assert.equal(ripple.paint(sizeHost, 280), true);
assert.ok(sizeUploads.at(-1)[1] > 1.4, "A fast sweep sends a radius wave out to a neighboring bus");
assert.equal(sizeUploads.at(-1)[2], 1, "The wave has not reached the farther bus yet");
ripple.paint(sizeHost, 610);
assert.ok(sizeUploads.at(-1)[2] > 1.2, "The radius wave travels outward over time");
assert.ok(sizeUploads.at(-1)[1] <= 1, "The nearer bus settles behind the wave");
assert.equal(ripple.paint(sizeHost, 960), false);
assert.equal(sizeUploads.at(-1), null, "A sweep finishes with the size channel cleared");
ripple.pulse(new Float32Array([0, 1, 2, 0, -1]));
sizeHost[11] = 2;
sizeHost[12] = 1;
ripple.paint(sizeHost, 1100);
assert.ok(sizeUploads.at(-1)[2] > 1.8, "The connected pulse reaches the second hop");
assert.ok(sizeUploads.at(-1)[0] < 1, "A small rebound follows the connected pulse");
assert.equal(sizeUploads.at(-1)[3], 1);
assert.equal(sizeUploads.at(-1)[4], 1, "Disconnected buses stay at rest");
sizeHost[3] = 1;
sizeHost[0] = 260;
sizeHost[1] = 100;
ripple.paint(sizeHost, 1116);
assert.ok(
  sizeUploads.at(-1).every((size) => size >= 0.85 && size <= 1.850001),
  "Overlapping effects stay bounded"
);
ripple.reframe((id) => [600 + id * 80, 600], 1000, 1000);
assert.equal(sizeUploads.at(-1), null, "Reframing cancels old coordinates and radius changes");
console.log("Vertex radii: local pressure, outward sweep, graph hops, rebound, masking, bounded overlap, cancellation, and idle passed.");

ripple.reset();
sizeHost.fill(0);
ripple.move(40, 100, 1200);
for (let step = 1; step <= 20; step++) ripple.move(40 + step * 2, 100, 1200 + step * 2);
assert.equal(ripple.paint(sizeHost, 1250), true, "High-frequency pointers trigger a sweep even when individual events move only two pixels");
ripple.reset();
ripple.move(40, 100, 1300);
for (let step = 1; step <= 20; step++) ripple.move(40 + step, 100, 1300 + step * 30);
assert.equal(ripple.paint(sizeHost, 1910), false, "Slow precise pointer movement does not emit sweep waves");
