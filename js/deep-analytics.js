// ════════════════════════════════════
// 심화 분석 — 매출 변동 분해 / 코호트 / RFM / 교차판매 / 단가 편차
//   계산부는 DOM을 건드리지 않는다. 할인·조정 라인은 품목이 아니므로 제외한다.
// ════════════════════════════════════

let daChannel = 'office';
let daTab = 'bridge';

function daRows() {
  return (allOrders || []).filter(o => orderChannel(o) === daChannel && caIsProductRow(o));
}

function daMonths(rows) {
  return [...new Set(rows.map(o => (o.date || '').slice(0, 7)).filter(Boolean))].sort();
}

// ────────────────────────────────
// ① 매출 변동 분해 (Bridge)
//    증감을 신규 / 이탈 / 기존증가 / 기존감소 넷으로 완전 분해한다.
//    네 값의 합은 반드시 총 증감과 일치한다.
// ────────────────────────────────
function daBridge(rows, curYm, prevYm) {
  const agg = ym => {
    const m = {};
    rows.forEach(o => { if ((o.date || '').startsWith(ym)) m[o.client] = (m[o.client] || 0) + (parseFloat(o.supply) || 0); });
    return m;
  };
  const cur = agg(curYm), prev = agg(prevYm);
  const keys = new Set(Object.keys(cur).concat(Object.keys(prev)));
  let sNew = 0, sLost = 0, sGrow = 0, sDrop = 0;
  const detail = { new: [], lost: [], grow: [], drop: [] };
  keys.forEach(c => {
    const a = cur[c] || 0, b = prev[c] || 0;
    if (b === 0 && a !== 0) { sNew += a; detail.new.push({ client: c, amount: a }); }
    else if (a === 0 && b !== 0) { sLost -= b; detail.lost.push({ client: c, amount: -b }); }
    else if (a > b) { sGrow += a - b; detail.grow.push({ client: c, amount: a - b, from: b, to: a }); }
    else if (a < b) { sDrop += a - b; detail.drop.push({ client: c, amount: a - b, from: b, to: a }); }
  });
  Object.keys(detail).forEach(k => detail[k].sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount)));
  const prevTotal = Object.values(prev).reduce((s, v) => s + v, 0);
  const curTotal = Object.values(cur).reduce((s, v) => s + v, 0);
  return {
    prevYm, curYm, prevTotal, curTotal, diff: curTotal - prevTotal,
    parts: [
      { key: 'new', label: '신규 거래처', value: sNew, count: detail.new.length },
      { key: 'grow', label: '기존 증가', value: sGrow, count: detail.grow.length },
      { key: 'drop', label: '기존 감소', value: sDrop, count: detail.drop.length },
      { key: 'lost', label: '이탈 거래처', value: sLost, count: detail.lost.length },
    ],
    detail,
  };
}

