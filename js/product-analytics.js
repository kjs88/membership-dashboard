// ════════════════════════════════════
// 품목 분석 — 포트폴리오 / 확산도 / 리스크
//   성장률은 "완료된 달"만으로 계산한다.
//   진행 중인 이번 달을 그대로 넣으면 모든 품목이 감소한 것처럼 보인다.
// ════════════════════════════════════

let paTab = 'portfolio';

function showProdTab2(id) {
  paTab = id;
  document.querySelectorAll('.ptab').forEach(b => b.classList.toggle('active', b.dataset.t === id));
  document.querySelectorAll('.ptab-pane').forEach(p => {
    p.style.display = (p.id === 'ptab-' + id) ? '' : 'none';
  });
  if (id === 'inventory' && typeof renderProdAbc === 'function') renderProdAbc();
  if (id !== 'inventory') renderProductAnalytics();
}

// 현재 필터(품목 페이지)를 적용한 행. 할인·조정 라인은 품목이 아니므로 제외.
function paRows() {
  const personF = (typeof productPersonId !== 'undefined') ? (productPersonId || 'all') : 'all';
  const catF = (typeof productCategoryId !== 'undefined') ? (productCategoryId || 'all') : 'all';
  const searchV = (document.getElementById('prod-search') ? document.getElementById('prod-search').value : '').toLowerCase();
  return (allOrders || []).filter(o => {
    if (!caIsProductRow(o) || !o.date) return false;
    if (personF !== 'all' && o.person !== personF) return false;
    if (catF !== 'all' && (o.category || '') !== catF) return false;
    if (searchV && !String(o.product).toLowerCase().includes(searchV)) return false;
    return true;
  });
}

// 완료된 달만 반환. 데이터의 마지막 달이 이번 달이면 진행 중이므로 뺀다.
function paCompleteMonths(rows) {
  const months = [...new Set(rows.map(o => (o.date || '').slice(0, 7)).filter(Boolean))].sort();
  const thisMonth = todayYmd().slice(0, 7);
  const partial = months.length && months[months.length - 1] === thisMonth;
  return { months: partial ? months.slice(0, -1) : months, excluded: partial ? thisMonth : null };
}

// 품목별 지표 일괄 계산
function paAnalyze(rows) {
  const { months, excluded } = paCompleteMonths(rows);
  const win = Math.min(3, Math.floor(months.length / 2)) || 0;
  const recent = win ? months.slice(-win) : [];
  const prior = win ? months.slice(-win * 2, -win) : [];
  const recentSet = new Set(recent), priorSet = new Set(prior);

  const clientsAll = new Set(rows.map(o => o.client).filter(Boolean));
  const N = clientsAll.size;

  const m = {};
  rows.forEach(o => {
    const k = o.product;
    if (!m[k]) m[k] = { name: k, category: (o.category || '').trim(), sales: 0, qty: 0, count: 0,
                        clients: new Set(), byClient: {}, rec: 0, pri: 0, first: null, last: null, byMonth: {} };
    const a = m[k], ym = (o.date || '').slice(0, 7), v = parseFloat(o.supply) || 0;
    a.sales += v; a.qty += parseFloat(o.qty) || 0; a.count += 1;
    if (o.client) { a.clients.add(o.client); a.byClient[o.client] = (a.byClient[o.client] || 0) + v; }
    if (recentSet.has(ym)) a.rec += v;
    if (priorSet.has(ym)) a.pri += v;
    a.byMonth[ym] = (a.byMonth[ym] || 0) + v;
    if (!a.first || o.date < a.first) a.first = o.date;
    if (!a.last || o.date > a.last) a.last = o.date;
  });

  const items = Object.values(m).filter(a => a.sales > 0).map(a => {
    const vals = Object.values(a.byClient).sort((x, y) => y - x);
    const top3 = a.sales > 0 ? vals.slice(0, 3).reduce((s, v) => s + v, 0) / a.sales * 100 : 0;
    // 성장률: 이전 기간에 매출이 없으면 '신규'로 표시(무한대 방지)
    const growth = a.pri > 0 ? (a.rec - a.pri) / a.pri * 100 : (a.rec > 0 ? null : 0);
    return {
      name: a.name, category: a.category, sales: a.sales, qty: a.qty, count: a.count,
      clientCount: a.clients.size, penetration: N ? a.clients.size / N * 100 : 0,
      top3Share: top3, growth, rec: a.rec, pri: a.pri,
      first: a.first, last: a.last, byMonth: a.byMonth,
      avgPrice: a.qty > 0 ? a.sales / a.qty : 0,
    };
  }).sort((x, y) => y.sales - x.sales);

  const total = items.reduce((s, i) => s + i.sales, 0);
  // 4분면 경계는 중앙값 — 절대 기준을 쓰면 품목군마다 왜곡된다
  const gVals = items.filter(i => i.growth !== null).map(i => i.growth).sort((a, b) => a - b);
  const sVals = items.map(i => i.sales).sort((a, b) => a - b);
  const medGrowth = gVals.length ? gVals[Math.floor(gVals.length / 2)] : 0;
  const medSales = sVals.length ? sVals[Math.floor(sVals.length / 2)] : 0;

  items.forEach(i => {
    const g = i.growth === null ? Infinity : i.growth;
    const hiG = g > medGrowth, hiS = i.sales > medSales;
    i.quadrant = hiG && hiS ? 'star' : (!hiG && hiS) ? 'cash' : hiG ? 'question' : 'dog';
  });

  return { items, total, months, excluded, recent, prior, medGrowth, medSales, clientCount: N };
}

