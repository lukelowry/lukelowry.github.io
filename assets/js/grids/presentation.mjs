// Match the CSS and picture sources, including phones rotated into landscape.
export const MOBILE_PRESENTATION = "(max-width: 767px), (hover: none) and (pointer: coarse)";

export function mountPresentation() {
  const media = matchMedia(MOBILE_PRESENTATION);
  const listeners = new Set();
  const images = [...document.querySelectorAll("[data-grid-still]")];
  const root = document.documentElement;
  function updateImages() {
    if (!media.matches) return;
    const theme = root.dataset.theme === "dark" ? "dark" : "light";
    for (const img of images) {
      if (img.dataset.stillTheme === theme) continue;
      img.srcset = img.dataset[`${theme}Srcset`];
      img.src = img.dataset[`${theme}Src`];
      img.dataset.stillTheme = theme;
    }
  }
  function update() {
    root.dataset.gridPresentation = media.matches ? "static" : "live";
    updateImages();
    for (const listener of listeners) listener();
    document.dispatchEvent(new Event("gridpresentationchange"));
  }
  media.addEventListener("change", update);
  document.addEventListener("themechange", updateImages);
  update();
  return {
    get live() {
      return !media.matches;
    },
    subscribe(listener) {
      listeners.add(listener);
    },
  };
}
