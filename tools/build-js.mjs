import { build } from "esbuild";
import { createHash } from "node:crypto";
import { buildHomeGrids } from "./build-home-grids.mjs";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../assets/generated/", import.meta.url);
const sourceOption = process.argv.indexOf("--latkit-network-source");
if (sourceOption >= 0 && !process.argv[sourceOption + 1]) throw new Error("--latkit-network-source requires a source entry path");
const networkSource = sourceOption >= 0 ? resolve(process.argv[sourceOption + 1]) : null;
const contract = await readFile(networkSource || new URL("../node_modules/@latkit/network/dist/index.d.ts", import.meta.url), "utf8");
// The source entry re-exports its controller; check that file for a local build.
const controller = networkSource ? await readFile(resolve(dirname(networkSource), "controller.ts"), "utf8") : contract;
if (!controller.includes("whenRendered")) {
  throw new Error(
    "This site requires Latkit Network.whenRendered(). For this unreleased local preview, pass --latkit-network-source ../latkit/packages/network/src/index.ts; publish/update Latkit before deploying."
  );
}
await buildHomeGrids();
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
  loader: { ".wgsl": "text" },
  plugins: networkSource
    ? [
        {
          name: "local-latkit-network",
          setup(build) {
            build.onResolve({ filter: /^@latkit\// }, ({ path }) => ({
              path: path === "@latkit/network" ? networkSource : fileURLToPath(import.meta.resolve(path)),
            }));
          },
        },
      ]
    : [],
});
// Desktop scenes share chunks; the tiny bootstrap has no import prerequisites.
const scenes = await build({
  absWorkingDir: root,
  entryPoints: ["assets/js/grids/home.mjs", "assets/js/grids/wave.mjs"],
  metafile: true,
  outdir: fileURLToPath(new URL("grids/", output)),
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  chunkNames: "chunks/[name]-[hash]",
  // Jekyll must copy these ESM bundles, not run its classic-script minifier.
  outExtension: { ".js": ".mjs" },
});
const sceneURLs = {};
for (const name of ["home", "wave"]) {
  const path = Object.keys(scenes.metafile.outputs).find((path) => path.endsWith(`/grids/${name}.mjs`));
  const hash = createHash("sha256")
    .update(await readFile(resolve(root, path)))
    .digest("hex")
    .slice(0, 16);
  sceneURLs[`./${name}.mjs`] = `./${name}.mjs?v=${hash}`;
}
const bootstrap = await build({
  absWorkingDir: root,
  metafile: true,
  entryPoints: ["assets/js/grids/index.mjs"],
  outfile: fileURLToPath(new URL("grids/index.mjs", output)),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  plugins: [
    {
      name: "deferred-desktop-scenes",
      setup(build) {
        build.onResolve({ filter: /^\.\/(home|wave)\.mjs$/ }, ({ path }) => ({ path: sceneURLs[path], external: true }));
      },
    },
  ],
});
// Prune only obsolete ESM files in this build-owned directory after both builds
// succeed. Never accumulate stale chunks in the next static deployment.
const emitted = new Set([...Object.keys(scenes.metafile.outputs), ...Object.keys(bootstrap.metafile.outputs)].map((path) => resolve(root, path)));
for (const directory of [new URL("grids/", output), new URL("grids/chunks/", output)]) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
    const file = new URL(entry.name, directory);
    if (!emitted.has(fileURLToPath(file))) await unlink(file);
  }
}
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
await writeFile(
  new URL("latkit-version.json", output),
  JSON.stringify({ ...versions, ...(networkSource ? { localNetworkSource: true } : {}) }, null, 2) + "\n"
);
console.log(
  `Built Latkit (${networkSource ? "local network source; unreleased" : "npm"}): ${JSON.stringify(versions)} (${
    Object.values(result.metafile.outputs)[0].bytes
  } bytes)`
);
