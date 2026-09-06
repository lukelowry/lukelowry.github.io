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
    const caption = page.locator('[data-grid-caption="USA"]');
    if ((await root.getAttribute("data-fallback")) !== null) {
      assert.equal(
        await page.evaluate(async () => Boolean(navigator.gpu && (await navigator.gpu.requestAdapter()))),
        false,
        "A browser with a WebGPU adapter must render the live network"
      );
      assert.equal(await root.locator(".grid-backdrop-poster").isVisible(), true, "Without an adapter the static network stays visible");
      assert.equal(await caption.isVisible(), false, "Unavailable effects must not expose unusable controls");
      console.log("No WebGPU adapter: verified static network fallback; live effects preference checks require a GPU-capable browser.");
      return;
    }
    assert.equal(await page.evaluate(() => localStorage.getItem("grid-effects")), null, "Effects work on a fresh origin without a saved opt-in");
    assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
    await root.evaluate((root) => {
      const network = root.querySelector("latkit-network").network;
      const original = network.setChannel;
      window.__defaultSizes = [];
      network.setChannel = function (name, values, ...rest) {
        if (name === "vertexSize" && values) window.__defaultSizes.push(values.reduce((max, value) => Math.max(max, value), 1));
        return original.call(this, name, values, ...rest);
      };
    });
    await page.mouse.move(180, 420);
    await page.waitForTimeout(90);
    await page.mouse.move(320, 460);
    await page.waitForTimeout(100);
    assert.ok(
      await page.evaluate(() => window.__defaultSizes?.some((size) => size > 1.4)),
      "A fresh visit must visibly enlarge real vertices while Chrome still reports reduced motion"
    );
    assert.equal(await root.locator(".grid-electric-trace").count(), 0, "No separate cursor overlay remains");
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="on"]');
    assert.equal(await page.evaluate(() => localStorage.getItem("grid-effects")), null, "The enabled default needs no stored preference");
    await caption.getByRole("button", { name: "Pause effects", exact: true }).click();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-lighting="off"]');
    assert.equal(await root.evaluate((root) => root.querySelector("latkit-network").network.getChannelDomain("vertexSize")), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("grid-effects")), "off");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="off"]');
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await root.getAttribute("data-lighting"), "off", "A system preference change must not override a deliberate pause");
    await caption.getByRole("button", { name: "Enable effects", exact: true }).click();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-lighting="on"]');
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="on"]');
    assert.equal(await page.evaluate(() => localStorage.getItem("grid-effects")), "on");
    console.log("Fresh-origin effects run with system reduced motion; explicit pause and resume survive reloads.");
  } finally {
    await context.close();
  }
}
