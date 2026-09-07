import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { compactHomeGrid, encodeHomePayload } from "./home-grid-payload.mjs";

export async function buildHomeGrids() {
  for (const name of ["USA", "EuropeA"]) {
    const source = new URL(`../assets/grids/${name}.json`, import.meta.url);
    const json = JSON.parse(await readFile(source, "utf8"));
    const { model } = compactHomeGrid(json);
    const binary = Buffer.from(encodeHomePayload(model));
    const gzip = gzipSync(binary, { level: 9 });
    // Stable bytes: avoid triggering Jekyll when inputs have not changed.
    for (const [suffix, bytes] of [
      [".home.bin", binary],
      [".home.bin.gz", gzip],
    ]) {
      const path = new URL(`../assets/grids/${name}${suffix}`, import.meta.url);
      const previous = await readFile(path).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      if (!previous?.equals(bytes)) await writeFile(path, bytes);
    }
    console.log(`${name} homepage: ${model.topology.vertexCount} vertices, ${model.topology.edges.length / 2} edges, ${gzip.length} gzip bytes`);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await buildHomeGrids();
