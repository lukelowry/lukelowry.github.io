// Images are a terminal fallback, never a desktop loading placeholder.
export function showBackdropFallback(root) {
  root.dataset.fallback = "";
  root.removeAttribute("data-ready");
  const element = root.querySelector("latkit-network");
  const focused = element && document.activeElement === element;
  element?.network?.detach();
  element?.remove();
  if (focused) document.getElementById("main-content")?.focus({ preventScroll: true });
  if (root.querySelector(".grid-backdrop-fallback")) return;
  const wrapper = document.createElement("div");
  wrapper.className = "grid-backdrop-fallback";
  const image = document.createElement("img");
  image.className = "grid-poster";
  image.alt = "";
  image.width = 1600;
  image.height = 820;
  image.decoding = "async";
  function theme() {
    const dark = document.documentElement.dataset.theme === "dark";
    image.src = root.dataset[dark ? "fallbackDark" : "fallbackLight"];
  }
  theme();
  document.addEventListener("themechange", theme);
  wrapper.append(image);
  root.append(wrapper);
}
