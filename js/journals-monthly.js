// ════════════════════════════════════
// MONTHLY (월간일지) — 게시판형
// ════════════════════════════════════
var allMonthlyReports = [];
var _moYear = new Date().getFullYear();
var _moMonth = new Date().getMonth() + 1;
var _moPlanRowId = 0;
var _moEditingId = null;

function moLoadReports() {
  allMonthlyReports = getShared('sj-monthly-reports-' + currentUser.id, []);
}
function moSaveReports() {
  setShared('sj-monthly-reports-' + currentUser.id, allMonthlyReports);
}

// ── 영업계획 board ──
function moPlanInit() {
  moLoadReports();
  const yearSel = document.getElementById('mop-filter-year');
  if (yearSel) {
    const years = new Set([new Date().getFullYear()]);
    allMonthlyReports.forEach(r => years.add(r.year));
    const cur = parseInt(yearSel.value) || new Date().getFullYear();
    uiSetHtml(yearSel, [...years].sort((a, b) => b - a).map(y => `<option value="${y}"${y === cur ? ' selected' : ''}>${y}년</option>`).join(''));
  }
  moPlanRenderList();
}

function moPlanRenderList() {
  const yearSel = document.getElementById('mop-filter-year');
  const fy = yearSel ? parseInt(yearSel.value) : new Date().getFullYear();
  const tbody = document.getElementById('mop-board');
  const empty = document.getElementById('mop-empty');
  const countEl = document.getElementById('mop-board-count');
  if (!tbody) return;
  const filtered = allMonthlyReports.filter(r=>r.year===fy).sort((a,b)=>b.month-a.month);
  uiSetHtml(tbody, '');
  if (countEl) countEl.textContent = `총 ${filtered.length}건`;
  if (!filtered.length) { if (empty) empty.style.display=''; return; }
  if (empty) empty.style.display='none';
  filtered.forEach((r, idx) => {
    const savedDate = r.savedAt ? r.savedAt.slice(5,10).replace('-','/') : '-';
    const reportId = escInlineJs(r.id);
    const tr = document.createElement('tr');
    uiSetHtml(tr, `
      <td class="bbs-num">${filtered.length - idx}</td>
      <td class="bbs-td-title">${r.year}년 ${r.month}월 영업계획</td>
      <td>${r.year}/${String(r.month).padStart(2, '0')}</td>
      <td>${r.targetVisit || '-'}</td>
      <td>${r.targetSales ? Number(r.targetSales).toLocaleString() + '만' : '-'}</td>
      <td>${escHtml(r.person || '-')}</td>
      <td>${escHtml(savedDate)}</td>
    `);
    tr.onclick = () => moPlanOpenForm(r.id);
    const actTd = document.createElement('td');
    actTd.style.whiteSpace='nowrap';
    uiSetHtml(actTd, `<button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  moPlanOpenForm(String(uiValues[0]));
}, [r.id])}>수정</button> <button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px;color:#e53935" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  moDeleteReport(String(uiValues[0]));
  moPlanRenderList();
}, [r.id])}>삭제</button>`);
    tr.appendChild(actTd);
    tbody.appendChild(tr);
  });
}

