const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const mock = require("./mock.js")(path.join(__dirname, "seed.json"));
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const TOOL = "file://" + path.resolve(__dirname, "../../tools/drafting-table.html");
const OUT = path.join(__dirname, "evidence");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.TOOL_CONFIG = { drafting: { url: "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting", headers: { "X-Api-Key": "test-key" }, poll_ms: 2000, debounce_ms: 300, draft_id: "dmvx0i3t3686r" } }; });
  await ctx.route(URL, async route => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const r = mock.handle(JSON.parse(req.postData() || "{}"), req.headers()["x-api-key"]);
    await route.fulfill({ status: r.status || 200, headers: CORS, body: JSON.stringify(r.json) });
  });
  const A = await ctx.newPage(), B = await ctx.newPage();
  const errs = []; for (const [n, p] of [["A", A], ["B", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => { if (m.type() === "error") errs.push(n + " console: " + m.text()); }); }
  await A.goto(TOOL); await B.goto(TOOL);
  await A.waitForFunction(() => window.DT && DT.SEQ >= 7); await B.waitForFunction(() => window.DT && DT.SEQ >= 7);
  check("open smoke draft in two tabs", true, "seq 7 in both");
  const S = p => p.evaluate(() => JSON.parse(JSON.stringify(DT.S)));
  const R = p => p.evaluate(() => JSON.parse(JSON.stringify(DT.R)));
  const settle = async p => { await p.waitForFunction(() => DT.OUTBOX.length === 0 && document.querySelector("#sync").className === "ok", null, { timeout: 5000 }); };
  const centreOf = async (p, sel) => { await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const drag = async (p, from, to) => { await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move(from.x + 10, from.y + 10, { steps: 3 }); await p.mouse.move(to.x, to.y, { steps: 12 }); await p.mouse.up(); };
  await A.screenshot({ path: path.join(OUT, "01-open-smoke.png") });

  // 1. type-to-create a class
  await A.fill("#newClass", "service"); await A.press("#newClass", "Enter");
  let s = await S(A); const kid = Object.keys(s.classes).find(k => s.classes[k].name === "service");
  check("type-to-create class (class.define)", kid, kid);
  // 2. drag it onto the board -> node.add
  await drag(A, await centreOf(A, `#tLocal [data-pal="class:${kid}"]`), { x: 760, y: 420 });
  s = await S(A); const nid = Object.keys(s.nodes).find(k => s.nodes[k].class_id === kid);
  check("drag class onto board (node.add)", nid, nid);
  // 3. relate the new node to an existing edge (edge-to-edge), typing a new edge name
  await A.waitForTimeout(100);
  await drag(A, await centreOf(A, `[data-handle="node:${nid}"]`), await centreOf(A, `[data-ref="edge:e1"] circle.m`));
  await A.waitForSelector("#ov input"); await A.keyboard.type("limits"); await A.keyboard.press("Enter");
  s = await S(A); const e2 = Object.values(s.edges).find(e => e.from.id === nid && e.to.type === "edge" && e.to.id === "e1");
  const xc = e2 && s.edge_classes[e2.edge_class_id];
  check("drag-to-relate onto an edge midpoint (edge.add edge→edge)", e2, e2 && JSON.stringify({ from: e2.from, to: e2.to }));
  check("typed edge name creates an edge class (edge_class.define)", xc && xc.name === "limits", xc && xc.id);
  // relate again with an existing name: reuses the class
  await drag(A, await centreOf(A, `[data-handle="node:${nid}"]`), await centreOf(A, `[data-ref="node:n1"] rect.b`));
  await A.waitForSelector("#ov input"); await A.keyboard.type("depends on"); await A.keyboard.press("Enter");
  s = await S(A); const e3 = Object.values(s.edges).find(e => e.from.id === nid && e.to.id === "n1");
  check("typed existing edge name reuses the class", e3 && e3.edge_class_id === "depends_on", e3 && e3.edge_class_id);
  // relate to a palette class item (any ref incl. classes)
  await drag(A, await centreOf(A, `[data-handle="node:${nid}"]`), await centreOf(A, `#tShared [data-pal="class:constraint"]`));
  await A.waitForSelector("#ov input"); await A.keyboard.press("Enter");
  s = await S(A); const e4 = Object.values(s.edges).find(e => e.from.id === nid && e.to.type === "class" && e.to.id === "constraint");
  check("drag-to-relate onto a palette class (blank name = relates_to)", e4 && e4.edge_class_id === "relates_to");
  // 4. attribute + promote
  await A.click(`[data-ref="node:${nid}"] rect.b`);
  await A.fill("#insp [data-newk]", "sla"); await A.fill("#insp [data-newv]", "99.9"); await A.click("#insp [data-addk]");
  await A.waitForSelector("#iOfferGo"); await A.click("#iOfferGo");
  s = await S(A);
  check("add attribute on instance (node.amend)", s.nodes[nid].attributes.sla === "99.9");
  check("promote attribute to class (attr.promote + class.amend)", s.classes[kid].attributes && "sla" in s.classes[kid].attributes && s.lineage.some(l => l.op === "attr.promote"), JSON.stringify(s.classes[kid].attributes));
  await settle(A);
  // 5. note
  await A.click(`[data-ref="node:${nid}"] rect.b`); await A.click("#sNote");
  await A.waitForSelector("#ov textarea"); await A.keyboard.type("latency matters here"); await A.keyboard.press("Enter");
  s = await S(A); const note = Object.values(s.notes).find(n => n.text === "latency matters here");
  check("annotate (note.set, anchored)", note && note.anchor && note.anchor.id === nid);
  // 6. group two nodes
  await A.click(`[data-ref="node:n1"] rect.b`); await A.click(`[data-ref="node:${nid}"] rect.b`, { modifiers: ["Shift"] });
  await A.click("#sGroup"); await A.waitForSelector("#ov input"); await A.keyboard.press("Control+A"); await A.keyboard.type("pair"); await A.keyboard.press("Enter");
  s = await S(A); const g = Object.values(s.groups).find(x => x.label === "pair");
  check("group two nodes (group.set)", g && g.member_refs.length === 2);
  // 7. analysis on the group + impact request (right-click the group label area)
  await settle(A);
  await A.click("#bFit"); await A.waitForTimeout(150); const gb = await A.locator(`[data-ref="group:${g.id}"] rect.gb`).boundingBox();
  await A.mouse.click(gb.x + 30, gb.y + 10, { button: "right" });
  await A.click("#menu button:has-text('Reason with session (impact)')");
  s = await S(A); const an = Object.values(s.analyses).find(a => a.member_refs.length === 1 && a.member_refs[0].type === "group" && a.member_refs[0].id === g.id);
  const req = an && Object.values(s.requests).find(r => r.analysis_id === an.id);
  check("analysis on the group (analysis.set)", an, an && an.id);
  check("impact request raised (reason.request)", req && req.mode === "impact");
  const tFlush = Date.now(); await settle(A);
  // 8. second tab sees everything through replay within 2 s of landing
  const want = { kid, nid, e2: e2.id, note: note.id, g: g.id, an: an.id };
  await B.waitForFunction(w => DT.S.classes[w.kid] && DT.S.nodes[w.nid] && DT.S.edges[w.e2] && DT.S.notes[w.note] && DT.S.groups[w.g] && DT.S.analyses[w.an] && Object.values(DT.S.requests).some(r => r.analysis_id === w.an) && DT.S.nodes[w.nid].attributes.sla === "99.9" && "sla" in DT.S.classes[w.kid].attributes, want, { timeout: 4000 });
  const lag = Date.now() - tFlush;
  check("second tab replays every action within 2 s (+250 ms tick)", lag <= 2300, lag + " ms after A's last apply landed");
  await B.screenshot({ path: path.join(OUT, "02-tab-b-after-replay.png") });
  const reqId = (await S(A)).requests && Object.values((await S(A)).requests).find(r => r.analysis_id === an.id).id;
  // 9. agent responds with proposals (as ca_call drafting.apply would)
  const r1 = mock.agentApply("dmvx0i3t3686r", [
    { op: "node.add", origin_request: reqId, payload: { id: "pA", class_id: "constraint", label: "latency budget", attributes: {}, pos: { x: 420, y: 260 } } },
    { op: "edge.add", origin_request: reqId, payload: { id: "pE", edge_class_id: "conditional_on", from: { type: "edge", id: e2.id }, to: { type: "node", id: "pA" }, attributes: {} } },
    { op: "node.add", origin_request: reqId, payload: { id: "pB", class_id: "actor", label: "on-call", attributes: {}, pos: { x: 420, y: 360 } } }]);
  const seqs = r1.applied.map(a => a.op_id);
  mock.agentApply("dmvx0i3t3686r", [{ op: "reason.respond", payload: { request_id: reqId, entries: [{ id: "tR", kind: "finding", text: "pair latency is bounded by the budget", status: "open" }], proposed_ops: seqs } }]);
  await A.waitForFunction(() => DT.R.nodes.pA && DT.R.nodes.pA._ghost && !DT.S.nodes.pA, null, { timeout: 4000 });
  let r = await R(A); s = await S(A);
  check("agent proposals appear ghosted (not applied)", r.nodes.pA._ghost && r.edges.pE && r.edges.pE._ghost && !s.nodes.pA);
  check("reason.respond answers the request and lands in the analysis thread", s.requests[reqId].status === "answered" && (s.threads["analysis:" + an.id] || []).some(t => t.id === "tR"));
  check("ghost renders translucent on the board", await A.locator(`[data-ref="node:pA"].ghost`).count() === 1);
  await A.evaluate(() => { const t = document.querySelector("#tReason"); t.click(); });
  await A.screenshot({ path: path.join(OUT, "03-ghosted-proposals.png") });
  // accept two from the panel, reject one
  await A.click(`#anal [data-acc="${seqs[0]}"]`); await A.click(`#anal [data-acc="${seqs[1]}"]`); await A.click(`#anal [data-rej="${seqs[2]}"]`);
  s = await S(A);
  check("accept from the panel (ops.accept) applies the op", s.nodes.pA && s.edges.pE && s.proposals[seqs[0]].status === "accepted");
  check("reject from the panel (ops.reject) drops it", !s.nodes.pB && s.proposals[seqs[2]].status === "rejected");
  await settle(A);
  await B.waitForFunction(() => DT.S.nodes.pA && !DT.R.nodes.pB, null, { timeout: 4000 });
  check("second tab sees accept/reject", true);
  // apply mode: agent ops land directly
  await A.click("#bDraft"); await A.selectOption("#iAgentOps", "apply"); await settle(A);
  mock.agentApply("dmvx0i3t3686r", [{ op: "note.set", origin_request: reqId, payload: { id: "pN", text: "drawn directly", pos: { x: 600, y: 100 } } }]);
  await A.waitForFunction(() => DT.S.notes.pN && !DT.S.notes.pN._ghost, null, { timeout: 4000 });
  check("agent_ops apply: agent ops render normally", true);
  // 10. finder
  await A.fill("#fq", "drafting"); await A.click("#fGo"); await A.waitForSelector("#cards .card");
  const docCards = await A.locator("#cards .card .k:has-text('doc_section')").count();
  check("finder returns doc cards for 'drafting'", docCards >= 1, docCards + " card(s)");
  await drag(A, await centreOf(A, "#cards .card"), { x: 560, y: 600 });
  s = await S(A); const dropped = Object.values(s.nodes).find(n => n.source_ref && n.source_ref.doc_key === "drafting_table");
  check("dropped doc card becomes a node with source_ref kept (card.drop)", dropped, dropped && JSON.stringify(dropped.source_ref));
  await A.fill("#fq", "ship"); await A.click("#fGo"); await A.waitForSelector("#cards .card .k:has-text('draft_object')");
  check("finder returns draft cards for 'ship'", await A.locator("#cards .card .k:has-text('draft_object')").count() >= 1);
  // drop a card into the analysis -> member
  await drag(A, await centreOf(A, "#cards .card"), await centreOf(A, "#anal .chips"));
  s = await S(A); const an2 = s.analyses[an.id];
  check("card dropped into the analysis becomes a member", an2.member_refs.length === 2, JSON.stringify(an2.member_refs));
  // drag a board node into the analysis
  await drag(A, await centreOf(A, `[data-ref="node:n1"] rect.b`), await centreOf(A, "#anal .chips"));
  s = await S(A);
  check("board node dragged into the analysis becomes a member", s.analyses[an.id].member_refs.some(m => m.type === "node" && m.id === "n1"));
  // node.move batching: one op per node on drag end
  await settle(A); const before = mock.sent.length;
  await drag(A, await centreOf(A, `[data-ref="node:${nid}"] rect.b`), { x: 900, y: 300 });
  await settle(A);
  const moves = mock.sent.slice(before).filter(b => b.op === "apply").flatMap(b => b.ops).filter(o => o.op === "node.move");
  check("node.move sent once per node on drag end", moves.length === 1, moves.length + " op(s)");
  await A.click("#bFit"); await A.waitForTimeout(200);
  await A.screenshot({ path: path.join(OUT, "04-after-acceptance-1280.png") });
  // 11. phone width
  const P = await ctx.newPage(); await P.setViewportSize({ width: 390, height: 844 }); await P.goto(TOOL); await P.waitForFunction(() => DT.SEQ > 7);
  const palHidden = await P.locator("#pal").isHidden(), rightHidden = await P.locator("#right").isHidden();
  const hscroll = await P.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await P.screenshot({ path: path.join(OUT, "05-phone-board.png") });
  await P.click(".mobtoggle[data-m=right]"); await P.waitForTimeout(100);
  const rightShown = await P.locator("#right").isVisible();
  await P.screenshot({ path: path.join(OUT, "06-phone-inspector.png") });
  check("phone width: panes collapse to sheets, no horizontal scroll", palHidden && rightHidden && rightShown && !hscroll);
  check("no page errors", errs.length === 0, errs.join(" | "));
  fs.writeFileSync(path.join(OUT, "sent.json"), JSON.stringify(mock.sent.filter(b => b.op === "apply"), null, 1));
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  log(`${results.filter(r => r.ok).length}/${results.length} passed`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
