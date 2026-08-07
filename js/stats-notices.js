// STATS PAGE
// ════════════════════════════════════
function renderStats() {
  try {
    const basisMeta = getOrderBasisMeta();
    updateOrderBasisUI();
    // 채널(사업소/유통사)로 먼저 분리 — 사업소: 영업사원 실적, 유통사: 유통사 데이터만
    const channel = (typeof statsChannel !== 'undefined') ? statsChannel : 'office';
    const baseOrders = (allOrders || []).filter(o => orderChannel(o) === channel);
    // 영업사원 버튼 그룹 (해당 채널의 ERP 고객분류 도매(이름) 기준)
    const personNames = erpPersonNames(channel);
    const filterEl = document.getElementById('stats-person-filter');
    if (filterEl) {
      if (statsPersonId !== 'all' && !personNames.includes(statsPersonId)) statsPersonId = 'all';
      const personBtnLabel = channel === 'dist' ? '유통사' : '영업사원';
      const btns = [{id:'all', name:'전체 '+personBtnLabel}, ...personNames.map(n=>({id:n, name:n}))];
      filterEl.innerHTML = btns.map(b =>
        `<button type="button" class="stats-person-btn${statsPersonId===b.id?' active':''}" onclick="setStatsPerson('${escInlineJs(b.id)}')">${escHtml(b.name)}</button>`
      ).join('');
    }

    const useErp = baseOrders.length > 0;
    const personName = statsPersonId==='all' ? null : statsPersonId;
    // 기간 필터
    const dateFrom = document.getElementById('stats-date-from')?.value || '';
    const dateTo   = document.getElementById('stats-date-to')?.value || '';
    const inRange = d => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    const O = useErp
      ? baseOrders.filter(o => {
          if (statsPersonId !== 'all' && o.person !== personName) return false;
          if (!inRange(o.date||'')) return false;
          return true;
        })
      : [];

    // ── KPI: 매출 중심 (방문 데이터 제외) ──
    const totalSales = useErp
      ? Math.round(O.reduce((s,o)=>s+(parseFloat(o.supply)||0),0))
      : (statsPersonId==='all' ? allEntries : allEntries.filter(e=>e.personId===statsPersonId)).reduce((s,e)=>s+(e.ourPurchase||0),0);
    const totalQty = useErp ? O.reduce((s,o)=>s+(o.qty||0),0) : 0;
    const clientSet = new Set();
    O.forEach(o => { if (o.client) clientSet.add(o.client); });
    const avgOrder = O.length ? Math.round(totalSales/O.length) : 0;

    document.getElementById('stats-kpi-row').innerHTML = [
      {l:useErp?`매출 합계(${basisMeta.label})`:'당사 구매액', v:totalSales.toLocaleString()+'원', c:'var(--green-dark)'},
      {l:basisMeta.qtyLabel, v:useErp?totalQty.toLocaleString()+'개':'-', c:'var(--blue)'},
      {l:'거래처 수', v:clientSet.size+'개', c:'var(--amber)'},
      {l:`${basisMeta.action}당 평균`, v:useErp?avgOrder.toLocaleString()+'원':'-', c:'var(--green)'},
    ].map(({l,v,c})=>`<div class="kpi-card"><div class="kpi-accent" style="background:${c}"></div><div class="kpi-label">${l}</div><div class="kpi-value" style="color:${c};font-size:24px">${v}</div></div>`).join('');

    // ── 월별 매출 추이 ──
    const months = [];
    const currentYear = new Date().getFullYear();
    for (let i=0; i<12; i++) months.push({ y: currentYear, m: i, label: (i+1)+'월' });
    if (useErp) {
      const monthSales = months.map(m => {
        const ym = m.y+'-'+String(m.m+1).padStart(2,'0');
        return Math.round(baseOrders.filter(o => {
          if (statsPersonId !== 'all' && o.person !== personName) return false;
          return (o.date||'').startsWith(ym);
        }).reduce((s,o)=>s+(parseFloat(o.supply)||0),0));
      });
      if (typeof rc === 'function') rc('chart-stats-monthly','bar',months.map(m=>m.label),monthSales,'#E8900A');
      const subEl = document.getElementById('stats-chart-sub');
      if (subEl) subEl.textContent = `${basisMeta.label} ${currentYear}년 1~12월 매출(원)`;
    } else {
      if (typeof rc === 'function') rc('chart-stats-monthly','bar',months.map(m=>m.label),months.map(()=>0),'#E8900A');
      const subEl = document.getElementById('stats-chart-sub');
      if (subEl) subEl.textContent = 'ERP 데이터가 없습니다';
    }

    // ── 일별 매출/출고수량 ──
    let startDate, endDate;
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      endDate = new Date(dateTo);
    } else if (dateFrom) {
      startDate = new Date(dateFrom);
      endDate = new Date();
    } else if (dateTo) {
      startDate = new Date(new Date(dateTo).getFullYear(), new Date(dateTo).getMonth(), 1);
      endDate = new Date(dateTo);
    } else {
      const _now = new Date();
      startDate = new Date(_now.getFullYear(), _now.getMonth(), 1);
      endDate = new Date(_now.getFullYear(), _now.getMonth()+1, 0);
    }
    // 일별 차트는 월 전체(말일까지) 표시
    endDate = new Date(endDate.getFullYear(), endDate.getMonth()+1, 0);
    const DOW = ['일','월','화','수','목','금','토'];
    const dayMs = 86400000;
    const totalDays = Math.round((endDate - startDate) / dayMs) + 1;
    const dLabels=[], dSales=[], dQty=[], dColors=[], dDows=[];
    for (let i=0; i<totalDays; i++) {
      const dt = new Date(startDate.getTime() + i*dayMs);
      const ds = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
      const dow = dt.getDay();
      const mmdd = ds.slice(5);
      const hol = krHolidayName(ds), isRed = hol||dow===0||dow===6;
      // 라벨: 기간이 한 달 안이면 "일+요일", 더 길면 "월/일"
      const labelMain = totalDays > 31 ? (dt.getMonth()+1)+'/'+dt.getDate() : dt.getDate()+'일';
      dLabels.push([labelMain, DOW[dow]]);
      dDows.push(hol?'holiday':dow===0?'sun':dow===6?'sat':'weekday');
      dColors.push(isRed?'#D94040CC':'#2B72C8CC');
      const dayOrders = O.filter(o=>o.date===ds);
      dSales.push(Math.round(dayOrders.reduce((s,o)=>s+(parseFloat(o.supply)||0),0)));
      dQty.push(dayOrders.reduce((s,o)=>s+(o.qty||0),0));
    }
    const fmt = d => d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0');
    const periodLabel = (dateFrom||dateTo) ? `${fmt(startDate)} ~ ${fmt(endDate)}` : `${startDate.getFullYear()}년 ${startDate.getMonth()+1}월`;
    const personLabel = statsPersonId==='all' ? '(전체)' : '('+(personName||'')+')';
    const subSales = document.getElementById('stats-daily-sales-sub');
    const subQty = document.getElementById('stats-daily-qty-sub');
    if (subSales) subSales.textContent = periodLabel + ' ' + personLabel;
    if (subQty) subQty.textContent = periodLabel + ' ' + personLabel;
    if (typeof rcDaily === 'function') {
      rcDaily('chart-stats-daily-sales', dLabels, dSales, dColors, dDows);
      rcDaily('chart-stats-daily-qty', dLabels, dQty, dColors.map(c=>c.replace('#2B72C8','#43A047').replace('#D94040','#E8900A')), dDows);
    }

    if (typeof genReport === 'function') genReport(reportMode, null);
  } catch(e) { console.error('[renderStats]', e); }
}

