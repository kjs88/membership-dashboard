// CLIENT BULK UPLOAD
// ════════════════════════════════════
let pendingUploadData = [];

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processUploadFile(file);
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (file) processUploadFile(file);
  input.value = '';
}

function processUploadFile(file) {
  const errEl = document.getElementById('upload-err');
  errEl.style.display = 'none';
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = e => parseCSVUpload(e.target.result);
    reader.readAsText(file, 'UTF-8');
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = e => parseXLSXUpload(e.target.result);
    reader.readAsArrayBuffer(file);
  } else {
    errEl.textContent = '.csv, .xlsx, .xls 파일만 지원합니다.';
    errEl.style.display = 'block';
  }
}

function parseCSVUpload(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) { showUploadErr('데이터가 없습니다.'); return; }
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.replace(/"/g,'').trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
  showUploadPreview(rows, headers);
}

function parseXLSXUpload(buffer) {
  // SheetJS 없으면 CSV 안내
  showUploadErr('엑셀 파일은 CSV로 저장 후 업로드해 주세요.\n(엑셀 → 다른 이름으로 저장 → CSV UTF-8)');
}

function downloadClientSample() {
  const b64 = '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';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '거래처_업로드_샘플.xlsx';
  a.click();
  showToast('샘플 파일이 다운로드됩니다.', 'success');
}

function showUploadErr(msg) {
  const errEl = document.getElementById('upload-err');
  errEl.textContent = msg;
  errEl.style.display = 'block';
  document.getElementById('upload-preview-wrap').style.display = 'none';
  document.getElementById('upload-confirm-btn').style.display = 'none';
}

