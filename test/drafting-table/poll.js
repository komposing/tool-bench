// Poll budget acceptance (C944, T536): std drafting reach.page.poll on the page, under a fake clock.
// Proves: 2 s for ~30 s after open, a local change or a remote change; idle backoff 10 s, 30 s, 60 s;
// no replay while hidden and one at once on return; one replay in flight even when the reply is held
// (long-poll shape, C903-s3) while local edits still go out; the open reply's reach_page_poll wins over
// the built-in defaults; poll_ms replaces active_ms only.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const URL = "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting";
const TOOL = "file://" + path.resolve(__dirname, "../../tools/drafting-table.html");
const OUT = path.join(__dirname, "evidence");
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };
const gaps = ts => ts.slice(1).map((t, i) => Math.round((t - ts[i]) / 100) / 10);

async function rig(browser, { conf = {}, openExtra = null } = {}){
  const mock = require("./mock.js")(path.join(__dirname, "seed.json"));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(c => {
    window.TOOL_CONFIG = { drafting: Object.assign({ url: "https://komposing.app.n8n.cloud/webhook/ca-v3-drafting", headers: { "X-Api-Key": "test-key" }, debounce_ms: 300, draft_id: "dmvx0i3t3686r" }, c) };
    let vis = "visible";
    Object.defineProperty(document, "visibilityState", { get: () => vis, configurable: true });
    Object.defineProperty(document, "hidden", { get: () => vis === "hidden", configurable: true });
    window.__setVis = v => { vis = v; document.dispatchEvent(new Event("visibilitychange")); };
  }, conf);
  const st = { replays: [], inflight: 0, maxInflight: 0, hold: false, held: [], applies: 0 };
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-11-02T18:00:00Z") });
  await ctx.route(URL, async route => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() || "{}");
    if (body.op === "replay" && body.since_seq > 0) {
      st.replays.push(await page.evaluate(() => Date.now()));
      st.inflight++; st.maxInflight = Math.max(st.maxInflight, st.inflight);
      if (st.hold) await new Promise(res => st.held.push(res));
      st.inflight--;
    }
    if (body.op === "apply") st.applies++;
    const r = mock.handle(body, req.headers()["x-api-key"]);
    if (body.op === "open" && openExtra) Object.assign(r.json, openExtra);
    await route.fulfill({ status: r.status || 200, headers: CORS, body: JSON.stringify(r.json) });
  });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(TOOL);
  await page.clock.runFor(500);
  await page.waitForFunction(() => window.DT && DT.SEQ >= 7);
  const t0 = await page.evaluate(() => Date.now());
  return { ctx, page, mock, st, errs, t0, run: async ms => { for (let i = 0; i < ms; i += 250) { await page.clock.runFor(250); } } };
}

