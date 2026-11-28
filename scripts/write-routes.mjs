// ca.repo/1 v6 write routes (C2119-s4, T959; doc board/design R6). Shared byte for byte by komposing/ca-v3-viewer and
// komposing/tool-bench. No dependencies.
//
// A repo app is read-only except the write routes its ca.manifest.json declares:
//   "write_routes": [{ "key": "board.post", "url": "https://komposing.app.n8n.cloud/webhook/<path>", "method": "POST" }]
// New routes are added there as data, never as exceptions in this code.
//
// Scope: the app source, which is every file under manifest.source except scripts/ (build and check tooling that runs in
// CI and never ships), with a code extension (.js .mjs .cjs .ts .jsx .tsx .html .htm).
//
// A write call is any of: fetch(...) or new Request(...) whose options carry method POST, PUT, PATCH or DELETE (a
// method that is not a string literal counts as a write: fail closed, I4); XMLHttpRequest .open(<write method>, ...);
// navigator.sendBeacon(...) (always POST); <form method="post|put|patch|delete">. A GET needs no declaration.
//
// Each write call must resolve to one declared route:
//   - a marker comment "ca-write: <key>" on the call's line or one of the two lines above names the route; or
//   - with no marker, the URL argument is a string literal equal to a declared url (query string ignored).
// It then fails when the key is undeclared, a literal URL differs from the route's url, or a literal method differs from
// the route's method. Every declared route must have at least one call site and its url must appear as a literal in
// the scanned source (no stale or invented declarations). Keys are unique.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
export const CODE_EXT = /\.(m?js|cjs|ts|jsx|tsx|html?)$/i;
export const EXCLUDE = ["scripts/"];
const MARKER_RE = /ca-write:\s*([A-Za-z0-9_.:-]+)/;

const lineOf = (text, i) => text.slice(0, i).split("\n").length;

