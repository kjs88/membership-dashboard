// WEEKLY (주간일지) — 게시판형
// ════════════════════════════════════
var allWeeklyReports = [];
var _wkYear = new Date().getFullYear();
var _wkWeekNum = getWeekNum(new Date());
var _wkIssueId = 0;
var _wkEditingId = null;

function wkAutoResizeTextarea(el) {
  if (!el || el.tagName !== 'TEXTAREA') return;
  const minHeight = parseInt(el.dataset.autoMin || el.style.minHeight || '52', 10) || 52;
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, minHeight) + 'px';
}

function wkAutoResizeTextareas(root) {
  const scope = root || document;
  scope.querySelectorAll('#wk-schedule,#wk-market,#wk-hl-rows textarea').forEach(wkAutoResizeTextarea);
}

document.addEventListener('input', e => {
  if (e.target.matches('#wk-schedule,#wk-market,#wk-hl-rows textarea')) {
    wkAutoResizeTextarea(e.target);
  }
});

// 주차 기준: 목요일 시작 ~ 수요일 종료
function getWeekStart(d) {
  // 주어진 날짜가 속한 주의 목요일(시작)을 반환
  const day = d.getDay(); // 0=일,1=월,...,4=목,...,6=토
  // 목=4 기준: 목(0), 금(-1), 토(-2), 일(-3), 월(-4→+3 wrap), 화(-4→+2), 수(-4→+1)
  const diff = (day >= 4) ? (day - 4) : (day + 3);
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0,0,0,0);
  return start;
}

function getWeekNum(d) {
  // 해당 연도 첫 번째 목요일(1주차 시작)부터 몇 번째 주인지 계산
  const start = getWeekStart(d);
  const year = start.getFullYear();
  // 해당 연도 1월 1일이 속한 주의 목요일 시작 = 1주차
  const jan1 = new Date(year, 0, 1);
  const firstThursday = getWeekStart(jan1);
  // jan1이 목요일 이전(일~수)이면 첫 목요일은 다음 주 목요일
  const diff = (start - firstThursday) / (7 * 86400000);
  return Math.round(diff) + 1;
}

function getWeekRange(year, week) {
  // 해당 연도 1주차 시작(목요일) 계산
  const jan1 = new Date(year, 0, 1);
  const firstThursday = getWeekStart(jan1);
  const start = new Date(firstThursday);
  start.setDate(firstThursday.getDate() + (week - 1) * 7);
  const end = new Date(start); end.setDate(start.getDate() + 6); // +6 = 수요일
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;

  // 월 표기 기준: 목~수 7일 중 3일 이상 포함된 월 (연도 포함 키로 관리)
  const monthCount = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    monthCount[key] = (monthCount[key] || 0) + 1;
  }
  // 가장 많은 일수 포함 월 (동수면 목요일 속한 월 우선)
  let labelKey = `${start.getFullYear()}-${start.getMonth()}`;
  let maxCount = 0;
  for (const [key, cnt] of Object.entries(monthCount)) {
    if (cnt > maxCount) { maxCount = cnt; labelKey = key; }
  }
  const [labelYear, labelMonthIdx] = labelKey.split('-').map(Number);

  // 해당 월에서 start(목)이 몇 번째 목요일인지
  let thuCount = 0;
  const cur = new Date(labelYear, labelMonthIdx, 1);
  while (true) {
    if (cur.getDay() === 4) {
      thuCount++;
      if (cur.getTime() === start.getTime()) break;
    }
    cur.setDate(cur.getDate() + 1);
    if (cur > start) break;
  }
  const weekOfMonth = thuCount;
  const m = labelMonthIdx + 1;
  return {
    start, end,
    label: `${labelYear}년 ${m}월 ${weekOfMonth}주차`,
    rangeLabel: `${fmt(start)}~${fmt(end)}`,
    fullLabel: `${labelYear}년 ${m}월 ${weekOfMonth}주차 (${fmt(start)}~${fmt(end)})`
  };
}

function wkLoadReports() {
  allWeeklyReports = getShared('sj-weekly-reports-' + currentUser.id, []);
}

function wkSaveReports() {
  setShared('sj-weekly-reports-' + currentUser.id, allWeeklyReports);
}