function showUploadPreview(rows, headers) {
  if (!rows.length) { showUploadErr('데이터 행이 없습니다.'); return; }
  pendingUploadData = rows;

  // 헤더 자동 매핑
  const colMap = detectColumns(headers);
  document.getElementById('upload-preview-title').textContent =
    `${rows.length}개 거래처 발견 · 미리보기 (최대 5행)`;

  const previewRows = rows.slice(0, 5);
  const dispCols = ['거래처코드','거래처명','지역','거래처유형','연락처'];
  document.getElementById('upload-preview-table').innerHTML =
    `<thead><tr style="background:var(--surface2)">${dispCols.map(c=>`<th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);border-bottom:1px solid var(--border)">${c}</th>`).join('')}</tr></thead>
    <tbody>${previewRows.map(r=>`<tr style="border-bottom:1px solid var(--border)">${dispCols.map(c=>{
      const key = colMap[c] || c;
      return `<td style="padding:6px 10px;font-size:11px;color:var(--text2)">${r[key]||'-'}</td>`;
    }).join('')}</tr>`).join('')}</tbody>`;

  document.getElementById('upload-preview-wrap').style.display = 'block';
  document.getElementById('upload-confirm-btn').style.display = 'inline-flex';
}

function detectColumns(headers) {
  // 헤더명 → 내부 필드 매핑
  const aliases = {
    '거래처코드': ['거래처코드','코드','CODE','code'],
    '거래처명': ['거래처명','기관명','업체명','NAME','name'],
    '지역': ['지역','REGION','region'],
    '거래처유형': ['거래처유형','유형','TYPE','type'],
    '거래가능성': ['거래가능성','가능성'],
    '연락처': ['연락처','전화','TEL','tel','phone'],
    '병행업종': ['병행업종','업종'],
    '당사구매액': ['당사구매액','당사월구매액','당사'],
    '타사구매액': ['타사구매액','타사월구매액','타사'],
    '담당자': ['담당자','담당영업사원','담당'],
    '메모': ['메모','비고','MEMO'],
  };
  const map = {};
  Object.entries(aliases).forEach(([field, keys]) => {
    const found = headers.find(h => keys.some(k => h.includes(k)));
    if (found) map[field] = found;
  });
  return map;
}

async function confirmClientUpload() {
  if (!pendingUploadData.length) return;
  const colMap = detectColumns(Object.keys(pendingUploadData[0]));
  const get = (row, field) => row[colMap[field]] || row[field] || '';

  let added = 0, updated = 0;
  pendingUploadData.forEach(row => {
    const code = get(row, '거래처코드').trim();
    const name = get(row, '거래처명').trim();
    if (!name && !code) return;

    const existing = allClients.find(c => (code && c.code === code) || (name && c.name === name));
    const data = {
      code: code || (existing ? existing.code : genClientCode()),
      name: name || (existing ? existing.name : ''),
      region: get(row, '지역'),
      clientType: get(row, '거래처유형'),
      dealPossibility: get(row, '거래가능성'),
      contact: get(row, '연락처'),
      sideBusiness: get(row, '병행업종'),
      ourPurchase: parseFloat(get(row, '당사구매액').replace(/[^0-9.]/g,'')) || 0,
      otherPurchase: parseFloat(get(row, '타사구매액').replace(/[^0-9.]/g,'')) || 0,
      assignedPerson: get(row, '담당자'),
      memo: get(row, '메모'),
      _modified: true,
    };

    if (existing) {
      const idx = allClients.indexOf(existing);
      allClients[idx] = { ...existing, ...data };
      updated++;
    } else {
      allClients.push({ id: Date.now() + Math.random() + 'c', createdAt: new Date().toISOString(), visitCount: 0, firstVisit: '', lastVisit: '', ...data });
      added++;
    }
  });

  const overrides = allClients.filter(c => c._modified || (c.code||'').startsWith('A'));
  setShared('sj-clients', overrides);
  updateClientBadge();
  closeModal('modal-client-upload');
  renderClients();
  pendingUploadData = [];
  document.getElementById('upload-preview-wrap').style.display = 'none';
  document.getElementById('upload-confirm-btn').style.display = 'none';
  showToast(`업로드 완료: 추가 ${added}건, 수정 ${updated}건`, 'success');
}


// ════════════════════════════════════
// CLIENT EXCEL IMPORT
// ════════════════════════════════════
async function importClientsFromFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const text = await file.text();
    parseAndImportClientCSV(text);
  } else {
    showToast('CSV 파일로 변환 후 업로드해 주세요. (엑셀 → 다른이름으로저장 → CSV)', 'error');
  }
}

function parseAndImportClientCSV(text) {
  // BOM 제거
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { showToast('데이터가 없습니다.', 'error'); return; }

  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  console.log('헤더:', headers);

  // 컬럼 매핑 (유연하게)
  const colMap = {
    code: headers.findIndex(h => h.includes('코드')),
    name: headers.findIndex(h => h.includes('거래처명') || h.includes('기관명') || h.includes('name')),
    region: headers.findIndex(h => h.includes('지역')),
    clientType: headers.findIndex(h => h.includes('유형')),
    dealPossibility: headers.findIndex(h => h.includes('가능성')),
    contact: headers.findIndex(h => h.includes('연락처') || h.includes('전화')),
    assignedPerson: headers.findIndex(h => h.includes('담당')),
    ourPurchase: headers.findIndex(h => h.includes('당사') && h.includes('구매')),
    otherPurchase: headers.findIndex(h => h.includes('타사') && h.includes('구매')),
    memo: headers.findIndex(h => h.includes('메모') || h.includes('비고')),
  };

  const nameIdx = colMap.name >= 0 ? colMap.name : 1;
  const codeIdx = colMap.code >= 0 ? colMap.code : 0;

  let added = 0, updated = 0, skipped = 0;
  const newOverrides = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g,'').trim());
    const name = cols[nameIdx];
    if (!name) { skipped++; continue; }

    const code = codeIdx >= 0 ? cols[codeIdx] : '';
    const existing = code ? allClients.find(c => c.code === code) : findClientByName(name);

    const data = {
      name,
      code: code || (existing ? existing.code : genClientCode()),
      region: colMap.region >= 0 ? cols[colMap.region] : '',
      clientType: colMap.clientType >= 0 ? cols[colMap.clientType] : '',
      dealPossibility: colMap.dealPossibility >= 0 ? cols[colMap.dealPossibility] : '',
      contact: colMap.contact >= 0 ? cols[colMap.contact] : '',
      assignedPerson: colMap.assignedPerson >= 0 ? cols[colMap.assignedPerson] : '',
      ourPurchase: colMap.ourPurchase >= 0 ? parseFloat(cols[colMap.ourPurchase])||0 : 0,
      otherPurchase: colMap.otherPurchase >= 0 ? parseFloat(cols[colMap.otherPurchase])||0 : 0,
      memo: colMap.memo >= 0 ? cols[colMap.memo] : '',
      _modified: true,
    };

    if (existing) {
      const idx = allClients.findIndex(c => c.id === existing.id);
      allClients[idx] = { ...existing, ...data };
      updated++;
    } else {
      allClients.push({ id: Date.now() + 'c' + i, createdAt: new Date().toISOString(), visitCount:0, firstVisit:'', lastVisit:'', ...data });
      added++;
    }
  }

  // 오버레이 저장 (setShared는 동기 함수)
  const overrides = allClients.filter(c => c._modified || (c.code||'').startsWith('A'));
  setShared('sj-clients', overrides);
  updateClientBadge();
  renderClients();
  showToast('업로드 완료 — 추가 ' + added + '개, 수정 ' + updated + '개, 건너뜀 ' + skipped + '개', 'success');
}

// ════════════════════════════════════
// CLIENT SEED MERGE
// ════════════════════════════════════
function mergeClientsWithSeed(overrides) {
  // 시드 DB를 기본으로, Firebase 오버레이로 수정/추가 반영
  const ov = overrides || allClients.filter(c => (c.code||'').startsWith('A') || c._modified);
  const ovMap = {};
  ov.forEach(c => { ovMap[c.code] = c; });

  // 시드 기반으로 시작
  const seedMap = {};
  CLIENT_SEED_DB.forEach(c => { seedMap[c.code] = {...c}; });

  // 오버레이 적용 (수정된 항목 덮어쓰기)
  ov.forEach(c => {
    if (c._deleted) {
      delete seedMap[c.code];
    } else {
      seedMap[c.code] = c;
    }
  });

  allClients = Object.values(seedMap);
}

// ════════════════════════════════════
// CLIENT MANAGEMENT
// ════════════════════════════════════
function genClientCode() {
  // 기존 DB 코드(S,P,D)와 충돌 피해 A 접두어로 신규 생성
  const aCodes = allClients.filter(c=>(c.code||'').startsWith('A'))
    .map(c => parseInt((c.code||'A0000').slice(1))||0);
  const next = aCodes.length ? Math.max(...aCodes) + 1 : 1;
  return 'A' + String(next).padStart(4, '0');
}

function updateClientBadge() {
  const el = document.getElementById('client-badge');
  if (el) el.textContent = allClients.length || '';
}

function normalizeClientName(name) {
  if (!name) return '';
  return name
    .replace(/^[NXHOB○◎△▽]+/, '')   // N, X, H, O, B 등 접두어 제거
    .replace(/\s*\([^)]*\)\s*/g, '') // 괄호 내용 제거
    .replace(/\s+/g, ' ')
    .trim();
}

function findClientByName(name) {
  if (!name) return null;
  // 1. 완전일치
  let found = allClients.find(c => c.name === name);
  if (found) return found;
  // 2. 정규화 후 일치
  const norm = normalizeClientName(name);
  found = allClients.find(c => normalizeClientName(c.name) === norm);
  if (found) return found;
  // 3. DB 이름이 entry 이름을 포함하거나 그 반대
  found = allClients.find(c => {
    const cn = normalizeClientName(c.name);
    return cn.includes(norm) || norm.includes(cn);
  });
  return found || null;
}

async function syncClientFromEntry(entry) {
  if (!entry.institution) return;
  const existing = findClientByName(entry.institution);
  if (existing) {
    // 기존 거래처 — 방문횟수·최신정보 업데이트 (프로필 필드는 비어있으면 기존값 유지, 채워져있으면 덮어씀)
    const idx = allClients.indexOf(existing);
    allClients[idx] = {
      ...existing,
      code: entry.clientCode || existing.code,
      lastVisit: entry.date,
      visitCount: (existing.visitCount||0) + 1,
      dealPossibility: entry.dealPossibility || existing.dealPossibility,
      contact: entry.contact || existing.contact,
      region: entry.region || existing.region,
      clientType: entry.clientType || existing.clientType,
      assignedPerson: entry.person || existing.assignedPerson,
      assignedPersonId: entry.personId || existing.assignedPersonId,
      sideBusiness: entry.sideBusiness || existing.sideBusiness,
      gender: entry.gender || existing.gender,
      age: entry.age || existing.age,
      floor: entry.floor || existing.floor,
      area: entry.area || existing.area,
      experience: entry.experience || existing.experience,
    };
  } else {
    // 신규 거래처 자동 등록
    allClients.push({
      id: Date.now() + 'c',
      code: entry.clientCode || genClientCode(),
      name: entry.institution,
      clientType: entry.clientType || '',
      dealPossibility: entry.dealPossibility || '',
      region: entry.region || '',
      contact: entry.contact || '',
      sideBusiness: entry.sideBusiness || '',
      gender: entry.gender || '',
      age: entry.age || '',
      floor: entry.floor || '',
      area: entry.area || '',
      experience: entry.experience || '',
      assignedPerson: entry.person || '',
      assignedPersonId: entry.personId || '',
      firstVisit: entry.date,
      lastVisit: entry.date,
      visitCount: 1,
      memo: '',
      createdAt: new Date().toISOString(),
    });
  }
  setShared('sj-clients', allClients);
  updateClientBadge();
}

function openAddClientModal() {
  document.getElementById('client-form-title').textContent = '거래처 추가';
  document.getElementById('cf-id').value = '';
  document.getElementById('cf-code').value = genClientCode();
  ['cf-name','cf-side','cf-contact','cf-memo'].forEach(id => document.getElementById(id).value = '');
  ['cf-type','cf-deal','cf-region','cf-person','cf-gender','cf-age','cf-floor','cf-area','cf-exp','cf-side-sel'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('cf-side').style.display = 'none';

  // 담당자 목록 채우기
  const sel = document.getElementById('cf-person');
  sel.innerHTML = '<option value="">선택</option>' + allUsers.filter(isSalesUserAccount).map(u=>`<option value="${escHtml(u.id)}">${escHtml(u.name)}</option>`).join('');
  openModal('modal-client-form');
}

function openEditClientModal(id) {
  const c = allClients.find(x=>x.id===id); if(!c)return;
  document.getElementById('client-form-title').textContent = '거래처 수정';
  document.getElementById('cf-id').value = c.id;
  document.getElementById('cf-code').value = c.code||'';
  document.getElementById('cf-name').value = c.name||'';
  document.getElementById('cf-type').value = c.clientType||'';
  document.getElementById('cf-deal').value = c.dealPossibility||'';
  // 병행업종 셀렉트 세팅
  (function(){ const v=c.sideBusiness||''; const s=document.getElementById('cf-side-sel'); const i=document.getElementById('cf-side'); const opts=[...s.options].map(o=>o.value||o.text); if(!v){s.value='';i.style.display='none';i.value='';} else if(opts.includes(v)){s.value=v;i.style.display='none';i.value=v;} else{s.value='__other__';i.style.display='';i.value=v;} })();
  document.getElementById('cf-region').value = c.region||'';
  document.getElementById('cf-contact').value = c.contact||'';

  document.getElementById('cf-gender').value = c.gender||'';
  document.getElementById('cf-age').value = c.age||'';
  document.getElementById('cf-floor').value = c.floor||'';
  document.getElementById('cf-area').value = c.area||'';
  document.getElementById('cf-exp').value = c.experience||'';
  document.getElementById('cf-memo').value = c.memo||'';
  const sel = document.getElementById('cf-person');
  sel.innerHTML = '<option value="">선택</option>' + allUsers.filter(isSalesUserAccount).map(u=>`<option value="${escHtml(u.id)}"${u.id===c.assignedPersonId?' selected':''}>${escHtml(u.name)}</option>`).join('');
  openModal('modal-client-form');
}

function saveClient() {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) { showToast('거래처명을 입력하세요.', 'error'); return; }
  const id = document.getElementById('cf-id').value;
  // 중복 이름 체크 (수정 시 본인 제외)
  const dup = findClientByName(name);
  if (dup && dup.id !== id) {
    if (!confirm(`'${dup.name}' (${dup.code}) 와 유사한 거래처가 이미 있습니다.\n계속 추가하시겠습니까?`)) return;
  }
  const personId = document.getElementById('cf-person').value;
  const personName = allUsers.find(u=>u.id===personId)?.name||'';
  const data = {
    name,
    code: document.getElementById('cf-code').value || genClientCode(),
    clientType: document.getElementById('cf-type').value,
    dealPossibility: document.getElementById('cf-deal').value,
    sideBusiness: document.getElementById('cf-side-sel').value==='__other__' ? document.getElementById('cf-side').value : document.getElementById('cf-side-sel').value,
    region: document.getElementById('cf-region').value,
    contact: document.getElementById('cf-contact').value,
    ourPurchase: 0,
    otherPurchase: 0,
    gender: document.getElementById('cf-gender').value,
    age: document.getElementById('cf-age').value,
    floor: document.getElementById('cf-floor').value,
    area: document.getElementById('cf-area').value,
    experience: document.getElementById('cf-exp').value,
    memo: document.getElementById('cf-memo').value,
    assignedPerson: personName,
    assignedPersonId: personId,
  };
  let clientToSave;
  if (id) {
    const idx = allClients.findIndex(c=>c.id===id);
    clientToSave = { ...allClients[idx], ...data, _modified: true };
    allClients[idx] = clientToSave;
  } else {
    clientToSave = { id: Date.now()+'c', createdAt: new Date().toISOString(), visitCount:0, firstVisit:'', lastVisit:'', _modified: true, ...data };
    allClients.push(clientToSave);
  }
  // Firebase엔 변경분(오버레이)만 저장
  const overrides = allClients.filter(c => c._modified || (c.code||'').startsWith('A'));
  setShared('sj-clients', overrides);
  closeModal('modal-client-form');
  renderClients(); updateClientBadge();
  showToast(id ? '거래처가 수정됐습니다.' : '거래처가 추가됐습니다.', 'success');
}

async function deleteClient(id) {
  if (!confirm('거래처를 삭제할까요? 연결된 방문 기록은 유지됩니다.')) return;
  const dc = allClients.find(c=>c.id===id);
  if (dc) {
    // 삭제 플래그로 오버레이에 기록
    const delRecord = {...dc, _deleted: true, _modified: true};
    allClients = allClients.filter(c=>c.id!==id);
    const overrides = [...allClients.filter(c=>c._modified||(c.code||'').startsWith('A')), delRecord];
    setShared('sj-clients', overrides);
  }
  closeModal('modal-client-detail');
  renderClients(); updateClientBadge();
  showToast('거래처가 삭제됐습니다.', 'success');
}

// 거래처 상세 - ERP 매출 탭 (allOrders에서 거래처명 일치분 집계)
function renderClientErpPanel(c) {
  const el = document.getElementById('cd-panel-erp');
  if (!el) return;
  const meta = (typeof getOrderBasisMeta === 'function') ? getOrderBasisMeta() : { label: '출고기준' };
  const rows = (typeof allOrders !== 'undefined' ? allOrders : []).filter(o => o.client === c.name);
  if (!rows.length) {
    el.innerHTML = `<div style="padding:28px;text-align:center;color:var(--text3)">이 거래처의 ERP 매출 데이터가 없습니다.<br><span style="font-size:11px">(${escHtml(meta.label)} · ERP 거래처명이 정확히 일치할 때 표시됩니다)</span></div>`;
    return;
  }
  const totSales = rows.reduce((s,o)=>s+(parseFloat(o.supply)||0),0);
  const totQty = rows.reduce((s,o)=>s+(o.qty||0),0);
  const dates = rows.map(o=>o.date).filter(Boolean).sort();
  const lastDate = dates[dates.length-1] || '-';
  const now = new Date();
  const months = [];
  for (let i=11;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); months.push({ym:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), label:(d.getMonth()+1)+'월'}); }
  const monthSales = months.map(m => rows.filter(o=>(o.date||'').startsWith(m.ym)).reduce((s,o)=>s+(parseFloat(o.supply)||0),0));
  const maxM = Math.max(1, ...monthSales);
  const barChart = months.map((m,i) => {
    const v = monthSales[i];
    const h = Math.round(v/maxM*60);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px">
      <div style="font-size:9px;color:var(--text3);font-family:var(--mono)">${v?Math.round(v/10000):''}</div>
      <div style="width:62%;height:${h}px;background:${v?'var(--blue)':'var(--border)'};border-radius:3px 3px 0 0;min-height:2px"></div>
      <div style="font-size:10px;color:var(--text3)">${m.label}</div>
    </div>`;
  }).join('');
  const pmap = {};
  rows.forEach(o => { const k=o.product||'(품명없음)'; if(!pmap[k]) pmap[k]={qty:0,sales:0}; pmap[k].qty+=(o.qty||0); pmap[k].sales+=(parseFloat(o.supply)||0); });
  const plist = Object.entries(pmap).map(([name,v])=>({name,qty:v.qty,sales:v.sales})).sort((a,b)=>b.sales-a.sales).slice(0,10);
  const prodTable = plist.map(p=>`<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:7px 10px;font-size:12px">${escHtml(p.name)}</td>
    <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:12px">${p.qty.toLocaleString()}</td>
    <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:12px;color:var(--green-dark);font-weight:600">${Math.round(p.sales).toLocaleString()}</td>
    <td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--blue)">${totSales?Math.round(p.sales/totSales*100):0}%</td>
  </tr>`).join('');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div class="detail-chip"><div class="detail-label">${escHtml(meta.label)} 총 매출</div><div class="detail-value" style="font-size:14px;color:var(--green-dark);font-weight:700">${Math.round(totSales).toLocaleString()}원</div></div>
      <div class="detail-chip"><div class="detail-label">총 수량</div><div class="detail-value" style="font-size:14px">${totQty.toLocaleString()}개</div></div>
      <div class="detail-chip"><div class="detail-label">최근 거래일</div><div class="detail-value" style="font-size:13px">${escHtml(lastDate)}</div></div>
    </div>
    <div class="detail-label" style="margin-bottom:6px">월별 매출 추이 <span style="font-weight:400;color:var(--text3)">(만원 · 최근 12개월)</span></div>
    <div style="display:flex;align-items:flex-end;gap:4px;height:92px;margin-bottom:18px;padding:0 4px">${barChart}</div>
    <div class="detail-label" style="margin-bottom:6px">품목별 매출 TOP 10</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>${['품목','수량','매출(원)','비중'].map((h,i)=>`<th style="padding:7px 10px;text-align:${i?'right':'left'};font-size:10px;font-weight:700;color:var(--text3);border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead>
      <tbody>${prodTable}</tbody>
    </table>`;
}

function openClientDetail(id) {
  const c = allClients.find(x=>String(x.id)===String(id)); if(!c)return;
  viewingClientId = id;
  document.getElementById('cd-code').textContent = c.code||'';
  document.getElementById('cd-name').textContent = c.name||'';
  const dc={'○':'do','△':'dd','×':'dx'};
  const tc={'기존 거래처':'te','신규거래처':'tn','휴면거래처':'td2','거래 재개':'tr2'};
  // 기본정보 탭
  document.getElementById('cd-panel-info').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      ${[
        {l:'거래처 코드', v:`<span style="font-family:var(--mono);font-weight:700;color:var(--green-dark)">${escHtml(c.code||'-')}</span>`},
        {l:'거래처 유형', v:c.clientType?`<span class="type-badge ${tc[c.clientType]||''}">${escHtml(c.clientType)}</span>`:'-'},
        {l:'거래 가능성', v:c.dealPossibility?`<span class="deal-badge ${dc[c.dealPossibility]||''}">${escHtml(c.dealPossibility)}</span>`:'-'},
        {l:'담당 영업사원', v:escHtml(c.assignedPerson||'-')},
        {l:'지역', v:escHtml(c.region||'-')},
        {l:'연락처', v:escHtml(c.contact||'-')},
        {l:'병행업종', v:escHtml(c.sideBusiness||'-')},
        {l:'업력', v:escHtml(c.experience||'-')},
        {l:'당사 월 구매액', v:c.ourPurchase?c.ourPurchase.toLocaleString()+'원':'-'},
        {l:'첫 방문일', v:escHtml(c.firstVisit||'-')},
        {l:'최근 방문일', v:escHtml(c.lastVisit||'-')},
        {l:'총 방문 횟수', v:`<strong style="color:var(--green-dark)">${c.visitCount||0}회</strong>`},
        {l:'성별/연령', v:escHtml((c.gender||'-')+'/'+(c.age||'-'))},
      ].map(({l,v})=>`<div class="detail-chip"><div class="detail-label">${l}</div><div class="detail-value" style="font-size:12px">${v}</div></div>`).join('')}
    </div>
    ${c.memo?`<div class="detail-section"><div class="detail-label">메모</div><div class="detail-value">${escHtml(c.memo)}</div></div>`:''}
  `;
  // 방문이력 탭
  const visits = allEntries.filter(e=>e.institution===c.name).sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById('cd-panel-visits').innerHTML = visits.length===0
    ? '<div style="padding:24px;text-align:center;color:var(--text3)">방문 이력이 없습니다</div>'
    : `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${['날짜','영업사원','거래가능성','구매액','미팅요약'].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.06em;border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead>
        <tbody>${visits.map(e=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:9px 10px;font-family:var(--mono);font-size:11px;color:var(--text3)">${escHtml(e.date)}</td>
          <td style="padding:9px 10px;font-weight:500;color:var(--text)">${escHtml(e.person||'-')}</td>
          <td style="padding:9px 10px"><span class="deal-badge ${dc[e.dealPossibility]||''}">${escHtml(e.dealPossibility||'-')}</span></td>
          <td style="padding:9px 10px;font-family:var(--mono);font-size:11px;color:var(--green-dark)">${e.ourPurchase?e.ourPurchase.toLocaleString()+'만':'-'}</td>
          <td style="padding:9px 10px;font-size:11px;color:var(--text2);max-width:180px">${escHtml((e.meeting||'').substring(0,40))}${e.meeting?.length>40?'…':''}</td>
        </tr>`).join('')}</tbody>
      </table>`;
  // ERP 매출 탭
  renderClientErpPanel(c);
  // 탭 초기화
  document.querySelectorAll('.client-detail-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.client-detail-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('.client-detail-tab').classList.add('active');
  document.getElementById('cd-panel-info').classList.add('active');
  openModal('modal-client-detail');
}

function switchClientTab(tab, el) {
  document.querySelectorAll('.client-detail-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.client-detail-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('cd-panel-'+tab).classList.add('active');
}

function editClientFromDetail() {
  closeModal('modal-client-detail');
  openEditClientModal(viewingClientId);
}

function deleteClientFromDetail() {
  deleteClient(viewingClientId);
}

// ── 거래처 페이지네이션 상태 ──
var _clientPage = 1;
var _clientPageSize = 30;
// _prodSortCol/_prodPage/_prodList/_gradePage/_gradeList → products-grades-erp.js로 이동

function renderPageBtns(cur, total, fnName) {
  if (total <= 1) return '';
  const btn = (n, label, disabled, active) =>
    `<button onclick="${fnName}(${n})" style="min-width:32px;height:30px;padding:0 8px;border-radius:5px;border:1px solid ${active?'var(--green)':'var(--border)'};background:${active?'var(--green)':'var(--surface)'};color:${active?'#fff':'var(--text2)'};font-size:12px;cursor:${disabled?'default':'pointer'};opacity:${disabled?0.4:1};font-family:var(--font)">${label}</button>`;
  let html = '';
  html += btn(cur-1, '‹', cur===1, false);
  const range = [];
  for (let i=1;i<=total;i++) {
    if (i===1||i===total||Math.abs(i-cur)<=2) range.push(i);
    else if (range[range.length-1]!=='…') range.push('…');
  }
  range.forEach(r => {
    if (r==='…') html += `<span style="padding:0 4px;color:var(--text3);line-height:30px">…</span>`;
    else html += btn(r, r, false, r===cur);
  });
  html += btn(cur+1, '›', cur===total, false);
  return html;
}

function prodGoPage(p) { _prodPage = p; prodRenderPage(); }
function gradeGoPage(p) { _gradePage = p; gradeRenderPage(); }
var _clientFilteredList = [];
var _clientSelectedIds = new Set(); // DOM 대신 Set으로 선택 상태 관리

function renderClients(resetPage) {
  if (resetPage !== false) _clientPage = 1;
  const q = (document.getElementById('client-search')?.value||'').toLowerCase();
  const fr = document.getElementById('client-filter-region')?.value||'';
  const ft = document.getElementById('client-filter-type')?.value||'';
  const fd = document.getElementById('client-filter-deal')?.value||'';

  let list = [...allClients];
  if (q) list = list.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.code||'').toLowerCase().includes(q)||(c.region||'').includes(q));
  if (fr) list = list.filter(c=>c.region===fr);
  if (ft) list = list.filter(c=>c.clientType===ft);
  if (fd) list = list.filter(c=>c.dealPossibility===fd);
  // 정렬
  const sortV = document.getElementById('client-sort')?.value || 'visits-desc';
  const sortFns = {
    'visits-desc': (a,b) => (b.visitCount||0)-(a.visitCount||0),
    'visits-asc':  (a,b) => (a.visitCount||0)-(b.visitCount||0),
    'last-desc':   (a,b) => (b.lastVisit||'').localeCompare(a.lastVisit||''),
    'last-asc':    (a,b) => (a.lastVisit||'').localeCompare(b.lastVisit||''),
    'first-desc':  (a,b) => (b.firstVisit||'').localeCompare(a.firstVisit||''),
    'first-asc':   (a,b) => (a.firstVisit||'').localeCompare(b.firstVisit||''),
    'name-asc':    (a,b) => (a.name||'').localeCompare(b.name||''),
  };
  list.sort(sortFns[sortV] || sortFns['visits-desc']);

  _clientFilteredList = list;
  window._filteredClients = list;

  const label = document.getElementById('client-count-label');
  if (label) label.textContent = `총 ${list.length}개 거래처`;

  const grid = document.getElementById('client-grid');
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text3)">거래처가 없습니다.</div>';
    updateClientActionBar();
    return;
  }

  const totalPages = Math.ceil(list.length / _clientPageSize);
  if (_clientPage > totalPages) _clientPage = totalPages;
  const start = (_clientPage - 1) * _clientPageSize;
  const pageList = list.slice(start, start + _clientPageSize);

  const dc={'○':'do','△':'dd','×':'dx'};
  const tc={'기존 거래처':'te','신규거래처':'tn','휴면거래처':'td2','거래 재개':'tr2'};

  // 현재 페이지의 모든 항목이 선택됐는지 확인
  const pageIds = pageList.map(c=>String(c.id));
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => _clientSelectedIds.has(id));
  const somePageSelected = pageIds.some(id => _clientSelectedIds.has(id));

  let html = `<table class="client-table">
    <thead><tr>
      <th style="width:36px;text-align:center">
        <input type="checkbox" id="cb-all" title="전체 선택" ${allPageSelected?'checked':''} onclick="event.stopPropagation()" onchange="toggleAllClients(this.checked)" />
      </th>
      <th>코드</th><th>거래처명</th><th>지역</th><th>유형</th>
      <th>거래가능성</th><th>담당자</th><th>당사구매액</th><th>방문횟수</th><th>최근방문</th><th>연락처</th>
    </tr></thead>
    <tbody>`;
  for (const c of pageList) {
    const cid = String(c.id);
    const clientId = escInlineJs(cid);
    const chk = _clientSelectedIds.has(cid) ? 'checked' : '';
    html += `<tr onclick="if(event.target.type==='checkbox')return;openClientDetail('${clientId}')">
      <td style="text-align:center"><input type="checkbox" class="client-row-cb" data-id="${escHtml(cid)}" ${chk} onclick="event.stopPropagation()" onchange="onClientCbChange('${clientId}',this.checked)" /></td>
      <td><span class="client-code-badge">${escHtml(c.code||'-')}</span></td>
      <td class="tm">${escHtml(c.name||'-')}</td>
      <td>${escHtml(c.region||'-')}</td>
      <td>${c.clientType?`<span class="type-badge ${tc[c.clientType]||''}">${escHtml(c.clientType)}</span>`:'-'}</td>
      <td>${c.dealPossibility?`<span class="deal-badge ${dc[c.dealPossibility]||''}">${escHtml(c.dealPossibility)}</span>`:'-'}</td>
      <td>${escHtml(c.assignedPerson||'-')}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--green-dark)">${c.ourPurchase?c.ourPurchase.toLocaleString()+'만':'-'}</td>
      <td style="font-family:var(--mono);text-align:center">${c.visitCount||0}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${escHtml(c.lastVisit||'-')}</td>
      <td style="font-size:11px">${escHtml(c.contact||'-')}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  // 페이지네이션 바
  if (totalPages > 1) {
    html += `<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px 0;font-size:13px;">`;
    html += `<button class="btn-sm btn-ghost" onclick="_clientPage=1;renderClients(false)" ${_clientPage<=1?'disabled':''} style="padding:5px 8px">«</button>`;
    html += `<button class="btn-sm btn-ghost" onclick="_clientPage--;renderClients(false)" ${_clientPage<=1?'disabled':''} style="padding:5px 8px">‹</button>`;
    // 페이지 번호
    let ps = Math.max(1, _clientPage-2), pe = Math.min(totalPages, _clientPage+2);
    if (ps > 1) html += `<span style="color:var(--text3)">…</span>`;
    for (let p=ps; p<=pe; p++) {
      html += `<button class="btn-sm ${p===_clientPage?'btn-primary':'btn-ghost'}" onclick="_clientPage=${p};renderClients(false)" style="padding:5px 10px;min-width:32px">${p}</button>`;
    }
    if (pe < totalPages) html += `<span style="color:var(--text3)">…</span>`;
    html += `<button class="btn-sm btn-ghost" onclick="_clientPage++;renderClients(false)" ${_clientPage>=totalPages?'disabled':''} style="padding:5px 8px">›</button>`;
    html += `<button class="btn-sm btn-ghost" onclick="_clientPage=${totalPages};renderClients(false)" ${_clientPage>=totalPages?'disabled':''} style="padding:5px 8px">»</button>`;
    html += `<span style="margin-left:10px;color:var(--text3);font-size:11px">${start+1}-${Math.min(start+_clientPageSize,list.length)} / ${list.length}</span>`;
    html += `</div>`;
  }

  grid.innerHTML = html;
  // indeterminate 상태는 JS로만 설정 가능
  const cbAll = document.getElementById('cb-all');
  if (cbAll) cbAll.indeterminate = !allPageSelected && somePageSelected;
  updateClientActionBar();
}

function toggleAllClients(checked) {
  // 현재 필터된 전체 목록의 ID를 한번에 추가/제거
  for (const c of _clientFilteredList) {
    const cid = String(c.id);
    if (checked) _clientSelectedIds.add(cid);
    else _clientSelectedIds.delete(cid);
  }
  // 현재 페이지 체크박스만 DOM 업데이트
  document.querySelectorAll('.client-row-cb').forEach(cb => { cb.checked = checked; });
  const cbAll = document.getElementById('cb-all');
  if (cbAll) { cbAll.checked = checked; cbAll.indeterminate = false; }
  updateClientActionBar();
}

function onClientCbChange(cid, checked) {
  if (checked) _clientSelectedIds.add(cid);
  else _clientSelectedIds.delete(cid);
  // 헤더 체크박스 상태 업데이트
  const cbs = document.querySelectorAll('.client-row-cb');
  const checkedCount = document.querySelectorAll('.client-row-cb:checked').length;
  const cbAll = document.getElementById('cb-all');
  if (cbAll) {
    cbAll.checked = cbs.length > 0 && checkedCount === cbs.length;
    cbAll.indeterminate = checkedCount > 0 && checkedCount < cbs.length;
  }
  updateClientActionBar();
}

function updateClientActionBar() {
  const count = _clientSelectedIds.size;
  const bar = document.getElementById('client-action-bar');
  const label = document.getElementById('client-selected-label');
  if (bar) bar.classList.toggle('show', count > 0);
  if (label) label.textContent = count + '개 선택됨';
  const delBtn = document.getElementById('client-delete-btn');
  if (delBtn) delBtn.style.display = (count > 0 && isAdminUser(currentUser)) ? '' : 'none';
}

function clearClientSelection() {
  _clientSelectedIds.clear();
  document.getElementById('cb-all')&&(document.getElementById('cb-all').checked=false,document.getElementById('cb-all').indeterminate=false);
  document.querySelectorAll('.client-row-cb').forEach(cb => { cb.checked = false; });
  updateClientActionBar();
}

function getSelectedClientIds() {
  return [..._clientSelectedIds];
}

function exportSelectedClients() {
  const ids = getSelectedClientIds();
  if (!ids.length) { showToast('선택된 거래처가 없습니다.', 'error'); return; }
  const selected = allClients.filter(c => ids.includes(String(c.id)));
  const cols = ['거래처코드','거래처명','거래처유형','거래가능성','지역','연락처','담당영업사원','병행업종','당사구매액(원)','타사구매액(원)','총방문횟수','최근방문일','메모'];
  const rows = selected.map(c=>[c.code,c.name,c.clientType,c.dealPossibility,c.region,c.contact,c.assignedPerson,c.sideBusiness,c.ourPurchase,c.otherPurchase,c.visitCount,c.lastVisit,c.memo]);
  const csv = [cols,...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `거래처_선택_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast(selected.length + '개 거래처가 다운로드됩니다.', 'success');
}

function deleteSelectedClients() {
  const ids = getSelectedClientIds();
  if (!ids.length) return;
  if (!confirm(ids.length + '개 거래처를 삭제하시겠습니까?')) return;
  // 단건 삭제(deleteClient)와 동일하게 _deleted 오버레이로 영구 반영
  const delRecords = [];
  ids.forEach(id => {
    const dc = allClients.find(c => String(c.id) === id);
    if (dc) delRecords.push({ ...dc, _deleted: true, _modified: true });
    const idx = allClients.findIndex(c => String(c.id) === id);
    if (idx !== -1) allClients.splice(idx, 1);
  });
  const overrides = [...allClients.filter(c => c._modified || (c.code||'').startsWith('A')), ...delRecords];
  setShared('sj-clients', overrides);
  _clientSelectedIds.clear();
  renderClients();
  updateClientBadge();
  showToast(ids.length + '개 거래처가 삭제되었습니다.', 'success');
}

function exportClients() {
  const cols = ['거래처코드','거래처명','거래처유형','거래가능성','지역','연락처','담당영업사원','병행업종','당사구매액(원)','타사구매액(원)','총방문횟수','첫방문일','최근방문일','업력','메모'];
  const rows = allClients.map(c=>[c.code,c.name,c.clientType,c.dealPossibility,c.region,c.contact,c.assignedPerson,c.sideBusiness,c.ourPurchase,c.otherPurchase,c.visitCount,c.firstVisit,c.lastVisit,c.experience,c.memo]);
  const csv = [cols,...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `거래처목록_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('거래처 목록이 다운로드됩니다.', 'success');
}

// ════════════════════════════════════