function setStatsPerson(id, el) {
  statsPersonId = id;
  renderStats();
}

// 실적 분석 하위메뉴: 사업소 / 유통사 채널 전환
function showStatsChannel(channel, el) {
  statsChannel = (channel === 'dist') ? 'dist' : 'office';
  statsPersonId = 'all';
  showPage('stats', el, { route: statsChannel === 'dist' ? 'stats-dist' : 'stats-office' });
}

function genReport(mode, el) {
  reportMode = mode;
  if (el) { document.querySelectorAll('#report-week-btn,#report-month-btn').forEach(b=>b.classList.remove('active')); el.classList.add('active'); }
  const basisMeta = getOrderBasisMeta();
  const channel = (typeof statsChannel !== 'undefined') ? statsChannel : 'office';
  const baseOrders = (allOrders || []).filter(o => orderChannel(o) === channel);
  const personName = statsPersonId==='all' ? null : statsPersonId;
  const E = statsPersonId==='all' ? allEntries : allEntries.filter(e=>(allUsers.find(u=>u.id===e.personId)?.name)===personName);
  const useErp = baseOrders.length > 0;
  const O = useErp ? (statsPersonId==='all' ? baseOrders : baseOrders.filter(o=>o.person===personName)) : [];

  const now = new Date();
  let filtered, filteredO, periodLabel;
  if (mode==='week') {
    const sw = new Date(now); sw.setDate(now.getDate()-now.getDay()); sw.setHours(0,0,0,0);
    const swStr = ymdLocal(sw);
    filtered = E.filter(e=>new Date(e.date)>=sw);
    filteredO = O.filter(o=>(o.date||'')>=swStr);
    periodLabel = `${sw.getMonth()+1}/${sw.getDate()} ~ ${now.getMonth()+1}/${now.getDate()}`;
  } else {
    const ym = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    filtered = E.filter(e=>{const d=new Date(e.date);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});
    filteredO = O.filter(o=>(o.date||'').startsWith(ym));
    periodLabel = `${now.getFullYear()}년 ${now.getMonth()+1}월`;
  }
  const total = filtered.length;
  const dO = filtered.filter(e=>e.dealPossibility==='○').length;
  const dD = filtered.filter(e=>e.dealPossibility==='△').length;
  const dX = filtered.filter(e=>e.dealPossibility==='×').length;
  const sales = useErp
    ? Math.round(filteredO.reduce((s,o)=>s+(parseFloat(o.supply)||0),0)/10000)
    : filtered.reduce((s,e)=>s+(e.ourPurchase||0),0);
  const qty = useErp ? filteredO.reduce((s,o)=>s+(o.qty||0),0) : 0;
  const personLabel = statsPersonId==='all' ? '팀 전체' : statsPersonId;
  const regions = [...new Set(filtered.map(e=>e.region).filter(Boolean))];
  const modeLabel = mode==='week' ? '주간' : '월간';
  const divider = '─'.repeat(40);
  const visitList = filtered.slice(0,15).map((e,i) => {
    const sales_str = e.ourPurchase ? e.ourPurchase+'원' : '';
    return '  '+(i+1)+'. '+(e.institution||'-')+' ('+(e.dealPossibility||'-')+') '+sales_str;
  }).join('\n');
  const moreStr = filtered.length>15 ? '\n  ... 외 '+(filtered.length-15)+'건' : '';
  const regionStr = regions.length ? regions.join(', ') : '기록 없음';
  const avgSales = total ? Math.round(sales/total).toLocaleString() : 0;
  const dealPct = total ? Math.round(dO/total*100) : 0;

  // ERP 상위 거래처
  let erpTopStr = '';
  if (useErp && filteredO.length > 0) {
    const cm = {};
    filteredO.forEach(o=>{ if(o.client) cm[o.client]=(cm[o.client]||0)+(parseFloat(o.supply)||0); });
    const top5 = Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,5);
    erpTopStr = `\n【 ${basisMeta.label} 매출 TOP 5 거래처 】\n`
      + top5.map(([ name, amt ],i)=>`  ${i+1}. ${name} : ${Math.round(amt/10000).toLocaleString()}만원`).join('\n') + '\n';
  }

  const report = '📊 '+modeLabel+' 영업 보고서 ('+personLabel+')\n'
    + '기간: '+periodLabel+'\n'
    + divider+'\n\n'
    + '【 방문 현황 】\n'
    + '  총 방문: '+total+'건\n'
    + '  거래가능성 ○: '+dO+'건 ('+dealPct+'%)\n'
    + '  거래가능성 △: '+dD+'건\n'
    + '  거래가능성 ×: '+dX+'건\n\n'
    + '【 매출 현황 】\n'
    + (useErp
        ? `  ${basisMeta.label} 공급가 합계: ${sales.toLocaleString()}만원\n  ${basisMeta.qtyLabel}: ${qty.toLocaleString()}개\n`
        : `  당사 구매액 합계: ${sales.toLocaleString()}만원\n  방문당 평균: ${avgSales}만원\n`)
    + erpTopStr
    + '\n【 방문 지역 】\n'
    + '  '+regionStr+'\n\n'
    + '【 방문 거래처 목록 (일지 기준) 】\n'
    + visitList + moreStr;
  const reportBox = document.getElementById('report-box');
  if (reportBox) reportBox.textContent = report;
}

