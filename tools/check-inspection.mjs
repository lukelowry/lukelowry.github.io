import { setAppearance } from "./check-appearance.mjs";
import assert from "node:assert/strict";

// Exercise real pointer/keyboard input against submitted GPU geometry, including dense branches.
export async function checkInspection(page, name) {
  const root = page.locator(`[data-grid-backdrop][data-case="${name}"]`);
  if ((await root.getAttribute("data-ready")) === null) return;
  await page.waitForSelector(`[data-grid-backdrop][data-case="${name}"][data-inspectable]`);
  const probe = await observeInspection(root);
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
    // Use the largest supported radii when finding a branch, so its target stays
    // selectable throughout both pressure and graph pulses (native pick radius is 4px).
    element.network.setChannel("vertexSize", new Float32Array(model.topology.vertexCount).fill(1.85), [0.85, 1.85]);
    for (const { index } of longEdges.slice(0, 500)) {
      const a = element.network.locate({ kind: "vertex", index: edges[index * 2] });
      const b = element.network.locate({ kind: "vertex", index: edges[index * 2 + 1] });
      if (!a || !b) continue;
      for (const t of Array.from({ length: 17 }, (_, i) => (i + 2) / 20)) {
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
    element.network.setChannel("vertexSize", null);
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
  await probe.wait("hovered", "vertex");
  await click(points.vertex);
  const pinned = await probe.selected();
  assert.equal(pinned.kind, "vertex");
  await move(points.edge);
  assert.deepEqual(await probe.selected(), pinned, "Hover must not replace the selected item");
  await click(points.vertex);
  assert.equal((await probe.selected()).kind, "edge", "Repeat clicks reach an overlapping branch");
  await click(points.edge);
  assert.equal((await probe.selected()).kind, "edge");
  await canvas.press("Escape");
  assert.equal(await probe.selected(), null);
  await move(points.empty);
  await move(points.edge);
  await probe.wait("hovered", "edge");
  assert.equal(await probe.selected(), null);
  await click(points.edge);
  await click(points.empty);
  assert.equal(await probe.selected(), null, "Blank-space clicks clear selection");

  // Focus remains reachable through the custom element's shadow boundary.
  await page.evaluate(() => document.querySelector(".skip-link").focus());
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.tagName), "CANVAS");
  const pose = await root.evaluate((root) => root.querySelector("latkit-network").network.getPose());
  await page.keyboard.press("ArrowRight");
  await probe.wait("selected", "vertex");
  await page.keyboard.press("ArrowDown");
  await probe.wait("selected", "edge");
  assert.deepEqual(
    await root.evaluate((root) => root.querySelector("latkit-network").network.getPose()),
    pose,
    "Selection keys must not move the camera"
  );
  await page.keyboard.press("Escape");
  assert.equal(await probe.selected(), null);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "A", "Tab leaves the network directly for page navigation");
  assert.equal(await page.locator(".grid-backdrop-caption").count(), 0, "Network interaction must not create a caption or info box");

  await move(points.vertex);
  await page.mouse.down();
  await page.mouse.move(points.vertex.x + 40, points.vertex.y + 25, { steps: 5 });
  await page.mouse.up();
  assert.deepEqual(await root.evaluate((root) => root.querySelector("latkit-network").network.getPose()), pose, "Dragging must not move the camera");
  assert.equal(await probe.selected(), null, "Dragging must not pin a selection");

  await checkPulse(page, root, points.vertex);
  const scroll = await page.evaluate(() => scrollY);
  await move(points.empty);
  await page.mouse.wheel(0, name === "USA" ? 80 : -80);
  await page.waitForFunction((before) => scrollY !== before, scroll);
  await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), scroll);
  console.log(`${name}: hover, bus/branch pinning, clearing, keyboard, drag, and wheel checks passed.`);
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
      if (document.elementFromPoint(...p) === element && !element.network.hitTest(...p, 32).length) return { x: p[0], y: p[1] };
    }
    return null;
  }, edge);
  assert.ok(point, "Lighting needs an exposed blank target near a branch");
  const clip = { x: Math.max(0, Math.floor(edge.x - 75)), y: Math.max(80, Math.floor(edge.y - 75)), width: 150, height: 150 };
  await page.mouse.move(700, 30);
  await page.waitForTimeout(1600);
  const before = await page.screenshot();
  await root.evaluate((root) => {
    const network = root.querySelector("latkit-network").network;
    const submit = GPUQueue.prototype.submit,
      setChannel = network.setChannel;
    window.__lightingCheck = {
      frames: [],
      channels: [],
      largest: 1,
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
      window.__lightingCheck.channels.push(args[0]);
      if (args[0] === "vertexSize" && args[1]) {
        window.__lightingCheck.largest = Math.max(
          window.__lightingCheck.largest,
          args[1].reduce((max, value) => Math.max(max, value), 1)
        );
      }
      return setChannel.apply(this, args);
    };
  });
  try {
    await page.mouse.move(point.x - 50, point.y + 30);
    await page.waitForTimeout(90);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(90);
    assert.ok(await page.evaluate(() => window.__lightingCheck.largest > 1.15), "Pointer movement must change native vertex radii");
    assert.equal(await root.locator(".grid-electric-trace").count(), 0, "The network has no separate cursor overlay");
    await page.waitForTimeout(1600);
    const lit = await page.screenshot();
    const visibleChange = await pixelDifference(page, lit, before, clip);
    assert.ok(
      visibleChange.maximum >= 12 && visibleChange.changedFraction >= 0.001,
      `The light needs measurable local contrast: ${JSON.stringify(visibleChange)}`
    );
    const settled = await page.evaluate(() => window.__lightingCheck.frames.length);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__lightingCheck.frames.length), settled, "A settled light must stop submitting frames");
    await page.mouse.move(700, 30);
    await page.waitForTimeout(1600);
    const after = await page.screenshot();
    await assertSamePixels(page, after, before, clip, "Leaving blank space must restore the unlit network");
    const departed = await page.evaluate(() => window.__lightingCheck.frames.length);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__lightingCheck.frames.length), departed, "Leave fade must settle back to idle");
    assert.ok(
      await page.evaluate(() => window.__lightingCheck.channels.length > 0 && window.__lightingCheck.channels.every((name) => name === "vertexSize")),
      "Pointer movement changes only the native size channel"
    );
    assert.equal(
      await root.evaluate((root) => root.querySelector("latkit-network").network.getChannelDomain("vertexSize")),
      null,
      "Leaving restores native radii"
    );
    const layout = await page.evaluate(() => [scrollY, document.body.scrollHeight]);
    await setAppearance(page, "Animation", "Off");
    await page.waitForFunction(
      (name) => document.querySelector(`[data-grid-backdrop][data-case="${name}"]`).dataset.lighting === "off",
      await root.getAttribute("data-case")
    );
    assert.deepEqual(
      await page.evaluate(() => [scrollY, document.body.scrollHeight]),
      layout,
      "Pausing effects must preserve the reading position and section layout"
    );
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(200);
    await assertSamePixels(page, await page.screenshot(), before, clip, "Pausing effects must restore native voltage colors without lighting");
  } finally {
    await page.evaluate(() => window.__lightingCheck.restore());
    await page.mouse.move(700, 30);
    await setAppearance(page, "Animation", "Full");
  }
  console.log(
    `${await root.getAttribute("data-case")}: electrical light output, idle, blank-space leave, native radius changes, and explicit pause passed.`
  );
}

