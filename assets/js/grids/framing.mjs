// A fixed resting view. Scroll only reveals the canvas; it never changes this pose.
export const RESTING_VIEW = Object.freeze({ pitch: 0, bearing: 0, layerSpan: 0.025, heightScale: 10 });

const VIEWS = Object.freeze({
  USA: Object.freeze({ ...RESTING_VIEW, zoom: 2.1, rightEdge: 0.94 }),
  EuropeA: Object.freeze({ ...RESTING_VIEW, zoom: 2.15, leftEdge: 0.08, anchorY: 0.5 }),
});

export function sceneView(name) {
  if (!VIEWS[name]) throw new Error("Unknown grid view");
  return VIEWS[name];
}

export function voltageHeights(model) {
  const denominator = Math.max(1, model.levels.length - 1);
  return Float32Array.from(model.heights, (level) => (level / denominator) ** 0.8 * RESTING_VIEW.layerSpan);
}

export function framingBounds(model) {
  const coords = model.topology.vertexCoords;
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  const extremes = new Set();
  const indices = [0, 0, 0, 0];
  for (let i = 0; i < model.visibleVertices.length; i++) {
    if (!model.visibleVertices[i]) continue;
    const x = coords[i * 2],
      y = coords[i * 2 + 1];
    if (x < west) {
      west = x;
      indices[0] = i;
    }
    if (x > east) {
      east = x;
      indices[1] = i;
    }
    if (y < south) {
      south = y;
      indices[2] = i;
    }
    if (y > north) {
      north = y;
      indices[3] = i;
    }
  }
  if (![west, east, south, north].every(Number.isFinite)) throw new Error("No visible grid geometry");
  for (const index of indices) extremes.add(index);
  return {
    items: [...extremes].map((index) => ({ kind: "vertex", index })),
    center: { centerX: (west + east) / 2, centerY: (south + north) / 2 },
  };
}

// Only the outline of each voltage layer can set its projected outer bounds.
// Keep this small set instead of projecting every bus during framing.
export function framingVertices(model) {
  const coords = model.topology.vertexCoords;
  const layers = Array.from({ length: model.levels.length }, () => []);
  model.visibleVertices.forEach((visible, i) => {
    if (visible) layers[model.heights[i]].push(i);
  });
  const cross = (a, b, c) =>
    (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[a * 2 + 1]) -
    (coords[b * 2 + 1] - coords[a * 2 + 1]) * (coords[c * 2] - coords[a * 2]);
  const outline = [];
  for (const layer of layers) {
    layer.sort((a, b) => coords[a * 2] - coords[b * 2] || coords[a * 2 + 1] - coords[b * 2 + 1]);
    const half = (points) => {
      const result = [];
      for (const i of points) {
        while (result.length > 1 && cross(result.at(-2), result.at(-1), i) <= 0) result.pop();
        result.push(i);
      }
      return result;
    };
    outline.push(...new Set([...half(layer), ...half(layer.reverse())]));
  }
  return outline.map((index) => ({ kind: "vertex", index }));
}

export function projectedBounds(network, vertices) {
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const vertex of vertices) {
    const point = network.locate(vertex);
    if (!point) continue;
    left = Math.min(left, point[0]);
    right = Math.max(right, point[0]);
    top = Math.min(top, point[1]);
    bottom = Math.max(bottom, point[1]);
  }
  return { left, right, top, bottom };
}
