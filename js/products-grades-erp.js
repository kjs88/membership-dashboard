// PRODUCTS PAGE
// ════════════════════════════════════
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
let gradeOverrides = getShared('sj-grade-overrides', {}); // {clientName: gradeId|'auto'}

function getAutoGrade(sales) {
  const tiers = [...gradeTiers].sort((a,b)=>b.min-a.min);
  for (const t of tiers) { if (sales >= t.min) return t; }
  return tiers[tiers.length-1] || null;
}


function addGradeTier() {
  gradeTiers.push({id:'g'+Date.now(), name:'새등급', color:'#7856C8', min:0});
  renderGradeSettings(); renderGrade();
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
function renderProducts() {
  updateOrderBasisUI();
  const personF = document.getElementById('prod-filter-person')?.value || 'all';
  let catF      = document.getElementById('prod-filter-category')?.value || 'all';
  const sortV   = document.getElementById('prod-sort')?.value || 'supply-desc';
  const searchV = (document.getElementById('prod-search')?.value || '').toLowerCase();

  // 날짜 필터 (prod-date-from / prod-date-to)
  const dateFrom = document.getElementById('prod-date-from')?.value || '';
  const dateTo   = document.getElementById('prod-date-to')?.value || '';

  // 영업사원 필터 옵션 동적 갱신
  const pSel = document.getElementById('prod-filter-person');
  if (pSel && pSel.options.length <= 1) {
    allUsers.filter(u => u.role === 'user').forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id; opt.textContent = u.name;
      pSel.appendChild(opt);
    });
  }

  // 대분류 필터 옵션 동적 갱신
  const cSel = document.getElementById('prod-filter-category');
  if (cSel) {
    const curCat = cSel.value || 'all';
    cSel.innerHTML = '<option value="all">전체</option>';
    const cats = [...new Set(allOrders.map(o => o.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      cSel.appendChild(opt);
    });
    cSel.value = cats.includes(curCat) ? curCat : 'all';
    catF = cSel.value || 'all';
  }

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

  let list = Object.values(map).map(r => ({ name: r.name, category: r.category, qty: r.qty, sales: r.sales, clientCount: r.clients.size }));

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
}

function renderGradeSettings() {
  const el = document.getElementById('grade-settings-list');
  if (!el) return;
  el.innerHTML = gradeTiers.map((t,i) => `
    <div class="grade-tier-row" style="display:flex;align-items:center;gap:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px">
      <input type="color" class="gt-color" value="${safeColor(t.color)}" style="width:32px;height:32px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none" />
      <input class="gt-name form-input" value="${escHtml(t.name)}" placeholder="등급명" style="width:100px;font-weight:600" />
      <span style="font-size:12px;color:var(--text2);white-space:nowrap">월 매출</span>
      <input class="gt-min form-input" type="number" value="${t.min}" placeholder="0" style="width:90px;font-family:var(--mono)" />
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

function getClientGrade(salesAmt) {
  return getAutoGrade(salesAmt);
}

function renderGrade() {
  updateOrderBasisUI();
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

  // ERP 기반(원단위) → 만원 단위로 변환해서 집계
  const useErp = allOrders && allOrders.length > 0;
  const salesMap = {};
  if (useErp) {
    allOrders.forEach(o => {
      const d = o.date || '';
      if (dateFrom && d < dateFrom) return;
      if (dateTo   && d > dateTo)   return;
      const k = o.client || '(미입력)';
      salesMap[k] = (salesMap[k] || 0) + Math.round((parseFloat(o.supply) || 0) / 10000);
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
// ERP 주문 업로드
// ════════════════════════════════════
let erpParsedByBasis = { order: [], ship: [] };

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

  const existingOrder = getShared('sj-orders-order', []);
  const existingShip = getShared('sj-orders-ship', getShared('sj-orders', []));

  const mergedOrder = erpMergeByDate(existingOrder, parsedOrder);
  const mergedShip = erpMergeByDate(existingShip, parsedShip);
  setShared('sj-orders-order', mergedOrder);
  setShared('sj-orders-ship', mergedShip);
  setShared('sj-orders', mergedShip);
  allOrderOrders = mergedOrder;
  allShipOrders = mergedShip;
  applyOrderBasis();
  rerenderOrderBasisPages();

  closeModal('modal-erp-upload');
  showToast(`ERP 데이터 저장 완료 · 주문 ${parsedOrder.length.toLocaleString()}건 / 출고 ${parsedShip.length.toLocaleString()}건`, 'success');
  erpResetUploadState();
}
