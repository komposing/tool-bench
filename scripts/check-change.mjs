#!/usr/bin/env node
// ca.repo/1 mutation checks for a change branch against main.
//   node scripts/check-change.mjs <base-ref> <branch-name>
// Fails closed (I4) when: the branch isn't named for a change; a commit lacks the
// CA-Change or CA-Session trailer, or names a different change than the branch; source
// changed without a version bump; the version went backwards; the CHANGELOG has no entry
// for the version; a released version's commit or a storage migration was rewritten.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readJson, semverCmp, TRAILER_RE, readToolBlock } from "./lib.mjs";

const [base = "origin/main", branch = process.env.GITHUB_HEAD_REF || ""] = process.argv.slice(2);
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const errors = [];

const manifest = readJson("ca.manifest.json");
const branchRe = new RegExp(manifest.governance.branch_pattern);
if (!branchRe.test(branch)) errors.push(`branch ${branch || "(unknown)"} does not match ${manifest.governance.branch_pattern}`);
const branchChange = (/^c([0-9]{3,})\//.exec(branch) || [])[1];

const shas = git("rev-list", "--no-merges", `${base}..HEAD`).split("\n").filter(Boolean);
if (!shas.length) errors.push("no commits on the branch");
const changes = new Set();
for (const sha of shas) {
  const msg = git("log", "-1", "--format=%B", sha);
  for (const [name, re] of Object.entries(TRAILER_RE)) {
    const m = re.exec(msg);
    if (!m) errors.push(`${sha.slice(0, 7)}: missing ${name} trailer`);
    else if (name === "CA-Change") changes.add(m[1]);
  }
}
if (changes.size > 1) errors.push(`commits name more than one change: ${[...changes].join(", ")}`);
if (branchChange && changes.size === 1 && ![...changes][0].endsWith(branchChange)) errors.push(`branch is for C${branchChange}, commits name ${[...changes][0]}`);

let baseManifest = null;
try { baseManifest = JSON.parse(execFileSync("git", ["show", `${base}:ca.manifest.json`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch (e) { /* first manifest */ }
const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
const sourceChanged = changed.some(f => f.startsWith("src/") || f.startsWith("tools/") || f === "dist/tool-bench.html");
if (baseManifest) {
  const cmp = semverCmp(manifest.version, baseManifest.version);
  if (cmp < 0) errors.push(`version went backwards: ${baseManifest.version} -> ${manifest.version}`);
  if (sourceChanged && cmp === 0) errors.push(`src/ or tools/ changed but version is still ${manifest.version}`);
  // History is preserved (I6): released entries and migrations are append-only.
  for (const r of baseManifest.releases || []) {
    const now = manifest.releases.find(x => x.version === r.version);
    if (!now) errors.push(`release ${r.version} removed from the manifest`);
    else if (r.commit && now.commit !== r.commit) errors.push(`release ${r.version} commit rewritten`);
  }
  for (const m of baseManifest.storage?.migrations || []) {
    if (!(manifest.storage?.migrations || []).some(x => x.from === m.from && x.to === m.to)) errors.push(`storage migration ${m.from} -> ${m.to} removed`);
  }
  if (baseManifest.storage && manifest.storage && manifest.storage.key !== baseManifest.storage.key &&
      !(manifest.storage.migrations || []).some(x => x.from === baseManifest.storage.key && x.to === manifest.storage.key)) {
    errors.push(`storage key changed ${baseManifest.storage.key} -> ${manifest.storage.key} without a migration`);
  }
}
// A changed tool file must carry a higher version in its block than on the base, and keep its id.
for (const file of changed.filter(f => /^tools\/.+\.html?$/.test(f))) {
  let now = null, was = null;
  try { now = readToolBlock(readFileSync(file, "utf8")).fields; } catch (e) { continue; }   // deleted file
  try { was = readToolBlock(execFileSync("git", ["show", `${base}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).fields; } catch (e) { /* new file */ }
  if (!now) { errors.push(`${file}: no valid toolbench-tool block`); continue; }
  if (was && was.version && semverCmp(now.version, was.version) <= 0) errors.push(`${file}: changed but version is ${now.version} (was ${was.version}); bump it in the file's block`);
  if (was && was.id && now.id !== was.id) errors.push(`${file}: id changed ${was.id} -> ${now.id}; a new id is a new tool`);
}
const changelog = readFileSync("CHANGELOG.md", "utf8");
if (!new RegExp(`^## ${manifest.version.replace(/\./g, "\\.")}\\b`, "m").test(changelog)) errors.push(`CHANGELOG.md has no "## ${manifest.version}" entry`);

if (errors.length) { console.error("ca.repo/1 change checks failed:\n" + errors.map(e => "  - " + e).join("\n")); process.exit(1); }
console.log(`ca.repo/1 change checks ok: ${shas.length} commit(s) for ${[...changes][0]}, version ${baseManifest ? baseManifest.version + " -> " : ""}${manifest.version}`);
