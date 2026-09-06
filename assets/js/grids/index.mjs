// Each page imports only the scene it actually displays.
const backdrops = document.querySelectorAll("[data-grid-backdrop]");
const wave = document.querySelector("[data-grid-wave]");
if (backdrops.length) {
  const { mountStory } = await import("./home.mjs");
  mountStory(backdrops);
}
if (wave) {
  const { mountWave } = await import("./wave.mjs");
  mountWave(wave);
}
