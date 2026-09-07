import "./check-electricity.mjs";
import "./check-spring-wave.mjs";
import { voltageRGB } from "../assets/js/grids/voltage.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { parseNetwork } from "@latkit/embed";
import { voltageLayers, sameVoltageEdges, visibleVoltageNetwork } from "../assets/js/grids/voltage.mjs";
import { framingVertices, framingBounds, voltageHeights, RESTING_VIEW } from "../assets/js/grids/framing.mjs";
import { storyState } from "../assets/js/grids/home.mjs";
import { adjacency, createWave } from "../assets/js/grids/signal.mjs";

const outline = framingVertices({
  topology: { vertexCoords: new Float32Array([0, 0, 4, 0, 4, 4, 0, 4, 2, 2, 2, 2, 100, 100]) },
  levels: [69, 138],
  heights: [0, 0, 0, 0, 0, 1, 1],
  visibleVertices: new Float32Array([1, 1, 1, 1, 1, 1, 0]),
});
assert.deepEqual(
  outline.map((v) => v.index).sort(),
  [0, 1, 2, 3, 5],
  "Layer outlines omit interior and hidden vertices, preserving each voltage layer."
);
const framingModel = {
  topology: { vertexCoords: new Float32Array([-2, 0, 4, 6, 100, 100]) },
  visibleVertices: new Float32Array([1, 1, 0]),
};
assert.deepEqual(framingBounds(framingModel), {
  items: [
    { kind: "vertex", index: 0 },
    { kind: "vertex", index: 1 },
  ],
  center: { centerX: 1, centerY: 3 },
});
assert.throws(() => framingBounds({ ...framingModel, visibleVertices: new Float32Array(3) }), /No visible/);
const layers = voltageLayers(new Float32Array([138, 13.8, 500, 138, 13.2]));
assert.deepEqual(layers.levels, [13.2, 13.8, 138, 500]);
assert.deepEqual([...layers.heights], [2, 1, 3, 2, 0]);
assert.deepEqual([...sameVoltageEdges(new Float32Array([0, 1, 1]), new Uint32Array([0, 1, 1, 2, 2, 0]))], [0, 1, 0]);
const filtered = visibleVoltageNetwork(new Float32Array([69, 69, 138, 230, 230, 500]), new Uint32Array([0, 1, 1, 2, 2, 3, 3, 4]));
assert.deepEqual([...filtered.visibleEdges], [1, 0, 0, 1]);
assert.deepEqual([...filtered.visibleVertices], [1, 1, 0, 1, 1, 0]);
assert.deepEqual(filtered.levels, [69, 230]);
assert.deepEqual([...filtered.heights], [0, 0, 0, 1, 1, 0]);
const empty = visibleVoltageNetwork(new Float32Array([69, 138]), new Uint32Array([0, 1]));
assert.deepEqual(empty.levels, []);
assert.ok(empty.visibleVertices.every((value) => value === 0));
const unknown = visibleVoltageNetwork(new Float32Array([0, 0, 132, 132]), new Uint32Array([0, 1, 1, 2, 2, 3]));
assert.deepEqual([...unknown.visibleEdges], [0, 0, 1]);
assert.deepEqual([...unknown.visibleVertices], [0, 0, 1, 1]);
assert.deepEqual(unknown.levels, [132]);
const firstScene = storyState(0, 1000, 1400);
assert.equal(firstScene.EuropeA.preload, false);
assert.equal(firstScene.EuropeA.visible, false);
assert.equal(storyState(500, 1000, 1400).EuropeA.preload, true);
assert.equal(storyState(2000, 1000, 1400).USA.visible, false);
assert.equal(storyState(2000, 1000, 1400).EuropeA.visible, true);
assert.equal("progress" in firstScene.USA, false, "Scroll must not drive a camera timeline.");
const heights = voltageHeights({ levels: [69, 138, 500], heights: new Float32Array([0, 1, 2, 1]) });
assert.equal(heights[0], 0);
assert.ok(heights[0] < heights[1] && heights[1] < heights[2]);
assert.equal(heights[1], heights[3], "Equal voltages retain equal depth.");
assert.ok(Math.abs(heights[2] - RESTING_VIEW.layerSpan) < 1e-8);
assert.deepEqual([...voltageHeights({ levels: [69], heights: new Float32Array([0, 0]) })], [0, 0]);
// Cycles, parallel edges, disconnected vertices, and isolated sources must all work.
const graph = adjacency(6, new Uint32Array([0, 1, 1, 2, 2, 0, 0, 1, 2, 3]));
const wave = createWave(graph, 0);
assert.deepEqual([...wave.distances], [0, 1, 1, 2, -1, -1]);
const originalBuffer = wave.frame(3);
for (const t of [0, 1, 4, 9, 17.999, 18, 36]) {
  assert.equal(wave.frame(t), originalBuffer);
  assert.ok([...wave.values].every((v) => Number.isFinite(v) && Math.abs(v) <= 1));
  assert.equal(wave.values[4], 0);
  assert.ok(wave.amplitudes.every((value, i) => value === Math.abs(wave.values[i])));
}
assert.deepEqual([...createWave(graph, 4).distances], [-1, -1, -1, -1, 0, -1]);
assert.throws(() => createWave(graph, 8), RangeError);

