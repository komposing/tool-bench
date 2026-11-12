# Changelog

## 3.16.0 — C1448

- **Pack & Ship 2.5.0** (`TB:pack-ship` v2.5.0, T763): the page **holds no window**. `orders_stages` is sent without
  `window_days`, so the `pack.orders.stages` contract default applies (30 since C1364), and the days box shows the window
  the reply names. A number typed there is sent for that load only. The `packship.window_days` setting is removed and a
  stored value (Tool Bench wrote the old default 14 on any settings save) is no longer read; it is kept, not deleted.
- **Stage lines** (`ca.pack_stage_lines/1`): any stage that declares `lines` in std `pack_stages` returns them as
  `[{text, href}]` and the page draws them under the stage status; `href` is linked only when it is `https://`. The Label
  stage lists each booked line's tracking number linked to its tracking URL. Harness: synthetic references; 84/84.

### Fixed
- none

## 3.15.0 — C1220

- **Pack & Ship 2.4.0** (`TB:pack-ship` v2.4.0, T689): labels with **extra pages print in full**. The label PDF was
  rendered from its first page only; now every page is rendered (300 dpi, in order) and each copy carries all of them, in
  Print and in the run on shown orders. The preview names each page (packing slip, label page n of N, copy) and a tap
  **leaves that page out** of the print (shown faded, hidden when printing); a second tap brings it back, and the last
  printed page ends the document so no blank page follows. The print dialog's own page range still works. The toast
  counts the label pages. Harness: a synthetic 3-page PDF label, pdf.js served locally; 78/78.

### Fixed
- none

## 3.14.0 — C1194

- **Pack & Ship 2.3.0** (`TB:pack-ship` v2.3.0, T681; decisions `c1194-filters`): a **row filter** above the table built
  from the stage read alone: order status, every stage in `stage_defs` (by state, with its colour dot), the order's
  category context fields (country, currency, item count, customs badge; buyer fields and amounts left out) and
  `can` (actions enabled on the order). Each shows only the values present in the loaded rows, with counts, so a stage
  or context field added in std `pack_stages` is filterable with no page change. One query drives it: tap a chip (right
  click excludes) or type it, e.g. `label:done packed:none country:Italy,"United Kingdom" follow_up!:none`; keys AND
  together, values within a key OR, a word with no key matches the order number, status or stage text, and an unknown
  key is named, not applied. The field autocompletes keys (with `:` is and `!:` is not) and then the values present
  with counts (arrow keys, Tab or Enter). **Run on shown**: pick one action and run it on every shown order where it is
  enabled, one at a time through the same front door, with a count confirm (second tap within 4 s), a Stop button,
  per-order results, one print document for every order printed in the run, and a re-read at the end. Actions that
  write to Discogs still go to their own approval cards. Replaces the country/badge quick filter. Harness: 69 checks.

### Fixed
- none

## 3.13.0 — C1163

- **Versioned release files** (ca.repo/1 v5, T673; decisions `c1163-asset-names`): `distribution.versioned`
  (`{stem}-v{version}{ext}`) names a second copy of the asset, so each GitHub Release carries
  `tool-bench-v<version>.html` beside `tool-bench.html`. The stable name stays, so
  `releases/latest/download/tool-bench.html` keeps serving the newest build; the release record's download link now
  points at the versioned file, so a saved copy says which build it is. The release workflow adds the missing versioned
  copy to every past Release, downloaded from that Release's own `tool-bench.html` and uploaded unchanged (nothing is
  replaced or removed). The build refuses a pattern whose name lacks the version, drops the extension or equals the
  stable name.

### Fixed
- none

## 3.12.0 — C1146

- **Pack & Ship 2.2.0** (`TB:pack-ship` v2.2.0, T666; std `pack_stages` v8; decisions `pack-ux2`): each order is its own
  `tbody`, alternate orders shaded and a 2px divider between orders, so an order's row and its context line read as one
  block. The **order number links** to `links.order` from the reply (the Discogs order page; new tab, `noopener`; plain
  text when the order has no link). Button text comes from the action's std `label` when given (Print / Reprint), the icon
  and tooltip as before. An action with `confirm: true` needs a **second tap within 4 s**: the first tap turns the button to
  "Tap again to reprint" and sends nothing. After a print the page **re-reads the stages**, so the Packed column shows
  "printed <time>" and the button turns to Reprint; a print that stored its job but could not set the printed mark says so
  (`marked`, `hook_notes`). Harness: 51 checks.

### Fixed
- none

## 3.11.0 — C1141

- **Pack & Ship 2.1.0** (`TB:pack-ship` v2.1.0, C841-s10, T643; std `pack_stages` v7 `row_context`, ca.pack_row_context/2;
  design `file:1RHuv5PvsCHGcuxY7RTWUe_FRdSPr0YtH`): each order gets a **context line** under its row from the order's
  `context`: buyer username and full post code (joined by the engine page front door only, never through Spine), country,
  total with its currency (`Intl.NumberFormat` per row), item count and a **customs badge** chip (NI, JE, GG, international;
  `?` when the destination is unresolved; none for mainland GB and the Isle of Man). Any other context field the standard
  adds is shown as `name: value` without a page change. A **quick filter** above the table (All, each country in the loaded
  rows, each badge present, with counts) narrows the rendered list in memory and keeps its selection across Reload when it
  still matches. **Compact actions**: an order's buttons sit in one wrapped row with an icon and a short label; the reason
  is a tooltip (the wrapper's `title` for hover, also over a disabled button; keyboard focus or a tap shows it as a callout;
  `aria-label` on the button) instead of a line on the page, so order cards are about 27% shorter on the harness fixture
  even with the new context line (309 to 225 px for three orders). Rows live in module variables only: no localStorage,
  sessionStorage, IndexedDB or Cache API (harness checks the page and the file). Harness: 42 checks.

