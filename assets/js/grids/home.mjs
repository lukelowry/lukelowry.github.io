import { voltageRGB } from "./voltage.mjs";
import { loadGrid, isDark, surfaceColor, whenAttached } from "./data.mjs";
import { RESTING_VIEW, sceneView, voltageHeights, framingBounds, framingVertices, projectedBounds } from "./framing.mjs";
import { showBackdropFallback } from "./fallback.mjs";
import { VERTEX_SIZE_RANGE } from "./visual-options.mjs";
import { mountEffectPreference } from "./effect-preference.mjs";

export function mountBackdrop(root, effects, presentation, loader) {
  const element = root.querySelector("latkit-network");
  const name = root.dataset.case;
  const view = sceneView(name);
  const track = root.closest(".grid-backdrop-track");
  let networkEffects, inspection, enhancement;
  let story = { visible: false, seam: Infinity };
  let clipHeight = 0;
  let revealSeam;
  let enhanceFrame = 0;
  let current, activation, bounds, outline;
  let shadeRevision = 0;
  let configured = false,
    ready = false,
    visible = false,
    fitting = false;
  let width = 0,
    height = 0,
    revision = 0,
    resizeTimer;

  function theme() {
    if (!current || !presentation.live) return;
    const dark = isDark();
    const maxKV = Math.max(...current.levels);
    element.network.setOptions({
      surfaceColor: surfaceColor(),
      edgeBaseColor: null,
      hoverColor: dark ? [0.8, 0.82, 1, 1] : [0.23, 0.32, 0.53, 1],
      selectedColor: dark ? [0.9, 0.85, 1, 1] : [0.17, 0.23, 0.42, 1],
      colormap: (t) => voltageRGB(t * maxKV, current.voltageColors, dark),
    });
  }

  async function lighting() {
    if (!configured || !networkEffects || root.hasAttribute("data-fallback")) return;
    const version = ++shadeRevision;
    if (!presentation.live) {
      networkEffects.enable(false);
      element.network.pause();
      root.dataset.lighting = "off";
      return;
    }
    const enabled = effects.enabled;
    try {
      networkEffects.enable(false);
      networkEffects.preset(effects.preset);
      networkEffects.mode(effects.mode);
      networkEffects.theme(isDark());
      await element.network.setShade(enabled ? networkEffects.shade : null);
      if (version === shadeRevision) {
        if (!presentation.live || root.hasAttribute("data-fallback")) return;
        if (!fitting) networkEffects.reframe();
        networkEffects.enable(enabled);
        root.dataset.lighting = enabled ? "on" : "off";
      }
    } catch {
      // Shade compilation must not take away the usable network.
      if (version === shadeRevision) {
        networkEffects.enable(false);
        root.dataset.lighting = "unavailable";
      }
    }
  }

  // Native Latkit owns continuous resize and backing-store updates. This bounded
  // adjustment only restores our custom composition after the dimensions settle.
  // It retains data, GPU buffers, selection, and the visible canvas throughout.
  async function fitScene() {
    if (!configured || fitting || !presentation.live || root.hasAttribute("data-fallback")) return;
    fitting = true;
    clearTimeout(resizeTimer);
    const version = revision;
    width = root.clientWidth;
    height = root.clientHeight;
    const network = element.network;
    network.resume();
    root.dataset.fitting = "";
    networkEffects?.reset();
    try {
      network.fit(bounds.items, false);
      network.zoomBy(view.zoom);
      network.setPose({ ...bounds.center, pitch: view.pitch, bearing: view.bearing }, false);
      await network.paint();
      const rect = root.getBoundingClientRect();
      const anchor = [rect.left + width * (view.rightEdge ?? view.leftEdge), rect.top + height * (view.anchorY ?? 0.46)];
      // Two corrections at one pose replace the former nine-pose calibration.
      for (let correction = 0; correction < 2 && version === revision; correction++) {
        const box = projectedBounds(network, outline);
        const point = [view.rightEdge ? box.right : box.left, (box.top + box.bottom) / 2];
        if (!point.every(Number.isFinite)) throw new Error("Grid framing unavailable");
        const dx = anchor[0] - point[0],
          dy = anchor[1] - point[1];
        if (Math.hypot(dx, dy) < 0.5) break;
        network.panBy(dx, dy);
        network.setPose(network.getPose(), false);
        await network.paint();
      }
      if (version === revision) {
        networkEffects?.reframe();
        root.dataset.ready = "";
        root.dataset.loaded = name;
        ready = true;
        inspection?.setReady(presentation.live);
        scheduleEnhancement();
      }
    } finally {
      fitting = false;
      root.removeAttribute("data-fitting");
      if (!visible || document.hidden) network.pause();
      if (version !== revision) scheduleFit();
    }
  }

  function scheduleFit() {
    clearTimeout(resizeTimer);
    if (!configured || !presentation.live || document.hidden || (!visible && ready)) return;
    resizeTimer = setTimeout(() => fitScene().catch(fail), 120);
  }

  function fail() {
    if (root.hasAttribute("data-fallback")) return;
    showBackdropFallback(root);
    shadeRevision++;
    cancelAnimationFrame(enhanceFrame);
    ready = false;
    revision++;
    clearTimeout(resizeTimer);
    root.removeAttribute("data-ready");
    inspection?.setReady(false);
    networkEffects?.enable(false);
  }

  function scheduleEnhancement() {
    if (!ready || !presentation.live || networkEffects || enhancement || enhanceFrame || root.hasAttribute("data-fallback")) return;
    // Yield optional setup to the next browser frame, after revealing this one.
    // This schedules work; renderer acknowledgments alone determine readiness.
    enhanceFrame = requestAnimationFrame(() => {
      enhanceFrame = 0;
      enhancement = (async () => {
        const { mountInteractions } = await import("./interactions.mjs");
        if (!presentation.live || root.hasAttribute("data-fallback")) return;
        ({ motion: networkEffects, inspection } = mountInteractions(root, current));
        inspection.update(story);
        await lighting();
        if (!root.hasAttribute("data-fallback")) inspection.setReady(ready && presentation.live);
      })()
        .catch(() => {
          root.dataset.lighting = "unavailable";
          networkEffects?.enable(false);
        })
        .finally(() => {
          enhancement = null;
        });
    });
  }

  async function activate() {
    if (activation || root.hasAttribute("data-fallback")) return activation;
    activation = (async () => {
      current = await loadGrid(root, name, loader);
      bounds = current.framing?.bounds ?? framingBounds(current);
      outline = current.framing?.outline ?? framingVertices(current);
      const domain = `0 ${Math.max(...current.levels)}`;
      element.setAttribute("vertex-color-domain", domain);
      element.setAttribute("edge-color-domain", domain);
      theme();
      element.network.setOptions({
        keyboard: false,
        focusEnabled: true,
        poles: false,
        heightScale: RESTING_VIEW.heightScale,
        heightRange: [0, 1],
        sizeRange: VERTEX_SIZE_RANGE,
        vertexScale: (name === "EuropeA" ? 0.68 : 0.53) * (current.geometryScale ?? 1),
        edgeScale: (name === "EuropeA" ? 0.48 : 0.34) * (current.geometryScale ?? 1),
      });
      // Assign the source once. Embed binds its named fields declaratively.
      element.data = {
        topology: current.topology,
        fields: [
          { id: "kv", scope: "vertex", components: 1, values: current.kv },
          { id: "branch_kv", scope: "edge", components: 1, values: current.branchKV },
          { id: "visible_vertices", scope: "vertex", components: 1, values: current.visibleVertices },
          { id: "visible_edges", scope: "edge", components: 1, values: current.visibleEdges },
          { id: "voltage_height", scope: "vertex", components: 1, values: current.voltageHeight ?? voltageHeights(current) },
        ],
      };
      await element.ready;
      await whenAttached(element);
      configured = true;
      root.dataset.voltageLevels = current.levels.join(",");
      await fitScene();
    })().catch(fail);
    return activation;
  }

  new ResizeObserver(() => {
    if (!current) return;
    if (Math.abs(root.clientWidth - width) > 1 || Math.abs(root.clientHeight - height) > 1) {
      revision++;
      scheduleFit();
    }
  }).observe(root);
  document.addEventListener("themechange", () => {
    theme();
    lighting();
  });
  effects.subscribe(lighting, true);
  presentation.subscribe(() => {
    theme();
    lighting();
    inspection?.setReady(ready && presentation.live);
    scheduleEnhancement();
  });
  element.addEventListener("error", fail);
  element.addEventListener("pipelineError", fail);
  return {
    update(state) {
      story = state;
      // Reveal geometry belongs to the visual scene, independent of interaction.
      if (state.seam !== revealSeam || innerHeight !== clipHeight) {
        revealSeam = state.seam;
        clipHeight = innerHeight;
        const before = state.seam - 36,
          after = state.seam + 36;
        track.style.setProperty("--grid-switch-before", `${before}px`);
        track.style.setProperty("--grid-switch-after", `${after}px`);
        track.style.clipPath = name === "USA" ? `inset(0 0 ${Math.max(0, innerHeight - after)}px 0)` : `inset(${Math.max(0, before)}px 0 0 0)`;
      }
      inspection?.update(state);
      const wasVisible = visible;
      visible = state.visible && !document.hidden;
      root.dataset.active = String(visible);
      if (state.preload || state.visible) activate();
      if (!current || fitting) return;
      if (visible && !wasVisible) {
        element.network.resume();
        if (!ready || Math.abs(root.clientWidth - width) > 1 || Math.abs(root.clientHeight - height) > 1) scheduleFit();
      } else if (!visible && wasVisible) {
        clearTimeout(resizeTimer);
        // Retire motion only after the reveal is fully outside the viewport.
        // Returning to the scene should never resume a stale, frozen wave.
        networkEffects?.reset();
        element.network.pause();
      }
    },
  };
}

