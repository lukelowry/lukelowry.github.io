import { createSpringField, CELL } from "./spring-field.mjs";

// Signed strain from the same elastic field colors the network's compression
// and release. No separate cursor artwork or independently timed color waves.
export const springWGSL = `
fn shade(f: Fragment) -> vec4f {
  let d = f.px - host[0].xy;
  let q = max(0.0, 1.0-dot(d,d)/(190.0*190.0));
  let pool = q*q*host[0].w;
  var color=mix(f.color.rgb,host[1].rgb,clamp(pool*0.5+max(0.0,-f.value)*0.8,0.0,0.9));
  color=mix(color,host[2].rgb,clamp(max(0.0,f.value)*1.4,0.0,0.96));
  return vec4f(color,f.color.a);
}
`;
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export function createSpringWave(model, upload) {
  const rest = model.topology.vertexCoords,
    count = model.topology.vertexCount;
  const positions = new Float32Array(rest);
  const vertexShade = new Float32Array(count),
    edgeShade = new Float32Array(model.topology.edges.length / 2);
  const pixels = new Float64Array(count * 2).fill(NaN);
  const samples = [],
    edges = [];
  const limit = model.topology.polylinePoints?.length ? 5 : 9;
  let field,
    scaleX = 0,
    scaleY = 0,
    last = NaN,
    frozen = false;
  let target = null,
    pointer = null,
    entry = Infinity,
    pluck = null;
  let positionBound = false,
    shadeBound = false;
  const pointerForce = { x: 0, y: 0, fx: 0, fy: 0, radial: 0, radius: 150 };
  const pluckForce = { x: 0, y: 0, fx: 0, fy: 0, radial: 0, radius: 170 };
  const forces = [];
  function clearChannels() {
    if (!positionBound && !shadeBound) return;
    if (positionBound) upload("vertexPosition", null);
    if (shadeBound) {
      upload("vertexShade", null);
      upload("edgeShade", null);
    }
    positionBound = shadeBound = false;
    positions.set(rest);
    vertexShade.fill(0);
    edgeShade.fill(0);
  }
  function reset() {
    target = pointer = pluck = null;
    entry = Infinity;
    last = NaN;
    frozen = false;
    field?.reset();
    clearChannels();
  }
  function drive(dt) {
    forces.length = 0;
    if (pointer) {
      const ease = 1 - Math.exp(-dt / 0.055);
      const dx = target ? (target.x - pointer.x) * ease : 0,
        dy = target ? (target.y - pointer.y) * ease : 0;
      pointer.x += dx;
      pointer.y += dy;
      const follow = 1 - Math.exp(-dt / 0.045);
      pointer.vx += (dx / dt - pointer.vx) * follow;
      pointer.vy += (dy / dt - pointer.vy) * follow;
      const speed = Math.hypot(pointer.vx, pointer.vy);
      const gain = speed ? (1200 * Math.tanh(speed / 1200)) / speed : 1;
      entry += dt;
      pointerForce.x = pointer.x;
      pointerForce.y = pointer.y;
      pointerForce.fx = pointer.vx * gain * 2.5;
      pointerForce.fy = pointer.vy * gain * 2.5;
      pointerForce.radial = entry < 0.3 ? 2100 * Math.sin((Math.PI * entry) / 0.3) ** 2 : 0;
      if (speed > 0.05 || pointerForce.radial > 0) forces.push(pointerForce);
    }
    if (pluck) {
      pluck.age += dt;
      if (pluck.age >= 0.36) pluck = null;
      else {
        pluckForce.x = pluck.x;
        pluckForce.y = pluck.y;
        pluckForce.radial = 3500 * pluck.strength * Math.sin((Math.PI * pluck.age) / 0.36) ** 2;
        forces.push(pluckForce);
      }
    }
    return forces;
  }
  return {
    reset,
    topologyPulse: false,
    reframe(locate, width, height) {
      reset();
      samples.length = edges.length = 0;
      pixels.fill(NaN);
      field = createSpringField(width, height);
      const extremes = [-1, -1, -1, -1];
      for (let id = 0; id < count; id++) {
        if (!model.visibleVertices[id]) continue;
        const p = locate(id);
        if (!p || !p.every(Number.isFinite)) continue;
        pixels[id * 2] = p[0];
        pixels[id * 2 + 1] = p[1];
        for (let axis = 0; axis < 2; axis++) {
          const low = extremes[axis * 2],
            high = extremes[axis * 2 + 1];
          if (low < 0 || p[axis] < pixels[low * 2 + axis]) extremes[axis * 2] = id;
          if (high < 0 || p[axis] > pixels[high * 2 + axis]) extremes[axis * 2 + 1] = id;
        }
        const sample = field.sampleAt(...p);
        if (!sample) continue;
        samples.push({ id, ...sample });
      }
      const scale = (axis) => {
        const a = extremes[axis * 2],
          b = extremes[axis * 2 + 1];
        const span = pixels[b * 2 + axis] - pixels[a * 2 + axis];
        return a < 0 || b < 0 || span < 1 ? 0 : (rest[b * 2 + axis] - rest[a * 2 + axis]) / span;
      };
      scaleX = scale(0);
      scaleY = scale(1);
      for (let id = 0; id < edgeShade.length; id++)
        if (model.visibleEdges?.[id] ?? true) edges.push({ id, a: model.topology.edges[id * 2], b: model.topology.edges[id * 2 + 1] });
    },
    move(x, y) {
      if (frozen) return;
      const entering = target === null;
      target = { x, y };
      if (!pointer || entering) {
        pointer = { x, y, vx: 0, vy: 0 };
        entry = 0;
      }
    },
    leave() {
      target = null;
    },
    press() {
      frozen = true;
      // A just-restored position channel also needs one native settling frame.
      return true;
    },
    release() {
      frozen = false;
      last = NaN;
    },
    pulse(distances, item, time, strength) {
      const id = item.kind === "vertex" ? item.index : model.topology.edges[item.index * 2];
      if (Number.isFinite(pixels[id * 2])) pluck = { x: pixels[id * 2], y: pixels[id * 2 + 1], age: 0, strength };
    },
    paint(host, time) {
      if (!host) {
        reset();
        return false;
      }
      if (frozen || !field) return false;
      const dt = Number.isFinite(last) ? Math.max(0.001, Math.min(0.048, (time - last) / 1000)) : 1 / 60;
      last = time;
      field.advance(dt, drive);
      const inputMoving =
        pointer && (Math.hypot(pointer.vx, pointer.vy) > 0.05 || (target && Math.hypot(target.x - pointer.x, target.y - pointer.y) > 0.01));
      if (field.resting && !inputMoving && entry >= 0.3 && !pluck) {
        field.reset();
        clearChannels();
        last = NaN;
        if (!target) pointer = null;
        return false;
      }
      let moved = false,
        colored = false,
        active = false;
      const x = field.x,
        y = field.y,
        stride = field.columns;
      for (const { id, k, tx, ty } of samples) {
        const a = k,
          b = k + 1,
          c = k + stride,
          d = c + 1;
        const dx = (x[a] * (1 - tx) + x[b] * tx) * (1 - ty) + (x[c] * (1 - tx) + x[d] * tx) * ty;
        const dy = (y[a] * (1 - tx) + y[b] * tx) * (1 - ty) + (y[c] * (1 - tx) + y[d] * tx) * ty;
        const length = Math.hypot(dx, dy),
          cap = length ? (limit * Math.tanh(length / limit)) / length : 1;
        const alive = length * cap >= 0.008 && scaleX !== 0 && scaleY !== 0;
        const px = Math.fround(rest[id * 2] + (alive ? dx * cap * scaleX : 0)),
          py = Math.fround(rest[id * 2 + 1] + (alive ? dy * cap * scaleY : 0));
        const strain = ((x[b] - x[a]) * (1 - ty) + (x[d] - x[c]) * ty + (y[c] - y[a]) * (1 - tx) + (y[d] - y[b]) * tx) / CELL;
        const color = Math.fround(Math.abs(strain) > 0.00005 ? clamp(strain * 8, 1) : 0);
        moved ||= positions[id * 2] !== px || positions[id * 2 + 1] !== py;
        colored ||= vertexShade[id] !== color;
        positions[id * 2] = px;
        positions[id * 2 + 1] = py;
        vertexShade[id] = color;
        active ||= alive;
      }
      if (moved || (positionBound && !active)) {
        upload("vertexPosition", active ? positions : null);
        positionBound = active;
      }
      if (colored) {
        for (const { id, a, b } of edges) edgeShade[id] = (vertexShade[a] + vertexShade[b]) / 2;
        upload("vertexShade", vertexShade);
        upload("edgeShade", edgeShade);
        shadeBound = true;
      }
      return true;
    },
  };
}
