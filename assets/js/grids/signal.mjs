// Illustrative travelling packet over graph hop distance, not a physical simulation.
// O(V+E) preprocessing, O(V) frames, no time-series downloads or frame allocations.
export function adjacency(vertexCount, edges) {
  const starts = new Uint32Array(vertexCount + 1);
  for (const vertex of edges) starts[vertex + 1]++;
  for (let i = 1; i < starts.length; i++) starts[i] += starts[i - 1];
  const cursor = starts.slice();
  const neighbors = new Uint32Array(edges.length);
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i],
      b = edges[i + 1];
    neighbors[cursor[a]++] = b;
    neighbors[cursor[b]++] = a;
  }
  return { starts, neighbors };
}
export function createWave(graph, source) {
  const count = graph.starts.length - 1;
  if (!Number.isInteger(source) || source < 0 || source >= count) throw new RangeError("Invalid source vertex");
  const distances = new Int32Array(count).fill(-1);
  const queue = new Uint32Array(count);
  let head = 0,
    tail = 1,
    max = 0;
  distances[source] = 0;
  queue[0] = source;
  while (head < tail) {
    const vertex = queue[head++];
    for (let j = graph.starts[vertex]; j < graph.starts[vertex + 1]; j++) {
      const next = graph.neighbors[j];
      if (distances[next] !== -1) continue;
      distances[next] = distances[vertex] + 1;
      max = Math.max(max, distances[next]);
      queue[tail++] = next;
    }
  }
  const values = new Float32Array(count);
  const amplitudes = new Float32Array(count);
  const shells = new Float32Array(max + 1);
  const width = Math.max(3, max / 12);
  return {
    distances,
    values,
    amplitudes,
    frame(seconds) {
      const travel = ((seconds % 18) / 18) * (max + width * 10) - width * 5;
      for (let d = 0; d <= max; d++) {
        const x = (d - travel) / width;
        shells[d] = Math.exp(-0.5 * x * x) * Math.cos(x * 2.6);
      }
      for (let i = 0; i < count; i++) {
        values[i] = distances[i] < 0 ? 0 : shells[distances[i]];
        amplitudes[i] = Math.abs(values[i]);
      }
      return values;
    },
  };
}
