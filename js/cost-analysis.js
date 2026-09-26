/* Closing-basis figures are separate from the order/shipment data store. */
const costAnalysis = (() => {
  const VIEW_GROUPS = [
    { tab: '마감기준', views: [['closing-customer', '고객'], ['closing-item', '품목'], ['closing-employee', '담당자'], ['closing-management', '관리구분'], ['closing-project', '프로젝트'], ['closing-dept', '부서']] },
    { tab: '관리분류별', views: [['mgmt-customer-class', '고객분류'], ['mgmt-area', '지역'], ['mgmt-area-group', '지역그룹'], ['mgmt-manager-group', '담당그룹']] },
    { tab: '품목분류별', views: [['item-group', '품목군'], ['item-large', '대분류'], ['item-middle', '중분류'], ['item-small', '소분류']] }
  ];
  const VIEW_MAP = new Map(VIEW_GROUPS.flatMap(group => group.views.map(([key, label]) => [key, { key, label, tab: group.tab }])));
  const DEFAULT_VIEW = 'mgmt-customer-class';
  const state = { month: '', view: DEFAULT_VIEW, years: new Map(), loading: false, error: '', request: 0, controller: null, chart: null };
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
    const year = state.month.slice(0, 4);
    state.controller?.abort();
    const request = ++state.request;
    state.error = '';
    if (!force && state.years.has(year)) { state.loading = false; draw(); return; }
    const userId = currentUser.id;
    const controller = new AbortController();
    state.controller = controller;
    state.loading = true;
    state.error = '';
    draw();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${DB_URL.replace(/\/+$/, '')}/erp/costAnalysis/${year}.json`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('원가분석 데이터를 불러오지 못했습니다.');
      const data = validate(await response.json(), year);
      if (request !== state.request || currentUser?.id !== userId) return;
      state.years.set(year, data);
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
    const data = months[state.month];
    const meta = viewMeta();
    const group = activeGroup();
    const viewRows = rowsFor(data);
    const sum = data ? total(viewRows) : null;
    const rows = data ? [...viewRows].sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name, 'ko')) : [];
    const unavailable = state.loading ? '불러오는 중입니다.' : state.error || '이 월의 마감기준 데이터가 아직 수집되지 않았습니다.';
    state.chart?.destroy();
    state.chart = null;
    root.innerHTML = `
      <div class="cost-toolbar">
        <div><h2>마감기준 매익 분석</h2><p>${escHtml(meta.tab)} · ${escHtml(meta.label)} · 품목군 상품 · 고객분류 도매 전체</p></div>
        <div class="cost-controls"><div class="cost-month-nav">
          <button type="button" data-cost-action="previous" aria-label="이전 월" title="이전 월">‹</button>
          <input id="cost-month" type="month" aria-label="조회 월" value="${state.month}" max="${currentMonth()}">
          <button type="button" data-cost-action="next" aria-label="다음 월" title="다음 월" ${state.month >= currentMonth() ? 'disabled' : ''}>›</button>
        </div><button type="button" class="btn-sm" data-cost-action="refresh" title="데이터 새로고침" aria-label="데이터 새로고침" ${state.loading ? 'disabled' : ''}>↻</button>
        <button type="button" class="btn-sm" data-cost-action="export" ${!data || state.loading ? 'disabled' : ''}>엑셀</button></div>
      </div>
      <div class="cost-sync" role="status">${state.loading ? '불러오는 중' : state.error ? escHtml(state.error) : data ? `데이터 업데이트 ${escHtml(new Date(data.syncedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))}` : '데이터 수집 대기'}</div>
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
      <section class="cost-detail"><div class="cost-table-heading"><h3>${state.month.replace('-', '년 ')}월 ${escHtml(meta.label)}별 현황</h3><span>${data ? `${rows.length}개 구분 · 단위 원` : '단위 원'}</span></div>
        <table><thead><tr><th scope="col">${escHtml(meta.label)}</th><th scope="col">매출</th><th scope="col">원가</th><th scope="col">매익</th><th scope="col">매익률</th></tr></thead>
        <tbody>${!data ? `<tr><td colspan="5" class="cost-empty">${escHtml(unavailable)}</td></tr>` : !rows.length ? '<tr><td colspan="5" class="cost-empty">조회 조건에 해당하는 마감 내역이 없습니다.</td></tr>' : rows.map(row => `<tr><th scope="row">${escHtml(row.name || '미지정')}</th><td>${money(row.sales)}</td><td>${money(row.cost)}</td><td class="${row.profit < 0 ? 'cost-negative' : 'cost-profit'}">${money(row.profit)}</td><td>${rateText(rate(row.profit, row.sales))}</td></tr>`).join('')}</tbody>
        ${sum ? `<tfoot><tr><th scope="row">합계</th><td>${money(sum.sales)}</td><td>${money(sum.cost)}</td><td class="${sum.profit < 0 ? 'cost-negative' : 'cost-profit'}">${money(sum.profit)}</td><td>${rateText(rate(sum.profit, sum.sales))}</td></tr></tfoot>` : ''}</table>
      </section>`;
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
      if (action === 'export') return exportExcel(data);
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
      draw();
    }));
    root.querySelectorAll('[data-cost-view]').forEach(button => button.addEventListener('click', () => {
      if (!VIEW_MAP.has(button.dataset.costView)) return;
      state.view = button.dataset.costView;
      draw();
    }));
  }

  function exportExcel(data) {
    if (!data || !currentUser || !userCanOpenPage('cost')) return;
    const meta = viewMeta();
    const rows = rowsFor(data);
    const sum = total(rows);
    const values = row => [row.name, row.sales, row.cost, row.profit, rateValue(row.profit, row.sales)];
    const sheet = XLSX.utils.aoa_to_sheet([[meta.label, '매출', '원가', '매익', '매익률(%)'], ...rows.map(values), values({ name: '합계', ...sum })]);
    sheet['!cols'] = [{ wch: 28 }, ...Array(4).fill({ wch: 19 })];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, meta.label.slice(0, 31));
    XLSX.writeFile(workbook, `마감기준_매익분석_${meta.label}_${state.month}.xlsx`);
  }

  function clear() {
    ++state.request;
    state.controller?.abort();
    state.chart?.destroy();
    state.chart = null;
    state.years.clear();
    state.month = '';
    state.loading = false;
    state.error = '';
    document.getElementById('cost-analysis-root')?.replaceChildren();
  }
  return { render: load, clear, validate, total, rate };
})();