function daBridgeSvg(b) {
  const W = 720, H = 300, padT = 26, padB = 54, padL = 8;
  const cols = [{ label: b.prevYm, value: b.prevTotal, type: 'base' }]
    .concat(b.parts.map(p => ({ label: p.label, value: p.value, type: p.value >= 0 ? 'up' : 'down', count: p.count })))
    .concat([{ label: b.curYm, value: b.curTotal, type: 'base' }]);
  const maxV = Math.max(b.prevTotal, b.curTotal, 1);
  const plotH = H - padT - padB;
  const scale = v => (v / maxV) * plotH;
  const bw = (W - padL * 2) / cols.length - 12;
  const color = { base: '#5C7A72', up: '#00A582', down: '#D94040' };

  let running = 0, out = '';
  cols.forEach((c, i) => {
    const x = padL + i * ((W - padL * 2) / cols.length) + 6;
    let y, h, top;
    if (c.type === 'base') {
      h = Math.max(2, scale(c.value)); y = padT + plotH - h; running = c.value; top = c.value;
    } else {
      const start = running, end = running + c.value;
      const hi = Math.max(start, end), lo = Math.min(start, end);
      h = Math.max(2, scale(hi - lo)); y = padT + plotH - scale(hi); running = end; top = hi;
    }
    const label = c.type === 'base' ? moneyShort(c.value)
      : (c.value >= 0 ? '+' : '') + moneyShort(c.value);
    out += '<g><title>' + escHtml(c.label + ' · ' + Math.round(c.value).toLocaleString() + '원'
      + (c.count !== undefined ? ' · 거래처 ' + c.count + '곳' : '')) + '</title>'
      + '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1)
      + '" height="' + h.toFixed(1) + '" fill="' + color[c.type] + '" rx="3"/>'
      + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 7).toFixed(1)
      + '" font-size="11.5" font-weight="700" text-anchor="middle" fill="' + color[c.type] + '"'
      + ' font-family="ui-monospace,monospace">' + label + '</text>'
      + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - padB + 20).toFixed(1)
      + '" font-size="11" text-anchor="middle" fill="currentColor" opacity=".75">' + escHtml(c.label) + '</text>'
      + (c.count !== undefined ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - padB + 36).toFixed(1)
          + '" font-size="10" text-anchor="middle" fill="currentColor" opacity=".45">' + c.count + '곳</text>' : '')
      + '</g>';
  });
  out += '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padL) + '" y2="' + (padT + plotH)
    + '" stroke="currentColor" stroke-width="1" opacity=".25"/>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" width="100%"'
    + ' style="min-width:600px;height:auto;display:block"'
    + ' aria-label="매출 변동 분해 폭포 차트. 전월 매출에서 신규·기존증가·기존감소·이탈을 거쳐 당월 매출에 도달.">'
    + out + '</svg>';
}

// ────────────────────────────────
// ② 코호트 유지율
//    거래를 처음 시작한 달로 거래처를 묶고, 이후 각 달에 거래가 있었는지 본다.
// ────────────────────────────────
function daCohort(rows) {
  const months = daMonths(rows);
  const first = {}, active = {};
  months.forEach(m => { active[m] = new Set(); });
  rows.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(o => {
    const ym = (o.date || '').slice(0, 7);
    if (!ym) return;
    if (!first[o.client]) first[o.client] = ym;
    if (active[ym]) active[ym].add(o.client);
  });
  const cohorts = months.map(cm => {
    const members = Object.keys(first).filter(c => first[c] === cm);
    const rates = months.slice(months.indexOf(cm)).map(m =>
      members.length ? members.filter(c => active[m].has(c)).length / members.length * 100 : 0);
    const revenue = rows.filter(o => first[o.client] === cm)
      .reduce((s, o) => s + (parseFloat(o.supply) || 0), 0);
    return { ym: cm, size: members.length, rates, revenue, members };
  }).filter(c => c.size > 0);
  return { months, cohorts };
}

