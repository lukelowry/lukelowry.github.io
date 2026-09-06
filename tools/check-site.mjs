import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = resolve(process.env.SITE_ROOT || "_site");
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else result.push(path);
  }
  return result;
}
const files = await walk(root);
const pages = files.filter((path) => path.endsWith(".html"));
const failures = [];
const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
const seenTitles = new Set();
const preview = /Disallow: \/\s/.test(await readFile(resolve(root, "robots.txt"), "utf8"));
for (const path of pages) {
  const html = await readFile(path, "utf8");
  const name = relative(root, path);
  const gridPage = name === "index.html" || name.replaceAll("\\", "/") === "projects/index.html";
  if (html.includes("/assets/css/grids.css") !== gridPage) failures.push(`${name}: grid CSS must load only on network pages`);
  for (const figure of html.matchAll(/<figure\b[^>]*>(.*?)<\/figure>/gs)) {
    const img = figure[1].match(/<img\b[^>]*>/)?.[0];
    if (!img) continue;
    for (const dimension of img.matchAll(/(?:width|height)="([^"]+)"/g))
      if (!/^[1-9]\d*$/.test(dimension[1])) failures.push(`${name}: image dimensions must be intrinsic pixel values`);
  }
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1].trim();
  if (!title) failures.push(`${name}: missing title`);
  if (seenTitles.has(title)) failures.push(`${name}: duplicate title`);
  seenTitles.add(title);
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  const ogURL = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
  if (!canonical?.startsWith("http") || canonical !== ogURL) failures.push(`${name}: inconsistent canonical and Open Graph URL`);
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!description?.trim()) failures.push(`${name}: empty description`);
  for (const image of html.matchAll(/<meta (?:property|name)="(?:og:image|twitter:image)" content="([^"]+)"/g)) {
    if (!/^https?:\/\//.test(image[1])) failures.push(`${name}: social image must be absolute`);
    if (canonical && new URL(image[1]).origin === new URL(canonical).origin) {
      try {
        await stat(resolve(root, "." + new URL(image[1]).pathname));
      } catch {
        failures.push(`${name}: missing social image ${image[1]}`);
      }
    }
  }
  if (name === "404.html" || (!preview && html.includes('name="robots" content="noindex, follow"'))) {
    if (!html.includes('name="robots" content="noindex, follow"')) failures.push(`${name}: unfinished/error pages must be noindex`);
    if (sitemap.includes(canonical)) failures.push(`${name}: unfinished/error pages must not be in sitemap`);
  }
  if (name === "404.html" && html.includes('http-equiv="refresh"')) failures.push("404 must allow time to navigate");
  if (!html.includes('rel="canonical"')) failures.push(`${name}: missing canonical`);
  if (!html.includes('name="description"')) failures.push(`${name}: missing description`);
  for (const tag of ["og:title", "twitter:title"]) {
    const value = html.match(new RegExp(`<meta (?:name|property)="${tag}" content="([^"]*)"`))?.[1];
    if (value !== title) failures.push(`${name}: inconsistent ${tag}`);
  }
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) JSON.parse(match[1]);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const href = match[1].replaceAll("&amp;", "&");
    if (/^(?:https?:|data:|mailto:|tel:|#|javascript:)/i.test(href)) continue;
    const local = decodeURIComponent(href.split(/[?#]/)[0]);
    if (!local) continue;
    const destination = local.startsWith("/") ? resolve(root, "." + local) : resolve(path, "..", local);
    try {
      await stat(destination);
    } catch {
      failures.push(`${name}: missing ${local}`);
    }
  }
}
assert.ok(!(await readFile(resolve(root, "sitemap.xml"), "utf8")).includes("<lastmod>"), "Sitemap must not advertise checkout dates");
assert.ok(
  !files.some((path) => /(?:\.case\.json|[/\\]archive[/\\]|[/\\]tools[/\\]|prof_pic_color|tutorial_al_folio)/.test(path)),
  "Source models, tools, and archived assets must stay unpublished"
);
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`Validated ${pages.length} pages: metadata, structured data, local references, and publication exclusions.`);