// ════════════════════════════════════
// REVISIT
// ════════════════════════════════════
function updateRevisitBadge() {
  const today = todayYmd();
  const upcoming = allRevisits.filter(r=>!r.done&&r.date>=today);
  const el = document.getElementById('revisit-badge');
  if (el) el.textContent = upcoming.length||'';
}

function renderRevisit() {
  const today = todayYmd();
  const d3 = new Date(); d3.setDate(d3.getDate()+3); const d3s = ymdLocal(d3);
  const eom = ymdLocal(new Date(new Date().getFullYear(),new Date().getMonth()+1,0));

  const fv = document.getElementById('rv-filter')?.value||'upcoming';
  let pool = isAdminUser(currentUser) ? [...allRevisits] : allRevisits.filter(r=>r.personId===currentUser?.id);
  if (fv==='upcoming') pool = pool.filter(r=>!r.done&&r.date>=today);
  else if (fv==='done') pool = pool.filter(r=>r.done);
  pool.sort((a,b)=>a.date.localeCompare(b.date));

  document.getElementById('rv-today-cnt').textContent = allRevisits.filter(r=>!r.done&&r.date===today).length;
  document.getElementById('rv-soon-cnt').textContent = allRevisits.filter(r=>!r.done&&r.date>today&&r.date<=d3s).length;
  document.getElementById('rv-month-cnt').textContent = allRevisits.filter(r=>!r.done&&r.date<=eom&&r.date>=today).length;

  document.getElementById('revisit-list').innerHTML = pool.length===0
    ? '<div style="padding:24px 0;text-align:center;color:var(--text3);font-size:13px">재방문 예정이 없습니다</div>'
    : pool.map(r=>{
        const isToday = r.date===today;
        const isSoon = r.date>today&&r.date<=d3s;
        const revisitId = escInlineJs(r.id);
        return `<div class="revisit-item">
          <div class="revisit-date ${isToday?'today':isSoon?'soon':''}">${escHtml(r.date)}</div>
          <div style="flex:1"><div class="revisit-inst">${escHtml(r.institution||'-')}</div><div class="revisit-person">${escHtml(r.person||'-')}</div></div>
          ${r.done?'<span style="font-size:11px;color:var(--text3)">완료</span>':`<button class="revisit-done-btn" onclick="doneRevisit('${revisitId}')">완료</button>`}
        </div>`;
      }).join('');
}

