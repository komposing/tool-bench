// Layers acceptance (C980, T560): global / data model / process flow on the page against mock.js with the three
// engine ops (schema, flows, flow) as contracted. Proves: the data model layer shows only data-storing nodes
// (core_object kind tbl|sheet|std, or a class with stores_data) and edges between them; expand fetches schema once per
// key and draws the columns; a column-to-column drag emits edge_class.define field_map (once) + edge.add field_map;
// the inspector shows the fields; the process layer lists flows, draws a ticked flow's steps and links, hides the draft
// except the wf:<id> head node, and emits no board op; the layer is carried in view.set and restored on reopen; an
// engine without the ops (400 / unknown op) degrades to a toast.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const TOOL = "file://" + path.resolve(__dirname, "../../tools/drafting-table.html");
const OUT = path.join(__dirname, "evidence");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
const EXTRA = {
  schemas: {
    "tbl:Pq0rdersTbl00001": { table_id: "Pq0rdersTbl00001", name: "CA_orders", columns: [
      { name: "id", type: "string", format: "", enum: null, key: "pk", observed: true, declared: true },
      { name: "customer_id", type: "string", format: "", enum: null, key: "fk:tbl:customers", observed: true, declared: true },
      { name: "status", type: "string", format: "", enum: ["paid", "shipped"], key: "", observed: true, declared: true },
      { name: "total", type: "number", format: "gbp", enum: null, key: "", observed: true, declared: false }], sample_rows: 20, declared_from: "std:tables" },
    "CA_customers": { table_id: "Cu5tomersTbl0001", name: "CA_customers", columns: [
      { name: "id", type: "string", format: "", enum: null, key: "pk", observed: true, declared: true },
      { name: "email", type: "string", format: "email", enum: null, key: "", observed: true, declared: true }], sample_rows: 5, declared_from: "std:tables" }
  },
  flows: [{ workflow: { id: "Pqjdoot0EPzoQxj0", name: "Pack & Ship Engine", active: true },
    steps: [{ id: "s1", label: "Webhook", type: "n8n-nodes-base.webhook", kind: "trigger", disabled: false }, { id: "s2", label: "Load order", type: "dataTable", kind: "read", disabled: false },
      { id: "s3", label: "Paid?", type: "if", kind: "decide", disabled: false }, { id: "s4", label: "Queue print", type: "dataTable", kind: "write", disabled: false }, { id: "s5", label: "Respond", type: "respondToWebhook", kind: "respond", disabled: true }],
    links: [{ from: "s1", to: "s2", branch: "" }, { from: "s2", to: "s3", branch: "" }, { from: "s3", to: "s4", branch: "true" }, { from: "s3", to: "s5", branch: "false" }, { from: "s4", to: "s5", branch: "" }] },
    { workflow: { id: "VkS7B5UucVMrNwWm", name: "Drafting Engine", active: true }, steps: [{ id: "a", label: "Webhook", kind: "trigger" }, { id: "b", label: "Apply", kind: "write" }], links: [{ from: "a", to: "b" }] }]
};
// draft objects for the layers: a core_object class, two tables, a workflow node, a plain goal node
const SEED_OPS = [
  { op: "class.define", payload: { id: "core_object", name: "core object", parent: "undefined", attributes: { kind: "", key: "" }, style: { fill: "#E3F2FD", stroke: "#1E66D0" } } },
  { op: "node.add", payload: { id: "t_orders", class_id: "core_object", label: "orders", attributes: { kind: "tbl", key: "tbl:Pq0rdersTbl00001" }, pos: { x: 0, y: 200 } } },
  { op: "node.add", payload: { id: "t_cust", class_id: "core_object", label: "customers", attributes: { kind: "tbl", key: "tbl:CA_customers" }, pos: { x: 420, y: 200 } } },
  { op: "node.add", payload: { id: "w_pack", class_id: "core_object", label: "Pack & Ship", attributes: { kind: "wf", key: "wf:Pqjdoot0EPzoQxj0" }, pos: { x: 0, y: 520 } } },
  { op: "class.define", payload: { id: "ledger", name: "ledger", parent: "undefined", attributes: { stores_data: true }, style: {} } },
  { op: "node.add", payload: { id: "t_ledger", class_id: "ledger", label: "ledger", attributes: {}, pos: { x: 0, y: 420 } } },
  { op: "edge.add", payload: { id: "e_od", edge_class_id: "depends_on", from: { type: "node", id: "t_orders" }, to: { type: "node", id: "n1" }, attributes: {} } },
  { op: "edge.add", payload: { id: "e_oc", edge_class_id: "depends_on", from: { type: "node", id: "t_orders" }, to: { type: "node", id: "t_cust" }, attributes: {} } }
];

