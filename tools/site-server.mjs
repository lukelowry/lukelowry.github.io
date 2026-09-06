import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, extname, sep } from "node:path";

export async function serveSite(directory = process.env.SITE_ROOT || "_site") {
  const root = resolve(directory);
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".pdf": "application/pdf",
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      let file = resolve(root, "." + decodeURIComponent(url.pathname));
      if (relative(root, file).split(sep).includes("..")) throw new Error("Outside site");
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
      response.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { root, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
