import * as loader from "./loading.mjs";
import { showBackdropFallback } from "./fallback.mjs";
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
      const [{ mountStory }] = await Promise.all([
        import("./home.mjs"),
        // mountBackdrop consumes the cached failure and chooses its fallback.
        loader.preloadGrid(backdrops[0]).catch(() => {}),
      ]);
      if (!presentation.live) return;
      mountStory(backdrops, presentation, loader);
    }
    if (wave) {
      const { mountWave } = await import("./wave.mjs");
      if (!presentation.live) return;
      mountWave(wave, presentation);
    }
    mounted = true;
  } catch (error) {
    for (const root of backdrops) showBackdropFallback(root);
    if (!backdrops.length) throw error;
    mounted = true;
  } finally {
    mounting = false;
  }
}
presentation.subscribe(mountLive);
await mountLive();
