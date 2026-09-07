import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function checkResearchLinks(page, url) {
  await page.goto(url + "/", { waitUntil: "networkidle" });
  const profiles = page.getByRole("navigation", { name: "Contact and profiles" });
  for (const name of ["Email", "GitHub", "Google Scholar", "ORCID", "Download CV (PDF)"]) {
    // Includes pointer hit testing: the network layer must not intercept these links.
    await profiles.getByRole("link", { name, exact: true }).click({ trial: true });
  }

  await page.goto(url + "/publications/", { waitUntil: "networkidle" });
  for (const row of await page.locator("ol.bibliography > li").all()) {
    const title = (await row.locator(".title").textContent()).trim();
    const scholar = row.locator('.links a[href^="https://scholar.google.com/scholar?"]');
    assert.equal(new URL(await scholar.getAttribute("href")).searchParams.get("q"), title);
  }

  const disclosure = page.getByRole("button", { name: "BibTeX", exact: true }).first();
  await disclosure.click();
  const panel = page.locator(`[id="${await disclosure.getAttribute("aria-controls")}"]`);
  const link = panel.getByRole("link", { name: "Download BibTeX", exact: true });
  const downloadPromise = page.waitForEvent("download");
  await link.click();
  const download = await downloadPromise;
  const citation = await readFile(await download.path(), "utf8");
  assert.match(download.suggestedFilename(), /\.bib$/);
  assert.match(citation, /^@article\{baek2026frequency,/);
  assert.ok(citation.includes("\n"), "Downloads preserve BibTeX line breaks");
  assert.doesNotMatch(citation, /bibtex_show|selected\s*=/, "Site-only metadata is not exported");

  // Capture the clipboard write without altering the developer's clipboard.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedCitation = text;
        },
      },
    });
  });
  const copy = panel.getByRole("button", { name: "Copy BibTeX", exact: true });
  await copy.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".citation-status").textContent === "BibTeX copied.");
  assert.equal(await page.evaluate(() => window.copiedCitation), citation, "Copy and download export the same citation");
  assert.equal(await copy.evaluate((button) => button === document.activeElement), true, "Copy preserves keyboard focus");

  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard unavailable");
    };
  });
  await copy.click();
  assert.ok((await panel.locator(".citation-status").textContent()).includes("Citation selected."));
  assert.match(await page.evaluate(() => getSelection().toString()), /@article\{baek2026frequency/);
  assert.equal(await copy.isEnabled(), true);
  await page.goto(url + "/projects/", { waitUntil: "networkidle" });
  assert.equal(
    await page.getByRole("link", { name: "Cite sgwt", exact: true }).getAttribute("href"),
    "https://github.com/lukelowry/sgwt/blob/main/CITATION.cff"
  );
  console.log("Research links: profile hit targets, Scholar queries, citation download/copy, clipboard fallback, and software citation passed.");
}
