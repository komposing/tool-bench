// Drill-down lab: scope nesting, portals, ports, semantic zoom, group collapse, history scrub, keyboard walk.
// Same stand-in engine as run.js; proves what the page does with the op log.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const mock = require("./mock.js")(path.join(__dirname, "seed.json"));
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const TOOL = "file://" + path.resolve(__dirname, "../../tools/drafting-table.html");
const OUT = path.join(__dirname, "evidence");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.TOOL_CONFIG = { drafting: { url: "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting", headers: { "X-Api-Key": "test-key" }, poll_ms: 2000, debounce_ms: 100, draft_id: "dmvx0i3t3686r" } }; });
  await ctx.route(URL, async route => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const r = mock.handle(JSON.parse(req.postData() || "{}"), req.headers()["x-api-key"]);
    await route.fulfill({ status: r.status || 200, headers: CORS, body: JSON.stringify(r.json) });
  });
  const A = await ctx.newPage(); const errs = [];
  A.on("pageerror", e => errs.push(e.message)); A.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await A.goto(TOOL); await A.waitForFunction(() => window.DT && DT.SEQ >= 7);
  const S = () => A.evaluate(() => JSON.parse(JSON.stringify(DT.S)));
  const settle = async () => { await A.waitForFunction(() => DT.OUTBOX.length === 0 && document.querySelector("#sync").className === "ok", null, { timeout: 5000 }); };
  const centreOf = async sel => { const b = await A.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const drag = async (from, to, mods) => { await A.mouse.move(from.x, from.y); await A.mouse.down(); await A.mouse.move(from.x + 10, from.y + 10, { steps: 3 }); await A.mouse.move(to.x, to.y, { steps: 12 }); if (mods && mods.alt) await A.keyboard.down("Alt"); await A.mouse.up(); if (mods && mods.alt) await A.keyboard.up("Alt"); };

  // seed: the agent adds a sub-board under n1 (two nodes scoped to it, one edge out to the root node n2), plus attributes for ports
  const seedOps = [
    { op: "node.add", payload: { id: "n2", class_id: "undefined", label: "despatch", attributes: {}, pos: { x: 420, y: 60 } } },
    { op: "node.add", payload: { id: "n3", class_id: "undefined", label: "invoice", attributes: {}, pos: { x: 420, y: 220 } } },
    { op: "edge.add", payload: { id: "e12", edge_class_id: "relates_to", from: { type: "node", id: "n1" }, to: { type: "node", id: "n2" }, attributes: {} } },
    { op: "node.amend", payload: { id: "n1", attributes: { owner: "ops", sla: "24h", channel: "" } } },
    { op: "node.add", payload: { id: "k1", class_id: "undefined", label: "pick", attributes: { bin: "A3" }, pos: { x: 40, y: 40 }, scope: { type: "node", id: "n1" } } },
    { op: "node.add", payload: { id: "k2", class_id: "undefined", label: "pack", attributes: {}, pos: { x: 300, y: 40 }, scope: { type: "node", id: "n1" } } },
    { op: "edge.add", payload: { id: "ke1", edge_class_id: "relates_to", from: { type: "node", id: "k1" }, to: { type: "node", id: "k2" }, attributes: {} } },
    { op: "edge.add", payload: { id: "ke2", edge_class_id: "relates_to", from: { type: "node", id: "k2" }, to: { type: "node", id: "n2" }, attributes: {} } },
  ];
  const r0 = mock.agentApply("dmvx0i3t3686r", seedOps);
  await A.waitForFunction(seq => DT.SEQ >= seq, r0.seq_head);
  await A.click("#bFit"); await A.screenshot({ path: path.join(OUT, "50-root-with-subboard.png") });
  const kidsBadge = await A.locator('[data-drill="n1"]').count();
  check("parent node shows a child-count badge", kidsBadge === 1, "▣ 2 on n1");
  const kidsHidden = await A.locator('#world [data-ref="node:k1"]').count();
  check("scoped nodes are hidden on the root board", kidsHidden === 0);
  const crossEdge = await A.locator('#world [data-ref="edge:ke2"]').count();
  check("edge from inside the sub-board draws to the parent on the root board", crossEdge === 1);

  // drill in by double-click
  await A.click('[data-ref="node:n1"] rect.b'); await A.click('[data-ref="node:n1"] rect.b');
  await A.waitForFunction(() => DT.SCOPE && DT.SCOPE.id === "n1");
  await settle();
  const crumbs = await A.textContent("#crumbs");
  check("double-click drills in; breadcrumb shows the scope", /smoke.*›.*/.test(crumbs), crumbs.trim());
  const inside = await A.locator('#world [data-ref="node:k1"], #world [data-ref="node:k2"]').count();
  check("inside the sub-board its nodes show", inside === 2);
  const portal = await A.locator('[data-portal="node:n2"]').count();
  check("the far end of a crossing edge appears as a portal chip", portal === 1);
  const rootHidden = await A.locator('#world [data-ref="node:n1"]').count();
  check("root nodes are not on the sub-board", rootHidden === 0);
  const viewScope = mock.sent.filter(b => b.op === "apply").flatMap(b => b.ops).filter(o => o.op === "view.set").some(o => o.payload.scope && o.payload.scope.id === "n1");
  check("view.set carries the scope", viewScope);
  await A.screenshot({ path: path.join(OUT, "51-inside-n1.png") });

  // add a node inside: it takes the scope
  await A.dblclick("#svg", { position: { x: 700, y: 600 } });
  await A.keyboard.type("label"); await A.keyboard.press("Enter"); await settle();
  let s = await S(); const added = Object.values(s.nodes).find(n => n.label === "label");
  check("a node added inside carries scope: n1", added && added.scope && added.scope.id === "n1");

  // portal click jumps to the far object's board
  await A.click('[data-portal="node:n2"]');
  await A.waitForFunction(() => DT.SCOPE === null); await settle();
  check("clicking a portal climbs to the board that holds its object", true);

  // ports: toggle, drag from a port to another node
  await A.click("#tPorts"); await A.waitForTimeout(100);
  const port = await A.locator('[data-port="n1"][data-key="owner"]').count();
  check("ports: attribute keys render as rows on the node", port === 1);
  await A.screenshot({ path: path.join(OUT, "52-ports.png") });
  const pc = await centreOf('[data-port="n1"][data-key="sla"] circle');
  const n2c = await centreOf('[data-ref="node:n2"] rect.b');
  await drag(pc, n2c);
  await A.keyboard.type("bounds"); await A.keyboard.press("Enter"); await settle();
  s = await S(); const keyed = Object.values(s.edges).find(e => e.from.id === "n1" && e.from.key === "sla");
  check("drag from a port makes an edge with from.key", keyed, keyed && keyed.edge_class_id);

  // semantic zoom
  await A.mouse.move(640, 400);
  for (let i = 0; i < 12; i++) await A.mouse.wheel(0, 300);
  await A.waitForTimeout(100);
  const lod0 = await A.evaluate(() => DT.LOD + ":" + document.querySelector("#world").getAttribute("class"));
  check("zooming out drops to chip level (lod0)", /^0:lod0$/.test(lod0), lod0);
  await A.screenshot({ path: path.join(OUT, "53-lod0.png") });
  for (let i = 0; i < 30; i++) await A.mouse.wheel(0, -300);
  await A.waitForTimeout(100);
  const lod2 = await A.evaluate(() => DT.LOD);
  check("zooming in opens detail level (lod2, attributes inline without the Ports toggle)", lod2 === 2, "lod " + lod2);
  await A.click("#bFit"); await A.click("#tPorts");

  // group collapse
  await A.click('[data-ref="node:n1"] rect.b'); await A.click('[data-ref="node:n2"] rect.b', { modifiers: ["Shift"] });
  await A.click('[data-ref="node:n2"] rect.b', { button: "right" });
  await A.click("text=Group"); await A.keyboard.press("Escape"); await settle();
  s = await S(); const gid = Object.keys(s.groups).find(k => (s.groups[k].member_refs || []).length === 2);
  check("grouped two nodes", gid);
  await A.click(`[data-ref="group:${gid}"] rect.gb`, { button: "right", position: { x: 4, y: 4 } });
  await A.click("text=Collapse group"); await settle();
  s = await S();
  check("collapse writes group.set collapsed:true", s.groups[gid].collapsed === true);
  const folded = await A.locator(`[data-ref="group:${gid}"].folded`).count();
  const memberHidden = await A.locator('#world [data-ref="node:n1"]').count();
  check("a collapsed group draws as one box and hides its members", folded === 1 && memberHidden === 0);
  await A.screenshot({ path: path.join(OUT, "54-folded.png") });
  await A.click(`[data-ref="group:${gid}"] rect.gb`); await A.click(`[data-ref="group:${gid}"] rect.gb`); await settle();
  s = await S(); check("double-click expands the group", s.groups[gid].collapsed === false);

  // history scrub
  const headNow = await A.evaluate(() => DT.SEQ);
  await A.click("#tScrub"); await A.waitForTimeout(50);
  await A.evaluate(() => DT.setScrub(7));
  const atSeven = await A.evaluate(() => Object.keys(DT.S.nodes).length + "|" + DT.SCRUB);
  check("history scrub replays the board to seq 7 (only the seed nodes)", /^\d+\|7$/.test(atSeven) && +atSeven.split("|")[0] <= 3, atSeven);
  await A.screenshot({ path: path.join(OUT, "55-scrub.png") });
  await A.dblclick("#svg", { position: { x: 300, y: 300 } }); await A.waitForTimeout(150);
  const stillHead = await A.evaluate(() => DT.OUTBOX.length);
  check("the board is read-only while scrubbing", stillHead === 0);
  await A.click("#scrubOff"); await A.waitForTimeout(50);
  const back = await A.evaluate(() => DT.SCRUB === null && DT.SEQ);
  check("closing history returns to the head", back === headNow, "seq " + back);

  // keyboard walk: select n1, ArrowRight follows the edge to n2, Enter drills into n1
  await A.click('[data-ref="node:n1"] rect.b');
  await A.keyboard.press("ArrowRight"); await A.waitForTimeout(50);
  const selAfter = await A.evaluate(() => (document.querySelector(".n.sel") || {}).dataset && document.querySelector(".n.sel").dataset.ref);
  check("ArrowRight walks along an edge to the neighbour", selAfter === "node:n2", selAfter);
  await A.click('[data-ref="node:n1"] rect.b'); await A.keyboard.press("Enter");
  await A.waitForFunction(() => DT.SCOPE && DT.SCOPE.id === "n1");
  await A.keyboard.press("Escape"); await A.waitForTimeout(50); await A.keyboard.press("Escape");
  await A.waitForFunction(() => DT.SCOPE === null);
  check("Enter drills in, Escape climbs out", true);

  // alt-drop: move a root node inside n1
  await A.click("#bFit"); await settle();
  const n3 = await A.locator('[data-ref="node:n3"] rect.b').count();
  if (n3) {
    await drag(await centreOf('[data-ref="node:n3"] rect.b'), await centreOf('[data-ref="node:n1"] rect.b'), { alt: true });
    await settle(); s = await S();
    check("alt-drop onto a node moves the selection onto its board (node.amend scope)", s.nodes.n3.scope && s.nodes.n3.scope.id === "n1");
  }

  check("no page errors", errs.length === 0, errs.join(" | "));
  fs.writeFileSync(path.join(OUT, "lab-results.json"), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(OUT, "lab-sent.json"), JSON.stringify(mock.sent.filter(b => b.op === "apply"), null, 1));
  console.log(results.filter(r => r.ok).length + "/" + results.length + " passed");
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})();
