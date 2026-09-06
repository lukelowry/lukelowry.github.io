// Host policy: exposed bus/branch keyboard browsing and a quiet, pinned readout.
// Native inspect owns picking, cycling, pointer input, and page-scroll gestures.
export function mountInspection(root, { onSelect = () => {} } = {}) {
  const element = root.querySelector("latkit-network");
  const track = root.closest(".grid-backdrop-track");
  const caption = document.querySelector(`[data-grid-caption="${root.dataset.case}"]`);
  const readout = caption.querySelector(".grid-backdrop-readout");
  const clear = caption.querySelector("[data-grid-clear]");
  const help = caption.querySelector(".grid-backdrop-help");
  const status = caption.querySelector('[role="status"]');
  const forcedColors = matchMedia("(forced-colors: active)");
  const name = root.dataset.case === "EuropeA" ? "Europe" : "USA";
  let model,
    canvas,
    selected = null,
    hovered = null;
  let ready = false,
    enabled = false,
    state = { visible: false, seam: Infinity };
  const touches = new Set();
  let multiTouch = false,
    interaction;
  let browsing = 0;
  let lastReadout = "";
  let busCursor = -1,
    branchCursor = -1;

  function describe(item) {
    if (item.kind === "vertex") return `Bus ${model.numbers[item.index]} \u00b7 ${model.kv[item.index]} kV`;
    const a = model.topology.edges[item.index * 2];
    const b = model.topology.edges[item.index * 2 + 1];
    return `Branch ${model.numbers[a]} \u2013 ${model.numbers[b]} \u00b7 ${model.branchKV[item.index]} kV`;
  }

  function positionCaption() {
    if (caption.hidden) return;
    const bottom = root.getBoundingClientRect().bottom;
    // Keep arithmetic out of CSS var()/calc(): the legacy minifier corrupts it.
    document.documentElement.style.setProperty("--grid-caption-padding", `${caption.offsetHeight + 16}px`);
    document.documentElement.style.setProperty("--grid-caption-clearance", `${caption.offsetHeight + 24}px`);
    caption.style.top = `${Math.max(80, Math.min(bottom, innerHeight - caption.offsetHeight - 12))}px`;
  }

  function show() {
    const item = selected || hovered;
    const text = `${name} \u00b7 ${item ? describe(item) : "Hover or select a bus or branch."}${selected ? " \u00b7 Selected" : ""}`;
    if (text !== lastReadout) {
      readout.textContent = text;
      lastReadout = text;
    }
    clear.hidden = !selected;
    positionCaption();
  }

  function clearHover() {
    const changed = hovered !== null;
    hovered = null;
    element.network.setPointer(null);
    // network 0.9.0 does not wake on an empty-space leave; resume its existing
    // loop once so a settled light can fade even when no bus was hovered.
    if (enabled && !document.hidden) element.network.resume();
    if (changed) show();
  }

  function select(item, native = false) {
    selected = item;
    hovered = null;
    if (!native) element.network.select(item);
    if (item?.kind === "vertex") busCursor = item.index;
    if (item?.kind === "edge") branchCursor = item.index;
    status.textContent = item ? `${name}. ${describe(item)}. Selected.` : `${name} selection cleared.`;
    onSelect(item);
    show();
  }

  function availability() {
    const dominant = root.dataset.case === "USA" ? state.seam > innerHeight / 2 : state.seam <= innerHeight / 2;
    const next = ready && state.visible && dominant && !document.hidden && !forcedColors.matches;
    if (next !== enabled) {
      enabled = next;
      if (!enabled) {
        browsing++;
        clearHover();
        help.hidden = true;
        // Do not leave focus inside content that is becoming inert.
        if (document.activeElement === element || caption.contains(document.activeElement)) {
          document.querySelector("#main-content").focus({ preventScroll: true });
        }
      }
    }
    syncInteraction();
    track.inert = !enabled;
    track.setAttribute("aria-hidden", String(!enabled));
    root.toggleAttribute("data-inspectable", enabled);
    caption.hidden = !enabled;
    if (!document.querySelector(".grid-backdrop-caption:not([hidden])")) {
      document.documentElement.style.removeProperty("--grid-caption-padding");
      document.documentElement.style.removeProperty("--grid-caption-clearance");
    }
    if (canvas) canvas.tabIndex = enabled ? 0 : -1;
    positionCaption();
  }

  function containsPoint(point) {
    if (!point) return false;
    const rect = root.getBoundingClientRect();
    const [x, y] = point;
    if (x < Math.max(8, rect.left + rect.width * 0.02) || x > Math.min(innerWidth - 8, rect.right - rect.width * 0.02)) return false;
    if (y < Math.max(80, rect.top) || y > Math.min(innerHeight - 12, rect.bottom)) return false;
    if (root.dataset.case === "USA" ? y > state.seam - 36 : y < state.seam + 36) return false;
    // Text, links, navigation, and the label own their pixels, including on narrow screens.
    return document.elementFromPoint(x, y) === element;
  }

  async function browse(kind, direction) {
    const version = ++browsing;
    const mask = kind === "vertex" ? model.visibleVertices : model.visibleEdges;
    let index = kind === "vertex" ? busCursor : branchCursor;
    if (index < 0) index = direction > 0 ? -1 : 0;
    for (let count = 0; count < mask.length; count++) {
      if (count && count % 128 === 0) {
        await new Promise(requestAnimationFrame);
        if (!enabled || browsing !== version) return;
      }
      index = (index + direction + mask.length) % mask.length;
      if (!mask[index]) continue;
      const item = { kind, index };
      if (!containsPoint(element.network.locate(item))) continue;
      select(item);
      return;
    }
    status.textContent = `No ${kind === "vertex" ? "buses" : "branches"} in the exposed part of the network. Scroll to reveal more.`;
  }

  element.addEventListener("hover", (event) => {
    if (!enabled || (hovered?.kind === event.detail?.kind && hovered?.index === event.detail?.index)) return;
    hovered = event.detail;
    show(); // Hover stays quiet; only deliberate selection updates the live region.
  });
  element.addEventListener("select", (event) => {
    if (enabled && !multiTouch) select(event.detail, true);
  });
  element.addEventListener("pointerleave", clearHover);

  function syncInteraction() {
    if (!canvas) return;
    const next = enabled && !multiTouch ? "inspect" : "none";
    if (next === interaction) return;
    interaction = next;
    element.network.setOptions({ interaction });
  }
  // Native inspect currently keeps a pending tap when a second contact joins.
  // Watch the whole page: the second finger may land outside the canvas.
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch") return;
      touches.add(event.pointerId);
      if (touches.size > 1) {
        multiTouch = true;
        if (canvas) clearHover();
        syncInteraction();
      }
    },
    { capture: true, passive: true }
  );
  function endTouch(event) {
    touches.delete(event.pointerId);
    if (!touches.size) {
      multiTouch = false;
      syncInteraction();
    }
  }
  for (const type of ["pointerup", "pointercancel"]) window.addEventListener(type, endTouch, { capture: true, passive: true });
  function resetPointers() {
    touches.clear();
    multiTouch = false;
    if (canvas) clearHover();
    syncInteraction();
  }
  element.addEventListener(
    "keydown",
    (event) => {
      if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return;
      help.hidden = false;
      positionCaption();
      const keys = { ArrowLeft: ["vertex", -1], ArrowRight: ["vertex", 1], ArrowUp: ["edge", -1], ArrowDown: ["edge", 1] };
      if (event.key === "Escape" || keys[event.key]) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          clearHover();
          select(null);
        } else browse(...keys[event.key]);
      }
    },
    true
  );
  element.addEventListener("focusin", () => {
    help.hidden = !canvas.matches(":focus-visible");
    positionCaption();
  });
  element.addEventListener("focusout", () => {
    browsing++;
    help.hidden = true;
    positionCaption();
  });
  clear.addEventListener("click", () => {
    canvas.focus({ preventScroll: true });
    clearHover();
    select(null);
  });
  caption.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      canvas.focus({ preventScroll: true });
      clearHover();
      select(null);
    }
  });
  new ResizeObserver(positionCaption).observe(caption);
  forcedColors.addEventListener("change", availability);
  window.addEventListener("blur", resetPointers);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetPointers();
    availability();
  });

  return {
    attach(data) {
      model = data;
      canvas = element.shadowRoot.querySelector("canvas");
      // A 10px mouse probe swallows nearby branches in the compact USA grid.
      // Keep precision for mouse/pen; taps retain a 22px radius and keyboard access.
      element.network.setOptions({ keyboard: false, pickRadiusPx: 4 });
      element.removeAttribute("tabindex");
      canvas.setAttribute("aria-description", help.textContent);
      element.setAttribute("aria-label", `${name} network. Select buses or branches.`);
      show();
      availability();
    },
    setReady(value) {
      ready = value;
      availability();
    },
    update(next) {
      if (next.seam !== state.seam && canvas) {
        browsing++;
        clearHover();
      }
      state = next;
      // CSS masks do not constrain hit testing. Clip at the fully opaque side of the seam.
      const inset =
        root.dataset.case === "USA"
          ? `inset(0 0 ${Math.max(0, innerHeight - state.seam + 36)}px 0)`
          : `inset(${Math.max(0, state.seam + 36)}px 0 0 0)`;
      track.style.clipPath = inset;
      availability();
    },
  };
}
