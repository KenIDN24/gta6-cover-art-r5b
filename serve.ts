// Tiny static file server for trying the app locally:
//   node serve.ts   ->   http://localhost:8080
// Serves app/ only, with the handful of content types the app uses.

import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(fileURLToPath(new URL(".", import.meta.url)), "app");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const rel = path === "/" ? "index.html" : path.replace(/^[/\\]+/, "");
  const file = join(appDir, rel);
  try {
    if (!file.startsWith(appDir) || !statSync(file).isFile()) throw new Error("nf");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}).listen(8080, () => console.log("vice-frame app at http://localhost:8080"));
