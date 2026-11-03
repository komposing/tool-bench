# Changelog

## 3.9.0 — C___

- **Drafting Table** (`TB:drafting-table` v1.3.0): **drill-down**, so the board reads as a node graph. Six mechanisms, each one
  evolution of the root principle (one ref per object, relate to anything, constraints as lenses) and no new op.
  **Scope**: one key `scope: {type:"node", id}` on nodes, notes and groups says which node's board they sit on; a node with
  anything scoped to it shows a `▣ n` badge and a 2.5px stroke; a double press, Enter, the badge or *Open as board* drills
  in; a breadcrumb in the toolbar shows the trail and climbs back; Escape climbs out; new objects take the current scope;
  alt-drop moves a selection onto a node's board (`node.amend` / `note.set` / `group.set` with `scope`); *Move out* lifts
  it. An edge whose far end is outside the board resolves to the nearest ancestor on it, else to a **portal chip** (`⇱`) in
  a column left of the content; clicking a portal goes to the board that holds its object. `view.set` carries the scope.
  **Ports**: a *Ports* toggle (view state) draws a node's attribute keys (own and inherited) as rows with handles; dragging
  from one makes an edge carrying `from.key`, dropping on another node's row sets `to.key`; at detail zoom the rows open
  without the toggle. **Semantic zoom**: below 0.55 nodes draw as chips (label only, no edge labels or handles), above 1.6
  attributes open inline. **Collapse**: `collapsed: true` on `group.set` folds a group to one node-sized box with a member
  count that moves as a unit; edges to members re-route to it and edges inside it hide; a double press expands.
  **History**: a toolbar toggle replays the log to any seq on a slider (op · author · time shown); the board is read-only
  while scrubbing; *mark* remembers a seq and later changes are highlighted. **Keyboard**: arrows walk along edges from the
  selected node, Enter drills in, Escape clears, climbs, then closes history. Double press is detected in the pointer
  handler because the board re-renders between clicks and the browser's dblclick does not fire across them.
  Harness `test/drafting-table/lab.js` (25 checks) against the same stand-in engine; run.js, layers.js and poll.js unchanged.

### Fixed
- none

## 3.8.0 — C980

- **Drafting Table** (`TB:drafting-table` v1.2.0, T560): **layers**. A segmented control in the toolbar switches the board
  between three views of the same op log; the chosen layer rides in the page's `view.set` (author-scoped) and is restored
  on reopen. **global**: everything, as before. **data model**: only data-storing nodes (class `core_object` with
  `kind` in tbl|sheet|std, or any class carrying `stores_data: true`) and the edges between them; each node has an expand
  toggle that calls the engine op `schema {key}` once per key for the page session and draws the columns as rows
  (name | type | format/enum | key); a column dragged onto a column of another expanded node makes an edge of class
  `field_map` (`edge_class.define` first when the palette lacks it) with `{from_field, to_field, relation: maps|fk|eq}`;
  the inspector shows field maps with their fields and lets the relation be changed. **process flow**: a sidebar lists
  the engine's workflows (op `flows`, filter box, tick boxes); a ticked workflow is fetched with op `flow` and drawn as a
  left-to-right layered diagram (steps as rounded boxes with a kind badge, links as arrows with branch labels; cycles
  fall back to a grid) under its `wf:<id>` node when the draft has one; every other draft object is hidden and no board
  op leaves this layer. An engine without the ops (400 / unknown op) answers with a toast and an empty node or list.
  Harness `test/drafting-table/layers.js` (31 checks); `mock.js` gains the three ops behind `{layers: true}`.

### Fixed
- none

## 3.7.0 — C944

- **Drafting Table** (`TB:drafting-table` v1.1.0, T536 page half): replay follows a **poll budget** held as data in
  std drafting `reach.page.poll` (v2): paused while the tab is hidden (one replay at once on return); every 2 s for 30 s
  after a local or remote change (opening the draft counts; the camera's `view.set` does not); then 10 s, 30 s and
  60 s while idle. One replay is in flight at a time and the next is sent only after its reply (40 s timeout), so the
  page is ready for the long-poll replay of C903-s3; replay no longer holds local edits back, and ops a replay returns
  while an apply is in flight are held until the apply names its seqs. The open reply's `reach_page_poll` (relayed by
  the engine from the std row, C903-s3) wins over the built-in defaults, which equal std drafting v2. `poll_ms` now
  overrides the active interval only and is blank by default. Harness `test/drafting-table/poll.js` (fake clock, 15 checks).

### Fixed
- none

## 3.6.0 — C870

