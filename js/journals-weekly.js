// WEEKLY (주간일지) — 게시판형
// ════════════════════════════════════
var allWeeklyReports = [];
var _wkYear = new Date().getFullYear();
var _wkWeekNum = getWeekNum(new Date());
var _wkIssueId = 0;
var _wkEditingId = null;
var _wkLoadedReportUserIds = [];
var _wkFiles = [];
var _wkReadOnly = false;
const WK_FILE_MAX_BYTES = 1024 * 1024;
const WK_FILE_TOTAL_MAX_BYTES = 3 * 1024 * 1024;

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

function wkHlClearSearch() {
  const search = document.getElementById('wk-hl-search');
  if (search) search.value = '';
  wkHlCloseDrop();
}

document.addEventListener('input', e => {
  if (e.target.matches('#wk-schedule,#wk-market,#wk-hl-rows textarea')) {
    wkAutoResizeTextarea(e.target);
  }
});

// 주차 기간은 목요일 시작 ~ 수요일 종료.
// 월 주차 표기는 해당 월 1일이 포함된 목~수 기간을 1주차로 본다.
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

function getWeeksInReportYear(year) {
  const jan1 = new Date(year, 0, 1);
  const firstThursday = getWeekStart(jan1);
  const nextJan1 = new Date(year + 1, 0, 1);
  const nextFirstThursday = getWeekStart(nextJan1);
  return Math.round((nextFirstThursday - firstThursday) / (7 * 86400000));
}

function getWeekStartFromNumber(year, week) {
  const jan1 = new Date(year, 0, 1);
  const firstThursday = getWeekStart(jan1);
  const start = new Date(firstThursday);
  start.setDate(firstThursday.getDate() + (week - 1) * 7);
  start.setHours(0,0,0,0);
  return start;
}

function getReportLabelMonth(start) {
  const monthWeekdays = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    monthWeekdays[key] = (monthWeekdays[key] || 0) + 1;
  }
  const entries = Object.entries(monthWeekdays).sort((a, b) => b[1] - a[1]);
  const labelKey = entries.find(([, count]) => count >= 3)?.[0] || entries[0]?.[0] || `${start.getFullYear()}-${start.getMonth()}`;
  const [labelYear, labelMonthIdx] = labelKey.split('-').map(Number);
  return { year: labelYear, monthIdx: labelMonthIdx };
}

function getReportWeekOfMonth(start, labelYear, labelMonthIdx) {
  const firstMonthDay = new Date(labelYear, labelMonthIdx, 1);
  let firstLabelWeekStart = getWeekStart(firstMonthDay);
  const firstLabelMonth = getReportLabelMonth(firstLabelWeekStart);
  if (firstLabelMonth.year !== labelYear || firstLabelMonth.monthIdx !== labelMonthIdx) {
    firstLabelWeekStart = new Date(firstLabelWeekStart);
    firstLabelWeekStart.setDate(firstLabelWeekStart.getDate() + 7);
  }
  return Math.floor((start - firstLabelWeekStart) / (7 * 86400000)) + 1;
}

function getWeekRange(year, week) {
  const start = getWeekStartFromNumber(year, week);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  const labelMonth = getReportLabelMonth(start);
  const labelYear = labelMonth.year;
  const labelMonthIdx = labelMonth.monthIdx;
  const weekOfMonth = getReportWeekOfMonth(start, labelYear, labelMonthIdx);
  const m = labelMonthIdx + 1;
  return {
    start, end,
    label: `${labelYear}\ub144 ${m}\uc6d4 ${weekOfMonth}\uc8fc\ucc28`,
    rangeLabel: `${fmt(start)}~${fmt(end)}`,
    fullLabel: `${labelYear}\ub144 ${m}\uc6d4 ${weekOfMonth}\uc8fc\ucc28 (${fmt(start)}~${fmt(end)})`
  };
}

function wkReportTitle(report, range) {
  const reportSuffix = '\uc8fc\uac04\uc5c5\ubb34\ubcf4\uace0';
  const autoTitle = `${range.fullLabel} ${reportSuffix}`;
  const savedTitle = String(report?.title || '').trim();
  const normalAutoPattern = /^\d{4}\ub144 \d{1,2}\uc6d4 \d+\uc8fc\ucc28 \([^)]+\) \uc8fc\uac04\uc5c5\ubb34\ubcf4\uace0$/;
  return !savedTitle || normalAutoPattern.test(savedTitle) ? autoTitle : savedTitle;
}

