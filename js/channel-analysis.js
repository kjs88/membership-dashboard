// ════════════════════════════════════
// 채널(사업소/유통사) 심화 분석
//   - 할인·조정 라인은 품목이 아니므로 품목 집계에서 제외한다.
//   - 계산부는 DOM을 건드리지 않는다.
// ════════════════════════════════════

const CA_DISCOUNT_RE = /할인/;
// 품목 편중(강점/공백) 판정에 필요한 최소 거래 건수. 이보다 적으면 표본이 작아 판단하지 않는다.
const CA_MIN_SAMPLE = 20;
function caIsProductRow(o) { return o && o.product && !CA_DISCOUNT_RE.test(o.product); }

// key별 매출/수량/건수/거래처수 집계 후 매출 내림차순
function caGroupBy(rows, keyFn) {
  const m = {};
  rows.forEach(o => {
    const k = keyFn(o) || '(미분류)';
    if (!m[k]) m[k] = { key: k, sales: 0, qty: 0, count: 0, clients: new Set() };
    m[k].sales += parseFloat(o.supply) || 0;
    m[k].qty += parseFloat(o.qty) || 0;
    m[k].count += 1;
    if (o.client) m[k].clients.add(o.client);
  });
  return Object.values(m)
    .map(g => ({ key: g.key, sales: g.sales, qty: g.qty, count: g.count, clientCount: g.clients.size }))
    .sort((a, b) => b.sales - a.sales);
}

function caShare(list, total) {
  return list.map(g => Object.assign({}, g, { share: total > 0 ? g.sales / total * 100 : 0 }));
}

// 상위 n개 합계 비중
function caTopShare(list, n, total) {
  if (total <= 0) return 0;
  return list.slice(0, n).reduce((s, g) => s + g.sales, 0) / total * 100;
}

// 채널 분석 본체 — 기간 필터된 행을 받아 모든 지표를 한 번에 계산
function caAnalyze(rows) {
  const prod = (rows || []).filter(caIsProductRow);
  const total = sumSupply(prod);
  const discount = sumSupply((rows || []).filter(o => o && o.product && CA_DISCOUNT_RE.test(o.product)));
  const gross = total;                 // 할인 제외 판매액
  const net = total + discount;        // 할인 반영 순매출 (할인은 음수)

  const byCategory = caShare(caGroupBy(prod, o => o.category), total);
  const byProduct = caShare(caGroupBy(prod, o => o.product), total);
  const byClient = caShare(caGroupBy(prod, o => o.client), total);
  const byRegion = caShare(caGroupBy(prod, o => (o.region || '').split(' ')[0]), total);

  return {
    rows: prod, total, gross, net, discount,
    byCategory, byProduct, byClient, byRegion,
    clientCount: byClient.length,
    productCount: byProduct.length,
    top3ClientShare: caTopShare(byClient, 3, total),
    top10ClientShare: caTopShare(byClient, 10, total),
    topProductShare: byProduct.length ? byProduct[0].share : 0,
    avgOrder: prod.length ? total / prod.length : 0,
  };
}

// 행(영업사원 또는 거래처) × 품목군 교차. 전체 평균 대비 편차(gap)를 함께 낸다.
// 사업소는 영업사원별, 유통사는 영업사원이 사실상 1명이라 거래처별로 본다.
function caCategoryMatrix(rows, rowKeyFn, topN, maxRows) {
  const prod = (rows || []).filter(caIsProductRow);
  const persons = caGroupBy(prod, rowKeyFn).slice(0, maxRows || 12);
  const cats = caGroupBy(prod, o => o.category).slice(0, topN || 6);
  const catKeys = cats.map(c => c.key);
  const grandTotal = sumSupply(prod);

  const teamShare = {};
  catKeys.forEach(c => {
    teamShare[c] = grandTotal > 0
      ? sumSupply(prod.filter(o => (o.category || '(미분류)') === c)) / grandTotal * 100 : 0;
  });

  const matrix = persons.map(p => {
    const mine = prod.filter(o => (rowKeyFn(o) || '(미분류)') === p.key);
    const myTotal = sumSupply(mine);
    const cells = catKeys.map(c => {
      const v = sumSupply(mine.filter(o => (o.category || '(미분류)') === c));
      const share = myTotal > 0 ? v / myTotal * 100 : 0;
      return { category: c, sales: v, share, gap: share - teamShare[c] };
    });
    return {
      person: p.key, total: myTotal, count: p.count, clientCount: p.clientCount,
      avgOrder: p.count ? myTotal / p.count : 0,
      cells,
    };
  }).filter(m => m.total > 0);

  return { catKeys, teamShare, matrix };
}