- **Pack & Ship** (`TB:pack-ship` v1.1.0): packing slip and label print as **one job**. After `print.queue.add` the page
  calls `label.bytes` (the Parcel2Go label file, base64, transient) and renders its first page with pdf.js (cdnjs,
  4.10.38) at 300 dpi into page 2 of the same 4x6 document, repeated per copy. Image labels pass through; if the render
  fails the label still opens in its own tab as before. Contract adds `cap:label.bytes`.

### Fixed
- none

## 3.5.1 — C867

- **Pack & Ship** (`TB:pack-ship` v1.0.1): the print document carries its own `message` listener and prints itself when the
  page posts `packship:print`; the page no longer calls `print()` on the preview frame, which is a distinct opaque origin
  inside the sandboxed bench.

### Fixed
- U865: Print was blocked with "Blocked a frame with origin null from accessing a cross-origin frame"

## 3.5.0 — C862

- **Pack & Ship** (`TB:pack-ship` v1.0.0, C841-s3): a repo tool to pack and ship a paid Discogs order from one
  screen over the CA_V3 Pack & Ship Engine (`wf:Pqjdoot0EPzoQxj0`, webhook `ca-v3-pack-ship`, which forwards every
  call through Spine v3 so each page action is a traced CA_V3 run). The list comes from `discogs.orders.list`
  (order, date, status, collected/items, parcel none|draft|booked with tracking; no buyer fields). **Print** runs
  `print.queue.add` (copies 1–3) and composes a two-page 4x6 document for a label printer: page 1 packing slip
  (location, artist — title, format · label · catno, conditions, tick box), page 2 the Parcel2Go label embedded by
  URL when it is an image, or opened in its own tab when it is a PDF; nothing is stored. Preview pane with Print and
  Label buttons; the print dialog opens automatically unless `auto_print` is off.
- **Settings** (`packship` namespace): endpoint, viewer key (secret; falls back to the CA_V3 Viewer's `cav3` key),
  label copies, auto print.

### Fixed
- none

## 3.4.0 — C820

- **Drafting Table** (`TB:drafting-table` v1.0.0, C812-s2): a repo tool for the paired concept-modelling surface of
  ca.draft/1 over the CA_V3 Drafting Engine (`wf:VkS7B5UucVMrNwWm`, webhook `ca-v3-drafting`). Five panes around an
  infinite board, all resizable and collapsible (overlay sheets below 820 px):
  - **Palette**: class and edge-class trees, Local and Shared branches, `undefined` first; drag a class onto the board
    (`node.add`); type a name to create a class under the selected one (`class.define`) or an edge class; right-click
    to amend, publish (`class.publish`, shown as *publish requested* until the shared palette carries it) or fork.
  - **Board**: nodes, edges, groups, notes, analysis and class chips, thread badges, ghosted proposals. Drag from a
    node's handle to any ref (node, edge midpoint, group, note, analysis or class chip, palette item, attribute row)
    and type the relation: an existing edge class is reused by name, a new name becomes an `edge_class.define`.
    Multi-select (shift-click or shift-drag) to group, annotate or *reason with session* (`analysis.set` +
    `reason.request`). *Show reasoning* draws thread bubbles; *Follow agent* moves the camera to the agent's ops.
    `node.move` is sent once per node on drag end.
  - **Inspector**: free key/values for the selected ref (amends carry the whole `attributes` object), *promote to
    class* on instance keys (`attr.promote` plus the `class.amend` that carries the default; a shared class is forked
    first), node to class (`node.promote`), edges to and about the object, its thread; the draft's attributes
    including `agent_ops`.
  - **Analysis**: global analysis pinned first, member chips (drop anything in), mode, per-analysis `agent_ops`
    override, *raise request*, the request list, proposals with accept/reject (`ops.accept`/`ops.reject`) and the thread.
  - **Finder**: `find` over docs and drafts; drop a card on the board (`card.drop`, `source_ref` kept) or into an analysis.
- **Pairing**: the page reads the whole op log on open and reduces it itself (the engine snapshot is a cache); it polls
  `replay` every 2 s while visible and flushes its ops through `apply` with `expect_seq` on a 300 ms debounce,
  applying any `missing_ops` first. Its own ops are skipped by seq rather than `exclude_author`, so a second tab of the
  same user sees the first. Ops from the other party flash with their author tag. In ghost mode an agent op carrying
  `origin_request` stays a proposal until accepted.
- **Settings** (`drafting` namespace): endpoint, viewer key (secret; falls back to the CA_V3 Viewer's `cav3` key),
  poll and debounce, and the draft to open on start; the ⚙ popover saves them through `toolbench:config:set`.

### Fixed
- none

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
