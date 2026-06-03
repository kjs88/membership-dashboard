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
  { id:'admin', name:'관리자', password:'1234', role:'admin', color:'#009E6A', createdAt:'2026-01-01' },
  { id:'lee1',  name:'이기현', password:'1234', role:'user',  color:'#7856C8', createdAt:'2026-01-02' },
  { id:'jang1', name:'장재순', password:'1234', role:'user',  color:'#E53935', createdAt:'2026-01-03' },
  { id:'lee2',  name:'이민우', password:'1234', role:'user',  color:'#2B72C8', createdAt:'2026-01-04' },
  { id:'ahn1',  name:'안성종', password:'1234', role:'user',  color:'#43A047', createdAt:'2026-01-05' },
];
const SEED_ENTRIES = [];

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
      return existing ? { ...d, password: existing.password } : d;
    });
  } else {
    allUsers = allUsers.map(u => { const def = DEFAULT_USERS.find(d => d.id === u.id); return def ? { ...u, color: def.color } : u; });
  }
  setShared('sj-users-v6', allUsers);
}

function arrangeJournalNavForRole(role) {
  const nav = document.querySelector('.nav');
  const journalLabel = document.getElementById('nav-journal-label');
  const journalGroup = document.getElementById('nav-journal-group');
  const clientsLabel = document.getElementById('nav-clients-label');
  if (!nav || !journalLabel || !journalGroup) return;
  if (role === 'admin') {
    nav.appendChild(journalLabel);
    nav.appendChild(journalGroup);
  } else if (clientsLabel) {
    nav.insertBefore(journalGroup, clientsLabel);
    nav.insertBefore(journalLabel, journalGroup);
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
  const roleEl = document.getElementById('sb-role');
  if (roleEl) roleEl.innerHTML = ({
    admin:   '<span class="role-badge-admin">관리자</span>',
    manager: '<span class="role-badge-manager">영업관리</span>',
    planner: '<span class="role-badge-planner">기획</span>',
    user:    '<span class="role-badge-user">영업사원</span>'
  })[u.role] || '<span class="role-badge-user">영업사원</span>';
  if (u.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  } else {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  // data-roles 속성 기반 가시성 제어 (admin-only보다 우선)
  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.getAttribute('data-roles').split(',').map(s => s.trim());
    el.style.display = allowed.includes(u.role) ? '' : 'none';
  });
  arrangeJournalNavForRole(u.role);
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
