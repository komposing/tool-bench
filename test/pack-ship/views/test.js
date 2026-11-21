const { packViews } = require('./lib_node.js'); const T = require('./pack_tabs.js'); const assert = require('assert');
const PV = packViews();
const stds = { pack_tabs: JSON.parse(JSON.stringify(T)),
  discogs_reconcile: { orders: { sheet_id: 'SHEETA', orders_tab: 'Discogs_Orders ', items_tab: 'Discogs_Order_Items', statuses: ['Payment Received', 'In Progress', 'Shipped'] }, parcels: { sheet_id: 'SHEETB', booked_tab: 'parcels_booked' } },
  commerce: { statuses: { exclude: ['Merged', 'Cancelled*'] }, parties: { VRP: { name: 'VRP Music', type: 'self' }, NICK: { name: 'Nick', type: 'self' }, AW: { name: 'Andy W', type: 'consignor', commission_pct: 50 }, CH: { name: 'Charlie H', type: 'consignor', commission_pct: 25 }, PL: { name: 'Peter L', type: 'consignor', commission_pct: 25 } } },
  run_metric: { instances: { pick_run: { registry_key: 'discogs.orders.picking' } } }, pack_stages: { flags: { sheet_id: 'SHEETA', tab: 'Discogs_Order_Flags' } } };
const NOW = '2026-11-21';
let ok = 0; const t = (name, fn) => { try { fn(); ok++; } catch (e) { console.log('FAIL', name, e.message); process.exitCode = 1; } };

// plan
const pt = PV.plan({ op: 'tabs', _now: NOW }, stds); t('plan tabs', () => { assert(pt.ok && !pt.reads.any); });
const ps = PV.plan({ op: 'stats', _now: NOW }, stds);
t('plan stats', () => { assert(ps.ok, ps.message); assert.deepStrictEqual(Object.keys(ps.reads.sheets).sort(), ['discogs_orders', 'parcels']); assert.strictEqual(ps.reads.sheets.discogs_orders.sheet, 'SHEETA'); assert(ps.reads.sheets.discogs_orders.tabs.includes('order_lines') && ps.reads.sheets.discogs_orders.tabs.includes('Discogs_Order_Flags')); assert(ps.reads.runs.keys.includes('discogs.sync')); assert.strictEqual(ps.params.from, '2026-08-24'); });
const pc = PV.plan({ op: 'consignors', _now: NOW }, stds);
t('plan consignors reads ledger only', () => { assert(pc.ok, pc.message); assert.deepStrictEqual(Object.keys(pc.reads.sheets), ['discogs_orders']); assert.deepStrictEqual(pc.reads.sheets.discogs_orders.tabs, ['order_lines']); assert.strictEqual(pc.reads.runs.keys.length, 0); });
t('plan rejects', () => { assert.strictEqual(PV.plan({ op: 'stats', range_days: 45, _now: NOW }, stds).outcome, 'param_rejected'); assert.strictEqual(PV.plan({ op: 'nope' }, stds).outcome, 'param_rejected'); assert.strictEqual(PV.plan({ op: 'consignors', from: '21/11/2026' }, stds).outcome, 'param_rejected'); assert.strictEqual(PV.plan({ op: 'orders' }, stds).outcome, 'param_rejected'); });
t('buyer column refused', () => { const s2 = JSON.parse(JSON.stringify(stds)); s2.pack_tabs.sources.orders.columns.push('buyer_postcode'); const r = PV.plan({ op: 'stats', _now: NOW }, s2); assert.strictEqual(r.outcome, 'config_invalid'); assert(/buyer/.test(r.message)); });

// fixtures
const OH = ['order_id', 'buyer', 'order_date', 'status', 'total', 'shipping', 'fee', 'buyer_postcode', 'health', 'paid_at', 'shipped_at', 'archived'];
const orders = [OH,
  ['0-1', 'old', '2026-05-01', 'In Progress', 9, 4.5, 0.8, 'X', 'Critical', '', '', true],   // archived: left out of open-order health
  ['1-1', 'bob', '2026-11-03', 'Shipped', 30, 4.5, 2.4, 'N1 1AA', '', '2026-11-03T10:00:00.000Z', '2026-11-05T10:00:00.000Z'],
  ['1-2', 'amy', '2026-11-04', 'Shipped', 50, 4.5, 4, 'N2', '', '2026-11-04T08:00:00.000Z', '2026-11-08T08:00:00.000Z'],
  ['1-3', 'cat', 46336, 'Payment Received', 20, 9, 1.6, 'X', 'At Risk', '', ''],            // serial date = 2026-11-10
  ['1-4', 'dan', '2026-11-11', 'Cancelled (Per Buyer Request)', 99, 4.5, 0, 'X', '', '', ''],
  ['1-5', 'eve', '2026-11-17', 'In Progress', 12, 4.5, 1, 'X', 'On Track', '2026-11-17T09:00:00.000Z', '']];
