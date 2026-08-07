const CURRENT_USER_STORAGE_KEY = 'sj-current-user';
const AUTH_SESSION_MAX_MS = 14 * 60 * 60 * 1000;
const AUTH_REMEMBER_MAX_MS = 7 * 24 * 60 * 60 * 1000;

function clearCurrentUserStorage() {
  try { sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY); } catch (err) { console.error('[auth:clearSession]', err); }
  try { localStorage.removeItem(CURRENT_USER_STORAGE_KEY); } catch (err) { console.error('[auth:clearLocal]', err); }
}

function buildStoredCurrentUser(user, ttlMs) {
  const now = Date.now();
  return { id: user.id, issuedAt: now, expiresAt: now + ttlMs };
}

function isStoredCurrentUserExpired(storedUser) {
  return !!(storedUser?.expiresAt && Date.now() > storedUser.expiresAt);
}

function loadStoredCurrentUser() {
  let saved = '';
  let fromPersistentStorage = false;
  try { saved = sessionStorage.getItem(CURRENT_USER_STORAGE_KEY) || ''; }
  catch (err) { console.error('[auth:getSession]', err); }
  if (saved) {
    try {
      const sessionUser = JSON.parse(saved);
      if (isStoredCurrentUserExpired(sessionUser)) {
        sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        saved = '';
      }
    } catch (_) {
      sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      saved = '';
    }
  }
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
    if (isStoredCurrentUserExpired(storedUser)) {
      clearCurrentUserStorage();
      return null;
    }
    const user = allUsers.find(u => u.id === storedUser?.id);
    if (!user) {
      clearCurrentUserStorage();
      return null;
    }
    if (fromPersistentStorage) {
      sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(buildStoredCurrentUser(user, AUTH_SESSION_MAX_MS)));
    } else if (!storedUser.expiresAt) {
      sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(buildStoredCurrentUser(user, AUTH_SESSION_MAX_MS)));
    }
    return user;
  } catch (err) {
    console.error('[auth:parseStoredUser]', err);
    clearCurrentUserStorage();
    return null;
  }
}

function saveCurrentUser(user, rememberLogin) {
  const sessionUser = JSON.stringify(buildStoredCurrentUser(user, AUTH_SESSION_MAX_MS));
  const persistentUser = JSON.stringify(buildStoredCurrentUser(user, AUTH_REMEMBER_MAX_MS));
  try { sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, sessionUser); }
  catch (err) { console.error('[auth:setSession]', err); }
  try {
    if (rememberLogin) localStorage.setItem(CURRENT_USER_STORAGE_KEY, persistentUser);
    else localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  } catch (err) {
    console.error('[auth:setLocal]', err);
  }
}

