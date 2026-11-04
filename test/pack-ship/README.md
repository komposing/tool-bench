# Pack & Ship v2 page harness (C1059, C841-s7)

`page.js` runs `tools/pack-ship.html` (TB:pack-ship 2.0.0) standalone with the `TOOL_CONFIG` the bench injects (the
viewer's `cav3` key only) against a stand-in for the `ca-v3-pack-ship` front door, on synthetic orders. It proves what the
page does with the replies: columns and icons only from the stage read, buttons only from the actions list, inputs sent as
the action names them, Refresh start/poll/reload and the busy guard, and the print document from a print reply. It does not
prove the engine front door; that is proven live through Spine (doc `pack_ship/design`, build log of C1059).

Playwright routing does not reach fetches from the bench's sandboxed srcdoc frame, so the tool runs standalone here.

```bash
NODE_PATH=$(npm root -g) node test/pack-ship/page.js
```
