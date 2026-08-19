// ════════════════════════════════════
// 실적 분석 UI — 브리핑 / 트리맵 / 캘린더 / 영업사원 카드 / 탭
//   계산은 channel-analysis.js(caAnalyze 등)를 재사용하고
//   여기서는 "보이게 만드는" 표현만 담당한다.
// ════════════════════════════════════

let statsTab = 'summary';

function showStatsTab(id) {
  statsTab = id;
  document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.t === id));
  document.querySelectorAll('.stab-pane').forEach(p => {
    p.style.display = (p.id === 'stab-' + id) ? '' : 'none';
  });
  // 탭이 화면에 나타난 뒤에 그려야 캔버스 크기가 정확하다
  if (typeof suRedrawTabCharts === 'function') suRedrawTabCharts(id);
}

// ────────────────────────────────
// 트리맵 — 값 기준 이분 분할
// ────────────────────────────────
function suTreemapLayout(items, x, y, w, h, out) {
  if (!items.length || w <= 0 || h <= 0) return out;
  if (items.length === 1) { out.push({ item: items[0], x: x, y: y, w: w, h: h }); return out; }
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return out;
  let acc = 0, cut = 0;
  while (cut < items.length - 1 && acc + items[cut].value < total / 2) { acc += items[cut].value; cut++; }
  const a = items.slice(0, cut || 1), b = items.slice(cut || 1);
  if (!b.length) { out.push({ item: items[0], x: x, y: y, w: w, h: h }); return out; }
  const ratio = a.reduce((s, i) => s + i.value, 0) / total;
  if (w >= h) {
    suTreemapLayout(a, x, y, w * ratio, h, out);
    suTreemapLayout(b, x + w * ratio, y, w * (1 - ratio), h, out);
  } else {
    suTreemapLayout(a, x, y, w, h * ratio, out);
    suTreemapLayout(b, x, y + h * ratio, w, h * (1 - ratio), out);
  }
  return out;
}

// 증감률 → 색. 붉을수록 감소, 진한 초록일수록 증가.
function suDeltaColor(pct) {
  if (pct === null || pct === undefined) return { bg: '#B7DFCB', fg: '#123F30' };
  if (pct <= -20) return { bg: '#E4796B', fg: '#FFFFFF' };
  if (pct <= -5) return { bg: '#F2C3BB', fg: '#5A211A' };
  if (pct < 5) return { bg: '#CBD5D1', fg: '#20302C' };
  if (pct < 20) return { bg: '#A8D8C0', fg: '#123F30' };
  return { bg: '#3FAF87', fg: '#FFFFFF' };
}

function suTreemapSvg(items, deltaMap, total, width, height, topN) {
  const list = items.slice(0, topN).map(i => ({ name: i.key, value: i.sales, share: i.share }));
  const shown = list.reduce((s, i) => s + i.value, 0);
  const etc = total - shown;
  if (etc > total * 0.01) {
    list.push({ name: '기타 ' + Math.max(0, items.length - list.length) + '개',
                value: etc, share: etc / total * 100, isEtc: true });
  }
  if (!list.length) return '';
  const rects = suTreemapLayout(list, 0, 0, width, height, []);
  const cells = rects.map(r => {
    const it = r.item;
    const d = it.isEtc ? null : deltaMap[it.name];
    const pct = it.isEtc ? 0 : (d ? d.pct : 0);
    const c = it.isEtc ? { bg: '#E4EAE7', fg: '#3B4A46' } : suDeltaColor(pct);
    const pad = 7;
    const canName = r.w > 60 && r.h > 28;
    const canVal = r.w > 60 && r.h > 46;
    const canDelta = r.w > 74 && r.h > 66 && !it.isEtc;
    const nameSize = (r.w > 150 && r.h > 90) ? 12.5 : 10.5;
    const valSize = (r.w > 150 && r.h > 90) ? 17 : 13;
    const maxChars = Math.max(3, Math.floor((r.w - pad * 2) / (nameSize * 0.95)));
    const nm = it.name.length > maxChars ? it.name.slice(0, Math.max(1, maxChars - 1)) + '…' : it.name;
    const deltaTxt = (pct === null) ? '신규'
      : ((pct > 0 ? '▲' : pct < 0 ? '▼' : '') + Math.abs(Math.round(pct)) + '%');
    const tip = it.name + ' · ' + Math.round(it.value).toLocaleString() + '원 · 비중 ' + it.share.toFixed(1) + '%'
      + (it.isEtc ? '' : ' · 전기 대비 ' + (pct === null ? '신규' : Math.round(pct) + '%'));
    return '<g><title>' + escHtml(tip) + '</title>'
      + '<rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1)
      + '" width="' + Math.max(0, r.w - 2).toFixed(1) + '" height="' + Math.max(0, r.h - 2).toFixed(1)
      + '" fill="' + c.bg + '" rx="2"/>'
      + (canName ? '<text x="' + (r.x + pad).toFixed(1) + '" y="' + (r.y + pad + nameSize).toFixed(1)
          + '" font-size="' + nameSize + '" font-weight="700" fill="' + c.fg + '">' + escHtml(nm) + '</text>' : '')
      + (canVal ? '<text x="' + (r.x + pad).toFixed(1) + '" y="' + (r.y + pad + nameSize + valSize + 5).toFixed(1)
          + '" font-size="' + valSize + '" font-weight="800" fill="' + c.fg
          + '" font-family="ui-monospace,monospace">' + moneyShort(it.value) + '</text>' : '')
      + (canDelta ? '<text x="' + (r.x + pad).toFixed(1) + '" y="' + (r.y + pad + nameSize + valSize + 22).toFixed(1)
          + '" font-size="10.5" fill="' + c.fg + '" font-family="ui-monospace,monospace" opacity=".85">'
          + deltaTxt + '</text>' : '')
      + '</g>';
  }).join('');
  return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" width="100%"'
    + ' style="min-width:' + Math.min(width, 560) + 'px;height:auto;display:block"'
    + ' aria-label="품목별 매출 트리맵. 면적은 매출 규모, 색은 전기간 대비 증감.">' + cells + '</svg>';
}