async function rig(browser, { layers = true } = {}){
  const mock = require("./mock.js")(path.join(__dirname, "seed.json"), { layers, extra: EXTRA });
  mock.agentApply("dmvx0i3t3686r", SEED_OPS);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.TOOL_CONFIG = { drafting: { url: "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting", headers: { "X-Api-Key": "test-key" }, poll_ms: 2000, debounce_ms: 100, draft_id: "dmvx0i3t3686r" } }; });
  await ctx.route(URL, async route => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const r = mock.handle(JSON.parse(req.postData() || "{}"), req.headers()["x-api-key"]);
    await route.fulfill({ status: r.status || 200, headers: CORS, body: JSON.stringify(r.json) });
  });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(TOOL);
  await page.waitForFunction(() => window.DT && DT.SEQ >= 15);
  const settle = async () => page.waitForFunction(() => DT.OUTBOX.length === 0 && document.querySelector("#sync").className === "ok", null, { timeout: 5000 });
  const sent = op => mock.sent.filter(b => b.author !== "agent:test" && (b.op === op || (b.op === "apply" && b.ops.some(o => o.op === op))));   // page requests only; an op name inside apply counts
  const centreOf = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const drag = async (from, to) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 }); await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up(); };
  return { ctx, page, mock, errs, settle, sent, centreOf, drag };
}

