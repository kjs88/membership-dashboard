/* Closing-basis figures are separate from the order/shipment data store. */
const costAnalysis = (() => {
  const VIEW_GROUPS = [
    { tab: '마감기준', views: [['closing-customer', '고객'], ['closing-item', '품목'], ['closing-employee', '담당자'], ['closing-management', '관리구분'], ['closing-project', '프로젝트'], ['closing-dept', '부서']] },
    { tab: '관리분류별', views: [['mgmt-customer-class', '고객분류'], ['mgmt-area', '지역'], ['mgmt-area-group', '지역그룹'], ['mgmt-manager-group', '담당그룹']] },
    { tab: '품목분류별', views: [['item-group', '품목군'], ['item-large', '대분류'], ['item-middle', '중분류'], ['item-small', '소분류']] }
  ];
  const VIEW_MAP = new Map(VIEW_GROUPS.flatMap(group => group.views.map(([key, label]) => [key, { key, label, tab: group.tab }])));
  const DEFAULT_VIEW = 'mgmt-customer-class';
  const DEFAULT_FILTERS = { span: false, from: '', to: '', profit: 'all', rateMin: '', rateMax: '', minSales: '', limit: '' };
  const state = { month: '', view: DEFAULT_VIEW, query: '', sort: { key: 'sales', dir: 'desc' }, years: new Map(), loading: false, error: '', request: 0, controller: null, chart: null, filters: { ...DEFAULT_FILTERS } };
  const money = value => Math.round(value).toLocaleString('ko-KR');
  const rate = (profit, sales) => sales === 0 ? null : profit / sales * 100;
  const rateText = value => value === null ? '-' : `${value.toFixed(3)}%`;
  const rateValue = (profit, sales) => {
    const value = rate(profit, sales);
    return value === null ? null : Number(value.toFixed(3));
  };
  const currentMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date());
  const total = rows => rows.reduce((sum, row) => ({ sales: sum.sales + row.sales, cost: sum.cost + row.cost, profit: sum.profit + row.profit }), { sales: 0, cost: 0, profit: 0 });
  const viewMeta = () => VIEW_MAP.get(state.view) || VIEW_MAP.get(DEFAULT_VIEW);
  const activeGroup = () => VIEW_GROUPS.find(group => group.tab === viewMeta().tab) || VIEW_GROUPS[1];
  const rowsFor = data => {
    if (!data) return [];
    const view = data.views?.[state.view];
    if (view) return Array.isArray(view.rows) ? view.rows : [];
    return state.view === DEFAULT_VIEW ? data.rows || [] : [];
  };
  // 구간 조회: from~to 사이의 달을 코드 기준으로 합산한다. 매익률은 합계로 다시 계산한다.
  const rangeBounds = () => {
    const f = state.filters;
    if (!f.span) return { from: state.month, to: state.month };
    const from = f.from || state.month;
    const to = f.to || state.month;
    return from <= to ? { from, to } : { from: to, to: from };
  };
  const monthsInRange = () => {
    const { from, to } = rangeBounds();
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) return [state.month];
    const out = [];
    let [y, m] = from.split('-').map(Number);
    const [ey, em] = to.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1; if (m > 12) { m = 1; y += 1; }
      if (out.length > 120) break;
    }
    return out;
  };
  const yearsInRange = () => [...new Set(monthsInRange().map(m => m.slice(0, 4)))];
  const monthData = month => (state.years.get(month.slice(0, 4)) || {})[month] || null;
  const rangeData = () => {
    const list = monthsInRange().map(monthData).filter(Boolean);
    return { list, missing: monthsInRange().filter(m => !monthData(m)) };
  };
  // 구간이면 합산 행, 단월이면 그 달의 행
  const activeRows = () => {
    const months = monthsInRange();
    if (months.length <= 1) return rowsFor(monthData(months[0] || state.month));
    const map = new Map();
    months.forEach(m => {
      rowsFor(monthData(m)).forEach(row => {
        const key = row.code || row.name || '';
        const acc = map.get(key) || { code: row.code, name: row.name, sales: 0, cost: 0, profit: 0 };
        acc.sales += row.sales; acc.cost += row.cost; acc.profit += row.profit;
        if (row.name) acc.name = row.name;
        map.set(key, acc);
      });
    });
    return [...map.values()];
  };
  // 빈 값은 '조건 없음'이어야 한다. Number('')는 0이라 그대로 쓰면 전부 걸러진다.
  const num = value => {
    const raw = String(value === null || value === undefined ? '' : value).replace(/[^0-9.-]/g, '');
    if (raw === '' || raw === '-' || raw === '.') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const activeFilterChips = () => {
    const f = state.filters, chips = [];
    if (f.span) { const b = rangeBounds(); chips.push({ key: 'span', label: `기간 ${b.from} ~ ${b.to}` }); }
    if (f.profit === 'loss') chips.push({ key: 'profit', label: '적자만' });
    if (f.profit === 'plus') chips.push({ key: 'profit', label: '흑자만' });
    if (num(f.rateMin) !== null) chips.push({ key: 'rateMin', label: `매익률 ${num(f.rateMin)}% 이상` });
    if (num(f.rateMax) !== null) chips.push({ key: 'rateMax', label: `매익률 ${num(f.rateMax)}% 이하` });
    if (num(f.minSales)) chips.push({ key: 'minSales', label: `매출 ${money(num(f.minSales))}원 이상` });
    if (num(f.limit)) chips.push({ key: 'limit', label: `상위 ${num(f.limit)}개` });
    if (state.query.trim()) chips.push({ key: 'query', label: `검색 "${state.query.trim()}"` });
    return chips;
  };
  const rowRate = row => rate(row.profit, row.sales);
  const filterRows = rows => {
    const f = state.filters;
    const query = state.query.trim().toLowerCase();
    const rMin = num(f.rateMin), rMax = num(f.rateMax), minS = num(f.minSales);
    return rows.filter(row => {
      if (query && !`${row.name || ''} ${row.code || ''}`.toLowerCase().includes(query)) return false;
      if (f.profit === 'loss' && !(row.profit < 0)) return false;
      if (f.profit === 'plus' && !(row.profit > 0)) return false;
      if (minS !== null && row.sales < minS) return false;
      if (rMin !== null || rMax !== null) {
        const r = rowRate(row);
        if (r === null) return false;                 // 매출 0은 매익률을 정의할 수 없다
        if (rMin !== null && r < rMin) return false;
        if (rMax !== null && r > rMax) return false;
      }
      return true;
    });
  };
  const sortedRows = rows => {
    const { key, dir } = state.sort;
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = key === 'name' ? (a.name || '') : key === 'rate' ? rowRate(a) : a[key];
      const bv = key === 'name' ? (b.name || '') : key === 'rate' ? rowRate(b) : b[key];
      if (typeof av === 'string' || typeof bv === 'string') return sign * String(av).localeCompare(String(bv), 'ko');
      const an = av === null || av === undefined ? -Infinity : av;
      const bn = bv === null || bv === undefined ? -Infinity : bv;
      return sign * (an - bn) || (a.name || '').localeCompare(b.name || '', 'ko');
    });
  };
  const displayRows = rows => {
    const out = sortedRows(filterRows(rows));
    const limit = num(state.filters.limit);
    return limit && limit > 0 ? out.slice(0, limit) : out;
  };
  const sortMark = key => state.sort.key === key ? (state.sort.dir === 'asc' ? '▲' : '▼') : '';
  const sortableTh = (key, label, scope = 'col') => `<th scope="${scope}" class="cost-sortable ${state.sort.key === key ? 'active' : ''}" data-cost-sort="${key}"><button type="button">${escHtml(label)} <span>${sortMark(key)}</span></button></th>`;

  function validate(payload, year) {
    if (payload === null) return {};
    if (payload.schemaVersion !== 1 || !payload.months || typeof payload.months !== 'object') throw new Error('원가분석 데이터 형식을 확인해 주세요.');
    const months = {};
    for (const [month, data] of Object.entries(payload.months)) {
      if (!new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(month)) throw new Error('수집 월 정보가 올바르지 않습니다.');
      if (!data || !data.syncedAt || !Number.isFinite(Date.parse(data.syncedAt))) throw new Error('월별 수집 정보가 올바르지 않습니다.');
      const normalizeRows = (node, label = '월별') => {
        const rows = node.rows == null && node.rowCount === 0 ? [] : node.rows;
        if (!Array.isArray(rows) || (node.rowCount !== undefined && node.rowCount !== rows.length)) throw new Error(`${label} 행 수가 올바르지 않습니다.`);
        const codes = new Set();
        for (const row of rows) {
          if (!row || typeof row.code !== 'string' || codes.has(row.code) || typeof row.name !== 'string' || !['sales', 'cost', 'profit'].every(key => typeof row[key] === 'number' && Number.isFinite(row[key]))) throw new Error(`${label} 금액을 확인해 주세요.`);
          codes.add(row.code);
        }
        return rows;
      };
      const rows = normalizeRows(data, '월별');
      if (!Array.isArray(rows) || (data.rowCount !== undefined && data.rowCount !== rows.length)) throw new Error('월별 행 수가 올바르지 않습니다.');
      const views = {};
      if (data.views && typeof data.views === 'object') {
        for (const [key, view] of Object.entries(data.views)) {
          if (!VIEW_MAP.has(key) || !view || typeof view !== 'object') continue;
          views[key] = { ...view, rows: normalizeRows(view, VIEW_MAP.get(key).label) };
        }
      }
      months[month] = { ...data, rows, views };
    }
    return months;
  }

  async function load(force = false) {
    if (!currentUser || !userCanOpenPage('cost')) return;
    if (!state.month) state.month = currentMonth();
    const years = yearsInRange();
    state.controller?.abort();
    const request = ++state.request;
    state.error = '';
    const need = force ? years : years.filter(y => !state.years.has(y));
    if (!need.length) { state.loading = false; draw(); return; }
    const userId = currentUser.id;
    const controller = new AbortController();
    state.controller = controller;
    state.loading = true;
    state.error = '';
    draw();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const base = DB_URL.replace(/\/+$/, '');
      const loaded = await Promise.all(need.map(async y => {
        const response = await fetch(`${base}/erp/costAnalysis/${y}.json`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('원가분석 데이터를 불러오지 못했습니다.');
        return [y, validate(await response.json(), y)];
      }));
      if (request !== state.request || currentUser?.id !== userId) return;
      loaded.forEach(([y, data]) => state.years.set(y, data));
    } catch (error) {
      if (request !== state.request) return;
      state.error = error.name === 'AbortError' ? '조회 시간이 초과되었습니다. 다시 시도해 주세요.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (request === state.request) { state.loading = false; draw(); }
    }
  }

  function draw() {
    const root = document.getElementById('cost-analysis-root');
    if (!root || !currentUser) return;
    const months = state.years.get(state.month.slice(0, 4)) || {};
    const rangeInfo = rangeData();
    const data = rangeInfo.list.length ? (monthData(state.month) || rangeInfo.list[0]) : null;
    const hasData = rangeInfo.list.length > 0;
    const meta = viewMeta();
    const group = activeGroup();
    const viewRows = hasData ? activeRows() : [];
    const sum = hasData ? total(viewRows) : null;
    const rows = hasData ? displayRows(viewRows) : [];
    const filteredSum = hasData ? total(rows) : null;
    const chips = activeFilterChips();
    const span = monthsInRange();
    const periodLabel = span.length > 1 ? `${span[0]} ~ ${span[span.length - 1]} (${span.length}개월 합산)` : state.month.replace('-', '년 ') + '월';
    const unavailable = state.loading ? '불러오는 중입니다.' : state.error || '이 월의 마감기준 데이터가 아직 수집되지 않았습니다.';
    state.chart?.destroy();
    state.chart = null;
    uiSetHtml(root, `
      <div class="cost-toolbar">
        <div><h2>원가분석현황(마감기준)</h2><p>${escHtml(meta.tab)} · ${escHtml(meta.label)} · ${escHtml(periodLabel)} · 품목군 상품 · 고객분류 도매 전체</p></div>
        <div class="cost-controls"><div class="cost-month-nav">
          <button type="button" data-cost-action="previous" aria-label="이전 월" title="이전 월">‹</button>
          <input id="cost-month" type="month" aria-label="조회 월" value="${state.month}" max="${currentMonth()}">
          <button type="button" data-cost-action="next" aria-label="다음 월" title="다음 월" ${state.month >= currentMonth() ? 'disabled' : ''}>›</button>
        </div><button type="button" class="btn-sm" data-cost-action="refresh" title="데이터 새로고침" aria-label="데이터 새로고침" ${state.loading ? 'disabled' : ''}>↻</button>
        <button type="button" class="btn-sm" data-cost-action="export" ${!hasData || state.loading ? 'disabled' : ''}>엑셀</button></div>
      </div>
      <div class="cost-sync" role="status">${state.loading ? '불러오는 중' : state.error ? escHtml(state.error) : hasData ? `데이터 업데이트 ${escHtml(new Date(rangeInfo.list[rangeInfo.list.length - 1].syncedAt).toLocaleString('ko-KR', {
  timeZone: 'Asia/Seoul'
}))}${rangeInfo.missing.length ? ` · 미수집 ${escHtml(rangeInfo.missing.join(', '))}` : ''}` : '데이터 수집 대기'}</div>
      <div class="cost-tabs" role="tablist" aria-label="원가분석 기준">
        ${VIEW_GROUPS.map(item => `<button type="button" role="tab" data-cost-tab="${escHtml(item.tab)}" class="${item.tab === group.tab ? 'active' : ''}">${escHtml(item.tab)}</button>`).join('')}
      </div>
      <div class="cost-subtabs" role="tablist" aria-label="${escHtml(group.tab)} 세부 기준">
        ${group.views.map(([key, label]) => `<button type="button" role="tab" data-cost-view="${key}" class="${key === state.view ? 'active' : ''}">${escHtml(label)}</button>`).join('')}
      </div>
      <div class="cost-summary">
        ${[['매출', 'sales'], ['원가', 'cost'], ['매익', 'profit'], ['매익률', 'rate']].map(([label, key]) => `<div class="cost-metric"><span>${label}</span><strong class="${key === 'profit' && sum?.profit < 0 ? 'cost-negative' : ''}">${sum ? key === 'rate' ? rateText(rate(sum.profit, sum.sales)) : money(sum[key]) + '<small>원</small>' : '-'}</strong></div>`).join('')}
      </div>
      <section class="cost-trend"><h3>${state.month.slice(0, 4)}년 월별 매출 · 매익</h3><div class="cost-chart">${Object.keys(months).length ? '<canvas id="cost-monthly-chart" aria-label="월별 매출과 매익 추이" role="img"></canvas>' : `<div class="cost-empty">${escHtml(unavailable)}</div>`}</div></section>
      <section class="cost-detail"><div class="cost-table-heading"><h3>${escHtml(periodLabel)} ${escHtml(meta.label)}별 현황</h3><span>${hasData ? `표시 ${rows.length} / 전체 ${viewRows.length}개 · 단위 원` : '단위 원'}</span></div>
        <div class="cost-filters">
          <div class="cost-frow">
            <label class="cost-f">기간
              <select id="cf-span">
                <option value="single"${state.filters.span ? '' : ' selected'}>단월</option>
                <option value="span"${state.filters.span ? ' selected' : ''}>구간 합산</option>
              </select>
            </label>
            ${state.filters.span ? `<label class="cost-f">시작<input type="month" id="cf-from" value="${escHtml(rangeBounds().from)}" max="${currentMonth()}"></label>
            <label class="cost-f">끝<input type="month" id="cf-to" value="${escHtml(rangeBounds().to)}" max="${currentMonth()}"></label>` : ''}
            <label class="cost-f">매익
              <select id="cf-profit">
                <option value="all"${state.filters.profit === 'all' ? ' selected' : ''}>전체</option>
                <option value="plus"${state.filters.profit === 'plus' ? ' selected' : ''}>흑자만</option>
                <option value="loss"${state.filters.profit === 'loss' ? ' selected' : ''}>적자만</option>
              </select>
            </label>
            <label class="cost-f">매익률
              <input type="number" id="cf-rate-min" value="${escHtml(state.filters.rateMin)}" placeholder="최소" step="0.1" inputmode="decimal">
              <span class="cost-tilde">~</span>
              <input type="number" id="cf-rate-max" value="${escHtml(state.filters.rateMax)}" placeholder="최대" step="0.1" inputmode="decimal"><span class="cost-unit">%</span>
            </label>
          </div>
          <div class="cost-frow">
            <label class="cost-f">최소 매출
              <select id="cf-minsales">
                ${[['', '전체'], ['100000', '10만 이상'], ['1000000', '100만 이상'], ['10000000', '1,000만 이상'], ['100000000', '1억 이상']].map(([v, l]) => `<option value="${v}"${String(state.filters.minSales) === v ? ' selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            <label class="cost-f">표시
              <select id="cf-limit">
                ${[['', '전체'], ['10', '상위 10'], ['20', '상위 20'], ['50', '상위 50'], ['100', '상위 100']].map(([v, l]) => `<option value="${v}"${String(state.filters.limit) === v ? ' selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            <label class="cost-f">정렬
              <select id="cost-row-sort" aria-label="정렬 기준">
                ${[['sales:desc', '매출 높은순'], ['profit:desc', '매익 높은순'], ['profit:asc', '매익 낮은순'], ['rate:desc', '매익률 높은순'], ['rate:asc', '매익률 낮은순'], ['cost:desc', '원가 높은순'], ['name:asc', `${meta.label} 가나다순`]].map(([value, label]) => `<option value="${value}"${`${state.sort.key}:${state.sort.dir}` === value ? ' selected' : ''}>${escHtml(label)}</option>`).join('')}
              </select>
            </label>
            <input type="search" id="cost-row-filter" value="${escHtml(state.query)}" placeholder="${escHtml(meta.label)}명 또는 코드 검색" aria-label="${escHtml(meta.label)} 필터">
          </div>
          ${chips.length ? `<div class="cost-chips">${chips.map(c => `<button type="button" class="cost-chip" data-cost-clear="${c.key}" title="이 조건 지우기">${escHtml(c.label)} <span>&times;</span></button>`).join('')}<button type="button" class="cost-chip reset" data-cost-clear="all">전체 초기화</button></div>` : ''}
        </div>
        <table><thead><tr>${sortableTh('name', meta.label)}${sortableTh('sales', '매출')}${sortableTh('cost', '원가')}${sortableTh('profit', '매익')}${sortableTh('rate', '매익률')}</tr></thead>
        <tbody>${!hasData ? `<tr><td colspan="5" class="cost-empty">${escHtml(unavailable)}</td></tr>` : !rows.length ? '<tr><td colspan="5" class="cost-empty">조회 조건에 해당하는 마감 내역이 없습니다.</td></tr>' : rows.map(row => `<tr><th scope="row">${escHtml(row.name || '미지정')}</th><td>${money(row.sales)}</td><td>${money(row.cost)}</td><td class="${row.profit < 0 ? 'cost-negative' : 'cost-profit'}">${money(row.profit)}</td><td>${rateText(rate(row.profit, row.sales))}</td></tr>`).join('')}</tbody>
        ${filteredSum ? `<tfoot><tr><th scope="row">${state.query ? '필터 합계' : '합계'}</th><td>${money(filteredSum.sales)}</td><td>${money(filteredSum.cost)}</td><td class="${filteredSum.profit < 0 ? 'cost-negative' : 'cost-profit'}">${money(filteredSum.profit)}</td><td>${rateText(rate(filteredSum.profit, filteredSum.sales))}</td></tr></tfoot>` : ''}</table>
      </section>`);
    const canvas = document.getElementById('cost-monthly-chart');
    if (canvas && typeof Chart !== 'undefined') {
      const year = state.month.slice(0, 4);
      const count = year === currentMonth().slice(0, 4) ? Number(currentMonth().slice(5)) : 12;
      const series = Array.from({ length: count }, (_, i) => months[`${year}-${String(i + 1).padStart(2, '0')}`]);
      state.chart = new Chart(canvas, {
        type: 'bar',
        data: { labels: series.map((_, i) => `${i + 1}월`), datasets: [
          { label: '매출', data: series.map(item => item ? total(rowsFor(item)).sales : null), backgroundColor: '#478bc9', borderRadius: 3 },
          { label: '매익', data: series.map(item => item ? total(rowsFor(item)).profit : null), backgroundColor: '#00876a', borderRadius: 3 }
        ] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${money(ctx.parsed.y)}원` } } }, scales: { y: { ticks: { callback: value => `${money(value / 10000)}만` } } } }
      });
    }
    root.querySelector('#cost-month').addEventListener('change', event => {
      const month = event.target.value;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > currentMonth()) { draw(); return; }
      state.month = month;
      load();
    });
    root.querySelectorAll('[data-cost-action]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.costAction;
      if (action === 'refresh') return load(true);
      if (action === 'export') return exportExcel(hasData);
      const [year, month] = state.month.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1 + (action === 'previous' ? -1 : 1), 1));
      const next = date.toISOString().slice(0, 7);
      if (next > currentMonth()) return;
      state.month = next;
      load();
    }));
    root.querySelectorAll('[data-cost-tab]').forEach(button => button.addEventListener('click', () => {
      const nextGroup = VIEW_GROUPS.find(item => item.tab === button.dataset.costTab);
      if (!nextGroup) return;
      state.view = nextGroup.views[0][0];
      state.query = '';
      draw();
    }));
    root.querySelectorAll('[data-cost-view]').forEach(button => button.addEventListener('click', () => {
      if (!VIEW_MAP.has(button.dataset.costView)) return;
      state.view = button.dataset.costView;
      state.query = '';
      draw();
    }));
    root.querySelector('#cost-row-filter')?.addEventListener('input', event => {
      state.query = event.target.value || '';
      draw();
      document.getElementById('cost-row-filter')?.focus();
    });
    // ── 상세 필터 ──
    const setF = (patch, reload) => {
      Object.assign(state.filters, patch);
      if (reload) load(); else draw();
    };
    root.querySelector('#cf-span')?.addEventListener('change', event => {
      const span = event.target.value === 'span';
      setF(span ? { span: true, from: state.filters.from || state.month, to: state.filters.to || state.month }
                : { span: false }, span);
    });
    root.querySelector('#cf-from')?.addEventListener('change', event => setF({ from: event.target.value }, true));
    root.querySelector('#cf-to')?.addEventListener('change', event => setF({ to: event.target.value }, true));
    root.querySelector('#cf-profit')?.addEventListener('change', event => setF({ profit: event.target.value }));
    root.querySelector('#cf-minsales')?.addEventListener('change', event => setF({ minSales: event.target.value }));
    root.querySelector('#cf-limit')?.addEventListener('change', event => setF({ limit: event.target.value }));
    ['cf-rate-min', 'cf-rate-max'].forEach(id => {
      // change(포커스를 잃을 때)만 듣는다 — 입력 중 draw()가 돌면 커서가 튄다
      root.querySelector('#' + id)?.addEventListener('change', event => {
        setF(id === 'cf-rate-min' ? { rateMin: event.target.value } : { rateMax: event.target.value });
      });
    });
    root.querySelectorAll('[data-cost-clear]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.costClear;
      if (key === 'all') { state.filters = { ...DEFAULT_FILTERS }; state.query = ''; return load(); }
      if (key === 'query') { state.query = ''; return draw(); }
      if (key === 'span') { state.filters.span = false; return load(); }
      if (key === 'profit') { state.filters.profit = 'all'; return draw(); }
      state.filters[key] = '';
      draw();
    }));
    root.querySelector('#cost-row-sort')?.addEventListener('change', event => {
      const [key, dir] = event.target.value.split(':');
      state.sort = { key, dir };
      draw();
    });
    root.querySelectorAll('[data-cost-sort]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.costSort;
      state.sort = state.sort.key === key ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' };
      draw();
    }));
  }

  function exportExcel(hasData) {
    if (!hasData || !currentUser || !userCanOpenPage('cost')) return;
    const meta = viewMeta();
    const rows = displayRows(activeRows());
    const sum = total(rows);
    const values = row => [row.name, row.sales, row.cost, row.profit, rateValue(row.profit, row.sales)];
    const sheet = XLSX.utils.aoa_to_sheet([[meta.label, '매출', '원가', '매익', '매익률(%)'], ...rows.map(values), values({ name: '합계', ...sum })]);
    sheet['!cols'] = [{ wch: 28 }, ...Array(4).fill({ wch: 19 })];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, meta.label.slice(0, 31));
    const span = monthsInRange();
    const tag = span.length > 1 ? `${span[0]}_${span[span.length - 1]}` : state.month;
    XLSX.writeFile(workbook, `원가분석현황_마감기준_${meta.label}_${tag}.xlsx`);
  }

  function clear() {
    ++state.request;
    state.controller?.abort();
    state.chart?.destroy();
    state.chart = null;
    state.years.clear();
    state.month = '';
    state.query = '';
    state.filters = { ...DEFAULT_FILTERS };
    state.loading = false;
    state.error = '';
    document.getElementById('cost-analysis-root')?.replaceChildren();
  }
  return { render: load, clear, validate, total, rate };
})();