function suTreemapCard(a, delta, opts) {
  const o = opts || {};
  const dmap = {};
  (delta || []).forEach(d => { dmap[d.product] = d; });
  const svg = suTreemapSvg(a.byProduct, dmap, a.total, 720, o.compact ? 250 : 340, o.compact ? 10 : 16);
  if (!svg) return '';
  return '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">' + (o.compact ? '품목 구성 한눈에' : '품목 트리맵') + '</div>'
    + '<div class="chart-card-sub">면적 = 매출 규모 · 색 = 전기간 대비 증감 (붉을수록 감소)</div>'
    + '<div class="su-tmwrap">' + svg + '</div>'
    + '<div class="su-legend"><span>감소</span>'
    + '<i style="background:#E4796B"></i><i style="background:#F2C3BB"></i><i style="background:#CBD5D1"></i>'
    + '<i style="background:#A8D8C0"></i><i style="background:#3FAF87"></i>'
    + '<span>증가</span><em>칸에 마우스를 올리면 정확한 값이 나옵니다</em></div>'
    + '</div>';
}

// ────────────────────────────────
// 캘린더 히트맵
// ────────────────────────────────
function suCalendarCard(rows, dateTo) {
  const byDay = {};
  (rows || []).forEach(o => {
    if (!o.date) return;
    byDay[o.date] = (byDay[o.date] || 0) + (parseFloat(o.supply) || 0);
  });
  const days = Object.keys(byDay).sort();
  if (!days.length) return '';
  const endStr = dateTo || days[days.length - 1];
  const end = new Date(endStr + 'T00:00:00');
  if (isNaN(end)) return '';

  const months = [];
  for (let k = 2; k >= 0; k--) {
    const d = new Date(end.getFullYear(), end.getMonth() - k, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  }
  const vals = Object.values(byDay).filter(v => v > 0).sort((x, y) => x - y);
  if (!vals.length) return '';
  const q = p => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
  const scale = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const palette = ['#E1F2EA', '#B8E2CE', '#6FC7A6', '#3FAF87', '#1F8A62'];
  const colorOf = v => {
    if (!v || v <= 0) return null;
    let i = 0;
    while (i < scale.length && v > scale[i]) i++;
    return palette[i];
  };
  const today = todayYmd();
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  const monthHtml = months.map(mo => {
    const y = mo.y, m = mo.m;
    const lead = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="su-cal-c empty"></div>';
    for (let d = 1; d <= dim; d++) {
      const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const v = byDay[ds] || 0;
      const hol = (typeof krHolidayName === 'function') ? krHolidayName(ds) : null;
      const future = ds > today;
      const bg = colorOf(v);
      let cls = 'su-cal-c', style = '';
      if (future) cls += ' future';
      else if (hol) cls += ' hol';
      else if (bg) {
        style = 'background:' + bg;
        if (bg === '#3FAF87' || bg === '#1F8A62') style += ';color:#fff';
      } else cls += ' zero';
      const tip = ds + ' (' + DOW[new Date(ds + 'T00:00:00').getDay()] + ')'
        + (hol ? ' · ' + hol : '') + (future ? ' · 예정' : ' · ' + Math.round(v).toLocaleString() + '원');
      cells += '<div class="' + cls + '" style="' + style + '" title="' + escHtml(tip) + '">' + d + '</div>';
    }
    return '<div class="su-cal"><div class="su-cal-t">' + y + '년 ' + (m + 1) + '월</div>'
      + '<div class="su-cal-g su-cal-dows">'
      + DOW.map((w, i) => '<div class="su-cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</div>').join('')
      + '</div><div class="su-cal-g">' + cells + '</div></div>';
  }).join('');

  // 요일별 평균
  const dowSum = [0, 0, 0, 0, 0, 0, 0], dowCnt = [0, 0, 0, 0, 0, 0, 0];
  Object.keys(byDay).forEach(ds => {
    if (ds > today) return;
    const w = new Date(ds + 'T00:00:00').getDay();
    dowSum[w] += byDay[ds];
    dowCnt[w]++;
  });
  const dowAvg = dowSum.map((s, i) => dowCnt[i] ? s / dowCnt[i] : 0);
  const weekdays = [1, 2, 3, 4, 5].filter(i => dowCnt[i] > 0);
  let patternHtml = '';
  if (weekdays.length >= 3) {
    const best = weekdays.slice().sort((x, y) => dowAvg[y] - dowAvg[x])[0];
    const worst = weekdays.slice().sort((x, y) => dowAvg[x] - dowAvg[y])[0];
    const maxAvg = Math.max.apply(null, weekdays.map(i => dowAvg[i])) || 1;
    patternHtml = '<div class="su-dow"><div class="su-dow-t">요일별 평균</div>'
      + [1, 2, 3, 4, 5].map(i => '<div class="su-dow-row"><b>' + DOW[i] + '</b>'
          + '<div class="su-dow-track"><i style="width:' + Math.round(dowAvg[i] / maxAvg * 100)
          + '%;background:' + (i === best ? 'var(--green)' : i === worst ? 'var(--amber)' : 'var(--blue)') + '"></i></div>'
          + '<span>' + moneyShort(dowAvg[i]) + '</span></div>').join('')
      + '<div class="su-dow-note">가장 강한 요일 <b>' + DOW[best] + '</b> · 가장 약한 요일 <b>' + DOW[worst] + '</b></div>'
      + '</div>';
  }

  return '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">일별 매출 캘린더</div>'
    + '<div class="chart-card-sub">색이 진할수록 매출이 큰 날 · 빨강은 공휴일 · 회색은 아직 오지 않은 날</div>'
    + '<div class="su-calwrap"><div class="su-cals">' + monthHtml + '</div>' + patternHtml + '</div>'
    + '<div class="su-legend" style="margin-top:10px"><span>적음</span>'
    + palette.map(p => '<i style="background:' + p + '"></i>').join('')
    + '<span>많음</span><em style="color:var(--red)">■ 공휴일</em></div>'
    + '</div>';
}

// ────────────────────────────────
// 카드 갤러리 (영업사원 / 유통사 거래처)
// ────────────────────────────────
function suSparkline(series, color) {
  if (!series || series.length < 2) return '<div class="su-spark-empty"></div>';
  const max = Math.max.apply(null, series), min = Math.min.apply(null, series);
  const span = (max - min) || 1;
  const w = 96, h = 30, pad = 3;
  const pts = series.map((v, i) => {
    const x = pad + i * ((w - pad * 2) / (series.length - 1));
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  const last = pts[pts.length - 1].split(',');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img"'
    + ' aria-label="월별 추이"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color
    + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.8" fill="' + color + '"/></svg>';
}

function suPersonCards(mtx, rows, prevRows, isDist, historyRows) {
  if (!mtx || !mtx.matrix.length) return '';
  const keyOf = o => (isDist ? o.client : o.person);
  // 추세는 조회기간이 한 달이어도 보여야 하므로 기간 필터와 무관한 이력을 쓴다.
  const hist = (historyRows && historyRows.length) ? historyRows : rows;
  const monthsOf = key => {
    const m = {};
    hist.forEach(o => {
      if (keyOf(o) !== key) return;
      const ym = (o.date || '').slice(0, 7);
      if (ym) m[ym] = (m[ym] || 0) + (parseFloat(o.supply) || 0);
    });
    return Object.keys(m).sort().map(k => m[k]);
  };
  const prevTotal = {};
  (prevRows || []).filter(caIsProductRow).forEach(o => {
    const k = keyOf(o);
    prevTotal[k] = (prevTotal[k] || 0) + (parseFloat(o.supply) || 0);
  });

  const cards = mtx.matrix.slice(0, isDist ? 8 : 6).map(m => {
    const user = (typeof allUsers !== 'undefined' ? allUsers : []).find(u => u && u.name === m.person);
    const raw = user ? user.color : '#2B72C8';
    const safe = (typeof safeColor === 'function') ? safeColor(raw, '#2B72C8') : '#2B72C8';
    const series = monthsOf(m.person);
    const pv = prevTotal[m.person] || 0;
    const dpct = pv > 0 ? Math.round((m.total - pv) / pv * 100) : null;
    const dTxt = (dpct === null) ? '전기 비교 불가'
      : ((dpct > 0 ? '▲' : dpct < 0 ? '▼' : '▬') + ' ' + Math.abs(dpct) + '% 전기 대비');
    const dCol = (dpct === null) ? 'var(--text3)'
      : dpct > 2 ? 'var(--green-dark)' : dpct < -2 ? 'var(--red)' : 'var(--text2)';

    const bars = m.cells.slice(0, 4).map(c => {
      const team = mtx.teamShare[c.category] || 0;
      const maxScale = Math.max(25, team * 1.6, c.share * 1.1);
      const strong = c.gap >= 5, weak = (c.gap <= -4 && team >= 5);
      const fill = strong ? 'var(--green)' : weak ? 'var(--red)' : '#9BC9B9';
      return '<div class="su-pc-row" title="' + escHtml(c.category) + ' ' + c.share.toFixed(1)
        + '% (평균 ' + team.toFixed(1) + '%)"><b>' + escHtml(c.category) + '</b>'
        + '<div class="su-pc-track"><div class="su-pc-fill" style="width:'
        + Math.min(100, c.share / maxScale * 100).toFixed(0) + '%;background:' + fill + '"></div>'
        + '<div class="su-pc-tick" style="left:' + Math.min(99, team / maxScale * 100).toFixed(0) + '%"></div></div>'
        + '<span class="su-pc-pct">' + c.share.toFixed(0) + '%</span></div>';
    }).join('');

    const tags = [];
    const minSample = (typeof CA_MIN_SAMPLE !== 'undefined') ? CA_MIN_SAMPLE : 20;
    if (m.count >= minSample) {
      m.cells.forEach(c => {
        const team = mtx.teamShare[c.category] || 0;
        if (team >= 5 && c.gap >= 5) tags.push('<span class="su-tag g">강점 ' + escHtml(c.category) + ' +' + c.gap.toFixed(0) + 'p</span>');
        if (team >= 5 && c.gap <= -4) tags.push('<span class="su-tag r">공백 ' + escHtml(c.category) + ' ' + c.gap.toFixed(0) + 'p</span>');
      });
    }

    const sub = isDist ? (m.count.toLocaleString() + '건 · 건당 ' + moneyShort(m.avgOrder) + '원')
                       : ('거래처 ' + m.clientCount + '곳 · 건당 ' + moneyShort(m.avgOrder) + '원');
    const click = isDist ? ' onclick="openClient360(\'' + escInlineJs(m.person) + '\')" style="cursor:pointer"' : '';
    return '<div class="su-pc"' + click + '>'
      + '<div class="su-pc-h"><div class="su-pc-av" style="background:' + safe + '">'
      + escHtml(String(m.person || '?').slice(0, 1)) + '</div>'
      + '<div><div class="su-pc-n">' + escHtml(m.person) + '</div>'
      + '<div class="su-pc-s">' + escHtml(sub) + '</div></div></div>'
      + '<div class="su-pc-mid">' + suSparkline(series, safe) + '<div>'
      + '<div class="su-pc-amt" title="' + Math.round(m.total).toLocaleString() + '원">'
      + moneyShort(m.total) + '<span>원</span></div>'
      + '<div class="su-pc-delta" style="color:' + dCol + '">' + dTxt + '</div></div></div>'
      + '<div class="su-pc-bars">' + bars + '</div>'
      + '<div class="su-pc-tags">' + (tags.slice(0, 3).join('')
          || '<span class="su-tag n">' + (m.count < minSample ? '표본 부족(' + m.count + '건)' : '평균 수준') + '</span>') + '</div>'
      + '</div>';
  }).join('');

  return '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">' + (isDist ? '거래처별 카드' : '영업사원별 카드') + '</div>'
    + '<div class="chart-card-sub">막대의 회색 세로선 = ' + (isDist ? '채널' : '팀')
    + ' 평균 위치 · 넘으면 강점, 못 미치면 공백</div>'
    + '<div class="su-cards">' + cards + '</div></div>';
}

// ────────────────────────────────
// 브리핑 헤더
// ────────────────────────────────
function suBriefCard(a, insights, channel, dateFrom, dateTo) {
  const isDist = channel === 'dist';
  const label = isDist ? '유통사' : '사업소';
  const t = (typeof targets !== 'undefined' && targets) ? targets : {};
  const tgt = parseFloat(isDist ? t.distSalesTarget : t.officeSalesTarget) || parseFloat(t.salesTarget) || 0;

  // 기간 필터가 비어 있으면 실제 데이터가 있는 구간을 그대로 쓴다.
  // (임의로 이번달이라고 적으면 합계와 라벨이 어긋난다)
  const dates = a.rows.map(r => r.date).filter(Boolean).sort();
  const from = dateFrom || dates[0] || (ymLocal(new Date()) + '-01');
  const to = dateTo || dates[dates.length - 1] || todayYmd();
  const today = todayYmd();

  let totalDays = 0, passedDays = 0;
  const cur = new Date(from + 'T00:00:00'), endD = new Date(to + 'T00:00:00');
  let guard = 0;
  while (cur <= endD && guard++ < 800) {
    const ds = ymdLocal(cur);
    const w = cur.getDay();
    const hol = (typeof krHolidayName === 'function') ? krHolidayName(ds) : null;
    if (w !== 0 && w !== 6 && !hol) { totalDays++; if (ds <= today) passedDays++; }
    cur.setDate(cur.getDate() + 1);
  }
  const paceExp = totalDays > 0 ? passedDays / totalDays * 100 : 0;
  const achieve = tgt > 0 ? a.total / tgt * 100 : null;

  let headline, sub;
  if (achieve === null) {
    headline = label + ' 기간 매출 <em>' + moneyShort(a.total) + '원</em> · 거래처 <em>'
      + a.clientCount.toLocaleString() + '곳</em>';
    sub = '목표가 설정되지 않아 달성률은 계산하지 않았습니다 · 영업일 ' + passedDays + '/' + totalDays + ' 경과';
  } else {
    const gap = achieve - paceExp;
    const paceTxt = gap < -3 ? '<s>' + Math.abs(gap).toFixed(0) + '%p 뒤처짐</s>'
      : gap > 3 ? '<em>' + gap.toFixed(0) + '%p 앞섬</em>' : '<b>정상</b>';
    headline = label + ' <em>' + moneyShort(a.total) + '원</em>, 목표의 <em>'
      + achieve.toFixed(0) + '%</em> — 페이스 ' + paceTxt;
    const remain = Math.max(0, tgt - a.total);
    const leftDays = Math.max(0, totalDays - passedDays);
    sub = '영업일 ' + passedDays + '/' + totalDays + ' 경과'
      + (remain > 0 ? ' · 남은 ' + leftDays + '영업일에 ' + moneyShort(remain) + '원 필요' : ' · 목표 달성');
  }

  const pick = sev => insights.find(i => i.sev === sev);
  const sig = [
    { k: 'red', t: '지금 손대야 할 것', v: pick('crit') },
    { k: 'amb', t: '놓치고 있는 것', v: pick('warn') },
    { k: 'grn', t: '잘 되고 있는 것', v: pick('ok') },
  ].filter(s => s.v);

  const sigHtml = sig.length
    ? '<div class="su-bf-sig">' + sig.map(s => '<div class="su-sig ' + s.k + '">'
        + '<div class="su-sig-t">' + s.t + '</div>'
        + '<div class="su-sig-v">' + escHtml(s.v.title) + '</div>'
        + '<div class="su-sig-d">' + escHtml(s.v.desc) + '</div></div>').join('') + '</div>'
    : '';

  return '<div class="su-bf"><div class="su-bf-top">'
    + '<span class="su-bf-tag">' + label + '</span>'
    + '<span class="su-bf-date">' + escHtml(from) + ' ~ ' + escHtml(to) + '</span></div>'
    + '<div class="su-bf-head">' + headline + '</div>'
    + '<div class="su-bf-sub">' + escHtml(sub) + '</div>' + sigHtml + '</div>';
}
