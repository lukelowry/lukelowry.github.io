import assert from "node:assert/strict";
import { setAppearance } from "./check-appearance.mjs";
import { observeInspection } from "./check-inspection.mjs";

export async function checkSpring(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
  await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(url);
    await page.waitForSelector('[data-case="USA"][data-ready], [data-case="USA"][data-fallback]');
    if (await page.locator('[data-case="USA"][data-fallback]').count()) {
      assert.equal(await page.evaluate(async () => Boolean(navigator.gpu && (await navigator.gpu.requestAdapter()))), false);
      return;
    }
    assert.equal(await page.locator("html").getAttribute("data-network-effect"), "spring");
    for (const name of ["USA", "EuropeA"]) {
      if (name === "EuropeA") await page.locator(".home-scene-europe").scrollIntoViewIfNeeded();
      const root = page.locator(`[data-grid-backdrop][data-case="${name}"]`);
      await page.waitForSelector(`[data-case="${name}"][data-ready][data-inspectable][data-lighting="on"]:not([data-fitting])`);
      await page.mouse.move(700, 30);
      await page.waitForTimeout(400);
      const source = await root.evaluate(async (root) => {
        const element = root.querySelector("latkit-network"),
          n = element.network;
        const { loadGrid } = await import("/assets/js/grids/data.mjs");
        const model = await loadGrid(root),
          rect = root.getBoundingClientRect();
        const points = [];
        for (let id = 0; id < model.topology.vertexCount; id++)
          if (model.visibleVertices[id]) {
            const p = n.locate({ kind: "vertex", index: id });
            if (p && p[0] > 40 && p[0] < innerWidth - 40 && p[1] > 160 && p[1] < innerHeight - 180 && document.elementFromPoint(...p) === element)
              points.push({ id, p });
          }
        points.sort(
          (a, b) => Math.hypot(a.p[0] - (rect.left + rect.width / 2), a.p[1] - 450) - Math.hypot(b.p[0] - (rect.left + rect.width / 2), b.p[1] - 450)
        );
        const source = points[0],
          target = [source.p[0] - 35, source.p[1]];
        const near = points
          .filter(({ p }) => Math.hypot(p[0] - target[0], p[1] - target[1]) < 180)
          .filter((p, i) => i % 7 === 0)
          .slice(0, 80);
        const far = points.filter(({ p }) => Math.hypot(p[0] - target[0], p[1] - target[1]) > 310).slice(0, 30);
        const check = (root.__spring = {
          n,
          source,
          target,
          near,
          far,
          writes: 0,
          bound: false,
          peak: 0,
          farPeak: 0,
          shadeWrites: 0,
          pose: n.getPose(),
        });
        const original = n.setChannel;
        n.setChannel = function (channel, values, ...rest) {
          const result = original.call(this, channel, values, ...rest);
          if (channel === "vertexShade" && values) check.shadeWrites++;
          if (channel === "vertexPosition") {
            check.writes++;
            check.bound = !!values;
            for (const { id, p } of near) {
              const q = n.locate({ kind: "vertex", index: id });
              check.peak = Math.max(check.peak, Math.hypot(q[0] - p[0], q[1] - p[1]));
            }
            for (const { id, p } of far) {
              const q = n.locate({ kind: "vertex", index: id });
              check.farPeak = Math.max(check.farPeak, Math.hypot(q[0] - p[0], q[1] - p[1]));
            }
          }
          return result;
        };
        return { target, source };
      });
      for (const theme of ["Light", "Dark"]) {
        await setAppearance(page, "Theme", theme);
        await page.waitForSelector(`[data-case="${name}"][data-lighting="on"]`);
        await root.evaluate((root) => {
          root.__spring.peak = 0;
          root.__spring.farPeak = 0;
        });
        await page.mouse.move(...source.target);
        await page.waitForTimeout(550);
        const motion = await root.evaluate((root) => ({
          peak: root.__spring.peak,
          far: root.__spring.farPeak,
          writes: root.__spring.writes,
          pose: root.__spring.n.getPose(),
          original: root.__spring.pose,
        }));
        assert.ok(motion.peak > 2, `${name}/${theme}: visible movement (${motion.peak}px)`);
        assert.ok(motion.peak <= (name === "USA" ? 9.01 : 5.01), `${name}: bounded movement`);
        assert.ok(motion.far < 0.05, "Distant map geometry stays visually fixed");
        assert.deepEqual(motion.pose, motion.original, "The effect never moves the camera");
        await page.mouse.move(700, 30);
        await page.waitForTimeout(2600);
        const settled = await root.evaluate((root) => ({
          bound: root.__spring.bound,
          writes: root.__spring.writes,
          delta: Math.max(
            ...root.__spring.near.map(({ id, p }) => {
              const q = root.__spring.n.locate({ kind: "vertex", index: id });
              return Math.hypot(q[0] - p[0], q[1] - p[1]);
            })
          ),
        }));
        assert.equal(settled.bound, false);
        assert.equal(settled.delta, 0, "Every sampled vertex returns exactly to its rest position");
        await page.waitForTimeout(200);
        assert.equal(await root.evaluate((root) => root.__spring.writes), settled.writes, "Position uploads stop when settled");
        console.log(`Spring ${name}/${theme}: ${motion.peak.toFixed(2)}px peak, fixed distant vertices/camera, exact restoration and idle.`);
      }
      // Resting over a vertex must settle naturally without activation.
      const probe = await observeInspection(root);
      await page.mouse.move(...source.source.p);
      await page.waitForTimeout(3000);
      assert.equal(await probe.selected(), null, "Resting a pointer never selects a bus");
      const hoverWrites = await root.evaluate((root) => root.__spring.writes);
      await page.waitForTimeout(300);
      assert.equal(await root.evaluate((root) => root.__spring.writes), hoverWrites, "A stationary pointer settles without a delayed pluck");
      await page.mouse.move(700, 30);
      await page.waitForTimeout(2600);
      await page.mouse.move(...source.target);
      await page.waitForTimeout(170);
      // A held native press freezes at the visible target until the exact picker settles.
      const moved = await root.evaluate((root) => root.__spring.n.locate({ kind: "vertex", index: root.__spring.source.id }));
      await page.mouse.move(...moved);
      await page.mouse.down();
      await page.waitForTimeout(80);
      await page.mouse.up();
      await probe.wait("selected", "vertex");
      await root.locator("canvas").press("Escape");
      // Force down/up between native frames to exercise the bounded exact-pick retry.
      for (const drag of [0, 4]) {
        await page.mouse.move(700, 30);
        await page.mouse.move(...source.target);
        await page.waitForTimeout(170);
        await root.evaluate((root, drag) => {
          const element = root.querySelector("latkit-network"),
            canvas = element.shadowRoot.querySelector("canvas");
          const p = element.network.locate({ kind: "vertex", index: root.__spring.source.id });
          const send = (type, offset, buttons) =>
            canvas.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                composed: true,
                pointerType: "mouse",
                pointerId: 1,
                button: 0,
                buttons,
                clientX: p[0] + offset,
                clientY: p[1],
              })
            );
          send("pointerdown", 0, 1);
          if (drag) send("pointermove", drag, 1);
          send("pointerup", drag, 0);
        }, drag);
        if (drag) {
          await page.waitForTimeout(200);
          assert.equal(await probe.selected(), null, "A 4px native-canceled drag is not replayed as a click");
        } else await probe.wait("selected", "vertex");
        await root.locator("canvas").press("Escape");
      }
      for (const preset of ["Electric", "Spring", "Electric", "Spring"]) {
        await setAppearance(page, "Network effect", preset);
        await page.waitForSelector(`[data-case="${name}"][data-lighting="on"]`);
        assert.equal(await root.evaluate((root) => root.__spring.bound), false, "Preset switches restore native positions");
      }
      await page.reload();
      assert.equal(await page.locator("html").getAttribute("data-network-effect"), "spring", "Preset choice persists");
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
