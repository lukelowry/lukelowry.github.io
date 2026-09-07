// Apply saved appearance before the first paint. Full interaction is the default.
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
const appearanceChoices = {
  theme: ["system", "light", "dark"],
  animation: ["full", "reduced", "off"],
  contrast: ["standard", "high"],
};
let appearance = readAppearance();
let themeTimer;
function readAppearance() {
  const settings = {};
  for (const [key, choices] of Object.entries(appearanceChoices)) {
    let saved;
    try {
      saved = localStorage.getItem(key);
      // Keep an explicit choice made with the previous network controls.
      if (key === "animation" && saved === null && localStorage.getItem("grid-effects") === "off") saved = "off";
    } catch {
      /* Settings still work for this visit when storage is blocked. */
    }
    settings[key] = choices.includes(saved) ? saved : choices[0];
  }
  return settings;
}
const determineThemeSetting = () => appearance.theme;
const determineComputedTheme = () => (appearance.theme === "system" ? (systemTheme.matches ? "dark" : "light") : appearance.theme);
function applyTheme() {
  const root = document.documentElement;
  const theme = determineComputedTheme();
  const changed = root.dataset.theme !== theme || root.dataset.contrast !== appearance.contrast;
  const animationChanged = root.dataset.animation !== appearance.animation;
  if (changed && root.dataset.theme && appearance.animation === "full" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("transition");
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => root.classList.remove("transition"), 300);
  }
  root.dataset.themeSetting = appearance.theme;
  root.dataset.theme = theme;
  root.dataset.animation = appearance.animation;
  root.dataset.contrast = appearance.contrast;
  root.dataset.gridEffects = appearance.animation === "off" ? "off" : "on";
  for (const mode of ["light", "dark"]) {
    const sheet = document.getElementById(`highlight_theme_${mode}`);
    if (sheet) sheet.media = theme === mode ? "all" : "not all";
  }
  document.querySelectorAll("table").forEach((table) => table.classList.toggle("table-dark", theme === "dark"));
  document.querySelectorAll("#accessibility-panel input").forEach((input) => {
    input.checked = appearance[input.name] === input.value;
  });
  const description = document.getElementById("animation-description");
  if (description)
    description.textContent =
      document.documentElement.dataset.gridPresentation === "static"
        ? "Mobile networks use still images."
        : {
            full: "Hover and select to send ripples through the network.",
            reduced: "Steady hover highlight. No ripples or autoplay.",
            off: "Still network. Selection remains available.",
          }[appearance.animation];
  if (changed) document.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  if (animationChanged) document.dispatchEvent(new CustomEvent("animationchange", { detail: appearance.animation }));
}
window.siteAppearance = {
  get animation() {
    return appearance.animation;
  },
  set(key, value) {
    if (!appearanceChoices[key]?.includes(value)) return;
    appearance[key] = value;
    try {
      localStorage.setItem(key, value);
      if (key === "animation") localStorage.removeItem("grid-effects");
    } catch {
      /* Keep the in-page preference. */
    }
    applyTheme();
  },
};
function initTheme() {
  applyTheme();
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      applyTheme();
      const container = document.querySelector(".accessibility");
      const toggle = document.getElementById("accessibility-toggle");
      const panel = document.getElementById("accessibility-panel");
      if (!container || !toggle || !panel) return;
      container.hidden = false;
      function close(restoreFocus = false) {
        if (panel.hidden) return;
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        if (restoreFocus) toggle.focus({ preventScroll: true });
      }
      toggle.addEventListener("click", () => {
        if (!panel.hidden) return close(true);
        panel.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
        panel.querySelector('input[name="theme"]:checked').focus({ preventScroll: true });
      });
      panel.addEventListener("change", (event) => {
        if (event.target.matches('input[type="radio"]')) window.siteAppearance.set(event.target.name, event.target.value);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
          event.preventDefault();
          close(true);
        }
      });
      document.addEventListener("pointerdown", (event) => {
        if (!container.contains(event.target)) close(panel.contains(document.activeElement));
      });
      container.addEventListener("focusout", (event) => {
        if (event.relatedTarget && !container.contains(event.relatedTarget)) close();
      });
    },
    { once: true }
  );
  document.addEventListener("gridpresentationchange", applyTheme);
  systemTheme.addEventListener("change", applyTheme);
  window.addEventListener("storage", (event) => {
    if (event.key !== null && !(event.key in appearanceChoices) && event.key !== "grid-effects") return;
    appearance = readAppearance();
    applyTheme();
  });
}
