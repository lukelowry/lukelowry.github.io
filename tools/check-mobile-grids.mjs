import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setAppearance } from "./check-appearance.mjs";
const require = createRequire(import.meta.url);
const liveResource =
  /\/assets\/generated\/latkit\.js|\/assets\/generated\/grids\/chunks\/(?:home|wave|interactions)-[^/]+\.mjs|\/assets\/generated\/grids\/(?:home|wave)\.mjs|\/assets\/grids\/[^/]+\.(?:json|bin)(?:\.gz)?|\/assets\/js\/grids\/(?:home|wave|electricity|inspection|data|signal|pulse|vertex-ripple)\.mjs/;

export async function checkMobileGrids(browser, url) {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1024, height: 768 },
  ]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
    await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on("request", (request) => requests.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      for (const path of ["/", "/projects/#usa-network"]) {
        requests.length = 0;
        await page.goto(url + path, { waitUntil: "networkidle" });
        assert.equal(await page.locator("html").getAttribute("data-grid-presentation"), "static");
        const images = page.locator("[data-grid-still]");
        assert.equal(await images.count(), path === "/" ? 2 : 1);
        for (const img of await images.all()) {
          await img.scrollIntoViewIfNeeded();
          await page.waitForFunction((el) => el.complete && el.naturalWidth > 1, await img.elementHandle());
          assert.equal(await img.isVisible(), true);
          assert.match(await img.evaluate((el) => el.currentSrc), /-mobile-light-(640|960)\.webp/);
        }
        assert.equal(
          await page.locator(".grid-backdrop-track:visible, .grid-wave-stage:visible, .grid-wave-controls:visible, [data-inspectable]").count(),
          0
        );
        assert.equal(await page.evaluate(() => Boolean(customElements.get("latkit-network"))), false, "Mobile never registers the renderer");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(
          requests.filter((request) => liveResource.test(request)),
          [],
          "Mobile downloads no Latkit, topology, or scene code"
        );
        assert.deepEqual(
          requests.filter((request) => /\/assets\/grids\/.*\.webp/.test(request) && !request.includes("-mobile-")),
          [],
          "Hidden desktop posters do not download"
        );
        await setAppearance(page, "Theme", "Dark");
        for (const img of await images.all()) {
          await img.scrollIntoViewIfNeeded();
          await page.waitForFunction((el) => el.complete && el.currentSrc.includes("-mobile-dark-"), await img.elementHandle());
        }
        await setAppearance(page, "Animation", "Reduced");
        await setAppearance(page, "Animation", "Full");
        assert.equal(await page.evaluate(() => Boolean(customElements.get("latkit-network"))), false, "Full does not activate mobile rendering");
        await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
        const violations = await page.evaluate(async () =>
          (await axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(({ id, nodes }) => ({
            id,
            nodes: nodes.map((node) => node.target),
          }))
        );
        assert.deepEqual(violations, [], "Mobile static presentation remains accessible");
        await setAppearance(page, "Theme", "Light");
      }
      await page.goto(url);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      const art = page.locator("[data-grid-still]").first();
      const before = await art.boundingBox();
      const session = await context.newCDPSession(page);
      const y = Math.min(viewport.height - 60, before.y + before.height / 2);
      const x = viewport.width / 2;
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let step = 1; step <= 5; step++) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 24 }] });
        await page.waitForTimeout(20);
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForFunction(() => scrollY > 20);
      assert.ok((await art.boundingBox()).y < before.y - 20, "Artwork scrolls in the document and does not intercept touch");
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      assert.equal(await page.locator("html").getAttribute("data-grid-presentation"), "static", "Rotation keeps touch devices static");
      assert.deepEqual(
        requests.filter((request) => liveResource.test(request)),
        []
      );
      assert.deepEqual(errors, []);
      console.log(
        `Mobile ${viewport.width}x${viewport.height}: images only, both themes, no renderer/data downloads, touch scrolling, rotation, and accessibility passed.`
      );
    } finally {
      await context.close();
    }
  }
  await checkPresentationResize(browser, url);
}

async function checkPresentationResize(browser, url) {
  // A narrow desktop window can opt into the live view when widened, then suspend it.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
  await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
  const page = await context.newPage();
  try {
    await page.goto(url);
    assert.equal(await page.evaluate(() => Boolean(customElements.get("latkit-network"))), false);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const root = page.locator('[data-grid-backdrop][data-case="USA"]');
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready], [data-grid-backdrop][data-case="USA"][data-fallback]');
    if ((await root.getAttribute("data-ready")) === null) return;
    await root.evaluate((root) => {
      window.__retainedCanvas = root.querySelector("latkit-network").shadowRoot.querySelector("canvas");
      window.__mobileSubmissions = 0;
      const submit = GPUQueue.prototype.submit;
      GPUQueue.prototype.submit = function (...args) {
        window.__mobileSubmissions++;
        return submit.apply(this, args);
      };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    assert.equal(await page.locator("[data-inspectable]").count(), 0);
    const submissions = await page.evaluate(() => window.__mobileSubmissions);
    await page.evaluate(() => scrollTo({ top: 500, behavior: "instant" }));
    await page.waitForTimeout(350);
    assert.equal(
      await page.evaluate(() => window.__mobileSubmissions),
      submissions,
      "Switching to mobile stops WebGPU submissions, including during scrolling"
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-inspectable][data-lighting="on"]');
    await page.waitForFunction(() => !document.querySelector("[data-fitting]"));
    assert.equal(
      await root.evaluate((root) => root.querySelector("latkit-network").shadowRoot.querySelector("canvas") === window.__retainedCanvas),
      true
    );
    console.log("Resizing: static to live initialization, suspension without GPU submissions, and desktop recovery passed.");
  } finally {
    await context.close();
  }
}
