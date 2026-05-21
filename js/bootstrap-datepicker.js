// LOAD & RENDER
// ════════════════════════════════════
function loadAndRender() {
  allEntries = getShared('sj-entries-v4', []);
  loadOrderBasisPreference();
  if (window.__erpRemoteData) {
    allShipOrders = window.__erpRemoteData.ship || [];
    allOrderOrders = window.__erpRemoteData.order || [];
  } else {
    allShipOrders = getShared('sj-orders-ship', getShared('sj-orders', []));
    allOrderOrders = getShared('sj-orders-order', []);
  }
  applyOrderBasis();
  allUsers   = getShared('sj-users-v6', []);
  targets    = getShared('sj-targets-v4', {});
  allNotices = getShared('sj-notices', []);
  allRevisits= getShared('sj-revisits', []);
  allClients = getShared('sj-clients', []);

  const USER_ID_RENAME = { 'Lee1': 'lee1', 'Lee2': 'lee2' };
  let userIdsNormalized = false;
  allUsers = allUsers.map(u => {
    const newId = USER_ID_RENAME[u.id];
    if (newId) {
      userIdsNormalized = true;
      return { ...u, id: newId };
    }
    return u;
  });
  if (allUsers.length === 0) {
    allUsers = DEFAULT_USERS;
    setShared('sj-users-v6', allUsers);
  } else if (userIdsNormalized) {
    setShared('sj-users-v6', allUsers);
    allEntries = allEntries.map(e => USER_ID_RENAME[e.personId] ? { ...e, personId: USER_ID_RENAME[e.personId] } : e);
    setShared('sj-entries-v4', allEntries);
    allRevisits = allRevisits.map(r => USER_ID_RENAME[r.personId] ? { ...r, personId: USER_ID_RENAME[r.personId] } : r);
    setShared('sj-revisits', allRevisits);
  }
  // 기존 seed 데이터 자동 정리
  const _seedIds = new Set([1001,1002,1003,1004,1005,1006,1007,1008,1009,1010]);
  const _bef = allEntries.length;
  allEntries = allEntries.filter(e => !_seedIds.has(Number(e.id)));
  if (allEntries.length !== _bef) setShared('sj-entries-v4', allEntries);
  // 거래처: 시드 DB + Firebase 오버레이(추가/수정) 병합
  mergeClientsWithSeed();
  updateBadge(); updateRevisitBadge(); updateClientBadge(); updateTopbarNotice();
  if (document.getElementById('page-dash').classList.contains('active')||document.getElementById('page-sales').classList.contains('active')) renderDashboard();
  if (document.getElementById('page-records').classList.contains('active')) renderRecords();
  if (document.getElementById('page-users').classList.contains('active')) renderUsers();
  if (document.getElementById('page-stats').classList.contains('active')) renderStats();
  if (document.getElementById('page-revisit').classList.contains('active')) renderRevisit();
  if (document.getElementById('page-clients').classList.contains('active')) renderClients();
  if (document.getElementById('page-notice') && document.getElementById('page-notice').classList.contains('active')) renderNoticeManage();

}

// setInterval(() => { if (currentUser) loadAndRender(); }, 30000); // 자동 새로고침 중단
// ════════════════════════════════════
// DATE RANGE PICKER
// ════════════════════════════════════
const _drpState = {}; // {id: {fromId, toId, labelId, cbFn, selFrom, selTo, leftY, leftM, rightY, rightM, hoverDate}}

function drpOpen(id) {
  const dd = document.getElementById('drp-'+id+'-dropdown');
  const trigger = dd.previousElementSibling;
  const isOpen = dd.classList.contains('open');
  // 다른 피커 닫기
  document.querySelectorAll('.drp-dropdown.open').forEach(el => {
    el.classList.remove('open');
    el.previousElementSibling?.classList.remove('open');
  });
  if (isOpen) return;
  const s = _drpState[id];
  drpRender(id);
  dd.classList.add('open');
  trigger.classList.add('open');
}

function drpClose(id) {
  const dd = document.getElementById('drp-'+id+'-dropdown');
  dd.classList.remove('open');
  dd.previousElementSibling?.classList.remove('open');
}

