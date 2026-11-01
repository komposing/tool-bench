const { chromium } = require("playwright");
const path = require("path");
const mock = require("./mock.js")(path.join(__dirname, "seed.json"));
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const origins = new Set();
  await ctx.route(URL, async route => {
    const req = route.request(); origins.add(req.headers()["origin"] || "(none)");
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const r = mock.handle(JSON.parse(req.postData() || "{}"), req.headers()["x-api-key"]);
    await route.fulfill({ status: r.status || 200, headers: CORS, body: JSON.stringify(r.json) });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + path.resolve(__dirname, "../../dist/tool-bench.html"));
  await p.waitForTimeout(500);
  // the viewer's key only (cav3), so the Drafting Table must fall back to it; and the draft to open
  await p.evaluate(() => { state.config.cav3 = { dashboard: { headers: { "X-Api-Key": "test-key" } } }; state.config.drafting = { draft_id: "dmvx0i3t3686r" }; persist(); });
  await p.waitForTimeout(800); await p.reload(); await p.waitForTimeout(800);
  const card = await p.locator('article.tool[data-id="TB:drafting-table"]').count();
  console.log("bench lists TB:drafting-table:", card === 1);
  await p.evaluate(() => openRunner("TB:drafting-table"));
  const f = p.frameLocator("#runFrame");
  const frame = () => p.frames().find(x => x !== p.mainFrame());
  await p.waitForFunction(() => { const fr = document.querySelector("#runFrame"); return fr && fr.srcdoc && fr.srcdoc.includes("Drafting Table"); });
  await new Promise(r => setTimeout(r, 1500));
  const fr = frame();
  await p.screenshot({ path: path.join(__dirname, "evidence", "07-in-bench.png") }); console.log("frames", p.frames().length, "origins", [...origins]); console.log("frame state", await fr.evaluate(() => ({ dt: !!window.DT, seq: window.DT && DT.SEQ, sync: document.querySelector("#syncTxt") && document.querySelector("#syncTxt").textContent, insp: document.querySelector("#insp").innerText.slice(0,200), cfg: JSON.stringify(window.TOOL_CONFIG) })).catch(e => e.message));
  await fr.waitForFunction(() => window.DT && DT.SEQ >= 7, null, { timeout: 8000 });
  console.log("runs inline, sandbox:", await p.evaluate(() => document.querySelector("#runFrame").getAttribute("sandbox")), "origin seen by engine:", [...origins].join(","));
  console.log("key from:", await fr.evaluate(() => document.querySelector("#bSet") && (window.TOOL_CONFIG.drafting.url)), "meta host:", await fr.evaluate(() => TOOL_META.host + " " + TOOL_META.version));
  await p.screenshot({ path: path.join(__dirname, "evidence", "07-in-bench.png") });
  // tool-side save of settings through toolbench:config:set
  await f.locator("#bSet").click(); await f.locator("#cPoll").fill("1500"); await f.locator("#cSave").click();
  await p.waitForTimeout(1500);
  const stored = await p.evaluate(() => state.config.drafting);
  console.log("stored drafting settings:", JSON.stringify(stored));
  const fr2 = p.frames().find(x => x !== p.mainFrame());
  await fr2.waitForFunction(() => window.DT && DT.SEQ >= 7, null, { timeout: 8000 });
  console.log("reloaded with poll_ms:", await fr2.evaluate(() => TOOL_CONFIG.drafting.poll_ms));
  console.log("page errors:", errs.length ? errs : "none");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
