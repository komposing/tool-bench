// Read Plan (C1528, ca.pack_tabs/1): which sheet tabs and run keys the asked view needs, from std pack_tabs alone.
// Sources are followed tab -> panels -> metrics -> source (and lookup fields); sheet and tab are $ref paths into the
// loaded standards. A credential slot maps to one pre-wired read node (I5). Validation and every figure are Eval's job.
const S = (v) => (v === null || v === undefined) ? '' : String(v);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const SLOTS = { discogs_orders: 'D', parcels: 'P' };
const req = $('Pack Views Call').first().json;
const stds = {};
$('Load Tabs Std').all().concat($('Load Refs').all()).forEach((it) => { const r = it.json || {}; if (S(r.standards_name)) { try { stds[S(r.standards_name)] = JSON.parse(S(r.standards_guide)); } catch (e) { stds[S(r.standards_name)] = null; } } });
const T = stds.pack_tabs, op = S(req.op).toLowerCase();
const out = { any: false, op, need: { D: false, P: false }, urls: { D: '', P: '' }, slots: {}, run_keys: [], runs_from: '', errs: [] };
if (!isObj(T)) { out.errs.push('std pack_tabs not readable'); return [{ json: out }]; }
const tab = (Array.isArray(T.tabs) ? T.tabs : []).find((t) => isObj(t) && S(t.op) === op && S(t.kind) !== 'orders');
if (op === 'tabs' || !tab) { return [{ json: out }]; }
const getPath = (o, p) => S(p).split('.').reduce((a, k) => (a !== null && a !== undefined && typeof a === 'object') ? a[k] : undefined, o);
const ref = (v) => { if (isObj(v) && typeof v.$ref === 'string') { const i = v.$ref.indexOf(':'); return getPath(stds[v.$ref.slice(0, i)], v.$ref.slice(i + 1)); } return v; };
const SRC = isObj(T.sources) ? T.sources : {}, MET = isObj(T.metrics) ? T.metrics : {}, PAN = isObj(T.panels) ? T.panels : {}, need = {};
const add = (nm) => { if (need[nm] || !isObj(SRC[nm])) { return; } need[nm] = true; (Array.isArray(SRC[nm].fields) ? SRC[nm].fields : []).forEach((f) => { if (isObj(f) && f.fn === 'lookup') { add(S(f.source)); } }); };
(Array.isArray(tab.panels) ? tab.panels : []).forEach((pk) => { const pn = PAN[pk]; if (!isObj(pn) || (S(pn.state) && pn.state !== 'ok')) { return; } if (S(pn.source)) { add(S(pn.source)); }
  (Array.isArray(pn.metrics) ? pn.metrics : []).concat((Array.isArray(pn.tiles) ? pn.tiles : []).map((t) => isObj(t) ? t.metric : '')).forEach((mk) => { if (isObj(MET[mk])) { add(S(MET[mk].source)); } }); });
let maxDays = 0; const keys = {};
Object.keys(need).forEach((nm) => { const s = SRC[nm];
  if (s.kind === 'runs') { (Array.isArray(s.keys) ? s.keys : []).forEach((k) => { keys[S(k)] = true; }); maxDays = Math.max(maxDays, Number(s.max_days || 60)); return; }
  const slot = S(s.slot), sheet = S(ref(s.sheet)), tabName = S(ref(s.tab));
  if (!SLOTS[slot]) { out.errs.push('source ' + nm + ': credential slot ' + slot + ' has no read node'); return; }
  if (!sheet || !tabName) { out.errs.push('source ' + nm + ': sheet or tab did not resolve'); return; }
  const sl = out.slots[slot] || (out.slots[slot] = { sheet, tabs: [] });
  if (sl.sheet !== sheet) { out.errs.push('source ' + nm + ': slot ' + slot + ' already reads another spreadsheet'); return; }
  if (sl.tabs.indexOf(tabName) === -1) { sl.tabs.push(tabName); } });
const qt = (t) => encodeURIComponent("'" + S(t).replace(/'/g, "''") + "'");
Object.keys(out.slots).forEach((slot) => { const k = SLOTS[slot], sl = out.slots[slot]; out.need[k] = true;
  out.urls[k] = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sl.sheet) + '/values:batchGet?' + sl.tabs.map((t) => 'ranges=' + qt(t)).join('&') + '&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER'; });
out.run_keys = Object.keys(keys); if (out.run_keys.length) { out.runs_from = new Date(Date.now() - maxDays * 86400000).toISOString(); }
out.any = !out.errs.length && (out.need.D || out.need.P || out.run_keys.length > 0);
return [{ json: out }];
