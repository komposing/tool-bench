// Exchanges lane acceptance (CA_V4, increment ca_v4/inc/D19-approvals-lane-build; design dmw1122kroij7 seq 64-108).
// The page against the drafting mock (mock.js) plus a routed stand-in for the CA_V4 Hub page entry
// (CONF.hubPageUrl) answering with the fixtures: hub-pending.json (v4.hub.pending as the Hub returns it),
// hub-post-ok.json (a decision landed) and hub-refused.json (the governor refused the post). Proves: the badge
// reads "–" until the first read and the count after it; the panel opens on the header control and reads once;
// every call is a ca.payload/1 envelope with the page principal; threads render newest first with "(n)" option
// buttons and an "other" steer; one click arms and a second within 5 s posts v4.hub.post {kind decision, answers,
// to = the asking session, body "<n>: <text>"}; a landed decision moves the row to the decided list, decrements the
// badge and refreshes; a refused post stays open with the refusal shown; "other" posts "other: <steer>"; a refused
// read shows "?" on the badge; an empty feed renders the empty state; nothing calls the V3 drafting endpoint.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const mock = require("./mock.js")(path.join(__dirname, "seed.json"));
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const HUB = "https://komposing.app.n8n.cloud/webhook/ca-v4-hub-page";
const TOOL = "file://" + path.resolve(__dirname, "../../tools/drafting-table.html");
const OUT = path.join(__dirname, "evidence");
const FIX = n => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", n), "utf8"));
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.TOOL_CONFIG = { drafting: { url: "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting", headers: { "X-Api-Key": "test-key" }, draft_id: "dmvx0i3t3686r", hub_page_url: "https://komposing.app.n8n.cloud/webhook/ca-v4-hub-page" } }; });
  await ctx.route(URL, async route => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const r = mock.handle(JSON.parse(req.postData() || "{}"), req.headers()["x-api-key"]);
    await route.fulfill({ status: r.status || 200, headers: CORS, body: JSON.stringify(r.json) });
  });
  // the Hub page entry stand-in: records every envelope; mode decides the reply. The page sends credentials: include
  // (the n8n user session), so the entry must answer with the caller's origin and allow-credentials, never "*"
  // (a browser drops a credentialed reply behind a wildcard origin) - CORS_CRED below is what a working entry sends.
  const hub = { calls: [], mode: "pending", refusePost: false };
  await ctx.route(HUB, async route => {
    const req = route.request();
    const CORS_CRED = Object.assign({}, CORS, { "access-control-allow-origin": req.headers()["origin"] || "null", "access-control-allow-credentials": "true" });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_CRED });
    const body = JSON.parse(req.postData() || "{}"); hub.calls.push(body);
    let reply;
    if (body.key === "v4.hub.pending") {
      if (hub.mode === "refuse") reply = Object.assign(FIX("hub-refused.json"), { key: "v4.hub.pending", errors: [{ param: "key", value: "v4.hub.pending", reason: "not signed in", code: "not_allowed" }] });
      else if (hub.mode === "empty") { reply = FIX("hub-pending.json"); reply.result.threads = []; reply.result.pending_count = 0; reply.result.count = 0; }
      else reply = FIX("hub-pending.json");
    } else if (body.key === "v4.hub.post") reply = hub.refusePost ? FIX("hub-refused.json") : FIX("hub-post-ok.json");
    else reply = { protocol: "ca.payload/1", outcome: "refused", key: body.key, result: {}, errors: [{ param: "key", value: body.key, reason: "the page entry serves v4.hub.pending | v4.hub.post only (D20)", code: "not_allowed" }] };
    await route.fulfill({ status: 200, headers: CORS_CRED, body: JSON.stringify(reply) });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await p.goto(TOOL);
  await p.waitForFunction(() => window.DT && DT.SEQ >= 7);
  const txt = sel => p.locator(sel).first().innerText();
  const AP = () => p.evaluate(() => JSON.parse(JSON.stringify({ count: DT.AP.count, open: DT.AP.open, threads: DT.AP.threads.map(t => t.thread_id), decided: DT.AP.decided, refusal: DT.AP.refusal, rows: Array.from(DT.AP.rows.entries()) })));

  // 1. badge before any read; no hub call at boot
  check("badge shows – before the first read, no hub call at boot", (await txt("#apprN")) === "–" && hub.calls.length === 0, `badge ${await txt("#apprN")}, calls ${hub.calls.length}`);
  check("tool block version bumped (minor)", await p.evaluate(() => JSON.parse(document.querySelector("#toolbench-tool").textContent).version) === "1.3.0");
  // 2. open the panel: one pending read with the page principal
  await p.click("#bAppr");
  await p.waitForFunction(() => DT.AP.readAt > 0 && !DT.AP.loading);
  const c0 = hub.calls[0];
  check("panel open reads v4.hub.pending once", hub.calls.length === 1 && c0.key === "v4.hub.pending" && c0.params.to === "operator" && c0.params.open_only === true && c0.params.limit === 40, JSON.stringify(c0.params));
  check("envelope is ca.payload/1 with the page principal", c0.protocol === "ca.payload/1" && c0.principal.surface === "page" && c0.principal.tool === "drafting-table" && /^page-/.test(c0.principal.tool_session_id) && c0.session_ref === c0.principal.tool_session_id, JSON.stringify(c0.principal));
  check("no viewer key in the V4 envelope", (await p.evaluate(() => DT.CONF.key)) === "test-key" && hub.calls.every(x => !("headers" in x) && !("X-Api-Key" in x) && !("key_value" in x)), "the drafting key stays on the V3 endpoint");
  let a = await AP();
  check("badge = exchanges count (proposals not read)", (await txt("#apprN")) === "3" && a.count === 3, `badge ${await txt("#apprN")}`);
  check("threads newest first", a.threads.join(",") === "hub-fixture-newer,hub-fixture-older", a.threads.join(","));
  const rows = await p.locator("#apBody .dr").count();
  check("one row per open decision", rows === 3, String(rows));
  const opts = await p.locator('#apBody .dr[data-row="hub-fixture-newer|5"] .opts button').allInnerTexts();
  check("(n) body lines render as option buttons in order", opts.length === 3 && opts[0].startsWith("(1) a webhook entry") && opts[2].startsWith("(3) other"), JSON.stringify(opts));
  check("a row without options shows the body and the other field only", (await p.locator('#apBody .dr[data-row="hub-fixture-older|4"] .opts button').count()) === 0 && (await p.locator('#apBody .dr[data-row="hub-fixture-older|4"] form[data-other] input').count()) === 1);
  check("refs render as chips and links", (await p.locator('#apBody .dr[data-row="hub-fixture-newer|5"] .ref').count()) === 2 && (await p.locator('#apBody .dr[data-row="hub-fixture-newer|5"] a.ref').count()) === 1);
  check("proposals lane is a visible stub", /stub/i.test(await txt("#apBody .lane.stub h3")) && /not read/.test(await txt("#apBody .sum")));
  await p.screenshot({ path: path.join(OUT, "50-exchanges-lane.png") });
  // 3. one click arms, nothing posted; a second click posts the decision
  const opt1 = p.locator('#apBody .dr[data-row="hub-fixture-newer|5"] .opts button[data-opt="1"]');
  await opt1.click();
  check("first click arms the option, no post", (await opt1.getAttribute("class")) === "armed" && hub.calls.filter(x => x.key === "v4.hub.post").length === 0);
  await p.screenshot({ path: path.join(OUT, "51-option-armed.png") });
  await p.locator('#apBody .dr[data-row="hub-fixture-newer|5"] .opts button[data-opt="1"]').click();
  await p.waitForFunction(() => DT.AP.decided.length === 1 && !DT.AP.loading);
  const post = hub.calls.find(x => x.key === "v4.hub.post");
  check("second click posts v4.hub.post kind decision", post && post.params.thread_id === "hub-fixture-newer" && post.params.kind === "decision" && post.params.answers === 5, post && JSON.stringify(post.params));
  check("body is the option number and text; to = the asking session", post && post.params.body === "1: a webhook entry on the Hub now [recommended]" && post.params.to === "claude-ai-fixture-newer", post && post.params.to);
  check("refs of the row ride on the decision", post && JSON.parse(post.params.refs).length === 2);
  a = await AP();
  check("row moves to the decided list with the decision seq", a.decided.length === 1 && a.decided[0].decision_seq === 10 && (await p.locator('#apBody .dr[data-row="hub-fixture-newer|5"].decided').count()) === 1, JSON.stringify(a.decided[0]));
  check("panel refreshed after the settle", hub.calls.filter(x => x.key === "v4.hub.pending").length === 2, String(hub.calls.filter(x => x.key === "v4.hub.pending").length));
  await p.screenshot({ path: path.join(OUT, "52-decided.png") });
  // 4. other: typed steer, submit twice
  const other = p.locator('#apBody .dr[data-row="hub-fixture-older|4"] form[data-other]');
  await other.locator("input").fill("go with the webhook, name it Doc Page"); await other.locator("button").click();
  check("other submit arms the field", (await p.locator('#apBody .dr[data-row="hub-fixture-older|4"] form[data-other]').getAttribute("class")) === "armed" && hub.calls.filter(x => x.key === "v4.hub.post").length === 1);
  await p.locator('#apBody .dr[data-row="hub-fixture-older|4"] form[data-other] button').click();
  await p.waitForFunction(() => DT.AP.decided.length === 2 && !DT.AP.loading);
  const post2 = hub.calls.filter(x => x.key === "v4.hub.post")[1];
  check("other posts the steer prefixed by other", post2 && post2.params.body === "other: go with the webhook, name it Doc Page" && post2.params.answers === 4 && post2.params.thread_id === "hub-fixture-older", post2 && post2.params.body);
  // 5. a refused post stays open with the refusal shown
  hub.refusePost = true;
  const opt8 = () => p.locator('#apBody .dr[data-row="hub-fixture-newer|8"] .opts button[data-opt="2"]');
  await opt8().click(); await opt8().click();
  await p.waitForFunction(() => { const r = DT.AP.rows.get("hub-fixture-newer|8"); return r && r.state === "refused"; });
  check("refused post: row stays open, refusal {code, reason} in place, no retry", (await p.locator('#apBody .dr[data-row="hub-fixture-newer|8"] .refusal').count()) === 1 && /not_allowed/.test(await txt('#apBody .dr[data-row="hub-fixture-newer|8"] .refusal')) && hub.calls.filter(x => x.key === "v4.hub.post").length === 3 && (await p.locator('#apBody .dr[data-row="hub-fixture-newer|8"] .opts button').count()) === 2);
  await p.screenshot({ path: path.join(OUT, "53-refused.png") });
  hub.refusePost = false;
  // 6. filters
  await p.selectOption("#apFrom", "session_01fixture");
  check("filter by asking session narrows the rows", (await p.locator("#apBody .dr[data-row]").count()) === 1);
  await p.selectOption("#apFrom", ""); await p.selectOption("#apThread", "hub-fixture-older");
  check("filter by thread narrows the threads", (await p.locator("#apBody .thr").count()) === 1);
  await p.selectOption("#apThread", "");
  // 7. a refused read: badge ? and the refusal in the lane
  hub.mode = "refuse"; await p.click("#apRefresh"); await p.waitForFunction(() => DT.AP.refusal && !DT.AP.loading);
  check("refused read: badge shows ? and the lane shows the refusal", (await txt("#apprN")) === "?" && /refused/.test(await txt("#apBody .lane:not(.stub)")));
  // 8. empty feed
  hub.mode = "empty"; await p.click("#apRefresh"); await p.waitForFunction(() => !DT.AP.refusal && DT.AP.count === 0 && !DT.AP.loading);
  check("empty feed: no decisions waiting with the last read time", /No decisions waiting/.test(await txt("#apBody .lane:not(.stub)")) && (await txt("#apprN")) === "0");
  await p.screenshot({ path: path.join(OUT, "54-empty.png") });
  // 9. close and reopen reads again
  await p.click("#apClose"); check("close hides the panel", !(await p.evaluate(() => DT.AP.open)) && (await p.locator("#app.appr").count()) === 0);
  const n = hub.calls.filter(x => x.key === "v4.hub.pending").length; hub.mode = "pending"; await p.click("#bAppr"); await p.waitForFunction(() => !DT.AP.loading && DT.AP.count === 3);
  check("reopen reads again", hub.calls.filter(x => x.key === "v4.hub.pending").length === n + 1);
  // 10. the V3 drafting endpoint saw no hub traffic
  check("nothing V4 went to the V3 drafting endpoint", mock.sent.every(b => !b.protocol && !b.key));
  check("no page errors", errs.length === 0, errs.join(" | "));
  fs.writeFileSync(path.join(OUT, "exchanges-results.json"), JSON.stringify({ results, calls: hub.calls }, null, 2));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