async function checkFbConfig() {
  await syncAuthFromFirebase();
  ensureUsers({ persist: false });
  currentUser = loadStoredCurrentUser();
  if (currentUser) {
    await syncFromFirebase();
    ensureUsers();
    currentUser = allUsers.find(u => u.id === currentUser.id) || currentUser;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    initUI();
    mergeClientsWithSeed(); updateClientBadge();
    setupRealtimeListeners();
    loadAndRender();
    applyInitialDashboardRoute();
    if (typeof erpRefreshFromRemote === 'function') erpRefreshFromRemote({ silent: true }).then(() => loadAndRender());
  } else {
    if (typeof clearSensitiveLocalCache === 'function') clearSensitiveLocalCache({ keepAuth: true });
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
  { id:'admin', name:'관리자', passwordHash:'pbkdf2-sha256$160000$eE00Yw5Qt51oyvfD09dPbg==$ETO1qIAKoNqbzXyxet/uzgv0geCVSI6POkLRNjnpHog=', color:'#009E6A', createdAt:'2026-01-01' },
  { id:'lee1',  name:'이기현', passwordHash:'pbkdf2-sha256$160000$NsXoyROEcQ2+WNd7+2+nfw==$6XItrKK4gpEmlIszSkNwjhPaS7KssNqui+2NhrdVozY=',  color:'#7856C8', createdAt:'2026-01-02' },
  { id:'jang1', name:'장재순', passwordHash:'pbkdf2-sha256$160000$oOTZXxlEZAihtsi4t2LY0A==$puMCD3Xxr6qwJ7vZ5e6thr3YtEadT4nbTm6ZtGWBvSk=',  color:'#E53935', createdAt:'2026-01-03' },
  { id:'lee2',  name:'이민우', passwordHash:'pbkdf2-sha256$160000$Dfbp/PRmz5XdQlYunDYd3g==$Hjdxo4yTIwPyr3ZQjQzZJAOHdAtm4gfHGpdOYaQHvYQ=',  color:'#2B72C8', createdAt:'2026-01-04' },
  { id:'ahn1',  name:'안성종', passwordHash:'pbkdf2-sha256$160000$P/VPede99zuWprWtDH8D/g==$tVTeXJXQ081omqseRbVYDflxqKgBMNs1/jqBi1cg+mI=',  color:'#43A047', createdAt:'2026-01-05' },
];
const SEED_ENTRIES = [];

const MENU_ACCESS_ITEMS = [
  { key:'sales',   label:'대시보드',     page:'sales',   nav:'nav-sales' },
  { key:'stats',   label:'실적 분석',    page:'stats',   nav:'nav-stats-group' },
  { key:'products',label:'품목별 분석',  page:'products',nav:'nav-products' },
  { key:'project', label:'프로젝트 관리',page:'project', nav:'nav-project' },
  { key:'dash',    label:'영업현황',     page:'dash',    nav:'nav-dash' },
  { key:'journal', label:'영업 일지',    page:'input',   nav:'nav-journal-group', labelId:'nav-journal-label' },
  { key:'grade',   label:'거래처 등급',  page:'grade',   nav:'nav-grade' },
  { key:'clients', label:'거래처 DB',    page:'clients', nav:'nav-clients' },
  { key:'users',   label:'계정 관리',    page:'users',   nav:'nav-users' },
  { key:'targets', label:'목표 설정',    page:'targets', nav:'nav-targets' },
];

const MENU_ACCESS_DEFAULTS = {
  admin:   MENU_ACCESS_ITEMS.map(m => m.key),
  manager: ['sales','stats','products','project','dash','journal','grade','clients'],
  planner: ['sales','stats','products','project','dash','journal','grade','clients','targets'],
  user:    ['sales','stats','products','project','dash','journal'],
};
const ALWAYS_VISIBLE_MENU_KEYS = ['journal'];

const MENU_ACCESS_ALIASES = {
  input: 'journal',
  weekly: 'journal',
  'mo-plan': 'journal',
  'mo-settle': 'journal',
  records: 'journal',
  board: 'journal',
  bulletin: 'journal',
  journals: 'journal',
};

function getDefaultMenuAccess(profile = 'user') {
  return [...(MENU_ACCESS_DEFAULTS[profile] || MENU_ACCESS_DEFAULTS.user)];
}

function normalizeMenuAccess(menuAccess, profile = 'user') {
  const valid = new Set(MENU_ACCESS_ITEMS.map(m => m.key));
  const source = Array.isArray(menuAccess) ? menuAccess : getDefaultMenuAccess(profile);
  return [...new Set(source
    .map(key => MENU_ACCESS_ALIASES[key] || key)
    .filter(key => valid.has(key)))];
}

function getLegacyMenuProfile(user) {
  if (!user) return 'user';
  return user['role'] || (user.id === 'admin' ? 'admin' : 'user');
}

function stripLegacyRole(user) {
  const copy = { ...user };
  delete copy['role'];
  return typeof securityNormalizeCredentialRecord === 'function' ? securityNormalizeCredentialRecord(copy) : copy;
}

function getUserMenuAccess(user = currentUser) {
  if (!user) return [];
  if (user.id === 'admin') return getDefaultMenuAccess('admin');
  return normalizeMenuAccess(user.menuAccess, getLegacyMenuProfile(user));
}

function isAlwaysVisibleMenuKey(key) {
  return ALWAYS_VISIBLE_MENU_KEYS.includes(key);
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
  if (!user) return false;
  if (isAlwaysVisibleMenuKey(key)) return true;
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
  const throttle = typeof authGetLoginThrottle === 'function'
    ? authGetLoginThrottle(uid)
    : { locked: false, waitMs: 0 };
  if (throttle.locked) {
    const err = document.getElementById('login-err');
    const seconds = Math.max(1, Math.ceil(throttle.waitMs / 1000));
    err.textContent = `로그인 시도가 잠시 제한되었습니다. ${Math.ceil(seconds / 60)}분 후 다시 시도하세요.`;
    err.style.display = 'block';
    return;
  }
  await syncAuthFromFirebase();
  ensureUsers({ persist: false });
  if (allUsers.length === 0) allUsers = DEFAULT_USERS;
  const user = allUsers.find(u => u.id === uid);
  const loginOk = user ? await authVerifyPassword(user, pw) : false;
  if (!loginOk) {
    const nextThrottle = typeof authRecordLoginFailure === 'function'
      ? authRecordLoginFailure(uid)
      : { locked: false };
    const pending = getShared('sj-signup-pending-v1', []);
    const isPending = pending.find(p => p.id === uid);
    const err = document.getElementById('login-err');
    err.textContent = nextThrottle.locked
      ? '로그인 실패가 반복되어 5분간 제한됩니다.'
      : isPending
      ? '관리자 승인 대기 중인 계정입니다.'
      : '아이디 또는 비밀번호가 올바르지 않습니다.';
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 3000);
    return;
  }
  if (typeof authClearLoginThrottle === 'function') authClearLoginThrottle(uid);
  if (authHasLegacyPassword(user)) {
    currentUser = user;
    await authSetPassword(user, pw);
    setShared('sj-users-v6', allUsers);
  }
  await syncFromFirebase();
  ensureUsers();
  currentUser = allUsers.find(u => u.id === uid) || user;
  recordLoginEvent(currentUser);
  saveCurrentUser(currentUser, document.getElementById('li-remember')?.checked);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  initUI();
  mergeClientsWithSeed(); updateClientBadge();
  setupRealtimeListeners();
  loadAndRender();
  applyInitialDashboardRoute();
  if (typeof erpRefreshFromRemote === 'function') erpRefreshFromRemote({ silent: true }).then(() => loadAndRender());
}

