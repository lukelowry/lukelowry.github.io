import { observeInspection } from "./check-inspection.mjs";
import { setAppearance } from "./check-appearance.mjs";
import assert from "node:assert/strict";

export async function checkEffectPreference(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
    await page.goto(url);
    const root = page.locator('[data-grid-backdrop][data-case="USA"]');
    await page.waitForSelector(
      '[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="on"], [data-grid-backdrop][data-case="USA"][data-fallback]'
    );
    if ((await root.getAttribute("data-fallback")) !== null) {
      assert.equal(
        await page.evaluate(async () => Boolean(navigator.gpu && (await navigator.gpu.requestAdapter()))),
        false,
        "A browser with a WebGPU adapter must render the live network"
      );
      assert.equal(await root.locator(".grid-backdrop-poster").isVisible(), true, "Without an adapter the static network stays visible");
      assert.equal(await page.locator(".grid-backdrop-caption").count(), 0, "Fallback has no information overlay");
      console.log("No WebGPU adapter: verified static network fallback; live effects preference checks require a GPU-capable browser.");
      return;
    }
    assert.equal(await page.evaluate(() => localStorage.getItem("animation")), null, "Effects work on a fresh origin without a saved opt-in");
    assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
    await root.evaluate((root) => {
      const network = root.querySelector("latkit-network").network;
      const original = network.setChannel;
      window.__defaultPositions = 0;
      network.setChannel = function (name, values, ...rest) {
        if (name === "vertexPosition" && values) window.__defaultPositions++;
        return original.call(this, name, values, ...rest);
      };
    });
    await page.mouse.move(180, 420);
    await page.waitForTimeout(90);
    await page.mouse.move(320, 460);
    await page.waitForTimeout(100);
    assert.ok(
      await page.evaluate(() => window.__defaultPositions > 0),
      "A fresh visit must move real vertices while Chrome still reports reduced motion"
    );
    assert.equal(await root.locator(".grid-electric-trace").count(), 0, "No separate cursor overlay remains");
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="on"]');
    assert.equal(await page.evaluate(() => localStorage.getItem("animation")), null, "The enabled default needs no stored preference");
    await setAppearance(page, "Animation", "Off");
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-lighting="off"]');
    assert.equal(await root.evaluate((root) => root.querySelector("latkit-network").network.getChannelDomain("vertexSize")), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("animation")), "off");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="off"]');
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await root.getAttribute("data-lighting"), "off", "A system preference change must not override a deliberate pause");
    await setAppearance(page, "Animation", "Full");
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-lighting="on"]');
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="on"]');
    assert.equal(await page.evaluate(() => localStorage.getItem("animation")), "full");
    await setAppearance(page, "Animation", "Reduced");
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="on"]');
    assert.equal(await page.locator("html").getAttribute("data-animation"), "reduced");
    await root.evaluate((root) => {
      const network = root.querySelector("latkit-network").network;
      const original = network.setChannel;
      window.__reducedUploads = [];
      network.setChannel = function (name, values, ...rest) {
        if (values) window.__reducedUploads.push(name);
        return original.call(this, name, values, ...rest);
      };
    });
    await page.mouse.move(180, 420);
    await page.mouse.move(320, 460, { steps: 8 });
    await page.waitForTimeout(900);
    const still = await page.screenshot({ clip: { x: 60, y: 250, width: 390, height: 400 } });
    await page.waitForTimeout(400);
    assert.deepEqual(
      await page.screenshot({ clip: { x: 60, y: 250, width: 390, height: 400 } }),
      still,
      "Reduced highlight stays still after the pointer stops"
    );
    await page.mouse.move(700, 30);
    await page.waitForTimeout(100);
    assert.notDeepEqual(
      await page.screenshot({ clip: { x: 60, y: 250, width: 390, height: 400 } }),
      still,
      "Reduced still produces visible network highlighting"
    );
    const probe = await observeInspection(root);
    await root.locator("canvas").press("ArrowRight");
    await probe.wait("selected", "vertex");
    assert.deepEqual(await page.evaluate(() => window.__reducedUploads), [], "Reduced emits no size waves or selection pulse channels");
    console.log(
      "Full works on a fresh origin despite system reduced motion; Full/Reduced/Off persist; Reduced gives steady visible highlighting without geometry animation."
    );
  } finally {
    await context.close();
  }
}