function wkReportStorageKey(userId) {
  return 'sj-weekly-reports-' + userId;
}

function wkReportOwnerId(report) {
  return report?.personId || currentUser?.id || 'unknown';
}

function wkCanManageReport(report) {
  if (!report) return false;
  return isAdminUser(currentUser) || wkReportOwnerId(report) === currentUser?.id;
}

function wkAllReportUserIds() {
  const ids = new Set();
  if (Array.isArray(allUsers)) allUsers.forEach(u => { if (u?.id) ids.add(u.id); });
  if (currentUser?.id) ids.add(currentUser.id);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const match = key && key.match(/^sj-weekly-reports-(.+)$/);
      if (match?.[1]) ids.add(match[1]);
    }
  } catch (_) {}
  return [...ids];
}

function wkLoadReports() {
  const byId = new Map();
  _wkLoadedReportUserIds = wkAllReportUserIds();
  _wkLoadedReportUserIds.forEach(userId => {
    const reports = getShared(wkReportStorageKey(userId), []);
    if (!Array.isArray(reports)) return;
    reports.forEach((report, idx) => {
      const normalized = { ...report, personId: report.personId || userId };
      const key = normalized.id || `${userId}:${normalized.year || ''}:${normalized.week || ''}:${idx}`;
      byId.set(key, normalized);
    });
  });
  allWeeklyReports = [...byId.values()];
}

function wkSaveReports() {
  if (!isAdminUser(currentUser)) {
    const ownReports = allWeeklyReports.filter(report => wkReportOwnerId(report) === currentUser?.id);
    setShared(wkReportStorageKey(currentUser.id), ownReports);
    return;
  }
  const byOwner = new Map(_wkLoadedReportUserIds.map(userId => [userId, []]));
  allWeeklyReports.forEach(report => {
    const ownerId = wkReportOwnerId(report);
    if (!byOwner.has(ownerId)) byOwner.set(ownerId, []);
    byOwner.get(ownerId).push(report);
  });
  byOwner.forEach((reports, userId) => setShared(wkReportStorageKey(userId), reports));
  _wkLoadedReportUserIds = [...byOwner.keys()];
}

function wkInit() {
  wkLoadReports();
  // 연도 필터 구성
  const yearSel = document.getElementById('wk-filter-year');
  if (yearSel) {
    const years = new Set([new Date().getFullYear()]);
    allWeeklyReports.forEach(r => years.add(r.year));
    const cur = parseInt(yearSel.value) || new Date().getFullYear();
    uiSetHtml(yearSel, [...years].sort((a, b) => b - a).map(y => `<option value="${y}"${y === cur ? ' selected' : ''}>${y}년</option>`).join(''));
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

  uiSetHtml(tbody, '');
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
    const canManage = wkCanManageReport(r);
    const tr = document.createElement('tr');
    uiSetHtml(tr, `
      <td class="bbs-num">${filtered.length - idx}</td>
      <td class="bbs-td-title">${escHtml(wkReportTitle(r, range))}${Array.isArray(r.attachments) && r.attachments.length ? ` <span style="color:var(--green-dark);font-size:11px;font-weight:700">📎 ${r.attachments.length}</span>` : ''}</td>
      <td>${escHtml(range.label)}</td>
      <td>${r.kpi?.visit?.actual ?? '-'}</td>
      <td>${r.kpi?.new?.actual ?? '-'}</td>
      <td style="font-weight:600;color:var(--green-dark)">${visitRate}</td>
      <td>${escHtml(r.person || '-')}</td>
      <td>${escHtml(savedDate)}</td>
    `);
    tr.style.cursor = 'pointer';
    tr.onclick = () => wkOpenForm(r.id);
    // 수정/삭제 버튼은 더블클릭 방지를 위해 마지막 셀에
    const actTd = document.createElement('td');
    actTd.style.cssText = 'white-space:nowrap';
    uiSetHtml(actTd, canManage ? `<button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  wkOpenForm(String(uiValues[0]));
}, [r.id])}>수정</button>
        <button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px;color:#e53935" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  wkDeleteReport(String(uiValues[0]));
}, [r.id])}>삭제</button>` : `<button class="btn-sm btn-ghost" style="padding:3px 8px;font-size:11px" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  wkOpenForm(String(uiValues[0]));
}, [r.id])}>열람</button>`);
    tr.appendChild(actTd);
    tbody.appendChild(tr);
  });
}

