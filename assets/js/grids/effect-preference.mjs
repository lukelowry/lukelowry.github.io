export const effectsEnabled = (choice) => choice !== "off";

// Shared with the header panel on every page, including the scientific demo.
export function mountEffectPreference() {
  return {
    get mode() {
      return document.documentElement.dataset.animation || "full";
    },
    get preset() {
      return document.documentElement.dataset.networkEffect || "spring";
    },
    get enabled() {
      return effectsEnabled(this.mode);
    },
    subscribe(listener, includePreset = false) {
      document.addEventListener("animationchange", listener);
      if (includePreset) document.addEventListener("networkeffectchange", listener);
    },
  };
}
