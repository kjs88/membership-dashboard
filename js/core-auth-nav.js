const CURRENT_USER_STORAGE_KEY = 'sj-current-user';

function clearCurrentUserStorage() {
  try { sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY); } catch (err) { console.error('[auth:clearSession]', err); }
  try { localStorage.removeItem(CURRENT_USER_STORAGE_KEY); } catch (err) { console.error('[auth:clearLocal]', err); }
}

function loadStoredCurrentUser() {
  let saved = '';
  let fromPersistentStorage = false;
  try { saved = sessionStorage.getItem(CURRENT_USER_STORAGE_KEY) || ''; }
  catch (err) { console.error('[auth:getSession]', err); }
  if (!saved) {
    try {
      saved = localStorage.getItem(CURRENT_USER_STORAGE_KEY) || '';
      fromPersistentStorage = !!saved;
    } catch (err) {
      console.error('[auth:getLocal]', err);
    }
  }
  if (!saved) return null;
  try {
    const storedUser = JSON.parse(saved);
    const user = allUsers.find(u => u.id === storedUser?.id);
    if (!user) {
      clearCurrentUserStorage();
      return null;
    }
    if (fromPersistentStorage) {
      sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify({ id: user.id }));
    }
    return user;
  } catch (err) {
    console.error('[auth:parseStoredUser]', err);
    clearCurrentUserStorage();
    return null;
  }
}

function saveCurrentUser(user, rememberLogin) {
  const storedUser = JSON.stringify({ id: user.id });
  try { sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, storedUser); }
  catch (err) { console.error('[auth:setSession]', err); }
  try {
    if (rememberLogin) localStorage.setItem(CURRENT_USER_STORAGE_KEY, storedUser);
    else localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  } catch (err) {
    console.error('[auth:setLocal]', err);
  }
}

async function checkFbConfig() {
  await syncFromFirebase();
  ensureUsers();
  currentUser = loadStoredCurrentUser();
  if (currentUser) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    initUI();
    mergeClientsWithSeed(); updateClientBadge();
    setupRealtimeListeners();
    loadAndRender();
    if (typeof erpRefreshFromRemote === 'function') erpRefreshFromRemote({ silent: true }).then(() => loadAndRender());
  } else {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('app-screen').style.display = 'none';
  }
}

// setShared / getShared / setPlainStorage / setupRealtimeListeners / updateFbStatus
// → storage.js에 정의됨 (Firebase 동기화 포함)

// ════════════════════════════════════
// ORDER BASIS (주문/출고 기준 전환)
// ════════════════════════════════════
const ORDER_BASIS_META = {
  order: { label: '주문기준', action: '주문', dateLabel: '주문일', qtyLabel: '주문 수량', qtyShort: '주문수량', storageKey: 'sj-orders-order' },
  ship:  { label: '출고기준', action: '출고', dateLabel: '출고일', qtyLabel: '출고 수량', qtyShort: '출고수량', storageKey: 'sj-orders-ship' }
};

function getOrderBasisMeta(basis = orderBasis) {
  return ORDER_BASIS_META[basis] || ORDER_BASIS_META.ship;
}

function loadOrderBasisPreference() {
  const savedBasis = localStorage.getItem('sj-order-basis');
  orderBasis = ORDER_BASIS_META[savedBasis] ? savedBasis : 'ship';
  setPlainStorage('sj-order-basis', orderBasis);
}

function applyOrderBasis() {
  allOrders = orderBasis === 'order' ? allOrderOrders : allShipOrders;
  updateOrderBasisUI();
}

