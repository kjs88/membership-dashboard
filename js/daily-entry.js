// AUTOCOMPLETE
// ════════════════════════════════════
var _acIndex = -1;
var _acMatches = [];

function acSearch(val) {
  const list = document.getElementById('ac-list');
  _acIndex = -1;
  if (!val || val.length < 1) { list.classList.remove('open'); _acMatches = []; return; }
  const q = val.toLowerCase();
  const clientMatches = allClients.filter(c => c.name && (c.name.toLowerCase().includes(q) || (c.code||'').toLowerCase().includes(q)));
  const entryNames = [...new Set(allEntries.map(e=>e.institution).filter(Boolean))];
  const entryOnly = entryNames.filter(n => n.toLowerCase().includes(q) && !clientMatches.find(c=>c.name===n));
  _acMatches = [
    ...clientMatches.slice(0, 8).map(c => ({ name: c.name, code: c.code, region: c.region, type: c.clientType, isClient: true })),
    ...entryOnly.slice(0, 4).map(n => ({ name: n, code: '', region: '', type: '', isClient: false }))
  ];
  if (!_acMatches.length) { list.classList.remove('open'); return; }
  list.innerHTML = _acMatches.map((m, i) => {
    const codeHtml = m.code ? `<span class="ac-code">${escHtml(m.code)}</span>` : '';
    const regionHtml = m.region ? `<span class="ac-region">${escHtml(m.region)}</span>` : '';
    const typeHtml = m.type ? `<span class="ac-type">${escHtml(m.type)}</span>` : '';
    return `<div class="autocomplete-item" data-idx="${i}" onmousedown="acPick(${i})" onmouseenter="_acIndex=${i};acHL()">
      <span>${escHtml(m.name)}</span>${regionHtml}${typeHtml}${codeHtml}
    </div>`;
  }).join('');
  list.classList.add('open');
}

function acHL() {
  document.querySelectorAll('.autocomplete-item').forEach((el, i) => {
    el.classList.toggle('ac-active', i === _acIndex);
  });
}

function acPick(idx) {
  const m = _acMatches[idx];
  if (!m) return;
  document.getElementById('f-institution').value = m.name;
  document.getElementById('ac-list').classList.remove('open');
  _acMatches = []; _acIndex = -1;
  const client = allClients.find(c => c.name === m.name);
  const prevEntry = allEntries.filter(e => e.institution === m.name).sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
  const src = client || prevEntry || {};
  const setVal = (id, v) => { if (!v) return; const el = document.getElementById(id); if (el) el.value = v; };
  const setSelByText = (id, v) => { if (!v) return; const sel = document.getElementById(id); if (!sel) return; for(let o of sel.options){ if((o.value||o.text)===v){sel.value=o.value||o.text;break;} } };
  setVal('f-clientcode', src.code || src.clientCode);
  setSelByText('f-clienttype', src.clientType);
  setVal('f-contact', src.contact);
  setSelByText('f-region', src.region);
  setSelByText('f-gender', src.gender);
  setSelByText('f-age', src.age);
  setSelByText('f-floor', src.floor);
  setSelByText('f-exp', src.experience);
  if (src.sideBusiness) setSidebizValue(src.sideBusiness);
}

