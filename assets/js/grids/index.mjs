import { mountPresentation } from "./presentation.mjs";

const presentation = mountPresentation();
const backdrops = document.querySelectorAll("[data-grid-backdrop]");
const wave = document.querySelector("[data-grid-wave]");
let mounting = false;
let mounted = false;

// A fresh mobile visit imports no renderer, topology, picking, or animation code.
async function mountLive() {
  if (!presentation.live || mounting || mounted) return;
  mounting = true;
  try {
    if (backdrops.length) {
      const { mountStory } = await import("./home.mjs");
      if (!presentation.live) return;
      mountStory(backdrops, presentation);
    }
    if (wave) {
      const { mountWave } = await import("./wave.mjs");
      if (!presentation.live) return;
      mountWave(wave, presentation);
    }
    mounted = true;
  } finally {
    mounting = false;
  }
}
presentation.subscribe(mountLive);
await mountLive();
