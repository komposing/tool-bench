// Pack & Ship v2 page harness (C1059, C841-s7): runs TB:pack-ship 2.0.0 inside the built bench against a stand-in for the
// ca-v3-pack-ship front door. Synthetic orders only (no live data). Proves: the table is drawn from the stage read alone
// (columns from stage_defs, icon colours from states), buttons follow the actions list (disabled ones show their reason, no
// request), inputs are sent as the action names them, Refresh starts, polls and reloads, a busy guard holds the button, and a
// print reply composes the document. Runs the tool file standalone with the TOOL_CONFIG the bench injects.
//   NODE_PATH=$(npm root -g) node test/pack-ship/page.js     (after node scripts/build.mjs)
const { chromium } = require("playwright");
const path = require("path");
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-pack-ship";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const st = (h, c, l, d, t) => [["health", h], ["collection", c], ["label", l], ["packed", "later"], ["dropped_off", d], ["tracking", t]].map(([key, state]) => ({ key, state, text: key + " " + state }));
const READ = { status: "ok", outcome: "ok", data: { outcome: "ok", count: 3, truncated: false,
  stage_defs: [["health", "Order health"], ["collection", "Collection"], ["label", "Label"], ["packed", "Packed"], ["dropped_off", "Dropped off"], ["tracking", "Tracking"]].map(([key, label]) => ({ key, label })),
  states: { none: { icon: "orange" }, partial: { icon: "yellow" }, done: { icon: "green" }, later: { icon: "grey" } },
  last_sync: { orders: "2026-11-04T09:51:32.763Z" },
  orders: [
    { order_ref: "1111111-1", order_date: "2026-11-01", status: "In Progress", stages: st("done", "done", "done", "none", "done"),
      actions: [{ key: "label", cap: "print.queue.add", then: "label.bytes", enabled: true, reason: "booked: print packing list and label", inputs: ["copies"], state: "done" },
                { key: "message", cap: "discogs.orders.lifecycle", then: "discogs.orders.message.send", enabled: true, reason: "label_booked message due", inputs: ["custom_text"], state: "done" }] },
    { order_ref: "1111111-2", order_date: "2026-11-02", status: "Payment Received", stages: st("partial", "partial", "partial", "none", "none"),
      actions: [{ key: "label", cap: "parcel2go.drafts.list", enabled: true, reason: "draft: open the checkout link", state: "partial" },
                { key: "message", cap: "discogs.orders.lifecycle", enabled: false, reason: "no buyer message due, or already logged", state: "none" }] },
    { order_ref: "1111111-3", order_date: "2026-11-03", status: "Shipped", stages: st("none", "later", "none", "none", "none"),
      actions: [{ key: "label", cap: "", enabled: false, reason: "shipped without a Parcel2Go line", state: "none" }] }
  ] } };
