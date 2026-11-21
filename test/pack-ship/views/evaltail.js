
// ---- Eval (C1528): gather what was read, evaluate the asked view, return one reply (buyer-free; no execution data kept) ----
const PV = packViews();
const req = Object.assign({}, $('Pack Views Call').first().json);
const stds = {};
$('Load Tabs Std').all().concat($('Load Refs').all()).forEach((it) => { const r = it.json || {}; if (r.standards_name) { try { stds[String(r.standards_name)] = JSON.parse(String(r.standards_guide)); } catch (e) { stds[String(r.standards_name)] = null; } } });
const rp = $('Read Plan').first().json || {};
const done = (r) => [{ json: { status: r.status, outcome: r.outcome, message: r.message, response: r.message, item_count: r.item_count, data: r.data, op: String(req.op || ''), protocol: 'ca.pack_tabs/1' } }];
if (Array.isArray(rp.errs) && rp.errs.length) { return done({ status: 'error', outcome: 'config_invalid', message: rp.errs.slice(0, 5).join('; '), data: {}, item_count: 0 }); }
const raw = { tabs: {}, runs: [], runs_from: String(rp.runs_from || '') };
const NODE = { discogs_orders: 'Read Sheet D', parcels: 'Read Sheet P' };
Object.keys(rp.slots || {}).forEach((slot) => { let res = null; try { if ($(NODE[slot]).isExecuted) { res = $(NODE[slot]).first().json; } } catch (e) { res = null; }
  const vr = res && Array.isArray(res.valueRanges) ? res.valueRanges : [];
  (rp.slots[slot].tabs || []).forEach((t, i) => { if (vr[i] && Array.isArray(vr[i].values)) { raw.tabs[slot + '|' + t] = vr[i].values; } }); });
try { if ($('Read Runs').isExecuted) { raw.runs = $('Read Runs').all().map((it) => it.json || {}).filter((r) => r.registry_key); } } catch (e) { raw.runs = []; }
let reply; try { reply = PV.evaluate(req, stds, raw); } catch (e) { reply = { status: 'error', outcome: 'target_error', message: String(e && e.message).slice(0, 300), data: {}, item_count: 0 }; }
return done(reply);