function wkInit() {
  wkLoadReports();
  // 연도 필터 구성
  const yearSel = document.getElementById('wk-filter-year');
  if (yearSel) {
    const years = new Set([new Date().getFullYear()]);
    allWeeklyReports.forEach(r => years.add(r.year));
    const cur = parseInt(yearSel.value) || new Date().getFullYear();
    yearSel.innerHTML = [...years].sort((a,b)=>b-a)
      .map(y => `<option value="${y}"${y===cur?' selected':''}>${y}년</option>`).join('');
  }
  wkRenderList();
}

function wkRenderList() {
  const yearSel = document.getElementById('wk-filter-year');
  const filterYear = yearSel ? parseInt(yearSel.value) : new Date().getFullYear();
  const tbody = document.getElementById('wk-board');
  const empty = document.getElementById('wk-empty');
  const countEl = document.getElementById('wk-board-count');
  if (!tbody) return;

  const filtered = allWeeklyReports
    .filter(r => r.year === filterYear)
    .sort((a,b) => b.week - a.week || (b.savedAt||'').localeCompare(a.savedAt||''));

  tbody.innerHTML = '';
  if (countEl) countEl.textContent = `총 ${filtered.length}건`;

  if (!filtered.length) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  filtered.forEach((r, idx) => {
    const range = getWeekRange(r.year, r.week);
    const visitRate = r.kpi?.visit?.target > 0
      ? (r.kpi.visit.actual / r.kpi.visit.target * 100).toFixed(0) + '%' : '-';
    const savedDate = r.savedAt ? r.savedAt.slice(0,10).slice(5).replace('-','/') : '-';
    const reportId = escInlineJs(r.id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bbs-num">${filtered.length - idx}</td>
      <td class="bbs-td-title">${escHtml(r.title || range.fullLabel)}</td>
      <td>${escHtml(range.label)}</td>
      <td>${r.kpi?.visit?.actual ?? '-'}</td>
      <td>${r.kpi?.new?.actual ?? '-'}</td>
      <td style="font-weight:600;color:var(--green-dark)">${visitRate}</td>
      <td>${escHtml(r.person||'-')}</td>
      <td>${escHtml(savedDate)}</td>
    `;
    tr.onclick = () => wkOpenForm(r.id);
    // 수정/삭제 버튼은 더블클릭 방지를 위해 마지막 셀에
    const actTd = document.createElement('td');
    actTd.style.cssText = 'white-space:nowrap';
    actTd.innerHTML = `
      <button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();wkOpenForm('${reportId}')">수정</button>
      <button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px;color:#e53935" onclick="event.stopPropagation();wkDeleteReport('${reportId}')">삭제</button>
    `;
    tr.appendChild(actTd);
    tbody.appendChild(tr);
  });
}

function wkOpenForm(id) {
  _wkEditingId = id || null;
  _wkIssueId = 0;

  const setDisp = (spanId, val) => {
    const el = document.getElementById(spanId);
    if (el) el.textContent = (val != null && val !== '') ? val : '-';
  };
  const setVal = (inputId, val) => {
    const el = document.getElementById(inputId);
    if (el) {
      el.value = val || '';
      wkAutoResizeTextarea(el);
    }
  };

  // 지난주(현재 주차-1) 보고서에서 nextWeekTarget 불러오기
  const loadPrevTarget = (year, week) => {
    let py = year, pw = week - 1;
    if (pw < 1) { py--; pw = 52; }
    const prev = allWeeklyReports.find(x =>
      x.year === py && x.week === pw &&
      (isAdminUser(currentUser) || x.personId === currentUser.id)
    );
    if (prev?.nextWeekTarget) {
      setDisp('wk-target-new-disp',      prev.nextWeekTarget.new);
      setDisp('wk-target-dormant-disp',  prev.nextWeekTarget.dormant);
      setDisp('wk-target-existing-disp', prev.nextWeekTarget.existing);
    } else {
      setDisp('wk-target-new-disp', '-');
      setDisp('wk-target-dormant-disp', '-');
      setDisp('wk-target-existing-disp', '-');
    }
    wkCalcKpi();
  };

  if (id) {
    const r = allWeeklyReports.find(x => x.id === id);
    if (!r) return;
    _wkYear = r.year;
    _wkWeekNum = r.week;
    wkUpdateFormPeriod(false);
    setVal('wk-title', r.title);
    if (document.getElementById('wk-visit-total')) document.getElementById('wk-visit-total').textContent = 0;
    setVal('wk-schedule',   r.schedule);
    setVal('wk-market', r.market);
    wkHlDeserialize(r.highlights || '');
    _wkPhotos = []; _wkPhotoPage = 0; wkRenderPhotoGallery();
    // wk-notes removed
    // 차주 목표 복원
    setVal('wk-next-new',      r.nextWeekTarget?.new);
    setVal('wk-next-dormant',  r.nextWeekTarget?.dormant);
    setVal('wk-next-existing', r.nextWeekTarget?.existing);
    wkCalcNextTarget();
    const list = document.getElementById('wk-issues-list');
    if (list) list.innerHTML = '';
    loadPrevTarget(r.year, r.week);
    wkAutoCount();
  } else {
    _wkYear = new Date().getFullYear();
    _wkWeekNum = getWeekNum(new Date());
    wkClearForm();
    wkUpdateFormPeriod(true);
    const list = document.getElementById('wk-issues-list');
    if (list) list.innerHTML = '';
    loadPrevTarget(_wkYear, _wkWeekNum);
  }

  document.getElementById('wk-list-view').style.display = 'none';
  document.getElementById('wk-form-view').style.display = '';
  requestAnimationFrame(() => wkAutoResizeTextareas(document.getElementById('wk-form-view')));
}

function wkCloseForm() {
  document.getElementById('wk-form-view').style.display = 'none';
  document.getElementById('wk-list-view').style.display = '';
  wkInit();
}

function wkClearForm() {
  ['wk-title','wk-next-new','wk-next-dormant','wk-next-existing','wk-schedule','wk-market','wk-highlights'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.value = ''; wkAutoResizeTextarea(el); }
  });
  const totN = document.getElementById('wk-next-target-total'); if (totN) totN.textContent = '0';
  ['visit','new','dormant','existing'].forEach(k => {
    const r = document.getElementById('wk-kpi-'+k+'-rate'); if (r) r.textContent = '-';
  });
}

function wkFormPrev() {
  _wkWeekNum--;
  if (_wkWeekNum < 1) { _wkYear--; _wkWeekNum = 52; }
  wkUpdateFormPeriod(true);
}

function wkFormNext() {
  _wkWeekNum++;
  if (_wkWeekNum > 52) { _wkYear++; _wkWeekNum = 1; }
  wkUpdateFormPeriod(true);
}

function wkUpdateFormPeriod(autoTitle) {
  const range = getWeekRange(_wkYear, _wkWeekNum);
  const periodEl = document.getElementById('wk-form-period');
  const subtitleEl = document.getElementById('wk-form-subtitle');
  if (periodEl) periodEl.textContent = range.fullLabel;
  if (subtitleEl) subtitleEl.textContent = range.rangeLabel + ' 주간 업무 요약';
  if (autoTitle) {
    const titleEl = document.getElementById('wk-title');
    if (titleEl) titleEl.value = range.fullLabel + ' 주간업무보고';
  }
  wkAutoCount();
}

function wkAutoCount() {
  const range = getWeekRange(_wkYear, _wkWeekNum);
  const startStr = range.start.toISOString().slice(0,10);
  const endStr = range.end.toISOString().slice(0,10);
  const weekEntries = (allEntries||[]).filter(e =>
    e.personId === currentUser.id && e.date >= startStr && e.date <= endStr
  );
  const visitEl = document.getElementById('wk-kpi-visit-actual');
  const newEl = document.getElementById('wk-kpi-new-actual');
  if (visitEl) visitEl.value = weekEntries.length;
  if (newEl) newEl.value = weekEntries.filter(e => e.clientType === '신규거래처').length;
  wkCalcKpi();
}

function wkAddIssue() {
  _wkIssueId++;
  const div = document.createElement('div');
  div.className = 'form-grid';
  div.style.cssText = 'margin-bottom:8px;align-items:start';
  div.id = 'wk-issue-' + _wkIssueId;
  div.innerHTML = `
    <div class="form-group" style="flex:3"><input class="form-input" placeholder="이슈 내용" data-wki="issue" /></div>
    <div class="form-group" style="flex:1"><select class="form-select" data-wki="status"><option value="">상태</option><option>진행</option><option>보류</option><option>완료</option></select></div>
    <div class="form-group" style="flex:2"><input class="form-input" placeholder="차주 추진 계획" data-wki="plan" /></div>
    <button class="ss-del" onclick="this.parentElement.remove()" style="margin-top:6px">×</button>
  `;
  document.getElementById('wk-issues-list').appendChild(div);
}

function wkCalcVisit() {
  const n = parseInt(document.getElementById('wk-visit-new')?.value) || 0;
  const d = parseInt(document.getElementById('wk-visit-dormant')?.value) || 0;
  const e = parseInt(document.getElementById('wk-visit-existing')?.value) || 0;
  const tot = document.getElementById('wk-visit-total');
  if (tot) tot.textContent = n + d + e;
}



// ── 사진 첨부 & 갤러리 ──
let _wkPhotos = []; // {dataUrl, name, rowInst}
let _wkPhotoPage = 0;
const WK_PHOTOS_PER_PAGE = 9;

function wkHlAddPhotos(input) {
  const row = input.closest('[data-inst]');
  const inst = row ? row.dataset.inst : '';
  const files = Array.from(input.files);
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      _wkPhotos.push({ dataUrl: e.target.result, name: file.name, inst });
      loaded++;
      if (loaded === files.length) { _wkPhotoPage = Math.floor((_wkPhotos.length - 1) / WK_PHOTOS_PER_PAGE); wkRenderPhotoGallery(); }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function wkRenderPhotoGallery() {
  const grid = document.getElementById('wk-photo-grid');
  const pager = document.getElementById('wk-photo-pager');
  if (!grid) return;
  const total = _wkPhotos.length;
  if (pager) pager.textContent = total ? total + '장' : '';
  if (!total) { grid.innerHTML = ''; return; }

  // 사업소별 그룹핑
  const groups = {};
  _wkPhotos.forEach((p, i) => {
    const key = p.inst || '(미분류)';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...p, idx: i });
  });

  grid.innerHTML = Object.entries(groups).map(([inst, photos]) => `
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--green-dark);background:var(--green-light);display:inline-block;padding:2px 10px;border-radius:20px;margin-bottom:6px">${escHtml(inst)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${photos.map(p => `
          <div style="position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;cursor:pointer;border:1px solid var(--border);flex-shrink:0"
            onclick="wkPhotoLightbox(${p.idx})">
            <img src="${p.dataUrl}" style="width:100%;height:100%;object-fit:cover" loading="lazy"/>
            <button onclick="event.stopPropagation();wkDeletePhoto(${p.idx})"
              style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1;padding:0">✕</button>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function wkDeletePhoto(idx) {
  _wkPhotos.splice(idx, 1);
  if (_wkPhotoPage >= Math.ceil(_wkPhotos.length / WK_PHOTOS_PER_PAGE)) _wkPhotoPage = Math.max(0, _wkPhotoPage - 1);
  wkRenderPhotoGallery();
}

function wkPhotoLightbox(idx) {
  const p = _wkPhotos[idx];
  if (!p) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  ov.onclick = () => ov.remove();
  ov.innerHTML = `
    <div style="position:relative;display:inline-block">
      <img src="${p.dataUrl}" style="max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:block"/>
      ${p.inst ? `<div style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,.6);color:#fff;font-size:14px;font-weight:700;padding:6px 14px;border-radius:7px;pointer-events:none">${escHtml(p.inst)}</div>` : ""}
    </div>
    <button onclick="event.stopPropagation();wkPhotoLightbox(${idx-1})" style="position:absolute;left:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.2);border:none;color:#fff;font-size:28px;border-radius:50%;width:44px;height:44px;cursor:pointer" ${idx===0?'disabled':''}>‹</button>
    <button onclick="event.stopPropagation();wkPhotoLightbox(${idx+1})" style="position:absolute;right:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.2);border:none;color:#fff;font-size:28px;border-radius:50%;width:44px;height:44px;cursor:pointer" ${idx===_wkPhotos.length-1?'disabled':''}>›</button>`;
  document.body.appendChild(ov);
}

// ── 사업소별 주요사항 ──
function wkHlGetNames() {
  const fromClients = allClients.map(c => c.name).filter(Boolean);
  const fromEntries = [...new Set(allEntries.map(e => e.institution).filter(Boolean))];
  return [...new Set([...fromClients, ...fromEntries])].sort((a,b)=>a.localeCompare(b,'ko'));
}
function wkHlSearch(q) {
  const drop = document.getElementById('wk-hl-drop');
  if (!q) { drop.style.display='none'; return; }
  const names = wkHlGetNames().filter(n => n.includes(q));
  if (!names.length) { drop.style.display='none'; return; }
  drop.innerHTML = names.slice(0,30).map(n =>
    `<div style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
      onmousedown="wkHlAddRow('${n.replace(/'/g,"\\'")}');document.getElementById('wk-hl-search').value='';wkHlCloseDrop()"
      onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background=''">${n}</div>`
  ).join('');
  drop.style.display = 'block';
}
function wkHlCloseDrop() {
  document.getElementById('wk-hl-drop').style.display = 'none';
}
function wkHlAddRow(name) {
  if (!name) return;
  const container = document.getElementById('wk-hl-rows');
  const id = 'hl-' + Date.now();
  const div = document.createElement('div');
  div.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px';
  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <span style="font-size:12px;font-weight:700;color:var(--green-dark);background:var(--green-light);padding:3px 10px;border-radius:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%" title="${name}">${name}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <select class="ss-select" data-hlf="status" onchange="wkHlSync()" style="font-size:12px;padding:3px 6px;min-width:64px">
          <option value="">상태</option>
          <option value="진행">진행</option>
          <option value="해결">해결</option>
          <option value="보류">보류</option>
        </select>
        <label style="cursor:pointer;padding:3px 8px;border:1px solid var(--border);border-radius:5px;font-size:13px;color:var(--text2);white-space:nowrap" title="사진 첨부">
          사진첨부
          <input type="file" multiple style="display:none" onchange="wkHlAddPhotos(this)"/>
        </label>
        <button class="btn-sm btn-ghost" style="padding:3px 8px;color:var(--text3);font-size:12px" onclick="this.closest('[data-inst]').remove();wkHlSync()">✕</button>
      </div>
    </div>
    <textarea class="form-textarea" placeholder="이슈 및 요청사항 입력..." style="width:100%;min-height:36px;font-size:13px;resize:none;overflow:hidden;box-sizing:border-box;margin:0" data-auto-min="36" data-hlf="issue" oninput="wkHlSync()"></textarea>
    <textarea class="form-textarea" placeholder="대응..." style="width:100%;min-height:36px;font-size:13px;resize:none;overflow:hidden;background:var(--bg2);box-sizing:border-box;margin:0" data-auto-min="36" data-hlf="response" oninput="wkHlSync()"></textarea>
`;
  div.dataset.inst = name;
  container.appendChild(div);
  wkAutoResizeTextareas(div);
  div.querySelector('textarea').focus();
  wkHlSync();
}
function wkHlSync() {
  const rows = [];
  document.querySelectorAll('#wk-hl-rows > div').forEach(div => {
    const inst = div.dataset.inst;
    const issue = div.querySelector('[data-hlf="issue"]')?.value || '';
    const response = div.querySelector('[data-hlf="response"]')?.value || '';
    const status = div.querySelector('[data-hlf="status"]')?.value || '';
    if (inst) rows.push(inst + '::' + issue + '@@' + response + '%%' + status);
  });
  document.getElementById('wk-highlights').value = rows.join('||');
}
function wkHlSerialize() {
  wkHlSync();
  return document.getElementById('wk-highlights').value;
}
function wkHlDeserialize(str) {
  const container = document.getElementById('wk-hl-rows');
  container.innerHTML = '';
  if (!str) return;
  str.split('||').forEach(part => {
    const idx = part.indexOf('::');
    if (idx < 0) return;
    const name = part.slice(0, idx);
    const rest = part.slice(idx + 2);
    const sepIdx = rest.indexOf('@@');
    const issue = sepIdx >= 0 ? rest.slice(0, sepIdx) : rest;
    const afterAt = sepIdx >= 0 ? rest.slice(sepIdx + 2) : '';
    const pctIdx = afterAt.indexOf('%%');
    const response = pctIdx >= 0 ? afterAt.slice(0, pctIdx) : afterAt;
    const status = pctIdx >= 0 ? afterAt.slice(pctIdx + 2) : '';
    wkHlAddRow(name);
    const last = container.lastElementChild;
    if (last) {
      const ta1 = last.querySelector('[data-hlf="issue"]'); if(ta1) ta1.value = issue;
      const ta2 = last.querySelector('[data-hlf="response"]'); if(ta2) ta2.value = response;
      const sel = last.querySelector('[data-hlf="status"]'); if(sel) sel.value = status;
      wkAutoResizeTextareas(last);
    }
  });
  wkHlSync();
}
document.addEventListener('click', e => {
  if (!e.target.closest('#wk-hl-search') && !e.target.closest('#wk-hl-drop')) wkHlCloseDrop();
});

function wkCalcNextTarget() {
  const n = parseInt(document.getElementById('wk-next-new')?.value) || 0;
  const d = parseInt(document.getElementById('wk-next-dormant')?.value) || 0;
  const e = parseInt(document.getElementById('wk-next-existing')?.value) || 0;
  const el = document.getElementById('wk-next-target-total');
  if (el) el.textContent = n + d + e;
}

function moCalcTargetVisit() {
  const n = parseInt(document.getElementById('mo-target-new')?.value) || 0;
  const d = parseInt(document.getElementById('mo-target-dormant')?.value) || 0;
  const e = parseInt(document.getElementById('mo-target-existing')?.value) || 0;
  const total = n + d + e;
  const totalEl = document.getElementById('mo-target-visit-total');
  if (totalEl) totalEl.textContent = total;
  const visitEl = document.getElementById('mo-target-visit');
  if (visitEl) visitEl.value = total;
}

function wkCalcKpi() {
  wkCalcVisit();
  const nt = parseInt(document.getElementById('wk-target-new-disp')?.textContent) || 0;
  const dt = parseInt(document.getElementById('wk-target-dormant-disp')?.textContent) || 0;
  const et = parseInt(document.getElementById('wk-target-existing-disp')?.textContent) || 0;
  const totalTarget = nt + dt + et;
  const totEl = document.getElementById('wk-visit-target-total');
  if (totEl) totEl.textContent = totalTarget > 0 ? totalTarget : '-';

  const totalActual = parseInt(document.getElementById('wk-visit-total')?.textContent) || 0;
  const n = parseInt(document.getElementById('wk-visit-new')?.value) || 0;
  const d = parseInt(document.getElementById('wk-visit-dormant')?.value) || 0;
  const e = parseInt(document.getElementById('wk-visit-existing')?.value) || 0;

  const setRate = (rateId, actual, target) => {
    const el = document.getElementById(rateId);
    if (el) el.textContent = target > 0 ? (actual/target*100).toFixed(1)+'%' : '-';
  };
  setRate('wk-kpi-visit-rate',    totalActual, totalTarget);
  setRate('wk-kpi-new-rate',      n, nt);
  setRate('wk-kpi-dormant-rate',  d, dt);
  setRate('wk-kpi-existing-rate', e, et);
}

function wkSaveReport() {
  const issues = [];
  document.querySelectorAll('#wk-issues-list > div').forEach(div => {
    const issue = div.querySelector('[data-wki="issue"]')?.value || '';
    const status = div.querySelector('[data-wki="status"]')?.value || '';
    const plan = div.querySelector('[data-wki="plan"]')?.value || '';
    if (issue) issues.push({ issue, status, plan });
  });
  const kpi = {};
  kpi.new      = { actual: 0 };
  kpi.dormant  = { actual: 0 };
  kpi.existing = { actual: 0 };
  kpi.visit    = { actual: 0 };
  const nextWeekTarget = {
    new:      parseInt(document.getElementById('wk-next-new')?.value) || 0,
    dormant:  parseInt(document.getElementById('wk-next-dormant')?.value) || 0,
    existing: parseInt(document.getElementById('wk-next-existing')?.value) || 0,
  };
  nextWeekTarget.total = nextWeekTarget.new + nextWeekTarget.dormant + nextWeekTarget.existing;
  const data = {
    id: _wkEditingId || ('wkr-' + Date.now()),
    title: document.getElementById('wk-title').value,
    schedule: document.getElementById('wk-schedule').value,
    market: document.getElementById('wk-market')?.value || '',
    highlights: wkHlSerialize(),
    notes: '',
    issues, kpi, nextWeekTarget,
    year: _wkYear, week: _wkWeekNum,
    person: currentUser.name, personId: currentUser.id,
    savedAt: new Date().toISOString(),
  };
  if (_wkEditingId) {
    const idx = allWeeklyReports.findIndex(r => r.id === _wkEditingId);
    if (idx >= 0) allWeeklyReports[idx] = data; else allWeeklyReports.push(data);
  } else {
    allWeeklyReports.push(data);
  }
  wkSaveReports();
  showToast('주간일지가 저장되었습니다.', 'success');
  wkCloseForm();
}

function wkDeleteReport(id) {
  if (!confirm('이 주간일지를 삭제하시겠습니까?')) return;
  allWeeklyReports = allWeeklyReports.filter(r => r.id !== id);
  wkSaveReports();
  wkRenderList();
}

// ════════════════════════════════════
// MONTHLY (월간일지)
// ════════════════════════════════════
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
    yearSel.innerHTML = [...years].sort((a,b)=>b-a).map(y=>`<option value="${y}"${y===cur?' selected':''}>${y}년</option>`).join('');
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
  tbody.innerHTML = '';
  if (countEl) countEl.textContent = `총 ${filtered.length}건`;
  if (!filtered.length) { if (empty) empty.style.display=''; return; }
  if (empty) empty.style.display='none';
  filtered.forEach((r, idx) => {
    const savedDate = r.savedAt ? r.savedAt.slice(5,10).replace('-','/') : '-';
    const reportId = escInlineJs(r.id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bbs-num">${filtered.length-idx}</td>
      <td class="bbs-td-title">${r.year}년 ${r.month}월 영업계획</td>
      <td>${r.year}/${String(r.month).padStart(2,'0')}</td>
      <td>${r.targetVisit||'-'}</td>
      <td>${r.targetSales ? Number(r.targetSales).toLocaleString()+'만' : '-'}</td>
      <td>${escHtml(r.person||'-')}</td>
      <td>${escHtml(savedDate)}</td>
    `;
    tr.onclick = () => moPlanOpenForm(r.id);
    const actTd = document.createElement('td');
    actTd.style.whiteSpace='nowrap';
    actTd.innerHTML = `<button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();moPlanOpenForm('${reportId}')">수정</button> <button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px;color:#e53935" onclick="event.stopPropagation();moDeleteReport('${reportId}');moPlanRenderList()">삭제</button>`;
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
    body.innerHTML = ''; _moPlanRowId = 0;
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
    body.innerHTML = ''; _moPlanRowId = 0; moAddPlanRows(3);
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
    yearSel.innerHTML = [...years].sort((a,b)=>b-a).map(y=>`<option value="${y}"${y===cur?' selected':''}>${y}년</option>`).join('');
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
  tbody.innerHTML = '';
  if (countEl) countEl.textContent = `총 ${filtered.length}건`;
  if (!filtered.length) { if (empty) empty.style.display=''; return; }
  if (empty) empty.style.display='none';
  filtered.forEach((r, idx) => {
    const visitRate = r.targetVisit>0 ? (r.visitActual/r.targetVisit*100).toFixed(0)+'%' : '-';
    const savedDate = r.savedAt ? r.savedAt.slice(5,10).replace('-','/') : '-';
    const reportId = escInlineJs(r.id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bbs-num">${filtered.length-idx}</td>
      <td class="bbs-td-title">${r.year}년 ${r.month}월 월간결산</td>
      <td>${r.year}/${String(r.month).padStart(2,'0')}</td>
      <td>${r.targetVisit||'-'}</td>
      <td>${r.visitActual||0}</td>
      <td style="font-weight:600;color:var(--green-dark)">${visitRate}</td>
      <td>${escHtml(r.person||'-')}</td>
      <td>${escHtml(savedDate)}</td>
    `;
    tr.onclick = () => moSettleOpenForm(r.id);
    const actTd = document.createElement('td');
    actTd.style.whiteSpace='nowrap';
    actTd.innerHTML = `<button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" onclick="event.stopPropagation();moSettleOpenForm('${reportId}')">수정</button> <button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px;color:#e53935" onclick="event.stopPropagation();moDeleteReport('${reportId}');moSettleRenderList()">삭제</button>`;
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

function moTab(tab) {
  document.getElementById('mo-plan').style.display = tab==='plan' ? '' : 'none';
  document.getElementById('mo-settle').style.display = tab==='settle' ? '' : 'none';
  document.getElementById('mo-tab-plan').className = 'btn-sm '+(tab==='plan'?'btn-primary':'btn-ghost');
  document.getElementById('mo-tab-settle').className = 'btn-sm '+(tab==='settle'?'btn-primary':'btn-ghost');
  if (tab==='settle') moCalcSettle();
}

function moAddPlanRow() {
  _moPlanRowId++;
  const rid = 'mpr'+_moPlanRowId;
  const tr = document.createElement('tr');
  tr.id = rid;
  tr.innerHTML = `
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
    <td><button class="ss-del" onclick="document.getElementById('${rid}').remove();moRenum()">×</button></td>
  `;
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

// ════════════════════════════════════
// ENTRY INPUT
// ════════════════════════════════════
function selDeal(v, el) {
  selectedDeal = v;
  document.querySelectorAll('.radio-btn').forEach(b => b.className = 'radio-btn');
  el.classList.add(v==='○'?'so':v==='△'?'sd':'sx');
}

async function submitEntry() {
  const date  = document.getElementById('f-date').value;
  const inst  = document.getElementById('f-institution').value.trim();
  const ct    = document.getElementById('f-clienttype').value;
  const meet  = document.getElementById('f-meeting').value.trim();
  if (!date || !inst || !ct || !meet) { showToast('필수 항목을 모두 입력해주세요.', 'error'); return; }
  const entry = {
    id: Date.now() + Math.random(), ts: new Date().toISOString(),
    person: currentUser.name, personId: currentUser.id,
    date, institution: inst, clientType: ct, meeting: meet,
    clientCode: document.getElementById('f-clientcode').value.trim(),
    issues: document.getElementById('f-issues').value.trim(),
    dealPossibility: selectedDeal || '△',
    sideBusiness: getSidebizValue(),
    ourPurchase: parseFloat(document.getElementById('f-our-purchase').value) || 0,
    otherPurchase: parseFloat(document.getElementById('f-other-purchase').value) || 0,
    contact: document.getElementById('f-contact').value.trim(),
    region: document.getElementById('f-region').value,
    gender: document.getElementById('f-gender').value,
    age: document.getElementById('f-age').value,
    floor: document.getElementById('f-floor').value,
    experience: document.getElementById('f-exp').value,
    revisitDate: document.getElementById('f-revisit-date').value || '',
  };
  allEntries.push(entry);
  setShared('sj-entries-v4', allEntries);
  // 재방문 예정일 자동 등록
  const rvDate = entry.revisitDate;
  if (rvDate) {
    const rv = { id: Date.now()+'rv', entryId: entry.id, institution: entry.institution, person: entry.person, personId: entry.personId, date: rvDate, done: false, createdAt: new Date().toISOString() };
    allRevisits.push(rv);
    setShared('sj-revisits', allRevisits);
  }
  // 거래처 자동 등록/업데이트
  await syncClientFromEntry(entry);
  clearDraft();
  ['f-institution','f-meeting','f-issues','f-sidebiz','f-our-purchase','f-other-purchase','f-contact','f-revisit-date','f-clientcode'].forEach(id => document.getElementById(id).value = '');
  ['f-clienttype','f-region','f-gender','f-age','f-floor','f-exp','f-sidebiz-sel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-sidebiz').style.display = 'none';
  selectedDeal = '';
  document.querySelectorAll('.radio-btn').forEach(b => b.className = 'radio-btn');
  showToast('영업일지가 저장되었습니다.', 'success');
  updateBadge();
}

// ════════════════════════════════════