function moPlanOpenForm(id) {
  _moEditingId = id || null;
  if (id) {
    const r = allMonthlyReports.find(x=>x.id===id);
    if (!r) return;
    _moYear = r.year; _moMonth = r.month;
    moUpdateFormPeriod();
    document.getElementById('mo-target-visit').value = r.targetVisit || '';
    document.getElementById('mo-target-sales').value = r.targetSales || '';
    document.getElementById('mo-target-new').value = r.targetNew || '';
    document.getElementById('mo-target-dormant').value = r.targetDormant || '';
    document.getElementById('mo-target-existing').value = r.targetExisting || '';
    moCalcTargetVisit();
    const body = document.getElementById('mo-plan-body');
    uiSetHtml(body, ''); _moPlanRowId = 0;
    if (r.planRows?.length) {
      r.planRows.forEach(row => {
        moAddPlanRow();
        const tr = body.lastElementChild;
        const s=(f,v)=>{const el=tr.querySelector(`[data-mp="${f}"]`);if(el?.type==='checkbox')el.checked=!!v;else if(el)el.value=v||'';};
        s('name',row.name);s('count',row.count);s('w1',row.w1);s('w2',row.w2);s('w3',row.w3);s('w4',row.w4);s('w5',row.w5);s('sales',row.sales);s('purpose',row.purpose);
      });
    } else { moAddPlanRows(3); }
  } else {
    _moYear = new Date().getFullYear(); _moMonth = new Date().getMonth()+1;
    moUpdateFormPeriod();
    document.getElementById('mo-target-visit').value = '';
    document.getElementById('mo-target-sales').value = '';
    document.getElementById('mo-target-new').value = '';
    document.getElementById('mo-target-dormant').value = '';
    document.getElementById('mo-target-existing').value = '';
    document.getElementById('mo-target-visit-total').textContent = '0';
    const body = document.getElementById('mo-plan-body');
    uiSetHtml(body, ''); _moPlanRowId = 0; moAddPlanRows(3);
  }
  document.getElementById('mop-list-view').style.display = 'none';
  document.getElementById('mop-form-view').style.display = '';
}

function moPlanCloseForm() {
  document.getElementById('mop-form-view').style.display = 'none';
  document.getElementById('mop-list-view').style.display = '';
  moPlanInit();
}

// ── 월간결산 board ──
function moSettleInit() {
  moLoadReports();
  const yearSel = document.getElementById('mos-filter-year');
  if (yearSel) {
    const years = new Set([new Date().getFullYear()]);
    allMonthlyReports.forEach(r => years.add(r.year));
    const cur = parseInt(yearSel.value) || new Date().getFullYear();
    uiSetHtml(yearSel, [...years].sort((a, b) => b - a).map(y => `<option value="${y}"${y === cur ? ' selected' : ''}>${y}년</option>`).join(''));
  }
  moSettleRenderList();
}

function moSettleRenderList() {
  const yearSel = document.getElementById('mos-filter-year');
  const fy = yearSel ? parseInt(yearSel.value) : new Date().getFullYear();
  const tbody = document.getElementById('mos-board');
  const empty = document.getElementById('mos-empty');
  const countEl = document.getElementById('mos-board-count');
  if (!tbody) return;
  const filtered = allMonthlyReports.filter(r=>r.year===fy).sort((a,b)=>b.month-a.month);
  uiSetHtml(tbody, '');
  if (countEl) countEl.textContent = `총 ${filtered.length}건`;
  if (!filtered.length) { if (empty) empty.style.display=''; return; }
  if (empty) empty.style.display='none';
  filtered.forEach((r, idx) => {
    const visitRate = r.targetVisit>0 ? (r.visitActual/r.targetVisit*100).toFixed(0)+'%' : '-';
    const savedDate = r.savedAt ? r.savedAt.slice(5,10).replace('-','/') : '-';
    const reportId = escInlineJs(r.id);
    const tr = document.createElement('tr');
    uiSetHtml(tr, `
      <td class="bbs-num">${filtered.length - idx}</td>
      <td class="bbs-td-title">${r.year}년 ${r.month}월 월간결산</td>
      <td>${r.year}/${String(r.month).padStart(2, '0')}</td>
      <td>${r.targetVisit || '-'}</td>
      <td>${r.visitActual || 0}</td>
      <td style="font-weight:600;color:var(--green-dark)">${visitRate}</td>
      <td>${escHtml(r.person || '-')}</td>
      <td>${escHtml(savedDate)}</td>
    `);
    tr.onclick = () => moSettleOpenForm(r.id);
    const actTd = document.createElement('td');
    actTd.style.whiteSpace='nowrap';
    uiSetHtml(actTd, `<button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  moSettleOpenForm(String(uiValues[0]));
}, [r.id])}>수정</button> <button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px;color:#e53935" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  moDeleteReport(String(uiValues[0]));
  moSettleRenderList();
}, [r.id])}>삭제</button>`);
    tr.appendChild(actTd);
    tbody.appendChild(tr);
  });
}

