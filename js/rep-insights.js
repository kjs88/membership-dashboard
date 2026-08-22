// ════════════════════════════════════
// 영업사원 활동 인사이트
//   영업일지(활동)와 ERP 매출(성과)을 연결해 "방문이 실제로 무엇을 만들었나"를 본다.
//   일지의 기관명과 ERP 거래처명은 표기가 달라 완전히 겹치지 않는다.
//   → 안전한 규칙으로만 매칭하고, 매칭률을 화면에 그대로 공개한다.
// ════════════════════════════════════

const RI_WINDOW_DAYS = 30;   // 방문 후 주문을 인정하는 기간
const RI_RECENT_DAYS = 42;   // "최근 방문" 판단 기간(6주)

function riNorm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
function riBase(s) { return riNorm(String(s || '').split('/')[0]); }

// 일지 기관명 → ERP 거래처명. 후보가 유일할 때만 인정한다(오매칭 방지).
function riBuildMatcher(clients) {
  const byNorm = {}, byBase = {};
  clients.forEach(c => {
    (byNorm[riNorm(c)] = byNorm[riNorm(c)] || []).push(c);
    (byBase[riBase(c)] = byBase[riBase(c)] || []).push(c);
  });
  const baseKeys = Object.keys(byBase);
  return function (inst) {
    const n = riNorm(inst);
    if (byNorm[n] && byNorm[n].length === 1) return byNorm[n][0];
    const b = riBase(inst);
    if (byBase[b] && byBase[b].length === 1) return byBase[b][0];
    if (b.length >= 4) {
      const cand = baseKeys.filter(k => k.startsWith(b) || b.startsWith(k));
      if (cand.length === 1 && byBase[cand[0]].length === 1) return byBase[cand[0]][0];
    }
    return null;
  };
}

