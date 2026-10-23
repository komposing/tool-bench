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
| `tools/registry.json`, `tools/*.html` | Repo tools: each with a contract naming the settings and CA_V3 objects it needs |
| `dist/tool-bench.html` | Built single file: source plus manifest plus repo tools (generated) |
| `ca.manifest.json` | The repo's declaration for CA_V3 (ca.repo/1): version, storage, what it provides and depends on, releases |
| `schema/ca.manifest.schema.json` | Vendored copy of the manifest schema from CA_standards `source_repo` |
| `scripts/` | `build.mjs` (build and `--check`), `check-change.mjs` (PR gate), `tag-releases.mjs` (release tags) |

## Tools: repo and local

- **Repo tools** come from `tools/` through the build. They are read-only in the bench; *Fork to local copy*
  makes an editable one.
- **Local tools** are ones you add in the browser. Each save keeps the previous version (History, with
  Restore). *Export for repo* downloads the file and a registry entry so a change can promote it.

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

Schema 2 under `toolbench:v2`. On first run it migrates `toolbench:v1` forward and leaves the v1 key in place.

## Changing this repo

Governed by ca.repo/1 (CA_standards `source_repo`). See [CLAUDE.md](CLAUDE.md).