function moSettleOpenForm(id) {
  _moEditingId = id || null;
  if (id) {
    const r = allMonthlyReports.find(x=>x.id===id);
    if (!r) return;
    _moYear = r.year; _moMonth = r.month;
    moUpdateFormPeriod();
    document.getElementById('mo-s-new-target').value = r.newTarget||'';
    document.getElementById('mo-s-contract-target').value = r.contractTarget||'';
    document.getElementById('mo-s-contract-actual').value = r.contractActual||'';
    document.getElementById('mo-s-collect-target').value = r.collectTarget||'';
    document.getElementById('mo-s-collect-actual').value = r.collectActual||'';
    document.getElementById('mo-s-summary').value = r.summary||'';
  } else {
    _moYear = new Date().getFullYear(); _moMonth = new Date().getMonth()+1;
    moUpdateFormPeriod();
    ['mo-s-new-target','mo-s-contract-target','mo-s-contract-actual','mo-s-collect-target','mo-s-collect-actual','mo-s-summary']
      .forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  }
  moCalcSettle();
  document.getElementById('mos-list-view').style.display = 'none';
  document.getElementById('mos-form-view').style.display = '';
}

function moSettleCloseForm() {
  document.getElementById('mos-form-view').style.display = 'none';
  document.getElementById('mos-list-view').style.display = '';
  moSettleInit();
}

function moUpdateFormPeriod() {
  const label = `${_moYear}년 ${_moMonth}월`;
  const el1 = document.getElementById('mo-period');
  const el2 = document.getElementById('mos-period');
  if (el1) el1.textContent = label;
  if (el2) el2.textContent = label;
}

function moChange(dir) {
  _moMonth += dir;
  if (_moMonth > 12) { _moMonth = 1; _moYear++; }
  if (_moMonth < 1) { _moMonth = 12; _moYear--; }
  moUpdateFormPeriod();
  moCalcSettle();
}

function moAddPlanRow() {
  _moPlanRowId++;
  const rid = 'mpr'+_moPlanRowId;
  const tr = document.createElement('tr');
  tr.id = rid;
  uiSetHtml(tr, `
    <td>${_moPlanRowId}</td>
    <td><input class="ss-input" data-mp="name" placeholder="기관명" /></td>
    <td><input class="ss-input" data-mp="count" type="number" value="1" style="width:40px;text-align:center" /></td>
    <td style="text-align:center"><input type="checkbox" data-mp="w1" /></td>
    <td style="text-align:center"><input type="checkbox" data-mp="w2" /></td>
    <td style="text-align:center"><input type="checkbox" data-mp="w3" /></td>
    <td style="text-align:center"><input type="checkbox" data-mp="w4" /></td>
    <td style="text-align:center"><input type="checkbox" data-mp="w5" /></td>
    <td><input class="ss-input" data-mp="sales" type="number" placeholder="0" style="font-family:var(--mono)" /></td>
    <td><input class="ss-input" data-mp="purpose" placeholder="방문 목적" /></td>
    <td><button class="ss-del" ${uiAction("click", function (event, uiValues) {
  document.getElementById(String(uiValues[0])).remove();
  moRenum();
}, [rid])}>×</button></td>
  `);
  document.getElementById('mo-plan-body').appendChild(tr);
  moRenum();
}
function moAddPlanRows(n) { for(let i=0;i<n;i++) moAddPlanRow(); }
function moRenum() {
  document.querySelectorAll('#mo-plan-body tr').forEach((tr,i)=>{ tr.querySelector('td:first-child').textContent=i+1; });
  const cnt = document.querySelectorAll('#mo-plan-body tr').length;
  document.getElementById('mo-plan-status').textContent = cnt+'건';
}

