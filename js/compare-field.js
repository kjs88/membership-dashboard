// ════════════════════════════════════
// 비교 분석 (기간 / 영업사원 / 채널)
// ════════════════════════════════════
let cmpMode = 'period';   // period | person | channel

function setCmpMode(m) {
  cmpMode = m;
  document.querySelectorAll('.cmp-tab').forEach(b => b.classList.toggle('active', b.dataset.m === m));
  const dateWrap = document.getElementById('cmp-date-wrap');
  if (dateWrap) dateWrap.style.display = m === 'period' ? '' : 'none';
  renderCompare();
}

function cmpGroupOf(rows) {
  return {
    sales: sumSupply(rows), qty: sumQty(rows), count: rows.length,
    clients: new Set(rows.map(o => o.client).filter(Boolean)).size, rows,
  };
}

function cmpBuildGroups(rows) {
  if (cmpMode === 'person') {
    return erpPersonNames('office')
      .map(n => Object.assign({ name: n }, cmpGroupOf(rows.filter(o => o.person === n))))
      .sort((a, b) => b.sales - a.sales);
  }
  if (cmpMode === 'channel') {
    return [['office', '사업소'], ['dist', '유통사']].map(([ch, label]) =>
      Object.assign({ name: label }, cmpGroupOf(rows.filter(o => orderChannel(o) === ch))));
  }
  // 기간 비교: 선택 구간과 직전 동일 길이 구간
  const inRange = (from, to) => rows.filter(o => o.date && o.date >= from && o.date <= to);
  let from = document.getElementById('cmp-date-from')?.value || '';
  let to = document.getElementById('cmp-date-to')?.value || '';
  if (!from || !to) {
    const now = new Date();
    from = ymLocal(now) + '-01';
    to = todayYmd();
  }
  const days = Math.round((new Date(from + 'T00:00:00') - new Date(to + 'T00:00:00')) / 86400000) * -1 + 1;
  const pTo = ymdLocal(new Date(new Date(from + 'T00:00:00').getTime() - 86400000));
  const pFrom = ymdLocal(new Date(new Date(pTo + 'T00:00:00').getTime() - (days - 1) * 86400000));
  return [
    Object.assign({ name: pFrom + ' ~ ' + pTo + ' (직전)' }, cmpGroupOf(inRange(pFrom, pTo))),
    Object.assign({ name: from + ' ~ ' + to + ' (선택)' }, cmpGroupOf(inRange(from, to))),
  ];
}

function renderCompare() {
  const host = document.getElementById('cmp-body');
  if (!host) return;
  const rows = allOrders || [];
  if (!rows.length) {
    host.innerHTML = emptyState('비교할 매출 데이터가 없습니다', 'ERP 동기화 후 다시 확인해 주세요', '📊');
    return;
  }
  const groups = cmpBuildGroups(rows);
  if (!groups.length) {
    host.innerHTML = emptyState('비교할 대상이 없습니다', '기간이나 기준을 바꿔 보세요', '📊');
    return;
  }

  const max = Math.max.apply(null, groups.map(g => g.sales).concat([1]));
  const base = groups[0].sales;

  const cards = groups.map((g, i) => {
    const diff = (i > 0 && base > 0) ? Math.round((g.sales - base) / base * 100) : null;
    const diffHtml = diff === null ? ''
      : '<span class="cmp-diff ' + (diff >= 0 ? 'up' : 'down') + '">' +
        (diff >= 0 ? '▲' : '▼') + ' ' + Math.abs(diff) + '%</span>';
    return '<div class="cmp-card">' +
      '<div class="cmp-name">' + escHtml(g.name) + diffHtml + '</div>' +
      '<div class="cmp-val" title="' + Math.round(g.sales).toLocaleString() + '원">' +
        moneyShort(g.sales) + '<em>원</em></div>' +
      '<div class="cmp-bar"><i style="width:' + Math.round(g.sales / max * 100) + '%"></i></div>' +
      '<div class="cmp-meta"><span>수량 <b>' + g.qty.toLocaleString() + '</b></span>' +
        '<span>거래처 <b>' + g.clients + '</b></span>' +
        '<span>건수 <b>' + g.count.toLocaleString() + '</b></span></div>' +
      '</div>';
  }).join('');

  // 품목 교차 비교 (상위 8)
  const prodSet = {};
  groups.forEach((g, gi) => {
    g.rows.forEach(o => {
      if (!o.product || /할인/.test(o.product)) return;
      if (!prodSet[o.product]) prodSet[o.product] = new Array(groups.length).fill(0);
      prodSet[o.product][gi] += parseFloat(o.supply) || 0;
    });
  });
  const topProd = Object.entries(prodSet)
    .sort((a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0))
    .slice(0, 8);

  let table = '';
  if (topProd.length) {
    const th = groups.map(g => '<th class="r">' + escHtml(g.name) + '</th>').join('');
    const body = topProd.map(row => {
      const tds = row[1].map((v, i) =>
        '<td class="r" data-label="' + escHtml(groups[i].name) + '" title="' +
        Math.round(v).toLocaleString() + '원">' + moneyShort(v) + '</td>').join('');
      return '<tr><td data-label="품목">' + escHtml(row[0]) + '</td>' + tds + '</tr>';
    }).join('');
    table = '<div class="chart-card" style="margin-top:16px">' +
      '<div class="chart-card-title">품목별 비교 (상위 8)</div>' +
      '<div class="cmp-tablewrap"><table class="cmp-table mob-cards"><thead><tr><th>품목</th>' +
      th + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }

  host.innerHTML = '<div class="cmp-grid">' + cards + '</div>' + table;
}

