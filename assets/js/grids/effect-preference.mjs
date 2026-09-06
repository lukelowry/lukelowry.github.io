const storageKey = "grid-effects";
export const effectsEnabled = (choice, reduced) => choice === "on" || (choice !== "off" && !reduced);

// Follow the OS by default. A deliberate site-level choice overrides both the JS and CSS gates.
export function mountEffectPreference() {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const listeners = new Set();
  const controls = [...document.querySelectorAll("[data-grid-effects-controls]")];
  let choice = null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "on" || stored === "off") choice = stored;
  } catch {
    /* The setting still works for this visit when storage is blocked. */
  }
  const current = () => effectsEnabled(choice, motion.matches);
  function update() {
    const enabled = current();
    document.documentElement.dataset.gridEffects = enabled ? "on" : "off";
    for (const group of controls) {
      group.hidden = false;
      group.querySelector("[data-grid-effects-toggle]").textContent = enabled ? "Pause effects" : "Enable effects";
      group.querySelector("[data-grid-effects-note]").textContent =
        !enabled && choice === null && motion.matches ? "Paused by your system's motion setting." : "";
      group.querySelector("[data-grid-effects-system]").hidden = choice === null;
    }
    for (const listener of listeners) listener();
  }
  function choose(value) {
    choice = value;
    try {
      if (choice === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, choice);
    } catch {
      /* Keep the explicit choice in memory. */
    }
    update();
  }
  for (const group of controls) {
    group.querySelector("[data-grid-effects-toggle]").addEventListener("click", () => choose(current() ? "off" : "on"));
    group.querySelector("[data-grid-effects-system]").addEventListener("click", () => {
      group.querySelector("[data-grid-effects-toggle]").focus();
      choose(null);
    });
  }
  motion.addEventListener("change", update);
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = event.newValue === "on" || event.newValue === "off" ? event.newValue : null;
    update();
  });
  // An explicit preview link lets the site owner opt in in their regular browser.
  const url = new URL(location.href);
  const requested = url.searchParams.get("effects");
  if ((location.hostname === "localhost" || location.hostname === "127.0.0.1") && ["on", "off", "system"].includes(requested)) {
    choose(requested === "system" ? null : requested);
    url.searchParams.delete("effects");
    history.replaceState(history.state, "", url);
  } else update();
  return {
    get enabled() {
      return current();
    },
    subscribe(listener) {
      listeners.add(listener);
    },
  };
}
