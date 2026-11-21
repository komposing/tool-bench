# Pack Views library and tests (C1528)

Reference copy of the code that runs in n8n workflow `CA_V3 Pack Views` (`2snIKhpgAKFfXHiB`), kept here so the page
fixture is reproducible and the evaluator can be tested offline. The workflow is the running copy; change both together.

- `lib.js` - the Eval node library, verbatim (`packViews()`: `plan`, `evaluate`). `evaltail.js` is the rest of that node.
- `readplan.js` - the Read Plan node body.
- `pack_tabs.js` - std `pack_tabs` (ca.pack_tabs/1) as landed (v2); the CA_standards row is the source of truth.
- `test.js` - library tests on synthetic rows. `mock_test.js` - both node bodies under a stand-in for the Code node.
- `mkfixture.js <out>` - builds `../views-fixture.json` for the page harness from generated rows (no live data).

```bash
node test/pack-ship/views/test.js && node test/pack-ship/views/mock_test.js
node test/pack-ship/views/mkfixture.js test/pack-ship/views-fixture.json
```