function doneRevisit(id) {
  const idx = allRevisits.findIndex(r=>r.id===id); if(idx<0)return;
  allRevisits[idx].done = true;
  setShared('sj-revisits', allRevisits);
  renderRevisit(); updateRevisitBadge();
  showToast('재방문 완료 처리됐습니다.', 'success');
}

// ════════════════════════════════════
// NOTICE
// ════════════════════════════════════
function getLatestNotice() {
  return [...(allNotices || [])].sort((a,b)=>((b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'')))[0];
}

function updateTopbarNotice() {
  const el = document.getElementById('topbar-latest-notice');
  if (!el) return;
  const latest = getLatestNotice();
  const title = latest?.title || '';
  el.textContent = title;
  el.title = title;
  el.dataset.noticeId = latest?.id || '';
}

function openTopbarLatestNotice() {
  const latest = getLatestNotice();
  showPage('notice');
  if (latest?.id) setTimeout(() => showNoticeDetail(latest.id), 0);
}
function saveNotice() {
  const title = document.getElementById('n-title').value.trim();
  const body  = document.getElementById('n-body').value.trim();
  const pin   = document.getElementById('n-pin').checked;
  if (!title||!body) { showToast('제목과 내용을 입력하세요.','error'); return; }
  const editId = document.getElementById('notice-edit-id').value;
  if (editId) {
    const idx = allNotices.findIndex(n=>n.id===editId);
    if (idx>=0) allNotices[idx] = {...allNotices[idx], title, body, pin, updatedAt: new Date().toISOString()};
  } else {
    allNotices.push({ id: Date.now()+'n', title, body, pin, author: currentUser?.name, createdAt: new Date().toISOString() });
  }
  allNotices.sort((a,b)=>(b.pin?1:0)-(a.pin?1:0));
  setShared('sj-notices', allNotices);
  document.getElementById('n-title').value=''; document.getElementById('n-body').value=''; document.getElementById('n-pin').checked=false; document.getElementById('notice-edit-id').value='';
  closeModal('modal-add-notice');
  renderNoticeManage(); renderNoticeView();
  showToast('공지사항이 저장됐습니다.', 'success');
}