// ────────────────────────────────
// ③ RFM 세그먼트
// ────────────────────────────────
function daRFM(rows) {
  const last = {}, days = {}, money = {};
  rows.forEach(o => {
    const c = o.client; if (!c || !o.date) return;
    if (!last[c] || o.date > last[c]) last[c] = o.date;
    (days[c] = days[c] || new Set()).add(o.date);
    money[c] = (money[c] || 0) + (parseFloat(o.supply) || 0);
  });
  const clients = Object.keys(last);
  if (!clients.length) return { segments: [], clients: [] };
  const today = todayYmd();
  const dayDiff = d => Math.round((new Date(today + 'T00:00:00') - new Date(d + 'T00:00:00')) / 86400000);

  const quint = arr => {
    const v = arr.slice().sort((a, b) => a - b);
    return [1, 2, 3, 4].map(i => v[Math.min(v.length - 1, Math.floor(v.length * i / 5))]);
  };
  const rQ = quint(clients.map(c => dayDiff(last[c])));
  const fQ = quint(clients.map(c => days[c].size));
  const mQ = quint(clients.map(c => money[c]));
  const scoreOf = (v, qs) => { let s = 1; qs.forEach(t => { if (v > t) s++; }); return s; };

  const list = clients.map(c => {
    const rec = dayDiff(last[c]);
    const R = 6 - scoreOf(rec, rQ);        // 최근일수록 높게
    const F = scoreOf(days[c].size, fQ);
    const M = scoreOf(money[c], mQ);
    let seg;
    if (R >= 4 && F >= 4) seg = 'champion';
    else if (R >= 3 && F >= 3) seg = 'loyal';
    else if (R >= 4 && F <= 2) seg = 'new';
    else if (R <= 2 && F >= 3) seg = 'atrisk';
    else if (R <= 2) seg = 'dormant';
    else seg = 'normal';
    return { client: c, R, F, M, seg, recency: rec, freq: days[c].size, money: money[c], last: last[c] };
  });

  const META = {
    champion: { label: '챔피언', cls: 'ok', desc: '최근·자주·많이 — 관계 유지와 상향 판매' },
    loyal: { label: '충성', cls: 'ok', desc: '꾸준한 거래 — 교차판매 여지' },
    new: { label: '신규·일회성', cls: 'info', desc: '최근 시작 — 두 번째 거래로 이어가야 함' },
    atrisk: { label: '이탈 위험(우량)', cls: 'crit', desc: '자주 샀는데 최근 뜸함 — 즉시 연락' },
    dormant: { label: '휴면', cls: 'warn', desc: '오래 거래 없음 — 재접촉 캠페인 대상' },
    normal: { label: '일반', cls: 'mut', desc: '평균권 — 유지 관리' },
  };
  const segments = Object.keys(META).map(k => {
    const mem = list.filter(x => x.seg === k);
    return {
      key: k, label: META[k].label, cls: META[k].cls, desc: META[k].desc,
      count: mem.length, money: mem.reduce((s, x) => s + x.money, 0),
      members: mem.sort((a, b) => b.money - a.money),
    };
  }).filter(s => s.count > 0).sort((a, b) => b.money - a.money);
  return { segments, clients: list };
}

// ────────────────────────────────
// ④ 교차판매 — 품목군 동시 보유 규칙
//    지지도(기반 거래처 수), 신뢰도, 향상도(lift)로 거른다.
// ────────────────────────────────
function daCrossSell(rows, minBase, minConf, minLift) {
  const own = {};
  rows.forEach(o => {
    const c = o.client, cat = (o.category || '').trim();
    if (!c || !cat) return;
    (own[c] = own[c] || new Set()).add(cat);
  });
  const clients = Object.keys(own);
  const N = clients.length;
  if (N < 20) return { rules: [], clientCount: N };
  const cnt = {}, pair = {};
  clients.forEach(c => {
    const arr = [...own[c]].sort();
    arr.forEach(a => { cnt[a] = (cnt[a] || 0) + 1; });
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const k = arr[i] + ' ' + arr[j];
        pair[k] = (pair[k] || 0) + 1;
      }
  });
  const rules = [];
  Object.keys(pair).forEach(k => {
    const [a, b] = k.split(' ');
    const n = pair[k];
    [[a, b], [b, a]].forEach(([x, y]) => {
      const base = cnt[x] || 0;
      if (base < (minBase || 30)) return;
      const conf = n / base;
      const lift = conf / ((cnt[y] || 0) / N);
      if (conf < (minConf || 0.45) || lift < (minLift || 1.1)) return;
      const missing = clients.filter(c => own[c].has(x) && !own[c].has(y));
      rules.push({ from: x, to: y, base, conf: conf * 100, lift, missing });
    });
  });
  rules.sort((a, b) => (b.lift * b.missing.length) - (a.lift * a.missing.length));
  return { rules, clientCount: N };
}