function drpInit(id, fromInputId, toInputId, labelId, cbFn) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const pad = n => String(n).padStart(2,'0');
  const selFrom = `${y}-${pad(m+1)}-01`;
  const selTo   = `${y}-${pad(m+1)}-${pad(d)}`;
  const toDate  = new Date(selTo);
  _drpState[id] = {
    fromId: fromInputId, toId: toInputId, labelId: labelId, cbFn: cbFn,
    selFrom, selTo, hoverDate: '',
    leftY: y, leftM: m,
    rightY: toDate.getFullYear(), rightM: toDate.getMonth(),
  };
  // input 및 라벨 초기 반영
  const fromEl = document.getElementById(fromInputId);
  const toEl   = document.getElementById(toInputId);
  const lblEl  = document.getElementById(labelId);
  if (fromEl) fromEl.value = selFrom;
  if (toEl)   toEl.value   = selTo;
  if (lblEl)  lblEl.textContent = `${selFrom} ~ ${selTo}`;
}

function drpNavLeft(id, side, delta) {
  const s = _drpState[id];
  if (side === 'L') {
    let m = s.leftM + delta, y = s.leftY;
    if (m < 0) { y--; m = 11; } if (m > 11) { y++; m = 0; }
    s.leftY = y; s.leftM = m;
  } else {
    let m = s.rightM + delta, y = s.rightY;
    if (m < 0) { y--; m = 11; } if (m > 11) { y++; m = 0; }
    s.rightY = y; s.rightM = m;
  }
  drpRender(id);
}

function drpNavYear(id, side, delta) {
  const s = _drpState[id];
  if (side === 'L') { s.leftY += delta; } else { s.rightY += delta; }
  drpRender(id);
}

function drpHover(id, d) { _drpState[id].hoverDate = d; drpUpdateHighlight(id); }
function drpHoverOut(id)  { _drpState[id].hoverDate = ''; drpUpdateHighlight(id); }