### Fixed
- U1078: the action column stacked each button with its reason, so few orders fit in view; buttons are now one compact row with the reason as a tooltip.

## 3.10.0 — C1059

- **Pack & Ship v2** (`TB:pack-ship` v2.0.0, C841-s7, T544; doc `pack_ship/design`, std `pack_stages` v3): the page renders only
  what `pack.orders.stages` returns. Columns are the read's `stage_defs`; each cell is the stage's icon (colour from the read's
  `states`: none orange, partial yellow, done green, later grey) and its text. Row buttons are each order's `actions`
  (`key`, `enabled`, `reason`, `inputs`): a disabled action shows its reason; an input named by the action comes from a page
  control of the same name (`copies`) or a row field (`custom_text`, 160 characters). A button posts `{op: action,
  params: {order_ref, action, inputs}}`; the engine front door re-reads the order, runs the action's cap and its `then` only
  when std `pack_stages` `page.action_caps` lists them, keeps params to each cap's registry contract and cuts the reply to the
  listed fields, so the page holds no action logic and no buyer data. Replies are read by shape: print data composes the
  two-page 4x6 document (the v1.1.0 single-print path: `print.queue.add` then `label.bytes`, pdf.js render, postMessage print);
  rows with a checkout link become links; anything else is a notice (for example the review card sent to Telegram, whose
  send stays on its own approval card). **Refresh** posts op `refresh`: the front door asks `runs.status` whether a sync chain
  sharing steps is running (busy: the button waits), else starts `pack.refresh` without waiting and returns `run_id` and
  `poll {op, every_ms, max_ms}`; the page polls until the run is done, then reloads the stages. Settings add `window_days`.

### Fixed
- none

## 3.9.0 — ca_v4/inc/D19-approvals-lane-build

- **Drafting Table** (`TB:drafting-table` v1.3.0, CA_V4 design `dmw1122kroij7` seq 64-108): **Approvals panel**. A header
  control with a count badge opens a panel over the board with two lanes. **Exchanges** (D19.4): open
  `decision_request`s across open hub threads, read with `v4.hub.pending {to operator, open_only true, limit 40}` through
  the CA_V4 Hub page entry (config `hub_page_url`, default `webhook/ca-v4-hub-page`); one group per thread, newest first,
  collapsible, with filters by thread and by asking session; each row shows seq, asking session, ts, refs and the body,
  with body lines `(n) …` rendered as option buttons (recommended first) and an `other` field for a typed steer; one click
  arms, a second within 5 s posts `v4.hub.post {kind decision, answers: seq, to: the asking session, body "<n>: <text>"
  | "other: <steer>", refs}`; states pending → posting → decided (decided list of this page-session, badge decrements,
  panel re-reads) or refused (the refusal `{code, reason}` stays on the row, nothing retried); rows on a closed thread
  are stale; the empty state names the threads scanned and the time of the read. **Proposals**: a visible stub until the
  Doc Store has a page entry (config `doc_page_url`, empty; D22); the badge therefore counts exchanges only and the summary
  strip shows the proposals figures as not read. **Transport**: every V4 call is one `ca.payload/1` envelope with the page
  principal `{surface page, tool drafting-table, tool_session_id = the page session}` and `session_ref` = that id, sent
  with `credentials: include` and no viewer key; a refusal is rendered, never thrown or retried. Nothing V4 touches the
  V3 drafting endpoint. Harness `test/drafting-table/exchanges.js` (29 checks) over fixtures `hub-pending.json`,
  `hub-post-ok.json`, `hub-refused.json`.

### Fixed
- none

## 3.8.1 — ca_v4/inc/code-setup-20261103

- **Governance**: `scripts/check-change.mjs` gains a second lane. Branches `v4/<slug>` and `lab/<slug>` are CA_V4
  increments: every commit carries `Increment: ca_v4/inc/<id>` and `Session: <tool_session_id>` and must not carry
  `CA-Change`/`CA-Session` (D17: a V4 session is its principal). V3 change branches (`c<NNN>/…`) are unchanged.
  Declared in `ca.manifest.json` `governance.v4` (schema extended). No version bump: no src/ or tools/ change.
- **CA_V4 pointer**: `CLAUDE.md` gets a V4 block at the top (bootstrap first, record, trailers, close); `.mcp.json`
  declares the CA_V4 Doc MCP (`ca-v4-docs`, n8n OAuth; bearer via `CA_V4_TOKEN` when issued).
- **Release records**: `releases[].change` in the manifest accepts a V4 increment id (`ca_v4/inc/<id>`) as well as a `C###`.

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
