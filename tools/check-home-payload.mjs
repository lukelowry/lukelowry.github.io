import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { parseNetwork } from "@latkit/embed";
import { compactHomeGrid, encodeHomePayload } from "./home-grid-payload.mjs";
import { decodeHomePayload } from "../assets/js/grids/home-payload.mjs";
import { visibleVoltageNetwork } from "../assets/js/grids/voltage.mjs";
import { framingBounds, framingVertices, voltageHeights } from "../assets/js/grids/framing.mjs";

for (const name of ["USA", "EuropeA"]) {
  const json = JSON.parse(await readFile(new URL(`../assets/grids/${name}.json`, import.meta.url), "utf8"));
  const { topology: source, fields } = parseNetwork(json);
  const kv = fields.find((f) => f.id === "kv").values;
  const branchKV = fields.find((f) => f.id === "branch_kv").values;
  const visible = visibleVoltageNetwork(kv, source.edges);
  const { model, vertices, edgeIndices } = compactHomeGrid(json);
  const buffer = encodeHomePayload(model);
  const binary = await readFile(new URL(`../assets/grids/${name}.home.bin`, import.meta.url));
  assert.deepEqual(binary, Buffer.from(buffer), "Published binary is a deterministic export of the source");
  const zipped = await readFile(new URL(`../assets/grids/${name}.home.bin.gz`, import.meta.url));
  assert.deepEqual(gunzipSync(zipped), binary);
  assert.deepEqual(gzipSync(binary, { level: 9 }), zipped);
  const decoded = decodeHomePayload(buffer);
  assert.equal(decoded.topology.vertexCoords.buffer, buffer, "Geometry is viewed without copying");
  assert.equal(decoded.topology.edges.buffer, buffer);
  assert.ok(decoded.topology.polylineStart instanceof Uint32Array);
  assert.equal(decoded.topology.polylineStart.length, edgeIndices.length + 1);
  assert.equal("numbers" in decoded, false, "Homepage carries no bus-number metadata");
  assert.equal(
    vertices.length,
    visible.visibleVertices.reduce((a, b) => a + b, 0)
  );
  assert.equal(
    edgeIndices.length,
    visible.visibleEdges.reduce((a, b) => a + b, 0)
  );
  for (const [i, old] of vertices.entries()) {
    assert.equal(decoded.kv[i], kv[old]);
    assert.equal(decoded.heights[i], visible.heights[old]);
    assert.deepEqual(decoded.topology.vertexCoords.subarray(i * 2, i * 2 + 2), source.vertexCoords.subarray(old * 2, old * 2 + 2));
  }
  for (const [i, old] of edgeIndices.entries()) {
    assert.equal(vertices[decoded.topology.edges[i * 2]], source.edges[old * 2]);
    assert.equal(vertices[decoded.topology.edges[i * 2 + 1]], source.edges[old * 2 + 1]);
    assert.equal(decoded.branchKV[i], branchKV[old]);
    if (source.polylinePoints?.length) {
      const t = decoded.topology;
      assert.deepEqual(
        t.polylinePoints.subarray(t.polylineStart[i] * 2, t.polylineStart[i + 1] * 2),
        source.polylinePoints.subarray(source.polylineStart[old] * 2, source.polylineStart[old + 1] * 2)
      );
    }
  }
  assert.deepEqual(decoded.voltageHeight, voltageHeights(decoded));
  assert.deepEqual(decoded.framing.bounds, framingBounds(decoded));
  assert.deepEqual(decoded.framing.outline, framingVertices(decoded));
  assert.deepEqual(decoded.levels, visible.levels);
  assert.deepEqual(decoded.voltageColors, json.voltageColors);
  const original = { topology: source, ...visible };
  const originalBounds = framingBounds(original);
  assert.deepEqual(decoded.framing.bounds.center, originalBounds.center);
  assert.deepEqual(
    decoded.framing.bounds.items.map((v) => vertices[v.index]),
    originalBounds.items.map((v) => v.index)
  );
  assert.deepEqual(
    decoded.framing.outline.map((v) => vertices[v.index]),
    framingVertices(original).map((v) => v.index)
  );
  assert.ok(Math.abs(decoded.geometryScale - Math.sqrt(vertices.length / source.vertexCount)) < 1e-6);
  assert.throws(() => decodeHomePayload(buffer.slice(0, -4)), /Invalid/);
  const invalidVersion = buffer.slice(0);
  new DataView(invalidVersion).setUint32(0, 0, true);
  assert.throws(() => decodeHomePayload(invalidVersion), /Invalid/);
  const invalidSection = buffer.slice(0);
  const headerLength = new DataView(buffer).getUint32(4, true);
  const header = new TextDecoder().decode(new Uint8Array(buffer, 12, headerLength));
  const changed = header.replace(/"kv":(\d+)/, (_, length) => `"kv":${"9".repeat(length.length)}`);
  new Uint8Array(invalidSection, 12, headerLength).set(new TextEncoder().encode(changed));
  assert.throws(() => decodeHomePayload(invalidSection), /Invalid/);
  console.log(`Verified ${name} binary: every visible coordinate, endpoint, route, voltage, layer and framing hull matches.`);
}
