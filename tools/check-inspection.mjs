import assert from "node:assert/strict";

// Exercise real pointer/keyboard input against submitted GPU geometry, including dense branches.
export async function checkInspection(page, name) {
  const root = page.locator(`[data-grid-backdrop][data-case="${name}"]`);
  if ((await root.getAttribute("data-ready")) === null) return;
  await page.waitForSelector(`[data-grid-backdrop][data-case="${name}"][data-inspectable]`);
  const caption = page.locator(`[data-grid-caption="${name}"]`);
  const readout = caption.locator(".grid-backdrop-readout");
  const status = caption.getByRole("status");
  const canvas = root.locator("canvas");
  const points = await root.evaluate(async (root) => {
    const element = root.querySelector("latkit-network");
    const rect = root.getBoundingClientRect();
    const points = {};
    const { loadGrid } = await import("/assets/js/grids/data.mjs");
    const model = await loadGrid(root);
    const exposed = (p) =>
      p &&
      p[0] > Math.max(30, rect.left + rect.width * 0.05) &&
      p[0] < Math.min(innerWidth - 30, rect.right - rect.width * 0.11) &&
      p[1] > 120 &&
      p[1] < innerHeight - 180 &&
      document.elementFromPoint(...p) === element;
    for (let index = 0; index < model.numbers.length; index++) {
      if (!model.visibleVertices[index]) continue;
      const p = element.network.locate({ kind: "vertex", index });
      if (!exposed(p)) continue;
      const hits = element.network.hitTest(...p);
      if (hits[0]?.kind === "vertex" && hits[1]?.kind === "edge" && hits.length === 2) {
        points.vertex = { x: p[0], y: p[1] };
        break;
      }
    }
    const edges = model.topology.edges,
      coords = model.topology.vertexCoords;
    const longEdges = [];
    for (let index = 0; index < model.visibleEdges.length; index++) {
      if (!model.visibleEdges[index]) continue;
      const a = edges[index * 2],
        b = edges[index * 2 + 1];
      longEdges.push({ index, length: (coords[a * 2] - coords[b * 2]) ** 2 + (coords[a * 2 + 1] - coords[b * 2 + 1]) ** 2 });
    }
    longEdges.sort((a, b) => b.length - a.length);
    for (const { index } of longEdges.slice(0, 300)) {
      const a = element.network.locate({ kind: "vertex", index: edges[index * 2] });
      const b = element.network.locate({ kind: "vertex", index: edges[index * 2 + 1] });
      if (!a || !b) continue;
      for (const t of [0.5, 0.25, 0.75]) {
        const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (!exposed(p)) continue;
        const hits = element.network.hitTest(...p);
        if (!hits.length) points.empty ||= { x: p[0], y: p[1] };
        if (hits[0]?.kind === "edge") {
          points.edge = { x: p[0], y: p[1] };
          break;
        }
      }
      if (points.edge) break;
    }
    for (const p of [
      [rect.left + rect.width * 0.3, 140],
      [rect.left + rect.width * 0.5, innerHeight - 200],
      [rect.left + rect.width * 0.7, 160],
    ]) {
      if (exposed(p) && !element.network.hitTest(...p, 22).length) {
        points.empty = { x: p[0], y: p[1] };
        break;
      }
    }
    return points;
  });
  assert.ok(points.vertex && points.edge && points.empty, `${name}: exposed bus, branch, and blank-space targets: ${JSON.stringify(points)}`);
  console.log(`${name}: targets ${JSON.stringify(points)}`);
  await checkLighting(page, root, points.edge);
  const move = async (point) => page.mouse.move(point.x, point.y);
  const click = async (point) => page.mouse.click(point.x, point.y);
  await move(points.vertex);
  await page.waitForFunction(
    (name) => document.querySelector(`[data-grid-caption="${name}"] .grid-backdrop-readout`).textContent.includes("Bus "),
    name
  );
  assert.equal(await status.textContent(), "", "Hover must not fill the live region");
  await click(points.vertex);
  const pinned = await readout.innerText();
  assert.match(pinned, /Bus \d+.*kV.*Selected/);
  assert.match(await status.innerText(), /Selected/);
  await move(points.edge);
  assert.equal(await readout.innerText(), pinned, "Hover must not replace a pinned readout");
  await click(points.vertex);
  assert.match(await readout.innerText(), /Branch \d+.*Selected/, "Repeat clicks must reach an overlapping branch");
  await click(points.edge);
  assert.match(await readout.innerText(), /Branch \d+.*\d+.*kV.*Selected/);
  await canvas.press("Escape");
  assert.match(await readout.innerText(), /Hover or select/);
  await move(points.empty);
  await move(points.edge);
  await page.waitForFunction(
    (name) => document.querySelector(`[data-grid-caption="${name}"] .grid-backdrop-readout`).textContent.includes("Branch "),
    name
  );
  assert.doesNotMatch(await readout.innerText(), /Selected/);
  await click(points.edge);
  await click(points.empty);
  assert.match(await readout.innerText(), /Hover or select/);

  // Focus must be reachable by Tab through the custom element's shadow boundary.
  await page.evaluate(() => document.querySelector(".skip-link").focus());
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.tagName), "CANVAS");
  const pose = await root.evaluate((root) => root.querySelector("latkit-network").network.getPose());
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (name) => /Bus .*Selected/.test(document.querySelector(`[data-grid-caption="${name}"] .grid-backdrop-readout`).textContent),
    name
  );
  assert.match(await readout.innerText(), /Bus \d+.*Selected/);
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(
    (name) => /Branch .*Selected/.test(document.querySelector(`[data-grid-caption="${name}"] .grid-backdrop-readout`).textContent),
    name
  );
  assert.match(await readout.innerText(), /Branch \d+.*Selected/);
  assert.equal(await caption.locator(".grid-backdrop-help").isVisible(), true);
  assert.deepEqual(
    await root.evaluate((root) => root.querySelector("latkit-network").network.getPose()),
    pose,
    "Selection keys must not move the camera"
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await caption
      .getByRole("button", { name: `Clear ${name === "EuropeA" ? "Europe" : name} selection` })
      .evaluate((e) => e === document.activeElement),
    true
  );
  await page.keyboard.press("Enter");
  assert.match(await readout.innerText(), /Hover or select/);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "A", "Tab must leave the network");

  await move(points.vertex);
  await page.mouse.down();
  await page.mouse.move(points.vertex.x + 40, points.vertex.y + 25, { steps: 5 });
  await page.mouse.up();
  assert.deepEqual(await root.evaluate((root) => root.querySelector("latkit-network").network.getPose()), pose, "Dragging must not move the camera");
  assert.doesNotMatch(await readout.innerText(), /Selected/, "Dragging must not pin a selection");
  const label = await caption.boundingBox();
  assert.ok(label.y >= 80 && label.y + label.height <= (await page.viewportSize()).height, "Label must fit the viewport");

  const scroll = await page.evaluate(() => scrollY);
  await move(points.empty);
  await page.mouse.wheel(0, name === "USA" ? 80 : -80);
  await page.waitForFunction((before) => scrollY !== before, scroll);
  await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), scroll);
  console.log(`${name}: hover, bus/branch pinning, clearing, keyboard, drag, and wheel checks passed.`);
}

