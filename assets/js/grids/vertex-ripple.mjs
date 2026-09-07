// Native vertex radii, driven by the same clock as the network shade.
import { VERTEX_SIZE_RANGE } from "./visual-options.mjs";
export { VERTEX_SIZE_RANGE };
const CELL = 128;
const WAVE_MS = 900;
const bump = (x) => Math.max(0, 1 - x * x) ** 2;

export function createVertexRipple(count, visible, upload) {
  const sizes = new Float32Array(count).fill(1);
  const next = new Float32Array(count).fill(1);
  const positions = new Float64Array(count * 2).fill(NaN);
  const cells = new Map();
  let waves = [],
    graph = [],
    previous = null,
    waveAnchor = null,
    lastWave = -Infinity,
    bound = false;

  function reset() {
    waves = [];
    graph = [];
    previous = waveAnchor = null;
    lastWave = -Infinity;
    sizes.fill(1);
    if (bound) upload(null);
    bound = false;
  }
  function visit(x, y, radius, apply) {
    for (let cy = Math.floor((y - radius) / CELL); cy <= Math.floor((y + radius) / CELL); cy++) {
      for (let cx = Math.floor((x - radius) / CELL); cx <= Math.floor((x + radius) / CELL); cx++) {
        const ids = cells.get(`${cx},${cy}`);
        if (!ids) continue;
        for (const id of ids) {
          const distance = Math.hypot(positions[id * 2] - x, positions[id * 2 + 1] - y);
          if (distance < radius) next[id] += apply(distance);
        }
      }
    }
  }
  return {
    reset,
    // Camera composition is fixed between fits. Project once, never per animation frame.
    reframe(locate, width, height) {
      reset();
      cells.clear();
      positions.fill(NaN);
      for (let id = 0; id < count; id++) {
        if (!visible[id]) continue;
        const p = locate(id);
        if (!p || !p.every(Number.isFinite) || p[0] < -240 || p[1] < -240 || p[0] > width + 240 || p[1] > height + 240) continue;
        positions[id * 2] = p[0];
        positions[id * 2 + 1] = p[1];
        const key = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(id);
      }
    },
    move(x, y, time) {
      if (previous) {
        const dt = time - previous.time;
        const distance = Math.hypot(x - previous.x, y - previous.y);
        const speed = distance / Math.max(1, dt);
        if (dt >= 160) waveAnchor = [x, y];
        const travel = Math.hypot(x - waveAnchor[0], y - waveAnchor[1]);
        if (dt > 0 && dt < 160 && travel >= 18 && speed > 0.45 && time - lastWave > 180) {
          waves.push({ x, y, time, strength: Math.min(1, speed / 1.2) });
          if (waves.length > 3) waves.shift();
          lastWave = time;
          waveAnchor = [x, y];
        }
      }
      waveAnchor ||= [x, y];
      previous = { x, y, time };
    },
    leave() {
      previous = waveAnchor = null;
    },
    pulse(distances) {
      graph = [];
      for (let id = 0; id < count; id++) {
        if (visible[id] && distances[id] >= 0 && Number.isFinite(positions[id * 2])) graph.push([id, distances[id]]);
      }
    },
    paint(host, time) {
      if (!host) {
        reset();
        return false;
      }
      next.fill(1);
      if (host[3] > 0) visit(host[0], host[1], 115, (distance) => 0.65 * host[3] * bump(distance / 115));
      waves = waves.filter((wave) => time - wave.time < WAVE_MS);
      for (const wave of waves) {
        const age = Math.max(0, time - wave.time);
        const radius = 24 + age * 0.24;
        const strength = wave.strength * (1 - age / WAVE_MS);
        visit(
          wave.x,
          wave.y,
          radius + 32,
          (distance) => strength * (0.8 * bump((distance - radius) / 32) - 0.12 * bump((distance - radius + 42) / 26))
        );
      }
      if (host[12] > 0) {
        for (const [id, hop] of graph) {
          const front = hop - host[11];
          next[id] += host[12] * Math.exp(-hop / 30) * (0.95 * bump(front / 1.4) - 0.12 * bump((front + 2) / 1.3));
        }
      }
      let changed = false,
        active = false;
      for (let id = 0; id < count; id++) {
        next[id] = Math.max(VERTEX_SIZE_RANGE[0], Math.min(VERTEX_SIZE_RANGE[1], next[id]));
        changed ||= next[id] !== sizes[id];
        active ||= next[id] !== 1;
      }
      if (changed) {
        sizes.set(next);
        upload(active ? sizes : null);
        bound = active;
      }
      return waves.length > 0;
    },
  };
}