// 접속기록: 로그인 성공 시 1건 기록 (공유 저장 → 계정관리에서 조회)
const LOGIN_LOG_KEY = 'sj-login-logs-v1';
const LOGIN_LOG_MAX = 1000;
function loginDeviceLabel() {
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser/i.test(ua) ? '삼성브라우저'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox' : '기타';
  return (isMobile ? '📱 모바일' : '💻 PC') + ' · ' + browser;
}
// 접속 IP 조회. 정적 호스팅이라 서버가 없어 외부 echo 서비스를 사용한다.
// 실패/지연 시 IP 없이 기록하도록 3초 타임아웃 후 빈 문자열 반환.
async function fetchClientIp() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return '';
    const data = await res.json();
    const ip = typeof data?.ip === 'string' ? data.ip.trim() : '';
    return /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : '';
  } catch (_) {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

// IP 조회를 기다렸다가 기록하므로 호출부에서 await하지 않는다(로그인 지연 방지).
async function recordLoginEvent(user) {
  if (!user) return;
  const ip = await fetchClientIp();
  try {
    const logs = getShared(LOGIN_LOG_KEY, []);
    const list = Array.isArray(logs) ? logs : [];
    list.unshift({
      id: user.id,
      name: user.name || user.id,
      at: new Date().toISOString(),
      device: loginDeviceLabel(),
      ip,
    });
    setShared(LOGIN_LOG_KEY, list.slice(0, LOGIN_LOG_MAX));
  } catch (e) { console.warn('[recordLoginEvent]', e); }
}

function doLogout() {
  currentUser = null;
  clearCurrentUserStorage();
  if (typeof clearSensitiveLocalCache === 'function') clearSensitiveLocalCache();
  const badge = document.getElementById('fb-status-badge');
  if (badge) badge.style.display = 'none';
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('li-id').value = '';
  document.getElementById('li-pw').value = '';
  const remember = document.getElementById('li-remember');
  if (remember) remember.checked = false;
}

function ensureUsers(options = {}) {
  const shouldPersist = options.persist !== false;
  allUsers = getShared('sj-users-v6', []);
  const hasStale = allUsers.some(u => u.id === 'kim') || allUsers.some(u => u.id === 'ahn');
  if (allUsers.length === 0 || hasStale) {
    allUsers = DEFAULT_USERS.map(d => {
      const existing = allUsers.find(u => u.id === d.id);
      return existing
        ? stripLegacyRole({
            ...d,
            passwordHash: existing.passwordHash || d.passwordHash,
            password: existing.password,
            menuAccess: normalizeMenuAccess(existing.menuAccess, getLegacyMenuProfile(existing)),
          })
        : { ...d, menuAccess: getDefaultMenuAccess(d.id === 'admin' ? 'admin' : 'user') };
    });
  } else {
    allUsers = allUsers.map(u => {
      const def = DEFAULT_USERS.find(d => d.id === u.id);
      const merged = def ? { ...u, color: def.color } : u;
      return stripLegacyRole({ ...merged, menuAccess: normalizeMenuAccess(merged.menuAccess, getLegacyMenuProfile(merged)) });
    });
  }
  if (shouldPersist) setShared('sj-users-v6', allUsers);
  else setPlainStorage('sj-users-v6', JSON.stringify(allUsers));
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
  const adminVisible = can('users') || can('targets');
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
  initDashboardHistory();
  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = todayYmd();
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

const PAGE_TAB_STORAGE_PREFIX = 'sj-open-page-tabs-v1';
const PAGE_TAB_MAX = 20;
let openPageTabs = [];
let dashboardHistoryReady = false;
let pageTabDragState = { route: '', moved: false, suppressClick: false, ghost: null, ghostWidth: 0, ghostHeight: 0 };

function dashboardTabStorageKey() {
  return `${PAGE_TAB_STORAGE_PREFIX}:${currentUser?.id || 'guest'}`;
}

function clearSavedOpenPageTabs() {
  try {
    const currentKey = dashboardTabStorageKey();
    localStorage.removeItem(currentKey);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PAGE_TAB_STORAGE_PREFIX + ':')) localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[page-tabs:clearSaved]', err);
  }
}

