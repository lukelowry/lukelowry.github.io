import assert from "node:assert/strict";
import { assertSamePixels } from "./check-inspection.mjs";

const renderSupport = new WeakMap();

// Hosted CI has no adapter. Verify its real fallback, but never turn a failed
// live scene on a GPU-capable browser into a skipped readiness test.
function supportsRendering(browser, url) {
  if (!renderSupport.has(browser))
    renderSupport.set(
      browser,
      (async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
        await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
        const page = await context.newPage(),
          errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready], [data-grid-backdrop][data-case="USA"][data-fallback]');
          const root = page.locator('[data-grid-backdrop][data-case="USA"]');
          if ((await root.getAttribute("data-ready")) !== null) return true;
          assert.equal(
            await page.evaluate(async () => Boolean(navigator.gpu && (await navigator.gpu.requestAdapter()))),
            false,
            "A fallback with an available GPU adapter is a rendering failure"
          );
          assert.equal(await root.locator("latkit-network").count(), 0);
          assert.equal(await root.locator("img").count(), 1);
          await root.locator("img").evaluate((image) => image.decode());
          assert.deepEqual(errors, []);
          console.log(
            "Loading: no WebGPU adapter; verified terminal image fallback. Live paint/shader and binary-render checks require a GPU-capable browser."
          );
          return false;
        } finally {
          await context.close();
        }
      })()
    );
  return renderSupport.get(browser);
}

export async function checkLoading(browser, url) {
  if (!(await supportsRendering(browser, url))) return;
  for (const failShade of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
    await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
    await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    let releaseInputs, releaseInteraction;
    const inputs = new Promise((resolve) => {
      releaseInputs = resolve;
    });
    const interaction = new Promise((resolve) => {
      releaseInteraction = resolve;
    });
    const pending = new Set();
    for (const [name, pattern] of [
      ["runtime", "**/assets/generated/latkit.js*"],
      ["topology", "**/assets/grids/USA.home.bin*"],
    ]) {
      await context.route(pattern, async (route) => {
        pending.add(name);
        await inputs;
        await route.continue();
      });
    }
    await context.route("**/assets/generated/grids/chunks/interactions-*.mjs", async (route) => {
      await interaction;
      await route.continue();
    });
    // No relationship exists between this fixed canvas and all document fonts.
    await context.addInitScript(() => {
      Object.defineProperty(document.fonts, "ready", { get: () => new Promise(() => {}) });
    });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      // Observe requests while BOTH responses are blocked. A serial loader fails.
      const deadline = Date.now() + 10000;
      while (pending.size < 2 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
      assert.deepEqual([...pending].sort(), ["runtime", "topology"], "Runtime and topology must start independently");
      assert.equal(await page.locator(".grid-backdrop img").count(), 0, "No desktop loading image exists");
      releaseInputs();
      const root = page.locator('[data-grid-backdrop][data-case="USA"]');
      await root.locator("latkit-network").waitFor();
      await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready]');
      assert.equal(await root.getAttribute("data-lighting"), null, "The base scene appears before the interaction module loads");
      assert.equal(await root.locator("latkit-network").evaluate((el) => getComputedStyle(el).opacity), "1");
      // Restore the native font promise for Playwright's screenshot machinery.
      await page.evaluate(() => delete document.fonts.ready);
      const pose = await root.evaluate((r) => r.querySelector("latkit-network").network.getPose());
      const box = await root.boundingBox();
      const clip = { x: 0, y: 130, width: 490, height: 660 };
      const resting = await page.screenshot({ clip });
      await page.mouse.wheel(0, 160);
      await page.waitForFunction(() => scrollY > 100);
      assert.deepEqual(await root.boundingBox(), box, "The resting scene scrolls correctly before input is mounted");
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForFunction(() => scrollY === 0);
      await root.evaluate((r) => {
        const network = r.querySelector("latkit-network").network;
        const original = network.setShade;
        const gate = new Promise((resolve) => {
          window.__releaseShade = resolve;
        });
        network.setShade = async (...args) => {
          window.__shadeStarted = true;
          await gate;
          if (window.__failShade) throw new Error("Expected test shader failure");
          return original.apply(network, args);
        };
      });
      await page.evaluate((value) => {
        window.__failShade = value;
      }, failShade);
      releaseInteraction();
      await page.waitForFunction(() => window.__shadeStarted);
      assert.equal(await root.getAttribute("data-ready"), "", "Shader preparation cannot hide the base scene");
      await assertSamePixels(page, await page.screenshot({ clip }), resting, { ...clip, x: 0, y: 0 }, "Delayed setup preserves the resting pixels");
      await page.evaluate(() => window.__releaseShade());
      await page.waitForFunction(
        (failed) => document.querySelector('[data-grid-backdrop][data-case="USA"]').dataset.lighting === (failed ? "unavailable" : "on"),
        failShade
      );
      await root.evaluate((r) => r.querySelector("latkit-network").network.paint());
      assert.deepEqual(await root.evaluate((r) => r.querySelector("latkit-network").network.getPose()), pose, "Enabling input keeps the same camera");
      await assertSamePixels(
        page,
        await page.screenshot({ clip }),
        resting,
        { ...clip, x: 0, y: 0 },
        "Neutral effects and effect failure preserve the same visible pixels"
      );
      assert.equal(await root.getAttribute("data-fallback"), null, "Optional effect failures never select an image fallback");
      assert.equal(await page.locator(".grid-backdrop img").count(), 0);
      assert.equal(
        requests.some((request) => /\/assets\/grids\/.*\.webp/.test(request)),
        false,
        "Successful desktop startup requests no artwork image"
      );
      assert.equal(requests.filter((request) => /\/USA\.home\.bin/.test(request)).length, 1, "Bootstrap and scene share one payload request");
      assert.equal(
        requests.some((request) => /\/USA\.json/.test(request)),
        false,
        "Homepage never loads the full scientific dataset"
      );
      assert.deepEqual(errors, []);
      console.log(
        `Loading: concurrent requests, no poster, independent font readiness, final framing, scroll before interaction, and ${
          failShade ? "failed" : "delayed"
        } shader setup passed.`
      );
    } finally {
      releaseInputs();
      releaseInteraction();
      await context.close();
    }
  }
}