// 전기 대비 품목 증감. prevRows는 직전 동일 길이 기간.
function caProductDelta(rows, prevRows, minSales) {
  const cur = {}, prev = {};
  (rows || []).filter(caIsProductRow).forEach(o => { cur[o.product] = (cur[o.product] || 0) + (parseFloat(o.supply) || 0); });
  (prevRows || []).filter(caIsProductRow).forEach(o => { prev[o.product] = (prev[o.product] || 0) + (parseFloat(o.supply) || 0); });
  const floor = minSales || 0;
  const out = [];
  new Set(Object.keys(cur).concat(Object.keys(prev))).forEach(p => {
    const c = cur[p] || 0, v = prev[p] || 0;
    if (Math.max(c, v) < floor) return;
    out.push({ product: p, cur: c, prev: v, diff: c - v, pct: v > 0 ? (c - v) / v * 100 : (c > 0 ? null : 0) });
  });
  return out;
}

// 자동 인사이트 — 수치에서 바로 읽히지 않는 것만 문장으로 만든다.
function caInsights(a, mtx, delta, channel) {
  const out = [];
  const isDist = channel === 'dist';
  const label = isDist ? '유통사' : '사업소';

  // 1) 거래처 집중도
  if (a.clientCount > 0) {
    if (a.top3ClientShare >= 60) {
      out.push({ sev: 'crit', title: '거래처 집중 위험',
        desc: `상위 3개 거래처가 ${label} 매출의 ${a.top3ClientShare.toFixed(0)}%를 차지합니다 (거래처 ${a.clientCount}곳). ` +
              `한 곳만 이탈해도 타격이 큽니다.` });
    } else if (a.top3ClientShare >= 35) {
      out.push({ sev: 'warn', title: '거래처 집중 주의',
        desc: `상위 3개가 ${a.top3ClientShare.toFixed(0)}%입니다. 거래처 ${a.clientCount}곳 중 상위 10곳이 ${a.top10ClientShare.toFixed(0)}%.` });
    } else {
      out.push({ sev: 'ok', title: '거래처 분산 양호',
        desc: `거래처 ${a.clientCount}곳에 고르게 분산되어 있습니다 (상위 3곳 ${a.top3ClientShare.toFixed(0)}%).` });
    }
  }

  // 2) 품목 집중도
  if (a.byProduct.length) {
    const top = a.byProduct[0];
    if (top.share >= 30) {
      out.push({ sev: 'crit', title: '단일 품목 의존',
        desc: `${top.key} 하나가 ${top.share.toFixed(0)}%입니다. 이 품목의 수급·단가 변동이 ${label} 실적을 좌우합니다.` });
    } else if (top.share >= 15) {
      out.push({ sev: 'warn', title: '주력 품목 편중',
        desc: `${top.key}가 ${top.share.toFixed(0)}%로 가장 큽니다. 상위 품목 의존도를 살펴보세요.` });
    }
  }

  // 3) 영업사원 품목 갭 (사업소 전용 — 유통사는 거래처별 성격 차이라 갭으로 보지 않는다)
  if (!isDist && mtx && mtx.matrix.length >= 2) {
    const gaps = [];
    // 표본이 적으면 우연한 편차를 '공백'으로 오해할 수 있어 제외한다.
    const enough = m => m.count >= CA_MIN_SAMPLE;
    mtx.matrix.filter(enough).forEach(m => {
      m.cells.forEach(c => {
        if (mtx.teamShare[c.category] >= 5 && c.gap <= -4) {
          gaps.push({ person: m.person, cat: c.category, mine: c.share, team: mtx.teamShare[c.category] });
        }
      });
    });
    gaps.sort((a2, b2) => (a2.mine - a2.team) - (b2.mine - b2.team));
    gaps.slice(0, 2).forEach(g => {
      out.push({ sev: 'warn', title: '영업사원 품목 공백',
        desc: `${g.person}의 ${g.cat} 비중이 ${g.mine.toFixed(0)}%로 팀 평균 ${g.team.toFixed(0)}%보다 낮습니다. ` +
              `다른 영업사원이 파는 품목을 놓치고 있을 수 있습니다.` });
    });
    // 강점도 하나
    const strong = [];
    mtx.matrix.filter(m => m.count >= CA_MIN_SAMPLE).forEach(m => m.cells.forEach(c => {
      if (mtx.teamShare[c.category] >= 5 && c.gap >= 5) strong.push({ person: m.person, cat: c.category, mine: c.share, team: mtx.teamShare[c.category] });
    }));
    strong.sort((x, y) => (y.mine - y.team) - (x.mine - x.team));
    if (strong[0]) {
      out.push({ sev: 'ok', title: '영업사원 강점 품목',
        desc: `${strong[0].person}은 ${strong[0].cat} 비중이 ${strong[0].mine.toFixed(0)}%로 팀 평균(${strong[0].team.toFixed(0)}%)보다 높습니다. 사례 공유가 도움이 됩니다.` });
    }
  }

  // 4) 급변 품목 — 이번 기간에 아예 안 팔린 것은 '급감'이 아니라 '판매 중단'으로 구분한다.
  if (delta && delta.length) {
    const up = delta.filter(d => d.pct !== null && d.pct >= 50 && d.cur > 0).sort((x, y) => y.diff - x.diff)[0];
    const down = delta.filter(d => d.cur > 0 && d.pct !== null && d.pct <= -40).sort((x, y) => x.diff - y.diff)[0];
    const stopped = delta.filter(d => d.cur <= 0 && d.prev > 0).sort((x, y) => y.prev - x.prev)[0];
    if (up) out.push({ sev: 'ok', title: '급성장 품목',
      desc: `${up.product} 매출이 전기간 대비 ${up.pct.toFixed(0)}% 증가했습니다 (${moneyShort(up.prev)} → ${moneyShort(up.cur)}원).` });
    if (down) out.push({ sev: 'warn', title: '급감 품목',
      desc: `${down.product} 매출이 전기간 대비 ${Math.abs(down.pct).toFixed(0)}% 줄었습니다 (${moneyShort(down.prev)} → ${moneyShort(down.cur)}원).` });
    if (stopped) out.push({ sev: 'warn', title: '판매 중단',
      desc: `${stopped.product}가 이번 기간에 한 건도 나가지 않았습니다 (전기간 ${moneyShort(stopped.prev)}원). 재고·수급을 확인해 보세요.` });
  }

  // 5) 할인 규모
  if (a.discount < 0 && a.gross > 0) {
    const rate = Math.abs(a.discount) / a.gross * 100;
    if (rate >= 3) {
      out.push({ sev: rate >= 8 ? 'warn' : 'ok', title: '할인 규모',
        desc: `판매액 대비 할인이 ${rate.toFixed(1)}%입니다 (${moneyShort(Math.abs(a.discount))}원). 순매출은 ${moneyShort(a.net)}원.` });
    }
  }

  return out;
}

