# Drafting Table acceptance harness (C820)

UI mechanics of `tools/drafting-table.html` against a local stand-in for the `ca-v3-drafting` webhook
(`mock.js`: append-only log, engine-minted seq, `missing_ops`, replay, list, find), seeded with the smoke draft's
real ops 1-7 and the real palette (`seed.json`). It proves what the page does with the op log; it does not prove
the engine. The payloads it records (`evidence/sent.json`) were replayed onto the live smoke draft through
`drafting.apply` (seq 8-32) to prove the engine accepts them.

Needs Playwright with Chromium (not a repo dependency):

```bash
NODE_PATH=$(npm root -g) node test/drafting-table/run.js
NODE_PATH=$(npm root -g) node test/drafting-table/bench.js   # after node scripts/build.mjs
NODE_PATH=$(npm root -g) node test/drafting-table/poll.js    # poll budget (C944): fake clock, hidden pause, backoff, one replay in flight
NODE_PATH=$(npm root -g) node test/drafting-table/layers.js  # layers (C980): data model columns and field maps, process flow diagram, 400 fallback
NODE_PATH=$(npm root -g) node test/drafting-table/fold.js   # fold (1.4.0): comments and anchored notes collapse into the host behind a count bubble
NODE_PATH=$(npm root -g) node test/drafting-table/exchanges.js  # CA_V4 exchanges lane: pending feed, arm-and-post decisions, refusals, empty state (fixtures/hub-*.json)
```

`run.js` drives two tabs at 1280 px and one at 390 px through the acceptance list; `bench.js` runs the tool inside
the built bench (sandbox, `TOOL_CONFIG`, the `cav3` key fallback, `toolbench:config:set`).
