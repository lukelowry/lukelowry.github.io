import { createPulseField } from "./pulse.mjs";
import { createNetworkEffect } from "./effect-presets.mjs";
import { VERTEX_SIZE_RANGE } from "./vertex-ripple.mjs";

// Input, native picking and lifecycle are shared; each preset owns its channels.
export function mountNetworkEffects(root) {
  const element = root.querySelector("latkit-network");
  let field,
    effect,
    model,
    preset = "spring",
    enabled = false,
    mode = "full",
    rect,
    buttons = 0,
    pulseBound = false;
  const available = () => enabled && root.hasAttribute("data-inspectable") && !root.hasAttribute("data-fitting") && !document.hidden;
  const wake = () => {
    if (available()) element.network.resume();
  };
  function launch(item, time = performance.now(), strength = 1) {
    if (!available() || mode !== "full") return;
    if (effect?.topologyPulse === false) {
      effect.pulse(null, item, time, strength);
      wake();
      return;
    }
    field ||= createPulseField(model);
    const values = field.from(item);
    if (!values) return;
    element.network.setChannel("vertexShade", values.vertices);
    element.network.setChannel("edgeShade", values.branches);
    pulseBound = true;
    effect?.pulse(values.vertices, item, time, strength);
    effect?.shade.pulse(time, values.max, strength);
    wake();
  }
  function dwell(x, y, time) {
    if (!available() || buttons || !rect) return;
    const px = x + rect.left,
      py = y + rect.top;
    if (document.elementFromPoint(px, py) !== element) return;
    const source = element.network.hitTest(px, py, 28).find((item) => item.kind === "vertex") ?? effect?.nearest?.(x, y, 28);
    if (source) launch(source, time, 0.78);
  }
  function create() {
    effect = createNetworkEffect(preset, {
      model,
      onDwell: dwell,
      upload: (channel, values) => element.network.setChannel(channel, values, channel === "vertexSize" ? VERTEX_SIZE_RANGE : undefined),
    });
  }
  function reframe() {
    effect?.shade.reset();
    rect = root.getBoundingClientRect();
    effect?.reframe(
      (index) => {
        const point = element.network.locate({ kind: "vertex", index });
        return point && [point[0] - rect.left, point[1] - rect.top];
      },
      rect.width,
      rect.height
    );
  }
  function clearPulse() {
    if (!pulseBound) return;
    element.network.setChannel("vertexShade", null);
    element.network.setChannel("edgeShade", null);
    pulseBound = false;
  }
  function reset() {
    buttons = 0;
    effect?.shade.reset();
    clearPulse();
    rect = null;
    wake();
  }
  // Visual input can cross the reading column; native picking still belongs to the canvas.
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch" || !available()) return;
      if (event.target.closest?.(".accessibility")) {
        effect?.shade.leave();
        effect?.leave();
        wake();
        return;
      }
      rect ||= root.getBoundingClientRect();
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      if (x < -190 || y < 0 || x > rect.width + 190 || y > rect.height) {
        effect?.shade.leave();
        effect?.leave();
      } else {
        const time = performance.now();
        effect?.shade.move(x, y, time, !event.buttons && document.elementFromPoint(event.clientX, event.clientY) === element);
        if (mode === "full" && !event.buttons) effect?.move(x, y, time);
      }
      wake();
    },
    { passive: true }
  );
  window.addEventListener(
    "pointerdown",
    (event) => {
      buttons = event.buttons;
      if (event.pointerType === "touch") reset();
      else {
        effect?.shade.leave();
        effect?.leave();
        wake();
      }
    },
    { passive: true }
  );
  window.addEventListener(
    "pointerup",
    () => {
      buttons = 0;
    },
    { passive: true }
  );
  window.addEventListener("pointercancel", reset, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => {
    effect?.shade.leave();
    effect?.leave();
    wake();
  });
  for (const type of ["blur", "pagehide", "resize", "scroll"]) window.addEventListener(type, reset, { passive: true });
  document.addEventListener("visibilitychange", reset);
  return {
    reset,
    press() {
      return available() && mode === "full" ? effect?.press?.() || false : false;
    },
    release() {
      effect?.release?.();
      wake();
    },
    get shade() {
      return effect?.shade;
    },
    attach(data) {
      model = data;
      create();
    },
    preset(value) {
      if (value === preset) return;
      effect?.shade.reset();
      clearPulse();
      preset = value;
      if (model) {
        create();
        reframe();
      }
    },
    reframe,
    mode(value) {
      mode = value;
      effect?.shade.reduced(value === "reduced");
    },
    enable(value) {
      enabled = value;
      reset();
    },
    theme(dark) {
      effect?.shade.theme(dark);
      wake();
    },
    select(item) {
      if (item) launch(item);
      else reset();
    },
  };
}