// ────────────────────────────────
// ⑤ 실질 단가 편차 — supply / qty
//    단위가 섞인 품목(박스·낱개)은 편차가 비정상적으로 커지므로 따로 표시한다.
// ────────────────────────────────
function daPriceVariance(rows, minSamples) {
  const byProduct = {};
  rows.forEach(o => {
    const q = parseFloat(o.qty) || 0, s = parseFloat(o.supply) || 0;
    if (q <= 0 || s <= 0) return;
    (byProduct[o.product] = byProduct[o.product] || []).push({ unit: s / q, client: o.client });
  });
  const min = minSamples || 25;
  const out = [];
  Object.keys(byProduct).forEach(p => {
    const arr = byProduct[p];
    if (arr.length < min) return;
    const v = arr.map(x => x.unit).sort((a, b) => a - b);
    const at = f => v[Math.min(v.length - 1, Math.floor(v.length * f))];
    const med = at(0.5), p10 = at(0.1), p90 = at(0.9);
    if (med <= 0) return;
    const spread = (p90 - p10) / med * 100;
    // 편차가 200%를 넘으면 가격 차이가 아니라 수량 단위 혼재일 가능성이 높다
    const suspect = spread > 200;
    const cheap = arr.slice().sort((a, b) => a.unit - b.unit).slice(0, 3);
    const rich = arr.slice().sort((a, b) => b.unit - a.unit).slice(0, 3);
    out.push({ product: p, n: arr.length, med, p10, p90, spread, suspect, cheap, rich });
  });
  return out.sort((a, b) => b.spread - a.spread);
}

// ════════════════════════════════════
// 렌더
// ════════════════════════════════════
function setDeepChannel(ch) {
  daChannel = ch;
  document.querySelectorAll('.da-ch').forEach(b => b.classList.toggle('active', b.dataset.ch === ch));
  renderDeep();
}
function showDeepTab(t) {
  daTab = t;
  document.querySelectorAll('.da-tab').forEach(b => b.classList.toggle('active', b.dataset.t === t));
  document.querySelectorAll('.da-pane').forEach(p => { p.style.display = (p.id === 'da-' + t + '-pane') ? '' : 'none'; });
}

function renderDeep() {
  const rows = daRows();
  const host = document.getElementById('da-body');
  if (!host) return;
  const warn = document.getElementById('da-empty');
  if (!rows.length) {
    if (warn) warn.innerHTML = emptyState('이 채널에 매출 데이터가 없습니다', '다른 채널을 선택하거나 ERP 동기화를 확인해 보세요', '📊');
    host.style.display = 'none';
    return;
  }
  if (warn) warn.innerHTML = '';
  host.style.display = '';

  daRenderBridge(rows);
  daRenderCohort(rows);
  daRenderRFM(rows);
  daRenderCross(rows);
  daRenderPrice(rows);
}

function daRenderBridge(rows) {
  const months = daMonths(rows);
  const sel = document.getElementById('da-bridge-month');
  if (sel && sel.options.length !== months.length) {
    sel.innerHTML = months.slice(1).reverse().map(m => '<option value="' + m + '">' + m + '</option>').join('');
  }
  const curYm = (sel && sel.value) || months[months.length - 1];
  const idx = months.indexOf(curYm);
  const prevYm = idx > 0 ? months[idx - 1] : months[0];
  const b = daBridge(rows, curYm, prevYm);
  const check = Math.abs(b.parts.reduce((s, p) => s + p.value, 0) - b.diff) < 1;

  const list = (key, title, cls) => {
    const items = b.detail[key].slice(0, 5);
    if (!items.length) return '';
    return '<div class="da-col"><h4 class="' + cls + '">' + title + ' <span>' + b.detail[key].length + '곳</span></h4>'
      + items.map(i => '<div class="da-li" onclick="openClient360(&#39;' + escInlineJs(i.client) + '&#39;)">'
          + '<span>' + escHtml(i.client) + '</span><b class="' + cls + '">'
          + (i.amount >= 0 ? '+' : '') + moneyShort(i.amount) + '</b></div>').join('')
      + '</div>';
  };

  document.getElementById('da-bridge').innerHTML =
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">매출 변동 분해 · ' + prevYm + ' → ' + curYm + '</div>'
    + '<div class="chart-card-sub">증감을 신규·기존증가·기존감소·이탈 넷으로 완전 분해합니다'
    + (check ? ' (합계 검증 ✓)' : ' <b style="color:var(--red)">(합계 불일치)</b>') + '</div>'
    + '<div class="da-svgwrap">' + daBridgeSvg(b) + '</div>'
    + '<div class="da-summary">'
    + '<span>전월 <b>' + moneyShort(b.prevTotal) + '</b></span>'
    + '<span class="' + (b.diff >= 0 ? 'up' : 'down') + '">' + (b.diff >= 0 ? '▲' : '▼') + ' ' + moneyShort(Math.abs(b.diff))
    + ' (' + (b.prevTotal > 0 ? (b.diff / b.prevTotal * 100).toFixed(1) : '0') + '%)</span>'
    + '<span>당월 <b>' + moneyShort(b.curTotal) + '</b></span>'
    + '</div>'
    + '<div class="da-cols">'
    + list('drop', '가장 많이 줄어든 거래처', 'down')
    + list('lost', '이탈한 거래처', 'down')
    + list('grow', '가장 많이 늘어난 거래처', 'up')
    + list('new', '새로 생긴 거래처', 'up')
    + '</div></div>';
}