const items = [['order_id', 'listing_id', 'order_date', 'order_status', 'buyer'], ['1-1', 'L1', '2026-11-03', 'Shipped', 'bob'], ['1-1', 'L2', '2026-11-03', 'Shipped', 'bob'], ['1-2', 'L3', '2026-11-04', 'Shipped', 'amy'], ['1-3', 'L4', '2026-11-10', 'Payment Received', 'cat'], ['1-4', 'L5', '2026-11-11', 'Cancelled (Per Buyer Request)', 'dan'], ['1-5', 'L6', '2026-11-17', 'In Progress', 'eve']];
const flags = [['order_ref', 'flag', 'on', 'note', 'set_at', 'cleared_at', 'run_id'], ['1-1', 'printed', 'yes', 'file:x', '2026-11-03T22:00:00.000Z', '', 'r'], ['1-2', 'printed', 'no', '', '2026-11-04T09:00:00.000Z', '2026-11-04T10:00:00.000Z', 'r'], ['1-2', 'follow_up', 'yes', '', '2026-11-04T09:00:00.000Z', '', 'r']];
const LH = ['channel', 'platform', 'seller_account', 'order_id', 'line_id', 'order_date', 'status', 'title', 'marker_raw', 'owner', 'owner_rule', 'rule_version', 'item_price', 'shipping_share', 'fee_total_order', 'item_fee_share', 'shipping_fee_share', 'payment_fee_share', 'currency', 'net', 'commission_pct', 'payout', 'settled_ref'];
const L = (ch, oid, lid, d, st, title, marker, owner, rule, price, fee, net, pct, payout, settled) => [ch, '', '', oid, lid, d, st, title, marker, owner, rule, 5, price, 0, 0, fee, 0, 0, 'GBP', net, pct, payout, settled];
const lines = [LH,
  L('discogs:2090472', '1-1', 'L1', '2026-11-03', 'Shipped', 'LP one', 'Box 3', 'VRP', 'channel_default', 10, 0.8, 9.2, '', '', ''),
  L('discogs:2090472', '1-1', 'L2', '2026-11-03', 'Shipped', 'LP two', 'Box 4 (AW)', 'AW', 'marker_code', 20, 1.6, 18.4, 50, 9.2, ''),
  L('discogs:2090472', '1-2', 'L3', '2026-11-04', 'Shipped', 'LP three', 'Shelf (CH)', 'CH', 'marker_code', 50, 4, 46, 25, 34.5, 'ST1'),
  L('discogs:2090472', '1-3', 'L4', '2026-11-10', 'Payment Received', 'LP four', 'Crate (ZZ)', '', 'unattributed', 20, 1.6, 18.4, '', '', ''),
  L('discogs:2090472', '1-4', 'L5', '2026-11-11', 'Cancelled (Per Buyer Request)', 'LP five', '(AW)', 'AW', 'marker_code', 99, 0, 99, 50, 49.5, ''),
  L('ebay:main', 'E-9', 'E1', '2026-07-01', 'Completed', 'Card lot', 'RS1:000123 (PL)', 'PL', 'marker_code', 40, 0, 40, 25, 30, ''),
  L('discogs:2090472', '0-9', 'L0', '2026-06-01', 'Shipped', 'Old LP', '(AW)', 'AW', 'marker_code', 10, 1, 9, 50, 4.5, '')];
const parcels = [['source_platform', 'source_order_id', 'booking_status', 'booking_date', 'estimated_cost_gbp', 'tracking_events', 'latest_tracking_status', 'recipient_name', 'delivery_postcode'],
  ['discogs', '1-1', 'delivered', '2026-11-03T12:00:00', 3.2, '{"dropped_off":"2026-11-04T10:00:00Z","delivered":"2026-11-06T10:00:00Z"}', 'Delivered', 'Bob', 'N1'],
  ['discogs', '1-2', 'dropped_off', 46331.5, 3.9, '{"dropped_off":"2026-11-06T08:00:00Z"}', 'Dropped off', 'Amy', 'N2'],
  ['discogs', '1-3', 'draft', '', 9.9, '', '', 'Cat', 'X'],
  ['ebay', 'E-9', 'booked', '2026-11-05T12:00:00', 5, '', '', 'Z', 'X']];
