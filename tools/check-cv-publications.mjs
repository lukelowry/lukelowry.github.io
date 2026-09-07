import assert from "node:assert/strict";

// Compare the actual rendered pages, so omissions and broken links fail CI.
export async function checkCVPublications(page, url) {
  await page.goto(url + "/publications/", { waitUntil: "networkidle" });
  const publications = await page.locator("ol.bibliography > li").evaluateAll((rows) => {
    const text = (element) => element?.textContent.replace(/\s+/g, " ").trim() || "";
    return rows.map((row) => {
      const title = row.querySelector(".title");
      return {
        key: title.parentElement.id,
        title: text(title),
        venue: text(row.querySelector(".periodical em")).replace(/^In /, ""),
        year: row.parentElement.previousElementSibling.textContent.trim(),
        doi: row.querySelector('a[href^="https://doi.org/"]')?.href || null,
      };
    });
  });
  assert.ok(publications.length > 0, "The bibliography must contain publications");
  await page.goto(url + "/cv/", { waitUntil: "networkidle" });
  const cv = await page.locator(".cv-publications [data-publication-key]").evaluateAll((rows) => {
    const text = (element) => element?.textContent.replace(/\s+/g, " ").trim() || "";
    return rows.map((row) => ({
      key: row.dataset.publicationKey,
      title: text(row.querySelector(".title")),
      venue: text(row.querySelector(".cv-publication-venue")),
      year: text(row.querySelector(".badge")),
      doi: row.querySelector('a[href^="https://doi.org/"]')?.href || null,
    }));
  });
  assert.deepEqual(cv, publications, "The CV and Publications page must share every citation in the same order");
  const links = await page.locator(".cv-publication-link").evaluateAll((anchors) => anchors.map((anchor) => anchor.href));
  for (const [index, href] of links.entries()) {
    const destination = new URL(href);
    assert.ok(destination.pathname.endsWith("/publications/"), "CV titles link to the Publications page");
    assert.equal(decodeURIComponent(destination.hash.slice(1)), publications[index].key, "CV titles link to the matching citation");
  }
  assert.equal(
    await page
      .locator(".cv-publications > .bibliography > li")
      .evaluateAll((rows) => rows.every((row) => getComputedStyle(row).listStyleType === "none")),
    true,
    "CV publication rows have no bullets"
  );
  console.log(`CV: all ${cv.length} publications, citation details, links, and unbulleted rows match the shared bibliography.`);
}