// ════════════════════════════════════
// 렌더
// ════════════════════════════════════
function caBar(share, color) {
  return `<div class="ca-bar"><i style="width:${Math.min(100, share).toFixed(1)}%;background:${color}"></i></div>`;
}

function renderChannelAnalysis(scopedRows, allChannelRows, prevRows, channel, dateFrom, dateTo) {
  const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html || ''; };
  const PANES = ['stats-brief','stats-conc','stats-calendar','stats-treemap-mini','stats-treemap',
    'stats-catmix','stats-prodtable','stats-cards','stats-matrix','stats-clients','stats-region','stats-insights'];
  const a = caAnalyze(scopedRows);

  if (!a.rows.length) {
    PANES.forEach(id => put(id, ''));
    put('stats-brief', emptyState('선택한 기간에 매출이 없습니다', '기간이나 영업사원 필터를 바꿔 보세요', '📊'));
    if (charts['chart-ca-cat']) { charts['chart-ca-cat'].destroy(); delete charts['chart-ca-cat']; }
    return;
  }

  const isDist = channel === 'dist';
  const mtx = caCategoryMatrix(allChannelRows, isDist ? (o => o.client) : (o => o.person), 6, 12);
  const delta = caProductDelta(a.rows, prevRows, a.total * 0.005);
  const insights = caInsights(a, mtx, delta, channel);
  const concCls = a.top3ClientShare >= 60 ? 'crit' : a.top3ClientShare >= 35 ? 'warn' : 'ok';
  const prodCls = a.topProductShare >= 30 ? 'crit' : a.topProductShare >= 15 ? 'warn' : 'ok';

  // ── 요약 탭 ──
  put('stats-brief', suBriefCard(a, insights, channel, dateFrom, dateTo));
  put('stats-conc',
    '<div class="ca-conc">'
    + '<div class="ca-cbox"><span>거래처 수</span><b>' + a.clientCount.toLocaleString() + '</b><em>곳</em></div>'
    + '<div class="ca-cbox ' + concCls + '"><span>상위 3곳 비중</span><b>' + a.top3ClientShare.toFixed(0) + '</b><em>%</em></div>'
    + '<div class="ca-cbox"><span>상위 10곳 비중</span><b>' + a.top10ClientShare.toFixed(0) + '</b><em>%</em></div>'
    + '<div class="ca-cbox"><span>취급 품목 수</span><b>' + a.productCount.toLocaleString() + '</b><em>개</em></div>'
    + '<div class="ca-cbox ' + prodCls + '"><span>1위 품목 비중</span><b>' + a.topProductShare.toFixed(0) + '</b><em>%</em></div>'
    + '<div class="ca-cbox"><span>건당 평균</span><b>' + moneyShort(a.avgOrder) + '</b><em>원</em></div>'
    + '</div>');
  // 브리핑에는 심각도별 대표 3개만 넣고, 전체 목록은 접어서 함께 둔다.
  put('stats-insights', insights.length
    ? '<details class="su-more"><summary>자동 인사이트 전체 ' + insights.length + '건</summary>'
      + '<div class="chart-card" style="margin:12px 0 16px"><div class="ca-insights">'
      + insights.map(i => '<div class="ca-ins ' + i.sev + '"><b>' + escHtml(i.title) + '</b><span>'
          + escHtml(i.desc) + '</span></div>').join('')
      + '</div></div></details>'
    : '');
  put('stats-calendar', suCalendarCard(a.rows, dateTo));
  put('stats-treemap-mini', suTreemapCard(a, delta, { compact: true }));
  put('stats-treemap', suTreemapCard(a, delta, { compact: false }));

  // ── 품목 탭 ──
  const catRows = a.byCategory.slice(0, 8).map(c =>
    '<tr><td data-label="품목군">' + escHtml(c.key) + '</td>'
    + '<td data-label="비중" class="r">' + c.share.toFixed(1) + '%</td>'
    + '<td class="barcell">' + caBar(c.share, 'var(--blue)') + '</td>'
    + '<td data-label="매출" class="r" title="' + Math.round(c.sales).toLocaleString() + '원">' + moneyShort(c.sales) + '</td>'
    + '<td data-label="수량" class="r">' + c.qty.toLocaleString() + '</td></tr>').join('');
  put('stats-catmix',
    '<div class="chart-grid" style="margin-bottom:16px">'
    + '<div class="chart-card"><div class="chart-card-title">품목군 구성</div>'
    + '<div class="chart-card-sub">할인·조정 라인 제외</div>'
    + '<div style="position:relative;height:240px"><canvas id="chart-ca-cat"></canvas></div></div>'
    + '<div class="chart-card"><div class="chart-card-title">품목군별 매출</div>'
    + '<div class="chart-card-sub">상위 8개</div>'
    + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th>품목군</th>'
    + '<th class="r">비중</th><th></th><th class="r">매출</th><th class="r">수량</th></tr></thead>'
    + '<tbody>' + catRows + '</tbody></table></div></div></div>');

  const dmap = {};
  delta.forEach(d => { dmap[d.product] = d; });
  const prodRows = a.byProduct.slice(0, 15).map((p, i) => {
    const d = dmap[p.key];
    let deltaHtml = '<span class="ca-mut">-</span>';
    if (d) {
      if (d.pct === null) deltaHtml = '<span class="ca-new">신규</span>';
      else if (Math.abs(d.pct) >= 1) {
        const up = d.pct > 0;
        deltaHtml = '<span class="' + (up ? 'ca-up' : 'ca-down') + '">' + (up ? '▲' : '▼') + Math.abs(d.pct).toFixed(0) + '%</span>';
      } else { deltaHtml = '<span class="ca-mut">0%</span>'; }
    }
    return '<tr><td class="ca-rank">' + (i + 1) + '</td>'
      + '<td data-label="품목">' + escHtml(p.key) + '</td>'
      + '<td data-label="비중" class="r">' + p.share.toFixed(1) + '%</td>'
      + '<td class="barcell">' + caBar(p.share, 'var(--green)') + '</td>'
      + '<td data-label="매출" class="r" title="' + Math.round(p.sales).toLocaleString() + '원">' + moneyShort(p.sales) + '</td>'
      + '<td data-label="수량" class="r">' + p.qty.toLocaleString() + '</td>'
      + '<td data-label="거래처" class="r">' + p.clientCount + '</td>'
      + '<td data-label="전기대비" class="r">' + deltaHtml + '</td></tr>';
  }).join('');
  put('stats-prodtable',
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">품목 TOP 15</div>'
    + '<div class="chart-card-sub">정확한 값 확인용 · 전기간(직전 동일 길이) 대비 증감 포함</div>'
    + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th></th><th>품목</th>'
    + '<th class="r">비중</th><th></th><th class="r">매출</th><th class="r">수량</th>'
    + '<th class="r">거래처</th><th class="r">전기대비</th></tr></thead><tbody>' + prodRows + '</tbody></table></div></div>');

  // ── 사람 탭 ──
  const historyRows = (allOrders || []).filter(o => orderChannel(o) === channel && caIsProductRow(o));
  put('stats-cards', suPersonCards(mtx, allChannelRows.filter(caIsProductRow), prevRows, isDist, historyRows));
  let matrixHtml = '';
  if (mtx && mtx.matrix.length) {
    const head2 = mtx.catKeys.map(c =>
      '<th class="r" title="평균 ' + mtx.teamShare[c].toFixed(1) + '%">' + escHtml(c)
      + '<br><span class="ca-team">평균 ' + mtx.teamShare[c].toFixed(0) + '%</span></th>').join('');
    const body = mtx.matrix.map(m => {
      const cells = m.cells.map(c => {
        const strong = c.gap >= 5, weak = (c.gap <= -4 && mtx.teamShare[c.category] >= 5);
        const cls = strong ? 'ca-strong' : weak ? 'ca-weak' : '';
        const sign = c.gap >= 0 ? '+' : '';
        return '<td class="r ' + cls + '" title="' + escHtml(m.person) + ' · ' + escHtml(c.category) + ' '
          + moneyShort(c.sales) + '원 (평균 대비 ' + sign + c.gap.toFixed(1) + 'p)">'
          + c.share.toFixed(0) + '%<span class="ca-gap">' + sign + c.gap.toFixed(0) + 'p</span></td>';
      }).join('');
      const sub = isDist ? (m.count.toLocaleString() + '건 · 건당 ' + moneyShort(m.avgOrder) + '원')
                         : ('거래처 ' + m.clientCount + '곳 · 건당 ' + moneyShort(m.avgOrder) + '원');
      const nameCell = isDist
        ? '<b class="ca-linkname" onclick="openClient360(&#39;' + escInlineJs(m.person) + '&#39;)">' + escHtml(m.person) + '</b><span class="ca-sub2">' + sub + '</span>'
        : '<b>' + escHtml(m.person) + '</b><span class="ca-sub2">' + sub + '</span>';
      return '<tr><td data-label="' + (isDist ? '거래처' : '영업사원') + '">' + nameCell + '</td>'
        + '<td data-label="매출" class="r" title="' + Math.round(m.total).toLocaleString() + '원">' + moneyShort(m.total) + '</td>'
        + cells + '</tr>';
    }).join('');
    matrixHtml = '<details class="su-more"><summary>' + (isDist ? '거래처 × 품목군 상세표' : '영업사원 × 품목군 상세표') + '</summary>'
      + '<div class="chart-card" style="margin:12px 0 16px"><div class="ca-tablewrap">'
      + '<table class="ca-table mob-cards"><thead><tr><th>' + (isDist ? '거래처' : '영업사원') + '</th>'
      + '<th class="r">매출</th>' + head2 + '</tr></thead><tbody>' + body + '</tbody></table></div></div></details>';
  }
  put('stats-matrix', matrixHtml);

  // ── 거래처 탭 ──
  const clientRows = a.byClient.slice(0, 10).map((c, i) =>
    '<tr onclick="openClient360(&#39;' + escInlineJs(c.key) + '&#39;)" class="ca-clickable">'
    + '<td class="ca-rank">' + (i + 1) + '</td>'
    + '<td data-label="거래처">' + escHtml(c.key) + '</td>'
    + '<td data-label="비중" class="r">' + c.share.toFixed(1) + '%</td>'
    + '<td class="barcell">' + caBar(c.share, 'var(--purple)') + '</td>'
    + '<td data-label="매출" class="r" title="' + Math.round(c.sales).toLocaleString() + '원">' + moneyShort(c.sales) + '</td>'
    + '<td data-label="건수" class="r">' + c.count.toLocaleString() + '</td></tr>').join('');
  put('stats-clients',
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">거래처 TOP 10</div>'
    + '<div class="chart-card-sub">이름을 누르면 거래처 상세가 열립니다</div>'
    + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th></th><th>거래처</th>'
    + '<th class="r">비중</th><th></th><th class="r">매출</th><th class="r">건수</th></tr></thead>'
    + '<tbody>' + clientRows + '</tbody></table></div></div>');

  const regions = a.byRegion.filter(r => r.key && r.key !== '(미분류)');
  const regionCover = regions.reduce((s, r) => s + r.share, 0);
  put('stats-region', (regions.length >= 3 && regionCover >= 30)
    ? '<div class="chart-card" style="margin-bottom:16px"><div class="chart-card-title">지역 분포</div>'
      + '<div class="chart-card-sub">상위 10개 지역 · 지역 미입력 건 제외</div>'
      + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th>지역</th>'
      + '<th class="r">비중</th><th></th><th class="r">매출</th><th class="r">거래처</th></tr></thead><tbody>'
      + regions.slice(0, 10).map(r => '<tr><td data-label="지역">' + escHtml(r.key) + '</td>'
        + '<td data-label="비중" class="r">' + r.share.toFixed(1) + '%</td>'
        + '<td class="barcell">' + caBar(r.share, 'var(--amber)') + '</td>'
        + '<td data-label="매출" class="r" title="' + Math.round(r.sales).toLocaleString() + '원">' + moneyShort(r.sales) + '</td>'
        + '<td data-label="거래처" class="r">' + r.clientCount + '</td></tr>').join('')
      + '</tbody></table></div></div>'
    : '');

  // 도넛은 해당 탭이 보일 때 그린다 (숨은 캔버스는 크기가 0)
  const etcSum = a.byCategory.slice(7).reduce((s, c) => s + c.sales, 0);
  window.__caDonut = {
    labels: a.byCategory.slice(0, 7).map(c => c.key).concat(etcSum > 0 ? ['기타'] : []),
    data: a.byCategory.slice(0, 7).map(c => Math.round(c.sales)).concat(etcSum > 0 ? [Math.round(etcSum)] : []),
  };
  if (typeof suRedrawTabCharts === 'function') suRedrawTabCharts(typeof statsTab !== 'undefined' ? statsTab : 'summary');
}

// 탭이 보이는 시점에 캔버스를 그린다
function suRedrawTabCharts(tab) {
  if (tab === 'product' && window.__caDonut && typeof rc === 'function' && window.__caDonut.labels.length) {
    rc('chart-ca-cat', 'doughnut', window.__caDonut.labels, window.__caDonut.data,
      ['#2B72C8', '#009E6A', '#7856C8', '#E8900A', '#D94040', '#3DB8A0', '#C75BAB', '#9E9E9E']);
  }
}
