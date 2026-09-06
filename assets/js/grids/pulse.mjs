// Illustrative hop-distance propagation through the drawn network, not a power-flow simulation.
// The two shade channels are uploaded only when the source changes; the GPU advances the pulse.
export function createPulseField({ topology, visibleVertices, visibleEdges }) {
  const { vertexCount, edges } = topology;
  const starts = new Uint32Array(vertexCount + 1);
  for (let edge = 0; edge < visibleEdges.length; edge++) {
    if (!visibleEdges[edge]) continue;
    starts[edges[edge * 2] + 1]++;
    starts[edges[edge * 2 + 1] + 1]++;
  }
  for (let i = 1; i < starts.length; i++) starts[i] += starts[i - 1];
  const cursor = starts.slice();
  const neighbors = new Uint32Array(starts[vertexCount]);
  for (let edge = 0; edge < visibleEdges.length; edge++) {
    if (!visibleEdges[edge]) continue;
    const a = edges[edge * 2],
      b = edges[edge * 2 + 1];
    neighbors[cursor[a]++] = b;
    neighbors[cursor[b]++] = a;
  }
  const vertices = new Float32Array(vertexCount);
  const branches = new Float32Array(visibleEdges.length);
  const queue = new Uint32Array(vertexCount);
  return {
    from(item, limit = 18) {
      if (!item || !Number.isInteger(item.index)) return null;
      const mask = item.kind === "vertex" ? visibleVertices : item.kind === "edge" ? visibleEdges : null;
      if (!mask?.[item.index]) return null;
      vertices.fill(-1);
      branches.fill(-1);
      let head = 0,
        tail = 0,
        max = 0;
      const seed = (vertex) => {
        if (vertices[vertex] >= 0) return;
        vertices[vertex] = 0;
        queue[tail++] = vertex;
      };
      if (item.kind === "vertex") seed(item.index);
      else {
        seed(edges[item.index * 2]);
        seed(edges[item.index * 2 + 1]);
      }
      while (head < tail) {
        const vertex = queue[head++];
        if (vertices[vertex] >= limit) continue;
        for (let j = starts[vertex]; j < starts[vertex + 1]; j++) {
          const next = neighbors[j];
          if (vertices[next] >= 0) continue;
          vertices[next] = vertices[vertex] + 1;
          max = Math.max(max, vertices[next]);
          queue[tail++] = next;
        }
      }
      for (let edge = 0; edge < branches.length; edge++) {
        if (!visibleEdges[edge]) continue;
        const a = vertices[edges[edge * 2]],
          b = vertices[edges[edge * 2 + 1]];
        if (a >= 0 && b >= 0) branches[edge] = (a + b) / 2;
      }
      return { vertices, branches, max };
    },
  };
}
