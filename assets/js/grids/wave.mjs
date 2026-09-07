import { mountEffectPreference } from "./effect-preference.mjs";
import { adjacency, createWave } from "./signal.mjs";
import { loadUSA, isDark, surfaceColor, ramp, whenAttached } from "./data.mjs";

export function mountWave(root, presentation) {
  const effects = mountEffectPreference();
  const element = root.querySelector("latkit-network");
  const inspection = root.querySelector(".grid-inspection");
  const play = root.querySelector('[data-action="play"]');
  const fullscreen = root.querySelector('[data-action="fullscreen"]');
  const form = root.querySelector(".grid-bus-picker");
  const busNumber = form.elements.bus;
  const status = root.querySelector(".grid-status");
  const help = root.querySelector(".grid-keyboard-help");
  const busIndices = new Map();
  let failed = false;
  let current,
    graph,
    wave,
    source = 0,
    activation,
    attached = false,
    visible = false;
  let wanted = effects.mode === "full",
    frameId = 0,
    previous = 0,
    elapsed = 4;
  function controls() {
    root.querySelectorAll(".grid-wave-controls button, .grid-wave-controls input").forEach((button) => {
      button.disabled = !attached || !current;
    });
    play.textContent = wanted ? "Pause" : "Play";
    play.setAttribute("aria-label", wanted ? "Pause animation" : "Play animation");
    help.hidden = !attached || !current;
    fullscreen.hidden = !attached || !document.fullscreenEnabled;
  }
  function theme() {
    if (!current || !presentation.live) return;
    element.network.setOptions({
      surfaceColor: surfaceColor(),
      edgeBaseColor: null,
      colormap: ramp(isDark() ? ["#a293e2", "#476c79", "#60d3ba"] : ["#7161ac", "#9db5bd", "#127f84"]),
      hoverColor: isDark() ? [0.8, 0.82, 1, 1] : [0.23, 0.32, 0.53, 1],
      selectedColor: isDark() ? [0.8, 0.82, 1, 1] : [0.23, 0.32, 0.53, 1],
    });
  }
  document.addEventListener("themechange", theme);
  const canAnimate = () => presentation.live && wanted && visible && !document.hidden && attached && current;
  function schedule() {
    if (canAnimate() && !frameId) frameId = requestAnimationFrame(frame);
    if (!canAnimate()) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previous = 0;
    }
  }
  function signal() {
    element.network.setChannel("vertexColor", wave.frame(elapsed), [-1, 1]);
    element.network.setChannel("vertexSize", wave.amplitudes, [0, 1]);
  }
  function frame(now) {
    frameId = 0;
    if (!canAnimate()) return;
    if (previous) elapsed += Math.min((now - previous) / 1000, 0.1);
    previous = now;
    try {
      signal();
    } catch {
      fail();
      return;
    }
    schedule();
  }
  function fail() {
    if (failed) return;
    failed = true;
    const hadFocus = root.contains(document.activeElement);
    attached = false;
    controls();
    if (current) {
      try {
        element.network.detach();
      } catch {
        /* Preserve the static poster on device loss. */
      }
    }
    root.removeAttribute("data-ready");
    root.dataset.fallback = "";
    status.textContent = "Interactive view unavailable. Static view shown.";
    inspection.hidden = true;
    if (hadFocus) root.querySelector(".grid-data-link").focus();
    schedule();
  }
  async function activate() {
    if (!presentation.live) return;
    if (activation) return activation;
    activation = (async () => {
      status.textContent = "Loading interactive view.";
      current = await loadUSA(root);
      current.numbers.forEach((number, index) => {
        if (current.visibleVertices[index]) busIndices.set(String(number), index);
      });
      graph = adjacency(current.topology.vertexCount, current.topology.edges);
      let best = Infinity;
      for (let i = 0; i < current.topology.vertexCount; i++) {
        if (!current.visibleVertices[i] || graph.starts[i + 1] - graph.starts[i] < 2) continue;
        const distance = (current.topology.vertexCoords[i * 2] + 97) ** 2 + (current.topology.vertexCoords[i * 2 + 1] - 38) ** 2;
        if (distance < best) {
          best = distance;
          source = i;
        }
      }
      wave = createWave(graph, source);
      element.data = { topology: current.topology };
      await element.ready;
      await whenAttached(element);
      if (failed) return;
      element.shadowRoot.querySelector("canvas").setAttribute("aria-description", help.textContent);
      element.network.setChannel("edgeVisible", current.visibleEdges);
      element.network.setChannel("vertexVisible", current.visibleVertices);
      element.network.setOptions({ heightScale: 0, sizeRange: [0.65, 2.5], vertexScale: 0.54, edgeScale: 0.32 });
      theme();
      signal();
      attached = element.network.attached;
      root.dataset.loaded = "USA";
      root.dataset.ready = "";
      controls();
      status.textContent = "";
      if (!presentation.live) element.network.pause();
      schedule();
    })().catch(fail);
    return activation;
  }
  play.addEventListener("click", () => {
    wanted = !wanted;
    controls();
    schedule();
  });
  root.querySelector('[data-action="reset"]').addEventListener("click", () => {
    element.network.fit(false);
    element.network.select(null);
    wave = createWave(graph, source);
    elapsed = 4;
    clearSelection();
    signal();
  });
  for (const [action, factor] of [
    ["zoom-in", 1.2],
    ["zoom-out", 1 / 1.2],
  ]) {
    root.querySelector(`[data-action="${action}"]`).addEventListener("click", () => element.network.zoomBy(factor));
  }
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      /* Keep the inline view when fullscreen is declined. */
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement === root ? "Exit fullscreen" : "Fullscreen";
    fullscreen.focus();
  });
  element.addEventListener("attached", () => {
    if (failed) return;
    attached = element.network.attached;
    controls();
    schedule();
  });
  element.addEventListener("error", fail);
  function clearSelection() {
    inspection.hidden = true;
    busNumber.value = "";
    busNumber.removeAttribute("aria-invalid");
    busNumber.setCustomValidity("");
    status.textContent = "Selection cleared.";
  }
  function selectBus(index) {
    wave = createWave(graph, index);
    elapsed = 4;
    signal();
    busNumber.value = String(current.numbers[index]);
    busNumber.removeAttribute("aria-invalid");
    busNumber.setCustomValidity("");
    inspection.textContent = `Bus ${current.numbers[index]}`;
    inspection.hidden = false;
    status.textContent = `Bus ${current.numbers[index]}. ${current.kv[index]} kV. ${graph.starts[index + 1] - graph.starts[index]} connections.`;
  }
  element.addEventListener("select", (event) => {
    const item = event.detail;
    if (!current || !attached) return;
    if (item == null) {
      clearSelection();
      return;
    }
    if (item.kind === "vertex" && current.visibleVertices[item.index]) selectBus(item.index);
  });
  busNumber.addEventListener("input", () => {
    busNumber.setCustomValidity("");
    busNumber.removeAttribute("aria-invalid");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!attached || !current) return;
    const index = busIndices.get(String(Number(busNumber.value.trim())));
    if (index === undefined) {
      const message = "Enter a bus number in the visible network.";
      busNumber.setCustomValidity(message);
      busNumber.setAttribute("aria-invalid", "true");
      status.textContent = message;
      busNumber.reportValidity();
      return;
    }
    element.network.select({ kind: "vertex", index });
    selectBus(index);
  });
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) activate();
      schedule();
    },
    { threshold: 0 }
  ).observe(root);
  document.addEventListener("visibilitychange", schedule);
  presentation.subscribe(() => {
    if (presentation.live) {
      theme();
      if (attached) element.network.resume();
      if (visible) activate();
    } else if (attached) element.network.pause();
    schedule();
  });
  effects.subscribe(() => {
    if (effects.mode !== "full") {
      wanted = false;
      controls();
      schedule();
    }
  });
  window.addEventListener("pagehide", () => {
    visible = false;
    schedule();
  });
  window.addEventListener("pageshow", () => {
    const rect = root.getBoundingClientRect();
    visible = rect.bottom > 0 && rect.top < innerHeight;
    schedule();
  });
  controls();
}