function drpUpdateHighlight(id) {
  const s = _drpState[id];
  const el = document.getElementById('drp-'+id+'-cals');
  if (!el) return;
  const today = (()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();
  el.querySelectorAll('.drp-day[data-date]').forEach(cell => {
    const ds = cell.dataset.date;
    cell.className = cell.dataset.baseCls + ' ' + drpDayCls(s, ds, today);
  });
}

function drpClickDay(id, d, side) {
  const s = _drpState[id];
  if (side === 'L') {
    s.selFrom = d;
    if (s.selTo && s.selTo < d) s.selTo = '';
  } else {
    s.selTo = d;
    if (!s.selFrom || s.selFrom > d) s.selFrom = d;
  }
  // other-month 클릭 시 해당 쪽 달력만 해당 월로 이동
  const dd = new Date(d);
  const clickedY = dd.getFullYear(), clickedM = dd.getMonth();
  if (side === 'L' && (clickedY !== s.leftY || clickedM !== s.leftM)) {
    s.leftY = clickedY; s.leftM = clickedM;
    drpRenderCals(id);
  } else if (side === 'R' && (clickedY !== s.rightY || clickedM !== s.rightM)) {
    s.rightY = clickedY; s.rightM = clickedM;
    drpRenderCals(id);
  } else {
    drpUpdateHighlight(id);
  }
  drpUpdateFooter(id);
}

function drpConfirm(id) {
  const s = _drpState[id];
  if (!s.selFrom) return;
  const from = s.selFrom, to = s.selTo || s.selFrom;
  document.getElementById(s.fromId).value = from;
  document.getElementById(s.toId).value   = to;
  const lbl = document.getElementById(s.labelId);
  if (lbl) lbl.textContent = from === to ? from : from + ' ~ ' + to;
  drpClose(id);
  s.cbFn && s.cbFn(from, to);
}

function drpCancel(id) { drpClose(id); }

function drpShortcut(id, mode) {
  const [from, to] = _calcPeriodRange(mode);
  const s = _drpState[id];
  s.selFrom = from; s.selTo = to;
  // 왼쪽 달력 = from 월, 오른쪽 = to 월
  if (from) {
    const fd = new Date(from);
    s.leftY = fd.getFullYear(); s.leftM = fd.getMonth();
    s.rightY = s.leftY; s.rightM = s.leftM;
  }
  drpRender(id);
  // 즉시 적용
  const lbl = document.getElementById(s.labelId);
  if (lbl) {
    const modeLabels = {year:'올해',ytd:'오늘까지',today:'오늘',yesterday:'전일',week:'주간',lweek:'전주',this:'당월',last:'이전달',py1:'전년도',py2:'전전년도',q1:'1분기',q2:'2분기',q3:'3분기',q4:'4분기',h1:'상반기',h2:'하반기',all:'전체',m1:'1월',m2:'2월',m3:'3월',m4:'4월',m5:'5월',m6:'6월',m7:'7월',m8:'8월',m9:'9월',m10:'10월',m11:'11월',m12:'12월'};
    lbl.textContent = (modeLabels[mode]||mode) + (from ? ': '+from+(to&&to!==from?' ~ '+to:'') : '');
  }
  document.getElementById(s.fromId).value = from;
  document.getElementById(s.toId).value   = to;
  drpClose(id);
  s.cbFn && s.cbFn(from, to);
}

const _DRP_SHORTCUTS = [
  ['year','올해'],['ytd','오늘까지'],['today','오늘'],['yesterday','전일'],['week','주간'],['lweek','전주'],['this','당월'],['last','이전달'],null,
  ['py1','전년도'],['py2','전전년도'],['q1','1분기'],['q2','2분기'],['q3','3분기'],['q4','4분기'],['h1','상반기'],['h2','하반기'],null,
  ['m1','1월'],['m2','2월'],['m3','3월'],['m4','4월'],['m5','5월'],['m6','6월'],['m7','7월'],['m8','8월'],['m9','9월'],['m10','10월'],['m11','11월'],['m12','12월'],['all','전체'],
];

function drpRender(id) {
  const s = _drpState[id];
  const dd = document.getElementById('drp-'+id+'-dropdown');
  const shortcuts = _DRP_SHORTCUTS.map(sc =>
    sc ? `<span class="ds" onclick="drpShortcut('${id}','${sc[0]}')">${sc[1]}</span>`
       : `<span class="ds-sep"></span>`
  ).join('');
  dd.innerHTML = `
    <div class="drp-shortcuts">${shortcuts}</div>
    <div class="drp-calendars" id="drp-${id}-cals"></div>
    <div class="drp-footer">
      <div class="drp-sel-label" id="drp-${id}-foot">선택: <span>-</span></div>
      <div class="drp-footer-btns">
        <button type="button" class="btn-sm btn-ghost" onclick="drpCancel('${id}')">취소</button>
        <button type="button" class="btn-sm btn-primary" onclick="drpConfirm('${id}')">확인</button>
      </div>
    </div>`;
  drpRenderCals(id);
  drpUpdateFooter(id);
}

const _DOW = ['일','월','화','수','목','금','토'];
function drpRenderCals(id) {
  const s = _drpState[id];
  const el = document.getElementById('drp-'+id+'-cals');
  if (!el) return;
  el.innerHTML = drpCalHtml(id,'L',s.leftY,s.leftM) + drpCalHtml(id,'R',s.rightY,s.rightM);
}

function drpCalHtml(id, side, y, m) {
  const s = _drpState[id];
  const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const today = fmt(new Date());
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const mName = y+'.'+(m+1 < 10 ? '0'+(m+1) : m+1);
  let days = '';
  for (let i = 0; i < firstDay; i++) {
    const prevDate = new Date(y, m, -firstDay+i+1);
    const ds = fmt(prevDate);
    const base = 'drp-day empty other-month';
    days += `<div class="${base} ${drpDayCls(s,ds,today)}" data-date="${ds}" data-base-cls="${base}" onmouseover="drpHover('${id}','${ds}')" onmouseout="drpHoverOut('${id}')" onclick="event.stopPropagation();drpClickDay('${id}','${ds}','${side}')">${prevDate.getDate()}</div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = fmt(new Date(y, m, d));
    const dow = new Date(y, m, d).getDay();
    const base = 'drp-day' + (dow===0?' sun':dow===6?' sat':'');
    days += `<div class="${base} ${drpDayCls(s,ds,today)}" data-date="${ds}" data-base-cls="${base}" onmouseover="drpHover('${id}','${ds}')" onmouseout="drpHoverOut('${id}')" onclick="event.stopPropagation();drpClickDay('${id}','${ds}','${side}')">${d}</div>`;
  }
  const total = firstDay + daysInMonth;
  for (let i = 0; i < (7 - total%7)%7; i++) {
    const nd = new Date(y, m+1, i+1);
    const ds = fmt(nd);
    const base = 'drp-day empty other-month';
    days += `<div class="${base} ${drpDayCls(s,ds,today)}" data-date="${ds}" data-base-cls="${base}" onmouseover="drpHover('${id}','${ds}')" onmouseout="drpHoverOut('${id}')" onclick="event.stopPropagation();drpClickDay('${id}','${ds}','${side}')">${nd.getDate()}</div>`;
  }
  const dows = _DOW.map(d=>`<div class="drp-cal-dow">${d}</div>`).join('');
  return `<div class="drp-cal">
    <div class="drp-cal-header">
      <button type="button" class="drp-cal-nav double" onclick="event.stopPropagation();drpNavYear('${id}','${side}',-1)">&laquo;</button>
      <button type="button" class="drp-cal-nav" onclick="event.stopPropagation();drpNavLeft('${id}','${side}',-1)">&lsaquo;</button>
      <span class="drp-cal-title">${mName}</span>
      <button type="button" class="drp-cal-nav" onclick="event.stopPropagation();drpNavLeft('${id}','${side}',1)">&rsaquo;</button>
      <button type="button" class="drp-cal-nav double" onclick="event.stopPropagation();drpNavYear('${id}','${side}',1)">&raquo;</button>
    </div>
    <div class="drp-cal-grid">${dows}${days}</div>
  </div>`;
}

function drpDayCls(s, ds, today) {
  const from = s.selFrom, to = s.selTo, hover = s.hoverDate;
  const rangeEnd = to || (from && hover && hover >= from ? hover : '');
  let cls = '';
  if (ds === today) cls += ' today';
  if (from && ds === from) cls += ' selected-start';
  if (rangeEnd && ds === rangeEnd) cls += ' selected-end';
  if (from && rangeEnd && ds > from && ds < rangeEnd) cls += ' in-range';
  return cls;
}

function drpUpdateFooter(id) {
  const s = _drpState[id];
  const el = document.getElementById('drp-'+id+'-foot');
  if (!el) return;
  const from = s.selFrom, to = s.selTo;
  if (!from) { el.innerHTML = '선택: <span>-</span>'; return; }
  const days = to ? Math.round((new Date(to)-new Date(from))/(86400000))+1 : 1;
  el.innerHTML = `선택: <span>${from}${to&&to!==from?' ~ '+to:''}</span> &nbsp;<span style="color:var(--text3);font-size:11px">(${days}일)</span>`;
}

// 외부 클릭 시 닫기
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.drp-wrap')) {
    document.querySelectorAll('.drp-dropdown.open').forEach(el => {
      el.classList.remove('open');
      el.previousElementSibling?.classList.remove('open');
    });
  }
});

// 초기화 (DOM 로드 후)
function initDatePickers() {
  drpInit('prod',    'prod-date-from',   'prod-date-to',   'drp-prod-label',    (f,t)=>renderProducts());
  drpInit('grade',   'grade-date-from',  'grade-date-to',  'drp-grade-label',   (f,t)=>renderGrade());
  drpInit('records', 'filter-date-from', 'filter-date-to', 'drp-records-label', (f,t)=>renderRecords());
  drpInit('stats',   'stats-date-from',  'stats-date-to',  'drp-stats-label',   (f,t)=>renderStats());
}
