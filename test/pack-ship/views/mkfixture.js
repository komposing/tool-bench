// builds the page-harness fixture from the engine library on synthetic rows (no live data)
const { packViews } = require('./lib_node.js'); const T = require('./pack_tabs.js'); const PV = packViews();
const stds = { pack_tabs: JSON.parse(JSON.stringify(T)), discogs_reconcile: { orders: { sheet_id: 'A', orders_tab: 'Discogs_Orders ', items_tab: 'Discogs_Order_Items', statuses: ['Payment Received', 'In Progress', 'Shipped'] }, parcels: { sheet_id: 'B', booked_tab: 'parcels_booked' } },
  commerce: { statuses: { exclude: ['Merged', 'Cancelled*'] }, parties: { VRP: { name: 'VRP Music', type: 'self' }, AA: { name: 'Test Consignor A', type: 'consignor', commission_pct: 50 }, BB: { name: 'Test Consignor B', type: 'consignor', commission_pct: 25 } } }, run_metric: { instances: { pick_run: { registry_key: 'discogs.orders.picking' } } }, pack_stages: { flags: { sheet_id: 'A', tab: 'Discogs_Order_Flags' } } };
const NOW = '2026-11-21', D = 86400000, t0 = Date.UTC(2026, 7, 24);
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const orders = [['order_id', 'order_date', 'status', 'total', 'shipping', 'fee', 'health', 'paid_at', 'shipped_at', 'archived']], items = [['order_id', 'listing_id', 'order_date', 'order_status']], flags = [['order_ref', 'flag', 'on', 'set_at']];
const lines = [['channel', 'order_id', 'line_id', 'order_date', 'status', 'title', 'marker_raw', 'owner', 'owner_rule', 'item_price', 'item_fee_share', 'net', 'commission_pct', 'payout', 'settled_ref', 'currency']];
const parcels = [['source_platform', 'source_order_id', 'booking_status', 'booking_date', 'estimated_cost_gbp', 'tracking_events', 'latest_tracking_status']], runs = [];
let n = 0;
for (let d = 0; d < 90; d++) { const k = Math.floor(rnd() * 3); for (let j = 0; j < k; j++) { n++; const id = '7000000-' + n, day = t0 + d * D, date = new Date(day).toISOString().slice(0, 10), recent = d > 84;
  const status = recent ? (rnd() < .5 ? 'Payment Received' : 'In Progress') : 'Shipped', paid = new Date(day + 3600e3 * 9).toISOString(), ship = 3.5 + Math.round(rnd() * 3);
  const ni = 1 + Math.floor(rnd() * 3); let total = 0;
  for (let i = 0; i < ni; i++) { const price = 6 + Math.round(rnd() * 40), fee = Math.round(price * 9) / 100, net = Math.round((price - fee) * 100) / 100, r = rnd(); const owner = r < .6 ? 'VRP' : r < .8 ? 'AA' : r < .95 ? 'BB' : '', pct = owner === 'AA' ? 50 : owner === 'BB' ? 25 : '';
    total += price; items.push([id, 'L' + n + i, date, status]);
    lines.push(['discogs:1', id, 'L' + n + i, date, status, 'Test LP ' + n + '/' + i, owner === 'VRP' ? 'Box 1' : owner ? 'Box 2 (' + owner + ')' : 'Box 3 (ZZ)', owner, owner === 'VRP' ? 'channel_default' : owner ? 'marker_code' : 'unattributed', price, fee, net, pct, pct === '' ? '' : Math.round(net * (1 - pct / 100) * 100) / 100, owner === 'BB' && d < 40 ? 'ST-1' : '', 'GBP']); }
  orders.push([id, date, status, total + ship, ship, Math.round(total * 9) / 100, recent ? ['On Track', 'At Risk', 'Critical'][Math.floor(rnd() * 3)] : '', paid, status === 'Shipped' ? new Date(day + D * (1 + rnd() * 3)).toISOString() : '']);
  if (d > 76 && status !== 'Payment Received') { flags.push([id, 'printed', 'yes', new Date(day + 3600e3 * (12 + rnd() * 30)).toISOString()]); }
  if (status !== 'Payment Received') { const drop = day + D * (1 + rnd() * 2), ev = { dropped_off: new Date(drop).toISOString() }; if (!recent) { ev.delivered = new Date(drop + D * (1 + rnd() * 4)).toISOString(); } parcels.push(['discogs', id, recent ? 'dropped_off' : 'delivered', new Date(day + 3600e3 * 11).toISOString().slice(0, 19), 2.9 + Math.round(rnd() * 20) / 10, JSON.stringify(ev), recent ? 'Dropped off' : 'Delivered']); } } }