function wkOpenForm(id) {
  _wkEditingId = id || null;
  _wkIssueId = 0;
  _wkReadOnly = false;
  wkHlClearSearch();

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
  const loadPrevTarget = (year, week, personId = currentUser.id) => {
    let py = year, pw = week - 1;
    if (pw < 1) { py--; pw = 52; }
    const prev = allWeeklyReports.find(x =>
      x.year === py && x.week === pw &&
      x.personId === personId
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
    const readOnlyReport = !wkCanManageReport(r);
    _wkYear = r.year;
    _wkWeekNum = r.week;
    wkUpdateFormPeriod(false);
    setVal('wk-title', wkReportTitle(r, getWeekRange(r.year, r.week)));
    if (document.getElementById('wk-visit-total')) document.getElementById('wk-visit-total').textContent = 0;
    setVal('wk-schedule',   r.schedule);
    setVal('wk-market', r.market);
    wkHlDeserialize(r.highlights || '');
    _wkPhotos = []; _wkPhotoPage = 0; wkRenderPhotoGallery();
    _wkFiles = Array.isArray(r.attachments) ? r.attachments.map(wkNormalizeFile).filter(Boolean) : [];
    wkRenderFileList();
    // wk-notes removed
    // 차주 목표 복원
    setVal('wk-next-new',      r.nextWeekTarget?.new);
    setVal('wk-next-dormant',  r.nextWeekTarget?.dormant);
    setVal('wk-next-existing', r.nextWeekTarget?.existing);
    wkCalcNextTarget();
    const list = document.getElementById('wk-issues-list');
    if (list) uiSetHtml(list, '');
    loadPrevTarget(r.year, r.week, r.personId || currentUser.id);
    wkAutoCount();
    _wkReadOnly = readOnlyReport;
  } else {
    _wkYear = new Date().getFullYear();
    _wkWeekNum = getWeekNum(new Date());
    wkClearForm();
    wkUpdateFormPeriod(true);
    const list = document.getElementById('wk-issues-list');
    if (list) uiSetHtml(list, '');
    loadPrevTarget(_wkYear, _wkWeekNum, currentUser.id);
  }

  document.getElementById('wk-list-view').style.display = 'none';
  document.getElementById('wk-form-view').style.display = '';
  wkApplyReadOnly();
  requestAnimationFrame(() => wkAutoResizeTextareas(document.getElementById('wk-form-view')));
}

function wkCloseForm() {
  wkHlClearSearch();
  document.getElementById('wk-form-view').style.display = 'none';
  document.getElementById('wk-list-view').style.display = '';
  wkInit();
}

function wkClearForm() {
  wkHlClearSearch();
  ['wk-title','wk-next-new','wk-next-dormant','wk-next-existing','wk-schedule','wk-market','wk-highlights'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.value = ''; wkAutoResizeTextarea(el); }
  });
  const hlRows = document.getElementById('wk-hl-rows');
  if (hlRows) uiSetHtml(hlRows, '');
  const issueList = document.getElementById('wk-issues-list');
  if (issueList) uiSetHtml(issueList, '');
  const totN = document.getElementById('wk-next-target-total'); if (totN) totN.textContent = '0';
  ['visit','new','dormant','existing'].forEach(k => {
    const r = document.getElementById('wk-kpi-'+k+'-rate'); if (r) r.textContent = '-';
  });
  _wkPhotos = [];
  _wkPhotoPage = 0;
  wkRenderPhotoGallery();
  _wkFiles = [];
  wkRenderFileList();
  const fileInput = document.getElementById('wk-file-input');
  if (fileInput) fileInput.value = '';
  _wkReadOnly = false;
  wkApplyReadOnly();
}

function wkApplyReadOnly() {
  const form = document.getElementById('wk-form-view');
  if (!form) return;
  form.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.id === 'wk-filter-year') return;
    el.disabled = _wkReadOnly;
  });
  form.querySelectorAll('button, label').forEach(el => {
    if (el.id === 'wk-save-btn') {
      el.style.display = _wkReadOnly ? 'none' : '';
      return;
    }
    if (el.id === 'wk-prev-btn' || el.id === 'wk-next-btn') {
      el.disabled = _wkReadOnly;
      el.style.opacity = _wkReadOnly ? '.45' : '';
      return;
    }
    if (el.closest('.section-header') || el.textContent.includes('목록')) return;
    if (el.classList.contains('wk-readonly-keep')) return;
    el.style.display = _wkReadOnly ? 'none' : '';
  });
  const title = document.querySelector('#wk-form-view .section-title-lg');
  if (title) title.textContent = _wkReadOnly ? '📝 주간일지 열람' : '📝 주간일지 작성';
}

