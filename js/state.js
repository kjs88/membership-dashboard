// ════════════════════════════════════
// STORAGE KEYS
// ════════════════════════════════════
let allEntries = [], allUsers = [], targets = {}, currentUser = null, charts = {}, selectedDeal = '', editingEntryId = null;
let allOrders = [], allShipOrders = [], allOrderOrders = [], orderBasis = 'ship';
let allNotices = [], allRevisits = [], allClients = [], statsPersonId = 'all', reportMode = 'week', viewingClientId = null;
// 실적 분석 채널: 'office'(사업소) | 'dist'(유통사)
let statsChannel = 'office';
let fbListeners = [];

// ════════════════════════════════════
// FIREBASE CONFIG
// ════════════════════════════════════
let DB_URL = 'https://membership-7aef2-default-rtdb.firebaseio.com';
try {
  const savedDbUrl = localStorage.getItem('sj-firebase-db-url');
  const normalizedDbUrl = typeof securityNormalizeFirebaseUrl === 'function'
    ? securityNormalizeFirebaseUrl(savedDbUrl)
    : '';
  if (normalizedDbUrl) DB_URL = normalizedDbUrl;
} catch (_) {}

function saveFbConfig() {
  const input = document.getElementById('fb-url-input');
  const err = document.getElementById('fb-setup-err');
  const url = typeof securityNormalizeFirebaseUrl === 'function'
    ? securityNormalizeFirebaseUrl(input?.value)
    : String(input?.value || '').trim().replace(/\/+$/, '');
  if (!url) {
    if (err) err.style.display = 'block';
    return;
  }
  DB_URL = url;
  localStorage.setItem('sj-firebase-db-url', url);
  const screen = document.getElementById('fb-setup-screen');
  if (screen) screen.style.display = 'none';
  if (typeof checkFbConfig === 'function') checkFbConfig();
}

function toggleMobMenu(){
  document.querySelector('.sidebar').classList.toggle('mob-open');
  document.getElementById('mob-overlay').classList.toggle('open');
}
function closeMobMenu(){
  document.querySelector('.sidebar').classList.remove('mob-open');
  document.getElementById('mob-overlay').classList.remove('open');
}

// ════════════════════════════════════
// 대한민국 공휴일 (빨간날) — 전 페이지 공통
// ════════════════════════════════════
const KR_FIXED_HOLIDAYS = {
  '01-01':'신정','03-01':'삼일절','05-05':'어린이날','06-06':'현충일',
  '08-15':'광복절','10-03':'개천절','10-09':'한글날','12-25':'크리스마스',
};
const KR_DATED_HOLIDAYS = {
  '2025-01-27':'임시공휴일','2025-01-28':'설날 연휴','2025-01-29':'설날','2025-01-30':'설날 연휴',
  '2025-03-03':'삼일절 대체공휴일','2025-05-06':'대체공휴일',
  '2025-10-05':'추석 연휴','2025-10-06':'추석','2025-10-07':'추석 연휴','2025-10-08':'추석 대체공휴일',
  '2026-02-16':'설날 연휴','2026-02-17':'설날','2026-02-18':'설날 연휴',
  '2026-03-02':'삼일절 대체공휴일',
  '2026-05-24':'부처님오신날','2026-05-25':'부처님오신날 대체공휴일',
  '2026-06-03':'지방선거일',
  '2026-08-17':'광복절 대체공휴일',
  '2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴','2026-09-28':'추석 대체공휴일',
  '2026-10-05':'개천절 대체공휴일',
};
function krHolidayName(ds) {
  if (!ds) return null;
  return KR_DATED_HOLIDAYS[ds] || KR_FIXED_HOLIDAYS[String(ds).slice(5)] || null;
}

// ════════════════════════════════════