async function pixelDifference(page, actual, expected, clip) {
  return page.evaluate(
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
}

async function assertSamePixels(page, actual, expected, clip, message) {
  const difference = await pixelDifference(page, actual, expected, clip);
  // GPU color quantization can differ by one unit after a new uniform submission.
  assert.ok(difference.maximum <= 2 && difference.changedFraction < 0.005, `${message}: ${JSON.stringify(difference)}`);
}

async function checkPulse(page, root, point) {
  await page.mouse.move(700, 30);
  await page.waitForTimeout(1600);
  await root.evaluate(async (root) => {
    const { loadGrid } = await import("/assets/js/grids/data.mjs");
    const model = await loadGrid(root);
    const network = root.querySelector("latkit-network").network;
    const original = network.setChannel;
    window.__pulseCheck = {
      uploads: [],
      sizes: [],
      restore: () => {
        network.setChannel = original;
      },
    };
    network.setChannel = function (name, values, ...rest) {
      if (name === "vertexSize") {
        window.__pulseCheck.sizes.push(values ? values.reduce((max, value) => Math.max(max, value), 1) : 1);
        return original.call(this, name, values, ...rest);
      }
      const mask = name === "vertexShade" ? model.visibleVertices : model.visibleEdges;
      window.__pulseCheck.uploads.push({
        name,
        reached: values.reduce((n, value) => n + Number(value >= 0), 0),
        valid: values.every((value, i) => Number.isFinite(value) && (mask[i] || value < 0)),
      });
      return original.call(this, name, values, ...rest);
    };
  });
  try {
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction(() => window.__pulseCheck.uploads.length === 2);
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => window.__pulseCheck.sizes.some((size) => size > 1.7)), "A connected pulse must enlarge actual vertices");
    const pulsing = await page.screenshot();
    await page.waitForTimeout(2900);
    const settled = await page.screenshot();
    const clip = {
      x: Math.max(0, Math.floor(point.x - 100)),
      y: Math.max(80, Math.floor(point.y - 100)),
      width: Math.min(200, (await page.viewportSize()).width - Math.max(0, Math.floor(point.x - 100))),
      height: 200,
    };
    const changed = await pixelDifference(page, pulsing, settled, clip);
    assert.ok(changed.maximum >= 8, `A dwell pulse must change network pixels: ${JSON.stringify(changed)}`);
    const uploads = await page.evaluate(() => window.__pulseCheck.uploads);
    assert.deepEqual(
      uploads.map((u) => u.name),
      ["vertexShade", "edgeShade"],
      "One dwell binds only two shade channels, once"
    );
    assert.ok(
      uploads.every((u) => u.valid && u.reached > 0),
      "Pulses reach visible connections only"
    );
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.__pulseCheck.uploads.length === 4);
    await setAppearance(page, "Animation", "Off");
    await page.waitForFunction(
      (name) => document.querySelector(`[data-grid-backdrop][data-case="${name}"]`).dataset.lighting === "off",
      await root.getAttribute("data-case")
    );
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.__pulseCheck.uploads.length), 4, "Pausing effects suppresses selection pulses too");
    await root.locator("canvas").press("Escape");
  } finally {
    await page.evaluate(() => {
      window.__pulseCheck.restore();
      delete window.__pulseCheck;
    });
    await page.mouse.move(700, 30);
    await setAppearance(page, "Animation", "Full");
    await page.waitForFunction(
      (name) => document.querySelector(`[data-grid-backdrop][data-case="${name}"]`).dataset.lighting === "on",
      await root.getAttribute("data-case")
    );
  }
  console.log(`${await root.getAttribute("data-case")}: visible dwell pulse, one-time field uploads, selection pulse, and explicit pause passed.`);
}

// Test-only observation of native events and programmatic selection, without UI readouts.
export async function observeInspection(root) {
  await root.evaluate((root) => {
    const element = root.querySelector("latkit-network");
    const network = element.network;
    const select = network.select;
    const state = (root.__inspectionCheck = { selected: null, hovered: null });
    element.addEventListener("select", (event) => {
      state.selected = event.detail;
    });
    element.addEventListener("hover", (event) => {
      state.hovered = event.detail;
    });
    network.select = function (item) {
      state.selected = item;
      return select.call(this, item);
    };
  });
  return {
    selected: () => root.evaluate((root) => root.__inspectionCheck.selected),
    wait: async (field, kind) =>
      root
        .page()
        .waitForFunction(
          ({ name, field, kind }) => document.querySelector(`[data-grid-backdrop][data-case="${name}"]`).__inspectionCheck[field]?.kind === kind,
          { name: await root.getAttribute("data-case"), field, kind }
        ),
  };
}
