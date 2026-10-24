# Changelog

## 3.0.0 — C350

- Storage is the browser's local storage only (`toolbench:v3`, schema 3). Earlier builds' data is migrated on first run
  from `toolbench:v2` or `toolbench:v1`, in local storage or in the Claude artifact storage they may have used; old keys
  are left untouched and artifact storage is never written. The rail says when local storage is blocked and nothing is saved.
- Tool files carry their own card fields: a `<script type="application/json" id="toolbench-tool">` block
  (format `toolbench.tool/1`, schema in `schema/toolbench.tool.schema.json`) with id, name, description, category, tags,
  version, contract, sandbox and settings.
- Importing reads it: drop a file, upload it or paste it and the fields fill in. A file whose block names one of your
  local tools updates that tool when its version is higher, and is skipped (with the reason) when it isn't.
- Every save is a new semver version (patch by default, Minor and Major buttons, never below the current one), and the
  block in the stored file is rewritten with the new fields and version, so a downloaded file is always complete.
  Restore and duplicate do the same. Versions show on each card, in the run bar, in History and in the download name.
- v2 save counters become versions: save n is `1.0.(n-1)`.
- Repo tools: `tools/registry.json` is now a list of files; the build reads each tool's fields from its block and validates
  them. CI refuses a changed tool file whose version didn't go up, or whose id changed.

## 2.0.0 — C308

- Repo build: `src/bench.html` plus `tools/` build into the single file `dist/tool-bench.html`, carrying the
  manifest and the repo tools. Opened unbuilt, the bench says so and runs local tools only.
- `ca.manifest.json` (ca.repo/1): version, storage, provided protocols, CA_V3 dependencies (generated from tool
  contracts), governance and releases.
- Repo tools vs local tools: repo tools are read-only and can be forked; per-viewer pin and run counts live in an overlay.
- Tool contracts: `config_keys` the bench checks before every run (fails closed, shows what's missing) and
  `requires` CA_V3 keys, flagged when the kind prefix isn't declared. Settings shows which needed settings are set.
- Dependencies view (rail, or the version label): host manifest, storage, and each tool's contract; copy as JSON.
- Per-tool history for local tools: every save keeps the previous version (last 20); restore makes a new version.
- Storage schema 2 under `toolbench:v2`, migrated from `toolbench:v1` on first run; the v1 key is left untouched.
- Hardening: config and meta are escaped before injection (no `</script>` breakout); imports are validated and
  always get fresh ids; registry edits are validated per tool; link tools receive config by postMessage targeted at
  their own origin; the link download escapes its URL; duplicates reset pin and history.
- `TOOL_META` now carries origin, version, host version and the tool's contract.

## 1.0.0 — C308 (baseline)

- Tool Bench v1 as delivered, imported unchanged as the repo's first commit.
