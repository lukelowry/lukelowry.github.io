const TRAIL_COUNT = 11;
const TRAIL_MS = 680;
const DWELL_MS = 680;
const HOP_MS = 115;
const NONE = -1e6;

// A site-authored Latkit fragment shade. Host slots 0–4 hold lighting/pulse state;
// slots 5–15 hold a short pointer history. The separate size channel shares this clock.
const wgsl = `
fn electric_pool(p: vec2f, center: vec2f, radius: f32) -> f32 {
  let q = max(0.0, 1.0 - dot(p - center, p - center) / (radius * radius));
  return q * q;
}
fn shade(f: Fragment) -> vec4f {
  let pool = electric_pool(f.px, host[0].xy, host[0].z) * host[0].w;
  let core = electric_pool(f.px, host[0].xy, 48.0) * host[0].w;
  var wake = 0.0;
  for (var i = 5u; i < 15u; i++) {
    let a = host[i];
    let b = host[i + 1u];
    if (a.w > 0.0 && b.w > 0.0) {
      let ab = b.xy - a.xy;
      let t = clamp(dot(f.px - a.xy, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0);
      let center = a.xy + ab * t;
      wake = max(wake, electric_pool(f.px, center, mix(a.z, b.z, t)) * mix(a.w, b.w, t));
    }
  }
  let charge = electric_pool(f.px, host[4].xy, 72.0) * host[3].y;
  var pulse = 0.0;
  if (f.value >= 0.0 && host[3].x > 0.0) {
    let distance = (f.value - host[2].w) / 1.15;
    pulse = exp(-distance * distance * 1.8) * host[3].x * exp(-f.value / 22.0);
  }
  let light = clamp(pool * 0.78 + core * 0.22, 0.0, 0.94);
  var color = mix(f.color.rgb, host[1].rgb, light);
  color = mix(color, host[2].rgb, clamp(wake * 0.85 + charge * 0.65 + pulse * 0.95, 0.0, 0.96));
  return vec4f(color, f.color.a);
}
`;

// Pure animation state, driven entirely by Latkit's existing render loop.
export function createElectricShade(onDwell = () => {}, paint = () => {}) {
  const history = new Float64Array(TRAIL_COUNT * 4);
  let reduced = false;
  let target = null,
    x = NONE,
    y = NONE,
    amount = 0,
    last = NaN;
  let anchorX = NONE,
    anchorY = NONE,
    dwellStart = 0,
    dwelled = true,
    canDwell = false;
  let sampleTime = -Infinity,
    pulseStart = -Infinity,
    pulseEnd = 0,
    pulseStrength = 0;
  let light = [0.035, 0.18, 0.47],
    accent = [0.0, 0.43, 0.48];
  history.fill(0);
  return {
    wgsl,
    reduced(value) {
      reduced = value;
      this.reset();
    },
    theme(dark) {
      light = dark ? [0.86, 0.95, 1.0] : [0.035, 0.18, 0.47];
      accent = dark ? [1.0, 0.82, 0.48] : [0.0, 0.43, 0.48];
    },
    move(px, py, time, dwell = true) {
      if (!target || Math.hypot(px - anchorX, py - anchorY) > 14 || dwell !== canDwell) {
        anchorX = px;
        anchorY = py;
        dwellStart = time;
        dwelled = !dwell;
      }
      canDwell = dwell;
      target = [px, py];
    },
    leave() {
      target = null;
      dwelled = true;
      canDwell = false;
    },
    reset() {
      this.leave();
      x = y = NONE;
      amount = 0;
      last = NaN;
      history.fill(0);
      sampleTime = pulseStart = -Infinity;
      pulseStrength = 0;
      paint(null);
    },
    pulse(time, max, strength = 1) {
      if (reduced) return;
      pulseStart = time;
      pulseEnd = Math.max(1200, (max + 3) * HOP_MS);
      pulseStrength = strength;
      dwelled = true;
    },
    tick(host, { timeMs }) {
      if (reduced) {
        // One immediate color highlight: no history, interpolation, size uploads,
        // dwell timer or continued frames once the pointer stops.
        host.fill(0);
        host.set([target?.[0] ?? NONE, target?.[1] ?? NONE, 190, target ? 1 : 0]);
        host.set(light, 4);
        host.set(accent, 8);
        return false;
      }
      const dt = Number.isFinite(last) ? Math.max(0, Math.min(64, timeMs - last)) : 16;
      last = timeMs;
      const easing = 1 - Math.exp(-dt / 70);
      const wanted = target ? 1 : 0;
      amount += (wanted - amount) * easing;
      if (target) {
        if (x === NONE) {
          x = target[0];
          y = target[1];
        }
        x += (target[0] - x) * easing;
        y += (target[1] - y) * easing;
        const moved = Math.hypot(x - history[0], y - history[1]);
        if (timeMs - sampleTime >= 35 && (moved > 2 || !history[3])) {
          const speed = Number.isFinite(sampleTime) ? moved / Math.max(16, timeMs - sampleTime) : 0;
          history.copyWithin(4, 0, history.length - 4);
          history[0] = x;
          history[1] = y;
          history[2] = timeMs;
          history[3] = Math.min(1, speed / 0.8);
          sampleTime = timeMs;
        }
      }
      const waiting = Boolean(target && canDwell && !dwelled);
      let charge = waiting ? Math.max(0, Math.min(1, (timeMs - dwellStart - 180) / (DWELL_MS - 180))) : 0;
      if (waiting && timeMs - dwellStart >= DWELL_MS) {
        dwelled = true;
        charge = 0;
        onDwell(anchorX, anchorY, timeMs);
      }
      const pulseAge = timeMs - pulseStart;
      const pulsing = pulseAge >= 0 && pulseAge < pulseEnd;
      host.fill(0);
      host.set([x, y, 190, amount], 0);
      host.set(light, 4);
      host.set(accent, 8);
      host[11] = pulseAge / HOP_MS;
      // Keep inactive uniforms finite even before the first pulse.
      if (!pulsing) host[11] = 0;
      host[12] = pulsing ? pulseStrength * Math.min(1, (pulseEnd - pulseAge) / 260) : 0;
      host[13] = charge;
      host[16] = anchorX;
      host[17] = anchorY;
      let trailing = false;
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const j = i * 4;
        const life = Math.max(0, 1 - (timeMs - history[j + 2]) / TRAIL_MS);
        const strength = history[j + 3] * life * life;
        host[20 + j] = history[j];
        host[21 + j] = history[j + 1];
        host[22 + j] = 34 + 36 * history[j + 3];
        host[23 + j] = strength;
        trailing ||= strength > 0;
      }
      const settled = Math.abs(wanted - amount) < 0.001 && (!target || Math.hypot(target[0] - x, target[1] - y) < 0.05);
      if (settled) {
        amount = wanted;
        host[3] = wanted;
        if (target) {
          x = target[0];
          y = target[1];
          host[0] = x;
          host[1] = y;
        }
      }
      const rippling = paint(host, timeMs);
      return Boolean(rippling || !settled || trailing || pulsing || (waiting && !dwelled));
    },
  };
}
