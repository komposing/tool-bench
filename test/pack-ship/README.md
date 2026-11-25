# Pack & Ship page harness (C1059, C841-s7; 2.1.0 C1141, C841-s10)

`page.js` runs `tools/pack-ship.html` (TB:pack-ship 2.1.0) standalone with the `TOOL_CONFIG` the bench injects (the
viewer's `cav3` key only) against a stand-in for the `ca-v3-pack-ship` front door, on synthetic orders. It proves what the
page does with the replies: columns and icons only from the stage read, buttons only from the actions list, inputs sent as
the action names them, Refresh start/poll/reload and the busy guard, and the print document from a print reply. 2.1.0 adds the row context line, the country/badge quick filter, compact
buttons with reason tooltips (hover, focus, tap) and a check that no rows reach browser storage. It does not
prove the engine front door; that is proven live through Spine (doc `pack_ship/design`, build log of C1059).

Playwright routing does not reach fetches from the bench's sandboxed srcdoc frame, so the tool runs standalone here.

```bash
NODE_PATH=$(npm root -g) node test/pack-ship/page.js
```

3.0.0 (C1541, C1528-s3) adds the tab column and the views: tabs from the `tabs` op, panels by kind from `stats` and
`consignors` replies in `views-fixture.json` (built by `views/mkfixture.js` from the Pack Views library on generated
rows), controls sent as typed, hover readout, link rules, collapse, and the fallback when `tabs` is refused.

3.1.0 (C1669, C1599-s7) adds the Queue tab: the two raw tables from the `queue` op (fixture built by the library from
generated rows), the post code and stage dots joined from the stage read, Print queued items (two taps, one first-print
action per queued order, an order outside the stage read looked up and never printed blind, one print document, re-read),
Start packing (op `pack_task`: the `not_built_yet` reply and a refusal, both shown as they are) and the status poll
backoff (grows, resets on a change, stops after `POLL.quiet` unchanged answers).