function deleteNotice(id) {
  if (!confirm('공지사항을 삭제할까요?')) return;
  allNotices = allNotices.filter(n=>n.id!==id);
  setShared('sj-notices', allNotices);
  renderNoticeManage(); renderNoticeView();
  showToast('삭제됐습니다.', 'success');
}

function editNotice(id) {
  const n = allNotices.find(x=>x.id===id); if(!n)return;
  document.getElementById('notice-edit-id').value = n.id;
  document.getElementById('n-title').value = n.title;
  document.getElementById('n-body').value = n.body;
  document.getElementById('n-pin').checked = n.pin||false;
  openModal('modal-add-notice');
}

function renderNoticeManage() {
  const isAdmin = isAdminUser(currentUser);
  const listEl = document.getElementById('notice-manage-list');
  const detEl = document.getElementById('notice-detail');
  if (!listEl) return;
  const pinned = allNotices.filter(n=>n.pin).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const normal = allNotices.filter(n=>!n.pin).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const sorted = [...pinned, ...normal];
  const isNew = d => d && d.substring(0,10) >= ymdLocal(new Date(Date.now()-3*86400000));
  if (sorted.length === 0) {
    listEl.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text3)">등록된 공지사항이 없습니다.</div>';
    if (detEl) detEl.classList.remove('active');
    return;
  }
  listEl.innerHTML = `
    <table class="board-table">
      <thead><tr>
        <th style="width:60px">번호</th>
        <th>제목</th>
        <th style="width:80px">작성자</th>
        <th style="width:100px">작성일</th>
        ${isAdmin?'<th style="width:120px">관리</th>':''}
      </tr></thead>
      <tbody>
        ${sorted.map((n,i)=>{
          const id = escInlineJs(n.id);
          const title = escHtml(n.title);
          const author = escHtml(n.author || '관리자');
          const created = escHtml((n.createdAt||'').substring(0,10));
          return `<tr>
          <td style="color:var(--text3)">${n.pin?'<span style="color:var(--green-dark);font-weight:700">공지</span>':(sorted.length-i)}</td>
          <td onclick="showNoticeDetail('${id}')">${n.pin?'<span class="board-pin">고정</span>':''}${title}${isNew(n.createdAt)?'<span class="board-new">N</span>':''}</td>
          <td>${author}</td>
          <td>${created}</td>
          ${isAdmin?`<td>
            <button class="btn-sm btn-ghost" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();editNotice('${id}')">수정</button>
            <button class="btn-sm btn-danger" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();deleteNotice('${id}')">삭제</button>
          </td>`:''}
        </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  if (detEl) detEl.classList.remove('active');
}

function showNoticeDetail(id) {
  const n = allNotices.find(n=>String(n.id)===String(id)); if (!n) return;
  const isAdmin = isAdminUser(currentUser);
  const det = document.getElementById('notice-detail');
  if (!det) return;
  const noticeId = escInlineJs(n.id);
  det.innerHTML = `
    <div class="board-detail-title">${n.pin?'<span class="board-pin">고정</span>':''}${escHtml(n.title)}</div>
    <div class="board-detail-meta">작성자: ${escHtml(n.author||'관리자')} &nbsp;·&nbsp; ${escHtml((n.createdAt||'').substring(0,10))}</div>
    <div class="board-detail-body">${escHtml(n.body)}</div>
    <div style="margin-top:20px;display:flex;gap:8px;justify-content:flex-end">
      ${isAdmin?`<button class="btn-sm btn-ghost" onclick="editNotice('${noticeId}')">수정</button>
      <button class="btn-sm btn-danger" onclick="deleteNotice('${noticeId}')">삭제</button>`:''}
      <button class="btn-sm btn-ghost" onclick="this.closest('.board-detail').classList.remove('active')">닫기</button>
    </div>`;
  det.classList.add('active');
  det.scrollIntoView({behavior:'smooth', block:'nearest'});
}

// 호환성 (기존 코드에서 호출)
function renderNoticeView() { renderNoticeManage(); updateTopbarNotice(); }

// ════════════════════════════════════