function riDays(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

function riAnalyze() {
  const orders = (allOrders || []).filter(o => orderChannel(o) === 'office' && caIsProductRow(o));
  const entries = (allEntries || []).filter(e => e && e.date && e.institution);
  const clients = [...new Set(orders.map(o => o.client).filter(Boolean))];
  const matcher = riBuildMatcher(clients);

  // 기관명 → 거래처 매칭
  const instList = [...new Set(entries.map(e => String(e.institution).trim()))];
  const map = {}, unmatched = [];
  instList.forEach(i => { const m = matcher(i); if (m) map[i] = m; else unmatched.push(i); });

  const byClient = {};
  orders.forEach(o => { (byClient[o.client] = byClient[o.client] || []).push(o); });

  // 담당 거래처와 매출 (ERP person 기준)
  const own = {}, clientRev = {}, personRev = {};
  orders.forEach(o => {
    (own[o.person] = own[o.person] || new Set()).add(o.client);
    clientRev[o.client] = (clientRev[o.client] || 0) + (parseFloat(o.supply) || 0);
    personRev[o.person] = (personRev[o.person] || 0) + (parseFloat(o.supply) || 0);
  });

  const today = todayYmd();
  const visits = entries.map(e => {
    const inst = String(e.institution).trim();
    const client = map[inst] || null;
    let firstGap = null, sameDay = false;
    if (client) {
      (byClient[client] || []).forEach(o => {
        const g = riDays(e.date, o.date);
        if (g >= 0 && g <= RI_WINDOW_DAYS) { if (firstGap === null || g < firstGap) firstGap = g; }
      });
      sameDay = firstGap === 0;
    }
    return {
      date: e.date, person: e.person || '(미지정)', inst, client,
      clientType: e.clientType || '(미분류)', deal: e.dealPossibility || '-',
      region: e.region || '', matched: !!client, ordered: firstGap !== null, gap: firstGap, sameDay,
    };
  });

  // 영업사원별
  const persons = [...new Set(visits.map(v => v.person))];
  const perPerson = persons.map(p => {
    const mine = visits.filter(v => v.person === p);
    const m = mine.filter(v => v.matched);
    const ordered = m.filter(v => v.ordered);
    const ownSet = own[p] || new Set();
    const recent = new Set(mine.filter(v => riDays(v.date, today) <= RI_RECENT_DAYS && v.client).map(v => v.client));
    const covered = [...recent].filter(c => ownSet.has(c)).length;
    const byType = {};
    ['신규거래처', '기존 거래처', '휴면거래처'].forEach(t => {
      const g = mine.filter(v => v.clientType === t);
      const gm = g.filter(v => v.matched);
      byType[t] = { visits: g.length, ordered: gm.filter(v => v.ordered).length, matched: gm.length };
    });
    const days = new Set(mine.map(v => v.date));
    return {
      person: p, visits: mine.length, visitDays: days.size,
      clientsVisited: new Set(mine.map(v => v.inst)).size,
      matched: m.length, ordered: ordered.length,
      orderRate: m.length ? ordered.length / m.length * 100 : null,
      sameDayRate: ordered.length ? ordered.filter(v => v.sameDay).length / ordered.length * 100 : null,
      ownCount: ownSet.size, covered, coverage: ownSet.size ? covered / ownSet.size * 100 : null,
      revenue: personRev[p] || 0,
      byType,
    };
  }).sort((a, b) => b.visits - a.visits);

  // 일지를 쓰지 않는 담당자 (ERP에는 있는데 방문 기록 없음)
  const silent = Object.keys(own).filter(p => !persons.includes(p))
    .map(p => ({ person: p, ownCount: own[p].size, revenue: personRev[p] || 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // 거래가능성 판정 정확도
  const calib = ['○', '△', '×'].map(d => {
    const g = visits.filter(v => v.deal === d && v.matched);
    return { deal: d, total: g.length, ordered: g.filter(v => v.ordered).length,
             rate: g.length ? g.filter(v => v.ordered).length / g.length * 100 : null };
  }).filter(c => c.total > 0);
  const monotonic = calib.length >= 2 && calib.every((c, i) => i === 0 || calib[i - 1].rate >= c.rate);

  // 방문→주문 간격 분포
  const gaps = visits.filter(v => v.ordered).map(v => v.gap);
  const buckets = [
    { label: '당일', test: g => g === 0 },
    { label: '1~3일', test: g => g >= 1 && g <= 3 },
    { label: '4~7일', test: g => g >= 4 && g <= 7 },
    { label: '8~30일', test: g => g >= 8 },
  ].map(b => ({ label: b.label, count: gaps.filter(b.test).length }));

  // 최근 미방문 우량 거래처
  const recentAll = new Set(visits.filter(v => v.client && riDays(v.date, today) <= RI_RECENT_DAYS).map(v => v.client));
  const ownerOf = {};
  orders.forEach(o => { ownerOf[o.client] = o.person; });
  const unvisited = clients.filter(c => !recentAll.has(c))
    .map(c => ({ client: c, revenue: clientRev[c] || 0, owner: ownerOf[c] || '-' }))
    .sort((a, b) => b.revenue - a.revenue);
  const totalRev = Object.values(clientRev).reduce((s, v) => s + v, 0);
  const unvisitedRev = unvisited.reduce((s, c) => s + c.revenue, 0);

  return {
    visits, perPerson, silent, calib, monotonic, buckets,
    unvisited, unvisitedRev, totalRev,
    matchRate: instList.length ? Object.keys(map).length / instList.length * 100 : 0,
    matchedCount: Object.keys(map).length, instCount: instList.length, unmatched,
    orderedTotal: visits.filter(v => v.ordered).length,
    matchedTotal: visits.filter(v => v.matched).length,
  };
}

// ────────────────────────────────
// 렌더
// ────────────────────────────────
function riBar(pct, color) {
  return '<div class="ri-bar"><i style="width:' + Math.max(0, Math.min(100, pct)).toFixed(0)
    + '%;background:' + color + '"></i></div>';
}

function renderRepInsights() {
  const host = document.getElementById('ri-body');
  if (!host) return;
  const a = riAnalyze();

  if (!a.visits.length) {
    host.innerHTML = emptyState('영업일지 기록이 없습니다', '일간일지에서 방문을 기록하면 활동 분석이 시작됩니다', '📝');
    return;
  }

  // ── 영업사원 카드 ──
  const cards = a.perPerson.map(p => {
    const user = (allUsers || []).find(u => u && u.name === p.person);
    const color = (typeof safeColor === 'function') ? safeColor(user && user.color, '#2B72C8') : '#2B72C8';
    const cov = p.coverage;
    const covCls = cov === null ? '' : cov >= 30 ? 'ok' : cov >= 15 ? 'warn' : 'crit';
    const typeRows = Object.keys(p.byType).filter(t => p.byType[t].visits > 0).map(t => {
      const b = p.byType[t];
      const r = b.matched ? b.ordered / b.matched * 100 : null;
      return '<div class="ri-trow"><span>' + escHtml(t) + '</span>'
        + '<b>' + b.visits + '회</b>'
        + '<em>' + (r === null ? '-' : r.toFixed(0) + '%') + '</em></div>';
    }).join('');
    return '<div class="ri-card">'
      + '<div class="ri-h"><div class="ri-av" style="background:' + color + '">'
      + escHtml(p.person.slice(0, 1)) + '</div>'
      + '<div><div class="ri-n">' + escHtml(p.person) + '</div>'
      + '<div class="ri-s">' + p.visits + '회 방문 · ' + p.visitDays + '일 활동 · 담당 ' + p.ownCount + '곳</div></div></div>'
      + '<div class="ri-metrics">'
      + '<div class="ri-m"><span>담당 커버리지</span><b class="' + covCls + '">'
        + (cov === null ? '-' : cov.toFixed(0) + '%') + '</b>'
        + '<em>' + p.covered + '/' + p.ownCount + '곳</em>' + riBar(cov || 0, 'var(--blue)') + '</div>'
      + '<div class="ri-m"><span>방문 후 주문</span><b>'
        + (p.orderRate === null ? '-' : p.orderRate.toFixed(0) + '%') + '</b>'
        + '<em>' + p.ordered + '/' + p.matched + '건</em>' + riBar(p.orderRate || 0, 'var(--green)') + '</div>'
      + '<div class="ri-m"><span>그중 당일 주문</span><b>'
        + (p.sameDayRate === null ? '-' : p.sameDayRate.toFixed(0) + '%') + '</b>'
        + '<em>방문과 동시</em>' + riBar(p.sameDayRate || 0, 'var(--amber)') + '</div>'
      + '</div>'
      + (typeRows ? '<div class="ri-types"><div class="ri-thead"><span>거래처 유형</span><b>방문</b><em>주문율</em></div>'
          + typeRows + '</div>' : '')
      + '</div>';
  }).join('');

  // ── 일지 미작성 담당자 ──
  const silentHtml = a.silent.length
    ? '<div class="da-note warn"><b>일지 기록이 없는 담당자 '
      + a.silent.length + '명</b> — '
      + a.silent.map(s => escHtml(s.person) + '(담당 ' + s.ownCount + '곳 · ' + moneyShort(s.revenue) + '원)').join(', ')
      + '. ERP에는 매출이 있는데 방문 기록이 없어 활동 분석에서 빠집니다.</div>'
    : '';

  // ── 판정 정확도 ──
  const maxRate = Math.max.apply(null, a.calib.map(c => c.rate || 0).concat([1]));
  const calibHtml = a.calib.length
    ? '<div class="chart-card" style="margin-bottom:16px">'
      + '<div class="chart-card-title">거래가능성 판정 정확도</div>'
      + '<div class="chart-card-sub">영업사원이 방문 때 매긴 등급이 실제 주문으로 이어졌는지 — 등급이 내려갈수록 주문율도 낮아져야 판단이 유효합니다</div>'
      + '<div class="ri-calib">' + a.calib.map(c => {
          const cls = c.deal === '○' ? 'ok' : c.deal === '△' ? 'warn' : 'crit';
          return '<div class="ri-cal ' + cls + '"><div class="ri-cal-d">' + c.deal + '</div>'
            + '<div class="ri-cal-b">' + riBar(c.rate / maxRate * 100, 'currentColor') + '</div>'
            + '<div class="ri-cal-v"><b>' + c.rate.toFixed(0) + '%</b><span>' + c.ordered + '/' + c.total + '건</span></div></div>';
        }).join('') + '</div>'
      + '<div class="da-note' + (a.monotonic ? '' : ' warn') + '">'
      + (a.monotonic
          ? '판정이 <b>순서대로 정렬</b>되어 있습니다. 영업사원의 거래가능성 판단이 실제 결과를 잘 예측하고 있다는 뜻입니다.'
          : '판정 순서가 뒤바뀐 구간이 있습니다. 등급 기준이 사람마다 다르게 적용되고 있을 수 있습니다.')
      + '</div></div>'
    : '';

  // ── 방문→주문 간격 ──
  const gapTotal = a.buckets.reduce((s, b) => s + b.count, 0);
  const sameDay = a.buckets[0].count;
  const gapHtml = gapTotal
    ? '<div class="chart-card" style="margin-bottom:16px">'
      + '<div class="chart-card-title">방문에서 주문까지 걸린 시간</div>'
      + '<div class="chart-card-sub">방문 후 ' + RI_WINDOW_DAYS + '일 안에 주문이 나온 ' + gapTotal + '건의 분포</div>'
      + '<div class="ri-gaps">' + a.buckets.map(b =>
          '<div class="ri-gap"><div class="ri-gap-v">' + b.count + '</div>'
          + '<div class="ri-gap-bar"><i style="height:' + (gapTotal ? Math.max(3, b.count / gapTotal * 100) : 3) + '%"></i></div>'
          + '<div class="ri-gap-l">' + b.label + '</div>'
          + '<div class="ri-gap-p">' + (gapTotal ? (b.count / gapTotal * 100).toFixed(0) : 0) + '%</div></div>').join('')
        + '</div>'
      + (sameDay / gapTotal >= 0.35
          ? '<div class="da-note warn">주문의 <b>' + (sameDay / gapTotal * 100).toFixed(0)
            + '%가 방문 당일</b>에 발생했습니다. 방문이 새 주문을 만들었다기보다 <b>이미 예정된 주문을 받으러 간 동행 방문</b>일 가능성이 큽니다. '
            + '순수한 개척 효과를 보려면 당일 건을 빼고 보는 편이 정확합니다.</div>'
          : '')
      + '</div>'
    : '';

  // ── 미방문 우량 거래처 ──
  const top = a.unvisited.slice(0, 12);
  const unvHtml = top.length
    ? '<div class="chart-card" style="margin-bottom:16px">'
      + '<div class="chart-card-title">최근 ' + RI_RECENT_DAYS + '일 미방문 우량 거래처</div>'
      + '<div class="chart-card-sub">매출은 있는데 방문 기록이 없는 곳입니다 · 이름을 누르면 거래처 상세가 열립니다</div>'
      + '<div class="da-note"><b>미방문 거래처 매출 합계 ' + moneyShort(a.unvisitedRev) + '원</b>'
      + (a.totalRev > 0 ? ' — 사업소 전체 매출의 ' + (a.unvisitedRev / a.totalRev * 100).toFixed(0) + '%' : '')
      + '입니다. 관리 공백이 있는지 확인해 보세요.</div>'
      + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr>'
      + '<th></th><th>거래처</th><th>담당</th><th class="r">누적 매출</th></tr></thead><tbody>'
      + top.map((c, i) => '<tr class="ca-clickable" onclick="openClient360(&#39;' + escInlineJs(c.client) + '&#39;)">'
          + '<td class="ca-rank">' + (i + 1) + '</td>'
          + '<td data-label="거래처">' + escHtml(c.client) + '</td>'
          + '<td data-label="담당">' + escHtml(c.owner) + '</td>'
          + '<td class="r" data-label="누적 매출" title="' + Math.round(c.revenue).toLocaleString() + '원">'
          + moneyShort(c.revenue) + '</td></tr>').join('')
      + '</tbody></table></div></div>'
    : '';

  // ── 매칭 진단 ──
  const matchCls = a.matchRate >= 80 ? 'ok' : a.matchRate >= 60 ? 'warn' : 'crit';
  const diagHtml = '<details class="su-more"><summary>데이터 연결 상태 — 일지 기관명 ' + a.matchedCount + '/'
    + a.instCount + '곳이 ERP 거래처와 연결됨 (' + a.matchRate.toFixed(0) + '%)</summary>'
    + '<div class="chart-card" style="margin:12px 0 16px">'
    + '<div class="da-note' + (matchCls === 'ok' ? '' : ' warn') + '">'
    + '위 분석은 <b>연결된 ' + a.matchedCount + '곳</b>을 대상으로 계산했습니다. '
    + '나머지는 일지에 적힌 기관명이 ERP 거래처명과 달라 매칭되지 않았거나, 아직 거래가 없는 <b>개척 중 거래처</b>입니다. '
    + '이름을 ERP와 맞추면 분석 범위가 넓어집니다.</div>'
    + (a.unmatched.length
        ? '<div class="ri-unmatched">' + a.unmatched.slice(0, 30).map(u =>
            '<span>' + escHtml(u) + '</span>').join('')
          + (a.unmatched.length > 30 ? '<em>외 ' + (a.unmatched.length - 30) + '곳</em>' : '') + '</div>'
        : '')
    + '</div></details>';

  host.innerHTML =
    silentHtml
    + '<div class="ri-cards">' + cards + '</div>'
    + calibHtml + gapHtml + unvHtml + diagHtml;
}

// 영업현황 탭 전환
function showDashTab(id) {
  document.querySelectorAll('.dtab').forEach(b => b.classList.toggle('active', b.dataset.t === id));
  document.querySelectorAll('.dtab-pane').forEach(p => {
    p.style.display = (p.id === 'dtab-' + id) ? '' : 'none';
  });
  if (id === 'insight') renderRepInsights();
}
