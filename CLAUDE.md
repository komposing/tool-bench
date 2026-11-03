# CA_V4 — read this first

This repo also hosts the **CA_V4 UI lab** (`tools/drafting-table.html` and any `ca_v4*` page).
A V4 session is NOT a V3 session: no C###, no S####, no `dev.*` broker calls, no CA_V3 Agent MCP.

**Start every V4 session:** call `mcp__ca-v4-docs__v4_bootstrap` with `surface "code"`, `tool "claude-code"`,
`tool_session_id` = this session's id, and follow what it returns. The bootstrap (doc `ca_v4/bootstrap#code`)
is the procedure; this file is only the pointer. On every `ca-v4-docs` call pass surface, tool and
tool_session_id; `session_ref` = tool_session_id. The MCP is declared in `.mcp.json` (n8n OAuth today:
run `/mcp` and sign in; bearer token later via `CA_V4_TOKEN`).

**Record:** design draft `dmw02q076r5fc`; UI lab transcript `dmw0tjl1kc1sx` (lab_entry kinds: finding, fix,
evidence, decision, question, note; edges resolves, evidences) written with `v4_draft_apply`, author `agent:uilab`
or `agent:<tool_session_id>`, every op payload carrying an id. Docs: `CA_V4_docs` via `v4_doc_*`
(master `ca_v4/*`, drafting `ca_v4/drafting*`, increment `ca_v4/inc/<id>`).

**Branch and commits (V4 lane of `scripts/check-change.mjs`, `ca.manifest.json` governance.v4):**
branch `v4/<slug>` or `lab/<slug>`; every commit ends with exactly these two trailers and nothing from V3:
```
Increment: ca_v4/inc/<id>
Session: <tool_session_id>
```
Version, CHANGELOG, tool-block and history checks apply as in V3. If the gate still refuses a V4 branch,
record a lab_finding (class leak, affects D17) and continue; do not rewrite commits to satisfy a V3 rule.

**Close:** write `ca_v4/inc/<id>` with real ids (files, page version, commit/PR, lab entries, execs); append one line to
`ca_v4/drafting#handoff`; run `v4_draft_pending` and list this session's pending op_ids.

Everything below applies to **V3 change branches** (`c<NNN>/…`) only.

---

# Tool Bench — working rules for Claude sessions

This repo is a CA_V3 dependency governed by **ca.repo/1** (CA_standards row `source_repo`).
That row is the source of truth for the mutation protocol; read it with
`ca_call standards.get {"name":"source_repo"}` before changing anything here. This file is a
pointer and a checklist, not a second copy of the rules.

## Before you change anything
1. Open a framework session in CA_V3 (`dev.session.open`) and keep its `S####`.
2. Register or join a change (`dev.change.open`, or `dev.change.get` to continue one). Every change to
   this repo has a `C###`.
3. Branch from `main` as `c<NNN>/<slug>` (for example `c308/tool-bench-v2`). Never commit to `main`.

## While you work
- Every commit ends with both trailers:
  ```
  CA-Change: C308
  CA-Session: S0307
  ```
- Source lives in `src/bench.html` and `tools/`. `dist/tool-bench.html` and `depends.tools` in
  `ca.manifest.json` are generated: run `node scripts/build.mjs` and commit the result. Never edit them by hand.
- Each tool file carries its own fields in its `toolbench-tool` block (format `toolbench.tool/1`); `tools/registry.json` only lists the files.
  Changing a tool file means bumping the `version` in its block (CI checks). A tool declares what it needs in the block's `contract`: `config_keys` (settings that must be
  set or the bench refuses to run it) and `requires` (CA_V3 objects, `prefix:id` in the object model grammar).
- Bump `version` in `ca.manifest.json` (semver: major for a storage, injection or manifest break; minor for a new tool or
  feature; patch for a fix), append a `releases` entry with your change id, and add `## <version>` to `CHANGELOG.md`.
- Changing the storage schema means a new key plus a forward migration that reads the old key and never deletes it.
- No secrets anywhere in the repo (I5): endpoints and ids only.
- Errors and fixes: a bug in this repo is filed in CA_V3 (`dev.bug.report`, object `std:source_repo/komposing/tool-bench`).
  A commit that fixes one adds a `CA-Bug: U###` trailer, and the release's CHANGELOG section lists it under `### Fixed`
  as `- U###: what was wrong` (`- none` when nothing was fixed); CI checks both directions. After the release, move each
  bug to fixed then verified (`dev.bug.update` with the fix change) and refresh the Errors and fixes table in doc
  `source_repo/design` in the same change.

## Landing
- Run `node scripts/build.mjs --check` and `node scripts/check-change.mjs origin/main <branch>` locally; CI runs both on the PR.
- One PR per change, title starting with the change id.
- Merge only after the change's deploy card has landed (`dev.change.get` shows it landed). For a release, that card is the
  write of the release record to CA_standards `external_links` (`repos` entry: version, released date, download link
  `releases/download/v<version>/tool-bench.html`, change). A change that cuts no release is gated by the acceptance card.
  Put the PR URL, head sha and merge sha in the change's stage evidence.
- After the merge, confirm the release workflow made the tag and the GitHub Release with its asset, and that the recorded
  download link answers; if anything differs, fix the record in a new change.
- Tags and GitHub Releases are made by the release workflow from `releases` in the manifest. Don't create, move or delete them.
- Rollback is a new change (revert PR or redeploy a previous tag), never a history rewrite or force push.