const PA_QUAD = {
  star: { label: '밀어야 할 품목', short: '밀 것', color: '#00A582',
          desc: '매출도 크고 계속 늘고 있음 — 재고와 공급을 먼저 확보' },
  cash: { label: '지켜야 할 품목', short: '지킬 것', color: '#2B72C8',
          desc: '매출은 큰데 성장이 멈춤 — 이탈·가격 방어가 필요' },
  question: { label: '키워볼 품목', short: '키울 것', color: '#E8900A',
          desc: '아직 작지만 빠르게 크는 중 — 밀어줄지 판단' },
  dog: { label: '정리 검토 품목', short: '뺄 것', color: '#8A9A94',
          desc: '작고 성장도 없음 — 단종·재고 축소 검토' },
};

// ────────────────────────────────
// 렌더
// ────────────────────────────────
function renderProductAnalytics() {
  const rows = paRows();
  const a = paAnalyze(rows);
  const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html || ''; };

  if (!a.items.length) {
    ['pa-portfolio', 'pa-spread', 'pa-risk'].forEach(id =>
      put(id, emptyState('조건에 맞는 품목이 없습니다', '기간·품목군·검색어를 바꿔 보세요', '📦')));
    return;
  }

  const partialNote = a.excluded
    ? '<div class="da-note"><b>' + a.excluded + '은 아직 진행 중</b>이라 성장률 계산에서 제외했습니다. '
      + '미완성 달을 넣으면 모든 품목이 감소한 것처럼 보이기 때문입니다. '
      + '비교 구간: <b>' + (a.prior[0] || '-') + '~' + (a.prior[a.prior.length - 1] || '-') + '</b> → <b>'
      + (a.recent[0] || '-') + '~' + (a.recent[a.recent.length - 1] || '-') + '</b></div>'
    : '';

  // ── 포트폴리오: 이름이 항상 보이는 목록 중심 ──
  const counts = { star: 0, cash: 0, question: 0, dog: 0 };
  const sums = { star: 0, cash: 0, question: 0, dog: 0 };
  a.items.forEach(i => { counts[i.quadrant]++; sums[i.quadrant] += i.sales; });

  // 증감액 기준 — "무엇이 늘고 무엇이 줄었나"가 이 페이지의 핵심 질문
  const moved = a.items.filter(i => i.growth !== null && (i.rec > 0 || i.pri > 0))
    .map(i => Object.assign({}, i, { diff: i.rec - i.pri }));
  const ups = moved.filter(i => i.diff > 0).sort((x, y) => y.diff - x.diff).slice(0, 7);
  const downs = moved.filter(i => i.diff < 0).sort((x, y) => x.diff - y.diff).slice(0, 7);
  const maxDiff = Math.max.apply(null, [1].concat(ups.map(i => i.diff)).concat(downs.map(i => -i.diff)));

  const moveRow = (i, dir) => {
    const w = Math.max(2, Math.abs(i.diff) / maxDiff * 100);
    const pct = i.pri > 0 ? ((i.rec - i.pri) / i.pri * 100) : null;
    return '<div class="pa-move ' + dir + '">'
      + '<div class="pa-move-n" title="' + escHtml(i.name) + '">' + escHtml(i.name) + '</div>'
      + '<div class="pa-move-t"><i style="width:' + w.toFixed(0) + '%"></i></div>'
      + '<div class="pa-move-v">' + (i.diff >= 0 ? '+' : '−') + moneyShort(Math.abs(i.diff))
      + '<span>' + (pct === null ? '신규' : (pct >= 0 ? '+' : '') + Math.round(pct) + '%') + '</span></div>'
      + '</div>';
  };

  const headline = (ups.length || downs.length)
    ? '<div class="pa-lead">'
      + (ups[0] ? '<b class="up">' + escHtml(ups[0].name) + '</b>가 <b class="up">+' + moneyShort(ups[0].diff) + '</b>으로 가장 많이 늘었고, ' : '')
      + (downs[0] ? '<b class="down">' + escHtml(downs[0].name) + '</b>가 <b class="down">−' + moneyShort(-downs[0].diff) + '</b>으로 가장 많이 줄었습니다.' : '')
      + '</div>'
    : '';

  const quadCards = ['star', 'cash', 'question', 'dog'].map(k => {
    const list = a.items.filter(i => i.quadrant === k).slice(0, 5);
    return '<div class="pa-quad" style="border-left-color:' + PA_QUAD[k].color + '">'
      + '<div class="pa-quad-h"><b style="color:' + PA_QUAD[k].color + '">' + PA_QUAD[k].label + '</b>'
      + '<span>' + counts[k] + '종 · 매출 ' + (a.total ? (sums[k] / a.total * 100).toFixed(0) : 0) + '%</span></div>'
      + '<div class="pa-quad-d">' + PA_QUAD[k].desc + '</div>'
      + '<div class="pa-quad-l">' + list.map(i => {
          const pct = i.growth === null ? null : Math.round(i.growth);
          const tag = pct === null ? '<em class="up">신규</em>'
            : '<em class="' + (pct >= 0 ? 'up' : 'down') + '">' + (pct >= 0 ? '+' : '') + pct + '%</em>';
          return '<div class="pa-item"><span title="' + escHtml(i.name) + '">' + escHtml(i.name) + '</span>'
            + '<b>' + moneyShort(i.sales) + '</b>' + tag + '</div>';
        }).join('')
        + (counts[k] > 5 ? '<div class="da-more">외 ' + (counts[k] - 5) + '종</div>' : '') + '</div></div>';
  }).join('');

  put('pa-portfolio',
    partialNote + headline
    + '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">가장 많이 늘어난 품목 · 줄어든 품목</div>'
    + '<div class="chart-card-sub">막대 길이 = 증감 금액 (직전 동일 기간 대비)</div>'
    + '<div class="pa-moves">'
    + '<div><div class="pa-move-h up">늘어난 품목</div>'
      + (ups.length ? ups.map(i => moveRow(i, 'up')).join('') : '<div class="da-more">해당 품목 없음</div>') + '</div>'
    + '<div><div class="pa-move-h down">줄어든 품목</div>'
      + (downs.length ? downs.map(i => moveRow(i, 'down')).join('') : '<div class="da-more">해당 품목 없음</div>') + '</div>'
    + '</div></div>'
    + '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">무엇을 밀고 무엇을 뺄까</div>'
    + '<div class="chart-card-sub">매출 규모와 성장세를 함께 보고 네 갈래로 나눴습니다 (기준은 전체 품목의 중앙값)</div>'
    + '<div class="pa-quads">' + quadCards + '</div></div>');

  // ── 확산도 ──
  const top = a.items.slice(0, 40);
  const lowPen = top.filter(i => i.penetration < 15).sort((x, y) => y.sales - x.sales).slice(0, 10);
  const spreadRows = a.items.slice(0, 20).map(i => {
    const opportunity = a.clientCount - i.clientCount;
    return '<tr><td data-label="품목">' + escHtml(i.name) + '</td>'
      + '<td data-label="침투율" class="r">' + i.penetration.toFixed(1) + '%</td>'
      + '<td class="barcell">' + caBar(i.penetration, i.penetration < 15 ? 'var(--amber)' : 'var(--green)') + '</td>'
      + '<td data-label="거래처" class="r">' + i.clientCount + '</td>'
      + '<td data-label="미거래" class="r"><b class="da-op">' + opportunity + '</b></td>'
      + '<td data-label="매출" class="r" title="' + Math.round(i.sales).toLocaleString() + '원">' + moneyShort(i.sales) + '</td>'
      + '<td data-label="거래처당" class="r">' + moneyShort(i.clientCount ? i.sales / i.clientCount : 0) + '</td></tr>';
  }).join('');

  put('pa-spread',
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">품목 확산도</div>'
    + '<div class="chart-card-sub">전체 거래처 ' + a.clientCount + '곳 중 몇 곳이 이 품목을 사는지 · 미거래 거래처 수가 곧 확산 여지입니다</div>'
    + (lowPen.length
        ? '<div class="da-note"><b>매출은 큰데 침투율이 낮은 품목 ' + lowPen.length + '종</b> — '
          + lowPen.slice(0, 3).map(i => escHtml(i.name) + '(' + i.penetration.toFixed(0) + '%, ' + moneyShort(i.sales) + '원)').join(', ')
          + '. 소수 거래처가 많이 사는 구조라, 다른 거래처로 넓힐 여지가 있는지 확인해 볼 만합니다.</div>'
        : '')
    + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th>품목</th>'
    + '<th class="r">침투율</th><th></th><th class="r">거래처</th><th class="r">미거래</th>'
    + '<th class="r">매출</th><th class="r">거래처당</th></tr></thead><tbody>' + spreadRows + '</tbody></table></div></div>');

  // ── 리스크 ──
  const dep = a.items.filter(i => i.top3Share >= 60 && i.clientCount >= 2).slice(0, 12);
  const lastComplete = a.months[a.months.length - 1] || '';
  const newItems = a.items.filter(i => a.recent.length && i.first >= a.recent[0] + '-01').slice(0, 8);
  const stopped = a.items.filter(i => lastComplete && i.last < lastComplete + '-01' && i.sales > a.total * 0.001).slice(0, 8);

  const depHtml = dep.length
    ? '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th>품목</th>'
      + '<th class="r">상위3 비중</th><th></th><th class="r">거래처</th><th class="r">매출</th></tr></thead><tbody>'
      + dep.map(i => '<tr><td data-label="품목">' + escHtml(i.name) + '</td>'
        + '<td data-label="상위3 비중" class="r"><b class="' + (i.top3Share >= 80 ? 'ca-down' : '') + '">'
        + i.top3Share.toFixed(0) + '%</b></td>'
        + '<td class="barcell">' + caBar(i.top3Share, i.top3Share >= 80 ? 'var(--red)' : 'var(--amber)') + '</td>'
        + '<td data-label="거래처" class="r">' + i.clientCount + '</td>'
        + '<td data-label="매출" class="r" title="' + Math.round(i.sales).toLocaleString() + '원">' + moneyShort(i.sales) + '</td></tr>').join('')
      + '</tbody></table></div>'
    : emptyState('거래처 편중이 심한 품목이 없습니다', '상위 3개 거래처가 60% 이상을 차지하면 여기에 표시됩니다', '✅');

  const listCard = (title, sub, arr, extra) => arr.length
    ? '<div class="pa-half"><h4>' + title + ' <span>' + arr.length + '종</span></h4>'
      + '<div class="pa-half-s">' + sub + '</div>'
      + arr.map(i => '<div class="da-li"><span>' + escHtml(i.name) + '</span><b>'
          + (extra ? extra(i) : moneyShort(i.sales)) + '</b></div>').join('') + '</div>'
    : '<div class="pa-half"><h4>' + title + '</h4><div class="pa-half-s">' + sub + '</div>'
      + '<div class="da-more">해당 품목 없음</div></div>';

  put('pa-risk',
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">거래처 편중 위험</div>'
    + '<div class="chart-card-sub">상위 3개 거래처가 그 품목 매출의 60% 이상을 차지하는 경우 · 한 곳만 빠져도 타격이 큽니다</div>'
    + depHtml + '</div>'
    + '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">신규 진입 · 판매 중단</div>'
    + '<div class="chart-card-sub">최근 구간에 처음 나온 품목과, 완료된 마지막 달에 한 건도 나가지 않은 품목</div>'
    + '<div class="pa-halves">'
    + listCard('신규 진입', a.recent.length ? a.recent[0] + ' 이후 첫 출고' : '-', newItems)
    + listCard('판매 중단', lastComplete + '에 출고 없음', stopped, i => '마지막 ' + i.last)
    + '</div></div>');
}
