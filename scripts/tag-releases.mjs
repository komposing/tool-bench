#!/usr/bin/env node
// Tag releases from the manifest (ca.repo/1): tags are made by this workflow on main,
// never by hand, and never moved or deleted (I6).
//   node scripts/tag-releases.mjs <head-sha> [--dry-run]
// A release with a recorded commit is tagged there; the current version, if untagged,
// is tagged at the head being built. An existing tag on another commit fails the run.
import { execFileSync } from "node:child_process";
import { readJson } from "./lib.mjs";

const [head, flag] = process.argv.slice(2);
const dry = flag === "--dry-run";
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const m = readJson("ca.manifest.json");
const errors = [], made = [];
for (const r of m.releases) {
  const tag = "v" + r.version;
  let existing = null;
  try { existing = execFileSync("git", ["rev-list", "-n", "1", tag], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) { /* no tag yet */ }
  const target = r.commit || (r.version === m.version ? head : null);
  if (existing) {
    if (target && existing !== target) errors.push(`${tag} is on ${existing.slice(0,7)}, manifest says ${target.slice(0,7)}`);
    continue;
  }
  if (!target) { errors.push(`${tag} has no commit and is not the current version`); continue; }
  if (!dry) git("tag", "-a", tag, target, "-m", `${m.title || m.name} ${r.version} (${r.change})${r.note ? ": " + r.note : ""}`);
  made.push(`${tag}@${target.slice(0,7)}`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(made.length ? `tags ${dry ? "to make" : "made"}: ${made.join(", ")}` : "all releases already tagged");
if (made.length && !dry) console.log("TAGS_MADE=1");
