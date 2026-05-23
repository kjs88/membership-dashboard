// PRODUCTS PAGE
// ════════════════════════════════════
let productPersonId = 'all';
let productCategoryId = 'all';
// 제품/등급 페이지네이션·정렬 상태 (clients.js에서 이동)
let _prodSortCol = 'sales', _prodSortDir = 'desc';
let _prodPage = 1, _prodList = [], _prodHasPrev = false;
let _gradePage = 1, _gradeList = [];
const PRODUCT_CATEGORY_ORDER = [
  '전동침대',
  '수동휠체어',
  '이동변기',
  '목욕의자',
  '안전손잡이',
  '미끄럼방지용품 매트리스',
  '미끄럼방지용품 양말',
  '요실금팬티',
  '간이변기',
  '욕창예방방석',
  '욕창예방매트리스',
  '이동욕조',
  '지팡이',
  '자세변환용구',
  '성인용보행기',
  '경사로',
  '구강세척기(마우스피스형)',
  '비급여',
];
const PRODUCT_CATEGORY_LABELS = {
  '구강세척기(마우스피스형)': '구강세척기',
  '미끄럼방지용품 매트리스': '미끄럼방지매트',
  '미끄럼방지용품 양말': '미끄럼방지양말',
};

function _calcPeriodRange(mode) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const f = fmt;
  const mon = (y,m,d) => new Date(y,m,d);
  // 이번주 월요일
  const dow = now.getDay() === 0 ? 6 : now.getDay()-1;
  const weekStart = new Date(now); weekStart.setDate(now.getDate()-dow);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  // 전주
  const lweekEnd   = new Date(weekStart); lweekEnd.setDate(weekStart.getDate()-1);
  const lweekStart = new Date(lweekEnd);  lweekStart.setDate(lweekEnd.getDate()-6);
  // 전일
  const yest = new Date(now); yest.setDate(now.getDate()-1);

  const map = {
    'year':      [f(mon(y,0,1)),      f(mon(y,11,31))],
    'ytd':       [f(mon(y,0,1)),      f(now)],
    'today':     [f(now),             f(now)],
    'yesterday': [f(yest),            f(yest)],
    'week':      [f(weekStart),       f(weekEnd)],
    'lweek':     [f(lweekStart),      f(lweekEnd)],
    'this':      [f(mon(y,m,1)),      f(mon(y,m+1,0))],
    'last':      [f(mon(y,m-1,1)),    f(mon(y,m,0))],
    'q1':        [f(mon(y,0,1)),      f(mon(y,3,0))],
    'q2':        [f(mon(y,3,1)),      f(mon(y,6,0))],
    'q3':        [f(mon(y,6,1)),      f(mon(y,9,0))],
    'q4':        [f(mon(y,9,1)),      f(mon(y,12,0))],
    'h1':        [f(mon(y,0,1)),      f(mon(y,6,0))],
    'h2':        [f(mon(y,6,1)),      f(mon(y,12,0))],
    'py1':       [f(mon(y-1,0,1)),    f(mon(y-1,12,0))],
    'py2':       [f(mon(y-2,0,1)),    f(mon(y-2,12,0))],
  };
  // 월별 (m1~m12)
  const mm = mode.match(/^m(\d+)$/);
  if (mm) {
    const mi = parseInt(mm[1])-1;
    return [f(mon(y,mi,1)), f(mon(y,mi+1,0))];
  }
  return map[mode] || ['',''];
}

function prodSetPeriod(mode) {
  drpShortcut('prod', mode);
}
function gradeSetPeriod(mode) {
  drpShortcut('grade', mode);
}
function recordsSetPeriod(mode) {
  drpShortcut('records', mode);
}

// ════════════════════════════════════
// GRADE PAGE
// ════════════════════════════════════
let gradeTiers = (() => {
  const saved = getShared('sj-grade-tiers', null);
  // 저장된 값이 만원 단위(너무 작음)면 초기화
  // saved 값이 있으면 그대로 사용
  return saved || [
  {id:'g1', name:'VIP',   color:'#E8900A', min:3000},
  {id:'g2', name:'A등급', color:'#009E6A', min:1000},
  {id:'g3', name:'B등급', color:'#2B72C8', min:300},
  {id:'g4', name:'C등급', color:'#9AB0AA', min:0},
  ];
})();

function getAutoGrade(sales) {
  const tiers = [...gradeTiers].sort((a,b)=>b.min-a.min);
  for (const t of tiers) { if (sales >= t.min) return t; }
  return tiers[tiers.length-1] || null;
}

function saveGradeSettings() {
  const rows = document.querySelectorAll('.grade-tier-row');
  rows.forEach((row, i) => {
    if (!gradeTiers[i]) return;
    gradeTiers[i].name  = row.querySelector('.gt-name').value.trim() || gradeTiers[i].name;
    gradeTiers[i].color = row.querySelector('.gt-color').value;
    gradeTiers[i].min   = parseFloat(row.querySelector('.gt-min').value) || 0;
  });
  gradeTiers.sort((a, b) => b.min - a.min);
  setShared('sj-grade-tiers', gradeTiers);
  renderGradeSettings();
  renderGrade();
  showToast('등급 설정이 저장됐습니다.', 'success');
}



function toggleGradeSettings() {
  const body = document.getElementById('grade-settings-body');
  const arrow = document.getElementById('grade-settings-arrow');
  const open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  arrow.style.transform = open ? 'rotate(180deg)' : '';
}

function updateGradeMemo(name, val) {
  const idx = allClients.findIndex(c=>c.name===name);
  if (idx>=0) { allClients[idx].gradeMemo = val; setShared('sj-clients', allClients); }
}

// ════════════════════════════════════
// PRODUCTS PAGE
// ════════════════════════════════════
function renderProductPersonFilter(salesUsers) {
  const filterEl = document.getElementById('prod-person-filter');
  if (!filterEl) return;
  const ordered = [...salesUsers].sort((a,b) =>
    (a.createdAt||'').localeCompare(b.createdAt||'')
  );
  if (productPersonId !== 'all' && !ordered.some(u => u.id === productPersonId)) {
    productPersonId = 'all';
  }
  const btns = [{id:'all', name:'전체'}, ...ordered.map(u=>({id:u.id, name:u.name}))];
  filterEl.innerHTML = btns.map(b =>
    `<button type="button" class="stats-person-btn${productPersonId===b.id?' active':''}" onclick="setProductPerson('${escInlineJs(b.id)}')">${escHtml(b.name)}</button>`
  ).join('');
}

function setProductPerson(id) {
  productPersonId = id || 'all';
  renderProducts();
}