// The argument text of a call whose "(" is at index open: up to the matching ")", skipping strings and comments.
function callArgs(text, open) {
  let depth = 0, i = open, q = null;
  for (; i < text.length && i < open + 4000; i++) {
    const c = text[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && text[i + 1] === "/") { const e = text.indexOf("\n", i); i = e < 0 ? text.length : e; continue; }
    if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 1; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return text.slice(open + 1, i);
}
// A plain string literal (no interpolation) at the start of s, else null.
function leadingLiteral(s) {
  const m = /^\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/.exec(s);
  if (!m || (m[1] === "`" && m[2].includes("${"))) return null;
  return m[2];
}
function markerFor(lines, line) {
  for (let l = line; l >= Math.max(1, line - 2); l--) { const m = MARKER_RE.exec(lines[l - 1] || ""); if (m) return m[1]; }
  return null;
}

// Every write call in one file: [{file, line, via, method (or null when not a literal), url (literal or null), marker}].
export function findWriteCalls(file, text) {
  const out = [], lines = text.split("\n");
  const push = (i, via, method, url) => { const line = lineOf(text, i); out.push({ file, line, via, method, url, marker: markerFor(lines, line) }); };
  for (const m of text.matchAll(/\bfetch\s*\(|\bnew\s+Request\s*\(/g)) {
    const args = callArgs(text, m.index + m[0].length - 1);
    const lit = /\bmethod\s*:\s*(["'`])([A-Za-z]+)\1/.exec(args);
    const dyn = !lit && /\bmethod\s*:/.test(args);
    const method = lit ? lit[2].toUpperCase() : null;
    if ((method && WRITE_METHODS.includes(method)) || dyn) push(m.index, m[0].startsWith("new") ? "Request" : "fetch", method, leadingLiteral(args));
  }
  for (const m of text.matchAll(/\.open\s*\(\s*(["'`])([A-Za-z]+)\1\s*,/g)) {
    const method = m[2].toUpperCase();
    if (WRITE_METHODS.includes(method)) push(m.index, "XMLHttpRequest", method, leadingLiteral(text.slice(m.index + m[0].length)));
  }
  for (const m of text.matchAll(/\bsendBeacon\s*\(/g)) push(m.index, "sendBeacon", "POST", leadingLiteral(callArgs(text, m.index + m[0].length - 1)));
  for (const m of text.matchAll(/<form\b[^>]*>/gi)) {
    const meth = /\bmethod\s*=\s*["']?([A-Za-z]+)/i.exec(m[0]);
    if (meth && WRITE_METHODS.includes(meth[1].toUpperCase())) {
      const act = /\baction\s*=\s*["']([^"']*)["']/i.exec(m[0]);
      push(m.index, "form", meth[1].toUpperCase(), act ? act[1] : null);
    }
  }
  return out;
}

const bare = u => String(u).split("#")[0].split("?")[0];

// Check source files ({path: text}) against the declared routes. Returns error strings.
export function checkWriteRoutes(routes, files) {
  const errors = [];
  if (!Array.isArray(routes)) return ["ca.manifest.json: write_routes missing (ca.repo/1 v6: declare [] when the app writes nothing)"];
  const byKey = new Map();
  for (const r of routes) {
    if (byKey.has(r.key)) errors.push(`write_routes: duplicate key ${r.key}`);
    byKey.set(r.key, r);
  }
  const used = new Set(), all = Object.values(files).join("\n");
  for (const [file, text] of Object.entries(files)) {
    for (const c of findWriteCalls(file, text)) {
      const at = `${c.file}:${c.line}: ${c.method || "write (non-literal method)"} ${c.via} to ${c.url || "(expression)"}`;
      let r = null;
      if (c.marker) {
        r = byKey.get(c.marker);
        if (!r) { errors.push(`${at} names ca-write: ${c.marker}, which is not a declared write route`); continue; }
      } else if (c.url) {
        r = routes.find(x => bare(x.url) === bare(c.url) && (!c.method || x.method === c.method)) || null;
        if (!r) { errors.push(`${at} is not a declared write route (declare it in ca.manifest.json write_routes)`); continue; }
      } else {
        errors.push(`${at} is not a declared write route (declare it in write_routes and mark the call "ca-write: <key>")`);
        continue;
      }
      if (c.url && bare(c.url) !== bare(r.url)) errors.push(`${at} does not match route ${r.key} url ${r.url}`);
      if (c.method && c.method !== r.method) errors.push(`${at} does not match route ${r.key} method ${r.method}`);
      used.add(r.key);
    }
  }
  for (const r of routes) {
    if (!used.has(r.key)) errors.push(`write_routes ${r.key}: declared but no write call is marked or addressed to it`);
    if (!all.includes(bare(r.url))) errors.push(`write_routes ${r.key}: url ${r.url} does not appear in the app source`);
  }
  return errors;
}

// The files in scope for a manifest, read through get(path) -> text|null and list() -> [paths].
export function scopeFiles(manifest, paths) {
  const src = manifest.source || [];
  return paths.filter(f => CODE_EXT.test(f) && !EXCLUDE.some(x => f.startsWith(x)) &&
    src.some(s => s.endsWith("/") ? f.startsWith(s) : f === s));
}

// Self-test against the fixtures (scripts/fixtures/write-routes.json). Returns error strings; empty when the check
// behaves as the fixtures say. check-change runs it first, so a broken checker cannot pass a PR.
export function selfTest() {
  const here = dirname(fileURLToPath(import.meta.url));
  const fx = JSON.parse(readFileSync(join(here, "fixtures", "write-routes.json"), "utf8"));
  const errors = [];
  for (const c of fx.cases) {
    const got = checkWriteRoutes(c.write_routes, c.files);
    if (c.expect === "pass" && got.length) errors.push(`write_routes self-test ${c.name}: expected pass, got ${got.join("; ")}`);
    if (c.expect === "fail") {
      if (!got.length) errors.push(`write_routes self-test ${c.name}: expected a failure, got pass`);
      else if (c.match && !got.some(e => e.includes(c.match))) errors.push(`write_routes self-test ${c.name}: no error mentions "${c.match}": ${got.join("; ")}`);
    }
  }
  return errors;
}

// CLI: node scripts/write-routes.mjs [--self-test]  (checks the working tree against ca.manifest.json)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errs = selfTest();
  if (!process.argv.includes("--self-test")) {
    const manifest = JSON.parse(readFileSync("ca.manifest.json", "utf8"));
    const walk = d => readdirSync(d).flatMap(n => { const p = d === "." ? n : `${d}/${n}`; return statSync(p).isDirectory() ? (n === ".git" || n === "node_modules" ? [] : walk(p)) : [p]; });
    const files = Object.fromEntries(scopeFiles(manifest, walk(".")).map(f => [f, readFileSync(f, "utf8")]));
    errs.push(...checkWriteRoutes(manifest.write_routes, files));
  }
  if (errs.length) { console.error("write_routes check failed:\n" + errs.map(e => "  - " + e).join("\n")); process.exit(1); }
  console.log("write_routes check ok");
}