const runs = [{ registry_key: 'discogs.sync', ts: '2026-11-18T06:00:00.000Z', outcome: 'ok', duration_ms: 42000, chatId: 'x' }, { registry_key: 'discogs.sync', ts: '2026-11-19T06:00:00.000Z', outcome: 'upstream_error', duration_ms: 1000 }, { registry_key: 'parcel2go.orders.draft', ts: '2026-11-12T06:00:00.000Z', outcome: 'address_field_missing', duration_ms: 900 }, { registry_key: 'parcel2go.orders.draft', ts: '2026-11-12T07:00:00.000Z', outcome: 'ok', duration_ms: 900 }];
const PK = 'discogs.orders.picking', mj = (o) => JSON.stringify(Object.assign({ kind: 'run_close', op: 'end' }, o));
runs.push({ registry_key: PK, ts: '2026-11-10T10:01:00.000Z', parent_run_id: 'r1', metrics_json: JSON.stringify({ kind: 'event', status: 'collected' }) },
  { registry_key: PK, ts: '2026-11-10T10:05:00.000Z', parent_run_id: 'r1', metrics_json: mj({ started_at: '2026-11-10T10:00:00.000Z', reached: 4, counts: { collected: 1, not_found: 3, issue: 0 }, ms_per_collected: { wall: 99000, active: 90000 } }) },
  { registry_key: PK, ts: '2026-11-10T10:09:00.000Z', parent_run_id: 'r1', metrics_json: mj({ started_at: '2026-11-10T10:00:00.000Z', reached: 4, counts: { collected: 3, not_found: 1, issue: 0 }, ms_per_collected: { wall: 60000, active: 20000 } }) },
  { registry_key: PK, ts: '2026-11-11T09:00:00.000Z', parent_run_id: 'r2', metrics_json: mj({ started_at: '2026-11-11T08:59:00.000Z', reached: 0, counts: { collected: 0, not_found: 0, issue: 0 }, ms_per_collected: { wall: null, active: null } }) },
  { registry_key: PK, ts: '2026-11-12T09:30:00.000Z', parent_run_id: 'r3', metrics_json: mj({ started_at: '2026-11-12T09:00:00.000Z', reached: 6, counts: { collected: 5, not_found: 0, issue: 1 }, ms_per_collected: { wall: 40000, active: 30000 } }) },
  { registry_key: PK, ts: '2026-11-18T09:30:00.000Z', parent_run_id: 'r4', metrics_json: 'not json' });
const raw = { tabs: { 'discogs_orders|Discogs_Orders ': orders, 'discogs_orders|Discogs_Order_Items': items, 'discogs_orders|Discogs_Order_Flags': flags, 'discogs_orders|order_lines': lines, 'parcels|parcels_booked': parcels }, runs, runs_from: ps.reads.runs.from };

const tabs = PV.evaluate({ op: 'tabs' }, stds, {});
t('tabs reply', () => { assert.strictEqual(tabs.outcome, 'ok'); assert.deepStrictEqual(tabs.data.tabs.map(x => x.key), ['orders', 'stats', 'consignors']); assert.strictEqual(tabs.data.tabs[1].controls[0].key, 'range_days'); assert(!JSON.stringify(tabs).includes('SHEETA')); });

