// Homepage-only render model. The scientific demo retains the complete NetworkJSON.
// GHM1: 12-byte little-endian prefix, UTF-8 metadata padded to four bytes,
// then contiguous Float32/Uint32 arrays. Coordinates retain their original bits.
export const HOME_MAGIC = 0x314d4847;
export const HOME_SECTIONS = Object.freeze({
  vertexCoords: Float32Array,
  edges: Uint32Array,
  kv: Float32Array,
  heights: Float32Array,
  voltageHeight: Float32Array,
  polylineStart: Uint32Array,
  polylinePoints: Float32Array,
});

export function decodeHomePayload(buffer) {
  const fail = () => {
    throw new Error("Invalid homepage grid payload");
  };
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12 || buffer.byteLength % 4) fail();
  const prefix = new DataView(buffer);
  if (prefix.getUint32(0, true) !== HOME_MAGIC || prefix.getUint32(8, true) !== buffer.byteLength) fail();
  const headerLength = prefix.getUint32(4, true);
  let offset = (12 + headerLength + 3) & ~3;
  if (headerLength === 0 || offset > buffer.byteLength || offset < 12) fail();
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, headerLength)));
  const arrays = {};
  // Typed views avoid base64 decoding and a second copy of every geometry array.
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  for (const [name, Type] of Object.entries(HOME_SECTIONS)) {
    const length = meta.lengths?.[name];
    if (!Number.isSafeInteger(length) || length < 0 || length > (buffer.byteLength - offset) / 4) fail();
    arrays[name] = littleEndian
      ? new Type(buffer, offset, length)
      : Type.from({ length }, (_, i) => (Type === Float32Array ? prefix.getFloat32(offset + i * 4, true) : prefix.getUint32(offset + i * 4, true)));
    offset += length * 4;
  }
  const { vertexCoords, edges, kv, heights, voltageHeight, polylineStart, polylinePoints } = arrays;
  const vertexCount = kv.length,
    edgeCount = edges.length / 2;
  if (
    offset !== buffer.byteLength ||
    !vertexCount ||
    !Number.isInteger(edgeCount) ||
    !edgeCount ||
    vertexCoords.length !== vertexCount * 2 ||
    heights.length !== vertexCount ||
    voltageHeight.length !== vertexCount ||
    polylinePoints.length % 2 ||
    (polylineStart.length && polylineStart.length !== edgeCount + 1) ||
    (!polylineStart.length && polylinePoints.length) ||
    !(meta.geometryScale > 0 && Number.isFinite(meta.geometryScale))
  )
    fail();
  const topology = {
    vertexCount,
    coordinateSpace: "geographic",
    vertexCoords,
    edges,
    // Embed's resolved topology contract requires offsets even for straight edges.
    polylineStart: polylineStart.length ? polylineStart : new Uint32Array(edgeCount + 1),
  };
  if (polylineStart.length) Object.assign(topology, { polylineStart, polylinePoints });
  return {
    topology,
    kv,
    heights,
    voltageHeight,
    branchKV: Float32Array.from({ length: edgeCount }, (_, i) => kv[edges[i * 2]]),
    visibleVertices: new Float32Array(vertexCount).fill(1),
    visibleEdges: new Float32Array(edgeCount).fill(1),
    levels: meta.levels,
    voltageColors: meta.voltageColors,
    geometryScale: meta.geometryScale,
    framing: meta.framing,
  };
}
