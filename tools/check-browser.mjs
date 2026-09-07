import { checkLoading, checkPayloadLoading } from "./check-loading.mjs";
import { checkScroll } from "./check-scroll.mjs";
import { checkSpring } from "./check-spring-browser.mjs";
import { checkMobileGrids } from "./check-mobile-grids.mjs";
import { setAppearance, checkAppearance } from "./check-appearance.mjs";
import { checkEffectPreference } from "./check-effect-preference.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { serveSite } from "./site-server.mjs";
import { checkInspection } from "./check-inspection.mjs";
import { sceneView } from "../assets/js/grids/framing.mjs";

const require = createRequire(import.meta.url);
const site = await serveSite();
let browser;
try {
  browser = await chromium.launch({ channel: process.env.SITE_BROWSER_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(20000);
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({ text: message.text(), url: message.location().url });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
  await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
  const projectPaths = (await readdir(resolve(site.root, "projects"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/projects/${entry.name}/`);
  const pagePaths = ["/", "/publications/", "/projects/", "/cv/", "/404.html", ...projectPaths];
  const accessFailures = [];
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    for (const path of pagePaths) {
      await page.goto(site.url + path, { waitUntil: "networkidle" });
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const violations = await page.evaluate(async () =>
        (await axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((node) => node.target),
        }))
      );
      if (violations.length) accessFailures.push({ theme, path, violations });
      if (path === "/cv/") assert.equal(await page.locator("#toc-sidebar > ul").count(), 1, "Initialize the sidebar TOC once");
      const background = await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
      assert.equal(background, theme === "dark" ? "rgb(28, 28, 29)" : "rgb(255, 255, 255)", `${path}: computed ${theme} background`);
      assert.equal(await page.locator("main h1").count(), 1, `${path}: one main heading`);
      if (theme === "light") {
        await page.setViewportSize({ width: 320, height: 740 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}: 320px reflow`);
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
    }
  }
  assert.deepEqual(accessFailures, [], "Accessibility violations");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(site.url + "/projects/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").innerText(), "Skip to content");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main-content");
  for (const title of ["GridKit", "GridKit Studio", "Latkit"]) {
    assert.equal(await page.getByRole("link", { name: title, exact: true }).count(), 1);
    assert.equal(await page.getByRole("link", { name: `${title} code repository`, exact: true }).count(), 1);
  }
  for (const name of ["GridKit", "Latkit"]) {
    assert.equal(await page.getByRole("link", { name: `${name} ReadTheDocs`, exact: true }).count(), 1);
  }
  assert.equal(
    await page.getByRole("link", { name: "GridKit Studio", exact: true }).getAttribute("href"),
    "https://marketplace.visualstudio.com/items?itemName=lukelowery.gridkit-studio"
  );
  assert.equal(await page.locator(".project-card a a").count(), 0, "Card links cannot be nested");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const next of ["Light", "Dark", "System"]) {
    await setAppearance(page, "Theme", next);
    assert.equal(await page.locator("html").getAttribute("data-theme-setting"), next.toLowerCase());
    assert.equal(
      await page.locator("body").evaluate((body) => getComputedStyle(body).transitionDuration),
      "0s",
      "Reduced motion disables theme transitions"
    );
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(site.url + "/publications/", { waitUntil: "networkidle" });
  const disclosure = page.locator("button[data-bib-toggle]").first();
  assert.ok(await disclosure.count(), "Publication disclosures must use native buttons");
  const panel = page.locator(`[id="${await disclosure.getAttribute("aria-controls")}"]`);
  await disclosure.focus();
  await page.keyboard.press("Enter");
  assert.equal(await disclosure.getAttribute("aria-expanded"), "true");
  assert.equal(await panel.isVisible(), true);
  await page.keyboard.press("Space");
  assert.equal(await disclosure.getAttribute("aria-expanded"), "false");
  assert.equal(await panel.isVisible(), false);
  const search = page.getByRole("textbox", { name: "Filter publications" });
  await search.fill("no-publication-matches-this-string-42017");
  await page.waitForFunction(() => document.querySelector("#bibsearch-status").textContent === "0 publications");
  assert.equal(await page.locator("ol.bibliography > li:visible").count(), 0);
  await search.fill("");
  await page.waitForFunction(() => document.querySelectorAll("ol.bibliography > li:not(.unloaded)").length > 0);
  await page.goto(site.url + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo({ top: 100000, behavior: "instant" }));
  const backToTop = page.getByRole("button", { name: "Back to top", exact: true });
  await backToTop.focus();
  assert.ok(await backToTop.evaluate((button) => button.scrollWidth <= button.clientWidth), "Back to top text must fit its button");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => scrollY < 5);
  assert.equal(await page.evaluate(() => document.activeElement.id), "main-content");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(site.url + "/projects/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  assert.equal(await page.getByRole("button", { name: "Toggle navigation" }).getAttribute("aria-expanded"), "true");
  assert.ok(await page.getByRole("link", { name: "publications", exact: true }).isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(site.url + "/", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready], [data-grid-backdrop][data-case="USA"][data-fallback]');
  assert.equal(await page.locator(".home-scene-europe .home-publications").count(), 1);
  assert.deepEqual(
    await page
      .locator(".home-scene-europe h2")
      .allTextContents()
      .then((values) => values.map((value) => value.trim())),
    ["graph signal processing", "engineering education", "selected publications"]
  );
  assert.equal(await page.locator("[data-grid-wave]").count(), 0);
  assert.equal(
    requests.some((url) => /EuropeA\.(?:json|home\.bin)/.test(url)),
    false,
    "Europe must not download on the opening screen."
  );
  const backdrops = ["USA", "EuropeA"].map((name) => page.locator(`[data-grid-backdrop][data-case="${name}"]`));
  // Protect the exposed coastlines, not just the canvas rectangle. The western
  // crop is intentional; Maine/Florida must stay opaque and inside the drawing.
  for (const viewport of [
    { width: 1920, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(400);
    await page.waitForFunction(() => !document.querySelector("[data-fitting]"));
    const coastline = await page.evaluate(async () => {
      const root = document.querySelector('[data-grid-backdrop][data-case="USA"]');
      if (!root.hasAttribute("data-ready")) return null;
      const { loadGrid } = await import("/assets/js/grids/data.mjs");
      const { framingVertices, projectedBounds } = await import("/assets/js/grids/framing.mjs");
      const model = await loadGrid(root),
        network = root.querySelector("latkit-network").network;
      const rect = root.getBoundingClientRect();
      const regions = { Maine: [-71.1, -66.8, 43, 47.5], Florida: [-87.7, -80, 24.3, 31.1] };
      const corners = {};
      for (const [name, [west, east, south, north]] of Object.entries(regions)) {
        const points = [];
        model.visibleVertices.forEach((visible, index) => {
          const lon = model.topology.vertexCoords[index * 2],
            lat = model.topology.vertexCoords[index * 2 + 1];
          if (visible && lon >= west && lon <= east && lat >= south && lat <= north) points.push(network.locate({ kind: "vertex", index }));
        });
        corners[name] = {
          count: points.length,
          inside: points.every(
            ([x, y]) =>
              x >= Math.max(4, rect.left + rect.width * 0.02 + 4) &&
              x <= Math.min(innerWidth - 4, rect.right - rect.width * 0.02 - 4) &&
              y >= Math.max(document.querySelector("#navbar").getBoundingClientRect().bottom + 4, rect.top + 4) &&
              y <= Math.min(innerHeight - 4, rect.bottom - 4)
          ),
        };
      }
      const box = projectedBounds(network, framingVertices(model));
      return { corners, scale: (box.right - box.left) / rect.width, mask: getComputedStyle(root).maskImage };
    });
    if (coastline) {
      for (const [region, result] of Object.entries(coastline.corners)) {
        assert.ok(result.count > 100 && result.inside, `${region} must not be clipped at ${viewport.width}x${viewport.height}`);
      }
      assert.ok(coastline.scale > 1.7, "Keep the enlarged USA composition when fixing clipping");
      assert.ok(coastline.mask.includes("98%"), "The coastline must be inside the opaque part of the mask");
    }
  }
  const initialBounds = await Promise.all(backdrops.map((root) => root.boundingBox()));

  const assertAnchored = async (label) => {
    for (let i = 0; i < backdrops.length; i++) {
      const bounds = await backdrops[i].boundingBox();
      for (const key of ["x", "y", "width", "height"]) {
        assert.ok(Math.abs(bounds[key] - initialBounds[i][key]) < 0.1, `${label}: backdrop ${i} ${key} shifted`);
      }
    }
  };
  const assertNetworkCentered = async (label) => {
    const centers = await page.evaluate(async () => {
      const { loadGrid } = await import("/assets/js/grids/data.mjs");
      const { framingVertices, projectedBounds } = await import("/assets/js/grids/framing.mjs");
      return Promise.all(
        [...document.querySelectorAll('[data-grid-backdrop][data-ready][data-active="true"]')].map(async (root) => {
          const model = await loadGrid(root);
          const rect = root.getBoundingClientRect();
          const box = projectedBounds(root.querySelector("latkit-network").network, framingVertices(model));
          const center = [root.dataset.case === "USA" ? box.right : box.left, (box.top + box.bottom) / 2];
          const expected = [
            rect.left + rect.width * (root.dataset.case === "EuropeA" ? 0.08 : 0.94),
            rect.top + rect.height * (root.dataset.case === "EuropeA" ? 0.5 : 0.46),
          ];
          return { name: root.dataset.case, error: center.map((value, i) => Math.abs(value - expected[i])) };
        })
      );
    });
    for (const { name, error } of centers)
      assert.ok(
        error.every((value) => value < 1.5),
        `${label}: ${name} geometry drifted ${error}`
      );
  };
  await assertNetworkCentered("Opening network");
  await checkInspection(page, "USA");
  const scroll = async (top) => {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), top);
    await page.waitForTimeout(80);
  };
  const boundary = await page.locator('[data-grid-section="EuropeA"]').evaluate((e) => scrollY + e.getBoundingClientRect().top);
  const stop = boundary - 900;
  const columnBounds = await page.locator(".home-scene .home-copy").evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
  assert.ok(columnBounds[0].x > 720 && columnBounds[1].right < 720, "The reading column must switch sides at GSP.");
  // Check actual built CSS: the legacy minifier previously broke var() inside calc().
  assert.ok(
    await page.locator(".grid-backdrop-track").evaluateAll((es) => es.every((e) => getComputedStyle(e).maskImage.includes("linear-gradient"))),
    "Both section masks must survive the build."
  );
  await page.evaluate(() => {
    document.querySelector(".home-intro").style.paddingBottom = "140px";
    document.querySelector("footer").style.paddingBottom = "180px";
  });
  await assertAnchored("Content growth");
  await page.evaluate(() => {
    document.querySelector(".home-intro").style.removeProperty("padding-bottom");
    document.querySelector("footer").style.removeProperty("padding-bottom");
  });
  await scroll(stop);
  await page.waitForSelector('[data-grid-backdrop][data-case="EuropeA"][data-ready], [data-grid-backdrop][data-case="EuropeA"][data-fallback]');
  for (let i = 0; i < backdrops.length; i++) {
    const root = backdrops[i];
    if (!((await root.getAttribute("data-ready")) !== null)) continue;
    const info = await root.evaluate(async (root) => {
      const { loadGrid } = await import("/assets/js/grids/data.mjs");
      const model = await loadGrid(root);
      return {
        levels: model.levels,
        busDomain: root.querySelector("latkit-network").network.getChannelDomain("vertexColor"),
        branchDomain: root.querySelector("latkit-network").network.getChannelDomain("edgeColor"),
        visible: model.visibleVertices.reduce((a, b) => a + b, 0),
        bends: model.topology.polylinePoints?.length / 2 || 0,
      };
    });
    assert.deepEqual(info.levels, i ? [132, 220, 300, 380, 500, 750] : [69, 100, 115, 138, 161, 230, 345, 500, 765]);
    assert.deepEqual(info.busDomain, [0, i ? 750 : 765]);
    assert.deepEqual(info.branchDomain, info.busDomain);
    assert.equal(info.visible, i ? 8725 : 69835);
    assert.equal(info.bends, i ? 13956 : 0, "Homepage retains every bend on a visible edge");
  }
  const poseOf = (root) => root.evaluate((root) => root.querySelector("latkit-network").network.getPose());
  const rest = [];
  for (const root of backdrops) {
    if ((await root.getAttribute("data-ready")) === null) {
      rest.push(null);
      continue;
    }
    const pose = await poseOf(root);
    assert.equal(pose.pitch, sceneView(await root.getAttribute("data-case")).pitch);
    assert.equal(pose.bearing, (sceneView(await root.getAttribute("data-case")).bearing + 360) % 360);
    rest.push(pose);
  }
  for (let repeat = 0; repeat < 2; repeat++) {
    await scroll(stop + 20);
    await assertAnchored("USA revealed");
    await scroll(100000);
    await assertAnchored("Footer reached");
    assert.equal(await backdrops[0].getAttribute("data-active"), "false");
    await assertNetworkCentered("Europe resting pose");
    if (repeat === 0) await checkInspection(page, "EuropeA");
    await scroll(0);
    assert.equal(await backdrops[1].getAttribute("data-active"), "false");
    await assertAnchored("Top reached");
    await assertNetworkCentered("USA resting pose");
    for (let i = 0; i < backdrops.length; i++) {
      if (rest[i]) assert.deepEqual(await poseOf(backdrops[i]), rest[i], "Scroll must never change the resting camera.");
    }
  }
  for (const top of [stop * 0.38, boundary - 400, boundary - 100]) {
    await scroll(top);
    await assertNetworkCentered("Intermediate reveal");
  }
  await scroll(0);
  // Instrument only public calls after initialization. Resizing may fit one
  // custom composition, but must retain the source, canvas, and GPU channels.
  await page.evaluate(() => {
    window.gridAudit = [...document.querySelectorAll("[data-grid-backdrop][data-ready]")].map((root) => {
      const element = root.querySelector("latkit-network"),
        network = element.network;
      const entry = { root, element, canvas: element.shadowRoot.querySelector("canvas"), calls: {}, hidden: false };
      for (const method of ["load", "attach", "detach", "setChannel", "fit", "panBy", "setPose"]) {
        const original = network[method].bind(network);
        network[method] = (...args) => {
          entry.calls[method] = (entry.calls[method] || 0) + 1;
          return original(...args);
        };
      }
      new MutationObserver(() => {
        if (!root.hasAttribute("data-ready")) entry.hidden = true;
      }).observe(root, { attributes: true, attributeFilter: ["data-ready"] });
      return entry;
    });
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !document.querySelector("[data-fitting]"));
  await assertNetworkCentered("Compact desktop USA");
  const resizeAudit = await page.evaluate(() =>
    window.gridAudit.map((e) => ({
      name: e.root.dataset.case,
      calls: e.calls,
      hidden: e.hidden,
      sameCanvas: e.canvas === e.element.shadowRoot.querySelector("canvas"),
    }))
  );
  for (const audit of resizeAudit) {
    for (const name of ["load", "attach", "detach", "setChannel"]) assert.equal(audit.calls[name] || 0, 0, `Resize must not call ${name}`);
    assert.ok((audit.calls.fit || 0) <= 1 && (audit.calls.panBy || 0) <= 2, "Resize must not replay a calibration timeline");
    assert.equal(audit.hidden, false, "Resize must not cover the canvas with its poster");
    assert.equal(audit.sameCanvas, true);
  }
  console.log(`Resize audit: ${JSON.stringify(resizeAudit)}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const compactBounds = await Promise.all(backdrops.map((root) => root.boundingBox()));
  await scroll(100000);
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !document.querySelector("[data-fitting]"));
  await assertNetworkCentered("Compact desktop Europe");
  assert.equal(await page.locator(".grid-backdrop-caption").count(), 0, "Background networks have no information overlay");
  for (let i = 0; i < backdrops.length; i++) {
    assert.deepEqual(await backdrops[i].boundingBox(), compactBounds[i], "Desktop scroll must not move either canvas.");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  for (const root of backdrops) {
    if ((await root.getAttribute("data-ready")) !== null)
      assert.equal((await poseOf(root)).pitch, sceneView(await root.getAttribute("data-case")).pitch);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const resizing = await context.newPage();
  resizing.on("pageerror", (error) => errors.push(error.message));
  await resizing.goto(site.url, { waitUntil: "domcontentloaded" });
  await resizing.setViewportSize({ width: 1024, height: 900 });
  await resizing.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready], [data-grid-backdrop][data-case="USA"][data-fallback]');
  await resizing.waitForFunction(() => !document.querySelector("[data-fitting]"));
  const resizeError = await resizing.evaluate(async () => {
    const root = document.querySelector('[data-grid-backdrop][data-case="USA"]');
    if (!root.hasAttribute("data-ready")) return 0;
    const { loadGrid } = await import("/assets/js/grids/data.mjs");
    const { framingVertices, projectedBounds } = await import("/assets/js/grids/framing.mjs");
    const rect = root.getBoundingClientRect();
    const box = projectedBounds(root.querySelector("latkit-network").network, framingVertices(await loadGrid(root)));
    const point = [box.right, (box.top + box.bottom) / 2];
    return Math.hypot(point[0] - rect.left - rect.width * 0.94, point[1] - rect.top - rect.height * 0.46);
  });
  assert.ok(resizeError < 1.5, `Resize during initialization moved the network ${resizeError}px`);
  await resizing.close();
  await page.goto(site.url + "/projects/#usa-network");
  await page.waitForSelector("[data-grid-wave][data-ready], [data-grid-wave][data-fallback]");
  if (await page.locator("[data-grid-wave][data-ready]").count()) {
    await page.locator('[data-action="play"]').click();
    assert.equal(await page.locator('[data-action="play"]').innerText(), "Play");
    const bus = await page.evaluate(async () => {
      const { loadUSA } = await import("/assets/js/grids/data.mjs");
      const model = await loadUSA(document.querySelector("[data-grid-wave]"));
      const index = model.visibleVertices.findIndex((value) => value === 1);
      return { number: model.numbers[index], index };
    });
    const picker = page.getByRole("textbox", { name: "Bus number", exact: true });
    await picker.fill(String(bus.number));
    await picker.press("Enter");
    assert.ok((await page.locator("#grid-status").innerText()).includes(`Bus ${bus.number}.`));
    assert.equal(await page.locator(".grid-inspection").innerText(), `Bus ${bus.number}`);
    await picker.fill("999999999");
    await picker.press("Enter");
    assert.equal(await picker.getAttribute("aria-invalid"), "true");
    await picker.fill(String(bus.number));
    await picker.press("Enter");
    assert.equal(await picker.getAttribute("aria-invalid"), null);
    const canvas = page.locator("[data-grid-wave] canvas");
    await canvas.focus();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".grid-inspection").isVisible(), false);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), "play", "Canvas must not trap keyboard focus");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page.locator('[data-action="reset"]').click();
    const fullscreen = page.locator('[data-action="fullscreen"]');
    if (await fullscreen.isVisible()) {
      await fullscreen.click();
      await page.getByRole("button", { name: "Exit fullscreen", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.fullscreenElement?.id), "usa-network");
      assert.equal(await fullscreen.innerText(), "Exit fullscreen");
      await fullscreen.click();
      await page.getByRole("button", { name: "Fullscreen", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.fullscreenElement), null);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.action), "fullscreen");
    }
    await page.locator('[data-action="play"]').click();
    await setAppearance(page, "Animation", "Reduced");
    await page.getByRole("button", { name: "Play animation", exact: true }).waitFor();
    assert.equal(await page.locator('[data-action="play"]').innerText(), "Play");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-grid-wave][data-ready]");
    assert.equal(await page.locator('[data-action="play"]').innerText(), "Play", "Reduced motion must start paused");
    await page.getByRole("button", { name: "Play animation", exact: true }).click();
    assert.equal(await page.locator('[data-action="play"]').innerText(), "Pause", "The scientific demo can still be played deliberately");
    await setAppearance(page, "Animation", "Off");
    assert.equal(await page.locator('[data-action="play"]').innerText(), "Play");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-grid-wave][data-ready]");
    assert.equal(await page.locator('[data-action="play"]').innerText(), "Play", "Off prevents autoplay");
    console.log("Verified live WebGPU bus selection, keyboard exit, zoom, reset, and shared motion settings.");
  }
  await checkLoading(browser, site.url);
  await checkPayloadLoading(browser, site.url);
  await checkAppearance(browser, site.url);
  await checkEffectPreference(browser, site.url);
  await checkScroll(browser, site.url);
  await checkSpring(browser, site.url);
  await checkMobileGrids(browser, site.url);
  const unavailable = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
  await unavailable.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }));
  await unavailable.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
  const unavailablePage = await unavailable.newPage();
  await unavailablePage.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
  await unavailablePage.goto(site.url + "/projects/#usa-network");
  await unavailablePage.waitForSelector("[data-grid-wave][data-fallback]");
  assert.equal(await unavailablePage.locator(".grid-poster-dark").isVisible(), true);
  assert.ok((await unavailablePage.locator(".grid-poster-dark").getAttribute("alt")).length > 0);
  assert.equal(await unavailablePage.locator(".grid-wave-controls").isVisible(), false);
  assert.equal(await unavailablePage.getByRole("link", { name: "Grid data (JSON)" }).isVisible(), true);
  await unavailablePage.goto(site.url + "/");
  await unavailablePage.waitForSelector('[data-grid-backdrop][data-case="USA"][data-fallback]');
  assert.equal(await unavailablePage.locator(".grid-backdrop-caption:visible").count(), 0);
  assert.equal(await unavailablePage.locator("[data-inspectable]").count(), 0);
  await unavailable.close();
  const fallback = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await fallback.newPage();
  await staticPage.goto(site.url + "/");
  assert.equal(await staticPage.locator(".grid-backdrop-fallback img").count(), 4);
  assert.equal(await staticPage.locator(".grid-backdrop-caption:visible").count(), 0);
  assert.equal(await staticPage.locator(".home-copy .home-publications").count(), 1);
  await staticPage.setViewportSize({ width: 390, height: 844 });
  await staticPage.goto(site.url + "/projects/#usa-network");
  assert.equal(await staticPage.getByRole("link", { name: "publications", exact: true }).isVisible(), true);
  assert.equal(await staticPage.locator(".grid-still noscript img").isVisible(), true);
  await fallback.close();
  assert.deepEqual(errors, [], "Browser errors");
  assert.deepEqual(consoleErrors, [], "Console errors");
  console.log(
    "Browser checks passed: all-page accessibility in both themes, project links, skip navigation, publication controls, search, two kV scenes, lazy Europe data, stationary poses, transition masks, retained canvases and channels, responsive network centers, mobile, reduced motion, wave controls, no-JS content, and console."
  );
} finally {
  await browser?.close();
  await site.close();
}
