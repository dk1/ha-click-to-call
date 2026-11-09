// Checks the extension before it's zipped: a Manifest V3 manifest, every file it names
// exists, and every script parses.
//   node dev/check-extension.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const EXT = fileURLToPath(new URL("../extension/", import.meta.url));
const errors = [];
const m = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));

if (m.manifest_version !== 3) errors.push("manifest_version must be 3");
for (const key of ["name", "version", "description"]) if (!m[key]) errors.push(`${key} is missing`);
if (!/^\d+(\.\d+){0,3}$/.test(m.version ?? "")) errors.push(`version "${m.version}" isn't 1 to 4 dot-separated numbers`);
if (m.description?.length > 132) errors.push(`description is ${m.description.length} characters; the Chrome Web Store allows 132`);

const files = [
  m.background?.service_worker,
  m.options_ui?.page,
  ...Object.values(m.icons ?? {}),
  ...Object.values(m.action?.default_icon ?? {}),
  ...(m.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
].filter(Boolean);
for (const file of files) if (!existsSync(join(EXT, file))) errors.push(`${file} is named in the manifest but missing`);

for (const file of readdirSync(EXT).filter((f) => f.endsWith(".js"))) {
  try {
    execFileSync(process.execPath, ["--check", join(EXT, file)], { stdio: "pipe" });
  } catch (e) {
    errors.push(`${file} doesn't parse:\n${e.stderr}`);
  }
}

for (const error of errors) console.error(`extension: ${error}`);
if (errors.length) process.exit(1);
console.log(`extension: OK (${m.name} ${m.version}, ${files.length} files)`);
