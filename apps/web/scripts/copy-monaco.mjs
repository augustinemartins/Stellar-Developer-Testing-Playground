// Copies Monaco's AMD build into public/ so the editor is self-hosted:
// no CDN at runtime, works offline and under a strict Content-Security-Policy.
import { cpSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkgJson = require.resolve("monaco-editor/package.json");
const version = JSON.parse(readFileSync(pkgJson, "utf8")).version;
const src = join(dirname(pkgJson), "min/vs");
const dest = join(here, "../public/monaco", version, "vs");
if (!existsSync(dest)) {
  cpSync(src, dest, { recursive: true });
  console.log(`copied monaco-editor ${version} to public/monaco/${version}/vs`);
}
