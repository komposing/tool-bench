// Lab transcript acceptance (C-lab): the bottom pane's second tab folds a transcript draft (lab_entry nodes, resolves /
// evidences edges) into a table, loaded on demand and never polled; entries and status changes go through apply as the
// configured author; links resolve to rows; export is markdown; ambient auth sends no key; a missing transcript draft
// can be created with its classes. Runs against mock.js with a pre-seeded transcript draft.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const TOOL = "file://" + path.resolve(__dirname, "../../tools/drafting-table.html");
const OUT = path.join(__dirname, "evidence");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
const T0 = Date.parse("2026-11-03T15:00:00Z");
function seedTranscript(mock){
  let seq = 0; const ops = [];
  const add = (author, op, payload) => ops.push({ seq: ++seq, author, ts: new Date(T0 + seq * 60000).toISOString(), op, payload, origin_request: "" });
  add("user", "draft.create", { title: "UI lab transcript", attributes: { agent_ops: "apply", transcript: "lab" } });
  add("user", "class.define", { id: "lab_entry", name: "lab entry", parent: "undefined", attributes: { round: "", subject: "", summary: "", detail: "", evidence: "", page_version: "", status: "open", env: "", session: "", resolves: "" }, style: { fill: "#FFFFFF", stroke: "#5B6670" } });
  for (const k of ["finding", "fix", "evidence", "decision", "question", "note"]) add("user", "class.define", { id: "lab_" + k, name: k, parent: "lab_entry", attributes: {}, style: {} });
  add("user", "edge_class.define", { id: "resolves", name: "resolves", parent: "relates_to", directional: true, attributes: {}, style: {} });
  add("user", "edge_class.define", { id: "evidences", name: "evidences", parent: "relates_to", directional: true, attributes: {}, style: {} });
  add("agent:uilab", "node.add", { id: "f1", class_id: "lab_finding", label: "fields_json renders as a JSON string in the inspector", attributes: { round: "1", subject: "F2", detail: "k_pointer > attributes > fields_json shows [{...}] as one input; unreadable past 3 fields.", evidence: "screenshot:r1-inspector-k_pointer.png sha256:ab12", page_version: "1.2.0", env: "CA_V4 UI lab", session: "s-test" }, pos: { x: 0, y: 0 } });
  add("agent:uilab", "node.add", { id: "x1", class_id: "lab_fix", label: "typed sub-table for fields_json / transitions_json", attributes: { round: "1", subject: "F2", status: "fixed", detail: "attrRows renders arrays of objects as a sub-table with one row per element.", evidence: "diff:f2-typed-editor.diff", page_version: "1.3.1", env: "CA_V4 UI lab", resolves: "f1" }, pos: { x: 220, y: 0 } });
  add("agent:uilab", "edge.add", { id: "e1", edge_class_id: "resolves", from: { type: "node", id: "x1" }, to: { type: "node", id: "f1" }, attributes: {} });
  add("agent:uilab", "node.add", { id: "v1", class_id: "lab_evidence", label: "before/after of k_pointer inspector", attributes: { round: "1", subject: "F2", evidence: "screenshot:r1-before.png sha256:cd34\nscreenshot:r1-after.png sha256:ef56", resolves: "x1" }, pos: { x: 440, y: 0 } });
  add("agent:uilab", "edge.add", { id: "e2", edge_class_id: "evidences", from: { type: "node", id: "v1" }, to: { type: "node", id: "x1" }, attributes: {} });
  add("user", "node.add", { id: "q1", class_id: "lab_question", label: "should the sub-table be editable or read-only?", attributes: { round: "1", subject: "F2" }, pos: { x: 660, y: 0 } });
  add("agent:uilab", "node.add", { id: "f2", class_id: "lab_finding", label: "no completeness signal per node", attributes: { round: "2", subject: "F8", page_version: "1.3.1" }, pos: { x: 0, y: 110 } });
  mock.drafts.dtrans1 = { title: "UI lab transcript", ops };
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mock = require("./mock.js")(path.join(__dirname, "seed.json"));
  seedTranscript(mock);
  const browser = await chromium.launch();
  const headersSeen = [];
  const makeCtx = async (cfg, opts) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts || {}));
    await ctx.addInitScript(c => { window.TOOL_CONFIG = { drafting: c }; }, cfg);
    await ctx.route(URL, async route => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const h = req.headers(); headersSeen.push({ key: h["x-api-key"], body: JSON.parse(req.postData() || "{}") });
      const key = h["x-api-key"] === undefined && cfg.auth_mode === "ambient" ? "test-key" : h["x-api-key"];   // the proxy attaches the key outside the page
      const r = mock.handle(JSON.parse(req.postData() || "{}"), key);
      await route.fulfill({ status: r.status || 200, headers: CORS, body: JSON.stringify(r.json) });
    });
    return ctx;
  };
  const errs = [];
  const watch = (n, p) => { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => { if (m.type() === "error") errs.push(n + " console: " + m.text()); }); };
  const replays = id => mock.sent.filter(b => b.op === "replay" && b.draft_id === id).length;
  const applies = id => mock.sent.filter(b => b.op === "apply" && b.draft_id === id);

  // ---- A: agent-configured page with a transcript draft
  const ctxA = await makeCtx({ url: URL, headers: { "X-Api-Key": "test-key" }, poll_ms: 2000, debounce_ms: 100, draft_id: "dmvx0i3t3686r", author: "agent:uilab", transcript_draft_id: "dtrans1", lab_tag: "CA_V4 UI lab" });
  const A = await ctxA.newPage(); watch("A", A);
  await A.goto(TOOL); await A.waitForFunction(() => window.DT && DT.SEQ >= 7);
  check("author comes from config", await A.evaluate(() => DT.AUTHOR) === "agent:uilab");
  check("transcript tab hidden until asked; no transcript replay on load", await A.locator("#trans").isHidden() && replays("dtrans1") === 0, `replays ${replays("dtrans1")}`);
  // a board op is attributed to the configured author
  await A.evaluate(() => DT.emit({ op: "note.set", payload: { id: "nt_lab", text: "hello from the lab", pos: { x: 10, y: 10 } } }));
  await A.waitForFunction(() => DT.OUTBOX.length === 0 && document.querySelector("#sync").className === "ok");
  const boardApply = applies("dmvx0i3t3686r").pop();
  check("board apply carries the configured author", boardApply && boardApply.author === "agent:uilab", boardApply && boardApply.author);
  // open the transcript from the top bar
  await A.click("#tTrans"); await A.waitForFunction(() => DT.TR.loaded);
  check("Transcript button opens the tab and loads it with one replay", await A.locator("#trans").isVisible() && replays("dtrans1") === 1, `replays ${replays("dtrans1")}`);
  const rows = await A.locator("#trTable tr.tre").count();
  check("one row per lab entry, chronological", rows === 5 && (await A.locator("#trTable tr.tre").first().getAttribute("data-tr")) === "f1", `${rows} rows`);
  const linkCell = await A.locator('#trTable tr[data-tr="f1"] td').nth(8).innerText();
  check("links column shows the fix chain on the finding", /⇐1 fix/.test(linkCell), linkCell);
  check("open-count badge on the tab", (await A.locator("#trN").innerText()).trim().toLowerCase() === "3 open", await A.locator("#trN").innerText());
  await A.screenshot({ path: path.join(OUT, "tr-01-table.png") });
  // expand the finding: detail, evidence and the fixed-by link
  await A.click('#trTable tr[data-tr="f1"]');
  const det = await A.locator('#trTable tr[data-trd="f1"]').innerText();
  check("expanded row shows detail, evidence, page, env, session and 'fixed by' link", /unreadable past 3 fields/.test(det) && /sha256:ab12/.test(det) && /page 1\.2\.0/.test(det) && /env CA_V4 UI lab/.test(det) && /session s-test/.test(det) && /fixed by/.test(det) && /#x1/.test(det), det.slice(0, 120));
  await A.click('#trTable tr[data-trd="f1"] [data-trgo="x1"]');
  check("clicking a link opens the linked entry", await A.locator('#trTable tr[data-trd="x1"]').count() === 1 && /resolves → .*#f1/.test(await A.locator('#trTable tr[data-trd="x1"]').innerText()) && /evidenced by .*#v1/.test(await A.locator('#trTable tr[data-trd="x1"]').innerText()));
  await A.screenshot({ path: path.join(OUT, "tr-02-expanded.png") });
  // filters
  await A.click('#trKinds [data-kind="finding"]');
  check("kind chip hides findings", await A.locator("#trTable tr.tre").count() === 3);
  await A.click('#trKinds [data-kind="finding"]');
  await A.selectOption("#trAuthor", "user");
  check("author filter", await A.locator("#trTable tr.tre").count() === 1 && (await A.locator("#trTable tr.tre").first().getAttribute("data-tr")) === "q1");
  await A.selectOption("#trAuthor", "");
  await A.fill("#trQ", "completeness");
  check("text filter", await A.locator("#trTable tr.tre").count() === 1);
  await A.fill("#trQ", "");
  await A.selectOption("#trStatus", "fixed");
  check("status filter", await A.locator("#trTable tr.tre").count() === 1 && (await A.locator("#trTable tr.tre").first().getAttribute("data-tr")) === "x1");
  await A.selectOption("#trStatus", "");
  // add a fix for f2 from the expanded row's button, through the form
  await A.click('#trTable tr[data-tr="f2"]'); await A.click('#trTable tr[data-trd="f2"] [data-trfix="f2"]');
  check("'+ fix for this' opens the form prefilled", await A.locator("#trForm").isVisible() && (await A.inputValue("#teKind")) === "fix" && (await A.inputValue("#teLinks")) === "f2" && (await A.inputValue("#teStatus")) === "fixed");
  await A.fill("#teRound", "2"); await A.fill("#teSubject", "F8"); await A.fill("#teSummary", "completeness ring per node"); await A.fill("#tePage", "1.3.2");
  await A.fill("#teDetail", "ring = filled fields / class fields"); await A.fill("#teEvidence", "diff:f8-ring.diff\nscreenshot:r2-ring.png sha256:9988");
  await A.screenshot({ path: path.join(OUT, "tr-03-form.png") });
  const before = replays("dtrans1");
  await A.click("#teSave"); await A.waitForFunction(() => document.querySelector("#trForm").hidden);
  const ap = applies("dtrans1").pop();
  const na = ap && ap.ops.find(o => o.op === "node.add"), ea = ap && ap.ops.find(o => o.op === "edge.add");
  check("form apply: node.add lab_fix with the fields, env from lab_tag, author from config, no bootstrap re-sent", ap && ap.author === "agent:uilab" && na && na.payload.class_id === "lab_fix" && na.payload.attributes.round === "2" && na.payload.attributes.status === "fixed" && na.payload.attributes.env === "CA_V4 UI lab" && na.payload.attributes.page_version === "1.3.2" && na.payload.attributes.resolves === "f2" && !ap.ops.some(o => o.op === "class.define"), ap && JSON.stringify(ap.ops.map(o => o.op)));
  check("form apply: resolves edge from the fix to f2", ea && ea.payload.edge_class_id === "resolves" && ea.payload.from.id === na.payload.id && ea.payload.to.id === "f2");
  check("after apply the transcript reloads once (replay since seq)", replays("dtrans1") === before + 1 && mock.sent.filter(b => b.op === "replay" && b.draft_id === "dtrans1").pop().since_seq > 0);
  check("new row appears, f2 now shows its fix", await A.locator("#trTable tr.tre").count() === 6 && /⇐1 fix/.test(await A.locator('#trTable tr[data-tr="f2"] td').nth(8).innerText()));
  // status change sends the whole own attribute set
  await A.click('#trTable tr[data-trd="f2"] [data-trst="f2|verified"]');
  await A.waitForFunction(() => DT.TR.st.nodes.f2.attributes.status === "verified");
  const am = applies("dtrans1").pop().ops.find(o => o.op === "node.amend");
  check("status button: node.amend carries every own key plus status", am && am.payload.id === "f2" && am.payload.attributes.status === "verified" && am.payload.attributes.round === "2" && am.payload.attributes.subject === "F8" && am.payload.attributes.page_version === "1.3.1", am && JSON.stringify(am.payload.attributes));
  // never polled with the board
  const r0 = replays("dtrans1"), b0 = replays("dmvx0i3t3686r");
  await A.waitForTimeout(4500);
  check("transcript is not polled while the board is", replays("dtrans1") === r0 && replays("dmvx0i3t3686r") > b0, `transcript ${replays("dtrans1") - r0} board +${replays("dmvx0i3t3686r") - b0}`);
  // export
  await A.click("#trExport");
  const md = await A.inputValue("#expText");
  check("export is a markdown table of the shown rows with detail sections", md.split("\n").filter(l => /^\| \d+ \|/.test(l)).length === 6 && /fixed by #x1/.test(md) && /### #x1/.test(md), md.split("\n")[2]);
  await A.click("#expClose");
  // phone: the transcript sits in the find sheet
  const P = await ctxA.newPage(); watch("P", P); await P.setViewportSize({ width: 390, height: 844 }); await P.goto(TOOL); await P.waitForFunction(() => window.DT && DT.SEQ >= 7);
  await P.click("#tTrans"); await P.waitForFunction(() => DT.TR.loaded);
  check("phone width: Transcript opens the bottom sheet with the table", await P.locator("#find").isVisible() && await P.locator("#trTable tr.tre").count() === 6 && !(await P.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await P.screenshot({ path: path.join(OUT, "tr-04-phone.png") });
  await ctxA.close();

  // ---- B: ambient auth: no key sent, the environment attaches it
  const ctxB = await makeCtx({ url: URL, auth_mode: "ambient", poll_ms: 2000, draft_id: "dmvx0i3t3686r", transcript_draft_id: "dtrans1" });
  const B = await ctxB.newPage(); watch("B", B);
  const h0 = headersSeen.length;
  await B.goto(TOOL); await B.waitForFunction(() => window.DT && DT.SEQ >= 7);
  const sentB = headersSeen.slice(h0);
  check("ambient auth: requests go out without X-Api-Key and the page opens", sentB.length > 0 && sentB.every(x => x.key === undefined), `${sentB.length} requests`);
  await ctxB.close();

  // ---- C: no transcript draft configured: create one with its classes
  const ctxC = await makeCtx({ url: URL, headers: { "X-Api-Key": "test-key" }, poll_ms: 2000, draft_id: "dmvx0i3t3686r", author: "agent:uilab", lab_tag: "CA_V4 UI lab", transcript_draft_id: "" });
  const C = await ctxC.newPage(); watch("C", C);
  await C.goto(TOOL); await C.waitForFunction(() => window.DT && DT.SEQ >= 7);
  await C.click("#tTrans");
  check("no transcript configured: the tab offers to create one", await C.locator("#trCreate").count() === 1);
  await C.click("#trCreate"); await C.waitForFunction(() => DT.TR.loaded && DT.TR.id);
  const newId = await C.evaluate(() => DT.TR.id), nd = mock.drafts[newId];
  const defs = nd ? nd.ops.filter(o => o.op === "class.define").map(o => o.payload.id) : [];
  check("create: a draft titled 'UI lab transcript' with lab_entry, the six kinds and both edge classes", nd && nd.title === "UI lab transcript" && defs.includes("lab_entry") && defs.length === 7 && nd.ops.filter(o => o.op === "edge_class.define").length === 2 && nd.ops.some(o => o.op === "draft.amend" && o.payload.attributes.lab === "CA_V4 UI lab"), newId + " " + defs.join(","));
  // an agent adds an entry programmatically (as the lab chat would through page.evaluate)
  await C.evaluate(() => DT.trAddEntry({ kind: "finding", round: "1", subject: "F5", summary: "relate-from-inspector needs name search", detail: "typing an id is the only way today", page_version: "1.3.0" }));
  check("DT.trAddEntry writes to the new draft as the configured author", mock.drafts[newId].ops.some(o => o.op === "node.add" && o.author === "agent:uilab" && o.payload.class_id === "lab_finding" && o.payload.attributes.env === "CA_V4 UI lab") && await C.locator("#trTable tr.tre").count() === 1);
  await C.screenshot({ path: path.join(OUT, "tr-05-created.png") });
  await ctxC.close();

  check("no page errors", errs.length === 0, errs.join(" | "));
  fs.writeFileSync(path.join(OUT, "transcript-results.json"), JSON.stringify(results, null, 1));
  console.log(`${results.filter(r => r.ok).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
