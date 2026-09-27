const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js', 'app-data.js'), 'utf8');
const context = vm.createContext({ console, window: { __erpRemoteData: { ship: [{ id: 'ship' }], order: [{ id: 'order' }] } } });

vm.runInContext(`
  let allEntries = [], allUsers = [], targets = {}, allNotices = [], allRevisits = [], allClients = [];
  let allShipOrders = [], allOrderOrders = [], allOrders = [];
  const DEFAULT_USERS = [{ id: 'admin', name: '관리자' }];
  const shared = {
    'sj-entries-v4': [{ id: 1001, personId: 'Lee1' }, { id: 20, personId: 'Lee1' }],
    'sj-users-v6': [{ id: 'Lee1', name: '이기현' }],
    'sj-targets-v4': { salesTarget: 10 },
    'sj-notices': [{ id: 1 }],
    'sj-revisits': [{ id: 2, personId: 'Lee1' }],
    'sj-clients': [{ id: 3 }],
  };
  const writes = {};
  const calls = [];
  function getShared(key, fallback) { return Object.prototype.hasOwnProperty.call(shared, key) ? shared[key] : fallback; }
  function setShared(key, value) { writes[key] = JSON.parse(JSON.stringify(value)); }
  function loadOrderBasisPreference() { calls.push('basis:load'); }
  function applyOrderBasis() { allOrders = allShipOrders; calls.push('basis:apply'); }
  function applyPlannedSalesTarget() { calls.push('target:apply'); }
  function mergeClientsWithSeed() { calls.push('clients:merge'); }
  function updateBadge() { calls.push('badge:entries'); }
  function updateRevisitBadge() { calls.push('badge:revisits'); }
  function updateClientBadge() { calls.push('badge:clients'); }
  function updateTopbarNotice() { calls.push('notice:update'); }
  function renderAlertBadge() { calls.push('badge:alerts'); }
  function currentPageName() { return 'sales'; }
  function renderPageByName(name) { calls.push('render:' + name); }
`, context);

vm.runInContext(source, context);
vm.runInContext('loadAndRender()', context);
const result = vm.runInContext(`({
  allEntries, allUsers, allRevisits, allShipOrders, allOrderOrders, targets, calls, writes
})`, context);

assert.deepStrictEqual(JSON.parse(JSON.stringify(result.allUsers)), [{ id: 'lee1', name: '이기현' }]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.allEntries)), [{ id: 20, personId: 'lee1' }]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.allRevisits)), [{ id: 2, personId: 'lee1' }]);
assert.strictEqual(result.allShipOrders[0].id, 'ship');
assert.strictEqual(result.allOrderOrders[0].id, 'order');
assert.strictEqual(result.targets.salesTarget, 10);
assert.ok(result.calls.includes('render:sales'));
assert.ok(result.calls.includes('clients:merge'));
assert.ok(result.writes['sj-users-v6']);
assert.ok(result.writes['sj-entries-v4']);
assert.ok(result.writes['sj-revisits']);

console.log('PASS: shared data hydration, legacy migration, ERP selection, active-page refresh');