function currentPageName() {
  return document.querySelector('.page.active')?.id?.replace(/^page-/, '') || '';
}

function pageRouteForName(name) {
  if (name === 'stats') return statsChannel === 'dist' ? 'stats-dist' : 'stats-office';
  return name || 'sales';
}

function pageRouteToState(route) {
  const clean = String(route || '').replace(/^#/, '').trim();
  if (clean === 'stats-dist') {
    return { route: 'stats-dist', page: 'stats', channel: 'dist', label: '유통사 분석', navId: 'nav-stats-dist' };
  }
  if (clean === 'stats-office' || clean === 'stats') {
    return { route: 'stats-office', page: 'stats', channel: 'office', label: '사업소 분석', navId: 'nav-stats-office' };
  }
  const page = clean || 'sales';
  if (!document.getElementById('page-' + page)) {
    return { route: 'sales', page: 'sales', label: PAGE_TITLES.sales || '대시보드', navId: 'nav-sales' };
  }
  return { route: page, page, label: PAGE_TITLES[page] || page, navId: 'nav-' + page };
}

function normalizeDashboardRoute(route) {
  try {
    return pageRouteToState(decodeURIComponent(String(route || ''))).route;
  } catch (_) {
    return pageRouteToState(route).route;
  }
}

function routeFromHash() {
  const raw = String(location.hash || '').replace(/^#/, '');
  if (!raw) return '';
  try { return normalizeDashboardRoute(decodeURIComponent(raw)); }
  catch (_) { return normalizeDashboardRoute(raw); }
}

function userCanOpenRoute(route, user = currentUser) {
  const state = pageRouteToState(route);
  return userCanOpenPage(state.page, user);
}

function fallbackDashboardRoute() {
  const item = MENU_ACCESS_ITEMS.find(m => m.page && userCanAccessMenu(m.key, currentUser));
  if (item?.page === 'stats') return 'stats-office';
  return item?.page || 'sales';
}

function navElForRoute(route) {
  const state = pageRouteToState(route);
  return document.getElementById(state.navId) || document.getElementById('nav-' + state.page);
}

function loadOpenPageTabs() {
  clearSavedOpenPageTabs();
  openPageTabs = [fallbackDashboardRoute()];
}

function saveOpenPageTabs() {
  clearSavedOpenPageTabs();
}

function clearPageTabDragStyles() {
  document.querySelectorAll('.page-tab.dragging,.page-tab.drag-over-before,.page-tab.drag-over-after').forEach(tab => {
    tab.classList.remove('dragging', 'drag-over-before', 'drag-over-after');
  });
  document.getElementById('page-tabbar')?.classList.remove('drag-active');
}

function clearPageTabDropMarkers() {
  document.querySelectorAll('.page-tab.drag-over-before,.page-tab.drag-over-after').forEach(tab => {
    tab.classList.remove('drag-over-before', 'drag-over-after');
  });
}

function removePageTabDragGhost() {
  if (pageTabDragState.ghost) pageTabDragState.ghost.remove();
  pageTabDragState.ghost = null;
}

function setTransparentDragImage(event) {
  if (!event.dataTransfer) return;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  event.dataTransfer.setDragImage(canvas, 0, 0);
}

function updatePageTabDragGhost(event) {
  const ghost = pageTabDragState.ghost;
  const bar = document.getElementById('page-tabbar');
  if (!ghost || !bar) return;
  const barRect = bar.getBoundingClientRect();
  const w = pageTabDragState.ghostWidth || ghost.offsetWidth || 120;
  const h = pageTabDragState.ghostHeight || ghost.offsetHeight || 32;
  const rawX = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : barRect.left + (w / 2);
  const rawY = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : barRect.top + (h / 2);
  const leftMin = barRect.left;
  const leftMax = Math.max(leftMin, barRect.right - w);
  const topMin = barRect.top + 3;
  const topMax = Math.max(topMin, barRect.bottom - h - 1);
  const left = Math.min(Math.max(rawX - (w / 2), leftMin), leftMax);
  const top = Math.min(Math.max(rawY - (h / 2), topMin), topMax);
  ghost.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;
}

function createPageTabDragGhost(tab, event) {
  removePageTabDragGhost();
  const rect = tab.getBoundingClientRect();
  const ghost = tab.cloneNode(true);
  ghost.className = 'page-tab page-tab-drag-ghost' + (tab.classList.contains('active') ? ' active' : '');
  ghost.removeAttribute('id');
  ghost.removeAttribute('role');
  ghost.removeAttribute('tabindex');
  ghost.removeAttribute('draggable');
  ghost.querySelector('.page-tab-close')?.remove();
  ghost.style.width = `${Math.round(rect.width)}px`;
  ghost.style.height = `${Math.round(rect.height)}px`;
  document.body.appendChild(ghost);
  pageTabDragState.ghost = ghost;
  pageTabDragState.ghostWidth = rect.width;
  pageTabDragState.ghostHeight = rect.height;
  updatePageTabDragGhost(event);
}

function moveOpenPageTab(dragRoute, targetRoute, placeAfter) {
  const dragged = normalizeDashboardRoute(dragRoute);
  const target = normalizeDashboardRoute(targetRoute);
  if (!dragged || !target || dragged === target) return false;
  if (!openPageTabs.includes(dragged) || !openPageTabs.includes(target)) return false;

  const before = openPageTabs.join('\u0001');
  const next = openPageTabs.filter(route => route !== dragged);
  const targetIndex = next.indexOf(target);
  if (targetIndex < 0) return false;
  next.splice(targetIndex + (placeAfter ? 1 : 0), 0, dragged);
  const after = next.join('\u0001');
  if (before === after) return false;
  openPageTabs = next;
  saveOpenPageTabs();
  return true;
}

function getPageTabDropPlacement(event) {
  const bar = document.getElementById('page-tabbar');
  const dragged = pageTabDragState.route;
  if (!bar || !dragged) return null;
  const tabs = [...bar.querySelectorAll('.page-tab[data-route]')].filter(tab => tab.dataset.route !== dragged);
  if (tabs.length === 0) return null;
  const x = event.clientX || tabs[tabs.length - 1].getBoundingClientRect().right;
  for (const tab of tabs) {
    const rect = tab.getBoundingClientRect();
    if (x < rect.left + rect.width / 2) return { route: tab.dataset.route, placeAfter: false };
  }
  return { route: tabs[tabs.length - 1].dataset.route, placeAfter: true };
}

function showPageTabDropMarker(placement) {
  clearPageTabDropMarkers();
  if (!placement?.route) return;
  const target = [...document.querySelectorAll('.page-tab[data-route]')].find(tab => tab.dataset.route === placement.route);
  target?.classList.add(placement.placeAfter ? 'drag-over-after' : 'drag-over-before');
}

function dashboardTabDragStart(event, route) {
  if (event.target?.closest?.('.page-tab-close')) {
    event.preventDefault();
    return;
  }
  pageTabDragState = { route, moved: false, suppressClick: false, ghost: null, ghostWidth: 0, ghostHeight: 0 };
  event.currentTarget.classList.add('dragging');
  document.getElementById('page-tabbar')?.classList.add('drag-active');
  createPageTabDragGhost(event.currentTarget, event);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', route);
    setTransparentDragImage(event);
  }
}

function dashboardTabDragOver(event, route) {
  const dragged = pageTabDragState.route || event.dataTransfer?.getData('text/plain');
  if (!dragged || dragged === route) return;
  event.preventDefault();
  updatePageTabDragGhost(event);
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  const rect = event.currentTarget.getBoundingClientRect();
  const placeAfter = event.clientX > rect.left + rect.width / 2;
  clearPageTabDropMarkers();
  event.currentTarget.classList.add(placeAfter ? 'drag-over-after' : 'drag-over-before');
}

function dashboardTabDrop(event, route) {
  const dragged = pageTabDragState.route || event.dataTransfer?.getData('text/plain');
  if (!dragged) return;
  event.preventDefault();
  event.stopPropagation();
  updatePageTabDragGhost(event);
  const rect = event.currentTarget.getBoundingClientRect();
  const placeAfter = event.clientX > rect.left + rect.width / 2;
  const changed = moveOpenPageTab(dragged, route, placeAfter);
  pageTabDragState.moved = pageTabDragState.moved || changed;
  clearPageTabDragStyles();
  removePageTabDragGhost();
  renderOpenPageTabs(pageRouteForName(currentPageName()));
}

function dashboardTabBarDragOver(event) {
  if (!pageTabDragState.route) return;
  event.preventDefault();
  updatePageTabDragGhost(event);
  if (event.target?.closest?.('.page-tab')) return;
  showPageTabDropMarker(getPageTabDropPlacement(event));
}

function dashboardTabBarDrop(event) {
  if (!pageTabDragState.route || event.target?.closest?.('.page-tab')) return;
  event.preventDefault();
  updatePageTabDragGhost(event);
  const placement = getPageTabDropPlacement(event);
  const changed = placement ? moveOpenPageTab(pageTabDragState.route, placement.route, placement.placeAfter) : false;
  pageTabDragState.moved = pageTabDragState.moved || changed;
  clearPageTabDragStyles();
  removePageTabDragGhost();
  renderOpenPageTabs(pageRouteForName(currentPageName()));
}

function dashboardTabDragEnd() {
  const shouldSuppressClick = pageTabDragState.moved;
  clearPageTabDragStyles();
  removePageTabDragGhost();
  pageTabDragState = { route: '', moved: false, suppressClick: shouldSuppressClick, ghost: null, ghostWidth: 0, ghostHeight: 0 };
  if (shouldSuppressClick) {
    setTimeout(() => { pageTabDragState.suppressClick = false; }, 0);
  }
}

function ensureOpenPageTab(route) {
  const normalized = normalizeDashboardRoute(route);
  if (!userCanOpenRoute(normalized)) return normalized;
  if (!openPageTabs.includes(normalized)) {
    openPageTabs.push(normalized);
    if (openPageTabs.length > PAGE_TAB_MAX) openPageTabs.shift();
    saveOpenPageTabs();
  }
  return normalized;
}

function renderOpenPageTabs(activeRoute = pageRouteForName(currentPageName())) {
  const bar = document.getElementById('page-tabbar');
  if (!bar) return;
  const active = normalizeDashboardRoute(activeRoute || fallbackDashboardRoute());
  bar.ondragover = dashboardTabBarDragOver;
  bar.ondrop = dashboardTabBarDrop;
  bar.ondragleave = event => {
    if (!event.relatedTarget || !bar.contains(event.relatedTarget)) clearPageTabDropMarkers();
  };
  bar.innerHTML = '';
  openPageTabs.forEach(route => {
    const state = pageRouteToState(route);
    const tab = document.createElement('div');
    tab.className = 'page-tab' + (route === active ? ' active' : '');
    tab.setAttribute('role', 'button');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('draggable', 'true');
    tab.dataset.route = route;
    tab.title = state.label;

    const label = document.createElement('span');
    label.className = 'page-tab-label';
    label.textContent = state.label;
    tab.appendChild(label);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'page-tab-close';
    close.setAttribute('aria-label', `${state.label} 닫기`);
    close.textContent = '×';
    close.setAttribute('draggable', 'false');
    close.addEventListener('dragstart', event => event.preventDefault());
    close.addEventListener('click', event => dashboardCloseTab(event, route));
    tab.appendChild(close);

    tab.addEventListener('click', event => {
      if (pageTabDragState.suppressClick) {
        event.preventDefault();
        return;
      }
      dashboardGoTab(route);
    });
    tab.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      dashboardGoTab(route);
    });
    tab.addEventListener('dragstart', event => dashboardTabDragStart(event, route));
    tab.addEventListener('dragover', event => dashboardTabDragOver(event, route));
    tab.addEventListener('dragleave', () => tab.classList.remove('drag-over-before', 'drag-over-after'));
    tab.addEventListener('drop', event => dashboardTabDrop(event, route));
    tab.addEventListener('dragend', dashboardTabDragEnd);
    bar.appendChild(tab);
  });
}