function updateOrderBasisUI() {
  document.getElementById('basis-order-btn')?.classList.toggle('active', orderBasis === 'order');
  document.getElementById('basis-ship-btn')?.classList.toggle('active', orderBasis === 'ship');
  const meta = getOrderBasisMeta();
  const qtyTitle = document.getElementById('stats-daily-qty-title');
  if (qtyTitle) qtyTitle.textContent = `일별 ${meta.qtyLabel}`;
  const prodQtyLabel = document.getElementById('prod-sum-qty-label');
  if (prodQtyLabel) prodQtyLabel.textContent = `총 ${meta.qtyShort}`;
  const prodQtyHeaderLabel = document.getElementById('prod-qty-header-label');
  if (prodQtyHeaderLabel) prodQtyHeaderLabel.textContent = meta.qtyShort;
  const gradeHeader = document.getElementById('grade-sales-header');
  if (gradeHeader && !gradeHeader.textContent.includes('~')) gradeHeader.textContent = `${meta.label} 매출(원)`;
}

function rerenderOrderBasisPages() {
  const catSel = document.getElementById('prod-filter-category');
  if (catSel) catSel.innerHTML = '<option value="all">전체</option>';
  const active = document.querySelector('.page.active');
  if (!active) return;
  const id = active.id;
  if (id === 'page-sales' || id === 'page-dash') renderDashboard();
  if (id === 'page-stats') renderStats();
  if (id === 'page-products') renderProducts();
  if (id === 'page-grade') renderGrade();
}

function setOrderBasis(basis) {
  if (!ORDER_BASIS_META[basis] || basis === orderBasis) return;
  orderBasis = basis;
  setPlainStorage('sj-order-basis', basis);
  applyOrderBasis();
  rerenderOrderBasisPages();
}

// ════════════════════════════════════
// INIT DATA
// ════════════════════════════════════
const DEFAULT_USERS = [
  { id:'admin', name:'관리자', password:'1234', color:'#009E6A', createdAt:'2026-01-01' },
  { id:'lee1',  name:'이기현', password:'1234',  color:'#7856C8', createdAt:'2026-01-02' },
  { id:'jang1', name:'장재순', password:'1234',  color:'#E53935', createdAt:'2026-01-03' },
  { id:'lee2',  name:'이민우', password:'1234',  color:'#2B72C8', createdAt:'2026-01-04' },
  { id:'ahn1',  name:'안성종', password:'1234',  color:'#43A047', createdAt:'2026-01-05' },
];
const SEED_ENTRIES = [];

const MENU_ACCESS_ITEMS = [
  { key:'sales',   label:'대시보드',     page:'sales',   nav:'nav-sales' },
  { key:'stats',   label:'실적 분석',    page:'stats',   nav:'nav-stats' },
  { key:'products',label:'품목별 분석',  page:'products',nav:'nav-products' },
  { key:'project', label:'프로젝트 관리',page:'project', nav:'nav-project' },
  { key:'dash',    label:'영업현황',     page:'dash',    nav:'nav-dash' },
  { key:'journal', label:'영업 일지',    page:'input',   nav:'nav-journal-group', labelId:'nav-journal-label' },
  { key:'grade',   label:'거래처 등급',  page:'grade',   nav:'nav-grade' },
  { key:'clients', label:'거래처 DB',    page:'clients', nav:'nav-clients' },
  { key:'users',   label:'계정 관리',    page:'users',   nav:'nav-users' },
  { key:'targets', label:'목표 설정',    page:'targets', nav:'nav-targets' },
  { key:'erp',     label:'ERP API 연동', page:null,      nav:'nav-erp-upload' },
];

const MENU_ACCESS_DEFAULTS = {
  admin:   MENU_ACCESS_ITEMS.map(m => m.key),
  manager: ['sales','stats','products','project','dash','grade','clients'],
  planner: ['sales','stats','products','project','dash','grade','clients','targets','erp'],
  user:    ['sales','stats','products','project','dash','journal'],
};

function getDefaultMenuAccess(profile = 'user') {
  return [...(MENU_ACCESS_DEFAULTS[profile] || MENU_ACCESS_DEFAULTS.user)];
}

function normalizeMenuAccess(menuAccess, profile = 'user') {
  const valid = new Set(MENU_ACCESS_ITEMS.map(m => m.key));
  const source = Array.isArray(menuAccess) ? menuAccess : getDefaultMenuAccess(profile);
  return [...new Set(source.filter(key => valid.has(key)))];
}

