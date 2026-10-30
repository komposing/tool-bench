#!/usr/bin/env node
// Build the single-file bench and regenerate the manifest's generated fields.
//   node scripts/build.mjs          write dist/tool-bench.html and ca.manifest.json
//   node scripts/build.mjs --check  write nothing; exit 1 if either is stale or invalid
//
// Generated, never hand-edited: dist/tool-bench.html and ca.manifest.json depends.tools
// (the union of every repo tool's contract.requires, read from each tool file's block). That keeps what CA_V3 reads about
// this repo's dependencies derived from the tools themselves (I7).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { readJson, validate, sha256, KEY_RE, readToolBlock, parseFixed, checkConfigSchema } from "./lib.mjs";

const CHECK = process.argv.includes("--check");
const fail = msgs => { console.error(msgs.map(m => "  - " + m).join("\n")); process.exit(1); };

const manifest = readJson("ca.manifest.json");
const schema = readJson("schema/ca.manifest.schema.json");
const registry = readJson("tools/registry.json");
const template = readFileSync("src/bench.html", "utf8");

// 1. tools: each file carries its own fields (toolbench.tool/1 block); a link tool has
//    no file, so its fields sit in its registry entry. Both are validated the same way.
const errors = [];
const ids = new Set();
const toolSchema = readJson("schema/toolbench.tool.schema.json");
const tools = (registry.tools || []).map((entry, i) => {
  const at = entry.file ? entry.file : `tools/registry.json tools[${i}]`;
  let html = "", f = null;
  if (entry.file) {
    if (!existsSync(entry.file)) { errors.push(`${at}: file not found`); return null; }
    html = readFileSync(entry.file, "utf8");
    const r = readToolBlock(html);
    if (r.error) { errors.push(`${at}: ${r.error}`); return null; }
    f = r.fields;
  } else if (entry.url) {
    f = Object.assign({}, entry);
  } else { errors.push(`${at}: needs file or url`); return null; }
  errors.push(...validate(toolSchema, f).map(e => `${at} ${e}`));
  if (f.run && !f.url) errors.push(`${at}: run ${f.run} needs a url`);
  if (!/^TB:/.test(f.id || "")) errors.push(`${at}: repo tools need a TB:<slug> id, got ${f.id}`);
  if (ids.has(f.id)) errors.push(`${at}: duplicate id ${f.id}`); ids.add(f.id);
  const c = f.contract || {};
  errors.push(...checkConfigSchema(f.config_schema, c.config_keys).map(e => `${at}: ${e}`));
  for (const k of c.requires || []) {
    const m = KEY_RE.exec(k);
    if (m && !(manifest.ca?.kinds_known || []).includes(m[1])) errors.push(`${at}: requires ${k} uses undeclared kind ${m[1]} (kind_undeclared)`);
  }
  return {
    id: f.id, name: f.name, description: f.description || "", category: f.category || "General",
    tags: f.tags || [], file: entry.file || null, version: f.version,
    sandbox: f.sandbox || {}, config: f.config || {},
    contract: { config_keys: c.config_keys || [], requires: c.requires || [] },
    config_schema: f.config_schema || undefined,
    html, url: entry.file ? undefined : f.url, run: entry.file ? undefined : (f.run || undefined)
  };
}).filter(Boolean);

// 2. manifest: regenerate depends.tools, then validate against the vendored schema
const byKey = new Map();
for (const t of tools) for (const k of t.contract.requires) {
  if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(t.id);
}
const nextManifest = structuredClone(manifest);
nextManifest.depends.tools = [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  .map(([key, by]) => ({ key, by: by.sort() }));
errors.push(...validate(schema, nextManifest).map(e => "ca.manifest.json " + e));
const lastRelease = nextManifest.releases[nextManifest.releases.length - 1];
if (lastRelease.version !== nextManifest.version) errors.push(`ca.manifest.json: last releases entry is ${lastRelease.version}, version is ${nextManifest.version}`);
if (!template.includes('"@@TB_BUNDLE@@"')) errors.push("src/bench.html: bundle marker missing");
// errors and fixes (ca.repo/1 v3): the current release's "### Fixed" list ships in the bundle
const changelog = readFileSync("CHANGELOG.md", "utf8");
const fx = parseFixed(changelog, nextManifest.version);
errors.push(...fx.errors);
if (errors.length) fail(errors);

// 3. bundle: deterministic (a content hash, no timestamp), so --check is stable
const sourceHash = sha256(JSON.stringify({ template, registry, tools: tools.map(t => t.html), manifest: nextManifest, fixed: fx.fixed })).slice(0, 12);
const bundle = { manifest: nextManifest, built_from: "src@" + sourceHash, built: nextManifest.version, tools, fixed: fx.fixed };
const safe = JSON.stringify(bundle).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const out = template.replace('"@@TB_BUNDLE@@"', () => safe);

const manifestText = JSON.stringify(nextManifest, null, 2) + "\n";
if (CHECK) {
  const stale = [];
  if (!existsSync("dist/tool-bench.html") || readFileSync("dist/tool-bench.html", "utf8") !== out) stale.push("dist/tool-bench.html");
  if (readFileSync("ca.manifest.json", "utf8") !== manifestText) stale.push("ca.manifest.json (depends.tools)");
  if (stale.length) fail([`stale generated files: ${stale.join(", ")}; run node scripts/build.mjs and commit`]);
  console.log(`build check ok: ${tools.length} tool(s), ${byKey.size} dependency key(s), src@${sourceHash}`);
} else {
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/tool-bench.html", out);
  writeFileSync("ca.manifest.json", manifestText);
  console.log(`built dist/tool-bench.html v${nextManifest.version} src@${sourceHash}: ${tools.length} tool(s), ${byKey.size} dependency key(s)`);
}
