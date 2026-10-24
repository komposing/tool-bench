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

## Landing
- Run `node scripts/build.mjs --check` and `node scripts/check-change.mjs origin/main <branch>` locally; CI runs both on the PR.
- One PR per change, title starting with the change id.
- Merge only after the change's deploy card has landed (`dev.change.get` shows it landed). Put the PR URL,
  head sha and merge sha in the change's stage evidence.
- Tags are made by the release workflow from `releases` in the manifest. Don't create, move or delete tags.
- Rollback is a new change (revert PR or redeploy a previous tag), never a history rewrite or force push.