function getLegacyMenuProfile(user) {
  if (!user) return 'user';
  return user['role'] || (user.id === 'admin' ? 'admin' : 'user');
}

function stripLegacyRole(user) {
  const copy = { ...user };
  delete copy['role'];
  return copy;
}

function getUserMenuAccess(user = currentUser) {
  if (!user) return [];
  if (user.id === 'admin') return getDefaultMenuAccess('admin');
  return normalizeMenuAccess(user.menuAccess, getLegacyMenuProfile(user));
}

function isAdminUser(user = currentUser) {
  if (!user) return false;
  return user.id === 'admin' || getUserMenuAccess(user).includes('users');
}

function isSalesUserAccount(user) {
  if (!user || isAdminUser(user)) return false;
  return getUserMenuAccess(user).includes('journal');
}

function userCanAccessMenu(key, user = currentUser) {
  return getUserMenuAccess(user).includes(key);
}

function menuKeyForPage(pageName) {
  if (['input','weekly','mo-plan','mo-settle'].includes(pageName)) return 'journal';
  const item = MENU_ACCESS_ITEMS.find(m => m.page === pageName);
  return item ? item.key : null;
}

function userCanOpenPage(pageName, user = currentUser) {
  const key = menuKeyForPage(pageName);
  return !key || userCanAccessMenu(key, user);
}

// ════════════════════════════════════
// AUTH
// ════════════════════════════════════
async function doLogin() {
  const uid = document.getElementById('li-id').value.trim();
  const pw  = document.getElementById('li-pw').value;
  if (!uid || !pw) return;
  await syncFromFirebase();
  ensureUsers();
  if (allUsers.length === 0) allUsers = DEFAULT_USERS;
  const user = allUsers.find(u => u.id === uid && u.password === pw);
  if (!user) {
    const pending = getShared('sj-signup-pending-v1', []);
    const isPending = pending.find(p => p.id === uid);
    const err = document.getElementById('login-err');
    err.textContent = isPending
      ? '관리자 승인 대기 중인 계정입니다.'
      : '아이디 또는 비밀번호가 올바르지 않습니다.';
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
    return;
  }
  currentUser = user;
  saveCurrentUser(user, document.getElementById('li-remember')?.checked);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  initUI();
  mergeClientsWithSeed(); updateClientBadge();
  setupRealtimeListeners();
  loadAndRender();
  if (typeof erpRefreshFromRemote === 'function') erpRefreshFromRemote({ silent: true }).then(() => loadAndRender());
}

function doLogout() {
  currentUser = null;
  clearCurrentUserStorage();
  const badge = document.getElementById('fb-status-badge');
  if (badge) badge.style.display = 'none';
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('li-id').value = '';
  document.getElementById('li-pw').value = '';
  const remember = document.getElementById('li-remember');
  if (remember) remember.checked = false;
}

function ensureUsers() {
  allUsers = getShared('sj-users-v6', []);
  const hasStale = allUsers.some(u => u.id === 'kim') || allUsers.some(u => u.id === 'ahn');
  if (allUsers.length === 0 || hasStale) {
    allUsers = DEFAULT_USERS.map(d => {
      const existing = allUsers.find(u => u.id === d.id);
      return existing
        ? stripLegacyRole({ ...d, password: existing.password, menuAccess: normalizeMenuAccess(existing.menuAccess, getLegacyMenuProfile(existing)) })
        : { ...d, menuAccess: getDefaultMenuAccess(d.id === 'admin' ? 'admin' : 'user') };
    });
  } else {
    allUsers = allUsers.map(u => {
      const def = DEFAULT_USERS.find(d => d.id === u.id);
      const merged = def ? { ...u, color: def.color } : u;
      return stripLegacyRole({ ...merged, menuAccess: normalizeMenuAccess(merged.menuAccess, getLegacyMenuProfile(merged)) });
    });
  }
  setShared('sj-users-v6', allUsers);
}

