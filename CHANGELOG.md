# Changelog

## 3.3.0 — C783

- **Tool settings belong to the tool.** `toolbench.tool/1` gains an optional `config_schema`:
  `{namespace, fields: [{path, label, type, required, default, values, secret, help}]}` with types
  `url|string|header|secret|number|boolean|enum` and dot paths inside the namespace (segments may hold `-` and capitals,
  e.g. `dashboard.headers.X-Api-Key`). The namespace must also be in `contract.config_keys`; paths are unique and don't
  overlap; enum fields list `values`; defaults match the type; secret fields carry no default. Checked by the schema,
  `scripts/build.mjs` for repo tools and the bench for local ones. Tools without it work as before.
- **Settings** shows a form per tool that declares settings (repo, local or fetched), prefilled from
  `state.config[namespace]` or the defaults; secret fields are password inputs with Show. Saving checks the types and
  writes the nested object into `state.config[namespace]`, keeping keys the schema doesn't name. The global JSON editor
  stays for everything else and shows secrets as `••••` (left masked, the stored value is kept). The bench never knows a
  setting by name.
- **Runs**: a tool with `config_schema` is refused while a required field is missing, empty or a `<placeholder>`, or a url
  field isn't http(s); the sheet names the fields and opens that tool's settings. Its namespace is injected with defaults
  filled in.
- **Tool-side save**: the running tool may post `{type: "toolbench:config:set", namespace, values}` for the namespace it
  declares. The bench drops unknown paths, checks types and required fields, stores, answers
  `{type: "toolbench:config:result", ok: true, persisted}` (or `ok: false, errors`), toasts and reloads the tool. If local
  storage fails the settings last for the session (`persisted: false`).
- **Secrets stay on this device**: the local bundle export, Registry JSON, tool blocks, downloads and Export for repo
  never carry a secret field's value; an edit that leaves a secret masked or absent keeps the stored one.
- **CA_V3 Viewer** (`TB:ca-v3-viewer`, still v0.4.0) declares its `cav3` settings: Dashboard API, Framework Graph and
  Sessions API urls (with defaults) and the viewer key (`dashboard.headers.X-Api-Key`, secret, required).

### Fixed
- none

## 3.2.0 — C765

- **Fetched tools**: a registry link entry with `"run": "fetch"` (new optional field in `toolbench.tool/1`; entries
  without it keep framing the url) is read with `fetch()` (no credentials) and run inline like a file tool: same
  sandbox, `TOOL_CONFIG`/`TOOL_META` injection and error reporter. When the host sends `X-CA-SHA256` the bench checks
  the body with `crypto.subtle` and refuses to run it on a mismatch. A failed fetch (network, CORS, non-200) or a
  mismatch shows an error card with the status and is logged in Errors and fixes. The html is kept in memory for the
  page only, never in localStorage; **Reload** fetches it again. Cards show `fetched`.
- **CA_V3 Viewer** is a repo fetched tool: `tools/registry.json` lists `TB:ca-v3-viewer` v0.4.0 with its card fields
  (the viewer's `toolbench-tool` block from komposing/ca-v3-viewer) and `url`
  `https://komposing.app.n8n.cloud/webhook/ca-v3-viewer` (CA_V3 Viewer Host, which n8n Cloud won't let be framed).
  It needs the `cav3` setting and requires the Dashboard, Sessions and Framework Graph workflows. Its release record is
  `std:external_links repos[komposing/ca-v3-viewer]`.

### Fixed
- none

## 3.1.0 — C688

- **Errors and fixes** in the sidebar: one log of errors from your tools and from the bench itself, kept in this browser
  (last 200, repeats folded into a count). Tools report through a small reporter the bench puts ahead of their own
  scripts (uncaught errors, unhandled promise rejections, `console.error`, failed resource loads); only the frame the
  bench is running can report. A tool with logged errors shows a red count on its card.
- **Copy** on any entry copies a CA_V3 bug report (`dev.bug.report` fields, object `std:source_repo/komposing/tool-bench`);
  **Export JSON** saves the whole log; **Clear log** asks first. The log is not part of the registry or bundle exports.
- **Fixed in this version**: the build ships this section's `### Fixed` list; it shows in Errors and fixes and in
  Dependencies.
- ca.repo/1 v3: a fix commit names its bug in a `CA-Bug: U###` trailer, and the release lists it under `### Fixed`; CI
  refuses a mismatch either way, or a `CA-Bug` trailer on a change that cuts no release. `ca.manifest.json` declares `bugs`.

### Fixed
- none

## 3.0.1 — C579

- Every release is now a GitHub Release with the built `tool-bench.html` attached, so
  `https://github.com/komposing/tool-bench/releases/latest/download/tool-bench.html` always downloads the newest build.
  The release workflow publishes any version that doesn't have a Release yet (1.0.0, 2.0.0 and 3.0.0 are backfilled)
  and never changes an existing one.
- `ca.manifest.json` declares `distribution` (ca.repo/1 v2): channel, asset, the latest-download link and where CA_V3
  records each release (std `external_links`, shown on the tasks bot under Power Tools > Builds & links).
- No change to how the bench works; the patch version is because the bundled manifest changed.

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