// The binary contract must also work without streaming gzip and fail cleanly
// when the downloaded asset is corrupt, rather than display partial geometry.
export async function checkPayloadLoading(browser, url) {
  if (!(await supportsRendering(browser, url))) return;
  for (const corrupt of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
    await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
    await context.addInitScript(() => {
      delete window.DecompressionStream;
    });
    if (corrupt)
      await context.route("**/assets/grids/USA.home.bin?*", (route) =>
        route.fulfill({ body: Buffer.alloc(16), contentType: "application/octet-stream" })
      );
    const page = await context.newPage(),
      requests = [],
      errors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const root = page.locator('[data-grid-backdrop][data-case="USA"]');
      await page.waitForSelector(`[data-grid-backdrop][data-case="USA"][${corrupt ? "data-fallback" : "data-ready"}]`);
      assert.equal(await root.locator("latkit-network").count(), corrupt ? 0 : 1);
      assert.equal(await root.locator("img").count(), corrupt ? 1 : 0);
      assert.equal(requests.filter((request) => /\/USA\.home\.bin\?/.test(request)).length, 1);
      assert.equal(
        requests.some((request) => /\.bin\.gz|USA\.json|EuropeA\.home/.test(request)),
        false
      );
      assert.deepEqual(errors, []);
      console.log(
        `Binary loading: ${corrupt ? "corrupt payload selects terminal fallback" : "raw payload renders without DecompressionStream"} passed.`
      );
    } finally {
      await context.close();
    }
  }
}
