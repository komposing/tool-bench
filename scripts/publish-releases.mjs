#!/usr/bin/env node
// Publish a GitHub Release for every release in the manifest (ca.repo/1 v2 distribution).
//   node scripts/publish-releases.mjs [--dry-run]
// Runs in the release workflow after tagging, with GH_TOKEN set. For each release whose tag has
// no GitHub Release yet, it creates one titled "<title> <version>", with the CHANGELOG section at
// that tag as notes and the entry file at that tag attached as manifest.distribution.asset.
// Releases are only ever added (I6): an existing release is left exactly as it is. The current
// version is marked latest, so releases/latest/download/<asset> always serves the newest build.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJson } from "./lib.mjs";

const dry = process.argv.includes("--dry-run");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
const quiet = (cmd, args) => { try { return run(cmd, args, { stdio: ["ignore", "pipe", "ignore"] }); } catch (e) { return null; } };

const m = readJson("ca.manifest.json");
const dist = m.distribution;
if (!dist || dist.channel !== "github_release" || !dist.asset) { console.error("manifest.distribution {channel: github_release, asset} missing"); process.exit(1); }

const work = mkdtempSync(join(tmpdir(), "tb-release-"));
const made = [], kept = [];
for (const r of m.releases) {
  const tag = "v" + r.version;
  if (!quiet("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`])) { console.error(`${tag}: no tag yet`); process.exit(1); }
  if (quiet("gh", ["release", "view", tag, "--json", "tagName"])) { kept.push(tag); continue; }

  // the file that was the build at that tag: its manifest's entry, else the v1 single file
  let entry = "tool-bench.html";
  const atTag = quiet("git", ["show", `${tag}:ca.manifest.json`]);
  if (atTag) { try { entry = JSON.parse(atTag).entry || entry; } catch (e) { /* keep default */ } }
  const body = quiet("git", ["show", `${tag}:${entry}`]);
  if (body === null) { console.error(`${tag}: ${entry} not found at the tag`); process.exit(1); }
  const asset = join(work, dist.asset);
  writeFileSync(asset, body + "\n");

  // notes: the "## <version>" section of the CHANGELOG at that tag
  const log = quiet("git", ["show", `${tag}:CHANGELOG.md`]) || "";
  const sec = new RegExp(`^## ${r.version.replace(/\./g, "\\.")}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m").exec(log);
  const notes = `${r.note || ""}\n\nChange ${r.change}.\n\n${sec ? sec[1].trim() : ""}`.trim();
  const notesFile = join(work, `${tag}.md`);
  writeFileSync(notesFile, notes + "\n");

  const latest = r.version === m.version ? "--latest" : "--latest=false";
  if (!dry) run("gh", ["release", "create", tag, `${asset}#${dist.asset}`, "--verify-tag", "--title", `${m.title || m.name} ${r.version}`, "--notes-file", notesFile, latest]);
  made.push(tag);
}
console.log(`releases ${dry ? "to publish" : "published"}: ${made.join(", ") || "none"}; already published: ${kept.join(", ") || "none"}`);
