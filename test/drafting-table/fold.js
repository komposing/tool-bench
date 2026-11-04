// Fold acceptance (Drafting Table 1.4.0): comments (thread entries) and linked references (notes anchored to an object)
// collapse into their host behind one circular count bubble. Proves: folded by default; the bubble counts comments plus
// anchored notes and marks open comments; anchored notes and their anchor lines are off the board while folded, free
// notes stay; a bubble click expands one host (notes and reasoning bubbles return), a second click folds it; the header
// Fold toggle shows everything; fit ignores hidden notes; the inspector lists anchored notes and offers the toggle;
// goto on a hidden note expands its host; no page errors.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const TOOL = "file://" + path.resolve(__dirname, "../../tools/drafting-table.html");
const OUT = path.join(__dirname, "evidence");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
const SEED_OPS = [
  { op: "node.add", payload: { id: "n2", class_id: "c1", label: "review", attributes: {}, pos: { x: 320, y: 20 } } },
  { op: "note.set", payload: { id: "na1", text: "anchored note one", pos: { x: 40, y: 160 }, anchor: { type: "node", id: "n1" } } },
  { op: "note.set", payload: { id: "na2", text: "anchored note two", pos: { x: 40, y: 260 }, anchor: { type: "node", id: "n1" } } },
  { op: "note.set", payload: { id: "nb1", text: "anchored to review", pos: { x: 340, y: 160 }, anchor: { type: "node", id: "n2" } } },
  { op: "thread.add", payload: { id: "t2", owner: { type: "node", id: "n1" }, kind: "question", author: "agent:test", text: "second comment", status: "resolved" } },
  { op: "edge.add", payload: { id: "e_note", edge_class_id: "relates_to", from: { type: "note", id: "na1" }, to: { type: "node", id: "n2" }, attributes: {} } }
];
(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(OUT, { recursive: true });
  const mock = require("./mock.js")(path.join(__dirname, "seed.json"));
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
  await page.waitForFunction(() => window.DT && DT.SEQ >= 13);
  await page.click("#bFit");
  const vis = () => page.evaluate(() => Array.from(document.querySelectorAll("#world [data-ref]")).map(e => e.dataset.ref).sort());
  const bubble = host => page.evaluate(h => { const g = document.querySelector(`#world [data-fold="${h}"]`); return g && { n: g.querySelector("text").textContent, open: g.classList.contains("open"), tip: g.querySelector("title").textContent, dot: g.querySelectorAll("circle").length > 1 }; }, host);

  check("fold is on by default", await page.evaluate(() => DT.FOLD.all && document.querySelector("#tFold").classList.contains("on")));
  let v = await vis();
  check("anchored notes are hidden while folded", !v.includes("note:na1") && !v.includes("note:na2") && !v.includes("note:nb1"), v.filter(x => x.startsWith("note:")).join(","));
  check("free note stays on the board", v.includes("note:note1"));
  check("edge touching a hidden note is hidden", !v.includes("edge:e_note"));
  check("other edges still drawn", v.includes("edge:e1"));
  let b = await bubble("node:n1");
  check("host bubble counts comments plus anchored notes", b && b.n === "4" && !b.open, JSON.stringify(b));
  check("bubble marks an open comment and names the breakdown", b && b.dot && /2 comments \(1 open\) · 2 notes/.test(b.tip), b && b.tip);
  const b2 = await bubble("node:n2");
  check("a host with notes only still gets a bubble", b2 && b2.n === "1" && !b2.dot, JSON.stringify(b2));
  await page.screenshot({ path: path.join(OUT, "fold-01-folded.png") });

  // reasoning bubbles honour the fold
  await page.click("#tReason");
  check("reasoning bubbles stay hidden for a folded host", (await page.locator("#world .bub").count()) === 0);

  // click the bubble: host expands
  const bb = await page.locator('#world [data-fold="node:n1"]').boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  v = await vis(); b = await bubble("node:n1");
  check("bubble click expands the host: its notes return", v.includes("note:na1") && v.includes("note:na2") && !v.includes("note:nb1"), v.filter(x => x.startsWith("note:")).join(","));
  check("expanded host keeps the count in an open-ring bubble", b && b.open && b.n === "4", JSON.stringify(b));
  check("anchor lines drawn for the expanded host", (await page.locator("#world .foldline").count()) === 2);
  check("edge from the revealed note is back", v.includes("edge:e_note"));
  check("reasoning bubbles show for the expanded host", (await page.locator("#world .bub").count()) === 2);
  check("bubble click does not change the selection", await page.evaluate(() => DT.SEL.length === 0));
  await page.screenshot({ path: path.join(OUT, "fold-02-expanded.png") });
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  v = await vis();
  check("second click folds the host again", !v.includes("note:na1") && !(await bubble("node:n1")).open);

  // inspector
  await page.locator('#world [data-ref="node:n1"] rect.b').click();
  const insp = await page.locator("#insp").innerText();
  check("inspector shows fold state and the anchored notes", /folded\s*yes/i.test(insp) && /anchored notes/i.test(insp) && /anchored note one/.test(insp), insp.slice(0, 120).replace(/\n/g, " "));
  await page.locator("#insp [data-foldtoggle]").click();
  check("inspector toggle expands the host", (await vis()).includes("note:na1") && /folded\s*no/i.test(await page.locator("#insp").innerText()));
  await page.locator("#insp [data-foldtoggle]").click();
  // goto a hidden note from the finder-style link: open the note's host
  await page.evaluate(() => { INSP = { type: "node", id: "n2" }; SEL = [INSP]; renderInspector(); });
  await page.locator('#insp [data-goto="note:nb1"]').click();
  check("goto on a hidden note expands its host and selects the note", (await vis()).includes("note:nb1") && await page.evaluate(() => DT.SEL[0] && DT.SEL[0].id === "nb1"));

  // header toggle off: everything shows
  await page.click("#tFold");
  v = await vis();
  check("Fold off shows every note and edge", v.includes("note:na1") && v.includes("note:na2") && v.includes("note:nb1") && v.includes("edge:e_note"));
  check("Fold off: bubbles stay as counts without a fold hint", /2 notes$/.test((await bubble("node:n1")).tip));
  await page.screenshot({ path: path.join(OUT, "fold-03-off.png") });
  await page.click("#tFold");
  check("fit ignores hidden notes", await page.evaluate(() => { FOLD.open.clear(); const a = allBoxes().length; FOLD.all = false; const b = allBoxes().length; FOLD.all = true; return b === a + 3; }));
  check("no page errors", errs.length === 0, errs.join(" | "));
  fs.writeFileSync(path.join(OUT, "fold-results.json"), JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