function moCalcSettle() {
  const ym = `${_moYear}-${String(_moMonth).padStart(2,'0')}`;
  const myEntries = (allEntries||[]).filter(e => e.date?.startsWith(ym) && (isAdminUser(currentUser) || e.personId===currentUser.id));
  const visitCount = myEntries.length;
  const salesSum = myEntries.reduce((s,e)=>s+(e.ourPurchase||0),0);
  const newClients = myEntries.filter(e=>e.clientType==='신규거래처').length;
  const tv = parseFloat(document.getElementById('mo-target-visit')?.value)||0;
  const ts = parseFloat(document.getElementById('mo-target-sales')?.value)||0;
  document.getElementById('mo-s-visit-target').textContent = tv||'-';
  document.getElementById('mo-s-visit-actual').textContent = visitCount;
  document.getElementById('mo-s-visit-rate').textContent = tv>0?(visitCount/tv*100).toFixed(1)+'%':'-';
  document.getElementById('mo-s-sales-target').textContent = ts?ts.toLocaleString():'-';
  document.getElementById('mo-s-sales-actual').textContent = salesSum.toLocaleString();
  document.getElementById('mo-s-sales-rate').textContent = ts>0?(salesSum/ts*100).toFixed(1)+'%':'-';
  document.getElementById('mo-s-new-actual').textContent = newClients;
}

async function moSavePlan() {
  const planRows = [];
  document.querySelectorAll('#mo-plan-body tr').forEach(tr => {
    const g = f => { const el=tr.querySelector(`[data-mp="${f}"]`); return el?.type==='checkbox'?el.checked:(el?.value?.trim()||''); };
    const name = g('name'); if(!name) return;
    planRows.push({name,count:g('count'),w1:g('w1'),w2:g('w2'),w3:g('w3'),w4:g('w4'),w5:g('w5'),sales:g('sales'),purpose:g('purpose')});
  });
  moUpsertReport({
    planRows,
    targetVisit: document.getElementById('mo-target-visit').value,
    targetSales: document.getElementById('mo-target-sales').value,
    targetNew: document.getElementById('mo-target-new').value,
    targetDormant: document.getElementById('mo-target-dormant').value,
    targetExisting: document.getElementById('mo-target-existing').value,
  });
  showToast('월간 영업계획이 저장되었습니다.', 'success');
  moPlanCloseForm();
}

async function moSaveSettle() {
  const ym = `${_moYear}-${String(_moMonth).padStart(2,'0')}`;
  const myEntries = (allEntries||[]).filter(e=>e.date?.startsWith(ym)&&(isAdminUser(currentUser)||e.personId===currentUser.id));
  moUpsertReport({
    newTarget: document.getElementById('mo-s-new-target').value,
    contractTarget: document.getElementById('mo-s-contract-target').value,
    contractActual: document.getElementById('mo-s-contract-actual').value,
    collectTarget: document.getElementById('mo-s-collect-target').value,
    collectActual: document.getElementById('mo-s-collect-actual').value,
    summary: document.getElementById('mo-s-summary').value,
    visitActual: myEntries.length,
  });
  showToast('월간결산이 저장되었습니다.', 'success');
  moSettleCloseForm();
}

function moUpsertReport(patch) {
  let r = _moEditingId ? allMonthlyReports.find(x=>x.id===_moEditingId) : allMonthlyReports.find(x=>x.year===_moYear&&x.month===_moMonth&&x.personId===currentUser.id);
  if (!r) {
    r = { id:'mor-'+Date.now(), year:_moYear, month:_moMonth, person:currentUser.name, personId:currentUser.id };
    allMonthlyReports.push(r);
    _moEditingId = r.id;
  }
  Object.assign(r, patch, { savedAt: new Date().toISOString() });
  moSaveReports();
}

function moDeleteReport(id) {
  if (!confirm('이 월간일지를 삭제하시겠습니까?')) return;
  allMonthlyReports = allMonthlyReports.filter(r=>r.id!==id);
  moSaveReports();
}
