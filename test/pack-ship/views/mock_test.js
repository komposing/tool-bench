// run the two node bodies under a stand-in for the n8n Code node globals, on the unit-test fixtures
const fs = require('fs'); const T = require('./pack_tabs.js');
const stdRows = [{ standards_name: 'pack_tabs', standards_guide: JSON.stringify(T) }];
const refRows = [{ standards_name: 'discogs_reconcile', standards_guide: JSON.stringify({ orders: { sheet_id: 'SHEETA', orders_tab: 'Discogs_Orders ', items_tab: 'Discogs_Order_Items', statuses: ['Payment Received', 'In Progress', 'Shipped'] }, parcels: { sheet_id: 'SHEETB', booked_tab: 'parcels_booked' } }) },
  { standards_name: 'commerce', standards_guide: JSON.stringify({ statuses: { exclude: ['Merged', 'Cancelled*'] }, parties: { VRP: { type: 'self' }, AW: { name: 'A', type: 'consignor', commission_pct: 50 } } }) },
  { standards_name: 'pack_stages', standards_guide: JSON.stringify({ flags: { sheet_id: 'SHEETA', tab: 'Discogs_Order_Flags' } }) },
  { standards_name: 'run_metric', standards_guide: JSON.stringify({ instances: { pick_run: { registry_key: 'discogs.orders.picking' } } }) }];
const run = (body, nodes) => { const $ = (n) => { const d = nodes[n]; return { first: () => ({ json: d ? d[0] : undefined }), all: () => (d || []).map((j) => ({ json: j })), isExecuted: !!d }; }; return new Function('$', body)($); };
const plan = (req) => run(fs.readFileSync(require('path').join(__dirname, 'readplan.js'), 'utf8'), { 'Pack Views Call': [req], 'Load Tabs Std': stdRows, 'Load Refs': refRows })[0].json;
const assert = require('assert');
const p1 = plan({ op: 'tabs' }); assert.strictEqual(p1.any, false);
const p2 = plan({ op: 'stats' }); assert(p2.any && p2.need.D && p2.need.P, JSON.stringify(p2.errs)); assert(p2.urls.D.includes("ranges='Discogs_Orders%20'") || p2.urls.D.includes('%27Discogs_Orders%20%27'), p2.urls.D); assert.strictEqual(p2.run_keys.length, 7); assert(p2.run_keys.includes('discogs.orders.picking'), JSON.stringify(p2.run_keys));
const p3 = plan({ op: 'consignors' }); assert(p3.any && p3.need.D && !p3.need.P && p3.run_keys.length === 0); assert.deepStrictEqual(p3.slots.discogs_orders.tabs, ['order_lines']);
console.log('D url', p2.urls.D.slice(0, 200));
const lib = fs.readFileSync(require('path').join(__dirname, 'lib.js'), 'utf8') + fs.readFileSync(require('path').join(__dirname, 'evaltail.js'), 'utf8');
const hd = ['channel', 'order_id', 'line_id', 'order_date', 'status', 'title', 'marker_raw', 'owner', 'owner_rule', 'item_price', 'item_fee_share', 'net', 'commission_pct', 'payout', 'settled_ref', 'currency'];
const ev = (req, pl, extra) => run(lib, Object.assign({ 'Pack Views Call': [req], 'Load Tabs Std': stdRows, 'Load Refs': refRows, 'Read Plan': [pl] }, extra))[0].json;
const e1 = ev({ op: 'tabs' }, p1, {}); assert.strictEqual(e1.outcome, 'ok'); assert.strictEqual(e1.data.tabs.length, 3); assert.strictEqual(e1.item_count, 3);
const e3 = ev({ op: 'consignors' }, p3, { 'Read Sheet D': [{ valueRanges: [{ values: [hd, ['discogs:1', '9-1', 'L', new Date().toISOString().slice(0, 10), 'Shipped', 'LP', 'x (AW)', 'AW', 'marker_code', 10, 1, 9, 50, 4.5, '', 'GBP']] }] }], 'Read Runs': [{}] });
assert.strictEqual(e3.outcome, 'ok', e3.message); assert.strictEqual(e3.data.panels[0].groups[0].totals[0].values.payout, 4.5);
const e2 = ev({ op: 'stats' }, p2, { 'Read Sheet D': [{ valueRanges: [] }], 'Read Runs': [{}] }); assert.strictEqual(e2.outcome, 'ok'); assert(e2.data.panels.every((p) => ['source_missing', 'empty'].includes(p.state)), e2.data.panels.map((p) => p.key + ':' + p.state).join(' '));
const e4 = ev({ op: 'stats', range_days: 45 }, p2, {}); assert.strictEqual(e4.outcome, 'param_rejected');
const e5 = ev({ op: 'bogus' }, plan({ op: 'bogus' }), {}); assert.strictEqual(e5.outcome, 'param_rejected');
console.log('node bodies ok; eval code chars', lib.length, 'plan chars', fs.readFileSync(require('path').join(__dirname, 'readplan.js'), 'utf8').length);
