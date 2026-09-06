import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../assets/generated/", import.meta.url);
await mkdir(output, { recursive: true });
const result = await build({
  absWorkingDir: root,
  stdin: {
    contents: 'import "@latkit/embed/register"; export { parseNetwork } from "@latkit/embed";',
    resolveDir: root,
    sourcefile: "latkit-entry.js",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "eof",
  outfile: fileURLToPath(new URL("latkit.js", output)),
  metafile: true,
});
// These files are build output, never repository source.
const packages = ["embed", "network", "model", "monitor", "gpu", "colormaps"];
const versions = {};
const notices = [];
for (const name of packages) {
  const directory = new URL(`../node_modules/@latkit/${name}/`, import.meta.url);
  const pkg = JSON.parse(await readFile(new URL("package.json", directory), "utf8"));
  versions[pkg.name] = pkg.version;
  notices.push(`${pkg.name} ${pkg.version}\n${await readFile(new URL("LICENSE", directory), "utf8")}`);
}
await writeFile(new URL("latkit-LICENSE.txt", output), notices.join("\n\n"));
await writeFile(new URL("latkit-version.json", output), JSON.stringify(versions, null, 2) + "\n");
console.log(`Built Latkit from npm: ${JSON.stringify(versions)} (${Object.values(result.metafile.outputs)[0].bytes} bytes)`);