function wkFormPrev() {
  _wkWeekNum--;
  if (_wkWeekNum < 1) { _wkYear--; _wkWeekNum = getWeeksInReportYear(_wkYear); }
  wkUpdateFormPeriod(true);
}

function wkFormNext() {
  _wkWeekNum++;
  if (_wkWeekNum > getWeeksInReportYear(_wkYear)) { _wkYear++; _wkWeekNum = 1; }
  wkUpdateFormPeriod(true);
}

function wkUpdateFormPeriod(autoTitle) {
  const range = getWeekRange(_wkYear, _wkWeekNum);
  const periodEl = document.getElementById('wk-form-period');
  const subtitleEl = document.getElementById('wk-form-subtitle');
  if (periodEl) periodEl.textContent = range.fullLabel;
  if (subtitleEl) subtitleEl.textContent = range.rangeLabel + ' \uc8fc\uac04 \uc5c5\ubb34 \uc694\uc57d';
  if (subtitleEl) subtitleEl.textContent = range.rangeLabel + ' 주간 업무 요약';
  if (autoTitle) {
    const titleEl = document.getElementById('wk-title');
    if (titleEl) titleEl.value = range.fullLabel + ' 주간업무보고';
  }
  if (subtitleEl) subtitleEl.textContent = range.rangeLabel + ' \uc8fc\uac04 \uc5c5\ubb34 \uc694\uc57d';
  if (autoTitle) {
    const titleEl = document.getElementById('wk-title');
    if (titleEl) titleEl.value = wkReportTitle(null, range);
  }
  wkAutoCount();
}

function wkAutoCount() {
  const range = getWeekRange(_wkYear, _wkWeekNum);
  const startStr = ymdLocal(range.start);
  const endStr = ymdLocal(range.end);
  const weekEntries = (allEntries||[]).filter(e =>
    e.personId === currentUser.id && e.date >= startStr && e.date <= endStr
  );
  const visitEl = document.getElementById('wk-kpi-visit-actual');
  const newEl = document.getElementById('wk-kpi-new-actual');
  if (visitEl) visitEl.value = weekEntries.length;
  if (newEl) newEl.value = weekEntries.filter(e => e.clientType === '신규거래처').length;
  wkCalcKpi();
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

async function wkHlAddPhotos(input) {
  if (_wkReadOnly) return;
  const row = input.closest('[data-inst]');
  const inst = row ? row.dataset.inst : '';
  const files = Array.from(input.files);
  input.value = '';
  for (const file of files) {
    if (_wkPhotos.length >= 30 || file.size > WK_FILE_MAX_BYTES) {
      showToast('사진은 각 1MB 이하, 최대 30장까지 첨부할 수 있습니다.', 'error');
      continue;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (!securityFiles.imageUrl(dataUrl)) throw new Error('Invalid image');
      _wkPhotos.push({ dataUrl, name: file.name, inst });
    } catch (_) { showToast('유효한 PNG, JPG, GIF, WebP 사진만 첨부할 수 있습니다.', 'error'); }
  }
  _wkPhotoPage = Math.max(0, Math.floor((_wkPhotos.length - 1) / WK_PHOTOS_PER_PAGE));
  wkRenderPhotoGallery();
}

function wkRenderPhotoGallery() {
  const grid = document.getElementById('wk-photo-grid');
  const pager = document.getElementById('wk-photo-pager');
  if (!grid) return;
  const total = _wkPhotos.length;
  if (pager) pager.textContent = total ? total + '장' : '';
  if (!total) { uiSetHtml(grid, ''); return; }

  // 사업소별 그룹핑
  const groups = {};
  _wkPhotos.forEach((p, i) => {
    const key = p.inst || '(미분류)';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...p, idx: i });
  });

  uiSetHtml(grid, Object.entries(groups).map(([inst, photos]) => `
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--green-dark);background:var(--green-light);display:inline-block;padding:2px 10px;border-radius:20px;margin-bottom:6px">${escHtml(inst)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${photos.map(p => `
          <div style="position:relative;width:80px;height:80px;border-radius:6px;overflow:hidden;cursor:pointer;border:1px solid var(--border);flex-shrink:0"
            ${uiAction("click", function (event, uiValues) {
  wkPhotoLightbox(uiValues[0]);
}, [p.idx])}>
            <img src="${securityFiles.imageUrl(p.dataUrl)}" style="width:100%;height:100%;object-fit:cover" loading="lazy"/>
            ${_wkReadOnly ? '' : `<button ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  wkDeletePhoto(uiValues[0]);
}, [p.idx])}
              style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1;padding:0">✕</button>`}
          </div>`).join('')}
      </div>
    </div>`).join(''));
}