function daRenderCohort(rows) {
  const { months, cohorts } = daCohort(rows);
  if (!cohorts.length) { document.getElementById('da-cohort').innerHTML = ''; return; }
  const maxLen = Math.max.apply(null, cohorts.map(c => c.rates.length));
  const head = '<th>시작월</th><th class="r">거래처</th>'
    + Array.from({ length: maxLen }, (_, i) => '<th class="r">M+' + i + '</th>').join('');
  const shade = v => {
    if (v === null) return '';
    if (v >= 80) return 'background:#1F8A62;color:#fff';
    if (v >= 60) return 'background:#4EB78E;color:#fff';
    if (v >= 40) return 'background:#A8DCC8';
    if (v >= 20) return 'background:#DDF0E7';
    if (v > 0) return 'background:#F5FAF8';
    return 'background:var(--surface2);color:var(--text3)';
  };
  const body = cohorts.map(c =>
    '<tr><td data-label="시작월"><b>' + c.ym + '</b></td>'
    + '<td class="r" data-label="거래처">' + c.size + '곳</td>'
    + Array.from({ length: maxLen }, (_, i) => {
        if (i >= c.rates.length) return '<td class="r da-empty"></td>';
        const v = c.rates[i];
        return '<td class="r" style="' + shade(v) + '" title="' + c.ym + ' 시작 ' + c.size + '곳 중 '
          + Math.round(v / 100 * c.size) + '곳 거래">' + v.toFixed(0) + '%</td>';
      }).join('') + '</tr>').join('');

  // 자동 해석 — 첫 달 이후 유지율이 급락한 코호트
  const drops = cohorts.filter(c => c.size >= 15 && c.rates.length >= 2)
    .map(c => ({ ym: c.ym, size: c.size, keep: c.rates[1] }))
    .sort((a, b) => a.keep - b.keep);
  const best = drops.length ? drops[drops.length - 1] : null;
  const worst = drops.length ? drops[0] : null;
  let note = '';
  if (worst && best && worst.ym !== best.ym && (best.keep - worst.keep) >= 20) {
    note = '<div class="da-note"><b>' + worst.ym + ' 코호트</b>는 다음 달 유지율이 '
      + worst.keep.toFixed(0) + '%로, ' + best.ym + ' 코호트(' + best.keep.toFixed(0)
      + '%)보다 크게 낮습니다. 그 시기에 늘어난 거래처가 정착하지 못했다는 뜻이라 원인 확인이 필요합니다.</div>';
  }

  document.getElementById('da-cohort').innerHTML =
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">코호트 유지율</div>'
    + '<div class="chart-card-sub">거래를 처음 시작한 달로 묶어, 이후 각 달에 다시 거래한 비율입니다</div>'
    + note
    + '<div class="ca-tablewrap"><table class="ca-table da-cohort-t"><thead><tr>' + head + '</tr></thead>'
    + '<tbody>' + body + '</tbody></table></div></div>';
}

