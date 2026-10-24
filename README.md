# Tool Bench

A single-file host for small HTML tools. It injects shared settings into each tool as
`window.TOOL_CONFIG` (with `window.TOOL_META`), runs tools in a sandboxed frame, and keeps
everything in browser storage.

**Use it:** open `dist/tool-bench.html`. That file is built; it carries this repo's manifest and the
tools in `tools/`.

## Layout

| Path | What it is |
|---|---|
| `src/bench.html` | The bench source (a template with a bundle marker) |
| `tools/registry.json`, `tools/*.html` | Repo tools: the registry lists the files; each file carries its own fields and version |
| `dist/tool-bench.html` | Built single file: source plus manifest plus repo tools (generated) |
| `ca.manifest.json` | The repo's declaration for CA_V3 (ca.repo/1): version, storage, what it provides and depends on, releases |
| `schema/ca.manifest.schema.json` | Vendored copy of the manifest schema from CA_standards `source_repo` |
| `scripts/` | `build.mjs` (build and `--check`), `check-change.mjs` (PR gate), `tag-releases.mjs` (release tags) |

## Tools: repo and local

- **Repo tools** come from `tools/` through the build. They are read-only in the bench; *Fork to local copy*
  makes an editable one.
- **Local tools** are ones you add in the browser. Each save keeps the previous version (History, with
  Restore). *Export for repo* downloads the file and a registry entry so a change can promote it.

## Tool files carry their fields

Every tool HTML has a block in its `<head>` with the same fields its card shows:

```html
<script type="application/json" id="toolbench-tool">
{
  "format": "toolbench.tool/1",
  "id": "TL:000004",
  "name": "Label printer",
  "description": "Looks up a row by key and prints a DYMO label",
  "category": "Labels",
  "tags": ["dymo"],
  "version": "1.2.0",
  "contract": { "config_keys": ["n8n_base"], "requires": [] },
  "sandbox": { "scripts": true },
  "config": {}
}
</script>
```

Importing a file reads the block; saving bumps the version and rewrites it, so a downloaded file is always complete.
A file whose `id` is one of your local tools updates it only when its `version` is higher.

## Contracts

```json
"contract": {
  "config_keys": ["n8n_base"],
  "requires": ["cap:discogs.orders.list", "wf:AbCdEf0123456789"]
}
```

The bench won't run a tool whose `config_keys` aren't set (it shows which). `requires` keys are collected
by the build into `depends.tools` in the manifest, which is how CA_V3 sees what this repo depends on.

## Storage

The browser's local storage only: schema 3 under `toolbench:v3`. On first run it migrates `toolbench:v2` or `toolbench:v1`
(from local storage, or the artifact storage earlier builds used) and leaves the old keys in place.

## Changing this repo

Governed by ca.repo/1 (CA_standards `source_repo`). See [CLAUDE.md](CLAUDE.md).