function pushDashboardRoute(route, replace = false) {
  const normalized = normalizeDashboardRoute(route);
  const hash = '#' + encodeURIComponent(normalized);
  const url = `${location.pathname}${location.search}${hash}`;
  const state = { dashboardRoute: normalized };
  if (replace || location.hash === hash) history.replaceState(state, '', url);
  else history.pushState(state, '', url);
}

function activatePageRoute(route, options = {}) {
  let state = pageRouteToState(route || fallbackDashboardRoute());
  if (!userCanOpenPage(state.page, currentUser)) state = pageRouteToState(fallbackDashboardRoute());
  const activePage = currentPageName();
  const activeRoute = pageRouteForName(activePage);
  const routeChangedInsideSamePage = activePage === state.page && normalizeDashboardRoute(activeRoute) !== state.route;
  if (state.channel) statsChannel = state.channel;
  showPage(state.page, navElForRoute(state.route), {
    route: state.route,
    preserveState: options.preserveState === true && !routeChangedInsideSamePage,
    pushHistory: options.pushHistory !== false,
    replaceHistory: options.replaceHistory === true,
  });
}

function dashboardGoTab(route) {
  const state = pageRouteToState(route);
  const page = document.getElementById('page-' + state.page);
  activatePageRoute(route, { preserveState: page?.dataset.dashboardRendered === '1' });
}