(async () => {
  const browser = await chromium.launch();

  // 1-4: defaults, active window, idle backoff, remote and local changes
  {
    const R = await rig(browser);
    const pol = await R.page.evaluate(() => [DT.POLL, DT.POLL_FROM]);
    check("built-in defaults equal std drafting v2", JSON.stringify(pol[0].idle_ms) === "[10000,30000,60000]" && pol[0].active_ms === 2000 && pol[0].active_window_ms === 30000 && pol[0].hidden === "pause", JSON.stringify(pol));
    await R.run(30000);
    const active = R.st.replays.filter(t => t - R.t0 <= 30000);
    const ag = gaps(active);
    check("2 s polling for ~30 s after open", active.length >= 10 && ag.every(g => g >= 1.9 && g <= 3.0), active.length + " replays, gaps " + ag.join(","));
    const n0 = R.st.replays.length;
    await R.run(10000 + 30000 + 60000 + 60000 + 5000);
    const ig = gaps(R.st.replays.slice(n0 - 1)).filter(g => g > 5);
    check("idle backoff 10 s → 30 s → 60 s → 60 s", ig.length >= 4 && Math.abs(ig[0] - 10) < 1.2 && Math.abs(ig[1] - 30) < 1.2 && Math.abs(ig[2] - 60) < 1.2 && Math.abs(ig[3] - 60) < 1.2, "gaps " + ig.join(","));
    // remote change while idle: picked up on the next idle poll, then back to 2 s
    R.mock.agentApply("dmvx0i3t3686r", [{ op: "note.set", payload: { id: "nt_poll", text: "remote" } }]);
    const n1 = R.st.replays.length;
    await R.run(62000);
    await R.run(8000);
    const after = R.st.replays.slice(n1); const rg = gaps(after);
    const seen = await R.page.evaluate(() => !!DT.S.notes.nt_poll);
    check("remote change returns the page to 2 s", seen && after.length >= 4 && rg.slice(0, 3).every(g => g >= 1.9 && g <= 3.0), "seen " + seen + ", gaps " + rg.join(","));
    // let it go idle, then a local edit
    await R.run(30000 + 10000 + 30000 + 5000);
    const n2 = R.st.replays.length;
    await R.page.evaluate(() => DT.emit({ op: "note.set", payload: { id: "nt_local", text: "local" } }));
    await R.run(9000);
    const la = R.st.replays.slice(n2); const lg = gaps(la);
    check("local change returns the page to 2 s", R.st.applies >= 1 && la.length >= 3 && lg.every(g => g >= 1.9 && g <= 3.0), la.length + " replays in 9 s, gaps " + lg.join(","));
    // 5: hidden pause
    await R.page.evaluate(() => __setVis("hidden"));
    const n3 = R.st.replays.length;
    await R.run(180000);
    check("no replay while hidden (3 min)", R.st.replays.length === n3, (R.st.replays.length - n3) + " replays");
    await R.page.evaluate(() => __setVis("visible"));
    await R.run(500);
    check("replay at once on return to view", R.st.replays.length === n3 + 1, (R.st.replays.length - n3) + " replay(s) within 0.5 s");
    check("no page errors (defaults rig)", R.errs.length === 0, R.errs.join(" | "));
    await R.page.screenshot({ path: path.join(OUT, "07-poll-budget.png") });
    await R.ctx.close();
  }

  // 6: single replay in flight while the reply is held (long-poll shape); local edits still go out
  {
    const R = await rig(browser);
    R.st.hold = true;
    await R.run(2500);
    const a0 = R.st.applies;
    await R.page.evaluate(() => DT.emit({ op: "note.set", payload: { id: "nt_lp", text: "during long-poll" } }));
    await R.run(25000);
    const one = R.st.inflight === 1 && R.st.maxInflight === 1 && R.st.replays.length === 1;
    check("one replay in flight while the reply is held 25 s", one, `in flight ${R.st.inflight}, max ${R.st.maxInflight}, sent ${R.st.replays.length}`);
    check("local edit applied while replay is held", R.st.applies === a0 + 1, (R.st.applies - a0) + " apply call(s)");
    R.st.hold = false; R.st.held.splice(0).forEach(f => f());
    await R.run(300);
    const tRel = await R.page.evaluate(() => Date.now());
    await R.run(2600);
    const next = R.st.replays.filter(t => t > tRel - 300);
    check("next replay only after the reply, one active interval later", next.length === 1 && next[0] - tRel >= 1500, next.map(t => t - tRel).join(","));
    const dup = await R.page.evaluate(() => DT.LOG.filter(e => e.payload && e.payload.id === "nt_lp").length);
    check("own op not doubled when replay and apply overlap", dup === 1, dup + " log entries");
    check("no page errors (long-poll rig)", R.errs.length === 0, R.errs.join(" | "));
    await R.ctx.close();
  }

  // 7: the engine's open reply wins over the defaults (relay from std drafting, C903-s3)
  {
    const R = await rig(browser, { openExtra: { reach_page_poll: { active_ms: 3000, active_window_ms: 9000, idle_ms: [5000, 20000], hidden: "pause" } } });
    const from = await R.page.evaluate(() => DT.POLL_FROM);
    await R.run(9000 + 5000 + 20000 + 20000 + 500);
    const g = gaps(R.st.replays);
    check("open reply reach_page_poll drives the schedule", /open reply/.test(from) && g[0] >= 2.9 && g[0] <= 4 && g.length >= 4 && Math.abs(g[g.length - 3] - 5) < 1.2 && Math.abs(g[g.length - 2] - 20) < 1.2 && Math.abs(g[g.length - 1] - 20) < 1.2, from + "; gaps " + g.join(","));
    await R.ctx.close();
  }

  // 8: poll_ms replaces active_ms only
  {
    const R = await rig(browser, { conf: { poll_ms: 4000 } });
    const p = await R.page.evaluate(() => DT.POLL);
    check("poll_ms overrides active_ms only", p.active_ms === 4000 && p.active_window_ms === 30000 && JSON.stringify(p.idle_ms) === "[10000,30000,60000]", JSON.stringify(p));
    await R.ctx.close();
  }

  fs.writeFileSync(path.join(OUT, "poll-results.json"), JSON.stringify(results, null, 1));
  console.log(`${results.filter(r => r.ok).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(r => r.ok) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
