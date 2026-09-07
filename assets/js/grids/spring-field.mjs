// A small elastic sheet in CSS pixels. Its cost depends on viewport area,
// not the number of network vertices. A damped boundary absorbs outgoing waves.
export const CELL = 24;
const PAD = 216;
const SPEED = 320;
const RESTORING = 36;
const STEP = 1 / 128;
export function createSpringField(width, height) {
  const columns = Math.ceil((width + PAD * 2) / CELL) + 1;
  const rows = Math.ceil((height + PAD * 2) / CELL) + 1;
  const count = columns * rows;
  let x = new Float32Array(count),
    y = new Float32Array(count);
  let nextX = new Float32Array(count),
    nextY = new Float32Array(count);
  const vx = new Float32Array(count),
    vy = new Float32Array(count);
  const damping = Float32Array.from({ length: count }, (_, i) => {
    const col = i % columns,
      row = Math.floor(i / columns);
    return 7.2 + 14 * Math.max(0, 1 - Math.min(col, row, columns - 1 - col, rows - 1 - row) / 4) ** 2;
  });
  let amplitude = 0,
    speed = 0;
  const stiffness = (SPEED * SPEED) / (CELL * CELL);
  function reset() {
    x.fill(0);
    y.fill(0);
    nextX.fill(0);
    nextY.fill(0);
    vx.fill(0);
    vy.fill(0);
    amplitude = speed = 0;
  }
  return {
    reset,
    get x() {
      return x;
    },
    get y() {
      return y;
    },
    get resting() {
      return amplitude < 0.008 && speed < 0.025;
    },
    sampleAt(px, py) {
      const gx = (px + PAD) / CELL,
        gy = (py + PAD) / CELL;
      const cx = Math.floor(gx),
        cy = Math.floor(gy);
      if (cx < 0 || cy < 0 || cx >= columns - 1 || cy >= rows - 1) return null;
      return { k: cy * columns + cx, tx: gx - cx, ty: gy - cy };
    },
    columns,
    advance(elapsed, drive) {
      const steps = Math.max(1, Math.ceil(elapsed / STEP)),
        dt = elapsed / steps;
      for (let step = 0; step < steps; step++) {
        const force = drive(dt);
        amplitude = speed = 0;
        for (let row = 1; row < rows - 1; row++)
          for (let col = 1; col < columns - 1; col++) {
            const k = row * columns + col;
            let fx = 0,
              fy = 0;
            for (const source of force) {
              const dx = col * CELL - PAD - source.x,
                dy = row * CELL - PAD - source.y;
              const distanceSquared = dx * dx + dy * dy;
              if (distanceSquared >= source.radius * source.radius) continue;
              const r = Math.sqrt(distanceSquared) / source.radius;
              // Compact C2 kernel: forcing and its slope vanish at the boundary.
              const weight = (1 - r) ** 4 * (1 + 4 * r);
              const radial = source.radial / Math.sqrt(distanceSquared + 24 * 24);
              fx += weight * (source.fx + dx * radial);
              fy += weight * (source.fy + dy * radial);
            }
            const decay = 1 / (1 + damping[k] * dt);
            vx[k] = (vx[k] + dt * (stiffness * (x[k - 1] + x[k + 1] + x[k - columns] + x[k + columns] - 4 * x[k]) - RESTORING * x[k] + fx)) * decay;
            vy[k] = (vy[k] + dt * (stiffness * (y[k - 1] + y[k + 1] + y[k - columns] + y[k + columns] - 4 * y[k]) - RESTORING * y[k] + fy)) * decay;
            nextX[k] = x[k] + dt * vx[k];
            nextY[k] = y[k] + dt * vy[k];
            amplitude = Math.max(amplitude, Math.abs(nextX[k]), Math.abs(nextY[k]));
            speed = Math.max(speed, Math.abs(vx[k]), Math.abs(vy[k]));
          }
        [x, nextX] = [nextX, x];
        [y, nextY] = [nextY, y];
      }
    },
  };
}