function acKeydown(e) {
  const list = document.getElementById('ac-list');
  if (!list.classList.contains('open') || !_acMatches.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _acIndex = Math.min(_acIndex + 1, _acMatches.length - 1);
    acHL();
    const active = list.querySelector('.ac-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _acIndex = Math.max(_acIndex - 1, 0);
    acHL();
    const active = list.querySelector('.ac-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && _acIndex >= 0) {
    e.preventDefault();
    acPick(_acIndex);
  } else if (e.key === 'Escape') {
    list.classList.remove('open');
    _acIndex = -1;
  }
}

function acClose() {
  document.getElementById('ac-list')?.classList.remove('open');
  _acIndex = -1;
}

// ════════════════════════════════════
// 병행업종 드롭다운 헬퍼
// ════════════════════════════════════
function toggleSidebizOther() {
  const sel = document.getElementById('f-sidebiz-sel');
  const inp = document.getElementById('f-sidebiz');
  if (sel.value === '__other__') { inp.style.display = ''; inp.focus(); inp.value = ''; }
  else { inp.style.display = 'none'; inp.value = sel.value; }
}
function getSidebizValue() {
  const sel = document.getElementById('f-sidebiz-sel');
  if (sel.value === '__other__') return document.getElementById('f-sidebiz').value.trim();
  return sel.value;
}
function setSidebizValue(val) {
  const sel = document.getElementById('f-sidebiz-sel');
  const inp = document.getElementById('f-sidebiz');
  const opts = [...sel.options].map(o => o.value || o.text);
  if (!val) { sel.value = ''; inp.style.display = 'none'; inp.value = ''; return; }
  if (opts.includes(val)) { sel.value = val; inp.style.display = 'none'; inp.value = val; }
  else { sel.value = '__other__'; inp.style.display = ''; inp.value = val; }
}

// ════════════════════════════════════
// SPREADSHEET INPUT
// ════════════════════════════════════
var _ssRowId = 0;
var _ssAcTarget = null; // 현재 autocomplete 대상 input
var _ssAcIdx = -1;
var _ssAcMatches = [];

// ════════════════════════════════════
// DAILY BOARD (일간일지 게시판)
// ════════════════════════════════════
// ════════════════════════════════════
// DAILY CALENDAR
// ════════════════════════════════════
var _dlyCY = new Date().getFullYear();
var _dlyCM = new Date().getMonth();
var _dlySelectedDate = new Date().toISOString().split('T')[0];

function dlyInit() {
  document.getElementById('dly-cal-view').style.display = '';
  document.getElementById('dly-input-view').style.display = 'none';
  dlyRenderCal();
}

function dlyRenderCal() {
  const y = _dlyCY, m = _dlyCM;
  const title = document.getElementById('dly-cal-title');
  if (title) title.textContent = `${y}년 ${m+1}월`;

  const grid = document.getElementById('dly-cal-grid');
  if (!grid) return;

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  // 해당 월 일지 맵 { 'YYYY-MM-DD': [entry,...] }
  const entryMap = {};
  (allEntries||[]).forEach(e => {
    if (!e.date) return;
    if (currentUser.role !== 'admin' && e.personId && e.personId !== currentUser.id) return;
    if (!entryMap[e.date]) entryMap[e.date] = [];
    entryMap[e.date].push(e);
  });

  const fmt = (yr,mo,d) => `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  let html = '';

  // 이전 달 공백
  const prevDays = new Date(y, m, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const ds = fmt(m===0?y-1:y, m===0?11:m-1, prevDays - i);
    html += `<div class="dly-cell other-month" onclick="dlyOpenDate('${ds}')">
      <div class="dly-day-num">${prevDays - i}</div>
    </div>`;
  }

  // 이번 달
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = fmt(y, m, d);
    const dow = new Date(y, m, d).getDay();
    const isToday = ds === today;
    const entries = entryMap[ds] || [];
    const hasEntry = entries.length > 0;
    let cls = 'dly-cell';
    if (isToday) cls += ' today';
    if (hasEntry) cls += ' has-entry';
    if (dow === 0) cls += ' sun';
    if (dow === 6) cls += ' sat';

    // 영업사원별 그룹핑
    const personMap = {};
    entries.forEach(e => {
      const pName = e.person || '미입력';
      if (!personMap[pName]) personMap[pName] = 0;
      personMap[pName]++;
    });
    const isAdmin = currentUser.role === 'admin';
    const summaryLines = Object.entries(personMap).slice(0,5).map(([name, cnt]) =>
      isAdmin
        ? `<div class="dly-entry-dot">● ${name} / ${cnt}처</div>`
        : `<div class="dly-entry-dot">● ${cnt}처</div>`
    ).join('');
    const dotsHtml = summaryLines;
    const moreHtml = Object.keys(personMap).length > 5 ? `<div class="dly-more">+${Object.keys(personMap).length-5}명 더</div>` : '';

    html += `<div class="${cls}" onclick="dlyOpenDate('${ds}')">
      <div class="dly-day-num">${d}</div>
      ${dotsHtml}${moreHtml}
    </div>`;
  }

  // 다음 달 공백 (6주 고정)
  const totalCells = firstDay + daysInMonth;
  const remainder = totalCells % 7;
  const nextCount = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= nextCount; d++) {
    const ds = fmt(m===11?y+1:y, m===11?0:m+1, d);
    html += `<div class="dly-cell other-month" onclick="dlyOpenDate('${ds}')">
      <div class="dly-day-num">${d}</div>
    </div>`;
  }

  grid.innerHTML = html;
}

function dlyCalMove(dir) {
  _dlyCM += dir;
  if (_dlyCM > 11) { _dlyCM = 0; _dlyCY++; }
  if (_dlyCM < 0)  { _dlyCM = 11; _dlyCY--; }
  dlyRenderCal();
}

function dlyCalToday() {
  _dlyCY = new Date().getFullYear();
  _dlyCM = new Date().getMonth();
  dlyRenderCal();
}

function dlyOpenDate(ds) {
  _dlySelectedDate = ds;
  document.getElementById('dly-input-view').style.display = 'block';

  const [y,m,d] = ds.split('-');
  const days = ['일','월','화','수','목','금','토'];
  const dow = days[new Date(ds).getDay()];
  const lbl = document.getElementById('dly-input-date-label');
  if (lbl) lbl.textContent = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dow})`;
  document.getElementById('cw-date').value = ds;

  cwRenderSavedList();
  cwResetEditCard();
}

// ══════════════════════════════════════════
//  카드 순차 입력 (Card Wizard)
// ══════════════════════════════════════════
function cwRenderSavedList() {
  const ds = _dlySelectedDate;
  const list = document.getElementById('cw-saved-list');
  if (!list) return;
  const dayEntries = (allEntries||[]).filter(e => {
    if (e.date !== ds) return false;
    if (currentUser.role !== 'admin' && e.personId && e.personId !== currentUser.id) return false;
    return true;
  });
  document.getElementById('cw-count-label').textContent = `등록된 거래처 ${dayEntries.length}건`;
  if (!dayEntries.length) { list.innerHTML = ''; return; }
  list.innerHTML = dayEntries.map(e => {
    const typeCls = e.clientType === '신규거래처' ? 'background:var(--amber-l);color:var(--amber)'
                 : e.clientType === '휴면거래처' ? 'background:var(--red-l);color:var(--red)'
                 : 'background:var(--green-light);color:var(--green-dark)';
    const dealCls = e.dealPossibility === '○' ? 'background:var(--green-light);color:var(--green-dark)'
                  : e.dealPossibility === '×' ? 'background:var(--red-l);color:var(--red)'
                  : 'background:var(--amber-l);color:var(--amber)';
    const meeting = (e.meeting||'').length > 60 ? (e.meeting.slice(0,60)+'...') : (e.meeting||'');
    const entryId = escInlineJs(e.id);
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px">
          ${escHtml(e.institution||'')}
          ${e.clientType ? `<span style="${typeCls};font-size:11px;padding:2px 7px;border-radius:4px;margin-left:6px;font-weight:700">${escHtml(e.clientType)}</span>` : ''}
          ${e.dealPossibility ? `<span style="${dealCls};font-size:11px;padding:2px 7px;border-radius:4px;margin-left:3px;font-weight:700">${escHtml(e.dealPossibility)}</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${e.attendee ? escHtml(e.attendee)+' · ' : ''}${escHtml(meeting)}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="btn-sm btn-ghost" style="padding:4px 10px;font-size:11px" onclick="cwEditEntry('${entryId}')">수정</button>
        <button class="btn-sm btn-danger" style="padding:4px 10px;font-size:11px" onclick="cwDeleteEntry('${entryId}')">삭제</button>
      </div>
    </div>`;
  }).join('');
}

function escHtml(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escInlineJs(s) {
  return escHtml(String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
}
function safeColor(c, fallback = '#999999') {
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || '')) ? c : fallback;
}

function cwResetEditCard() {
  document.getElementById('cw-editing-id').value = '';
  document.getElementById('cw-edit-title').textContent = '+ 새 거래처 입력';
  document.getElementById('cw-save-btn').textContent = '이 거래처 저장';
  ['cw-institution','cw-attendee','cw-meeting','cw-issues','cw-dealPossibility','cw-clientCode','cw-contact','cw-sideBusiness','cw-region','cw-gender','cw-age','cw-floor','cw-area','cw-experience'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('cw-clientType').value = '';
  document.querySelectorAll('.cw-deal-btn').forEach(b => { b.style.background = 'var(--surface2)'; b.style.borderColor = 'var(--border)'; b.style.color = ''; });
}

function cwSetDeal(v) {
  document.getElementById('cw-dealPossibility').value = v;
  document.querySelectorAll('.cw-deal-btn').forEach(b => {
    if (b.dataset.v === v) {
      b.style.background = 'var(--green)';
      b.style.borderColor = 'var(--green)';
      b.style.color = '#fff';
    } else {
      b.style.background = 'var(--surface2)';
      b.style.borderColor = 'var(--border)';
      b.style.color = '';
    }
  });
}

function cwCancelEdit() { cwResetEditCard(); }

function cwGetFormData() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  return {
    date: _dlySelectedDate || g('cw-date'),
    institution: g('cw-institution'),
    clientCode: g('cw-clientCode'),
    clientType: g('cw-clientType'),
    attendee: g('cw-attendee'),
    meeting: g('cw-meeting'),
    issues: g('cw-issues'),
    dealPossibility: g('cw-dealPossibility') || '△',
    contact: g('cw-contact'),
    sideBusiness: g('cw-sideBusiness'),
    region: g('cw-region'),
    gender: g('cw-gender'),
    age: g('cw-age'),
    floor: g('cw-floor'),
    area: g('cw-area'),
    experience: g('cw-experience'),
  };
}

function cwSaveCard() {
  const data = cwGetFormData();
  if (!data.institution || !data.clientType || !data.attendee || !data.meeting) {
    showToast('필수 항목을 확인하세요: 기관명 · 거래처유형 · 참석자 · 미팅내용', 'error');
    return;
  }
  if (!data.date) {
    showToast('날짜 정보가 없습니다. 캘린더에서 날짜를 다시 선택해주세요.', 'error');
    return;
  }
  try {
    const editingId = document.getElementById('cw-editing-id').value;
    if (editingId) {
      const idx = allEntries.findIndex(e => String(e.id) === editingId);
      if (idx >= 0) {
        allEntries[idx] = { ...allEntries[idx], ...data };
        try { syncClientFromEntry(allEntries[idx]); } catch(err) { console.error('sync err:', err); }
      }
      showToast('수정되었습니다', 'success');
    } else {
      const entry = {
        id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        ts: new Date().toISOString(),
        person: currentUser.name, personId: currentUser.id,
        ...data
      };
      allEntries.push(entry);
      try { syncClientFromEntry(entry); } catch(err) { console.error('sync err:', err); }
      showToast(`"${data.institution}" 등록 완료`, 'success');
    }
    setShared('sj-entries-v4', allEntries);
    updateBadge();
    if (typeof renderRecords === 'function') renderRecords();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch(err) {
    console.error('cwSaveCard err:', err);
    showToast('저장 중 오류: ' + err.message, 'error');
  }
  cwRenderSavedList();
  cwResetEditCard();
  document.getElementById('cw-institution').focus();
}

function cwEditEntry(id) {
  const e = allEntries.find(x => String(x.id) === String(id));
  if (!e) return;
  document.getElementById('cw-editing-id').value = e.id;
  document.getElementById('cw-edit-title').textContent = '✎ 거래처 수정: ' + (e.institution||'');
  document.getElementById('cw-save-btn').textContent = '수정 저장';
  const set = (id,v) => { const el = document.getElementById(id); if (el) el.value = v||''; };
  set('cw-institution', e.institution);
  set('cw-attendee', e.attendee);
  set('cw-meeting', e.meeting);
  set('cw-issues', e.issues);
  set('cw-clientCode', e.clientCode);
  set('cw-contact', e.contact);
  set('cw-sideBusiness', e.sideBusiness);
  set('cw-region', e.region);
  set('cw-gender', e.gender);
  set('cw-age', e.age);
  set('cw-floor', e.floor);
  set('cw-area', e.area);
  set('cw-experience', e.experience);
  document.getElementById('cw-clientType').value = e.clientType || '';
  cwSetDeal(e.dealPossibility || '');
  document.getElementById('cw-edit-card').scrollIntoView({behavior:'smooth',block:'center'});
}

function cwDeleteEntry(id) {
  const e = allEntries.find(x => String(x.id) === String(id));
  if (!e) return;
  if (!confirm(`"${e.institution||''}" 항목을 삭제할까요?`)) return;
  allEntries = allEntries.filter(x => String(x.id) !== String(id));
  setShared('sj-entries-v4', allEntries);
  updateBadge();
  if (typeof renderRecords === 'function') renderRecords();
  if (typeof renderDashboard === 'function') renderDashboard();
  cwRenderSavedList();
  // 수정 중이던 항목이면 입력 카드도 리셋
  if (document.getElementById('cw-editing-id').value === String(id)) cwResetEditCard();
  showToast('삭제되었습니다', 'success');
}

function cwFinish() {
  // 입력중인 내용 있으면 확인
  const data = cwGetFormData();
  const hasDraft = data.institution || data.meeting || data.attendee;
  if (hasDraft) {
    if (!confirm('입력중인 내용이 있습니다. 저장하지 않고 닫을까요?')) return;
  }
  dlyBackToCalExec();
}

// ── 기관명 자동완성 ──
let _cwAcIdx = -1;
function cwAcSearch() {
  const input = document.getElementById('cw-institution');
  const list = document.getElementById('cw-ac-list');
  const q = (input.value||'').trim().toLowerCase();
  if (!q) { list.classList.remove('open'); list.innerHTML = ''; return; }
  const matches = (allClients||[]).filter(c => (c.name||'').toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { list.classList.remove('open'); list.innerHTML = ''; return; }
  _cwAcIdx = -1;
  list.innerHTML = matches.map((c,i) => `<div class="ss-ac-item" data-i="${i}" onmousedown="cwAcPick(${i})">
    <span>${escHtml(c.name)}</span>
    ${c.code ? `<span class="ac-code">${escHtml(c.code)}</span>` : ''}
    ${c.region ? `<span class="ac-region">${escHtml(c.region)}</span>` : ''}
  </div>`).join('');
  list.classList.add('open');
  list._matches = matches;
}
function cwAcClose() { const list = document.getElementById('cw-ac-list'); if (list) { list.classList.remove('open'); list.innerHTML = ''; } }
function cwAcPick(i) {
  const list = document.getElementById('cw-ac-list');
  const c = list._matches && list._matches[i];
  if (!c) return;
  const set = (id,v) => { const el = document.getElementById(id); if (el) el.value = v||''; };
  set('cw-institution', c.name);
  set('cw-clientCode', c.code);
  set('cw-contact', c.contact);
  set('cw-sideBusiness', c.sideBusiness);
  set('cw-region', c.region);
  set('cw-gender', c.gender);
  set('cw-age', c.age);
  set('cw-floor', c.floor);
  set('cw-area', c.area);
  set('cw-experience', c.experience);
  if (c.clientType) document.getElementById('cw-clientType').value = c.clientType;
  cwAcClose();
}
function cwAcKeydown(e) {
  const list = document.getElementById('cw-ac-list');
  if (!list.classList.contains('open')) return;
  const items = list.querySelectorAll('.ss-ac-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); _cwAcIdx = Math.min(items.length-1, _cwAcIdx+1); items.forEach((it,i)=>it.classList.toggle('active', i===_cwAcIdx)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _cwAcIdx = Math.max(0, _cwAcIdx-1); items.forEach((it,i)=>it.classList.toggle('active', i===_cwAcIdx)); }
  else if (e.key === 'Enter' && _cwAcIdx >= 0) { e.preventDefault(); cwAcPick(_cwAcIdx); }
  else if (e.key === 'Escape') { cwAcClose(); }
}
function cwCheckClient() {
  const name = (document.getElementById('cw-institution').value||'').trim();
  if (!name) return;
  const existing = (allClients||[]).find(c => c.name === name);
  const ct = document.getElementById('cw-clientType');
  if (!existing) {
    if (ct && !ct.value) ct.value = '신규거래처';
    cwNewClientPopup(name);
  }
}

function cwNewClientPopup(name) {
  const existing = document.getElementById('cw-new-client-popup');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'cw-new-client-popup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="font-size:28px;margin-bottom:12px">🏢</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">신규 거래처입니다</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:22px">"${escHtml(name)}"의 프로필을 등록해주세요</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="submit-btn" onclick="cwOpenNewClientProfile('${name.replace(/'/g,"\\'")}')" style="padding:8px 22px;width:auto">거래처 등록하기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function cwOpenNewClientProfile(name) {
  document.getElementById('cw-new-client-popup')?.remove();
  openAddClientModal();
  const modal = document.getElementById('modal-client-form');
  if (modal) modal.style.zIndex = '10001';
  setTimeout(() => {
    const nameEl = document.getElementById('cf-name');
    if (nameEl && name) { nameEl.value = name; nameEl.dispatchEvent(new Event('input')); }
  }, 50);
}

function ssAddRowWithDate(ds) {
  _ssRowId++;
  const rid = 'ssr' + _ssRowId;
  const tr = document.createElement('tr');
  tr.id = rid;
  tr.innerHTML = `
    <td>${_ssRowId}</td>
    <td><input class="ss-input" type="date" data-f="date" value="${ds}" tabindex="0" /></td>
    <td style="position:relative;vertical-align:middle;padding:2px 3px">
      <input class="ss-input" data-f="institution" placeholder="" autocomplete="off" tabindex="0"
        oninput="ssAcSearch(this)" onfocus="ssAcSearch(this)"
        onblur="setTimeout(()=>{ssAcClose();ssCheckNewClient('${rid}')},250)"
        onkeydown="ssAcKeydown(event,this)" />
      <div class="ss-ac-list" id="acl-${rid}"></div>
      <input type="hidden" data-f="clientCode" />
      <input type="hidden" data-f="contact" />
      <input type="hidden" data-f="sideBusiness" />
      <input type="hidden" data-f="region" />
      <input type="hidden" data-f="gender" />
      <input type="hidden" data-f="age" />
      <input type="hidden" data-f="floor" />
      <input type="hidden" data-f="area" />
      <input type="hidden" data-f="experience" />
    </td>
    <td><select class="ss-select" data-f="clientType" tabindex="0" onchange="ssCltTypeChange(this)"><option value="">-</option><option>기존 거래처</option><option>신규거래처</option><option>휴면거래처</option></select></td>
    <td><input class="ss-input" data-f="attendee" placeholder="" tabindex="0" /></td>
    <td><textarea class="ss-textarea" data-f="meeting" placeholder="" rows="2" tabindex="0"></textarea></td>
    <td><textarea class="ss-textarea" data-f="issues" placeholder="" rows="2" tabindex="0"></textarea></td>
    <td style="text-align:center"><select class="ss-select" data-f="dealPossibility" tabindex="0" style="text-align:center;font-size:15px"><option value="">-</option><option value="○">○</option><option value="△">△</option><option value="×">×</option></select></td>
    <td style="vertical-align:middle;text-align:center;padding:4px">
      <button class="ss-del" onclick="ssDelRow('${rid}')" title="삭제" style="width:100%;margin:0">삭제</button>
    </td>
  `;
  const body = document.getElementById('ss-body');
  body.appendChild(tr);
  return tr;
}

function dlyBackToCal() {
  // 입력중인 카드 내용 확인
  const institution = (document.getElementById('cw-institution')?.value||'').trim();
  const meeting = (document.getElementById('cw-meeting')?.value||'').trim();
  const attendee = (document.getElementById('cw-attendee')?.value||'').trim();
  const hasDraft = institution || meeting || attendee;
  if (hasDraft) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = `
      <div style="background:#fff;border-radius:10px;padding:28px 32px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.18);min-width:280px">
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:10px">캘린더로 돌아가시겠습니까?</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:22px">입력중인 내용은 저장되지 않습니다.</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button class="btn-sm btn-ghost" style="padding:8px 24px" id="dly-back-cancel">취소</button>
          <button class="btn-sm btn-primary" style="padding:8px 24px;background:var(--red);border-color:var(--red)" id="dly-back-confirm">확인</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#dly-back-cancel').onclick = () => ov.remove();
    ov.querySelector('#dly-back-confirm').onclick = () => { ov.remove(); dlyBackToCalExec(); };
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    return;
  }
  dlyBackToCalExec();
}

function dlyBackToCalExec() {
  document.getElementById('dly-input-view').style.display = 'none';
  dlyRenderCal();
}



function dlyRenderList() {
  const yearSel = document.getElementById('dly-filter-year');
  const monthSel = document.getElementById('dly-filter-month');
  const fy = yearSel ? parseInt(yearSel.value) : new Date().getFullYear();
  const fm = monthSel ? parseInt(monthSel.value) : 0;

  const myEntries = (allEntries||[]).filter(e => {
    if (!e.date) return false;
    if (currentUser.role !== 'admin' && e.personId && e.personId !== currentUser.id) return false;
    if (parseInt(e.date.slice(0,4)) !== fy) return false;
    if (fm > 0 && parseInt(e.date.slice(5,7)) !== fm) return false;
    return true;
  });

  // 날짜별 그룹
  const byDate = {};
  myEntries.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
  const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));

  const tbody = document.getElementById('dly-board');
  const empty = document.getElementById('dly-empty');
  const countEl = document.getElementById('dly-board-count');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (countEl) countEl.textContent = `총 ${dates.length}건`;

  if (!dates.length) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const dayNames = ['일','월','화','수','목','금','토'];
  dates.forEach((dateStr, idx) => {
    const entries = byDate[dateStr];
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = dayNames[d.getDay()];
    const institutions = entries.map(e=>e.institution).filter(Boolean);
    const instDisplay = institutions.join(', ').slice(0,50) + (institutions.join(', ').length>50?'…':'');
    const dealCounts = {'○':0,'△':0,'×':0};
    entries.forEach(e => { if (dealCounts[e.dealPossibility]!==undefined) dealCounts[e.dealPossibility]++; });
    const dealBadge = dealCounts['○']>0
      ? `<span class="bbs-badge bbs-badge-o">○ ${dealCounts['○']}</span>`
      : dealCounts['△']>0
        ? `<span class="bbs-badge bbs-badge-d">△ ${dealCounts['△']}</span>`
        : dealCounts['×']>0
          ? `<span class="bbs-badge bbs-badge-x">× ${dealCounts['×']}</span>`
          : '';
    const firstEntry = entries[0];
    const tr = document.createElement('tr');
    tr.onclick = () => dlyOpenForm();
    tr.innerHTML = `
      <td class="bbs-num">${dates.length - idx}</td>
      <td class="bbs-td-title">
        ${dateStr.replace(/-/g,'/')} (${dayName}) — ${instDisplay || '기관 정보 없음'}
        <span style="margin-left:6px;font-size:11px;color:var(--text3)">${entries.length}건 방문</span>
      </td>
      <td>${dateStr.slice(5).replace('-','/')}</td>
      <td>${firstEntry?.clientType||'-'}</td>
      <td>${dealBadge||'-'}</td>
      <td>${firstEntry?.person||currentUser.name||'-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function dlyOpenForm() {
  document.getElementById('dly-list-view').style.display = 'none';
  document.getElementById('dly-form-view').style.display = '';
  ssInitPage();
}

function dlyCloseForm() {
  document.getElementById('dly-form-view').style.display = 'none';
  document.getElementById('dly-list-view').style.display = '';
  dlyInit();
}

function ssInitPage() {
  const body = document.getElementById('ss-body');
  if (!body || body.children.length > 0) return;
  ssAddRows(10);
}

var _ssPage = 1;
var _ssPageSize = 40;

function ssAddRow(focus) {
  _ssRowId++;
  const rid = 'ssr' + _ssRowId;
  const today = (typeof _dlySelectedDate !== 'undefined' && _dlySelectedDate) ? _dlySelectedDate : new Date().toISOString().split('T')[0];
  const tr = document.createElement('tr');
  tr.id = rid;
  tr.innerHTML = `
    <td>${_ssRowId}</td>
    <td><input class="ss-input" type="date" data-f="date" value="${today}" tabindex="0" /></td>
    <td style="position:relative;vertical-align:middle;padding:2px 3px">
      <input class="ss-input" data-f="institution" placeholder="" autocomplete="off" tabindex="0"
        oninput="ssAcSearch(this)" onfocus="ssAcSearch(this)"
        onblur="setTimeout(()=>{ssAcClose();ssCheckNewClient('${rid}')},250)"
        onkeydown="ssAcKeydown(event,this)" />
      <div class="ss-ac-list" id="acl-${rid}"></div>
      <input type="hidden" data-f="clientCode" />
      <input type="hidden" data-f="contact" />
      <input type="hidden" data-f="sideBusiness" />
      <input type="hidden" data-f="region" />
      <input type="hidden" data-f="gender" />
      <input type="hidden" data-f="age" />
      <input type="hidden" data-f="floor" />
      <input type="hidden" data-f="area" />
      <input type="hidden" data-f="experience" />
    </td>
    <td><select class="ss-select" data-f="clientType" tabindex="0" onchange="ssCltTypeChange(this)"><option value="">-</option><option>기존 거래처</option><option>신규거래처</option><option>휴면거래처</option></select></td>
    <td><input class="ss-input" data-f="attendee" placeholder="" tabindex="0" /></td>
    <td><textarea class="ss-textarea" data-f="meeting" placeholder="" rows="2" tabindex="0"></textarea></td>
    <td><textarea class="ss-textarea" data-f="issues" placeholder="" rows="2" tabindex="0"></textarea></td>
    <td style="text-align:center"><select class="ss-select" data-f="dealPossibility" tabindex="0" style="text-align:center;font-size:15px"><option value="">-</option><option value="○">○</option><option value="△">△</option><option value="×">×</option></select></td>
    <td style="vertical-align:middle;text-align:center;padding:4px">
      <button class="ss-del" onclick="ssDelRow('${rid}')" title="삭제" style="width:100%;margin:0">삭제</button>
    </td>
  `;
  const body = document.getElementById('ss-body');
  body.appendChild(tr);
  // 마지막 페이지로
  ssRenum();
  ssUpdateStatus();
  if (focus) {
    const firstInput = tr.querySelector('[data-f="institution"]');
    if (firstInput) firstInput.focus();
  }
  return tr;
}

function ssAddRows(n) {
  for (let i = 0; i < n; i++) ssAddRow();
}

function ssDelRow(rid) {
  const tr = document.getElementById(rid);
  if (!tr) return;
  // 저장된 항목이면 데이터에서도 제거
  if (tr.classList.contains('ss-saved')) {
    const before = allEntries.length;
    if (tr.dataset.entryId) {
      const targetId = String(tr.dataset.entryId);
      allEntries = allEntries.filter(e => String(e.id) !== targetId);
    } else {
      const data = ssGetRowData(tr);
      allEntries = allEntries.filter(e => !(e.date === data.date && e.institution === data.institution && e.meeting === data.meeting && e.personId === currentUser.id));
    }
    if (allEntries.length !== before) {
      setShared('sj-entries-v4', allEntries);
      updateBadge();
      if (typeof renderRecords === 'function') renderRecords();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
    tr.classList.remove('ss-saved');
    delete tr.dataset.entryId;
  }
  // 입력 내용만 초기화 (행은 유지)
  tr.querySelectorAll('input[data-f]:not([type="hidden"]), textarea[data-f]').forEach(el => { el.value = ''; });
  tr.querySelectorAll('select[data-f]').forEach(el => { el.selectedIndex = 0; });
  tr.querySelectorAll('input[type="hidden"][data-f]').forEach(el => { el.value = ''; });
  // 방문일자는 현재 선택된 날짜로 복원
  const dateInput = tr.querySelector('[data-f="date"]');
  if (dateInput && _dlySelectedDate) dateInput.value = _dlySelectedDate;
  ssUpdateStatus();
}

function ssRenum() {
  document.querySelectorAll('#ss-body tr').forEach((tr, i) => {
    tr.querySelector('td:first-child').textContent = i + 1;
  });
}

function ssRenderPage() {
  // 페이지네이션 없이 모든 행 표시
  document.querySelectorAll('#ss-body tr').forEach(tr => { tr.style.display = ''; });
  const pgEl = document.getElementById('ss-pagination');
  if (pgEl) pgEl.innerHTML = '';
}

function ssPageMove(dir) {
  const allRows = document.querySelectorAll('#ss-body tr');
  const totalPages = Math.max(1, Math.ceil(allRows.length / _ssPageSize));
  _ssPage = Math.max(1, Math.min(totalPages, _ssPage + dir));
  ssRenderPage();
}

function ssGoPage(p) {
  _ssPage = p;
  ssRenderPage();
}

function ssGetRowData(tr) {
  const g = f => {
    const el = tr.querySelector(`[data-f="${f}"]`);
    if (!el) return '';
    return el.value?.trim() || '';
  };
  return {
    date: g('date'), institution: g('institution'), clientCode: g('clientCode'),
    clientType: g('clientType'), sideBusiness: g('sideBusiness'),
    attendee: g('attendee'), meeting: g('meeting'),
    issues: g('issues'), dealPossibility: g('dealPossibility') || '△',
    contact: g('contact'), region: g('region'), gender: g('gender'),
    age: g('age'), floor: g('floor'), area: g('area'), experience: g('experience'),
  };
}

function ssIsRowFilled(data) {
  return data.date && data.institution && data.clientType && data.meeting;
}

let _ssSaving = false;
function ssSaveAll() {
  if (_ssSaving) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:28px 32px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.18);min-width:260px">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:22px">일지를 등록하시겠습니까?</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn-sm btn-ghost" style="padding:8px 24px" id="ss-confirm-cancel">취소</button>
        <button class="btn-sm btn-primary" style="padding:8px 24px" id="ss-confirm-ok">확인</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#ss-confirm-cancel').onclick = () => ov.remove();
  ov.querySelector('#ss-confirm-ok').onclick = () => { ov.remove(); ssSaveAllExec(); };
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}
function ssSaveAllExec() {
  if (_ssSaving) return;
  _ssSaving = true;
  const rows = document.querySelectorAll('#ss-body tr');
  // 현재 날짜의 저장된 항목 id 수집 (삭제된 행 반영)
  const currentDate = _dlySelectedDate;
  if (currentDate) {
    const survivingIds = new Set(
      [...document.querySelectorAll('#ss-body tr[data-entry-id]')].map(tr => String(tr.dataset.entryId))
    );
    const before = allEntries.length;
    allEntries = allEntries.filter(e => e.date !== currentDate || survivingIds.has(String(e.id)));
    if (allEntries.length !== before) {
      setShared('sj-entries-v4', allEntries);
    }
  }
  let saved = 0, errors = [];
  for (const tr of rows) {
    if (tr.classList.contains('ss-saved')) continue;
    const data = ssGetRowData(tr);
    if (!data.institution && !data.meeting) continue;
    if (!data.date || !data.institution || !data.clientType || !data.attendee || !data.meeting) {
      errors.push(tr.querySelector('td:first-child').textContent + '행: 필수항목 누락 (방문일자·기관명·거래처유형·참석자·미팅내용)');
      continue;
    }
    const entry = {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), ts: new Date().toISOString(),
      person: currentUser.name, personId: currentUser.id, ...data
    };
    allEntries.push(entry);
    syncClientFromEntry(entry);
    tr.classList.add('ss-saved');
    tr.dataset.entryId = String(entry.id);
    saved++;
  }
  if (saved > 0) {
    setShared('sj-entries-v4', allEntries);
    updateBadge();
    if (typeof renderRecords === 'function') renderRecords();
    if (typeof renderDashboard === 'function') renderDashboard();
  }
  if (errors.length) {
    showToast(errors.join('\n') + '\n→ 해당 행은 저장되지 않았습니다.', 'error');
  } else if (saved > 0) {
    showToast(`${saved}건 저장 완료!`, 'success');
  }
  ssUpdateStatus();
  _ssSaving = false;
  dlyBackToCalExec();
}

function ssUpdateStatus() {
  const allRows = document.querySelectorAll('#ss-body tr');
  let filled = 0, savedCnt = 0;
  allRows.forEach(tr => {
    if (tr.classList.contains('ss-saved')) { savedCnt++; return; }
    const data = ssGetRowData(tr);
    if (data.institution || data.meeting) filled++;
  });
  const totalPages = Math.max(1, Math.ceil(allRows.length / _ssPageSize));
  const el = document.getElementById('ss-status');
  if (el) el.textContent = `총 ${allRows.length}행 · ${filled}건 입력 · ${savedCnt}건 저장됨`;
  const infoEl = document.getElementById('ss-page-info');
  if (infoEl) infoEl.textContent = `${_ssPage}/${totalPages}`;
}

// ── 거래처유형 변경 시 거래가능성 자동 고정 ──
function ssCltTypeChange(sel) {
  const tr = sel.closest('tr');
  const dpSel = tr.querySelector('[data-f="dealPossibility"]');
  if (!dpSel) return;
  if (sel.value === '기존 거래처') {
    dpSel.value = '○';
    dpSel.disabled = true;
    dpSel.style.opacity = '0.45';
    dpSel.style.cursor = 'not-allowed';
  } else {
    dpSel.disabled = false;
    dpSel.style.opacity = '';
    dpSel.style.cursor = '';
  }
}



// ── 신규 거래처 체크 (onblur 후 호출) ──
function ssCheckNewClient(rid) {
  const tr = document.getElementById(rid);
  if (!tr) return;
  const nameInput = tr.querySelector('[data-f="institution"]');
  const name = nameInput?.value?.trim();
  if (!name) return;
  const tag = tr.querySelector('.ss-client-tag');
  const client = allClients.find(c => c.name === name);
  const prevEntry = allEntries.filter(e => e.institution === name).sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
  const src = client || prevEntry;
  if (src) {
    const set = (f, v) => { if (!v) return; const el = tr.querySelector(`[data-f="${f}"]`); if (el) el.value = v; };
    set('clientCode', src.code || src.clientCode);
    set('contact', src.contact);
    set('sideBusiness', src.sideBusiness);
    set('region', src.region);
    set('gender', src.gender);
    set('age', src.age);
    set('floor', src.floor);
    set('area', src.area);
    set('experience', src.experience);
    const ctSel = tr.querySelector('[data-f="clientType"]');
    if (ctSel && !ctSel.value && src.clientType) ctSel.value = src.clientType;
    if (ctSel) ssCltTypeChange(ctSel);
    const parts = [src.region, src.gender, src.age, src.floor, src.area, src.experience, src.sideBusiness].filter(Boolean);
    if (tag) { tag.style.display = 'none'; }
  } else {
    if (tag) tag.style.display = 'none';
    // 신규 거래처 → clientType 자동 설정
    const ctSel2 = tr.querySelector('[data-f="clientType"]');
    if (ctSel2 && !ctSel2.value) { ctSel2.value = '신규거래처'; ssCltTypeChange(ctSel2); }
    ssNewClientPopup(rid);
  }
}

function ssNewClientPopup(rid) {
  const existing = document.getElementById('ss-new-client-popup');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'ss-new-client-popup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="font-size:28px;margin-bottom:12px">🏢</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">신규 거래처입니다</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:22px">프로필을 등록해주세요</div>
      <div style="display:flex;gap:10px;justify-content:center">
<button class="submit-btn" onclick="document.getElementById('ss-new-client-popup').remove();ssOpenNewClientProfile('${rid}')" style="padding:8px 22px;width:auto">거래처 추가</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function ssOpenNewClientProfile(rid) {
  const tr = document.getElementById(rid);
  if (!tr) return;
  const name = tr.querySelector('[data-f="institution"]')?.value?.trim() || '';
  // 거래처 추가 모달에 이름 선입력 후 열기
  openAddClientModal();
  setTimeout(() => {
    const nameEl = document.getElementById('cf-name');
    if (nameEl && name) { nameEl.value = name; nameEl.dispatchEvent(new Event('input')); }
  }, 50);
}

// ── 스프레드시트 자동완성 ──
function ssAcSearch(input) {
  _ssAcTarget = input;
  _ssAcIdx = -1;
  const tr = input.closest('tr');
  const listEl = tr.querySelector('.ss-ac-list');
  const val = input.value;
  if (!val || val.length < 1) { listEl.classList.remove('open'); _ssAcMatches = []; return; }
  const q = val.toLowerCase();
  const clientMatches = allClients.filter(c => c.name && (c.name.toLowerCase().includes(q) || (c.code||'').toLowerCase().includes(q)));
  const entryNames = [...new Set(allEntries.map(e=>e.institution).filter(Boolean))];
  const entryOnly = entryNames.filter(n => n.toLowerCase().includes(q) && !clientMatches.find(c=>c.name===n));
  _ssAcMatches = [
    ...clientMatches.slice(0, 6).map(c => ({ name: c.name, code: c.code, region: c.region })),
    ...entryOnly.slice(0, 3).map(n => ({ name: n, code: '', region: '' }))
  ];
  if (!_ssAcMatches.length) { listEl.classList.remove('open'); return; }
  listEl.innerHTML = _ssAcMatches.map((m, i) => {
    const code = m.code ? `<span class="ss-ac-code">${escHtml(m.code)}</span>` : '';
    const region = m.region ? `<span style="font-size:10px;color:var(--text3)">${escHtml(m.region)}</span>` : '';
    return `<div class="ss-ac-item" data-idx="${i}" onmousedown="ssAcPick(${i})">${escHtml(m.name)} ${region}${code}</div>`;
  }).join('');
  listEl.classList.add('open');
}

function ssAcPick(idx) {
  const m = _ssAcMatches[idx];
  if (!m || !_ssAcTarget) return;
  const tr = _ssAcTarget.closest('tr');
  _ssAcTarget.value = m.name;
  tr.querySelector('.ss-ac-list').classList.remove('open');
  // 자동채우기: allClients 우선, 없으면 allEntries 최근 기록
  const client = allClients.find(c => c.name === m.name);
  const prevEntry = allEntries.filter(e => e.institution === m.name).sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
  const src = client || prevEntry || {};
  const set = (f, v) => { if (!v) return; const el = tr.querySelector(`[data-f="${f}"]`); if (!el) return; el.value = v; };
  set('clientCode', src.code || src.clientCode);
  set('clientType', src.clientType);
  set('region', src.region);
  set('contact', src.contact);
  set('gender', src.gender);
  set('age', src.age);
  set('floor', src.floor);
  set('area', src.area);
  set('experience', src.experience);
  const sbEl = tr.querySelector('[data-f="sideBusiness"]');
  if (sbEl && src.sideBusiness) sbEl.value = src.sideBusiness;
  // clientType select 자동 선택 + 거래가능성 자동 고정
  const ctSel = tr.querySelector('[data-f="clientType"]');
  if (ctSel && !ctSel.value && src.clientType) ctSel.value = src.clientType;
  if (ctSel) ssCltTypeChange(ctSel);
  // 신규 거래처 팝업
  if (!client && !prevEntry) ssNewClientPopup(tr.id);
  _ssAcTarget = null; _ssAcMatches = []; _ssAcIdx = -1;
}

function ssAcKeydown(e, input) {
  const tr = input.closest('tr');
  const listEl = tr.querySelector('.ss-ac-list');
  if (!listEl.classList.contains('open') || !_ssAcMatches.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _ssAcIdx = Math.min(_ssAcIdx + 1, _ssAcMatches.length - 1);
    listEl.querySelectorAll('.ss-ac-item').forEach((el,i) => el.classList.toggle('active', i===_ssAcIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _ssAcIdx = Math.max(_ssAcIdx - 1, 0);
    listEl.querySelectorAll('.ss-ac-item').forEach((el,i) => el.classList.toggle('active', i===_ssAcIdx));
  } else if (e.key === 'Enter' && _ssAcIdx >= 0) {
    e.preventDefault();
    ssAcPick(_ssAcIdx);
  } else if (e.key === 'Escape') {
    listEl.classList.remove('open');
    _ssAcIdx = -1;
  }
}

function ssAcClose() {
  document.querySelectorAll('.ss-ac-list').forEach(el => el.classList.remove('open'));
  _ssAcIdx = -1;
}

// ════════════════════════════════════
// DRAFT (임시저장)
// ════════════════════════════════════
function saveDraft() {
  const draft = {
    person: currentUser?.name, personId: currentUser?.id,
    date: document.getElementById('f-date').value,
    institution: document.getElementById('f-institution').value,
    clientCode: document.getElementById('f-clientcode').value,
    clientType: document.getElementById('f-clienttype').value,
    meeting: document.getElementById('f-meeting').value,
    issues: document.getElementById('f-issues').value,
    dealPossibility: selectedDeal,
    sideBusiness: getSidebizValue(),
    ourPurchase: document.getElementById('f-our-purchase').value,
    otherPurchase: document.getElementById('f-other-purchase').value,
    contact: document.getElementById('f-contact').value,
    region: document.getElementById('f-region').value,
    gender: document.getElementById('f-gender').value,
    age: document.getElementById('f-age').value,
    floor: document.getElementById('f-floor').value,
    experience: document.getElementById('f-exp').value,
    revisitDate: document.getElementById('f-revisit-date').value,
  };
  setShared('sj-draft-'+currentUser?.id, draft);
  document.getElementById('draft-indicator').innerHTML = '<span class="draft-badge">저장됨</span>';
  showToast('임시저장되었습니다.', 'success');
}
function clearDraft() {
  try { localStorage.removeItem('sj-draft-'+currentUser?.id); }
  catch (err) { console.error('[storage:remove] draft', err); }
  document.getElementById('draft-indicator').innerHTML = '';
}
function loadDraft() {
  const d = getShared('sj-draft-'+currentUser?.id, null);
  if (!d) return;
  if (!confirm('임시저장된 내용이 있습니다. 불러올까요?')) return;
  const setField = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
  ['date','institution','meeting','issues','sidebiz','our-purchase','other-purchase','contact','revisit-date'].forEach(k => {
    const el = document.getElementById('f-'+k); if(el && d[k.replace(/-/g,'')]) el.value = d[k.replace(/-/g,'')] || d[k] || '';
  });
  if(d.date) setField('f-date', d.date);
  if(d.institution) setField('f-institution', d.institution);
  if(d.clientCode) setField('f-clientcode', d.clientCode);
  if(d.meeting) setField('f-meeting', d.meeting);
  if(d.issues) setField('f-issues', d.issues);
  if(d.sideBusiness) setSidebizValue(d.sideBusiness);
  if(d.ourPurchase) setField('f-our-purchase', d.ourPurchase);
  if(d.otherPurchase) setField('f-other-purchase', d.otherPurchase);
  if(d.contact) setField('f-contact', d.contact);
  if(d.revisitDate) setField('f-revisit-date', d.revisitDate);
  if(d.clientType) setField('f-clienttype', d.clientType);
  if(d.region) setField('f-region', d.region);
  if(d.gender) setField('f-gender', d.gender);
  if(d.age) setField('f-age', d.age);
  if(d.floor) setField('f-floor', d.floor);
  if(d.experience) setField('f-exp', d.experience);
  if(d.dealPossibility) {
    selectedDeal = d.dealPossibility;
    document.querySelectorAll('.radio-btn').forEach(b=>b.className='radio-btn');
    const cls = d.dealPossibility==='○'?'so':d.dealPossibility==='△'?'sd':'sx';
    document.querySelectorAll('.radio-btn').forEach(b=>{ if(b.querySelector('input')?.value===d.dealPossibility||b.textContent.includes(d.dealPossibility)) b.classList.add(cls); });
  }
  document.getElementById('draft-indicator').innerHTML = '<span class="draft-badge">불러옴</span>';
}

// ════════════════════════════════════
// DETAIL MODAL
// ════════════════════════════════════
function openDetail(id) {
  const e = allEntries.find(x=>String(x.id)===String(id)); if(!e)return;
  const dc={'○':'do','△':'dd','×':'dx'};
  const tc={'기존 거래처':'te','신규거래처':'tn','휴면거래처':'td2','거래 재개':'tr2'};
  document.getElementById('detail-chips').innerHTML = [
    {l:'날짜', v:escHtml(e.date||'-')},
    {l:'영업사원', v:escHtml(e.person||'-')},
    {l:'거래처 유형', v:`<span class="type-badge ${tc[e.clientType]||''}">${escHtml(e.clientType||'-')}</span>`},
    {l:'거래 가능성', v:`<span class="deal-badge ${dc[e.dealPossibility]||''}">${escHtml(e.dealPossibility||'-')}</span>`},
    {l:'참석자', v:escHtml(e.attendee||'-')},
    {l:'지역', v:escHtml(e.region||'-')},
    {l:'병행업종', v:escHtml(e.sideBusiness||'-')},
    {l:'연락처', v:escHtml(e.contact||'-')},
  ].map(({l,v})=>`<div class="detail-chip"><div class="detail-label">${l}</div><div class="detail-value" style="font-size:12px">${v}</div></div>`).join('');
  document.getElementById('detail-meeting').textContent = e.meeting||'-';
  const iw = document.getElementById('detail-issues-wrap');
  if (e.issues) { iw.style.display='block'; document.getElementById('detail-issues').textContent = e.issues; }
  else iw.style.display='none';
  openModal('modal-detail');
}

// ════════════════════════════════════