// One scroll coordinator: fixed canvases are revealed alongside their own reading sections.
export function storyState(scroll, viewport, boundary) {
  const seam = boundary - scroll;
  return {
    seam,
    USA: { visible: seam > -36, preload: true },
    EuropeA: { visible: seam < viewport + 36, preload: scroll > 0 && seam < viewport + 300 },
  };
}

export function mountStory(roots, presentation, loader) {
  const effects = mountEffectPreference();
  const renderers = [...roots].map((root) => ({ name: root.dataset.case, renderer: mountBackdrop(root, effects, presentation, loader) }));
  const europe = document.querySelector('[data-grid-section="EuropeA"]');
  const research = document.querySelector(".home-research");
  let boundary = 0,
    measure = true,
    frame = 0;
  function draw() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!presentation.live) {
      for (const { renderer } of renderers) renderer.update({ visible: false, preload: false, seam: 0 });
      return;
    }
    if (measure) {
      boundary = scrollY + europe.getBoundingClientRect().top;
      measure = false;
    }
    const state = storyState(scrollY, innerHeight, boundary);
    // Each track owns its reveal styles; scrolling need not invalidate inherited
    // custom properties across the entire document.
    document.documentElement.dataset.gridStory = "";
    for (const { name, renderer } of renderers) {
      renderer.update({ ...state[name], seam: state.seam });
    }
  }
  function schedule() {
    if (presentation.live && !frame) frame = requestAnimationFrame(draw);
  }
  const resize = new ResizeObserver(() => {
    measure = true;
    schedule();
  });
  resize.observe(research);
  resize.observe(europe);
  resize.observe(document.querySelector(".home-intro"));
  window.addEventListener(
    "resize",
    () => {
      measure = true;
      schedule();
    },
    { passive: true }
  );
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("pageshow", () => {
    measure = true;
    schedule();
  });
  document.addEventListener("visibilitychange", draw);
  presentation.subscribe(() => {
    measure = true;
    draw();
  });
  draw();
}
