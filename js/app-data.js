// Shared application data hydration and active-page refresh orchestration.
// Feature renderers should not read storage directly during bootstrap.

const APP_LEGACY_USER_ID_MAP = Object.freeze({ Lee1: 'lee1', Lee2: 'lee2' });
const APP_LEGACY_ENTRY_IDS = new Set([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);

function appLoadSharedCollections() {
  allEntries = getShared('sj-entries-v4', []);
  allUsers = getShared('sj-users-v6', []);
  targets = getShared('sj-targets-v4', {});
  allNotices = getShared('sj-notices', []);
  allRevisits = getShared('sj-revisits', []);
  allClients = getShared('sj-clients', []);
}

function appLoadErpCollections() {
  const remote = window.__erpRemoteData;
  allShipOrders = remote?.ship || getShared('sj-orders-ship', getShared('sj-orders', []));
  allOrderOrders = remote?.order || getShared('sj-orders-order', []);
  loadOrderBasisPreference();
  applyOrderBasis();
}

function appNormalizeLegacyUserIds() {
  let changed = false;
  allUsers = allUsers.map(user => {
    const id = APP_LEGACY_USER_ID_MAP[user.id];
    if (!id) return user;
    changed = true;
    return { ...user, id };
  });

  if (allUsers.length === 0) {
    allUsers = DEFAULT_USERS;
    setShared('sj-users-v6', allUsers);
    return;
  }
  if (!changed) return;

  allEntries = allEntries.map(entry => {
    const personId = APP_LEGACY_USER_ID_MAP[entry.personId];
    return personId ? { ...entry, personId } : entry;
  });
  allRevisits = allRevisits.map(revisit => {
    const personId = APP_LEGACY_USER_ID_MAP[revisit.personId];
    return personId ? { ...revisit, personId } : revisit;
  });
  setShared('sj-users-v6', allUsers);
  setShared('sj-entries-v4', allEntries);
  setShared('sj-revisits', allRevisits);
}

function appRemoveLegacySeedEntries() {
  const entries = allEntries.filter(entry => !APP_LEGACY_ENTRY_IDS.has(Number(entry.id)));
  if (entries.length === allEntries.length) return;
  allEntries = entries;
  setShared('sj-entries-v4', allEntries);
}

function appRefreshGlobalIndicators() {
  mergeClientsWithSeed();
  updateBadge();
  updateRevisitBadge();
  updateClientBadge();
  updateTopbarNotice();
  if (typeof renderAlertBadge === 'function') renderAlertBadge();
}

function appRefreshActivePage() {
  const activeName = typeof currentPageName === 'function'
    ? currentPageName()
    : document.querySelector('.page.active')?.id?.replace(/^page-/, '');
  if (activeName && typeof renderPageByName === 'function') renderPageByName(activeName);
}

function loadAndRender() {
  appLoadSharedCollections();
  appLoadErpCollections();
  if (typeof applyPlannedSalesTarget === 'function') applyPlannedSalesTarget();
  appNormalizeLegacyUserIds();
  appRemoveLegacySeedEntries();
  appRefreshGlobalIndicators();
  appRefreshActivePage();
}