lines.push(['ebay:main', 'E-1', 'E1', '2026-11-10', 'Completed', 'Test card lot', 'RS1:000001 (AA)', 'AA', 'marker_code', 40, 0, 40, 50, 20, '', 'GBP']);
for (let d = 30; d < 90; d++) { const ts = new Date(t0 + d * D + 3600e3 * 6).toISOString(); ['pack.refresh', 'discogs.sync', 'discogs.orders.reconcile', 'parcel2go.orders.collect'].forEach((k, i) => runs.push({ registry_key: k, ts, outcome: rnd() < .06 ? 'upstream_error' : 'ok', duration_ms: 20000 + i * 9000 + Math.round(rnd() * 8000) })); if (d % 9 === 0) { runs.push({ registry_key: 'parcel2go.orders.draft', ts, outcome: 'address_field_missing', duration_ms: 800 }); } }
const plan = PV.plan({ op: 'stats', _now: NOW }, stds);
// pick runs (generated): a tap event and a close row per run; one run closed twice, one empty start
for (let d = 31; d < 90; d += 3) { const st = t0 + d * D + 3600e3 * 15, id = 'pick-' + d, n = 6 + Math.round(rnd() * 20), c = Math.round(n * (0.5 + rnd() * 0.4)), nf = n - c, act = 18000 + Math.round(rnd() * 30000);
  const close = (off, cc) => ({ registry_key: 'discogs.orders.picking', ts: new Date(st + off).toISOString(), outcome: 'ok', duration_ms: 2000, parent_run_id: id, metrics_json: JSON.stringify({ kind: 'run_close', op: 'end', metric: 'pick_run', started_at: new Date(st).toISOString(), reached: d % 15 === 1 ? 0 : n, counts: { collected: d % 15 === 1 ? 0 : cc, not_found: d % 15 === 1 ? 0 : n - cc, issue: 0 }, ms_per_collected: d % 15 === 1 ? { wall: null, active: null } : { wall: act + Math.round(rnd() * 40000), active: act } }) });
  runs.push({ registry_key: 'discogs.orders.picking', ts: new Date(st + 60000).toISOString(), outcome: 'ok', duration_ms: 300, parent_run_id: id, metrics_json: JSON.stringify({ kind: 'event', status: 'collected' }) });
  if (d % 12 === 1) { runs.push(close(300000, Math.max(0, c - 2))); } runs.push(close(600000, c)); }
// health snapshots (generated): one or two per day for the last 30 days; the later one of a day wins
for (let d = 60; d < 90; d++) { const day = new Date(t0 + d * D).toISOString().slice(0, 10), c = [3 + Math.round(rnd() * 6), Math.round(rnd() * 3), Math.round(rnd() * 3), 4 + Math.round(rnd() * 6), Math.round(rnd() * 5)];
  const row = (h, cc) => ({ registry_key: 'discogs.orders.health.refresh', ts: new Date(t0 + d * D + 3600e3 * h).toISOString(), outcome: 'ok', duration_ms: 0, metrics_json: JSON.stringify({ kind: 'health_snapshot', day, counts: { 'On Track': cc[0], 'At Risk': cc[1], 'Priority': cc[2], 'Critical': cc[3], 'Order Issues': cc[4] }, open: cc.reduce((a, b) => a + b, 0) }) });
  if (d % 2) { runs.push(row(8, c.map((x) => x + 1))); } runs.push(row(18, c)); }
const raw = { tabs: { 'discogs_orders|Discogs_Orders ': orders, 'discogs_orders|Discogs_Order_Items': items, 'discogs_orders|Discogs_Order_Flags': flags, 'discogs_orders|order_lines': lines, 'parcels|parcels_booked': parcels }, runs, runs_from: plan.reads.runs.from };
const env = (r) => ({ status: 'ok', outcome: 'ok', message: r.message, run_id: 'tb-test', data: r.data, protocol: 'ca.pack_ship/1' });
const out = { note: 'Synthetic. Built by the CA_V3 Pack Views library (C1528) from generated rows; no live data.', tabs: env(PV.evaluate({ op: 'tabs' }, stds, {})),
  stats90: env(PV.evaluate({ op: 'stats', range_days: 90, bucket: 'week', _now: NOW }, stds, raw)), stats30: env(PV.evaluate({ op: 'stats', range_days: 30, bucket: 'week', _now: NOW }, stds, raw)),
  consignors: env(PV.evaluate({ op: 'consignors', _now: NOW }, stds, raw)), consignors_unsettled: env(PV.evaluate({ op: 'consignors', unsettled_only: true, _now: NOW }, stds, raw)) };
require('fs').writeFileSync(process.argv[2], JSON.stringify(out));
console.log('fixture chars', JSON.stringify(out).length, 'orders', n, 'states', out.stats90.data.panels.map(p => p.key + ':' + p.state).join(' '));