function dashboardCloseTab(event, route) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const normalized = normalizeDashboardRoute(route);
  const active = pageRouteForName(currentPageName());
  const index = openPageTabs.indexOf(normalized);
  openPageTabs = openPageTabs.filter(r => r !== normalized);
  if (openPageTabs.length === 0) openPageTabs = [fallbackDashboardRoute()];
  saveOpenPageTabs();
  if (normalized === active) {
    const nextRoute = openPageTabs[Math.min(Math.max(index, 0), openPageTabs.length - 1)] || fallbackDashboardRoute();
    activatePageRoute(nextRoute, { preserveState: true, replaceHistory: true });
    return;
  }
  renderOpenPageTabs(active);
}

function initDashboardHistory() {
  loadOpenPageTabs();
  renderOpenPageTabs();
  if (dashboardHistoryReady) return;
  dashboardHistoryReady = true;
  window.addEventListener('popstate', () => {
    const route = routeFromHash() || fallbackDashboardRoute();
    activatePageRoute(route, { preserveState: true, pushHistory: false });
  });
}

function applyInitialDashboardRoute() {
  initDashboardHistory();
  const route = routeFromHash() || pageRouteForName(currentPageName()) || fallbackDashboardRoute();
  activatePageRoute(route, { replaceHistory: true });
}

