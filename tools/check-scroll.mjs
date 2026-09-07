import assert from "node:assert/strict";

export async function checkScroll(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/livereload.js*", (r) => r.fulfill({ body: "" }));
  await context.route("**/googletagmanager.com/**", (r) => r.fulfill({ body: "" }));
  const page = await context.newPage();
  try {
    await page.goto(url);
    await page.waitForSelector('[data-case="USA"][data-ready], [data-case="USA"][data-fallback]');
    if (await page.locator('[data-case="USA"][data-fallback]').count()) return;
    await page.waitForSelector('[data-case="USA"][data-lighting="on"]:not([data-fitting])');
    await page.mouse.move(700, 30);
    await page.evaluate(async () => {
      const root = document.querySelector('[data-grid-backdrop][data-case="USA"]'),
        element = root.querySelector("latkit-network"),
        n = element.network;
      const { loadGrid } = await import("/assets/js/grids/data.mjs");
      const m = await loadGrid(root);
      const probes = [];
      for (let id = 0; id < m.topology.vertexCount; id++)
        if (m.visibleVertices[id]) {
          const p = n.locate({ kind: "vertex", index: id });
          if (p && Math.hypot(p[0] - 250, p[1] - 450) < 150) probes.push({ id, p });
        }
      const points = probes.filter((_, i) => i % 25 === 0);
      const delta = () =>
        Math.max(
          ...points.map(({ id, p }) => {
            const q = n.locate({ kind: "vertex", index: id });
            return Math.hypot(q[0] - p[0], q[1] - p[1]);
          })
        );
      const check = (window.__scrollCheck = {
        root,
        n,
        delta,
        clears: [],
        poses: [],
        frames: 0,
        positionWrites: 0,
        rect: root.getBoundingClientRect().toJSON(),
        pose: n.getPose(),
      });
      const original = n.setChannel;
      n.setChannel = function (channel, values, ...rest) {
        if (channel === "vertexPosition") check.positionWrites++;
        if (channel === "vertexPosition" && values === null) check.clears.push(delta());
        return original.call(this, channel, values, ...rest);
      };
      for (const method of ["fit", "panBy", "setPose"]) {
        const original = n[method];
        n[method] = function (...args) {
          check.poses.push(method);
          return original.apply(this, args);
        };
      }
      const submit = GPUQueue.prototype.submit;
      GPUQueue.prototype.submit = function (...args) {
        check.frames++;
        return submit.apply(this, args);
      };
    });
    await page.mouse.move(250, 450);
    await page.waitForTimeout(200);
    assert.ok((await page.evaluate(() => __scrollCheck.delta())) > 2, "Start scrolling during a visible deformation");
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(80);
    const during = await page.evaluate(() => ({
      clears: __scrollCheck.clears,
      delta: __scrollCheck.delta(),
      scrollY,
      rect: __scrollCheck.root.getBoundingClientRect().toJSON(),
    }));
    assert.ok(during.scrollY > 0, "Wheel input scrolls the document");
    assert.deepEqual(during.clears, [], "Scrolling must not clear active vertex positions");
    assert.ok(during.delta > 0.5, "The elastic field continues relaxing after scroll begins");
    assert.deepEqual(during.rect, await page.evaluate(() => __scrollCheck.rect), "Canvas layout stays anchored");
    await page.waitForTimeout(2400);
    const rested = await page.evaluate(() => ({
      clears: __scrollCheck.clears,
      delta: __scrollCheck.delta(),
      frames: __scrollCheck.frames,
      poses: __scrollCheck.poses,
      pose: __scrollCheck.n.getPose(),
      initial: __scrollCheck.pose,
    }));
    assert.equal(rested.delta, 0);
    assert.ok(
      rested.clears.every((d) => d < 0.03),
      "Only subpixel settled displacement may be cleared"
    );
    assert.deepEqual(rested.poses, [], "Scrolling never recalibrates the camera");
    assert.deepEqual(rested.pose, rested.initial);
    // Small scrolls inside a scene should not keep waking an idle renderer.
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(150);
    const first = await page.evaluate(() => ({ frames: __scrollCheck.frames, positions: __scrollCheck.positionWrites }));
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => __scrollCheck.positionWrites),
      first.positions,
      "Stationary pointer updates during scroll do not restart a wave"
    );
    assert.ok(
      (await page.evaluate(() => __scrollCheck.frames)) - first.frames <= 4,
      "Native hover refresh stays bounded without continuous rendering"
    );
    const boundary = await page.locator('[data-grid-section="EuropeA"]').evaluate((e) => scrollY + e.getBoundingClientRect().top);
    await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), boundary - 500);
    await page.waitForTimeout(100);
    const seam = await page.evaluate(() => ({
      y: document.querySelector('[data-grid-section="EuropeA"]').getBoundingClientRect().top,
      height: innerHeight,
      tracks: [...document.querySelectorAll(".grid-backdrop-track")].map((el) => ({
        name: el.dataset.case,
        clip: getComputedStyle(el).clipPath,
        mask: getComputedStyle(el).maskImage,
        before: parseFloat(el.style.getPropertyValue("--grid-switch-before")),
        after: parseFloat(el.style.getPropertyValue("--grid-switch-after")),
      })),
      rootStyle: document.documentElement.style.getPropertyValue("--grid-switch-before"),
    }));
    for (const track of seam.tracks) {
      assert.ok(track.mask.includes("linear-gradient"));
      assert.ok(Math.abs(track.before - (seam.y - 36)) < 0.01 && Math.abs(track.after - (seam.y + 36)) < 0.01);
      const values = track.clip.match(/[-\d.]+(?=px)/g).map(Number);
      if (track.name === "USA") assert.ok(Math.abs(seam.height - values[2] - track.after) < 0.01, "USA clipping preserves the full fade");
      else assert.ok(Math.abs(values[0] - track.before) < 0.01, "Europe clipping preserves the full fade");
    }
    assert.equal(seam.rootStyle, "", "Scroll styles are scoped to the backdrop tracks");
    await page.evaluate(() => document.documentElement.classList.add("transition"));
    const properties = await page.locator("main").evaluate((el) => getComputedStyle(el).transitionProperty);
    assert.ok(
      !properties
        .split(",")
        .map((v) => v.trim())
        .includes("all"),
      "Theme transitions cannot animate layout geometry"
    );
    await page.evaluate(() => document.documentElement.classList.remove("transition"));
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(100);
    await page.mouse.move(700, 30);
    await page.mouse.move(250, 450);
    await page.waitForTimeout(200);
    assert.ok((await page.evaluate(() => __scrollCheck.delta())) > 2);
    await page.evaluate(() => scrollTo({ top: 100000, behavior: "instant" }));
    await page.waitForSelector('[data-case="USA"][data-active="false"]');
    assert.equal(await page.evaluate(() => __scrollCheck.delta()), 0, "Fully hidden scenes retire their wave state");
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForSelector('[data-case="USA"][data-active="true"]');
    assert.equal(await page.evaluate(() => __scrollCheck.delta()), 0, "Returning scenes never resume stale deformation");
    console.log(
      "Scroll: smooth relaxation, stable camera/canvas, bounded hover work, full fades, hidden-scene reset and color-only theme transitions passed."
    );
  } finally {
    await context.close();
  }
}
