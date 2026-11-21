// CA_V3 Pack Views engine library (ca.pack_tabs/1, C1528). Pure functions: no I/O, no clock unless passed in.
// plan(req, stds)            -> {ok, op, params, reads} or {ok:false, outcome, message}
// evaluate(req, stds, raw)   -> {outcome, status, message, data, item_count}
// Everything a view shows is declared in std pack_tabs: tabs, controls, panels, metrics, sources and computed fields.
function packViews(){
  const S = (v) => (v === null || v === undefined) ? '' : String(v);
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const filled = (v) => v !== null && v !== undefined && S(v).trim() !== '';
  const num = (v) => { if (typeof v === 'number') { return Number.isFinite(v) ? v : null; } if (!filled(v)) { return null; } const n = Number(S(v).replace(/[£$€,\s]/g, '')); return Number.isFinite(n) ? n : null; };
  const DAY = 86400000;
  // A sheet cell may be an ISO string, a date-only string, a Sheets serial number (UNFORMATTED_VALUE) or /Date(ms)/.
  const toMs = (v) => {
    if (v === null || v === undefined || v === '') { return null; }
    if (typeof v === 'number') { return (v > 20000 && v < 90000) ? Math.round((v - 25569) * DAY) : (v > 1e11 ? v : null); }
    const s = S(v).trim(); let m = /^\/Date\((-?\d+)/.exec(s); if (m) { return Number(m[1]); }
    if (/^\d{5}(\.\d+)?$/.test(s)) { return Math.round((Number(s) - 25569) * DAY); }
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m) { return Date.UTC(+m[1], +m[2] - 1, +m[3]); }
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s); if (m) { return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)); }
    const iso = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s.replace(' ', 'T') + 'Z' : s;
    const t = Date.parse(iso); return Number.isFinite(t) ? t : null;
  };
  const dISO = (ms) => new Date(ms).toISOString().slice(0, 10);
  const getPath = (o, p) => S(p).split('.').reduce((a, k) => (a !== null && a !== undefined && typeof a === 'object') ? a[k] : undefined, o);
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const wild = (pat, v) => { const p = S(pat), s = S(v); return p.endsWith('*') ? s.toLowerCase().startsWith(p.slice(0, -1).toLowerCase()) : s.toLowerCase() === p.toLowerCase(); };

  // {$ref:"std:path"} -> the value; {$keys:"std:path", where:{k:v}} -> keys of an object whose entries match.
  const resolve = (v, stds, errs) => {
    if (Array.isArray(v)) { return v.map((x) => resolve(x, stds, errs)); }
    if (!isObj(v)) { return v; }
    const refOf = (r) => { const i = S(r).indexOf(':'); const nm = S(r).slice(0, i), pth = S(r).slice(i + 1); if (!isObj(stds[nm])) { errs.push('std ' + nm + ' not loaded (list it in uses)'); return undefined; } const out = pth ? getPath(stds[nm], pth) : stds[nm]; if (out === undefined) { errs.push('ref ' + r + ' not found'); } return out; };
    if (typeof v.$ref === 'string') { return refOf(v.$ref); }
    if (typeof v.$keys === 'string') { const o = refOf(v.$keys); if (!isObj(o)) { return []; } const w = isObj(v.where) ? v.where : {}; return Object.keys(o).filter((k) => Object.keys(w).every((f) => S((o[k] || {})[f]) === S(w[f]))); }
    const out = {}; Object.keys(v).forEach((k) => { out[k] = resolve(v[k], stds, errs); }); return out;
  };

  // a where list may name shared filters: a string entry is replaced by T.filters[name]
  const expand = (v, F, errs) => {
    if (Array.isArray(v)) { return v.map((x) => expand(x, F, errs)); }
    if (!isObj(v)) { return v; }
    const out = {}; Object.keys(v).forEach((k) => { const x = v[k];
      if ((k === 'where' || k === 'keep_where') && Array.isArray(x)) { let list = []; x.forEach((c) => { if (typeof c === 'string') { if (!Array.isArray(F[c])) { errs.push('filter ' + c + ' not declared'); } else { list = list.concat(F[c]); } } else { list.push(c); } }); out[k] = list; }
      else { out[k] = expand(x, F, errs); } });
    return out;
  };
  const prep = (v, T, stds, errs) => expand(resolve(v, stds, errs), resolve(isObj(T.filters) ? T.filters : {}, stds, errs), errs);
  const cond = (row, c, ctx) => {
    const v = row[c.col], op = S(c.op || 'eq'), val = c.value;
    if (op === 'filled') { return filled(v); }
    if (op === 'blank') { return !filled(v); }
    if (op === 'eq') { return S(v) === S(val); }
    if (op === 'ne') { return S(v) !== S(val); }
    if (op === 'in') { return (Array.isArray(val) ? val : []).some((x) => S(x) === S(v)); }
    if (op === 'nin') { return !(Array.isArray(val) ? val : []).some((x) => S(x) === S(v)); }
    if (op === 'prefix') { return S(v).toLowerCase().startsWith(S(val).toLowerCase()); }
    if (op === 'like_any') { return (Array.isArray(val) ? val : []).some((p) => wild(p, v)); }
    if (op === 'not_like_any') { return !(Array.isArray(val) ? val : []).some((p) => wild(p, v)); }
    if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') { const a = num(v), b = num(val); if (a === null || b === null) { return false; } return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b; }
    ctx.errs.push('where op ' + op + ' unknown'); return false;
  };
  const passAll = (row, where, ctx) => (Array.isArray(where) ? where : []).every((c) => cond(row, c, ctx));

  const FORBID = ['buyer', 'recipient', 'email', 'phone', 'address', 'postcode', 'delivery_', 'paypal', 'contact', 'username'];
  const forbidden = (col, extra) => FORBID.concat(Array.isArray(extra) ? extra : []).some((f) => S(col).toLowerCase().indexOf(S(f).toLowerCase()) !== -1);

  const today = (req) => { const t = toMs(req && req._now) || Date.now(); return Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate()); };
  const bucketStart = (ms, b) => { const d = new Date(ms); if (b === 'month') { return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); } const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); if (b === 'week') { return day - ((d.getUTCDay() + 6) % 7) * DAY; } return day; };
  const bucketNext = (ms, b) => { if (b === 'month') { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); } return ms + (b === 'week' ? 7 : 1) * DAY; };

  // ---------- request ----------
  const readReq = (req, stds) => {
    const T = stds.pack_tabs, errs = [];
    if (!isObj(T) || S(T.protocol) !== 'ca.pack_tabs/1') { return { ok: false, outcome: 'config_missing', message: 'std pack_tabs (ca.pack_tabs/1) not readable' }; }
    const op = S(req.op).toLowerCase();
    const R = isObj(T.ranges) ? T.ranges : {};
    if (op === 'tabs') { return { ok: true, op, T, params: {}, tab: null }; }
    const tab = (Array.isArray(T.tabs) ? T.tabs : []).find((t) => isObj(t) && S(t.op) === op && S(t.kind) !== 'orders');
    if (!tab) { return { ok: false, outcome: 'param_rejected', message: 'op ' + op + ' is not a view declared in std pack_tabs tabs' }; }
    const now = today(req), p = {};
    const mode = S(tab.range || 'days');
    if (mode === 'days') {
      const allowed = Array.isArray(R.allowed) ? R.allowed.map(Number) : [90];
      const rd = filled(req.range_days) ? Number(req.range_days) : Number(R.default_days || 90);
      if (allowed.indexOf(rd) === -1) { errs.push('range_days must be one of ' + allowed.join(', ')); }
      const buckets = Array.isArray(R.buckets) ? R.buckets : ['week'];
      const b = filled(req.bucket) ? S(req.bucket) : S(R.default_bucket || 'week');
      if (buckets.indexOf(b) === -1) { errs.push('bucket must be one of ' + buckets.join(', ')); }
      const dayMax = Number(R.day_bucket_max_days || 92);
      p.range_days = rd; p.bucket = (b === 'day' && rd > dayMax) ? 'week' : b; if (p.bucket !== b) { p.bucket_note = 'daily buckets apply up to ' + dayMax + ' days; shown weekly'; }
      p.to = now; p.from = now - (rd - 1) * DAY;
    } else {
      const dflt = Number(R.period_default_days || 90), maxd = Number(R.period_max_days || 1100);
      const re = /^\d{4}-\d{2}-\d{2}$/;
      if (filled(req.from) && !re.test(S(req.from))) { errs.push('from must be YYYY-MM-DD'); }
      if (filled(req.to) && !re.test(S(req.to))) { errs.push('to must be YYYY-MM-DD'); }
      p.to = filled(req.to) && re.test(S(req.to)) ? toMs(req.to) : now; p.from = filled(req.from) && re.test(S(req.from)) ? toMs(req.from) : p.to - (dflt - 1) * DAY;
      if (p.from > p.to) { errs.push('from is after to'); }
      if ((p.to - p.from) / DAY > maxd) { errs.push('period is longer than ' + maxd + ' days'); }
      p.bucket = 'month';
    }
    (Array.isArray(tab.controls) ? tab.controls : []).forEach((c) => { if (isObj(c) && c.kind === 'toggle') { const v = req[c.key]; p[c.key] = v === true || S(v).toLowerCase() === 'true' || S(v) === '1' || S(v).toLowerCase() === 'yes'; } });
    if (errs.length) { return { ok: false, outcome: 'param_rejected', message: errs.join('; ') }; }
    const rerr = [], TR = Object.assign({}, T, { metrics: prep(isObj(T.metrics) ? T.metrics : {}, T, stds, rerr), panels: prep(isObj(T.panels) ? T.panels : {}, T, stds, rerr) });
    return { ok: true, op, T: TR, params: p, tab, ref_errs: rerr };
  };

  const panelMetrics = (T, pn) => {
    const keys = [];
    (Array.isArray(pn.metrics) ? pn.metrics : []).forEach((k) => keys.push(S(k)));
    (Array.isArray(pn.tiles) ? pn.tiles : []).forEach((t) => { if (isObj(t) && filled(t.metric)) { keys.push(S(t.metric)); } });
    return keys;
  };
  const sourcesFor = (T, tab, errs) => {
    const need = {}, SRC = isObj(T.sources) ? T.sources : {}, MET = isObj(T.metrics) ? T.metrics : {}, PAN = isObj(T.panels) ? T.panels : {};
    const add = (nm) => { if (need[nm]) { return; } const s = SRC[nm]; if (!isObj(s)) { errs.push('source ' + nm + ' not declared'); return; } need[nm] = true; (Array.isArray(s.fields) ? s.fields : []).forEach((f) => { if (isObj(f) && f.fn === 'lookup' && filled(f.source)) { add(S(f.source)); } }); };
    (Array.isArray(tab.panels) ? tab.panels : []).forEach((pk) => { const pn = PAN[pk]; if (!isObj(pn)) { errs.push('panel ' + pk + ' not declared'); return; } if (filled(pn.state) && pn.state !== 'ok') { return; } if (filled(pn.source)) { add(S(pn.source)); } panelMetrics(T, pn).forEach((mk) => { const m = MET[mk]; if (!isObj(m)) { errs.push('metric ' + mk + ' not declared'); return; } add(S(m.source)); }); });
    return Object.keys(need);
  };

  const plan = (req, stds) => {
    const q = readReq(req, stds); if (!q.ok) { return q; }
    if (q.op === 'tabs') { return { ok: true, op: 'tabs', params: {}, reads: { any: false, sheets: {}, runs: { keys: [], from: '' } } }; }
    const errs = q.ref_errs.slice(), T = q.T, names = sourcesFor(T, q.tab, errs), SRCr = prep(isObj(T.sources) ? T.sources : {}, T, stds, errs);
    const sheets = {}, runKeys = {}; let runsFrom = null;
    const extra = getPath(T, 'privacy.forbid_like');
    names.forEach((nm) => {
      const s = SRCr[nm]; if (!isObj(s)) { return; }
      (Array.isArray(s.columns) ? s.columns : []).forEach((c) => { if (forbidden(c, extra)) { errs.push('source ' + nm + ': column ' + c + ' looks like buyer data and is refused'); } });
      if (s.kind === 'runs') { (Array.isArray(s.keys) ? s.keys : []).forEach((k) => { runKeys[S(k)] = true; }); const md = Number(s.max_days || 60); const f = Math.max(q.params.from, q.params.to - (md - 1) * DAY); runsFrom = runsFrom === null ? f : Math.min(runsFrom, f); return; }
      if (!filled(s.slot) || !filled(s.sheet) || !filled(s.tab)) { errs.push('source ' + nm + ': slot, sheet and tab are required'); return; }
      const sl = sheets[S(s.slot)] || (sheets[S(s.slot)] = { sheet: S(s.sheet), tabs: [] });
      if (sl.sheet !== S(s.sheet)) { errs.push('source ' + nm + ': slot ' + s.slot + ' already reads another spreadsheet'); return; }
      if (sl.tabs.indexOf(S(s.tab)) === -1) { sl.tabs.push(S(s.tab)); }
    });
    if (errs.length) { return { ok: false, outcome: 'config_invalid', message: errs.slice(0, 6).join('; ') }; }
    return { ok: true, op: q.op, params: { from: dISO(q.params.from), to: dISO(q.params.to), bucket: q.params.bucket }, reads: { any: true, sheets, runs: { keys: Object.keys(runKeys), from: runsFrom === null ? '' : new Date(runsFrom).toISOString() } } };
  };

  // ---------- sources ----------
  const buildSources = (T, stds, raw, names, errs) => {
    const SRCr = prep(isObj(T.sources) ? T.sources : {}, T, stds, errs), out = {};
    const base = (nm) => {
      const s = SRCr[nm], cols = Array.isArray(s.columns) ? s.columns.map(S) : [];
      if (s.kind === 'runs') { const ks = (Array.isArray(s.keys) ? s.keys : []).map(S); const rows = (Array.isArray(raw.runs) ? raw.runs : []).filter(isObj).filter((r) => !ks.length || ks.indexOf(S(r.registry_key)) !== -1).map((r) => { const o = {}; cols.forEach((c) => { o[c] = r[c]; }); return o; }); return { rows, missing: [], def: s }; }
      const vals = (isObj(raw.tabs) ? raw.tabs : {})[S(s.slot) + '|' + S(s.tab)];
      if (!Array.isArray(vals) || !vals.length) { return { rows: [], missing: cols, def: s, unread: true }; }
      const head = (vals[0] || []).map((h) => S(h).trim()), idx = {}, missing = [];
      cols.forEach((c) => { const i = head.indexOf(c); if (i === -1) { missing.push(c); } else { idx[c] = i; } });
      const rows = []; for (let r = 1; r < vals.length; r++) { const a = vals[r] || [], o = {}; let any = false; cols.forEach((c) => { if (c in idx) { const v = a[idx[c]]; o[c] = v === undefined ? '' : v; if (filled(v)) { any = true; } } }); if (any) { rows.push(o); } }
      return { rows, missing, def: s };
    };
    names.forEach((nm) => { if (isObj(SRCr[nm])) { out[nm] = base(nm); } });
    // computed fields, in declared order; a lookup reads another source's base or computed rows (declare lookups after what they read)
    const done = {};
    const compute = (nm, depth) => {
      if (done[nm] || !out[nm]) { return; } done[nm] = true;
      const src = out[nm], F = Array.isArray(src.def.fields) ? src.def.fields.filter(isObj) : [], ctx = { errs };
      F.forEach((f) => {
        const a = Array.isArray(f.args) ? f.args : [];
        if (f.fn === 'lookup') {
          const other = S(f.source); if (depth > 4) { errs.push('lookup chain too deep at ' + nm + '.' + f.name); return; } compute(other, depth + 1);
          const o = out[other]; const ix = {};
          if (o) { o.rows.forEach((r) => { if (!passAll(r, f.where, ctx)) { return; } const k = S(r[f.their_key]); if (!filled(k)) { return; } (ix[k] || (ix[k] = [])).push(r[f.col]); }); }
          src.rows.forEach((r) => { const list = ix[S(r[f.my_key])] || []; const agg = S(f.agg || 'first'); let v = null;
            if (agg === 'sum') { const ns = list.map(num).filter((x) => x !== null); v = ns.length ? ns.reduce((p, c) => p + c, 0) : null; }
            else if (agg === 'count') { v = list.length; }
            else if (agg === 'min_time' || agg === 'max_time') { const ts = list.map(toMs).filter((x) => x !== null); v = ts.length ? (agg === 'min_time' ? Math.min.apply(null, ts) : Math.max.apply(null, ts)) : null; }
            else { const fl = list.filter(filled); v = fl.length ? fl[0] : null; }
            r[f.name] = v; });
          return;
        }
        src.rows.forEach((r) => {
          let v = null;
          if (f.fn === 'sub') { const x = num(r[a[0]]), y = num(r[a[1]]); v = (x === null || y === null) ? null : round2(x - y); }
          else if (f.fn === 'scale') { const x = num(r[a[0]]); v = x === null ? null : x * Number(a[1]); }
          else if (f.fn === 'diff_days') { const x = toMs(r[a[0]]), y = toMs(r[a[1]]); v = (x === null || y === null || y < x) ? null : Math.round(((y - x) / DAY) * 100) / 100; }
          else if (f.fn === 'coalesce') { for (let i = 0; i < a.length; i++) { if (filled(r[a[i]])) { v = r[a[i]]; break; } } }
          else if (f.fn === 'json_get') { try { const o = typeof r[a[0]] === 'string' ? JSON.parse(r[a[0]]) : r[a[0]]; let c = o; S(a[1]).split('.').forEach((k) => { c = isObj(c) ? c[k] : undefined; }); v = isObj(o) && filled(c) && !isObj(c) ? c : null; } catch (e) { v = null; } }
          else if (f.fn === 'filled') { v = filled(r[a[0]]); }
          else if (f.fn === 'before') { v = S(r[a[0]]).split(S(a[1]))[0]; }
          else if (f.fn === 'match') { let m = null; try { m = new RegExp(S(f.pattern)).exec(S(r[a[0]])); } catch (e) { m = null; } v = m ? S(m[Number(f.group || 1)] || '') : ''; }
          else if (f.fn === 'when') { v = passAll(r, f.where, ctx) ? r[a[0]] : null; }
          else { errs.push('field fn ' + f.fn + ' unknown at ' + nm + '.' + f.name); }
          r[f.name] = v;
        });
      });
    };
    Object.keys(out).forEach((nm) => compute(nm, 0));
    // source-level row rules, after computed fields: where keeps matching rows; latest_by keeps one row per key (greatest order value)
    Object.keys(out).forEach((nm) => {
      const src = out[nm], d = src.def;
      if (Array.isArray(d.where) && d.where.length) { const ctx = { errs }; src.rows = src.rows.filter((r) => passAll(r, d.where, ctx)); }
      if (isObj(d.latest_by) && filled(d.latest_by.key)) {
        const k = S(d.latest_by.key), o = S(d.latest_by.order), best = {}, order = [];
        src.rows.forEach((r) => { const id = S(r[k]); if (!filled(id)) { return; } if (!(id in best)) { order.push(id); best[id] = r; return; } const x = toMs(r[o]), y = toMs(best[id][o]); if (x !== null && (y === null || x >= y)) { best[id] = r; } });
        src.rows = order.map((id) => best[id]);
      }
    });
    return out;
  };
  const colsOf = (def) => (Array.isArray(def.columns) ? def.columns.map(S) : []).concat((Array.isArray(def.fields) ? def.fields : []).filter(isObj).map((f) => S(f.name)));
  // which base columns a field (or column) needs, to report a missing column as source_missing rather than zeros
  const needsOf = (def, name, seen) => { seen = seen || {}; if (seen[name]) { return []; } seen[name] = true; const f = (Array.isArray(def.fields) ? def.fields : []).filter(isObj).find((x) => S(x.name) === S(name)); if (!f) { return [S(name)]; } if (f.fn === 'lookup') { return [S(f.my_key)]; } let out = []; (Array.isArray(f.args) ? f.args : []).forEach((a) => { if (typeof a === 'string' && (f.fn !== 'json_get' || a === f.args[0]) && (f.fn !== 'before' || a === f.args[0])) { out = out.concat(needsOf(def, a, seen)); } }); (Array.isArray(f.where) ? f.where : []).forEach((c) => { out = out.concat(needsOf(def, c.col, seen)); }); return out; };
  const missingFor = (src, names) => { if (!src) { return ['source not read']; } if (src.unread) { return ['tab ' + S(src.def.tab) + ' not readable']; } let need = []; names.filter(filled).forEach((n) => { need = need.concat(needsOf(src.def, n)); }); return need.filter((c, i) => need.indexOf(c) === i && src.missing.indexOf(c) !== -1).map((c) => 'column ' + c + ' is not on tab ' + S(src.def.tab)); };

  // ---------- measures ----------
  const agg = (vals, measure) => {
    if (measure === 'count') { return vals.length; }
    const ns = vals.map(num).filter((x) => x !== null);
    if (measure === 'sum') { return round2(ns.reduce((p, c) => p + c, 0)); }
    if (!ns.length) { return null; }
    if (measure === 'avg') { return round2(ns.reduce((p, c) => p + c, 0) / ns.length); }
    ns.sort((x, y) => x - y);
    const q = measure === 'p90' ? 0.9 : 0.5, pos = (ns.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return round2(ns[lo] + (ns[hi] - ns[lo]) * (pos - lo));
  };
  const metricRows = (m, SRC, ctx) => { const src = SRC[S(m.source)]; return src ? src.rows.filter((r) => passAll(r, m.where, ctx)) : []; };
  const metricMissing = (m, SRC) => missingFor(SRC[S(m.source)], [m.time, m.value, m.series_by, m.group_by].concat((Array.isArray(m.where) ? m.where : []).map((c) => c.col)));

  const seriesOf = (mk, m, SRC, rng, ctx) => {
    const rows = metricRows(m, SRC, ctx), measure = S(m.measure || 'count'), B = rng.buckets, groups = {}, order = [];
    const src = SRC[S(m.source)]; const from = src && src.def.kind === 'runs' ? Math.max(rng.from, toMs(rng.runsFrom) || rng.from) : rng.from;
    rows.forEach((r) => {
      const t = toMs(r[m.time]); if (t === null || t > rng.to + DAY - 1) { return; }
      const g = filled(m.series_by) ? S(r[m.series_by]) : mk; if (filled(m.series_by) && !filled(g)) { return; }
      if (!groups[g]) { groups[g] = { open: [], by: {} }; order.push(g); }
      if (t < from) { if (m.cumulative) { groups[g].open.push(r[m.value]); } return; }
      const b = bucketStart(t, rng.bucket); (groups[g].by[b] || (groups[g].by[b] = [])).push(r[m.value]);
    });
    let keys = order;
    if (filled(m.series_by)) { const want = Array.isArray(m.series_order) ? m.series_order.map(S) : null; keys = want ? want.filter((k) => m.series_all || groups[k]).concat(order.filter((k) => want.indexOf(k) === -1).sort()) : order.slice().sort(); }
    else if (!keys.length) { keys = [mk]; }
    const labels = isObj(m.series_labels) ? m.series_labels : {};
    return keys.map((g) => {
      const G = groups[g] || { open: [], by: {} }; let run = m.cumulative ? (agg(G.open, 'sum') || 0) : 0;
      const points = B.map((b) => { if (from > b + (bucketNext(b, rng.bucket) - b) - 1) { return { t: dISO(b), v: null }; } const vals = G.by[b] || []; let v = agg(vals, measure); if (m.cumulative) { run = round2(run + (agg(vals, 'sum') || 0)); v = run; } if (v !== null && filled(m.scale)) { v = round2(v * Number(m.scale)); } return { t: dISO(b), v }; });
      return { key: filled(m.series_by) ? g : mk, label: filled(m.series_by) ? S(labels[g] || g) : S(m.label || mk), points, n: Object.keys(G.by).reduce((p, b) => p + G.by[b].length, 0) + (m.cumulative ? G.open.length : 0) };
    });
  };
  const scalarOf = (m, SRC, rng, ctx) => {
    const rows = metricRows(m, SRC, ctx).filter((r) => { if (!filled(m.time) || m.all_time) { return true; } const t = toMs(r[m.time]); return t !== null && t >= rng.from && t <= rng.to + DAY - 1; });
    let v = agg(rows.map((r) => r[m.value]), S(m.measure || 'count')); if (v !== null && filled(m.scale)) { v = round2(v * Number(m.scale)); } return v;
  };

  const fill = (tpl, o) => S(tpl).replace(/\{([a-z0-9_]+)\}/gi, (x, k) => S(o[k]));

  const evalPanel = (pk, pn, T, SRC, rng, p, stds, ctx) => {
    const MET = isObj(T.metrics) ? T.metrics : {};
    const out = { key: pk, kind: S(pn.kind), title: S(pn.title || pk), unit: S(pn.unit || ''), note: S(pn.note || ''), state: 'ok' };
    if (pn.wide) { out.wide = true; }
    if (filled(pn.state) && pn.state !== 'ok') { out.state = S(pn.state); return out; }
    if (pn.kind === 'trend') {
      out.chart = S(pn.chart || 'line'); out.bucket_label = rng.bucket === 'day' ? 'Day' : rng.bucket === 'month' ? 'Month from' : 'Week from';
      let series = [], miss = [];
      (Array.isArray(pn.metrics) ? pn.metrics : []).forEach((mk) => { const m = MET[mk]; miss = miss.concat(metricMissing(m, SRC)); series = series.concat(seriesOf(mk, m, SRC, rng, ctx)); });
      if (miss.length) { out.state = 'source_missing'; out.note = miss.filter((x, i) => miss.indexOf(x) === i).join('; '); return out; }
      const total = series.reduce((a, s) => a + s.n, 0); series.forEach((s) => { delete s.n; });
      if (!total) { out.state = 'empty'; out.note = ''; return out; }
      out.series = series;
      const B = rng.buckets, lastFull = B.length - 1 - (bucketNext(B[B.length - 1], rng.bucket) - 1 > rng.to + DAY - 1 ? 1 : 0);
      if (lastFull >= 1 && pn.kpis !== false) { out.kpis = series.slice(0, 3).map((s) => ({ label: s.label + ' · last full ' + rng.bucket, value: s.points[lastFull].v, unit: out.unit, prev: s.points[lastFull - 1].v, prev_label: 'vs the ' + rng.bucket + ' before' })).filter((k) => k.value !== null); }
      return out;
    }
    if (pn.kind === 'kpi') {
      let miss = []; const tiles = [];
      (Array.isArray(pn.tiles) ? pn.tiles : []).filter(isObj).forEach((t) => { const m = MET[S(t.metric)]; const ms = metricMissing(m, SRC); if (ms.length) { miss = miss.concat(ms); return; } tiles.push({ label: S(t.label || m.label || t.metric), value: scalarOf(m, SRC, rng, ctx), unit: S(t.unit || ''), note: S(t.note || '') }); });
      if (!tiles.length && miss.length) { out.state = 'source_missing'; out.note = miss.filter((x, i) => miss.indexOf(x) === i).join('; '); return out; }
      out.tiles = tiles; if (miss.length) { out.note = (out.note ? out.note + ' ' : '') + 'Left out: ' + miss.filter((x, i) => miss.indexOf(x) === i).join('; '); } return out;
    }
    if (pn.kind === 'breakdown') {
      const m = MET[S((pn.metrics || [])[0])]; const ms = metricMissing(m, SRC); if (ms.length) { out.state = 'source_missing'; out.note = ms.join('; '); return out; }
      const rows = metricRows(m, SRC, ctx).filter((r) => { if (!filled(m.time) || m.all_time) { return true; } const t = toMs(r[m.time]); return t !== null && t >= rng.from && t <= rng.to + DAY - 1; });
      const by = {}; rows.forEach((r) => { const g = filled(r[m.group_by]) ? S(r[m.group_by]) : S(m.blank_label || '(none)'); (by[g] || (by[g] = [])).push(r[m.value]); });
      const want = Array.isArray(m.order) ? m.order.map(S) : []; const keys = want.filter((k) => by[k]).concat(Object.keys(by).filter((k) => want.indexOf(k) === -1).sort());
      if (!keys.length) { out.state = 'empty'; out.note = ''; return out; }
      out.items = keys.map((k) => ({ label: k, value: agg(by[k], S(m.measure || 'count')) })); return out;
    }
    if (pn.kind === 'ledger') {
      const src = SRC[S(pn.source)]; const usedCols = [pn.group_by, pn.time].concat((pn.total_columns || []).map((c) => c.value)).concat((getPath(pn, 'rows.columns') || []).map((c) => c.field || c.key));
      const ms = missingFor(src, usedCols); if (ms.length) { out.state = 'source_missing'; out.note = ms.join('; '); return out; }
      const rows = src.rows.filter((r) => passAll(r, pn.where, ctx));
      const inRange = (r) => { const t = toMs(r[pn.time]); return t !== null && t >= rng.from && t <= rng.to + DAY - 1; };
      const TC = (Array.isArray(pn.total_columns) ? pn.total_columns : []).filter(isObj), RC = (Array.isArray(getPath(pn, 'rows.columns')) ? pn.rows.columns : []).filter(isObj);
      out.total_columns = TC.map((c) => ({ key: S(c.key), label: S(c.label || c.key), type: S(c.type || 'number'), unit: S(c.unit || '') }));
      out.columns = RC.map((c) => ({ key: S(c.key), label: S(c.label || c.key), type: S(c.type || 'text'), unit: S(c.unit || '') }));
      out.currency = S(pn.currency || '');
      const totalsOf = (rs) => (Array.isArray(pn.totals) ? pn.totals : []).filter(isObj).map((t) => { const sel = rs.filter((r) => (t.range ? inRange(r) : true) && passAll(r, t.where, ctx)); const values = {}; TC.forEach((c) => { const vals = sel.map((r) => r[c.value]), ms = S(c.measure || 'count'); values[c.key] = (ms === 'sum' && vals.length && !vals.some((x) => num(x) !== null)) ? null : agg(vals, ms); }); return { label: S(t.label), values }; });
      const maxRows = Number(getPath(pn, 'rows.max') || 200), only = filled(getPath(pn, 'rows.only_param')) && p[pn.rows.only_param] === true;
      const rowsOf = (rs) => { const sel = rs.filter((r) => { const a = passAll(r, getPath(pn, 'rows.keep_where'), ctx) && filled(getPath(pn, 'rows.keep_where')); return only ? a : (a || inRange(r)); }); sel.sort((x, y) => (toMs(y[pn.time]) || 0) - (toMs(x[pn.time]) || 0)); const cut = sel.length > maxRows;
        return { cut, rows: sel.slice(0, maxRows).map((r) => { const o = {}; RC.forEach((c) => { const f = S(c.field || c.key); if (c.type === 'link') { const h = (Array.isArray(c.href) ? c.href : []).filter(isObj).find((x) => passAll(r, x.where, ctx)); o[c.key] = { text: S(r[f]), href: h ? fill(h.template, r) : '' }; } else if (c.type === 'date') { const t = toMs(r[f]); o[c.key] = t === null ? '' : dISO(t); } else if (c.type === 'money' || c.type === 'number') { o[c.key] = num(r[f]); } else if (c.type === 'bool') { o[c.key] = r[f] === true; } else { o[c.key] = S(r[f]); } }); if (filled(pn.row_currency) && filled(r[pn.row_currency])) { o.currency = S(r[pn.row_currency]); } return o; }) }; };
      const groups = [];
      const G = isObj(pn.groups) ? pn.groups : {}, parties = G.from, w = isObj(G.where) ? G.where : {};
      Object.keys(isObj(parties) ? parties : {}).filter((k) => Object.keys(w).every((f) => S((parties[k] || {})[f]) === S(w[f]))).forEach((k) => {
        const rs = rows.filter((r) => S(r[pn.group_by]) === k), info = Object.assign({ key: k }, parties[k]), rr = rowsOf(rs);
        const g = { key: k, label: fill(G.label || '{key}', info), sub: fill(G.sub || '', info), totals: totalsOf(rs), rows: rr.rows }; if (rr.cut) { g.rows_truncated = true; } groups.push(g);
      });
      const U = isObj(pn.ungrouped) ? pn.ungrouped : null;
      if (U) { const ur = rows.filter((r) => passAll(r, U.where, ctx)), by = {}; ur.forEach((r) => { const k = filled(r[U.by]) ? S(r[U.by]) : '?'; (by[k] || (by[k] = [])).push(r); }); Object.keys(by).sort().forEach((k) => { const rr = rowsOf(by[k]); const g = { key: 'unattributed:' + k, label: fill(U.label || '{key}', { key: k }), sub: S(U.sub || ''), flag: S(U.flag || ''), totals: totalsOf(by[k]), rows: rr.rows }; if (rr.cut) { g.rows_truncated = true; } groups.push(g); }); }
      out.groups = groups; out.wide = true; return out;
    }
    out.state = 'error'; out.note = 'panel kind ' + S(pn.kind) + ' is not known to the engine'; return out;
  };

  const evaluate = (req, stds, raw) => {
    const q = readReq(req, stds); if (!q.ok) { return { outcome: q.outcome, status: 'error', message: q.message, data: {}, item_count: 0 }; }
    const pl = plan(req, stds); if (!pl.ok) { return { outcome: pl.outcome, status: 'error', message: pl.message, data: {}, item_count: 0 }; }
    const T = q.T;
    if (q.op === 'tabs') {
      const tabs = (Array.isArray(T.tabs) ? T.tabs : []).filter(isObj).map((t) => ({ key: S(t.key), label: S(t.label || t.key), icon: S(t.icon || ''), kind: S(t.kind || 'panels'), op: S(t.op || ''), controls: Array.isArray(t.controls) ? t.controls : [] }));
      return { outcome: 'ok', status: 'ok', message: tabs.length + ' tabs', data: { protocol: 'ca.pack_tabs/1', version: T.version, tabs }, item_count: tabs.length };
    }
    const errs = q.ref_errs.slice(), names = sourcesFor(T, q.tab, errs), SRC = buildSources(T, stds, isObj(raw) ? raw : {}, names, errs), p = q.params, ctx = { errs };
    const B = []; for (let b = bucketStart(p.from, p.bucket); b <= p.to; b = bucketNext(b, p.bucket)) { B.push(b); if (B.length > 800) { break; } }
    const rng = { from: p.from, to: p.to, bucket: p.bucket, buckets: B, runsFrom: getPath(raw, 'runs_from') };
    const PAN = isObj(T.panels) ? T.panels : {};
    const panels = (Array.isArray(q.tab.panels) ? q.tab.panels : []).filter((pk) => isObj(PAN[pk])).map((pk) => { try { return evalPanel(pk, PAN[pk], T, SRC, rng, p, stds, ctx); } catch (e) { return { key: pk, kind: S(PAN[pk].kind), title: S(PAN[pk].title || pk), state: 'error', note: S(e && e.message).slice(0, 160) }; } });
    const notes = []; if (filled(p.bucket_note)) { notes.push(p.bucket_note); } if (filled(q.tab.note)) { notes.push(S(q.tab.note)); } errs.filter((e, i) => errs.indexOf(e) === i).slice(0, 5).forEach((e) => notes.push('config: ' + e));
    const applied = { from: dISO(p.from), to: dISO(p.to) }; if (filled(p.range_days)) { applied.range_days = p.range_days; applied.bucket = p.bucket; }
    (Array.isArray(q.tab.controls) ? q.tab.controls : []).forEach((c) => { if (isObj(c) && c.kind === 'toggle') { applied[c.key] = p[c.key] === true; } });
    const counts = {}; Object.keys(SRC).forEach((k) => { counts[k] = SRC[k].rows.length; });
    return { outcome: 'ok', status: 'ok', message: panels.length + ' panels', data: { protocol: 'ca.pack_tabs/1', tab: S(q.tab.key), range: { from: applied.from, to: applied.to }, applied, panels, notes, source_rows: counts }, item_count: panels.length };
  };
  return { plan, evaluate, toMs };
}