function renderPageByName(name) {
  const renderer = PAGE_RENDERERS[name];
  if (renderer) renderer();
}

function clearNavTextCaret(el) {
  try {
    if (document.getSelection) document.getSelection().removeAllRanges();
    if (el && typeof el.blur === 'function') el.blur();
    const active = document.activeElement;
    if (active && active.closest && active.closest('.sidebar') && typeof active.blur === 'function') active.blur();
  } catch (_) {}
}

document.addEventListener('mousedown', e => {
  const target = e.target?.closest?.('.sidebar .nav-item, .sidebar .nav-group-toggle, .sidebar .basis-toggle button, .sidebar .logout-btn');
  if (!target) return;
  e.preventDefault();
  clearNavTextCaret(target);
});

function showPage(name, el, options = {}) {
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
  const route = ensureOpenPageTab(options.route || pageRouteForName(name));
  const preserveState = options.preserveState === true && page.dataset.dashboardRendered === '1';
  closeMobMenu();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  page.classList.add('active');
  const navEl = el || navElForRoute(route) || document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  clearNavTextCaret(navEl);
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = pageRouteToState(route).label;
  renderOpenPageTabs(route);
  if (options.pushHistory !== false) pushDashboardRoute(route, options.replaceHistory === true);
  try {
    if (!preserveState) {
      renderPageByName(name);
      page.dataset.dashboardRendered = '1';
    }
  } catch (err) {
    console.error('[showPage:render]', name, err);
    if (typeof showToast === 'function') showToast('화면을 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

function toggleNavGroup(el) {
  el.classList.toggle('open');
  const sub = el.nextElementSibling;
  if (sub) sub.classList.toggle('open');
  clearNavTextCaret(el);
}

// ════════════════════════════════════
