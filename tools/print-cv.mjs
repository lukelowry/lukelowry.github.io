// Print the built CV, including publications from the shared bibliography.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { serveSite } from "./site-server.mjs";

const site = await serveSite();
let browser;
try {
  browser = await chromium.launch({ channel: process.env.SITE_BROWSER_CHANNEL || undefined });
  const page = await browser.newPage({ colorScheme: "light" });
  await page.route("**/livereload.js*", (route) => route.fulfill({ body: "" }));
  await page.route("**/googletagmanager.com/**", (route) => route.fulfill({ body: "" }));
  await page.goto(site.url + "/cv/", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    document.documentElement.dataset.theme = "light";
    await document.fonts.ready;
  });
  await page.addStyleTag({
    content: `
      @page { size:A4; margin:16mm; }
      html { font-size:10pt!important; }
      body { font-size:10pt!important; font-weight:400; line-height:1.4; min-width:0!important; padding:0!important; }
      nav,footer,#back-to-top,#toc-sidebar,.post-header a { display:none!important; }
      .container { width:100%!important; min-width:0!important; max-width:none!important; padding:0!important; }
      .col-sm-3 { display:none!important; }
      .col-sm-9 { flex:0 0 100%!important; max-width:100%!important; }
      .post-header { margin:0 0 12pt!important; }
      .post-header h1 { font-size:22pt; margin:0; }
      .cv .card { border:0!important; padding:4pt 0!important; margin-top:10pt!important; }
      .cv .card-title { font-size:14pt; border-bottom:1px solid #bbb; padding-bottom:4pt; margin-bottom:4pt; break-after:avoid; }
      .cv .list-group { display:block; margin:0; }
      .cv .list-group-item { padding:6pt 0!important; border:0!important; break-inside:avoid; }
      .cv .row { margin:0; flex-wrap:nowrap; }
      .cv .date-column { flex:0 0 19%; max-width:19%; text-align:left!important; padding:0; transform:none; }
      .cv .date-column + div { flex:0 0 81%; max-width:81%; padding:0; margin:0!important; }
      .cv .card .list-group-item .badge { border:0!important; padding:0; font-size:7.5pt; font-weight:500!important; color:#444!important; background:transparent!important; }
      .cv h6 { font-size:10pt!important; line-height:1.35; margin:0 0 3pt 10pt!important; }
      .cv .cv-publication-authors, .cv .cv-publication-details, .cv .cv-publication-doi { margin-left:10pt!important; }
      .cv ul.items { padding-left:22pt; margin-bottom:0; }
      .cv a { color:#111!important; text-decoration:none; }
      .cv li { orphans:2; widows:2; }
    `,
  });
  const directory = resolve(site.root, "assets/pdf");
  await mkdir(directory, { recursive: true });
  await page.pdf({
    path: resolve(directory, "cv.pdf"),
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
    margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
  });
  console.log("Generated assets/pdf/cv.pdf from the approved CV page.");
} finally {
  await browser?.close();
  await site.close();
}
