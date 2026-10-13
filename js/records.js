// ════════════════════════════════════
// TABLE
// ════════════════════════════════════
function tbl(entries, showActions) {
  if (!entries.length) return '<div class="empty-state"><div style="font-size:28px;margin-bottom:8px">📋</div>기록이 없습니다</div>';
  const dc={'○':'do','△':'dd','×':'dx'};
  const tc={'기존 거래처':'te','신규거래처':'tn','휴면거래처':'td2','거래 재개':'tr2'};
  const isAdmin = isAdminUser(currentUser);
  return `<table><thead><tr><th>날짜</th><th>영업사원</th><th>기관명</th><th>유형</th><th>거래가능성</th><th>구매액</th><th>지역</th><th>미팅 요약</th>${isAdmin&&showActions?'<th>관리</th>':''}</tr></thead><tbody>`+
  entries.map(e=>{
    const entryId = escInlineJs(e.id);
    const meeting = String(e.meeting || '');
    return `<tr style="cursor:pointer" ${uiAction("click", function (event, uiValues) {
  openDetail(String(uiValues[0]));
}, [e.id])}>
    <td style="white-space:nowrap;font-family:var(--mono);font-size:11px;color:var(--text3)">${escHtml(e.date || '')}</td>
    <td class="tm">${escHtml(e.person || '-')}</td>
    <td class="tm" style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(e.institution || '-')}</td>
    <td><span class="type-badge ${tc[e.clientType] || ''}">${escHtml(e.clientType || '-')}</span></td>
    <td><span class="deal-badge ${dc[e.dealPossibility] || ''}">${escHtml(e.dealPossibility || '-')}</span></td>
    <td style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--green-dark)">${e.ourPurchase ? e.ourPurchase.toLocaleString() + '만' : '-'}</td>
    <td>${escHtml(e.region || '-')}</td>
    <td style="max-width:180px;font-size:11px">${escHtml(meeting.substring(0, 50))}${meeting.length > 50 ? '…' : ''}</td>
    ${isAdmin && showActions ? `<td><div class="action-btns"><button class="btn-icon" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  openEditEntry(String(uiValues[0]));
}, [e.id])}>✎</button><button class="btn-icon del" ${uiAction("click", function (event, uiValues) {
  event.stopPropagation();
  deleteEntry(String(uiValues[0]));
}, [e.id])}>✕</button></div></td>` : ''}
  </tr>`;
  }).join('')+'</tbody></table>';
}

function renderRecords() {
  const q  = (document.getElementById('search-input').value||'').toLowerCase();
  const fp = document.getElementById('filter-person').value;
  const fd = document.getElementById('filter-deal').value;

  // non-admin sees only own entries
  let pool = isAdminUser(currentUser) ? [...allEntries] : allEntries.filter(e=>e.personId===currentUser?.id);
  let f = pool.sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  if (q) f = f.filter(e=>(e.institution||'').toLowerCase().includes(q)||(e.person||'').toLowerCase().includes(q));
  if (fp) f = f.filter(e=>e.person===fp);
  if (fd) f = f.filter(e=>e.dealPossibility===fd);
  const fr = document.getElementById('filter-region')?.value||'';
  const fd1 = document.getElementById('filter-date-from')?.value||'';
  const fd2 = document.getElementById('filter-date-to')?.value||'';
  if (fr) f = f.filter(e=>e.region===fr);
  if (fd1) f = f.filter(e=>e.date>=fd1);
  if (fd2) f = f.filter(e=>e.date<=fd2);

  const persons = [...new Set(pool.map(e=>e.person).filter(Boolean))];
  const sel = document.getElementById('filter-person'), cur = sel.value;
  uiSetHtml(sel, '<option value="">전체 영업사원</option>' + persons.map(p => `<option value="${escHtml(p)}"${p === cur ? ' selected' : ''}>${escHtml(p)}</option>`).join(''));
  uiSetHtml(document.getElementById('records-table-wrap'), tbl(f, true));
}

// ════════════════════════════════════
// ADMIN: ENTRY CRUD
// ════════════════════════════════════
function openEditEntry(id) {
  const e = allEntries.find(x=>String(x.id)===String(id)); if(!e)return;
  editingEntryId = e.id;
  document.getElementById('edit-entry-id').value = e.id;
  document.getElementById('e-institution').value = e.institution||'';
  document.getElementById('e-date').value = e.date||'';
  document.getElementById('e-meeting').value = e.meeting||'';
  document.getElementById('e-issues').value = e.issues||'';
  document.getElementById('e-deal').value = e.dealPossibility||'△';
  document.getElementById('e-sales').value = e.ourPurchase||0;
  openModal('modal-edit-entry');
}
async function saveEditEntry() {
  const idx = allEntries.findIndex(x=>String(x.id)===String(editingEntryId)); if(idx<0)return;
  allEntries[idx] = { ...allEntries[idx],
    institution: document.getElementById('e-institution').value,
    date: document.getElementById('e-date').value,
    meeting: document.getElementById('e-meeting').value,
    issues: document.getElementById('e-issues').value,
    dealPossibility: document.getElementById('e-deal').value,
    ourPurchase: parseFloat(document.getElementById('e-sales').value)||0,
  };
  setShared('sj-entries-v4', allEntries);
  closeModal('modal-edit-entry');
  renderRecords(); renderDashboard();
  showToast('수정되었습니다.', 'success');
}
async function deleteEntry(id) {
  if (!confirm('이 일지를 삭제할까요?')) return;
  allEntries = allEntries.filter(x=>String(x.id)!==String(id));
  setShared('sj-entries-v4', allEntries);
  renderRecords(); renderDashboard(); updateBadge();
  showToast('삭제되었습니다.', 'success');
}
function downloadDailyEntriesExcel() {
  const isAdmin = isAdminUser(currentUser);
  const rowsSource = isAdmin
    ? [...(allEntries || [])]
    : (allEntries || []).filter(entry => entry.personId === currentUser?.id);

  if (!rowsSource.length) {
    showToast('다운로드할 일간일지 기록이 없습니다.', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    return;
  }

  const rows = rowsSource
    .slice()
    .sort((a, b) => {
      const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateDiff) return dateDiff;
      return String(b.ts || '').localeCompare(String(a.ts || ''));
    })
    .map((entry, index) => ({
      '번호': index + 1,
      '날짜': entry.date || '',
      '영업사원': entry.person || '',
      '기관명': entry.institution || '',
      '거래처코드': entry.clientCode || '',
      '거래처유형': entry.clientType || '',
      '참석자': entry.attendee || '',
      '거래가능성': entry.dealPossibility || '',
      '미팅내용': entry.meeting || '',
      '이슈사항': entry.issues || '',
      '연락처': entry.contact || '',
      '겸업/부업': entry.sideBusiness || '',
      '지역': entry.region || '',
      '성별': entry.gender || '',
      '나이': entry.age || '',
      '층수': entry.floor || '',
      '면적': entry.area || '',
      '경력': entry.experience || '',
      '구매액': Number(entry.ourPurchase || 0),
      '작성일시': entry.ts || '',
      '기록ID': entry.id || '',
    }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 46 }, { wch: 46 },
    { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 22 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '일간일지 전체기록');
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('') + '_' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  XLSX.writeFile(workbook, `일간일지_전체기록_${stamp}.xlsx`);
  showToast('일간일지 전체 기록 엑셀 파일이 다운로드됩니다.', 'success');
}