function wkDeletePhoto(idx) {
  if (_wkReadOnly) return;
  _wkPhotos.splice(idx, 1);
  if (_wkPhotoPage >= Math.ceil(_wkPhotos.length / WK_PHOTOS_PER_PAGE)) _wkPhotoPage = Math.max(0, _wkPhotoPage - 1);
  wkRenderPhotoGallery();
}

function wkPhotoLightbox(idx) {
  const p = _wkPhotos[idx];
  if (!p || !securityFiles.imageUrl(p.dataUrl)) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  ov.onclick = () => ov.remove();
  uiSetHtml(ov, `
    <div style="position:relative;display:inline-block">
      <img src="${securityFiles.imageUrl(p.dataUrl)}" style="max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:block"/>
      ${p.inst ? `<div style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,.6);color:#fff;font-size:14px;font-weight:700;padding:6px 14px;border-radius:7px;pointer-events:none">${escHtml(p.inst)}</div>` : ""}
    </div>
    <button ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  wkPhotoLightbox(uiValues[0]);
}, [idx - 1])} style="position:absolute;left:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.2);border:none;color:#fff;font-size:28px;border-radius:50%;width:44px;height:44px;cursor:pointer" ${idx === 0 ? 'disabled' : ''}>‹</button>
    <button ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  wkPhotoLightbox(uiValues[0]);
}, [idx + 1])} style="position:absolute;right:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.2);border:none;color:#fff;font-size:28px;border-radius:50%;width:44px;height:44px;cursor:pointer" ${idx === _wkPhotos.length - 1 ? 'disabled' : ''}>›</button>`);
  document.body.appendChild(ov);
}

// ── 일반 파일 첨부 ──
function wkNormalizeFile(file) {
  return securityFiles.attachment(file);
}

function wkFileTotalBytes(extra = 0) {
  return _wkFiles.reduce((sum, f) => sum + (parseInt(f.size, 10) || 0), 0) + extra;
}

function wkFormatFileSize(bytes) {
  const n = parseInt(bytes, 10) || 0;
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB';
  if (n >= 1024) return Math.round(n / 1024) + 'KB';
  return n + 'B';
}

async function wkAddFiles(input) {
  if (_wkReadOnly) return;
  const files = Array.from(input.files || []);
  if (!files.length) return;
  let accepted = 0;
  input.value = '';
  for (const file of files) {
    if (_wkFiles.length >= 30 || file.size > WK_FILE_MAX_BYTES || wkFileTotalBytes(file.size) > WK_FILE_TOTAL_MAX_BYTES) {
      showToast('파일은 각 1MB, 전체 3MB, 최대 30개까지 첨부할 수 있습니다.', 'error');
      continue;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const clean = wkNormalizeFile({ name: file.name, dataUrl });
      if (!clean || wkFileTotalBytes(clean.size) > WK_FILE_TOTAL_MAX_BYTES) throw new Error('Invalid attachment');
      _wkFiles.push(clean);
      accepted++;
    } catch (_) { showToast(`${file.name}: 지원하지 않거나 유효하지 않은 파일입니다.`, 'error'); }
  }
  wkRenderFileList();
  if (accepted) showToast(`첨부파일 ${accepted}개가 추가되었습니다.`, 'success');
}

function wkDeleteFile(idx) {
  if (_wkReadOnly) return;
  _wkFiles.splice(idx, 1);
  wkRenderFileList();
}

function wkRenderFileList() {
  const list = document.getElementById('wk-file-list');
  if (!list) return;
  if (!_wkFiles.length) {
    uiSetHtml(list, '<div style="font-size:12px;color:var(--text3);padding:8px 0">첨부된 파일이 없습니다.</div>');
    return;
  }
  uiSetHtml(list, _wkFiles.map((f, idx) => `
    <div style="display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);padding:8px 10px;min-width:0">
      <span style="font-size:15px">📄</span>
      <button type="button" ${uiAction('click', () => securityFiles.download(f))} style="flex:1;min-width:0;color:var(--text);font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;border:0;background:transparent;cursor:pointer" title="${escHtml(f.name)}">${escHtml(f.name)}</button>
      <span style="font-size:11px;color:var(--text3);font-family:var(--mono);white-space:nowrap">${wkFormatFileSize(f.size)}</span>
      ${_wkReadOnly ? '' : `<button class="btn-sm btn-ghost" style="padding:3px 8px;color:var(--red);font-size:12px" ${uiAction("click", function (event, uiValues) {
  wkDeleteFile(uiValues[0]);
}, [idx])}>삭제</button>`}
    </div>`).join(''));
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
  uiSetHtml(drop, names.slice(0, 30).map(n => `<div style="padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
      ${uiAction("mousedown", function (event, uiValues) {
  wkHlAddRow(String(uiValues[0]));
  document.getElementById('wk-hl-search').value = '';
  wkHlCloseDrop();
}, [n])}
      ${uiAction("mouseover", function (event, uiValues) {
  this.style.background = 'var(--hover)';
}, [])} ${uiAction("mouseout", function (event, uiValues) {
  this.style.background = '';
}, [])}>${escHtml(n)}</div>`).join(''));
  drop.style.display = 'block';
}
function wkHlCloseDrop() {
  const drop = document.getElementById('wk-hl-drop');
  if (drop) drop.style.display = 'none';
}
function wkHlAddRow(name) {
  if (_wkReadOnly) return;
  if (!name) return;
  const container = document.getElementById('wk-hl-rows');
  const id = 'hl-' + Date.now();
  const div = document.createElement('div');
  div.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px';
  uiSetHtml(div, `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <span style="font-size:12px;font-weight:700;color:var(--green-dark);background:var(--green-light);padding:3px 10px;border-radius:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%" title="${escHtml(name)}">${escHtml(name)}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <select class="ss-select" data-hlf="status" ${uiAction("change", function (event, uiValues) {
  wkHlSync();
}, [])} style="font-size:12px;padding:3px 6px;min-width:64px">
          <option value="">상태</option>
          <option value="진행">진행</option>
          <option value="해결">해결</option>
          <option value="보류">보류</option>
        </select>
        <label style="cursor:pointer;padding:3px 8px;border:1px solid var(--border);border-radius:5px;font-size:13px;color:var(--text2);white-space:nowrap" title="사진 첨부">
          사진첨부
          <input type="file" multiple style="display:none" ${uiAction("change", function (event, uiValues) {
  wkHlAddPhotos(this);
}, [])}/>
        </label>
        <button class="btn-sm btn-ghost" style="padding:3px 8px;color:var(--text3);font-size:12px" ${uiAction("click", function (event, uiValues) {
  this.closest('[data-inst]').remove();
  wkHlSync();
}, [])}>✕</button>
      </div>
    </div>
    <textarea class="form-textarea" placeholder="이슈 및 요청사항 입력..." style="width:100%;min-height:36px;font-size:13px;resize:none;overflow:hidden;box-sizing:border-box;margin:0" data-auto-min="36" data-hlf="issue" ${uiAction("input", function (event, uiValues) {
  wkHlSync();
}, [])}></textarea>
    <textarea class="form-textarea" placeholder="대응..." style="width:100%;min-height:36px;font-size:13px;resize:none;overflow:hidden;background:var(--bg2);box-sizing:border-box;margin:0" data-auto-min="36" data-hlf="response" ${uiAction("input", function (event, uiValues) {
  wkHlSync();
}, [])}></textarea>
`);
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
  wkHlClearSearch();
  const container = document.getElementById('wk-hl-rows');
  uiSetHtml(container, '');
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
  if (_wkReadOnly) {
    showToast('읽기 전용 주간일지는 저장할 수 없습니다.', 'error');
    return;
  }
  const existingReport = _wkEditingId ? allWeeklyReports.find(r => r.id === _wkEditingId) : null;
  if (existingReport && !wkCanManageReport(existingReport)) {
    showToast('다른 작성자의 주간일지는 저장할 수 없습니다.', 'error');
    return;
  }
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
    attachments: _wkFiles.map(wkNormalizeFile).filter(Boolean),
    notes: '',
    issues, kpi, nextWeekTarget,
    year: _wkYear, week: _wkWeekNum,
    person: existingReport?.person || currentUser.name,
    personId: existingReport?.personId || currentUser.id,
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
  const report = allWeeklyReports.find(r => r.id === id);
  if (!wkCanManageReport(report)) {
    showToast('다른 작성자의 주간일지는 삭제할 수 없습니다.', 'error');
    return;
  }
  if (!confirm('이 주간일지를 삭제하시겠습니까?')) return;
  allWeeklyReports = allWeeklyReports.filter(r => r.id !== id);
  wkSaveReports();
  wkRenderList();
}