// ════════════════════════════════════
// 모바일 현장 모드
// ════════════════════════════════════
function fieldOverdueClients(limit) {
  const seen = [...new Set((allOrders || []).map(o => o.client).filter(Boolean))];
  const out = [];
  seen.forEach(c => {
    const cyc = clientPurchaseCycle(c, allOrders);
    if (cyc.avgGap && cyc.count >= 3 && cyc.overdueDays > Math.max(7, cyc.avgGap * 0.5)) {
      out.push({ c, over: cyc.overdueDays, avg: cyc.avgGap, last: cyc.lastDate });
    }
  });
  out.sort((a, b) => b.over - a.over);
  return limit ? out.slice(0, limit) : out;
}

function fieldItem(title, sub, onclickName, tag, tagClass) {
  return '<div class="fld-item" onclick="openClient360(\'' + escInlineJs(onclickName) + '\')">' +
    '<div><b>' + escHtml(title) + '</b><span>' + escHtml(sub) + '</span></div>' +
    '<em class="' + (tagClass || '') + '">' + escHtml(tag) + '</em></div>';
}

function renderField() {
  const host = document.getElementById('field-body');
  if (!host) return;
  const today = todayYmd();
  const me = currentUser ? (currentUser.name || '') : '';

  const planned = (allRevisits || [])
    .filter(r => !r.done && r.date && r.date <= today)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const doneToday = (allEntries || []).filter(e => e.date === today &&
    (!me || e.person === me || (currentUser && e.personId === currentUser.id)));

  const overdue = fieldOverdueClients(8);

  const plannedHtml = planned.length
    ? planned.slice(0, 10).map(r => fieldItem(r.institution || '거래처', '재방문 예정 ' + (r.date || ''), r.institution || '', '›', '')).join('')
    : emptyState('예정된 재방문이 없습니다', '일지 작성 시 재방문일을 지정하면 여기에 모입니다', '📅');

  const overdueHtml = overdue.length
    ? overdue.map(o => fieldItem(o.c, '평소 ' + o.avg + '일 주기 · 마지막 거래 ' + o.last, o.c, o.over + '일', 'warn')).join('')
    : emptyState('지연된 거래처가 없습니다', '재구매 주기를 넘긴 거래처가 생기면 여기에 표시됩니다', '✅');

  const doneHtml = doneToday.length
    ? doneToday.map(e => fieldItem(e.institution || '', (e.clientType || '') + ' · 가능성 ' + (e.dealPossibility || '-'), e.institution || '', '›', '')).join('')
    : emptyState('오늘 기록한 방문이 없습니다', '위의 “일지 쓰기”로 바로 기록할 수 있습니다', '📝');

  host.innerHTML =
    '<div class="fld-hello"><b>' + escHtml(me || '오늘 일정') + '</b>' +
      '<span>' + today + ' · 오늘 ' + doneToday.length + '건 기록</span></div>' +
    '<div class="fld-actions">' +
      '<button class="fld-btn primary" onclick="showPage(\'input\')">📝 일지 쓰기</button>' +
      '<button class="fld-btn" onclick="openGlobalSearch()">🔍 거래처 찾기</button></div>' +
    '<div class="fld-sec"><h3>오늘 방문할 곳 <span>' + planned.length + '</span></h3>' + plannedHtml + '</div>' +
    '<div class="fld-sec"><h3>연락 우선순위 <span>' + overdue.length + '</span></h3>' + overdueHtml + '</div>' +
    '<div class="fld-sec"><h3>오늘 기록한 방문 <span>' + doneToday.length + '</span></h3>' + doneHtml + '</div>';
}
