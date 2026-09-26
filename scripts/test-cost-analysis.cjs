const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ Intl, Date, Map, Set, Number });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/cost-analysis.js'), 'utf8') + '\nthis.api = costAnalysis;', context);
const { total, rate, validate } = context.api;
const rows = [
  { code: 'A', name: '사업소', sales: 1000, cost: 800, profit: 200 },
  { code: 'B', name: '유통사', sales: 100, cost: 95, profit: 5 }
];
assert.equal(total(rows).profit, 205);
assert.equal(rate(total(rows).profit, total(rows).sales), 205 / 1100 * 100);
assert.equal(rate(0, 0), null);
assert.equal(total([{ sales: -100, cost: -80, profit: -20 }]).profit, -20);
assert.equal(Object.keys(validate(null, '2026')).length, 0);
const month = { rows, syncedAt: '2026-09-26T15:00:00Z' };
assert.equal(validate({ schemaVersion: 1, months: { '2026-09': { syncedAt: month.syncedAt, rowCount: 0 } } }, '2026')['2026-09'].rows.length, 0);
assert.equal(validate({ schemaVersion: 1, months: { '2026-09': month } }, '2026')['2026-09'].rows.length, 2);
assert.throws(() => validate({ schemaVersion: 1, months: { '2025-09': month } }, '2026'));
assert.throws(() => validate({ schemaVersion: 1, months: { '2026-09': { ...month, rows: [rows[0], rows[0]] } } }, '2026'));
assert.throws(() => validate({ schemaVersion: 1, months: { '2026-09': { ...month, rows: [{ ...rows[0], cost: null }] } } }, '2026'));
assert.throws(() => validate({ schemaVersion: 1, months: { '2026-09': { ...month, rows: [{ ...rows[0], sales: Infinity }] } } }, '2026'));
console.log('PASS: weighted margin, returns, zero sales, missing months, malformed data, duplicate groups');
