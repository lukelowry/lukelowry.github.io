// The lookup receives physical kV, never a bus number, region, or layer ordinal.
export function voltageRGB(kv, colors, dark = false) {
  const levels = Object.keys(colors)
    .map(Number)
    .sort((a, b) => a - b);
  const nearest = levels.reduce((best, value) => (Math.abs(value - kv) < Math.abs(best - kv) ? value : best));
  const hex = colors[nearest][Number(dark)];
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

// Ordered nominal-voltage layers. The signal never changes this mapping.
export function voltageLayers(kv, visible) {
  const rounded = (value) => Math.round(value * 10) / 10;
  const levels = [...new Set(Array.from(kv, rounded).filter((_, i) => !visible || visible[i]))].sort((a, b) => a - b);
  const index = new Map(levels.map((level, i) => [level, i]));
  return { levels, heights: Float32Array.from(kv, (value) => index.get(rounded(value)) ?? 0) };
}

// Keep the full electrical topology for signal propagation, but hide inter-level branches.
export function sameVoltageEdges(heights, edges) {
  const visible = new Float32Array(edges.length / 2);
  for (let i = 0; i < visible.length; i++) visible[i] = Number(heights[edges[i * 2]] === heights[edges[i * 2 + 1]]);
  return visible;
}

// A vertex is drawn only when at least one of its incident branches is drawn.
// Empty voltage levels consume no space in the exploded stack.
export function visibleVoltageNetwork(kv, edges) {
  const nominal = voltageLayers(kv);
  const visibleEdges = sameVoltageEdges(nominal.heights, edges);
  const visibleVertices = new Float32Array(kv.length);
  for (let i = 0; i < visibleEdges.length; i++) {
    const a = edges[i * 2],
      b = edges[i * 2 + 1];
    if (!(kv[a] > 0 && Number.isFinite(kv[a]) && kv[b] > 0 && Number.isFinite(kv[b]))) visibleEdges[i] = 0;
    if (!visibleEdges[i]) continue;
    visibleVertices[edges[i * 2]] = 1;
    visibleVertices[edges[i * 2 + 1]] = 1;
  }
  return { ...voltageLayers(kv, visibleVertices), visibleEdges, visibleVertices };
}