function daRenderRFM(rows) {
  const { segments, clients } = daRFM(rows);
  if (!segments.length) { document.getElementById('da-rfm').innerHTML = ''; return; }
  const total = clients.length;
  const totalMoney = clients.reduce((s, c) => s + c.money, 0);

  const cards = segments.map(s =>
    '<div class="da-seg ' + s.cls + '">'
    + '<div class="da-seg-h"><b>' + escHtml(s.label) + '</b><span>' + s.count + '곳 · '
    + (total ? (s.count / total * 100).toFixed(0) : 0) + '%</span></div>'
    + '<div class="da-seg-m" title="' + Math.round(s.money).toLocaleString() + '원">' + moneyShort(s.money) + '원 · 매출 비중 '
    + (totalMoney > 0 ? (s.money / totalMoney * 100).toFixed(0) : 0) + '%</div>'
    + '<div class="da-seg-d">' + escHtml(s.desc) + '</div>'
    + '<div class="da-seg-list">' + s.members.slice(0, 4).map(m =>
        '<div class="da-li" onclick="openClient360(&#39;' + escInlineJs(m.client) + '&#39;)">'
        + '<span>' + escHtml(m.client) + '</span><b>' + m.recency + '일 전</b></div>').join('')
      + (s.members.length > 4 ? '<div class="da-more">외 ' + (s.members.length - 4) + '곳</div>' : '')
    + '</div></div>').join('');

  const atrisk = segments.find(s => s.key === 'atrisk');
  const note = atrisk
    ? '<div class="da-note crit"><b>이탈 위험(우량) ' + atrisk.count + '곳</b>은 과거 자주 거래했는데 최근 뜸해진 거래처입니다. '
      + '누적 매출 ' + moneyShort(atrisk.money) + '원 규모라 가장 먼저 연락할 대상입니다.</div>'
    : '';

  document.getElementById('da-rfm').innerHTML =
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">RFM 세그먼트</div>'
    + '<div class="chart-card-sub">최근성(R)·거래빈도(F)·거래금액(M)을 5분위로 점수화해 거래처 '
    + total + '곳을 분류했습니다</div>' + note
    + '<div class="da-segs">' + cards + '</div></div>';
}

function daRenderCross(rows) {
  const { rules, clientCount } = daCrossSell(rows, 30, 0.45, 1.1);
  const host = document.getElementById('da-cross');
  if (!rules.length) {
    host.innerHTML = '<div class="chart-card" style="margin-bottom:16px">'
      + '<div class="chart-card-title">교차판매 기회</div>'
      + emptyState('규칙을 만들 만한 거래처 수가 부족합니다', '거래처가 20곳 이상이고 품목군이 다양할 때 분석됩니다', '🔗')
      + '</div>';
    return;
  }
  const body = rules.slice(0, 10).map(r =>
    '<tr><td data-label="이미 사는 품목군"><b>' + escHtml(r.from) + '</b></td>'
    + '<td class="da-arrow">→</td>'
    + '<td data-label="제안 품목군">' + escHtml(r.to) + '</td>'
    + '<td class="r" data-label="신뢰도" title="' + escHtml(r.from) + '을 사는 거래처 중 ' + escHtml(r.to)
    + '도 사는 비율">' + r.conf.toFixed(0) + '%</td>'
    + '<td class="r" data-label="향상도" title="무작위 대비 몇 배로 함께 사는지">' + r.lift.toFixed(2) + '배</td>'
    + '<td class="r" data-label="미공략"><b class="da-op">' + r.missing.length + '곳</b></td>'
    + '<td class="da-targets">' + r.missing.slice(0, 3).map(c =>
        '<span onclick="openClient360(&#39;' + escInlineJs(c) + '&#39;)">' + escHtml(c) + '</span>').join('')
      + (r.missing.length > 3 ? '<em>외 ' + (r.missing.length - 3) + '곳</em>' : '') + '</td></tr>').join('');

  const top = rules[0];
  host.innerHTML =
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">교차판매 기회</div>'
    + '<div class="chart-card-sub">함께 사는 경향이 강한 품목군 조합입니다 · 거래처 ' + clientCount + '곳 기준</div>'
    + '<div class="da-note"><b>' + escHtml(top.from) + '</b>을 취급하는 거래처는 <b>' + escHtml(top.to)
    + '</b>도 함께 살 확률이 무작위 대비 <b>' + top.lift.toFixed(1) + '배</b> 높습니다. '
    + '그런데 아직 <b>' + top.missing.length + '곳</b>이 ' + escHtml(top.to) + '를 사지 않고 있습니다.</div>'
    + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr>'
    + '<th>이미 사는 품목군</th><th></th><th>제안 품목군</th><th class="r">신뢰도</th>'
    + '<th class="r">향상도</th><th class="r">미공략</th><th>대상 거래처</th></tr></thead>'
    + '<tbody>' + body + '</tbody></table></div></div>';
}