const st = PV.evaluate({ op: 'stats', range_days: 30, bucket: 'week', _now: NOW }, stds, raw); const P = {}; (st.data.panels || []).forEach(p => P[p.key] = p);
const pt2 = (p, key, tt) => { const s = P[p].series.find(s => s.key === key); assert(s, 'series ' + key + ' in ' + p); const q = s.points.find(q => q.t === tt); assert(q, 'bucket ' + tt); return q.v; };
t('stats ok and every panel present', () => { assert.strictEqual(st.outcome, 'ok', st.message); assert.strictEqual(st.data.panels.length, stds.pack_tabs.tabs[1].panels.length); st.data.panels.forEach(p => assert(['ok', 'empty', 'source_missing'].includes(p.state), p.key + ' ' + p.state + ' ' + p.note)); assert.deepStrictEqual(st.data.notes.filter(n => /^config/.test(n)), []); });
t('sales by week, cancelled and ebay excluded', () => { assert.strictEqual(pt2('sales', 'gross', '2026-11-02'), 80); assert.strictEqual(pt2('sales', 'net', '2026-11-02'), 73.6); assert.strictEqual(pt2('sales', 'gross', '2026-11-09'), 20); assert.strictEqual(pt2('sales', 'gross', '2026-11-16'), 0); });
t('house take: own net + commission; unattributed in neither', () => { assert.strictEqual(pt2('house_take', 'own_net', '2026-11-02'), 9.2); assert.strictEqual(pt2('house_take', 'commission', '2026-11-02'), 9.2 + 11.5); assert.strictEqual(pt2('house_take', 'own_net', '2026-11-09'), 0); });
t('vrp', () => { assert.strictEqual(pt2('vrp_items', 'vrp_items', '2026-11-02'), 1); assert.strictEqual(pt2('vrp_net', 'vrp_net', '2026-11-02'), 9.2); });
t('payouts owed cumulative with opening balance, settled excluded, party order', () => { assert.deepStrictEqual(P.payouts_owed.series.map(s => s.key), ['AW']); assert.strictEqual(pt2('payouts_owed', 'AW', '2026-10-26'), 4.5); assert.strictEqual(pt2('payouts_owed', 'AW', '2026-11-02'), 13.7); assert.strictEqual(pt2('payouts_owed', 'AW', '2026-11-16'), 13.7); });
t('postage margin only for booked parcels', () => { assert.strictEqual(pt2('postage_margin', 'postage_margin', '2026-11-02'), 1.9); assert.strictEqual(pt2('postage_margin', 'postage_margin', '2026-11-09'), 0); });
t('order flow, serial date, cancelled out', () => { assert.strictEqual(pt2('order_flow', 'orders', '2026-11-02'), 2); assert.strictEqual(pt2('order_flow', 'orders', '2026-11-09'), 1); assert.strictEqual(pt2('order_flow', 'items', '2026-11-02'), 3); assert.strictEqual(pt2('order_value', 'order_value', '2026-11-02'), 40); });
t('breakdowns', () => { assert.deepStrictEqual(P.status_mix.items.map(i => i.label + ':' + i.value), ['Payment Received:1', 'In Progress:1', 'Shipped:2', 'Cancelled (Per Buyer Request):1']); assert.deepStrictEqual(P.health_now.items.map(i => i.label + ':' + i.value), ['On Track:1', 'At Risk:1']); });
t('fulfilment speed', () => { assert.strictEqual(pt2('fulfil_median', 'med_printed', '2026-11-02'), 0.5); assert.strictEqual(pt2('fulfil_median', 'med_dropped', '2026-11-02'), 1.5); assert.strictEqual(pt2('fulfil_median', 'med_shipped', '2026-11-02'), 3); assert.strictEqual(pt2('fulfil_median', 'med_printed', '2026-11-16'), null); });
t('parcel2go', () => { assert.strictEqual(pt2('parcels_booked', 'parcels_booked', '2026-11-02'), 2); assert.strictEqual(pt2('label_cost', 'label_cost', '2026-11-02'), 3.55); assert.strictEqual(pt2('delivery_days', 'transit_median', '2026-11-02'), 2); assert.strictEqual(P.tracking_exceptions.state, 'source_missing'); assert.strictEqual(pt2('drafts_refused', 'drafts_refused', '2026-11-09'), 1); });
t('automation', () => { assert.strictEqual(P.runs_failed.series.length, 5); assert.strictEqual(pt2('runs_failed', 'discogs.sync', '2026-11-16'), 1); assert.strictEqual(P.runs_failed.series[1].label, 'Discogs sync'); assert.strictEqual(pt2('runs_duration', 'discogs.sync', '2026-11-16'), 42); });
t('headline', () => { const h = {}; P.headline.tiles.forEach(x => h[x.label] = x.value); assert.strictEqual(h['Gross sales'], 100); assert.strictEqual(h['Orders'], 4); assert.strictEqual(h['Payouts owed now'], 13.7); assert.strictEqual(h['Commission earned'], 20.7); });
t('kpis use the last full week', () => { const k = P.sales.kpis[0]; assert(/last full week/.test(k.label)); assert.strictEqual(k.value, 20); assert.strictEqual(k.prev, 80); });
t('no buyer data anywhere in stats', () => { const j = JSON.stringify(st); ['bob', 'amy', 'N1 1AA', 'Bob', 'Amy'].forEach(x => assert(!j.includes(x), x)); });
t('missing column -> source_missing, not zero', () => { const r2 = JSON.parse(JSON.stringify(raw)); r2.tabs['discogs_orders|Discogs_Orders '] = orders.map(r => r.filter((_, i) => i !== 5)); const s2 = PV.evaluate({ op: 'stats', range_days: 30, _now: NOW }, stds, r2); const pm = s2.data.panels.find(p => p.key === 'postage_margin'); assert.strictEqual(pm.state, 'source_missing'); assert(/shipping/.test(pm.note)); assert.strictEqual(s2.data.panels.find(p => p.key === 'order_flow').state, 'ok'); assert(/Left out/.test(s2.data.panels.find(p => p.key === 'headline').note)); });
t('unread tab -> source_missing', () => { const r2 = JSON.parse(JSON.stringify(raw)); delete r2.tabs['parcels|parcels_booked']; const s2 = PV.evaluate({ op: 'stats', range_days: 30, _now: NOW }, stds, r2); assert.strictEqual(s2.data.panels.find(p => p.key === 'parcels_booked').state, 'source_missing'); });
t('day bucket falls back over 92 days', () => { const s2 = PV.evaluate({ op: 'stats', range_days: 180, bucket: 'day', _now: NOW }, stds, raw); assert.strictEqual(s2.data.applied.bucket, 'week'); assert(s2.data.notes.some(n => /daily/.test(n))); });

