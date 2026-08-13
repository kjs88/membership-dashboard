// ════════════════════════════════════
// DAILY ENTRY (일간일지)
// ════════════════════════════════════
// ════════════════════════════════════
// DAILY CALENDAR (일간일지 캘린더)
// ════════════════════════════════════
var _dlyCY = new Date().getFullYear();
var _dlyCM = new Date().getMonth();
var _dlySelectedDate = todayYmd();
var _dlySelectedPersonId = '';

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
  const today = todayYmd();

  // 해당 월 일지 맵 { 'YYYY-MM-DD': [entry,...] }
  const entryMap = {};
  (allEntries||[]).forEach(e => {
    if (!e.date) return;
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
      const pId = e.personId || '';
      const key = pId || (e.person || '미입력');
      if (!personMap[key]) personMap[key] = { id: pId, name: e.person || '미입력', count: 0 };
      personMap[key].count++;
    });
    const personGroups = Object.values(personMap);
    const summaryLines = personGroups.slice(0,5).map(p =>
      `<div class="dly-entry-dot" onclick="event.stopPropagation();dlyOpenDate('${ds}','${escInlineJs(p.id)}')">● ${escHtml(p.name)} / ${p.count}처</div>`
    ).join('');
    const dotsHtml = summaryLines;
    const moreHtml = personGroups.length > 5 ? `<div class="dly-more">+${personGroups.length-5}명 더</div>` : '';

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

function dlyOpenDate(ds, personId = '') {
  _dlySelectedDate = ds;
  _dlySelectedPersonId = personId || '';
  document.getElementById('dly-input-view').style.display = 'block';

  const [y,m,d] = ds.split('-');
  const days = ['일','월','화','수','목','금','토'];
  const dow = days[new Date(ds).getDay()];
  const lbl = document.getElementById('dly-input-date-label');
  if (lbl) {
    const personName = _dlySelectedPersonId
      ? ((allUsers || []).find(u => u.id === _dlySelectedPersonId)?.name || '')
      : '';
    lbl.textContent = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${dow})${personName ? ' · ' + personName : ''}`;
  }
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
    if (_dlySelectedPersonId && e.personId !== _dlySelectedPersonId) return false;
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
    const canManage = dlyCanManageEntry(e);
    const ownerHtml = e.person ? `<span style="font-size:11px;color:var(--text3);margin-left:6px">작성자 ${escHtml(e.person)}</span>` : '';
    const actionsHtml = canManage
      ? `<button class="btn-sm btn-ghost" style="padding:4px 10px;font-size:11px" onclick="cwEditEntry('${entryId}')">수정</button>
        <button class="btn-sm btn-danger" style="padding:4px 10px;font-size:11px" onclick="cwDeleteEntry('${entryId}')">삭제</button>`
      : `<span style="font-size:11px;color:var(--text3);font-weight:600">읽기 전용</span>`;
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px">
          ${escHtml(e.institution||'')}
          ${e.clientType ? `<span style="${typeCls};font-size:11px;padding:2px 7px;border-radius:4px;margin-left:6px;font-weight:700">${escHtml(e.clientType)}</span>` : ''}
          ${e.dealPossibility ? `<span style="${dealCls};font-size:11px;padding:2px 7px;border-radius:4px;margin-left:3px;font-weight:700">${escHtml(e.dealPossibility)}</span>` : ''}
          ${ownerHtml}
        </div>
        <div style="font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${e.attendee ? escHtml(e.attendee)+' · ' : ''}${escHtml(meeting)}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        ${actionsHtml}
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

function dlyCanManageEntry(entry) {
  if (!entry) return false;
  return isAdminUser(currentUser) || !entry.personId || entry.personId === currentUser?.id;
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
  if (!data.institution || !data.attendee || !data.meeting) {
    showToast('필수 항목을 확인하세요: 기관명 · 참석자 · 미팅내용', 'error');
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
  if (!dlyCanManageEntry(e)) {
    showToast('다른 작성자의 일지는 조회만 가능합니다.', 'error');
    return;
  }
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
  if (!dlyCanManageEntry(e)) {
    showToast('다른 작성자의 일지는 삭제할 수 없습니다.', 'error');
    return;
  }
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

// ════════════════════════════════════
// DRAFT (임시저장)
// ════════════════════════════════════
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
