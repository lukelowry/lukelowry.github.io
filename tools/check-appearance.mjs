import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export async function setAppearance(page, group, value) {
  const panel = page.getByRole("dialog", { name: "Accessibility & appearance", exact: true });
  if (!(await panel.isVisible())) await page.getByRole("button", { name: "Accessibility and appearance", exact: true }).click();
  await panel.getByRole("group", { name: group, exact: true }).getByRole("radio", { name: value, exact: true }).check();
  await page.keyboard.press("Escape");
}

export async function checkAppearance(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
  await context.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
  const page = await context.newPage();
  try {
    await page.goto(url);
    const toggle = page.getByRole("button", { name: "Accessibility and appearance", exact: true });
    const panel = page.getByRole("dialog", { name: "Accessibility & appearance", exact: true });
    assert.equal(await page.locator(".grid-backdrop-caption").count(), 0, "Background networks have no caption or hover readout");
    const desktopIcon = await toggle.boundingBox();
    assert.equal(1440 - desktopIcon.x - desktopIcon.width, 12, "The icon is at the viewport's far-right edge");
    await toggle.focus();
    await page.keyboard.press("Enter");
    assert.equal(await panel.isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.value), "system");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("html").getAttribute("data-theme-setting"), "light", "Theme options support native arrow-key selection");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.value), "full");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("html").getAttribute("data-animation"), "reduced");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.value), "standard");
    await page.keyboard.press("Escape");
    assert.equal(await panel.isVisible(), false);
    assert.equal(await toggle.evaluate((el) => el === document.activeElement), true, "Escape restores focus to the icon");
    await setAppearance(page, "Contrast", "High");
    await page.goto(url + "/publications/");
    assert.equal(await page.locator("html").getAttribute("data-theme-setting"), "light");
    assert.equal(await page.locator("html").getAttribute("data-animation"), "reduced");
    assert.equal(await page.locator("html").getAttribute("data-contrast"), "high", "Preferences persist across pages");
    for (const theme of ["Light", "Dark"]) {
      await setAppearance(page, "Theme", theme);
      for (const contrast of ["High", "Standard"]) {
        await setAppearance(page, "Contrast", contrast);
        await toggle.click();
        await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
        const violations = await page.evaluate(async () =>
          (await axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(({ id, nodes }) => ({
            id,
            nodes: nodes.map((node) => node.target),
          }))
        );
        assert.deepEqual(violations, [], `${theme}/${contrast}: accessibility with the panel open`);
        await page.keyboard.press("Escape");
      }
    }
    for (const path of ["/", "/publications/", "/projects/", "/cv/"]) {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(url + path);
      assert.equal(await toggle.isVisible(), true, "The accessibility icon stays visible outside collapsed navigation");
      const icon = await toggle.boundingBox();
      assert.equal(320 - icon.x - icon.width, 12, "The mobile icon stays at the viewport's far-right edge");
      const navigation = await page.getByRole("button", { name: "Toggle navigation", exact: true }).boundingBox();
      assert.ok(navigation.x + navigation.width <= icon.x - 4, "Mobile navigation does not overlap the accessibility icon");
      await toggle.click();
      const box = await panel.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 320 && box.y + box.height <= 740, `${path}: panel fits a 320px viewport`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // Dismiss from the page gutter without activating a project link underneath.
      await page.mouse.click(2, 650);
      assert.equal(await panel.isVisible(), false, "Clicking outside dismisses the panel");
    }
    await setAppearance(page, "Animation", "Full");
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-animation"), "full");
    console.log("Appearance: keyboard, focus, persistence, light/dark and high contrast accessibility, and mobile header layout passed.");
  } finally {
    await context.close();
  }
}