(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(OUT, { recursive: true });
  {
    const R = await rig(browser);
    const { page } = R;
    const vis = () => page.evaluate(() => Array.from(document.querySelectorAll("#world [data-ref]")).map(e => e.dataset.ref).sort());
    const g0 = await vis();
    check("global shows every node and edge", g0.includes("node:n1") && g0.includes("node:w_pack") && g0.includes("edge:e_od") && g0.includes("node:t_orders"), g0.length + " refs");

    // data model layer
    await page.click('#layers [data-layer="data"]');
    const d0 = await vis();
    check("data model shows only data-storing nodes", d0.includes("node:t_orders") && d0.includes("node:t_cust") && d0.includes("node:t_ledger") && !d0.includes("node:n1") && !d0.includes("node:w_pack") && !d0.includes("note:note1") && !d0.includes("analysis:a1"), d0.join(","));
    check("edges only between visible nodes", d0.includes("edge:e_oc") && !d0.includes("edge:e_od") && !d0.includes("edge:e1"), d0.filter(x => x.startsWith("edge")).join(","));
    await R.settle();
    const vs = R.sent("view.set");
    check("layer switch writes view.set with layer", vs.length === 1 && vs[0].ops[0].payload.layer === "data", JSON.stringify(vs.map(b => b.ops[0].payload.layer)));
    // expand orders -> schema op once, columns drawn
    await page.click('[data-expand="t_orders"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-col="t_orders"]').length === 4);
    await page.click('[data-expand="t_orders"]'); await page.click('[data-expand="t_orders"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-col="t_orders"]').length === 4);
    const sch = R.sent("schema");
    check("expand calls schema once per key and renders the columns", sch.length === 1 && sch[0].key === "tbl:Pq0rdersTbl00001" && sch[0].draft_id === "dmvx0i3t3686r", sch.length + " schema calls");
    const rowTxt = await page.evaluate(() => Array.from(document.querySelectorAll('[data-col="t_orders"]')).map(g => Array.from(g.querySelectorAll("text")).map(t => t.textContent).join("|")));
    check("column rows show name | type | format/enum | key", rowTxt[1] === "customer_id|string||fk:tbl…" && rowTxt[2] === "status|string|paid|shipped|" && rowTxt[0].endsWith("|pk") && rowTxt[3] === "total|number|gbp|", rowTxt.join(" ; "));
    const ttl = await page.getAttribute('[data-col="t_orders"][data-field="customer_id"] title', "textContent").catch(() => null) || await page.evaluate(() => document.querySelector('[data-col="t_orders"][data-field="customer_id"] title').textContent);
    check("row tooltip carries the full key", /fk:tbl:customers/.test(ttl), ttl);
    check("expansion is view-only", R.sent("apply").every(b => b.ops.every(o => o.op === "view.set")), "no board op");
    // C998: a name-keyed table (tbl:CA_customers) is asked for by its bare name, which the engine resolves through std data_model
    await page.click('[data-expand="t_cust"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-col="t_cust"]').length === 2);
    const schc = R.sent("schema").filter(b => b.key !== "tbl:Pq0rdersTbl00001");
    check("tbl:<name> key is sent as the bare name (C998)", schc.length === 1 && schc[0].key === "CA_customers", JSON.stringify(schc.map(b => b.key)));
    const st = await page.evaluate(() => [
      DT.schemaTarget({ key: "tbl:pwlC29yKZxbj8jgV" }, "x", "n1"), DT.schemaTarget({ key: "tbl:CA_standards" }, "x", "n1"),
      DT.schemaTarget({ table: "tbl:FrdIprb6uGEtLLoe CA_V4_docs {doc_key, section}" }, "x", "n1"), DT.schemaTarget({ store: "DataTable CA_V4_index (to create)" }, "x", "n1"),
      DT.schemaTarget({ key: "tbl:(to create)" }, "x", "n1"), DT.schemaTarget({}, "CA_drafts", "n9"), DT.schemaTarget({}, "", "n9")]);
    check("schemaTarget: id kept, name stripped, token picked out of prose, otherwise first candidate (C998)",
      JSON.stringify(st) === JSON.stringify(["tbl:pwlC29yKZxbj8jgV", "CA_standards", "tbl:FrdIprb6uGEtLLoe", "DataTable CA_V4_index (to create)", "tbl:(to create)", "CA_drafts", "n9"]), JSON.stringify(st));
    // C998: a plain click on the node's title band toggles the columns; a drag still moves
    await page.click('[data-ref="node:t_cust"] rect.b', { position: { x: 30, y: 12 } });
    await page.waitForFunction(() => document.querySelectorAll('[data-col="t_cust"]').length === 0);
    check("click on a data node's title band collapses it (C998)", await page.evaluate(() => !DT.DM.expanded.has("t_cust") && document.querySelector('[data-ref="node:t_cust"]').classList.contains("sel")), "collapsed and selected");
    await page.click('[data-ref="node:t_cust"] rect.b', { position: { x: 30, y: 12 } });
    await page.waitForFunction(() => document.querySelectorAll('[data-col="t_cust"]').length === 2);
    check("click again expands it; schema not refetched (C998)", R.sent("schema").length === 2, R.sent("schema").length + " schema calls");

    const c0 = await R.centreOf('[data-ref="node:t_cust"] rect.b');
    await R.drag({ x: c0.x, y: c0.y - 60 }, { x: c0.x + 40, y: c0.y - 60 });   // from the title band, 40 px right
    await R.settle();
    check("drag on a data node moves it, no toggle (C998)", await page.evaluate(() => DT.DM.expanded.has("t_cust")) && R.sent("node.move").length === 1, R.sent("node.move").length + " node.move");
    await page.screenshot({ path: path.join(OUT, "40-data-model.png") });
    // click selects a column
    await page.click('[data-col="t_orders"][data-field="status"]');
    const csel = await page.evaluate(() => DT.DM.colSel);
    check("click selects a column", csel === "t_orders.status", csel);
    // drag customer_id onto customers.id -> menu -> fk
    await R.drag(await R.centreOf('[data-col="t_orders"][data-field="customer_id"]'), await R.centreOf('[data-col="t_cust"][data-field="id"]'));
    await page.click('#menu button:has-text("fk")');
    await R.settle();
    const s = await page.evaluate(() => JSON.parse(JSON.stringify(DT.S)));
    const fm = Object.values(s.edges).find(e => e.edge_class_id === "field_map");
    check("column drag emits edge.add field_map with from_field/to_field/relation", fm && fm.class_id === "field_map" && fm.from.id === "t_orders" && fm.to.id === "t_cust" && fm.attributes.from_field === "customer_id" && fm.attributes.to_field === "id" && fm.attributes.relation === "fk", JSON.stringify(fm && fm.attributes));
    const defs = R.sent("apply").flatMap(b => b.ops).filter(o => o.op === "edge_class.define" && o.payload.id === "field_map");
    check("field_map edge class defined first, as contracted", defs.length === 1 && defs[0].payload.parent === "relates_to" && defs[0].payload.directional === true && JSON.stringify(defs[0].payload.attributes) === JSON.stringify({ from_field: "", to_field: "", relation: "" }), JSON.stringify(defs[0] && defs[0].payload));
    const order = R.sent("apply").flatMap(b => b.ops).map(o => o.op);
    check("define precedes the edge.add in the same apply", order.indexOf("edge_class.define") >= 0 && order.indexOf("edge_class.define") < order.indexOf("edge.add"), order.join(","));
    // a second map does not redefine the class
    await R.drag(await R.centreOf('[data-col="t_orders"][data-field="id"]'), await R.centreOf('[data-col="t_cust"][data-field="email"]'));
    await page.click('#menu button:has-text("maps")');
    await R.settle();
    const defs2 = R.sent("apply").flatMap(b => b.ops).filter(o => o.op === "edge_class.define" && o.payload.id === "field_map");
    check("second field map reuses the class", defs2.length === 1 && Object.values(await page.evaluate(() => DT.S.edges)).filter(e => e.edge_class_id === "field_map").length === 2);
    // inspector shows the fields
    const insp = await page.textContent("#insp");
    check("inspector shows field_map edge with its fields", /Field map/.test(insp) && /\.id/.test(insp) && /\.email/.test(insp) && /maps/.test(insp), insp.replace(/\s+/g, " ").slice(0, 160));
    await page.click('[data-ref="node:t_orders"] rect.b', { position: { x: 20, y: 10 } });
    check("title-band click on an expanded node collapses it (C998)", await page.evaluate(() => !DT.DM.expanded.has("t_orders")));
    await page.click('[data-expand="t_orders"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-col="t_orders"]').length === 4);
    const insp2 = await page.textContent("#insp");
    check("node inspector lists field maps with fields", /customer_id/.test(insp2) && /fk/.test(insp2) && /customers/.test(insp2), insp2.replace(/\s+/g, " ").slice(0, 200));
    const lbl = await page.evaluate(() => Array.from(document.querySelectorAll('#world .e text')).map(t => t.textContent).filter(t => /⇢|→/.test(t)));
    check("field map edge is labelled by its fields on the board", lbl.some(t => t === "customer_id ⇢ id") && lbl.some(t => t === "id → email"), lbl.join(" ; "));
    await page.screenshot({ path: path.join(OUT, "41-field-map.png") });

    // process flow layer
    await page.click('#layers [data-layer="process"]');
    await page.waitForFunction(() => document.querySelectorAll("#flowList [data-tick]").length === 2);
    const p0 = await vis();
    check("process layer hides the draft and lists workflows from flows", p0.length === 0 && R.sent("flows").length === 1, p0.join(",") + " · " + R.sent("flows").length + " flows calls");
    await page.fill("#flFilter", "pack");
    check("filter box narrows the list", await page.evaluate(() => document.querySelectorAll("#flowList [data-tick]").length) === 1);
    await page.check('[data-tick="Pqjdoot0EPzoQxj0"]');
    await page.waitForFunction(() => document.querySelectorAll("#world .fs").length === 5);
    const fl = R.sent("flow");
    check("tick fetches flow by workflow_id", fl.length === 1 && fl[0].workflow_id === "Pqjdoot0EPzoQxj0", JSON.stringify(fl));
    const steps = await page.evaluate(() => Array.from(document.querySelectorAll("#world .fs")).map(g => ({ id: g.dataset.step, x: +g.querySelector("rect.sb").getAttribute("x"), kind: g.querySelector(".fk text").textContent, off: g.classList.contains("off") })));
    const xs = Object.fromEntries(steps.map(s => [s.id.split(":")[1], s.x]));
    check("steps drawn left to right by links, with kind badges", xs.s1 < xs.s2 && xs.s2 < xs.s3 && xs.s3 < xs.s4 && xs.s4 < xs.s5 && steps.find(s => s.id.endsWith(":s3")).kind === "decide" && steps.find(s => s.id.endsWith(":s5")).off, JSON.stringify(xs));
    const branches = await page.evaluate(() => Array.from(document.querySelectorAll("#world .fl text")).map(t => t.textContent));
    check("links carry branch labels", branches.includes("true") && branches.includes("false") && (await page.evaluate(() => document.querySelectorAll("#world .fl path").length)) === 5, branches.join(","));
    const p1 = await vis();
    check("wf:<id> node is drawn as the flow's head; other nodes stay hidden", p1.length === 1 && p1[0] === "node:w_pack", p1.join(","));
    const head = await page.evaluate(() => { const n = document.querySelector('[data-ref="node:w_pack"] rect.b'), r = document.querySelector("#world .fh rect"); return { ny: +n.getAttribute("y"), nx: +n.getAttribute("x"), ry: +r.getAttribute("y"), rx: +r.getAttribute("x") }; });
    check("flow region sits under its head node", head.rx === head.nx && head.ry > head.ny, JSON.stringify(head));
    await page.screenshot({ path: path.join(OUT, "42-process-flow.png") });
    const before = R.sent("apply").flatMap(b => b.ops).filter(o => o.op !== "view.set").length;
    await page.dblclick("#svg", { position: { x: 60, y: 40 } });
    await page.evaluate(() => DT.emit({ op: "note.set", payload: { id: "nt_x", text: "blocked" } }));
    await page.waitForTimeout(400); await R.settle().catch(() => {});
    const after = R.sent("apply").flatMap(b => b.ops).filter(o => o.op !== "view.set").length;
    check("no board ops from the process layer", before === after && !(await page.evaluate(() => DT.S.notes.nt_x)), before + " -> " + after);
    // reopen: the layer is restored from view.set
    await page.evaluate(() => DT.openDraft("dmvx0i3t3686r"));
    await page.waitForFunction(() => DT.LAYER === "process");
    check("layer restored from the author's last view.set on reopen", (await page.evaluate(() => DT.LAYER)) === "process");
    await page.click('#layers [data-layer="global"]');
    const g1 = await vis();
    check("back to global shows everything again", g1.includes("node:n1") && g1.includes("note:note1") && g1.length >= g0.length, g1.length + " refs");
    check("no page errors", R.errs.length === 0, R.errs.join(" | "));
    await R.ctx.close();
  }
  // engine without the ops: 400 unknown op -> toast, empty list / columns, no crash
  {
    const R = await rig(browser, { layers: false });
    const { page } = R;
    await page.click('#layers [data-layer="data"]');
    await page.click('[data-expand="t_orders"]');
    await page.waitForFunction(() => document.querySelector("#toast").style.display === "block");
    const t1 = await page.textContent("#toast");
    await page.waitForFunction(() => DT.DM.schema.size === 1);
    check("schema 400 degrades to a toast with the reason and an empty node", /schema tbl:Pq0rdersTbl00001/.test(t1) && /unknown/.test(t1) && (await page.evaluate(() => DT.DM.schema.get("tbl:Pq0rdersTbl00001").columns.length)) === 0 && (await page.textContent('[data-ref="node:t_orders"]')).includes("schema unavailable"), t1);
    await page.click('#layers [data-layer="process"]');
    await page.waitForFunction(() => DT.PF.loaded);
    const t2 = await page.textContent("#toast");
    check("flows 400 degrades to a toast and an empty list", /flows/.test(t2) && /unknown/.test(t2) && (await page.textContent("#flowList")).includes("No workflows"), t2);
    check("no page errors without the engine ops", R.errs.length === 0, R.errs.join(" | "));
    await R.ctx.close();
  }
  // layout fallback: a cycle falls back to the grid
  {
    const R = await rig(browser);
    const grid = await R.page.evaluate(() => DT.layoutFlow([{ id: "a" }, { id: "b" }, { id: "c" }], [{ from: "a", to: "b" }, { from: "b", to: "a" }, { from: "b", to: "c" }]));
    check("cyclic links fall back to a grid", grid.cols.length === 2 && grid.cols[0].length === 2, JSON.stringify(grid.cols));
    await R.ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "layers-results.json"), JSON.stringify(results, null, 2));
  const fails = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