function daRenderPrice(rows) {
  const items = daPriceVariance(rows, 25);
  const host = document.getElementById('da-price');
  if (!items.length) {
    host.innerHTML = '<div class="chart-card" style="margin-bottom:16px">'
      + '<div class="chart-card-title">실질 단가 편차</div>'
      + emptyState('표본이 충분한 품목이 없습니다', '한 품목당 25건 이상 거래가 있어야 분석됩니다', '💰')
      + '</div>';
    return;
  }
  const normal = items.filter(i => !i.suspect).slice(0, 10);
  const suspect = items.filter(i => i.suspect).slice(0, 5);

  const bar = i => {
    const lo = i.p10, hi = i.p90, med = i.med;
    const span = (hi - lo) || 1;
    const pos = v => Math.max(0, Math.min(100, (v - lo) / span * 100));
    return '<div class="da-box"><div class="da-box-line"></div>'
      + '<div class="da-box-range" style="left:0%;right:0%"></div>'
      + '<div class="da-box-med" style="left:' + pos(med).toFixed(0) + '%"></div></div>';
  };
  const row = i =>
    '<tr><td data-label="품목">' + escHtml(i.product) + '</td>'
    + '<td class="r" data-label="중앙 단가">' + Math.round(i.med).toLocaleString() + '</td>'
    + '<td class="da-boxcell">' + bar(i) + '</td>'
    + '<td class="r" data-label="하위10%">' + Math.round(i.p10).toLocaleString() + '</td>'
    + '<td class="r" data-label="상위10%">' + Math.round(i.p90).toLocaleString() + '</td>'
    + '<td class="r" data-label="편차"><b class="' + (i.spread >= 30 ? 'da-op' : '') + '">'
    + i.spread.toFixed(0) + '%</b></td>'
    + '<td class="r" data-label="건수">' + i.n + '</td></tr>';

  const suspectHtml = suspect.length
    ? '<details class="su-more"><summary>편차 200% 초과 ' + suspect.length + '건 — 수량 단위 확인 필요</summary>'
      + '<div class="da-note warn">아래 품목은 편차가 지나치게 큽니다. 가격 차이라기보다 <b>낱개와 박스가 같은 품목으로 섞여</b> 있을 가능성이 높습니다. '
      + 'ERP의 관리단위를 확인해 보세요.</div>'
      + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th>품목</th>'
      + '<th class="r">중앙 단가</th><th></th><th class="r">하위10%</th><th class="r">상위10%</th>'
      + '<th class="r">편차</th><th class="r">건수</th></tr></thead><tbody>'
      + suspect.map(row).join('') + '</tbody></table></div></details>'
    : '';

  host.innerHTML =
    '<div class="chart-card" style="margin-bottom:16px">'
    + '<div class="chart-card-title">실질 단가 편차</div>'
    + '<div class="chart-card-sub">공급가 ÷ 수량으로 계산한 실제 판매 단가입니다 · 같은 품목을 거래처마다 얼마에 파는지 보여줍니다</div>'
    + '<div class="ca-tablewrap"><table class="ca-table mob-cards"><thead><tr><th>품목</th>'
    + '<th class="r">중앙 단가</th><th>하위10% ─ 상위10%</th><th class="r">하위10%</th>'
    + '<th class="r">상위10%</th><th class="r">편차</th><th class="r">건수</th></tr></thead><tbody>'
    + normal.map(row).join('') + '</tbody></table></div>'
    + suspectHtml + '</div>';
}
