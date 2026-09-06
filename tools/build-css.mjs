// Use the API so config loading also works with Windows drive-letter paths.
import { PurgeCSS } from "purgecss";
import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import config from "../purgecss.config.js";

const options = process.env.SITE_ROOT
  ? {
      ...config,
      content: config.content.map((path) => path.replace(/^_site/, process.env.SITE_ROOT.replaceAll("\\", "/"))),
      css: config.css.map((path) => path.replace(/^_site/, process.env.SITE_ROOT.replaceAll("\\", "/"))),
      skippedContentGlobs: config.skippedContentGlobs.map((path) => path.replace(/^_site/, process.env.SITE_ROOT.replaceAll("\\", "/"))),
      output: resolve(process.env.SITE_ROOT, "assets/css"),
    }
  : config;
const results = await new PurgeCSS().purge(options);
for (const result of results) {
  if (!result.file) throw new Error("Expected a CSS file result");
  await writeFile(resolve(options.output, basename(result.file)), result.css);
}
console.log(`Optimized ${results.length} CSS files.`);
