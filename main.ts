// VICE FRAME Cover Studio — hand-in program for gta6-cover-art-01.
//
// The entry itself is the static web app under app/ (plain HTML, CSS and
// JavaScript, no build step, no network). This program is the delivery
// step the grader runs: it copies app/ and screenshots/ from this
// repository into the output directory and writes dossier.json there
// with buildDossier from the vendored make.fun library, so the judge
// reads exactly the files this repository holds.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoDir = fileURLToPath(new URL(".", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// The dossier caps the scorer enforces (see the kit's gate): the text
// of the app's source is capped, screenshots are few and small, and
// app/ stays well under the file-count and byte ceilings.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

// Copy one top-level tree of the repository into the output directory.
// The app tree is mandatory; anything else is staged only when present.
function stageTree(name: string, required: boolean): boolean {
  const from = join(repoDir, name);
  if (!existsSync(from)) {
    if (required) throw new Error(`entry is missing its ${name}/ tree`);
    return false;
  }
  cpSync(from, join(outDir, name), { recursive: true });
  return true;
}

// Stage the entry, then summarise it. The dossier is built from the
// staged output (not the repository), so what the judge reads is what
// was actually handed in.
mkdirSync(outDir, { recursive: true });
stageTree("app", true);
mkdirSync(join(outDir, "screenshots"), { recursive: true });
const hasShots = stageTree("screenshots", false);

const dossier = buildDossier(outDir, DOSSIER_CAPS);
// The gate refuses a dossier over 1.5 MiB; fail here, loudly, rather
// than hand in an entry that scores zero.
const dossierBytes = Buffer.byteLength(dossier, "utf8");
if (dossierBytes > 1_500_000) {
  throw new Error(`dossier.json would be ${dossierBytes} bytes, over the 1.5 MiB gate cap`);
}
writeFileSync(join(outDir, "dossier.json"), dossier, "utf8");

console.log(
  `vice-frame: staged app/${hasShots ? " + screenshots/" : ""} to ${outDir}; ` +
    `dossier.json ${dossierBytes} bytes`,
);
