import assert from "node:assert/strict";

export async function checkEffectPreference(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
    await page.goto(url);
    const root = page.locator('[data-grid-backdrop][data-case="USA"]');
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="off"]');
    const caption = page.locator('[data-grid-caption="USA"]');
    assert.match(await caption.locator("[data-grid-effects-note]").innerText(), /system's motion setting/);
    await caption.getByRole("button", { name: "Enable effects", exact: true }).click();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-lighting="on"]');
    assert.equal(
      await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
      true,
      "Site opt-in must not depend on overriding the browser's motion preference"
    );
    await root.evaluate((root) => {
      const network = root.querySelector("latkit-network").network;
      const original = network.setChannel;
      window.__sizeOptIn = [];
      network.setChannel = function (name, values, ...rest) {
        if (name === "vertexSize" && values) window.__sizeOptIn.push(values.reduce((max, value) => Math.max(max, value), 1));
        return original.call(this, name, values, ...rest);
      };
    });
    await page.mouse.move(180, 420);
    await page.waitForTimeout(90);
    await page.mouse.move(320, 460);
    await page.waitForTimeout(100);
    assert.ok(
      await page.evaluate(() => window.__sizeOptIn?.some((size) => size > 1.4)),
      "Explicit opt-in must visibly enlarge real vertices while Chrome still reports reduced motion"
    );
    assert.equal(await root.locator(".grid-electric-trace").count(), 0, "No separate cursor overlay remains");
    await page.reload();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-ready][data-lighting="on"]');
    assert.equal(await page.evaluate(() => localStorage.getItem("grid-effects")), "on", "The site choice survives reload");
    await caption.getByRole("button", { name: "Use system setting", exact: true }).click();
    await page.waitForSelector('[data-grid-backdrop][data-case="USA"][data-lighting="off"]');
    assert.equal(await root.evaluate((root) => root.querySelector("latkit-network").network.getChannelDomain("vertexSize")), null);
    assert.equal(await page.evaluate(() => localStorage.getItem("grid-effects")), null);
    console.log(
      "System reduced motion: explicit opt-in runs shader and real vertex-size waves, persists on reload, and can return to the system setting."
    );
  } finally {
    await context.close();
  }
}
