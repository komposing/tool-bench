// Pack & Ship page harness (C1059, C841-s7; 2.1.0 C1141, C841-s10; 2.2.0 C1146; 2.3.0 C1194): runs TB:pack-ship 2.3.0 inside the built bench against a stand-in for the
// ca-v3-pack-ship front door. Synthetic orders only (no live data). Proves: the table is drawn from the stage read alone
// (columns from stage_defs, icon colours from states), buttons follow the actions list (disabled ones show their reason, no
// request), inputs are sent as the action names them, Refresh starts, polls and reloads, a busy guard holds the button, and a
// print reply composes the document. 2.1.0: the row context line (buyer, post code, country, total with currency, items,
// badge; unknown fields as name: value), the country/badge quick filter, compact buttons whose reason is a tooltip (hover title,
// focus or tap), and no rows in browser storage. 2.2.0: each order its own shaded tbody with a divider, the order number links
// to links.order, the button text comes from the action label, confirm needs a second tap within 4 s, and a print re-reads the stages. Runs the tool file standalone with the TOOL_CONFIG the bench injects.
//   NODE_PATH=$(npm root -g) node test/pack-ship/page.js     (after node scripts/build.mjs)
const { chromium } = require("playwright");
const path = require("path");
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-pack-ship";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const st = (h, c, l, d, t) => [["health", h], ["collection", c], ["label", l], ["packed", "later"], ["dropped_off", d], ["tracking", t]].map(([key, state]) => ({ key, state, text: key + " " + state }));
const CTX = {
  "1111111-1": { country: "United Kingdom", order_total: 7.8, currency: "GBP", item_count: 2, customs_badge: "NI", buyer_username: "testbuyer1", buyer_postcode: "BT28 2RN" },
  "1111111-2": { country: "Italy", order_total: 30, currency: "EUR", item_count: 1, customs_badge: "international", buyer_username: "testbuyer2", buyer_postcode: "00184", gift_wrap: "yes" }
};
const READ = { status: "ok", outcome: "ok", data: { outcome: "ok", count: 3, truncated: false,
  row_context: { protocol: "ca.pack_row_context/2", fields: ["country", "order_total", "currency", "item_count", "customs_badge"], notes: [], overlay: ["buyer_username", "buyer_postcode"], overlay_notes: [] },
  stage_defs: [["health", "Order health"], ["collection", "Collection"], ["label", "Label"], ["packed", "Packed"], ["dropped_off", "Dropped off"], ["tracking", "Tracking"]].map(([key, label]) => ({ key, label })),
  states: { none: { icon: "orange" }, partial: { icon: "yellow" }, done: { icon: "green" }, later: { icon: "grey" } },
  last_sync: { orders: "2026-11-04T09:51:32.763Z" },
  orders: [
    { order_ref: "1111111-1", order_date: "2026-11-01", status: "In Progress", links: { order: "https://www.discogs.com/sell/order/1111111-1" }, context: CTX["1111111-1"], stages: st("done", "done", "done", "none", "done"),
      actions: [{ key: "label", cap: "print.queue.add", then: "label.bytes", enabled: true, reason: "booked: print packing list and label", inputs: ["copies"], state: "done" },
                { key: "message", cap: "discogs.orders.lifecycle", then: "discogs.orders.message.send", enabled: true, reason: "label_booked message due", inputs: ["custom_text"], state: "done" }] },
    { order_ref: "1111111-2", order_date: "2026-11-02", status: "Payment Received", context: CTX["1111111-2"], stages: st("partial", "partial", "partial", "none", "none"),
      actions: [{ key: "label", cap: "parcel2go.drafts.list", enabled: true, reason: "draft: open the checkout link", state: "partial" },
                { key: "message", cap: "discogs.orders.lifecycle", enabled: false, reason: "no buyer message due, or already logged", state: "none" }] },
    { order_ref: "1111111-3", order_date: "2026-11-03", status: "Shipped", stages: st("none", "later", "none", "none", "none"),
      actions: [{ key: "label", cap: "", enabled: false, reason: "shipped without a Parcel2Go line", state: "none" },
                { key: "shipped", cap: "print.queue.add", label: "Reprint", confirm: true, enabled: true, reason: "already printed: reprint the stored packing list with a fresh label", params: { order_ref: "1111111-3", reprint_of: "file:abcdefghij123" }, state: "done" }] }
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
    if (p.action === "shipped") return { status: "ok", outcome: "ok", steps: [{ cap: "print.queue.add", status: "ok", outcome: "ok", data: {} }] };
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
  const dots = await fr.$$eval('tr[data-id="1111111-1"] .dot', d => d.map(x => getComputedStyle(x).backgroundColor));
  ok("six icons per row", dots.length === 6);
  ok("icon colours from states (done green, none orange, later grey)", dots[0] === "rgb(46, 157, 72)" && dots[4] === "rgb(224, 123, 0)" && dots[3] === "rgb(163, 169, 174)");
  const ydot = await fr.$eval('tbody tr[data-id="1111111-2"] .dot', x => getComputedStyle(x).backgroundColor);
  ok("partial yellow", ydot === "rgb(232, 194, 28)");
  ok("stage text shown", (await fr.$eval("tbody tr:first-child .st .t", x => x.textContent)) === "health done");
  const dis = await fr.$eval('button[data-ref="1111111-3"][data-act="label"]', b => ({ d: b.disabled, title: b.parentElement.title, tip: b.parentElement.dataset.tip, aria: b.getAttribute("aria-label") }));
  ok("disabled action carries its reason as tooltip (title, data-tip, aria-label)", dis.d && [dis.title, dis.tip, dis.aria].every(t => t.includes("shipped without a Parcel2Go line")));
  ok("no reason lines on the page", (await fr.$$(".why")).length === 0);
  await f.locator('.ab:has(button[data-ref="1111111-3"][data-act="label"])').focus();
  const tipShown = await fr.$eval('.ab:has(button[data-ref="1111111-3"][data-act="label"])', e => getComputedStyle(e, "::after").content);
  ok("focus (tap or keyboard) shows the reason", tipShown.includes("shipped without a Parcel2Go line"));
  await f.locator('.ab:has(button[data-ref="1111111-3"][data-act="label"])').click(); await p.waitForTimeout(100);
  ok("tap on a disabled button focuses its tooltip", await fr.$eval('.ab:has(button[data-ref="1111111-3"][data-act="label"])', e => e === document.activeElement));
  ok("buttons of one order sit in one row", await fr.$eval('tr[data-id="1111111-2"] .acts', a => { const t = [...a.querySelectorAll(".ab")].map(x => x.getBoundingClientRect().top); return t.length === 2 && Math.abs(t[0] - t[1]) < 2; }));
  // row context line
  const cx1 = await fr.$eval('tr.cx[data-ctx="1111111-1"]', r => r.textContent);
  ok("context line: username, full post code, country, total with currency, items, badge", ["testbuyer1", "BT28 2RN", "United Kingdom", "£7.80", "2 items", "NI"].every(x => cx1.includes(x)));
  const cx2 = await fr.$eval('tr.cx[data-ctx="1111111-2"]', r => r.textContent);
  ok("currency formatted per row (EUR)", cx2.includes("€30.00") && cx2.includes("1 item") && !cx2.includes("1 items"));
  ok("unknown context field shown as name: value", cx2.includes("Gift wrap: yes"));
  ok("NI badge chip", await fr.$eval('tr.cx[data-ctx="1111111-1"] .chip', c => c.textContent === "NI" && c.classList.contains("c-NI")));
  ok("no context line when the order has none", (await fr.$$('tr.cx[data-ctx="1111111-3"]')).length === 0);
  // C1194 row filter: dimensions from the reply, chips and typed query in step, AND across keys, OR within
  const dimsSeen = await fr.$$eval("#chips .dim > b", b => b.map(x => x.getAttribute("title")));
  ok("filter dimensions: status, every stage with more than one state, category context fields (no buyer, no amounts), can", ["status", "health", "collection", "label", "tracking", "country", "currency", "item_count", "customs_badge", "can"].every(k => dimsSeen.includes(k)) && !dimsSeen.includes("buyer_username") && !dimsSeen.includes("order_total") && !dimsSeen.includes("dropped_off"));
  const rowsNow = async () => JSON.stringify(await fr.$$eval("tbody tr[data-id]", r => r.map(x => x.dataset.id)));
  await f.locator('#chips button[data-fk="country"][data-fv="Italy"]').click(); await p.waitForTimeout(100);
  ok("country chip narrows the list", (await rowsNow()) === JSON.stringify(["1111111-2"]));
  ok("chip writes the query", (await fr.$eval("#q", i => i.value)) === "country:Italy");
  ok("count shows n of m", (await fr.$eval("#count", c => c.textContent)).startsWith("1 of 3 orders"));
  await f.locator("#reload").click(); await p.waitForTimeout(500);
  ok("filter kept across Reload", (await rowsNow()) === JSON.stringify(["1111111-2"]));
  await f.locator('#chips button[data-fk="country"][data-fv="United Kingdom"]').click(); await p.waitForTimeout(100);
  ok("two values of one key: OR", (await rowsNow()) === JSON.stringify(["1111111-1", "1111111-2"]) && (await fr.$eval("#q", i => i.value)) === 'country:Italy,"United Kingdom"');
  await f.locator('#chips button[data-fk="label"][data-fv="done"]').click(); await p.waitForTimeout(100);
  ok("a second key: AND", (await rowsNow()) === JSON.stringify(["1111111-1"]));
  await f.locator("#qClear").click(); await p.waitForTimeout(100);
  ok("Clear restores the list", (await fr.$$("tbody tr[data-id]")).length === 3 && (await fr.$eval("#q", i => i.value)) === "");
  await f.locator('#chips button[data-fk="label"][data-fv="none"]').click({ button: "right" }); await p.waitForTimeout(100);
  ok("right-click excludes a value (key!:)", (await rowsNow()) === JSON.stringify(["1111111-1", "1111111-2"]) && (await fr.$eval("#q", i => i.value)) === "label!:none");
  await f.locator("#qClear").click();
  await f.locator("#q").fill("customs_badge:NI"); await p.waitForTimeout(350);
  ok("typed query filters", (await rowsNow()) === JSON.stringify(["1111111-1"]));
  ok("typed query lights its chip", await fr.$eval('#chips button[data-fk="customs_badge"][data-fv="NI"]', b => b.classList.contains("on")));
  await f.locator("#q").fill("1111111-3"); await p.waitForTimeout(350);
  ok("a word with no key matches the order number", (await rowsNow()) === JSON.stringify(["1111111-3"]));
  await f.locator("#q").fill("colour:red"); await p.waitForTimeout(350);
  ok("unknown key is named, not applied", (await fr.$eval("#count", c => c.textContent)).includes("unknown filter key colour") && (await fr.$$("tbody tr[data-id]")).length === 3);
  await f.locator("#q").fill(""); await f.locator("#q").type("pac"); await p.waitForTimeout(100);
  const sg1 = await fr.$$eval("#sugg li", l => l.map(x => x.firstChild.textContent));
  ok("autocomplete offers keys with is / is not", sg1.includes("packed:") && sg1.includes("packed!:"));
  await f.locator("#q").press("Tab"); await p.waitForTimeout(100);
  ok("Tab completes the key", (await fr.$eval("#q", i => i.value)) === "packed:");
  const sg2 = await fr.$$eval("#sugg li", l => l.map(x => x.textContent));
  ok("then offers the values present with counts", sg2.length === 1 && sg2[0].startsWith("packed:later") && sg2[0].includes("3 orders"));
  await f.locator("#q").press("Enter"); await p.waitForTimeout(350);
  ok("Enter takes the value and applies it", (await fr.$eval("#q", i => i.value)).trim() === "packed:later" && (await fr.$$("tbody tr[data-id]")).length === 3);
  await f.locator("#qClear").click(); await p.waitForTimeout(100);
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
  // 2.2.0: orders shaded apart, order link, std label, two-tap confirm
  const tb = await fr.$$eval("table tbody.o", b => b.map(x => [x.querySelector("tr").className.includes("sel"), getComputedStyle(x.querySelector("td")).backgroundColor]));
  ok("one tbody per order, alternate orders shaded", tb.length === 3 && !tb[1][0] && !tb[2][0] && tb[1][1] === "rgb(246, 244, 239)" && tb[2][1] === "rgba(0, 0, 0, 0)");
  ok("2px divider between orders", await fr.$eval("tbody.o:nth-of-type(2) tr:first-child td", td => getComputedStyle(td).borderTopWidth === "2px"));
  const lk = await fr.$eval('tr[data-id="1111111-1"] a.oref', a => ({ href: a.href, t: a.target, rel: a.rel, txt: a.textContent }));
  ok("order number links to the Discogs order in a new tab", lk.href === "https://www.discogs.com/sell/order/1111111-1" && lk.t === "_blank" && lk.rel.includes("noopener") && lk.txt === "1111111-1");
  ok("no link when the order has none", (await fr.$$('tr[data-id="1111111-3"] a.oref')).length === 0);
  const rb = 'button[data-ref="1111111-3"][data-act="shipped"]';
  ok("button text from the std label", (await fr.$eval(rb, b => b.textContent)).includes("Reprint"));
  const n1 = sent.length;
  await f.locator(rb).click(); await p.waitForTimeout(200);
  ok("first tap on a confirm action sends nothing and asks again", sent.length === n1 && (await fr.$eval(rb, b => b.textContent)) === "Tap again to reprint");
  await p.waitForTimeout(4300);
  ok("confirm disarms after 4 s", (await fr.$eval(rb, b => b.textContent)).includes("Reprint") && !(await fr.$eval(rb, b => b.textContent)).includes("Tap again"));
  await f.locator(rb).click(); await p.waitForTimeout(150); await f.locator(rb).click(); await p.waitForTimeout(500);
  const rp = sent.filter(b => b.op === "action" && b.params.action === "shipped");
  ok("second tap within 4 s runs the action once", rp.length === 1 && rp[0].params.order_ref === "1111111-3");
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
  ok("print re-reads the stages (printed mark shows)", sent.slice(sent.indexOf(pr)).some(b => b.op === "orders_stages"));
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
  // C1194 bulk: one action on every shown order where it is enabled, two taps, sequential, one print document
  await f.locator("#q").fill("can:label"); await p.waitForTimeout(350);
  ok("can:<action> filters orders where it is enabled", (await rowsNow()) === JSON.stringify(["1111111-1", "1111111-2"]));
  await f.locator("#bKey").selectOption("label"); await p.waitForTimeout(100);
  ok("bulk names the count of shown orders it can run on", (await fr.$eval("#bRun", b => b.textContent)) === "Run on 2 shown");
  const nb = sent.filter(b => b.op === "action").length;
  await f.locator("#bRun").click(); await p.waitForTimeout(150);
  ok("first tap only asks, with the count", (await fr.$eval("#bRun", b => b.textContent)) === "Tap again: Label 2 orders" && sent.filter(b => b.op === "action").length === nb);
  await f.locator("#bRun").click(); await p.waitForTimeout(2500);
  const bl = sent.filter(b => b.op === "action").slice(nb);
  ok("second tap runs the action once per shown order, in order", bl.length === 2 && bl[0].params.order_ref === "1111111-1" && bl[1].params.order_ref === "1111111-2" && bl.every(b => b.params.action === "label"));
  const res = await fr.$$eval("#bulk .res div", d => d.map(x => x.className + " " + x.textContent));
  ok("per-order results shown", res.length === 2 && res[0].startsWith("ok 1111111-1 · printed") && res[1].startsWith("ok 1111111-2 · parcel2go.drafts.list ok"));
  const bdoc = await fr.$eval("#doc", d => d.srcdoc);
  ok("printed orders gathered in one document", (bdoc.match(/PACKING SLIP/g) || []).length === 1 && bdoc.includes("1111111-1"));
  ok("stages re-read after the run", sent.slice(-3).some(b => b.op === "orders_stages"));
  await f.locator("#qClear").click(); await p.waitForTimeout(100);
  ok("only page ops sent", sent.every(b => ["orders_stages", "run_status", "refresh", "action"].includes(b.op)));
  const store = await p.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, idb: indexedDB.databases ? (await indexedDB.databases()).length : 0, caches: (self.caches ? (await caches.keys()).length : 0) }));
  ok("no rows in localStorage, sessionStorage, IndexedDB or Cache API", store.ls === 0 && store.ss === 0 && store.idb === 0 && store.caches === 0);
  const src = require("fs").readFileSync(path.resolve(__dirname, "../../tools/pack-ship.html"), "utf8");
  ok("tool file uses no browser storage API", !/localStorage|sessionStorage|indexedDB|caches\.open/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")));
  ok("no page errors", errs.length === 0); if (errs.length) console.log(errs);
  await p.screenshot({ path: path.join(__dirname, "page.png") });
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, "page-390.png") });
  await browser.close();
  const failed = checks.filter(c => !c[1]).length;
  console.log(`${checks.length - failed}/${checks.length} checks`); process.exit(failed ? 1 : 0);
})();
