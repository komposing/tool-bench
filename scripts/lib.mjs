// Shared helpers for the ca.repo/1 checks. No dependencies, so CI and a session
// sandbox run the same code with plain Node 18+.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const readJson = p => JSON.parse(readFileSync(p, "utf8"));
export const sha256 = s => createHash("sha256").update(s).digest("hex");

// The JSON Schema dialect CA_V3 uses for payloads (std project_registration validation):
// type, properties, required, additionalProperties, enum, const, pattern, minLength,
// maxLength, minItems, maxItems, minimum, items. An unknown keyword is refused (I4).
const KNOWN = new Set(["$schema","$id","title","description","type","properties","required",
  "additionalProperties","enum","const","pattern","minLength","maxLength","minItems","maxItems",
  "minimum","maximum","items"]);

export function validate(schema, value, path = "$", errors = []) {
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) errors.push(`${path}: schema keyword ${k} not supported`);
  const t = schema.type;
  const typeOf = v => Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v;
  if (t) {
    const actual = typeOf(value);
    const ok = actual === t || (t === "number" && actual === "integer");
    if (!ok) { errors.push(`${path}: expected ${t}, got ${actual}`); return errors; }
  }
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: must be one of ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${path}: above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const r of schema.required || []) if (!(r in value)) errors.push(`${path}: missing ${r}`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validate(props[k], v, `${path}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}: unexpected field ${k}`);
    }
  }
  return errors;
}

export const semver = v => v.split(".").map(n => parseInt(n, 10));
export function semverCmp(a, b) {
  const x = semver(a), y = semver(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

export const KEY_RE = /^([a-z][a-z_]*):(.+)$/;
export const TRAILER_RE = { "CA-Change": /^CA-Change:\s*(C[0-9]{3,})\s*$/m, "CA-Session": /^CA-Session:\s*(S[0-9]{4,})\s*$/m };

// The tool file block (toolbench.tool/1): the same pattern the bench uses.
export const BLOCK_RE = /<script\b[^>]*\bid=["']toolbench-tool["'][^>]*>([\s\S]*?)<\/script>/i;
export function readToolBlock(html) {
  const m = BLOCK_RE.exec(html || "");
  if (!m) return { found: false, fields: null, error: "no toolbench-tool block" };
  try { return { found: true, fields: JSON.parse(m[1]), error: "" }; }
  catch (e) { return { found: true, fields: null, error: "block is not valid JSON: " + e.message }; }
}

// Errors and fixes (ca.repo/1 v3). A fix commit names each bug it fixes in a trailer
// "CA-Bug: U###"; the release's CHANGELOG section lists them under "### Fixed" as
// "- U###: what was wrong" (or "- none"). CI checks the two agree.
export const BUG_TRAILER_RE = /^CA-Bug:\s*(U[0-9]{3,})\s*$/gm;
export function changelogSection(changelog, version) {
  const v = version.replace(/\./g, "\\.");
  const m = new RegExp(`^## ${v}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(changelog);
  return m ? m[1] : null;
}
export function parseFixed(changelog, version) {
  const sec = changelogSection(changelog, version);
  if (sec === null) return { found: false, fixed: [], errors: [`CHANGELOG has no "## ${version}" section`] };
  const m = /^### Fixed[ \t]*\n([\s\S]*?)(?=^### |(?![\s\S]))/m.exec(sec);
  if (!m) return { found: false, fixed: [], errors: [`CHANGELOG ## ${version} has no "### Fixed" list (use "- none" when nothing was fixed)`] };
  const fixed = [], errors = [];
  for (const line of m[1].split("\n").map(l => l.trim()).filter(l => l.startsWith("- "))) {
    if (/^- none$/i.test(line)) continue;
    const b = /^- (U[0-9]{3,}):\s*(.+)$/.exec(line);
    if (b) fixed.push({ id: b[1], text: b[2].trim() });
    else errors.push(`CHANGELOG ## ${version} ### Fixed line is not "- U###: text": ${line}`);
  }
  return { found: true, fixed, errors };
}