const co = PV.evaluate({ op: 'consignors', from: '2026-11-01', to: '2026-11-21', _now: NOW }, stds, raw); const led = co.data.panels[0]; const G = {}; led.groups.forEach(g => G[g.key] = g);
t('consignor groups from parties + unattributed', () => { assert.strictEqual(co.outcome, 'ok'); assert.deepStrictEqual(led.groups.map(g => g.key), ['AW', 'CH', 'PL', 'unattributed:ZZ']); assert.strictEqual(G.AW.label, 'Andy W (AW)'); assert.strictEqual(G.AW.sub, 'house keeps 50% after fees'); assert.strictEqual(G['unattributed:ZZ'].flag, 'code not registered'); });
t('AW totals: unsettled all time vs period; cancelled excluded', () => { const u = G.AW.totals[0].values, p = G.AW.totals[1].values; assert.deepStrictEqual([u.lines, u.gross, u.fees, u.net, u.house, u.payout], [2, 30, 2.6, 27.4, 13.7, 13.7]); assert.deepStrictEqual([p.lines, p.gross, p.payout], [1, 20, 9.2]); });
t('CH settled line: nothing unsettled, in period', () => { assert.strictEqual(G.CH.totals[0].values.lines, 0); assert.strictEqual(G.CH.totals[1].values.payout, 34.5); assert.strictEqual(G.CH.rows[0].settled, true); });
t('rows: period or unsettled, newest first, links', () => { assert.deepStrictEqual(G.AW.rows.map(r => r.order.text), ['1-1', '0-9']); assert.strictEqual(G.AW.rows[0].order.href, 'https://www.discogs.com/sell/order/1-1'); assert.strictEqual(G.PL.rows[0].order.href, ''); assert.strictEqual(G.PL.rows[0].channel_name, 'ebay'); assert.strictEqual(G.AW.rows[0].marker_code, 'AW'); assert.strictEqual(G.AW.rows[0].order_date, '2026-11-03'); });
t('unsettled_only hides settled rows', () => { const c2 = PV.evaluate({ op: 'consignors', from: '2026-11-01', to: '2026-11-21', unsettled_only: true, _now: NOW }, stds, raw); assert.strictEqual(c2.data.panels[0].groups.find(g => g.key === 'CH').rows.length, 0); assert.strictEqual(c2.data.applied.unsettled_only, true); });
t('default period 90 days', () => { const c3 = PV.evaluate({ op: 'consignors', _now: NOW }, stds, raw); assert.strictEqual(c3.data.applied.from, '2026-08-24'); assert.strictEqual(c3.data.applied.to, '2026-11-21'); });
t('picking: latest close per run, taps and empty starts left out', () => { assert.strictEqual(pt2('pick_outcomes', 'pick_collected', '2026-11-09'), 8); assert.strictEqual(pt2('pick_outcomes', 'pick_not_found', '2026-11-09'), 1); assert.strictEqual(pt2('pick_outcomes', 'pick_issue', '2026-11-09'), 1); assert.strictEqual(pt2('pick_speed', 'pick_s_active', '2026-11-09'), 25); assert.strictEqual(pt2('pick_speed', 'pick_s_wall', '2026-11-09'), 50); });
t('picking rows stay out of the automation panels', () => { assert(!JSON.stringify(P.runs_failed).includes('picking')); assert(!JSON.stringify(P.runs_duration).includes('picking')); });
t('sizes', () => { const a = JSON.stringify(T).length; assert(a < 28000, 'std chars ' + a); });
console.log(ok + ' passed; std chars', JSON.stringify(T).length, 'stats reply chars', JSON.stringify(st).length);
