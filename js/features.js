// ════════════════════════════════════
// 공통 UI 유틸 — 빈 상태 / 금액 포맷
// ════════════════════════════════════

// 빈 상태는 "왜 비었는지 + 다음에 뭘 하면 되는지"를 함께 보여준다.
function emptyState(title, action, icon) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon || '📭'}</div>
    <div class="empty-title">${escHtml(title)}</div>
    ${action ? `<div class="empty-action">${escHtml(action)}</div>` : ''}
  </div>`;
}

// 금액을 억/만 단위로 축약. 정확한 값은 title 속성으로 남긴다.
function moneyShort(v) {
  const n = Math.round(parseFloat(v) || 0);
  const a = Math.abs(n);
  if (a >= 100000000) return (n / 100000000).toFixed(a >= 1000000000 ? 0 : 1).replace(/\.0$/, '') + '억';
  if (a >= 10000) return Math.round(n / 10000).toLocaleString() + '만';
  return n.toLocaleString();
}
function moneyCell(v) {
  const n = Math.round(parseFloat(v) || 0);
  return `<span title="${n.toLocaleString()}원">${moneyShort(n)}</span>`;
}

// ════════════════════════════════════
// 전역 검색 (Ctrl+K)
// ════════════════════════════════════
let _gsIndex = null, _gsSel = 0, _gsResults = [];

function gsBuildIndex() {
  const items = [];
  const seen = new Set();

  // 거래처 — ERP 매출과 등록 거래처 양쪽에서
  const clientAgg = {};
  (allOrders || []).forEach(o => {
    if (!o.client) return;
    if (!clientAgg[o.client]) clientAgg[o.client] = 0;
    clientAgg[o.client] += parseFloat(o.supply) || 0;
  });
  Object.entries(clientAgg).forEach(([name, amt]) => {
    if (seen.has('c:' + name)) return;
    seen.add('c:' + name);
    items.push({ type: 'client', label: name, sub: '거래처 · ' + moneyShort(amt) + '원', key: name });
  });
  (allClients || []).forEach(c => {
    if (!c.name || seen.has('c:' + c.name)) return;
    seen.add('c:' + c.name);
    items.push({ type: 'client', label: c.name, sub: '거래처' + (c.region ? ' · ' + c.region : ''), key: c.name });
  });

  // 품목
  const prodAgg = {};
  (allOrders || []).forEach(o => {
    if (!o.product) return;
    prodAgg[o.product] = (prodAgg[o.product] || 0) + (parseFloat(o.supply) || 0);
  });
  Object.entries(prodAgg).forEach(([name, amt]) => {
    items.push({ type: 'product', label: name, sub: '품목 · ' + moneyShort(amt) + '원', key: name });
  });

  // 영업일지
  (allEntries || []).forEach(e => {
    if (!e.institution) return;
    items.push({
      type: 'entry', label: e.institution,
      sub: `일지 · ${e.date || ''} ${e.person || ''}`.trim(), key: e.institution,
    });
  });

  // 메뉴
  [['sales','대시보드'],['stats','실적 분석'],['products','품목별 분석'],['dash','영업현황'],
   ['grade','거래처 등급'],['clients','거래처 DB'],['project','프로젝트 관리'],['compare','비교 분석'],
   ['input','일간일지'],['weekly','주간일지'],['users','계정 관리'],['targets','목표 설정']]
    .forEach(([page, label]) => items.push({ type: 'page', label, sub: '메뉴로 이동', key: page }));

  return items;
}

function openGlobalSearch() {
  _gsIndex = gsBuildIndex();
  _gsSel = 0;
  const m = document.getElementById('gs-modal');
  if (!m) return;
  m.classList.add('on');
  const input = document.getElementById('gs-input');
  if (input) { input.value = ''; input.focus(); }
  gsRender('');
}
function closeGlobalSearch() {
  const m = document.getElementById('gs-modal');
  if (m) m.classList.remove('on');
}

function gsRender(q) {
  const box = document.getElementById('gs-results');
  if (!box) return;
  const query = String(q || '').trim().toLowerCase();
  if (!query) {
    _gsResults = _gsIndex.filter(i => i.type === 'page');
  } else {
    const scored = [];
    for (const it of _gsIndex) {
      const l = it.label.toLowerCase();
      const idx = l.indexOf(query);
      if (idx < 0) continue;
      // 앞에서 일치할수록, 짧을수록 위로
      scored.push({ it, score: idx * 10 + Math.min(l.length, 60) });
      if (scored.length > 400) break;
    }
    scored.sort((a, b) => a.score - b.score);
    _gsResults = scored.slice(0, 30).map(s => s.it);
  }
  if (_gsSel >= _gsResults.length) _gsSel = 0;

  if (!_gsResults.length) {
    box.innerHTML = `<div class="gs-empty">"${escHtml(q)}"에 해당하는 결과가 없습니다<br><span>거래처명, 품목명, 기관명으로 검색해 보세요</span></div>`;
    return;
  }
  const icon = { client: '🏢', product: '📦', entry: '📝', page: '🧭' };
  box.innerHTML = _gsResults.map((r, i) => `
    <div class="gs-item${i === _gsSel ? ' sel' : ''}" data-i="${i}" onmousedown="gsPick(${i})" onmouseenter="gsHover(${i})">
      <span class="gs-ic">${icon[r.type] || '•'}</span>
      <span class="gs-label">${escHtml(r.label)}</span>
      <span class="gs-sub">${escHtml(r.sub)}</span>
    </div>`).join('');
}

function gsHover(i) {
  _gsSel = i;
  document.querySelectorAll('.gs-item').forEach((el, n) => el.classList.toggle('sel', n === i));
}

function gsPick(i) {
  const r = _gsResults[i];
  if (!r) return;
  closeGlobalSearch();
  if (r.type === 'page') { showPage(r.key); return; }
  if (r.type === 'client' || r.type === 'entry') { openClient360(r.key); return; }
  if (r.type === 'product') {
    showPage('products');
    const s = document.getElementById('prod-search');
    if (s) { s.value = r.key; if (typeof renderProducts === 'function') renderProducts(); }
  }
}

function gsKeydown(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); _gsSel = Math.min(_gsSel + 1, _gsResults.length - 1); gsHover(_gsSel); scrollGsIntoView(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _gsSel = Math.max(_gsSel - 1, 0); gsHover(_gsSel); scrollGsIntoView(); }
  else if (e.key === 'Enter') { e.preventDefault(); gsPick(_gsSel); }
  else if (e.key === 'Escape') { closeGlobalSearch(); }
}
function scrollGsIntoView() {
  const el = document.querySelector('.gs-item.sel');
  if (el) el.scrollIntoView({ block: 'nearest' });
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    if (!currentUser) return;
    e.preventDefault();
    const m = document.getElementById('gs-modal');
    if (m && m.classList.contains('on')) closeGlobalSearch(); else openGlobalSearch();
  }
});

// ════════════════════════════════════
// 거래처 360° 상세
// ════════════════════════════════════
let _c360Name = '';

// 거래처별 주문 이력에서 재구매 주기를 계산한다.
// 같은 날 여러 건은 1회 거래로 묶는다.
function clientPurchaseCycle(name, rows) {
  const days = [...new Set((rows || [])
    .filter(o => o.client === name && o.date && (parseFloat(o.supply) || 0) > 0)
    .map(o => o.date))].sort();
  if (days.length < 2) return { count: days.length, avgGap: null, lastDate: days[0] || '', overdueDays: null, gaps: [] };
  const gaps = [];
  for (let i = 1; i < days.length; i++) {
    const g = Math.round((new Date(days[i] + 'T00:00:00') - new Date(days[i - 1] + 'T00:00:00')) / 86400000);
    if (g > 0) gaps.push(g);
  }
  const avgGap = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;
  const lastDate = days[days.length - 1];
  const sinceLast = Math.round((new Date(todayYmd() + 'T00:00:00') - new Date(lastDate + 'T00:00:00')) / 86400000);
  return {
    count: days.length, avgGap, lastDate, gaps,
    sinceLast, overdueDays: avgGap ? sinceLast - avgGap : null,
  };
}

function openClient360(name) {
  _c360Name = name;
  const rows = (allOrders || []).filter(o => o.client === name);
  const entries = (allEntries || []).filter(e => e.institution === name)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const cyc = clientPurchaseCycle(name, allOrders);

  const titleEl = document.getElementById('c360-title');
  if (titleEl) titleEl.textContent = name;

  const total = sumSupply(rows);
  const qty = sumQty(rows);
  const months = {};
  rows.forEach(o => { const m = (o.date || '').slice(0, 7); if (m) months[m] = (months[m] || 0) + (parseFloat(o.supply) || 0); });
  const monthKeys = Object.keys(months).sort();

  // 주력 품목 TOP5
  const prod = {};
  rows.forEach(o => { if (o.product) prod[o.product] = (prod[o.product] || 0) + (parseFloat(o.supply) || 0); });
  const topProd = Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 미출고 잔량 (주문 - 출고)
  const ordQ = {}, shpQ = {};
  (allOrderOrders || []).forEach(o => { if (o.client === name && o.product) ordQ[o.product] = (ordQ[o.product] || 0) + (parseFloat(o.qty) || 0); });
  (allShipOrders || []).forEach(o => { if (o.client === name && o.product) shpQ[o.product] = (shpQ[o.product] || 0) + (parseFloat(o.qty) || 0); });
  const backorder = Object.keys(ordQ)
    .map(p => ({ p, gap: Math.round(ordQ[p] - (shpQ[p] || 0)) }))
    .filter(x => x.gap > 0 && !/할인/.test(x.p))
    .sort((a, b) => b.gap - a.gap).slice(0, 5);

  const person = rows.length ? (rows[rows.length - 1].person || '-') : '-';
  const cycText = cyc.avgGap
    ? `평균 ${cyc.avgGap}일 주기 · 마지막 거래 ${cyc.sinceLast}일 전`
    : (cyc.lastDate ? `거래 1회 (${cyc.lastDate})` : '거래 이력 없음');
  const overdue = cyc.overdueDays != null && cyc.overdueDays > 0;

  const body = document.getElementById('c360-body');
  if (!body) return;
  body.innerHTML = `
    <div class="c360-kpis">
      <div class="c360-kpi"><span>누적 매출</span><b title="${Math.round(total).toLocaleString()}원">${moneyShort(total)}원</b></div>
      <div class="c360-kpi"><span>거래 횟수</span><b>${cyc.count}회</b></div>
      <div class="c360-kpi"><span>총 수량</span><b>${qty.toLocaleString()}개</b></div>
      <div class="c360-kpi"><span>담당</span><b style="font-size:15px">${escHtml(person)}</b></div>
    </div>
    <div class="c360-cycle${overdue ? ' warn' : ''}">
      <span>${overdue ? '⚠️ 연락 필요' : '🔄 재구매 주기'}</span>
      <b>${escHtml(cycText)}</b>
      ${overdue ? `<em>평소보다 ${cyc.overdueDays}일 지연</em>` : ''}
    </div>

    <div class="c360-grid">
      <div>
        <h4>월별 매출</h4>
        ${monthKeys.length ? `<div class="c360-spark">${monthKeys.map(m => {
          const max = Math.max(...monthKeys.map(k => months[k]));
          const h = max > 0 ? Math.max(3, Math.round(months[m] / max * 54)) : 3;
          return `<div class="c360-bar" title="${m} · ${Math.round(months[m]).toLocaleString()}원"><i style="height:${h}px"></i><span>${m.slice(5)}</span></div>`;
        }).join('')}</div>` : emptyState('매출 데이터가 없습니다', 'ERP 동기화 후 표시됩니다', '📈')}
      </div>
      <div>
        <h4>주력 품목</h4>
        ${topProd.length ? `<ul class="c360-list">${topProd.map(([p, v]) =>
          `<li><span>${escHtml(p)}</span><b title="${Math.round(v).toLocaleString()}원">${moneyShort(v)}</b></li>`).join('')}</ul>`
          : emptyState('품목 데이터가 없습니다', '', '📦')}
      </div>
      <div>
        <h4>미출고 잔량</h4>
        ${backorder.length ? `<ul class="c360-list">${backorder.map(b =>
          `<li><span>${escHtml(b.p)}</span><b class="neg">${b.gap.toLocaleString()}개</b></li>`).join('')}</ul>`
          : `<div class="c360-ok">미출고 없음</div>`}
      </div>
      <div>
        <h4>최근 방문</h4>
        ${entries.length ? `<ul class="c360-list">${entries.slice(0, 5).map(e =>
          `<li><span>${escHtml(e.date || '')} ${escHtml(e.person || '')}</span><b>${escHtml(e.dealPossibility || '-')}</b></li>`).join('')}</ul>`
          : emptyState('방문 기록이 없습니다', '일간일지에서 방문을 기록해 보세요', '📝')}
      </div>
    </div>`;

  openModal('modal-c360');
}

// ════════════════════════════════════
// 알림 센터
// ════════════════════════════════════
function buildAlerts() {
  const alerts = [];
  const today = todayYmd();

  // 1) 재방문 예정
  (allRevisits || []).filter(r => !r.done && r.date && r.date <= today).forEach(r => {
    alerts.push({ sev: 'warn', icon: '📅', title: '재방문 예정일 경과',
      desc: `${r.institution || '거래처'} · ${r.date}`, action: () => showPage('revisit') });
  });

  // 2) 재구매 주기 초과 거래처 (상위 5)
  const clients = [...new Set((allOrders || []).map(o => o.client).filter(Boolean))];
  const overdue = [];
  clients.forEach(c => {
    const cyc = clientPurchaseCycle(c, allOrders);
    if (cyc.avgGap && cyc.count >= 3 && cyc.overdueDays > Math.max(7, cyc.avgGap * 0.5)) {
      overdue.push({ c, over: cyc.overdueDays, avg: cyc.avgGap });
    }
  });
  overdue.sort((a, b) => b.over - a.over).slice(0, 5).forEach(o => {
    alerts.push({ sev: 'crit', icon: '⚠️', title: '재구매 주기 초과',
      desc: `${o.c} · 평소 ${o.avg}일인데 ${o.over}일 지연`, action: () => openClient360(o.c) });
  });

  // 3) 이번달 목표 진척
  const ym = today.slice(0, 7);
  const monthSales = sumSupply((allOrders || []).filter(o => (o.date || '').startsWith(ym)));
  const tgt = parseFloat(targets?.salesTarget) || 0;
  if (tgt > 0) {
    const pct = Math.round(monthSales / tgt * 100);
    const day = new Date().getDate();
    const monthDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const expected = Math.round(day / monthDays * 100);
    if (pct < expected - 10) {
      alerts.push({ sev: 'warn', icon: '🎯', title: '매출 목표 진척 부족',
        desc: `달성 ${pct}% (이 시점 기대 ${expected}%)`, action: () => showPage('sales') });
    }
  }

  // 4) 장기 미출고
  const ordQ = {}, shpQ = {};
  (allOrderOrders || []).forEach(o => { const k = o.client + '|' + o.product; if (o.client && o.product && !/할인/.test(o.product)) ordQ[k] = (ordQ[k] || 0) + (parseFloat(o.qty) || 0); });
  (allShipOrders || []).forEach(o => { const k = o.client + '|' + o.product; if (o.client && o.product) shpQ[k] = (shpQ[k] || 0) + (parseFloat(o.qty) || 0); });
  const backCount = Object.keys(ordQ).filter(k => ordQ[k] - (shpQ[k] || 0) > 0).length;
  if (backCount > 0) {
    alerts.push({ sev: 'info', icon: '📦', title: '미출고 잔량 있음',
      desc: `${backCount.toLocaleString()}개 거래처×품목 조합`, action: () => showPage('sales') });
  }

  return alerts;
}

let _alerts = [];
function renderAlertBadge() {
  _alerts = buildAlerts();
  const b = document.getElementById('alert-badge');
  if (!b) return;
  const n = _alerts.filter(a => a.sev !== 'info').length;
  b.textContent = n > 99 ? '99+' : n;
  b.style.display = n > 0 ? '' : 'none';
}

function toggleAlertPanel() {
  const p = document.getElementById('alert-panel');
  if (!p) return;
  if (p.classList.contains('on')) { p.classList.remove('on'); return; }
  _alerts = buildAlerts();
  const body = document.getElementById('alert-list');
  if (body) {
    body.innerHTML = _alerts.length
      ? _alerts.map((a, i) => `
        <div class="alert-item ${a.sev}" onclick="alertGo(${i})">
          <span class="alert-ic">${a.icon}</span>
          <div><b>${escHtml(a.title)}</b><span>${escHtml(a.desc)}</span></div>
        </div>`).join('')
      : emptyState('지금 확인할 알림이 없습니다', '재방문 예정·목표 진척·미출고를 자동으로 감시합니다', '✅');
  }
  p.classList.add('on');
}
function alertGo(i) {
  const a = _alerts[i];
  document.getElementById('alert-panel')?.classList.remove('on');
  if (a && typeof a.action === 'function') a.action();
}
document.addEventListener('click', e => {
  const p = document.getElementById('alert-panel');
  if (p && p.classList.contains('on') && !e.target.closest('#alert-panel') && !e.target.closest('#alert-btn')) {
    p.classList.remove('on');
  }
});