// Browser-native touch input: a tap pins, while a vertical gesture scrolls and
// cancels selection. Synthetic pointer events alone cannot verify touch-action.
export async function checkTouchInspection(browser, url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  context.setDefaultTimeout(20000);
  await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
  await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready], [data-grid-backdrop][data-case="USA"][data-fallback]');
    if (!(await page.locator('[data-case="USA"][data-inspectable]').count())) return;
    const point = await page.evaluate(async () => {
      const root = document.querySelector('[data-grid-backdrop][data-case="USA"]');
      const element = root.querySelector("latkit-network");
      const { loadGrid } = await import("/assets/js/grids/data.mjs");
      const model = await loadGrid(root);
      for (let index = 0; index < model.visibleVertices.length; index++) {
        if (!model.visibleVertices[index]) continue;
        const p = element.network.locate({ kind: "vertex", index });
        if (p && p[0] > 25 && p[0] < innerWidth - 25 && p[1] > 260 && p[1] < 570 && document.elementFromPoint(...p) === element) return p;
      }
      return null;
    });
    assert.ok(point, "Mobile network must have an exposed tap target");
    const readout = page.locator('[data-grid-caption="USA"] .grid-backdrop-readout');
    await page.touchscreen.tap(...point);
    assert.match(await readout.innerText(), /Selected/);
    await page.getByRole("button", { name: "Clear USA selection", exact: true }).click();
    const session = await context.newCDPSession(page);
    // A second contact anywhere on the page must cancel the first pending tap.
    for (const second of [
      [point[0] + 35, point[1] + 10],
      [350, 130],
    ]) {
      const first = { id: 1, x: point[0], y: point[1] };
      const other = { id: 2, x: second[0], y: second[1] };
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, other] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [other] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      assert.doesNotMatch(await readout.innerText(), /Selected/, "A two-contact gesture must not pin a selection");
    }
    await page.touchscreen.tap(...point);
    assert.match(await readout.innerText(), /Selected/, "Single-touch inspection must recover after two contacts");
    await page.getByRole("button", { name: "Clear USA selection", exact: true }).click();
    const start = await page.evaluate(() => scrollY);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point[0], y: point[1] }] });
    for (let step = 1; step <= 6; step++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point[0], y: point[1] - step * 25 }] });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction((start) => scrollY > start + 20, start);
    assert.doesNotMatch(await readout.innerText(), /Selected/, "A swipe must not pin a bus or branch");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log("Mobile native touch: tap, two-contact cancellation, recovery, and page scrolling passed.");
  } finally {
    await context.close();
  }
}