for (const [name, vertices, edges, visibleVertices, visibleEdges, levels] of [
  ["USA", 82000, 104121, 69835, 83457, [69, 100, 115, 138, 161, 230, 345, 500, 765]],
  ["EuropeA", 8807, 12252, 8725, 11168, [132, 220, 300, 380, 500, 750]],
]) {
  const raw = await readFile(new URL(`../assets/grids/${name}.json`, import.meta.url));
  const gzip = await readFile(new URL(`../assets/grids/${name}.json.gz`, import.meta.url));
  assert.deepEqual(gunzipSync(gzip), raw);
  const model = parseNetwork(JSON.parse(raw));
  assert.equal(model.topology.vertexCount, vertices);
  assert.equal(model.topology.edges.length / 2, edges);
  assert.ok(model.topology.edges.every((i) => i < vertices));
  const payload = JSON.parse(raw);
  const kvBytes = Buffer.from(payload.fields.find((f) => f.id === "kv").values.base64, "base64");
  const branchBytes = Buffer.from(payload.fields.find((f) => f.id === "branch_kv").values.base64, "base64");
  const branchKV = Float32Array.from({ length: edges }, (_, i) => branchBytes.readFloatLE(i * 4));
  const kv = Float32Array.from({ length: vertices }, (_, i) => kvBytes.readFloatLE(i * 4));
  const view = visibleVoltageNetwork(kv, model.topology.edges);
  assert.equal(
    view.visibleVertices.reduce((a, b) => a + b, 0),
    visibleVertices
  );
  assert.equal(
    view.visibleEdges.reduce((a, b) => a + b, 0),
    visibleEdges
  );
  assert.deepEqual(view.levels, levels);
  if (name === "EuropeA") {
    assert.equal(model.topology.polylinePoints.length / 2, 14111);
    assert.equal(model.topology.polylineStart.length, edges + 1);
    assert.equal(model.topology.polylineStart[edges], 14111);
    assert.equal(kv.filter((v) => v <= 0).length, 82);
  }
  const degree = new Uint32Array(vertices);
  view.visibleEdges.forEach((visible, i) => {
    if (!visible) return;
    const a = model.topology.edges[i * 2],
      b = model.topology.edges[i * 2 + 1];
    assert.equal(kv[a], kv[b]);
    assert.equal(branchKV[i], kv[a]);
    assert.deepEqual(voltageRGB(branchKV[i], payload.voltageColors), voltageRGB(kv[a], payload.voltageColors));
    degree[a]++;
    degree[b]++;
  });
  assert.ok(view.visibleVertices.every((visible, i) => Boolean(visible) === degree[i] > 0));
  assert.ok(view.visibleEdges.every((visible, i) => Boolean(visible) === branchKV[i] > 0));
  // Geographic position and bus numbering never enter the kV color/height mapping.
  for (const level of view.levels) {
    const indices = Array.from({ length: vertices }, (_, i) => i).filter((i) => kv[i] === level && view.visibleVertices[i]);
    const first = indices[0],
      last = indices.at(-1);
    assert.equal(view.heights[first], view.heights[last]);
    assert.deepEqual(voltageRGB(kv[first], payload.voltageColors), voltageRGB(kv[last], payload.voltageColors));
  }
  assert.equal(new Set(view.levels.map((kv) => voltageRGB(kv, payload.voltageColors).join(","))).size, levels.length);
  const signal = createWave(adjacency(vertices, model.topology.edges), 0);
  const start = performance.now();
  for (let frame = 0; frame < 600; frame++) signal.frame(frame / 60);
  console.log(`${name}: valid npm embed data, ${gzip.length} compressed bytes; signal CPU ${(performance.now() - start).toFixed(1)} ms / 600 frames`);
}
