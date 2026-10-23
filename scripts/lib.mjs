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
