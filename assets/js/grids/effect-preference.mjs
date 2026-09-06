const storageKey = "grid-effects";
export const effectsEnabled = (choice) => choice !== "off";

// Pointer-driven network effects start enabled; an explicit pause is remembered.
export function mountEffectPreference() {
  const listeners = new Set();
  const controls = [...document.querySelectorAll("[data-grid-effects-controls]")];
  let choice = null;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "on" || stored === "off") choice = stored;
  } catch {
    /* The setting still works for this visit when storage is blocked. */
  }
  const current = () => effectsEnabled(choice);
  function update() {
    const enabled = current();
    document.documentElement.dataset.gridEffects = enabled ? "on" : "off";
    for (const group of controls) {
      group.hidden = false;
      group.querySelector("[data-grid-effects-toggle]").textContent = enabled ? "Pause effects" : "Enable effects";
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
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = event.newValue === "on" || event.newValue === "off" ? event.newValue : null;
    update();
  });
  const url = new URL(location.href);
  const requested = url.searchParams.get("effects");
  if ((location.hostname === "localhost" || location.hostname === "127.0.0.1") && ["on", "off", "default"].includes(requested)) {
    choose(requested === "default" ? null : requested);
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
