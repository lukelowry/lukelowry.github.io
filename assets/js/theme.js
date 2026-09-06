// Run in the head to apply the saved preference before the first paint.
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let themeSetting = "system";
let themeTimer;
try {
  const saved = localStorage.getItem("theme");
  if (["light", "dark", "system"].includes(saved)) themeSetting = saved;
} catch {
  /* The system preference also works without storage. */
}

const determineThemeSetting = () => themeSetting;
const determineComputedTheme = () => (themeSetting === "system" ? (systemTheme.matches ? "dark" : "light") : themeSetting);
function applyTheme() {
  const theme = determineComputedTheme();
  const root = document.documentElement;
  const changed = root.dataset.theme !== theme;
  if (changed && root.dataset.theme && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("transition");
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => root.classList.remove("transition"), 300);
  }
  root.dataset.themeSetting = themeSetting;
  root.dataset.theme = theme;
  for (const mode of ["light", "dark"]) {
    const sheet = document.getElementById(`highlight_theme_${mode}`);
    if (sheet) sheet.media = theme === mode ? "all" : "not all";
  }
  document.querySelectorAll("table").forEach((table) => table.classList.toggle("table-dark", theme === "dark"));
  const next = { system: "light", light: "dark", dark: "system" }[themeSetting];
  document.getElementById("light-toggle")?.setAttribute("aria-label", `Theme: ${themeSetting}. Switch to ${next} theme.`);
  if (changed) document.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}
function initTheme() {
  applyTheme();
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      applyTheme();
      document.getElementById("light-toggle")?.addEventListener("click", () => {
        themeSetting = { system: "light", light: "dark", dark: "system" }[themeSetting];
        try {
          localStorage.setItem("theme", themeSetting);
        } catch {
          /* Keep the in-page preference. */
        }
        applyTheme();
      });
    },
    { once: true }
  );
  systemTheme.addEventListener("change", applyTheme);
  window.addEventListener("storage", (event) => {
    if (event.key !== "theme") return;
    themeSetting = ["light", "dark", "system"].includes(event.newValue) ? event.newValue : "system";
    applyTheme();
  });
}