const sent = [];
let busy = false, polls = 0;
function handle(b) {
  sent.push(b);
  const p = b.params || {};
  if (b.op === "orders_stages") return READ;
  if (b.op === "run_status") {
    if (!p.run_ref) return { status: "ok", outcome: "ok", data: { busy, busy_runs: busy ? [{ parent_run_id: "x", steps_done: 2 }] : [] } };
    polls++;
    const done = polls >= 3;
    return { status: "ok", outcome: "ok", data: { busy: false, run: { run_ref: p.run_ref, state: done ? "done" : "running", outcome: done ? "ok" : "", steps_done: done ? 5 : polls, steps: [{ key: "discogs.items.sync", outcome: "ok" }], duration_ms: 1500 } } };
  }
  if (b.op === "refresh") return busy ? { status: "ok", outcome: "busy", poll: { op: "run_status", every_ms: 300, max_ms: 3000 } } : { status: "ok", outcome: "started", run_id: "tb-test-run-1", poll: { op: "run_status", every_ms: 300, max_ms: 6000 } };
  if (b.op === "action") {
    if (p.action === "label" && p.order_ref === "1111111-1") return { status: "ok", outcome: "ok", steps: [
      { cap: "print.queue.add", status: "ok", outcome: "ok", data: { job_id: "job-1", copies: p.inputs && p.inputs.copies, packing_rows: [{ location: "A1", artist: "Artist", title: "Title", format: "LP", media_condition: "VG+", sleeve_condition: "VG" }], label_url: "" } },
      { cap: "label.bytes", status: "ok", outcome: "ok", data: { label_b64: PNG, label_content_type: "image/png", label_bytes: 70 } }] };
    if (p.action === "label" && p.order_ref === "1111111-2") return { status: "ok", outcome: "ok", steps: [{ cap: "parcel2go.drafts.list", status: "ok", outcome: "ok", data: { rows: [{ payment_url: "https://www.parcel2go.com/order/payment/abc" }], row_count: 1 } }] };
    if (p.action === "message") return { status: "ok", outcome: "ok", steps: [{ cap: "discogs.orders.lifecycle", status: "ok", outcome: "ok", data: {} }] };
  }
  return { status: "error", outcome: "param_rejected", message: "unexpected" };
}
const checks = [];
const ok = (name, v) => { checks.push([name, !!v]); console.log((v ? "ok   " : "FAIL ") + name); };
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(URL, async route => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    await route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(handle(JSON.parse(req.postData() || "{}"))) });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  // Playwright routing does not reach fetches from the bench's sandboxed srcdoc frame (they went to the live host and got 403),
  // so the page runs standalone with the TOOL_CONFIG the bench would inject (the viewer's key only: cav3 fallback).
  await ctx.addInitScript(() => { window.TOOL_CONFIG = { cav3: { dashboard: { headers: { "X-Api-Key": "test-key" } } }, packship: { url: "https://komposing.app.n8n.cloud/webhook/ca-v3-pack-ship", window_days: 14, copies: 1, auto_print: false } }; });
  await p.goto("file://" + path.resolve(__dirname, "../../tools/pack-ship.html"));
  await p.waitForTimeout(1000);
  const fr = p.mainFrame();
  const f = p;
  ok("page reads with the cav3 key fallback", sent.some(b => b.op === "orders_stages"));
  ok("stage read asks window_days 14", sent.find(b => b.op === "orders_stages").params.window_days === 14);
  ok("busy check on load", sent.some(b => b.op === "run_status" && !b.params.run_ref));
  const heads = await fr.$$eval("thead th", t => t.map(x => x.textContent));
  ok("columns from stage_defs", JSON.stringify(heads) === JSON.stringify(["order", "status", "Order health", "Collection", "Label", "Packed", "Dropped off", "Tracking", "actions"]));
  const dots = await fr.$$eval("tbody tr:first-child .dot", d => d.map(x => getComputedStyle(x).backgroundColor));
  ok("six icons per row", dots.length === 6);
  ok("icon colours from states (done green, none orange, later grey)", dots[0] === "rgb(46, 157, 72)" && dots[4] === "rgb(224, 123, 0)" && dots[3] === "rgb(163, 169, 174)");
  const ydot = await fr.$eval("tbody tr:nth-child(2) .dot", x => getComputedStyle(x).backgroundColor);
  ok("partial yellow", ydot === "rgb(232, 194, 28)");
  ok("stage text shown", (await fr.$eval("tbody tr:first-child .st .t", x => x.textContent)) === "health done");
  const dis = await fr.$eval('button[data-ref="1111111-3"][data-act="label"]', b => ({ d: b.disabled, why: b.parentElement.querySelector(".why").textContent }));
  ok("disabled action shows its reason", dis.d && dis.why === "shipped without a Parcel2Go line");
  const n0 = sent.length; await fr.$eval('button[data-ref="1111111-3"][data-act="label"]', b => b.click()); await p.waitForTimeout(200);
  ok("disabled action sends nothing", sent.length === n0);
  ok("custom_text field only on the action naming it", (await fr.$$('input[data-inp="custom_text"]')).length === 1 && (await fr.$$('input[data-inp="copies"]')).length === 0);
  ok("custom_text max 160", (await fr.$eval('input[data-inp="custom_text"]', i => i.maxLength)) === 160);
  // message: custom_text sent as an input of the action, nothing else
  await f.locator('input[data-inp="custom_text"]').fill("TEST note");
  await f.locator('button[data-ref="1111111-1"][data-act="message"]').click(); await p.waitForTimeout(500);
  const m = sent.filter(b => b.op === "action" && b.params.action === "message").pop();
  ok("message posts op action with order_ref, action and custom_text only", m && m.params.order_ref === "1111111-1" && JSON.stringify(m.params.inputs) === JSON.stringify({ custom_text: "TEST note" }));
  ok("message notice names the follow-on approval card", (await fr.$eval("#toast", t => t.textContent)).includes("own approval card"));
  // draft: checkout link from rows
  await f.locator('button[data-ref="1111111-2"][data-act="label"]').click(); await p.waitForTimeout(500);
  ok("draft action shows the checkout link", (await fr.$eval('[data-links="1111111-2|label"]', x => x.innerHTML)).includes("/order/payment/abc"));
  // print: copies from the page control, document composed from the two steps
  await f.locator("#copies").fill("2");
  await f.locator('button[data-ref="1111111-1"][data-act="label"]').click(); await p.waitForTimeout(1200);
  const pr = sent.filter(b => b.op === "action" && b.params.action === "label" && b.params.order_ref === "1111111-1").pop();
  ok("print posts copies 2 from the page control", pr && pr.params.inputs.copies === 2);
  const doc = await fr.$eval("#doc", d => d.srcdoc);
  ok("print document: packing slip plus 2 label pages", doc.includes("PACKING SLIP") && (doc.match(/class="pg lab"/g) || []).length === 2 && doc.includes("data:image/png;base64"));
  ok("print button enabled", !(await fr.$eval("#printBtn", b => b.disabled)));
  // refresh: start, poll by run_ref, reload stages after done
  const reads0 = sent.filter(b => b.op === "orders_stages").length;
  await f.locator("#refresh").click(); await p.waitForTimeout(150);
  ok("refresh disables the button while running", await fr.$eval("#refresh", b => b.disabled));
  await p.waitForTimeout(4500); // poll every_ms is clamped to at least 1000 by the page
  ok("polls run_status with run_ref = run_id", sent.filter(b => b.op === "run_status" && b.params.run_ref === "tb-test-run-1").length >= 3);
  ok("refresh re-enabled and stages reloaded after done", !(await fr.$eval("#refresh", b => b.disabled)) && sent.filter(b => b.op === "orders_stages").length > reads0);
  // busy guard
  busy = true;
  await f.locator("#refresh").click(); await p.waitForTimeout(400);
  ok("busy guard holds the button", (await fr.$eval("#refresh", b => b.disabled && b.textContent)) === "Sync running");
  busy = false; await p.waitForTimeout(2500);
  ok("button released when the chain ends", !(await fr.$eval("#refresh", b => b.disabled)));
  ok("only page ops sent", sent.every(b => ["orders_stages", "run_status", "refresh", "action"].includes(b.op)));
  ok("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  await p.screenshot({ path: path.join(__dirname, "page.png") });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, "page-390.png") });
  await browser.close();
  const failed = checks.filter(c => !c[1]).length;
  console.log(`${checks.length - failed}/${checks.length} checks`); process.exit(failed ? 1 : 0);
})();