function renderProductCategoryFilter(categories) {
  const filterEl = document.getElementById('prod-category-filter');
  if (!filterEl) return;
  if (productCategoryId !== 'all' && !categories.includes(productCategoryId)) {
    productCategoryId = 'all';
  }
  const allBtn = document.getElementById('prod-category-all-btn');
  if (allBtn) allBtn.classList.toggle('active', productCategoryId === 'all');
  const ordered = [
    ...PRODUCT_CATEGORY_ORDER.filter(c => categories.includes(c)),
    ...categories.filter(c => !PRODUCT_CATEGORY_ORDER.includes(c)),
  ];
  const btns = ordered.map(c=>({id:c, name:PRODUCT_CATEGORY_LABELS[c] || c, title:c}));
  filterEl.innerHTML = btns.map(b =>
    `<button type="button" class="stats-person-btn${productCategoryId===b.id?' active':''}" title="${escHtml(b.title)}" onclick="setProductCategory('${escInlineJs(b.id)}')">${escHtml(b.name)}</button>`
  ).join('');
}

function setProductCategory(id) {
  productCategoryId = id || 'all';
  renderProducts();
}

function renderProducts() {
  updateOrderBasisUI();
  const salesUsers = allUsers.filter(u => u.role === 'user');
  renderProductPersonFilter(salesUsers);
  const personF = productPersonId || 'all';
  const cats = [...new Set((allOrders || []).map(o => o.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  renderProductCategoryFilter(cats);
  const catF = productCategoryId || 'all';
  const sortV   = document.getElementById('prod-sort')?.value || 'supply-desc';
  const searchV = (document.getElementById('prod-search')?.value || '').toLowerCase();

  // 날짜 필터 (prod-date-from / prod-date-to)
  const dateFrom = document.getElementById('prod-date-from')?.value || '';
  const dateTo   = document.getElementById('prod-date-to')?.value || '';

  // ── 품목별 집계 (ERP allOrders 기반) ──
  const tbody = document.getElementById('prod-tbody');
  const empty = document.getElementById('prod-empty');
  if (empty) empty.textContent = `${getOrderBasisMeta().label} ERP 데이터를 먼저 업로드하세요. (사이드바 → ERP 자료 업로드)`;

  if (!allOrders || allOrders.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    document.getElementById('prod-pagination').style.display = 'none';
    document.getElementById('prod-sum-items').textContent = '0';
    document.getElementById('prod-sum-qty').textContent   = '0';
    document.getElementById('prod-sum-sales').textContent = '0';
    document.getElementById('prod-sum-avg').textContent   = '0';
    return;
  }

  const map = {};
  allOrders.forEach(o => {
    if (!o.date) return;
    if (dateFrom && o.date < dateFrom) return;
    if (dateTo   && o.date > dateTo)   return;
    if (personF !== 'all') {
      const personName = allUsers.find(u => u.id === personF)?.name || personF;
      if (o.person !== personName) return;
    }
    if (catF !== 'all' && (o.category||'') !== catF) return;
    const productName = o.product || '(품명 없음)';
    if (searchV && !productName.toLowerCase().includes(searchV)) return;
    const key = productName;
    if (!map[key]) map[key] = { name: key, category: o.category||'-', qty: 0, sales: 0, clients: new Set() };
    map[key].qty   += (o.qty   || 0);
    map[key].sales += (o.supply|| 0);
    if (o.client) map[key].clients.add(o.client);
  });

  // ── 전기간(직전 동일 길이) 매출 집계 — 증감 컬럼용 ──
  const prevMap = {};
  _prodHasPrev = false;
  if (dateFrom && dateTo) {
    const d1 = new Date(dateFrom), d2 = new Date(dateTo);
    const lenDays = Math.round((d2 - d1) / 86400000) + 1;
    const pTo = new Date(d1.getTime() - 86400000);
    const pFrom = new Date(pTo.getTime() - (lenDays - 1) * 86400000);
    const f = d => d.toISOString().slice(0, 10);
    const prevFrom = f(pFrom), prevTo = f(pTo);
    _prodHasPrev = true;
    const pName = personF !== 'all' ? (allUsers.find(u => u.id === personF)?.name || personF) : null;
    allOrders.forEach(o => {
      if (!o.date || o.date < prevFrom || o.date > prevTo) return;
      if (pName && o.person !== pName) return;
      if (catF !== 'all' && (o.category || '') !== catF) return;
      const productName = o.product || '(품명 없음)';
      if (searchV && !productName.toLowerCase().includes(searchV)) return;
      prevMap[productName] = (prevMap[productName] || 0) + (o.supply || 0);
    });
  }

  let list = Object.values(map).map(r => ({ name: r.name, category: r.category, qty: r.qty, sales: r.sales, clientCount: r.clients.size, prevSales: prevMap[r.name] || 0 }));

  // 헤더 클릭 정렬
  const col = _prodSortCol, dir = _prodSortDir;
  const strCols = new Set(['name', 'category']);
  if (col && dir) {
    list.sort((a, b) => {
      if (strCols.has(col)) {
        const av = a[col] || '', bv = b[col] || '';
        return dir === 'asc' ? av.localeCompare(bv, 'ko') : bv.localeCompare(av, 'ko');
      }
      const av = a[col] || 0, bv = b[col] || 0;
      return dir === 'asc' ? av - bv : bv - av;
    });
  } else {
    list.sort((a, b) => b.sales - a.sales);
  }

  // 헤더 아이콘 업데이트
  ['name','category','qty','sales','clientCount'].forEach(c => {
    const el = document.getElementById('prod-sort-' + c);
    if (!el) return;
    el.textContent = (col === c) ? (dir === 'desc' ? ' ▼' : dir === 'asc' ? ' ▲' : '') : '';
    el.style.color = 'var(--green)';
  });

  const totalSales = list.reduce((s,r) => s + r.sales, 0);
  const totalQty   = list.reduce((s,r) => s + r.qty,   0);
  const avgPrice   = totalQty ? Math.round(totalSales / totalQty) : 0;
  document.getElementById('prod-sum-items').textContent = list.length.toLocaleString();
  document.getElementById('prod-sum-qty').textContent   = totalQty.toLocaleString();
  document.getElementById('prod-sum-sales').textContent = totalSales.toLocaleString();
  document.getElementById('prod-sum-avg').textContent   = avgPrice.toLocaleString();

  if (!list.length) {
    tbody.innerHTML = ''; empty.style.display = '';
    document.getElementById('prod-pagination').style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  _prodList = list;
  _prodPage = 1;
  prodRenderPage();
}

// 전기간 대비 증감 셀 (직전 동일 길이 기간 매출 대비)
function prodDeltaCell(r) {
  if (!_prodHasPrev) return '<span style="color:var(--text3)">-</span>';
  const prev = r.prevSales || 0;
  if (prev === 0) return r.sales > 0 ? '<span style="color:var(--blue);font-weight:700">신규</span>' : '<span style="color:var(--text3)">-</span>';
  const pct = Math.round((r.sales - prev) / prev * 100);
  if (pct === 0) return '<span style="color:var(--text3)">0%</span>';
  const up = pct > 0;
  return `<span style="color:${up ? 'var(--green-dark)' : 'var(--red)'};font-weight:700">${up ? '▲' : '▼'}${Math.abs(pct)}%</span>`;
}

function prodRenderPage() {
  const PAGE = 30;
  const list = _prodList;
  const totalSales = list.reduce((s,r) => s + r.sales, 0);
  const totalPages = Math.ceil(list.length / PAGE);
  const p = Math.max(1, Math.min(_prodPage, totalPages));
  _prodPage = p;
  const slice = list.slice((p-1)*PAGE, p*PAGE);
  const startIdx = (p-1)*PAGE;

  const tbody = document.getElementById('prod-tbody');
  tbody.innerHTML = slice.map((r, i) => {
    const ratio = totalSales ? Math.round(r.sales / totalSales * 100) : 0;
    const gi = startIdx + i;
    return `<tr style="border-bottom:1px solid var(--border);${gi%2?'background:var(--surface2)':''}">
      <td style="padding:9px 14px;color:var(--text3);font-size:12px">${gi+1}</td>
      <td style="padding:9px 14px;font-weight:500">${escHtml(r.name)}</td>
      <td style="padding:9px 14px;font-size:12px;color:var(--text2)">${escHtml(r.category)}</td>
      <td style="padding:9px 14px;text-align:right;font-family:var(--mono)">${r.qty.toLocaleString()}</td>
      <td style="padding:9px 14px;text-align:right;font-family:var(--mono);color:var(--green-dark);font-weight:600">${r.sales.toLocaleString()}</td>
      <td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:12px">${prodDeltaCell(r)}</td>
      <td style="padding:9px 14px;text-align:right">
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
          <div style="width:70px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${ratio}%;height:100%;background:var(--blue);border-radius:3px"></div>
          </div>
          <span style="font-family:var(--mono);font-size:12px;color:var(--blue);font-weight:600">${ratio}%</span>
        </div>
      </td>
      <td style="padding:9px 14px;text-align:right;font-family:var(--mono);color:var(--text2)">${r.clientCount}</td>
    </tr>`;
  }).join('');

  const pgEl = document.getElementById('prod-pagination');
  pgEl.style.display = 'flex';
  document.getElementById('prod-page-info').textContent = `${list.length}개 품목 중 ${(p-1)*PAGE+1}~${Math.min(p*PAGE,list.length)}번`;
  document.getElementById('prod-page-btns').innerHTML = renderPageBtns(p, totalPages, 'prodGoPage');
}

function prodSortBy(col) {
  if (_prodSortCol !== col) {
    _prodSortCol = col; _prodSortDir = 'desc';
  } else if (_prodSortDir === 'desc') {
    _prodSortDir = 'asc';
  } else if (_prodSortDir === 'asc') {
    _prodSortCol = 'sales'; _prodSortDir = 'desc'; // 원래대로
  }
  renderProducts();
}

function addGradeTier() {
  gradeTiers.push({ id: 'g'+Date.now(), name: '신규등급', color: '#999999', min: 0 });
  setShared('sj-grade-tiers', gradeTiers);
  renderGradeSettings();
  renderGrade();
}

function renderGradeSettings() {
  const el = document.getElementById('grade-settings-list');
  if (!el) return;
  el.innerHTML = gradeTiers.map((t,i) => `
    <div class="grade-tier-row" style="display:flex;align-items:center;gap:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px">
      <input type="color" class="gt-color" value="${safeColor(t.color)}" style="width:32px;height:32px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none" />
      <input class="gt-name form-input" value="${escHtml(t.name)}" placeholder="등급명" style="width:100px;font-weight:600" />
      <span style="font-size:12px;color:var(--text2);white-space:nowrap">월 매출</span>
      <input class="gt-min form-input" type="number" value="${t.min}" placeholder="0" style="width:150px;font-family:var(--mono);text-align:right" />
      <span style="font-size:12px;color:var(--text2)">원 이상</span>
      <button class="btn-sm btn-danger" onclick="removeGradeTier(${i})" style="margin-left:auto;padding:4px 10px">삭제</button>
    </div>`).join('');
}

function removeGradeTier(i) {
  gradeTiers.splice(i, 1);
  setShared('sj-grade-tiers', gradeTiers);
  renderGradeSettings();
  renderGrade();
}

// 이탈위험 거래처: 직전 60일엔 매출이 있었으나 최근 60일에 중단/급감(-50%↓)한 거래처
function renderChurnRisk() {
  const card = document.getElementById('grade-churn-card');
  if (!card) return;
  const orders = (typeof allOrders !== 'undefined' ? allOrders : []);
  if (!orders.length) { card.style.display = 'none'; return; }
  const DAY = 86400000;
  const fmt = d => d.toISOString().slice(0, 10);
  const now = Date.now();
  const recentFrom = fmt(new Date(now - 60 * DAY));
  const priorFrom = fmt(new Date(now - 120 * DAY));
  const recentMap = {}, priorMap = {};
  orders.forEach(o => {
    const d = o.date || ''; const k = o.client || '';
    if (!d || !k) return;
    const amt = parseFloat(o.supply) || 0;
    if (d >= recentFrom) recentMap[k] = (recentMap[k] || 0) + amt;
    else if (d >= priorFrom) priorMap[k] = (priorMap[k] || 0) + amt;
  });
  const FLOOR = 300000; // 이전 60일 매출 30만원 이상만 표시 (노이즈 제거)
  const risk = [];
  Object.keys(priorMap).forEach(k => {
    const prev = priorMap[k], rec = recentMap[k] || 0;
    if (prev < FLOOR) return;
    if (rec === 0 || rec <= prev * 0.5) {
      risk.push({ name: k, prev, rec, drop: Math.round((1 - rec / prev) * 100), lost: rec === 0 });
    }
  });
  risk.sort((a, b) => b.prev - a.prev);
  if (!risk.length) { card.style.display = 'none'; return; }
  const lostCnt = risk.filter(r => r.lost).length;
  const show = risk.slice(0, 12);
  card.style.display = 'block';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:15px">⚠️</span>
      <span style="font-size:14px;font-weight:700;color:var(--red)">이탈위험 거래처 ${risk.length}곳</span>
      <span style="font-size:11px;color:var(--text2)">최근 60일 매출 중단/급감 · 거래중단 ${lostCnt}곳</span>
      <button class="btn-sm btn-ghost" style="margin-left:auto;padding:3px 10px;font-size:11px" onclick="this.closest('#grade-churn-card').style.display='none'">닫기</button>
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:6px">
      <thead><tr>${['거래처','이전 60일','최근 60일','감소율',''].map((h,i)=>`<th style="padding:7px 10px;text-align:${i===0?'left':i===4?'center':'right'};font-size:10px;font-weight:700;color:var(--text3);border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead>
      <tbody>${show.map(r=>`<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 10px;font-weight:500">${escHtml(r.name)}</td>
        <td style="padding:7px 10px;text-align:right;font-family:var(--mono);color:var(--text2)">${Math.round(r.prev).toLocaleString()}</td>
        <td style="padding:7px 10px;text-align:right;font-family:var(--mono);color:${r.rec?'var(--text)':'var(--red)'};font-weight:600">${Math.round(r.rec).toLocaleString()}</td>
        <td style="padding:7px 10px;text-align:right;font-family:var(--mono);color:var(--red);font-weight:700">▼${r.drop}%</td>
        <td style="padding:7px 10px;text-align:center">${r.lost?'<span style="background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px">거래중단</span>':'<span style="background:var(--amber-l);color:var(--amber);font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px">급감</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${risk.length>show.length?`<div style="text-align:center;font-size:11px;color:var(--text3);margin-top:8px">외 ${risk.length-show.length}곳 더 (이전 매출 큰 순 12곳 표시)</div>`:''}`;
}

function renderGrade() {
  updateOrderBasisUI();
  renderChurnRisk();
  // 등급 필터 옵션 갱신
  const gSel = document.getElementById('grade-filter-grade');
  const curGf = gSel?.value || 'all';
  if (gSel) {
    gSel.innerHTML = '<option value="all">전체 등급</option>' +
      gradeTiers.map(t => `<option value="${escHtml(t.name)}">${escHtml(t.name)}</option>`).join('');
    gSel.value = curGf;
  }

  const regionF = document.getElementById('grade-filter-region')?.value || 'all';
  const gradeF  = document.getElementById('grade-filter-grade')?.value || 'all';
  const searchV = (document.getElementById('grade-search')?.value || '').toLowerCase();

  // 날짜 범위 매출 집계
  const dateFrom = document.getElementById('grade-date-from')?.value || '';
  const dateTo   = document.getElementById('grade-date-to')?.value   || '';

  // ERP 기반(원단위) 집계
  const useErp = allOrders && allOrders.length > 0;
  const salesMap = {};
  if (useErp) {
    allOrders.forEach(o => {
      const d = o.date || '';
      if (dateFrom && d < dateFrom) return;
      if (dateTo   && d > dateTo)   return;
      const k = o.client || '(미입력)';
      salesMap[k] = (salesMap[k] || 0) + Math.round(parseFloat(o.supply) || 0);
    });
  } else {
    allEntries.forEach(e => {
      const d = e.date || '';
      if (dateFrom && d < dateFrom) return;
      if (dateTo   && d > dateTo)   return;
      const k = e.institution || '(미입력)';
      salesMap[k] = (salesMap[k] || 0) + (e.ourPurchase || 0);
    });
  }

  const hdr = document.getElementById('grade-sales-header');
  if (hdr) hdr.textContent = (dateFrom || dateTo) ? `${dateFrom||''}~${dateTo||'현재'} 매출(원)` : `${getOrderBasisMeta().label} 전체 매출(원)`;

  // 수동 등급 데이터
  let manualGrades = getShared('sj-manual-grades', {});

  // 거래처 리스트: allClients + ERP에만 있는 거래처 합산
  const clientNames = new Set([
    ...allClients.map(c => c.name),
    ...Object.keys(salesMap),
  ]);

  let list = Array.from(clientNames).map(name => {
    const client = allClients.find(c => c.name === name);
    const region = client?.region || '';
    const sales = salesMap[name] || 0;
    const autoGrade = getAutoGrade(sales);
    const manualGradeName = manualGrades[name] || '';
    const finalGrade = manualGradeName
      ? (gradeTiers.find(t => t.name === manualGradeName) || autoGrade)
      : autoGrade;
    return { name, region, sales, autoGrade, manualGradeName, finalGrade };
  });

  // 매출 0이고 ERP에도 없는 거래처 숨김 (데이터 없는 시드 DB 거래처)
  if (useErp) list = list.filter(r => r.sales > 0);

  // 필터
  if (regionF !== 'all') list = list.filter(r => r.region === regionF);
  if (gradeF  !== 'all') list = list.filter(r => r.finalGrade.name === gradeF);
  if (searchV) list = list.filter(r => r.name.toLowerCase().includes(searchV));
  list.sort((a, b) => b.sales - a.sales);

  // 등급별 요약 바
  const summary = {};
  gradeTiers.forEach(t => { summary[t.name] = { count: 0, color: t.color }; });
  list.forEach(r => {
    if (!summary[r.finalGrade.name]) summary[r.finalGrade.name] = { count: 0, color: r.finalGrade.color };
    summary[r.finalGrade.name].count++;
  });
  document.getElementById('grade-summary-row').innerHTML = Object.entries(summary)
    .filter(([, v]) => v.count > 0)
    .map(([name, v]) => {
      const color = safeColor(v.color);
      return `<div style="background:${color}22;border:1px solid ${color}44;border-radius:8px;padding:8px 16px;display:flex;align-items:center;gap:8px">
      <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
      <span style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(name)}</span>
      <span style="font-size:13px;font-family:var(--mono);color:${color};font-weight:700">${v.count}개</span>
    </div>`;
    }).join('');

  document.getElementById('grade-count-label').textContent = `총 ${list.length}개 거래처`;

  const tbody = document.getElementById('grade-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding:48px;text-align:center;color:var(--text3)">${useErp ? '조건에 맞는 거래처가 없습니다.' : `${getOrderBasisMeta().label} ERP 데이터를 업로드하거나 기간을 조정해보세요.`}</td></tr>`;
    document.getElementById('grade-pagination').style.display = 'none';
    return;
  }

  _gradeList = list;
  _gradePage = 1;
  gradeRenderPage();
}

function gradeRenderPage() {
  const PAGE = 30;
  const list = _gradeList;
  const totalPages = Math.ceil(list.length / PAGE);
  const p = Math.max(1, Math.min(_gradePage, totalPages));
  _gradePage = p;
  const slice = list.slice((p-1)*PAGE, p*PAGE);

  const tbody = document.getElementById('grade-tbody');
  const startIdx = (p-1)*PAGE;
  tbody.innerHTML = slice.map((r, i) => {
    const gi = startIdx + i;
    const opts = gradeTiers.map(t =>
      `<option value="${escHtml(t.name)}" ${r.manualGradeName === t.name ? 'selected' : ''}>${escHtml(t.name)}</option>`
    ).join('');
    const autoColor = safeColor(r.autoGrade?.color);
    const finalColor = safeColor(r.finalGrade?.color);
    return `<tr style="border-bottom:1px solid var(--border);${gi%2?'background:var(--surface2)':''}">
      <td style="padding:9px 14px;font-weight:500">${escHtml(r.name)}</td>
      <td style="padding:9px 14px;font-size:12px;color:var(--text2)">${escHtml(r.region || '-')}</td>
      <td style="padding:9px 14px;text-align:right;font-family:var(--mono);color:var(--green-dark);font-weight:600">${r.sales.toLocaleString()}</td>
      <td style="padding:9px 14px;text-align:center">
        <span style="background:${autoColor}22;color:${autoColor};font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px">${escHtml(r.autoGrade?.name || '-')}</span>
      </td>
      <td style="padding:9px 14px;text-align:center">
        <select class="form-select" style="font-size:11px;padding:3px 6px;width:90px" onchange="setManualGrade('${escInlineJs(r.name)}',this.value)">
          <option value="">자동</option>${opts}
        </select>
      </td>
      <td style="padding:9px 14px;text-align:center">
        <span style="background:${finalColor}22;color:${finalColor};font-size:12px;font-weight:700;padding:3px 10px;border-radius:4px">${escHtml(r.finalGrade?.name || '-')}</span>
      </td>
      <td style="padding:9px 14px;font-size:12px;color:var(--text2)">-</td>
    </tr>`;
  }).join('');

  const pgEl = document.getElementById('grade-pagination');
  pgEl.style.display = 'flex';
  document.getElementById('grade-page-info').textContent = `${list.length}개 거래처 중 ${(p-1)*PAGE+1}~${Math.min(p*PAGE,list.length)}번`;
  document.getElementById('grade-page-btns').innerHTML = renderPageBtns(p, totalPages, 'gradeGoPage');
}

function setManualGrade(name, grade) {
  let mg = getShared('sj-manual-grades', {});
  if (grade) mg[name] = grade; else delete mg[name];
  setShared('sj-manual-grades', mg);
  renderGrade();
}


// ════════════════════════════════════
// ERP API 연동 / 수동 업로드
// ════════════════════════════════════
let erpParsedByBasis = { order: [], ship: [] };
const ERP_TRIGGER_SYNC_ENDPOINT = '/.netlify/functions/erp-trigger-sync';
const ERP_REMOTE_DATA_PATH = 'erp/latest';
const ERP_AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000;
const ERP_AUTO_SYNC_CHECK_MS = 5 * 60 * 1000;
const ERP_AUTO_SYNC_RETRY_MS = 15 * 60 * 1000;
const ERP_AUTO_SYNC_LOCK_MS = 10 * 60 * 1000;
const ERP_TRIGGER_POLL_MS = 15 * 1000;
const ERP_TRIGGER_TIMEOUT_MS = 12 * 60 * 1000;
const ERP_AUTO_SYNC_META_KEY = 'sj-erp-auto-sync-meta';
const ERP_AUTO_SYNC_LOCK_KEY = 'sj-erp-auto-sync-lock';
const ERP_AUTO_SYNC_HOLIDAYS = {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절 대체공휴일',
  '2026-05-01': '근로자의 날',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '부처님오신날 대체공휴일',
  '2026-06-03': '지방선거일',
  '2026-06-06': '현충일',
  '2026-07-17': '제헌절',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절 대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '개천절 대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
};
let erpAutoSyncTimer = null;
let erpAutoSyncInFlight = false;
let erpAutoSyncListenersReady = false;

function erpNum(v) {
  return parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
}

function erpFormatDate(raw) {
  if (raw instanceof Date) {
    return raw.getFullYear()+'-'+String(raw.getMonth()+1).padStart(2,'0')+'-'+String(raw.getDate()).padStart(2,'0');
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s ? s.substring(0,10).replace(/\//g,'-') : '';
  }
  if (typeof raw === 'number') {
    const d = new Date(Math.round((raw - 25569)*86400*1000));
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  return '';
}

function erpParseRows(rows, basis) {
  const meta = getOrderBasisMeta(basis);
  const dateCol = basis === 'order' ? '주문일자' : '출고일자';
  const noCol = basis === 'order' ? '주문번호' : '출고번호';
  const qtyCol = basis === 'order' ? '주문수량' : '출고수량';
  const first = rows[0] || {};
  [dateCol, noCol, qtyCol, '고객', '품명', '공급가'].forEach(col => {
    if (!(col in first)) throw new Error(`${meta.label} 파일에 "${col}" 컬럼이 없습니다.`);
  });

  return rows.map(r => {
    const custCls = String(r['고객분류']||'');
    const personMatch = custCls.match(/도매\((.+)\)/);
    const person = personMatch ? personMatch[1] : String(r['담당자']||'').trim();
    return {
      basis,
      date:      erpFormatDate(r[dateCol]),
      client:    String(r['고객']||'').trim(),
      product:   String(r['품명']||'').trim(),
      category:  String(r['대분류']||'').trim(),
      qty:       erpNum(r[qtyCol]),
      supply:    erpNum(r['공급가']),
      total:     erpNum(r['합계액']),
      person,
      region:    String(r['지역']||'').trim(),
      orderNo:   String(r[noCol]||'').trim(),
    };
  }).filter(r => r.date && r.client);
}

function erpSummarize(list) {
  const dates = [...new Set(list.map(r=>r.date))].sort();
  return {
    dates,
    clients: [...new Set(list.map(r=>r.client))].length,
    totalAmt: list.reduce((s,r)=>s+(parseFloat(r.supply)||0),0),
    qty: list.reduce((s,r)=>s+(parseFloat(r.qty)||0),0),
  };
}

function erpUpdateUploadPreview() {
  const statusEl = document.getElementById('erp-upload-status');
  const preview = document.getElementById('erp-preview');
  const previewLabel = document.getElementById('erp-preview-label');
  const previewList = document.getElementById('erp-preview-list');
  const totalLabel = document.getElementById('erp-total-label');
  const confirmBtn = document.getElementById('erp-confirm-btn');
  const orderCount = erpParsedByBasis.order.length;
  const shipCount = erpParsedByBasis.ship.length;
  const hasAny = orderCount || shipCount;
  const hasBoth = orderCount && shipCount;

  if (!hasAny) {
    if (statusEl) statusEl.style.display = 'none';
    if (preview) preview.style.display = 'none';
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (totalLabel) totalLabel.textContent = '';
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.background = hasBoth ? 'var(--green-light)' : 'var(--amber-l)';
    statusEl.style.color = hasBoth ? 'var(--green-dark)' : 'var(--amber)';
    statusEl.innerHTML = hasBoth
      ? `✓ 주문현황 <strong>${orderCount.toLocaleString()}건</strong>, 출고현황 <strong>${shipCount.toLocaleString()}건</strong> 파싱 완료`
      : `주문현황과 출고현황 파일을 모두 선택해야 저장할 수 있습니다.`;
  }

  if (previewLabel) previewLabel.textContent = '업로드 미리보기';
  if (previewList) {
    previewList.innerHTML = ['order','ship'].map(basis => {
      const meta = getOrderBasisMeta(basis);
      const list = erpParsedByBasis[basis] || [];
      if (!list.length) return `<div style="padding:7px 0;color:var(--text3)">${meta.label}: 파일 미선택</div>`;
      const s = erpSummarize(list);
      const range = s.dates.length ? `${s.dates[0]} ~ ${s.dates[s.dates.length-1]} (${s.dates.length}일)` : '-';
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">${meta.label}</div>
        <div style="display:grid;grid-template-columns:1.4fr .7fr .8fr 1fr;gap:8px;color:var(--text2)">
          <span>${range}</span>
          <span>${list.length.toLocaleString()}건</span>
          <span>${s.clients.toLocaleString()}개 거래처</span>
          <span style="font-family:var(--mono);color:var(--green-dark);text-align:right">${s.totalAmt.toLocaleString()}원</span>
        </div>
      </div>`;
    }).join('');
  }
  if (preview) preview.style.display = 'block';
  if (totalLabel) totalLabel.textContent = hasBoth ? `총 ${(orderCount + shipCount).toLocaleString()}건` : '두 파일 필요';
  if (confirmBtn) confirmBtn.style.display = hasBoth ? 'inline-flex' : 'none';
}

function erpHandleFile(input, basis = 'ship') {
  const file = input.files[0];
  if (!file) return;
  const meta = getOrderBasisMeta(basis);
  const stateEl = document.getElementById(`erp-${basis}-state`);
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
      const parsed = erpParseRows(rows, basis);
      if (!parsed.length) throw new Error('유효한 데이터가 없습니다.');
      erpParsedByBasis[basis] = parsed;
      if (stateEl) {
        stateEl.textContent = `${file.name} · ${parsed.length.toLocaleString()}건`;
        stateEl.style.color = 'var(--green-dark)';
      }
      erpUpdateUploadPreview();
    } catch(err) {
      const statusEl = document.getElementById('erp-upload-status');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'var(--red-l)';
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = `${meta.label} 파싱 오류: ` + err.message;
      }
      erpParsedByBasis[basis] = [];
      if (stateEl) {
        stateEl.textContent = '파싱 실패';
        stateEl.style.color = 'var(--red)';
      }
      erpUpdateUploadPreview();
    }
  };
  reader.readAsArrayBuffer(file);
}

function erpMergeByDate(existing, parsed) {
  const uploadDates = new Set(parsed.map(r=>r.date));
  return [...existing.filter(r => !uploadDates.has(r.date)), ...parsed];
}

function erpSaveRows(parsedOrder, parsedShip, sourceLabel = 'ERP') {
  const runtimeOrder = window.__erpRemoteData?.order || [];
  const runtimeShip = window.__erpRemoteData?.ship || [];
  const existingOrder = runtimeOrder.length ? runtimeOrder : getShared('sj-orders-order', []);
  const existingShip = runtimeShip.length ? runtimeShip : getShared('sj-orders-ship', getShared('sj-orders', []));

  const mergedOrder = parsedOrder.length ? erpMergeByDate(existingOrder, parsedOrder) : existingOrder;
  const mergedShip = parsedShip.length ? erpMergeByDate(existingShip, parsedShip) : existingShip;
  allOrderOrders = mergedOrder;
  allShipOrders = mergedShip;
  window.__erpRemoteData = {
    order: mergedOrder,
    ship: mergedShip,
    meta: {
      source: sourceLabel,
      syncedAt: new Date().toISOString(),
      orderCount: mergedOrder.length,
      shipCount: mergedShip.length,
    },
  };
  if (sourceLabel === 'manual-xlsx') {
    setShared('sj-orders-order', mergedOrder);
    setShared('sj-orders-ship', mergedShip);
    setShared('sj-orders', mergedShip);
  } else {
    try {
      localStorage.removeItem('sj-orders-order');
      localStorage.removeItem('sj-orders-ship');
      localStorage.removeItem('sj-orders');
    } catch (_) {}
  }
  applyOrderBasis();
  rerenderOrderBasisPages();

  const meta = {
    source: sourceLabel,
    syncedAt: new Date().toISOString(),
    orderCount: parsedOrder.length,
    shipCount: parsedShip.length,
  };
  setPlainStorage('sj-erp-sync-meta', JSON.stringify(meta));
  erpRefreshSyncStatus();
  return meta;
}

function erpResetUploadState() {
  erpParsedByBasis = { order: [], ship: [] };
  ['order','ship'].forEach(basis => {
    const input = document.getElementById(`erp-${basis}-file-input`);
    const state = document.getElementById(`erp-${basis}-state`);
    if (input) input.value = '';
    if (state) {
      state.textContent = '파일 미선택';
      state.style.color = 'var(--text3)';
    }
  });
  erpUpdateUploadPreview();
}

function erpConfirmUpload() {
  const parsedOrder = erpParsedByBasis.order || [];
  const parsedShip = erpParsedByBasis.ship || [];
  if (!parsedOrder.length || !parsedShip.length) {
    const statusEl = document.getElementById('erp-upload-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'var(--red-l)';
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = '주문현황과 출고현황 파일을 모두 업로드하세요.';
    }
    return;
  }

  erpSaveRows(parsedOrder, parsedShip, 'manual-xlsx');

  closeModal('modal-erp-upload');
  showToast(`ERP 데이터 저장 완료 · 주문 ${parsedOrder.length.toLocaleString()}건 / 출고 ${parsedShip.length.toLocaleString()}건`, 'success');
  erpResetUploadState();
}

function erpPick(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function erpNormalizeApiRows(rows, basis) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  try {
    return erpParseRows(list, basis);
  } catch (_) {
    const dateKeys = basis === 'order'
      ? ['date','orderDate','orderedAt','주문일자','수주일자']
      : ['date','shipDate','shippedAt','출고일자'];
    const noKeys = basis === 'order'
      ? ['orderNo','orderNumber','no','주문번호','수주번호']
      : ['orderNo','shipNo','shipmentNo','no','출고번호'];
    const qtyKeys = basis === 'order'
      ? ['qty','quantity','orderQty','주문수량','수주수량']
      : ['qty','quantity','shipQty','출고수량'];

    return list.map(r => ({
      basis,
      date: erpFormatDate(erpPick(r, dateKeys)),
      client: String(erpPick(r, ['client','clientName','customer','customerName','거래처','거래처명','고객']) || '').trim(),
      product: String(erpPick(r, ['product','productName','item','itemName','품명']) || '').trim(),
      category: String(erpPick(r, ['category','itemGroup','largeCategory','대분류','품목군']) || '').trim(),
      qty: erpNum(erpPick(r, qtyKeys)),
      supply: erpNum(erpPick(r, ['supply','supplyAmount','amount','netAmount','공급가'])),
      total: erpNum(erpPick(r, ['total','totalAmount','grossAmount','합계액'])),
      person: String(erpPick(r, ['person','salesPerson','manager','담당자']) || '').trim(),
      region: String(erpPick(r, ['region','area','지역']) || '').trim(),
      orderNo: String(erpPick(r, noKeys) || '').trim(),
    })).filter(r => r.date && r.client);
  }
}

function erpSetStatus(kind, message) {
  const statusEl = document.getElementById('erp-upload-status');
  if (!statusEl) return;
  const styles = {
    ok: ['var(--green-light)', 'var(--green-dark)'],
    warn: ['var(--amber-l)', 'var(--amber)'],
    error: ['var(--red-l)', 'var(--red)'],
    info: ['var(--surface2)', 'var(--text2)'],
  };
  const [bg, color] = styles[kind] || styles.info;
  statusEl.style.display = 'block';
  statusEl.style.background = bg;
  statusEl.style.color = color;
  statusEl.innerHTML = message;
}

function erpReadSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem('sj-erp-sync-meta') || 'null');
  } catch (_) {
    return null;
  }
}

function erpReadAutoSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(ERP_AUTO_SYNC_META_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function erpWriteAutoSyncMeta(meta) {
  setPlainStorage(ERP_AUTO_SYNC_META_KEY, JSON.stringify({
    ...(erpReadAutoSyncMeta() || {}),
    ...meta,
  }));
}

function erpGetKstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour || 0),
    minute: Number(parts.minute || 0),
  };
}

function erpAutoSyncBlockReason(date = new Date()) {
  const parts = erpGetKstParts(date);
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return '주말';
  if (ERP_AUTO_SYNC_HOLIDAYS[parts.ymd]) return ERP_AUTO_SYNC_HOLIDAYS[parts.ymd];
  if (parts.hour < 9 || parts.hour >= 21) return '야간 시간대';
  return '';
}

function erpFormatLocalTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function erpGetNextAutoSyncText() {
  const now = new Date();
  const blockReason = erpAutoSyncBlockReason(now);
  const autoMeta = erpReadAutoSyncMeta();
  if (erpAutoSyncInFlight) return '자동 동기화 실행 중';
  if (blockReason) return `대기 · ${blockReason}`;
  const syncMeta = erpReadSyncMeta();
  const lastSyncedAt = syncMeta?.syncedAt ? erpParseSyncDate(syncMeta.syncedAt) : null;
  if (!lastSyncedAt || Number.isNaN(lastSyncedAt.getTime())) return '영업시간 중 곧 실행';
  const nextAt = new Date(lastSyncedAt.getTime() + ERP_AUTO_SYNC_INTERVAL_MS);
  if (nextAt <= now) return '영업시간 중 곧 실행';
  if (autoMeta?.lastAutoStatus === 'error' && autoMeta.lastAutoAttemptAt) {
    const retryAt = new Date(new Date(autoMeta.lastAutoAttemptAt).getTime() + ERP_AUTO_SYNC_RETRY_MS);
    if (retryAt > now) return `오류 후 재시도 ${erpFormatLocalTime(retryAt)}`;
  }
  return `다음 ${erpFormatLocalTime(nextAt)}`;
}

function erpParseSyncDate(value) {
  if (value instanceof Date) return value;
  if (!value) return new Date(NaN);
  const text = String(value).trim();
  const legacyUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(text);
  return new Date(legacyUtc ? `${text}Z` : text);
}

function erpFormatSidebarUpdatedAt(value) {
  const date = erpParseSyncDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

function erpUpdateSidebarSyncStamp(meta = erpReadSyncMeta()) {
  const el = document.getElementById('erp-sidebar-updated-at');
  if (!el) return;
  const syncedAt = meta?.syncedAt ? erpFormatSidebarUpdatedAt(meta.syncedAt) : '';
  el.textContent = syncedAt ? `데이터 업데이트 ${syncedAt}` : '데이터 업데이트 -';
  el.classList.toggle('is-empty', !syncedAt);
}

function erpRefreshSyncStatus() {
  const meta = erpReadSyncMeta();
  const stateEl = document.getElementById('erp-sync-state');
  const orderEl = document.getElementById('erp-sync-order-count');
  const shipEl = document.getElementById('erp-sync-ship-count');
  const autoEl = document.getElementById('erp-sync-auto-state');
  if (!meta) {
    if (stateEl) stateEl.textContent = '아직 동기화 기록 없음';
    if (orderEl) orderEl.textContent = (allOrderOrders || []).length ? `${allOrderOrders.length.toLocaleString()}건 저장됨` : '-';
    if (shipEl) shipEl.textContent = (allShipOrders || []).length ? `${allShipOrders.length.toLocaleString()}건 저장됨` : '-';
    if (autoEl) autoEl.textContent = erpGetNextAutoSyncText();
    erpUpdateSidebarSyncStamp(null);
    return;
  }
  const syncedAt = meta.syncedAt ? erpParseSyncDate(meta.syncedAt) : null;
  if (stateEl) stateEl.textContent = syncedAt ? `${erpFormatSidebarUpdatedAt(meta.syncedAt)} · ${meta.source || 'ERP'}` : `${meta.source || 'ERP'} 동기화됨`;
  if (orderEl) orderEl.textContent = `${Number(meta.orderCount || 0).toLocaleString()}건`;
  if (shipEl) shipEl.textContent = `${Number(meta.shipCount || 0).toLocaleString()}건`;
  if (autoEl) autoEl.textContent = erpGetNextAutoSyncText();
  erpUpdateSidebarSyncStamp(meta);
}

function erpRenderSyncPreview(parsedOrder, parsedShip, label = 'API 동기화 미리보기') {
  erpParsedByBasis = { order: parsedOrder, ship: parsedShip };
  erpUpdateUploadPreview();
  const previewLabel = document.getElementById('erp-preview-label');
  const confirmBtn = document.getElementById('erp-confirm-btn');
  if (previewLabel) previewLabel.textContent = label;
  if (confirmBtn) confirmBtn.style.display = 'none';
}

function erpExtractApiRows(payload, basis) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const keys = basis === 'order'
    ? ['order','orders','orderRows','orderStatus','주문현황']
    : ['ship','ships','shipments','shipmentRows','outbound','outboundRows','출고현황'];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && Array.isArray(payload[key].rows)) return payload[key].rows;
    if (payload[key] && Array.isArray(payload[key].items)) return payload[key].items;
    if (payload[key] && Array.isArray(payload[key].data)) return payload[key].data;
  }
  if (payload.data) return erpExtractApiRows(payload.data, basis);
  if (payload.result) return erpExtractApiRows(payload.result, basis);
  return [];
}

function erpGetRemoteDataUrl() {
  const base = (typeof DB_URL === 'string' ? DB_URL : '').replace(/\/+$/, '');
  return base ? `${base}/${ERP_REMOTE_DATA_PATH}.json` : '';
}

function erpSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function erpIsNewerRemoteSync(remoteSyncedAt, previousSyncedAt) {
  if (!remoteSyncedAt) return false;
  if (!previousSyncedAt) return true;
  const remoteTime = erpParseSyncDate(remoteSyncedAt).getTime();
  const previousTime = erpParseSyncDate(previousSyncedAt).getTime();
  return Number.isFinite(remoteTime) && (!Number.isFinite(previousTime) || remoteTime > previousTime);
}

async function erpRefreshFromRemote(options = {}) {
  const silent = options.silent === true;
  const url = erpGetRemoteDataUrl();
  if (!url) {
    const message = 'Firebase DB_URL이 설정되지 않았습니다.';
    if (!silent) erpSetStatus('error', message);
    return { ok: false, error: message };
  }

  if (!silent) erpSetStatus('info', 'Firebase에서 최신 ERP 데이터를 불러오는 중입니다.');
  try {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Firebase ERP 데이터 조회 실패 (${res.status})`);
    if (!payload) throw new Error('Firebase에 ERP 최신 데이터가 없습니다. Python 수집기를 먼저 실행하세요.');

    const parsedOrder = erpNormalizeApiRows(erpExtractApiRows(payload, 'order'), 'order');
    const parsedShip = erpNormalizeApiRows(erpExtractApiRows(payload, 'ship'), 'ship');
    if (!parsedOrder.length || !parsedShip.length) {
      throw new Error(`Firebase 데이터에서 주문/출고를 모두 찾지 못했습니다. 주문 ${parsedOrder.length}건, 출고 ${parsedShip.length}건`);
    }

    const meta = erpSaveRows(parsedOrder, parsedShip, payload.source || 'amarans-playwright');
    if (payload.syncedAt) {
      meta.syncedAt = payload.syncedAt;
      meta.orderCount = payload.orderCount || parsedOrder.length;
      meta.shipCount = payload.shipCount || parsedShip.length;
      setPlainStorage('sj-erp-sync-meta', JSON.stringify(meta));
      erpRefreshSyncStatus();
    }
    erpRenderSyncPreview(parsedOrder, parsedShip, 'Firebase 최신 ERP 데이터');

    if (!silent) {
      erpSetStatus('ok', `최신 ERP 데이터 반영 완료 · 주문 <strong>${parsedOrder.length.toLocaleString()}건</strong> / 출고 <strong>${parsedShip.length.toLocaleString()}건</strong>`);
      showToast('최신 ERP 데이터를 불러왔습니다.', 'success');
    }
    return { ok: true, orderCount: parsedOrder.length, shipCount: parsedShip.length, syncedAt: payload.syncedAt || meta.syncedAt };
  } catch (err) {
    if (!silent) erpSetStatus('error', `ERP 데이터 새로고침 오류: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function erpTriggerCollectorAndRefresh() {
  const beforeSyncedAt = erpReadSyncMeta()?.syncedAt || '';
  erpSetStatus('info', '아마란스 수집기를 실행 요청하는 중입니다.');

  try {
    const triggerRes = await fetch(ERP_TRIGGER_SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basis: 'both' }),
    });
    const triggerPayload = await triggerRes.json().catch(() => ({}));
    if (!triggerRes.ok) {
      throw new Error(triggerPayload.message || triggerPayload.error || `수집기 실행 요청 실패 (${triggerRes.status})`);
    }

    erpSetStatus('info', '아마란스 수집기가 실행 중입니다. 새 데이터가 올라오면 자동 반영합니다.');
    const started = Date.now();
    let lastError = '';

    while (Date.now() - started < ERP_TRIGGER_TIMEOUT_MS) {
      await erpSleep(ERP_TRIGGER_POLL_MS);
      const result = await erpRefreshFromRemote({ silent: true });
      if (result.ok && erpIsNewerRemoteSync(result.syncedAt, beforeSyncedAt)) {
        erpSetStatus('ok', `최신 ERP 데이터 반영 완료 · 주문 <strong>${result.orderCount.toLocaleString()}건</strong> / 출고 <strong>${result.shipCount.toLocaleString()}건</strong>`);
        showToast('아마란스 최신 데이터가 반영되었습니다.', 'success');
        return result;
      }
      if (!result.ok) lastError = result.error || '';
      erpSetStatus('info', '아마란스 수집기가 실행 중입니다. Firebase 최신 데이터 업로드를 기다리는 중입니다.');
    }

    throw new Error(lastError || '수집기 실행 후 새 ERP 데이터가 제한 시간 안에 올라오지 않았습니다.');
  } catch (err) {
    erpSetStatus('error', `ERP 연동 실행 오류: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function erpRunUnifiedRefresh() {
  const btn = document.getElementById('erp-refresh-btn');
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '새로고침 중...';
  }
  try {
    return await erpTriggerCollectorAndRefresh();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText || '새로고침';
    }
  }
}

function erpClaimAutoSyncLock() {
  const now = Date.now();
  const lock = (() => {
    try { return JSON.parse(localStorage.getItem(ERP_AUTO_SYNC_LOCK_KEY) || 'null'); }
    catch (_) { return null; }
  })();
  if (lock?.at && now - Number(lock.at) < ERP_AUTO_SYNC_LOCK_MS) return false;
  setPlainStorage(ERP_AUTO_SYNC_LOCK_KEY, JSON.stringify({ at: now }));
  return true;
}

function erpReleaseAutoSyncLock() {
  try { localStorage.removeItem(ERP_AUTO_SYNC_LOCK_KEY); } catch (_) {}
}

function erpShouldAutoSync() {
  if (document.hidden) return { ok: false, reason: '탭 비활성' };
  const blockReason = erpAutoSyncBlockReason();
  if (blockReason) return { ok: false, reason: blockReason };

  const now = Date.now();
  const autoMeta = erpReadAutoSyncMeta();
  if (autoMeta?.lastAutoStatus === 'error' && autoMeta.lastAutoAttemptAt) {
    const lastAttempt = new Date(autoMeta.lastAutoAttemptAt).getTime();
    if (Number.isFinite(lastAttempt) && now - lastAttempt < ERP_AUTO_SYNC_RETRY_MS) {
      return { ok: false, reason: '오류 후 재시도 대기' };
    }
  }

  const syncMeta = erpReadSyncMeta();
  const lastSynced = syncMeta?.syncedAt ? erpParseSyncDate(syncMeta.syncedAt).getTime() : 0;
  if (Number.isFinite(lastSynced) && lastSynced && now - lastSynced < ERP_AUTO_SYNC_INTERVAL_MS) {
    return { ok: false, reason: '1시간 미도래' };
  }
  return { ok: true };
}

async function erpRunAutoSync() {
  const decision = erpShouldAutoSync();
  if (!decision.ok || erpAutoSyncInFlight) {
    erpRefreshSyncStatus();
    return;
  }
  if (!erpClaimAutoSyncLock()) return;

  erpAutoSyncInFlight = true;
  erpWriteAutoSyncMeta({ lastAutoAttemptAt: new Date().toISOString(), lastAutoStatus: 'running' });
  erpRefreshSyncStatus();

  try {
    const result = await erpRefreshFromRemote({ auto: true, silent: true });
    erpWriteAutoSyncMeta({
      lastAutoFinishedAt: new Date().toISOString(),
      lastAutoStatus: result.ok ? 'ok' : 'error',
      lastAutoError: result.ok ? '' : result.error,
    });
    if (!result.ok) console.warn('[erp:auto-sync]', result.error);
  } finally {
    erpAutoSyncInFlight = false;
    erpReleaseAutoSyncLock();
    erpRefreshSyncStatus();
  }
}

function erpStartAutoSync() {
  if (erpAutoSyncTimer) {
    erpRefreshSyncStatus();
    return;
  }
  erpRefreshSyncStatus();
  setTimeout(erpRunAutoSync, 2000);
  erpAutoSyncTimer = setInterval(erpRunAutoSync, ERP_AUTO_SYNC_CHECK_MS);

  if (!erpAutoSyncListenersReady) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) erpRunAutoSync();
    });
    window.addEventListener('focus', erpRunAutoSync);
    erpAutoSyncListenersReady = true;
  }
}
