const imageZoom = mediumZoom("[data-zoomable]", {
  background: getComputedStyle(document.documentElement).getPropertyValue("--global-bg-color").trim(),
});
document.addEventListener("themechange", () =>
  imageZoom.update({ background: getComputedStyle(document.documentElement).getPropertyValue("--global-bg-color").trim() })
);
