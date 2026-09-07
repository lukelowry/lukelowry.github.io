import assert from "node:assert/strict";
import { supportsRendering } from "./check-loading.mjs";

export async function checkReload(browser, url) {
  if (!(await supportsRendering(browser, url))) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
  const errors = [];
  await context.addInitScript(() => {
    window.__readyFrames = { USA: [], EuropeA: [] };
    const sample = () => {
      for (const root of document.querySelectorAll("[data-grid-backdrop][data-ready]")) {
        const network = root.querySelector("latkit-network").network;
        const samples = window.__readyFrames[root.dataset.case];
        const frame = { pose: network.getPose(), points: [0, 70, 1000].map((index) => network.locate({ kind: "vertex", index })) };
        if (JSON.stringify(frame) !== JSON.stringify(samples.at(-1))) samples.push(frame);
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  // Request routing disables Chromium's HTTP cache. Block unrelated traffic via
  // CDP so reloads really exercise cached assets and restored scroll positions.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", { urls: ["*livereload.js*", "*googletagmanager.com*"] });
  const settle = async () => {
    await page.waitForFunction(() => document.querySelectorAll("[data-grid-backdrop][data-ready]").length === 2);
    await page.waitForFunction(() => document.querySelectorAll('[data-grid-backdrop][data-lighting="on"]').length === 2);
    await page.waitForTimeout(400);
    return page.evaluate(() => window.__readyFrames);
  };
  const assertFrames = (frames, reference, label) => {
    for (const name of ["USA", "EuropeA"]) {
      assert.ok(frames[name].length, `${label}: ${name} rendered`);
      for (const frame of frames[name]) {
        assert.equal(frame.pose.pitch, 0, `${label}: ${name} is north-up from first reveal`);
        assert.equal(frame.pose.bearing, 0);
        for (const [key, value] of Object.entries(reference[name][0].pose)) {
          assert.ok(Math.abs(frame.pose[key] - value) < 1e-5, `${label}: ${name} ${key} changed after reload`);
        }
        for (let i = 0; i < frame.points.length; i++) {
          assert.ok(frame.points[i] && reference[name][0].points[i], `${name}: projected probe exists`);
          assert.ok(
            Math.hypot(...frame.points[i].map((v, axis) => v - reference[name][0].points[i][axis])) < 0.05,
            `${label}: ${name} moved after its first ready frame`
          );
        }
      }
    }
  };
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready]');
    await page.locator('[data-grid-section="EuropeA"]').scrollIntoViewIfNeeded();
    const baseline = await settle();
    assertFrames(baseline, baseline, "Cold load");
    for (const position of ["restored Europe", "top", "restored Europe again"]) {
      if (position === "top") await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      else await page.locator('[data-grid-section="EuropeA"]').scrollIntoViewIfNeeded();
      const scroll = await page.evaluate(() => scrollY);
      await page.reload({ waitUntil: "networkidle" });
      assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 3, "Exercise the restored scroll position");
      if (position === "top") {
        await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready]');
        await page.locator('[data-grid-section="EuropeA"]').scrollIntoViewIfNeeded();
      }
      await page.waitForSelector('[data-grid-backdrop][data-case="EuropeA"][data-ready]');
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      const frames = await settle();
      assertFrames(frames, baseline, position);
      assert.equal(await page.locator(".grid-backdrop img").count(), 0, "Live reloads never swap a poster for the canvas");
    }
    // A revealed canvas stays visible through resize; intermediate fit angles
    // must never be submitted between fit, zoom and the resting pose.
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(600);
      await page.waitForFunction(() => !document.querySelector("[data-fitting]"));
    }
    const resized = await page.evaluate(() => window.__readyFrames.USA);
    assert.ok(
      resized.every(({ pose }) => pose.pitch === 0 && pose.bearing === 0),
      "Resize must never expose the intermediate tilted fit"
    );
    assertFrames({ USA: [resized.at(-1)], EuropeA: baseline.EuropeA }, baseline, "Return to original viewport");
    assert.deepEqual(errors, []);
    console.log(
      "Reload: cold load, cached reloads and restored scroll keep both scenes at the same pose from their first visible frame; resize never exposes an intermediate tilt."
    );
  } finally {
    await context.close();
  }
}