function setNavDisplay(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

function applyCurrentUserMenuAccess() {
  const u = currentUser;
  if (!u) return;
  const can = key => userCanAccessMenu(key, u);

  MENU_ACCESS_ITEMS.forEach(item => {
    if (item.nav) setNavDisplay(item.nav, can(item.key));
    if (item.labelId) setNavDisplay(item.labelId, can(item.key));
  });

  const clientsVisible = can('grade') || can('clients');
  const adminVisible = can('users') || can('targets') || can('erp');
  setNavDisplay('nav-clients-label', clientsVisible);
  setNavDisplay('nav-project-label', can('project'));
  setNavDisplay('nav-admin-label', adminVisible);

  const active = document.querySelector('.page.active');
  const activeName = active?.id?.replace(/^page-/, '');
  if (activeName && !userCanOpenPage(activeName, u)) {
    const next = MENU_ACCESS_ITEMS.find(item => item.page && can(item.key));
    if (next?.page) showPage(next.page);
  }
}

function initUI() {
  const u = currentUser;
  if (!u) return;
  const initials = (u.name || '').slice(0, 1);
  const avatar = document.getElementById('sb-avatar');
  if (avatar) {
    avatar.textContent = initials;
    avatar.style.cssText = `background:${u.color}22;color:${u.color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;`;
  }
  const nameEl = document.getElementById('sb-name');
  if (nameEl) nameEl.textContent = u.name || '';
  if (isAdminUser(u)) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  } else {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  applyCurrentUserMenuAccess();
  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
  setTimeout(()=>{ if(getShared('sj-draft-'+currentUser?.id, null)) loadDraft(); }, 500);
  initDatePickers();
  if (typeof erpStartAutoSync === 'function') erpStartAutoSync();
}

// ════════════════════════════════════
// NAV
// ════════════════════════════════════
const PAGE_TITLES = {
  sales:'대시보드', dash:'영업현황', input:'일간일지', weekly:'주간일지',
  'mo-plan':'영업계획', 'mo-settle':'월간결산', records:'방문 기록',
  users:'계정 관리', targets:'목표 설정', stats:'실적 분석', revisit:'재방문 관리',
  notice:'공지사항', 'notice-view':'공지사항', clients:'거래처 관리',
  products:'품목별 분석', project:'프로젝트 관리', grade:'거래처 등급'
};

const PAGE_RENDERERS = {
  records: () => renderRecords(),
  sales: () => renderDashboard(),
  dash: () => renderDashboard(),
  users: () => { renderUsers(); renderPendingSignups(); },
  targets: () => renderTargets(),
  stats: () => renderStats(),
  revisit: () => renderRevisit(),
  notice: () => renderNoticeManage(),
  clients: () => { if (allClients.length === 0) mergeClientsWithSeed(); renderClients(); },
  products: () => renderProducts(),
  grade: () => { renderGradeSettings(); gradeSetPeriod('all'); },
  input: () => dlyInit(),
  weekly: () => wkInit(),
  'mo-plan': () => moPlanInit(),
  'mo-settle': () => moSettleInit()
};

function renderPageByName(name) {
  const renderer = PAGE_RENDERERS[name];
  if (renderer) renderer();
}

function showPage(name, el) {
  if (currentUser && !userCanOpenPage(name, currentUser)) {
    if (typeof showToast === 'function') showToast('접근 권한이 없는 메뉴입니다.', 'error');
    return;
  }
  const page = document.getElementById('page-' + name);
  if (!page) {
    console.warn('[showPage] missing page:', name);
    if (typeof showToast === 'function') showToast('화면을 찾을 수 없습니다.', 'error');
    return;
  }
  closeMobMenu();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  page.classList.add('active');
  const navEl = el || document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[name] || name;
  try {
    renderPageByName(name);
  } catch (err) {
    console.error('[showPage:render]', name, err);
    if (typeof showToast === 'function') showToast('화면을 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

function toggleNavGroup(el) {
  el.classList.toggle('open');
  const sub = el.nextElementSibling;
  if (sub) sub.classList.toggle('open');
}

// ════════════════════════════════════
