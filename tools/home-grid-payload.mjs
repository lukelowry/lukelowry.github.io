import { parseNetwork } from "@latkit/embed";
import { visibleVoltageNetwork } from "../assets/js/grids/voltage.mjs";
import { framingBounds, framingVertices, voltageHeights } from "../assets/js/grids/framing.mjs";
import { HOME_MAGIC, HOME_SECTIONS } from "../assets/js/grids/home-payload.mjs";

function bounds(coords) {
  const result = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < coords.length; i += 2) {
    result[0] = Math.min(result[0], coords[i]);
    result[1] = Math.max(result[1], coords[i]);
    result[2] = Math.min(result[2], coords[i + 1]);
    result[3] = Math.max(result[3], coords[i + 1]);
  }
  return result;
}

export function compactHomeGrid(json) {
  const { topology: source, fields } = parseNetwork(json);
  const kv = fields.find((f) => f.id === "kv").values;
  const branchKV = fields.find((f) => f.id === "branch_kv").values;
  const visible = visibleVoltageNetwork(kv, source.edges);
  const vertices = [],
    edgeIndices = [];
  const remap = new Int32Array(source.vertexCount).fill(-1);
  visible.visibleVertices.forEach((drawn, i) => {
    if (drawn) {
      remap[i] = vertices.length;
      vertices.push(i);
    }
  });
  visible.visibleEdges.forEach((drawn, i) => {
    if (drawn) edgeIndices.push(i);
  });
  const vertexCoords = new Float32Array(vertices.length * 2);
  vertices.forEach((old, i) => vertexCoords.set(source.vertexCoords.subarray(old * 2, old * 2 + 2), i * 2));
  const edges = new Uint32Array(edgeIndices.length * 2);
  const points = [],
    starts = [0];
  edgeIndices.forEach((old, i) => {
    const a = source.edges[old * 2],
      b = source.edges[old * 2 + 1];
    // Derive branch colors at decode only while this exact physical-kV invariant holds.
    if (branchKV[old] !== kv[a] || remap[a] < 0 || remap[b] < 0) throw new Error("Cannot compact branch voltage/visibility");
    edges[i * 2] = remap[a];
    edges[i * 2 + 1] = remap[b];
    if (source.polylinePoints?.length) {
      for (let p = source.polylineStart[old] * 2; p < source.polylineStart[old + 1] * 2; p++) points.push(source.polylinePoints[p]);
      starts.push(points.length / 2);
    }
  });
  const topology = { vertexCount: vertices.length, coordinateSpace: "geographic", vertexCoords, edges };
  if (points.length) Object.assign(topology, { polylineStart: Uint32Array.from(starts), polylinePoints: Float32Array.from(points) });
  const originalBounds = bounds(source.vertexCoords),
    compactBounds = bounds(vertexCoords);
  // Latkit also uses topology bounds for depth amplitude. Fail rather than quietly
  // change composition if future data has invisible vertices outside this envelope.
  if (originalBounds.some((v, i) => v !== compactBounds[i])) throw new Error("Compaction changed native framing bounds");
  const area = Math.max(1e-6, (originalBounds[1] - originalBounds[0]) * (originalBounds[3] - originalBounds[2]));
  // Native topology headers round characteristic length to Float32 before sizing.
  const characteristic = (count) => Math.fround(count < 2 ? 1 : Math.sqrt(area / count));
  const model = {
    topology,
    kv: Float32Array.from(vertices, (i) => kv[i]),
    heights: Float32Array.from(vertices, (i) => visible.heights[i]),
    visibleVertices: new Float32Array(vertices.length).fill(1),
    visibleEdges: new Float32Array(edgeIndices.length).fill(1),
    levels: visible.levels,
    voltageColors: json.voltageColors,
    geometryScale: characteristic(source.vertexCount) / characteristic(vertices.length),
  };
  model.voltageHeight = voltageHeights(model);
  model.framing = { bounds: framingBounds(model), outline: framingVertices(model) };
  return { model, vertices, edgeIndices };
}

export function encodeHomePayload(model) {
  const arrays = {};
  for (const [name, Type] of Object.entries(HOME_SECTIONS)) arrays[name] = model[name] ?? model.topology[name] ?? new Type();
  const { levels, voltageColors, geometryScale, framing } = model;
  const header = new TextEncoder().encode(
    JSON.stringify({
      levels,
      voltageColors,
      geometryScale,
      framing,
      lengths: Object.fromEntries(Object.entries(arrays).map(([name, array]) => [name, array.length])),
    })
  );
  const start = (12 + header.length + 3) & ~3;
  const buffer = new ArrayBuffer(start + Object.values(arrays).reduce((sum, a) => sum + a.byteLength, 0));
  const view = new DataView(buffer);
  view.setUint32(0, HOME_MAGIC, true);
  view.setUint32(4, header.length, true);
  view.setUint32(8, buffer.byteLength, true);
  new Uint8Array(buffer, 12, header.length).set(header);
  let offset = start;
  for (const [name, Type] of Object.entries(HOME_SECTIONS)) {
    for (const value of arrays[name]) {
      if (Type === Float32Array) view.setFloat32(offset, value, true);
      else view.setUint32(offset, value, true);
      offset += 4;
    }
  }
  return buffer;
}