// Exercise native shade output and idle behavior, including the blank-space leave
// that does not itself change the picked item. No production instrumentation.
async function checkLighting(page, root, edge) {
  await page.waitForFunction(
    (name) => document.querySelector(`[data-grid-backdrop][data-case="${name}"]`).dataset.lighting === "on",
    await root.getAttribute("data-case")
  );
  const point = await root.evaluate((root, edge) => {
    const element = root.querySelector("latkit-network");
    for (const [dx, dy] of [
      [60, 0],
      [-60, 0],
      [0, 60],
      [0, -60],
      [90, 30],
    ]) {
      const p = [edge.x + dx, edge.y + dy];
      if (document.elementFromPoint(...p) === element && !element.network.hitTest(...p, 22).length) return { x: p[0], y: p[1] };
    }
    return null;
  }, edge);
  assert.ok(point, "Lighting needs an exposed blank target near a branch");
  const clip = { x: Math.max(0, Math.floor(edge.x - 75)), y: Math.max(80, Math.floor(edge.y - 75)), width: 150, height: 150 };
  await page.mouse.move(700, 30);
  await page.waitForTimeout(900);
  const before = await page.screenshot();
  await root.evaluate((root) => {
    const network = root.querySelector("latkit-network").network;
    const submit = GPUQueue.prototype.submit,
      setChannel = network.setChannel;
    window.__lightingCheck = {
      frames: [],
      channels: 0,
      restore() {
        GPUQueue.prototype.submit = submit;
        network.setChannel = setChannel;
        delete window.__lightingCheck;
      },
    };
    GPUQueue.prototype.submit = function (...args) {
      window.__lightingCheck.frames.push(performance.now());
      return submit.apply(this, args);
    };
    network.setChannel = function (...args) {
      window.__lightingCheck.channels++;
      return setChannel.apply(this, args);
    };
  });
  try {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(900);
    const lit = await page.screenshot();
    assert.notDeepEqual(lit, before, "Native spotlight must visibly recolor nearby network geometry");
    const settled = await page.evaluate(() => window.__lightingCheck.frames.length);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__lightingCheck.frames.length), settled, "A settled light must stop submitting frames");
    await page.mouse.move(700, 30);
    await page.waitForTimeout(900);
    const after = await page.screenshot();
    await assertSamePixels(page, after, before, clip, "Leaving blank space must restore the unlit network");
    const departed = await page.evaluate(() => window.__lightingCheck.frames.length);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__lightingCheck.frames.length), departed, "Leave fade must settle back to idle");
    assert.equal(await page.evaluate(() => window.__lightingCheck.channels), 0, "Lighting must not upload data channels");
    const layout = await page.evaluate(() => [scrollY, document.body.scrollHeight]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      (name) => document.querySelector(`[data-grid-backdrop][data-case="${name}"]`).dataset.lighting === "off",
      await root.getAttribute("data-case")
    );
    assert.deepEqual(
      await page.evaluate(() => [scrollY, document.body.scrollHeight]),
      layout,
      "Reduced motion must preserve the reading position and section layout"
    );
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(200);
    await assertSamePixels(page, await page.screenshot(), before, clip, "Reduced motion must keep native voltage colors without lighting");
  } finally {
    await page.evaluate(() => window.__lightingCheck.restore());
    await page.mouse.move(700, 30);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  console.log(
    `${await root.getAttribute("data-case")}: native spotlight output, idle, blank-space leave, zero channel writes, and reduced motion passed.`
  );
}

async function assertSamePixels(page, actual, expected, clip, message) {
  const difference = await page.evaluate(
    async ({ images, clip }) => {
      const pixels = await Promise.all(
        images.map(async (url) => {
          const bitmap = await createImageBitmap(await (await fetch(url)).blob());
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(bitmap, 0, 0);
          bitmap.close();
          return context.getImageData(clip.x, clip.y, clip.width, clip.height).data;
        })
      );
      let maximum = 0,
        changed = 0;
      for (let i = 0; i < pixels[0].length; i++) {
        const delta = Math.abs(pixels[0][i] - pixels[1][i]);
        maximum = Math.max(maximum, delta);
        if (delta) changed++;
      }
      return { maximum, changedFraction: changed / pixels[0].length };
    },
    { images: [actual, expected].map((buffer) => `data:image/png;base64,${buffer.toString("base64")}`), clip }
  );
  // GPU color quantization can differ by one unit after a new uniform submission.
  assert.ok(difference.maximum <= 2 && difference.changedFraction < 0.005, `${message}: ${JSON.stringify(difference)}`);
}
