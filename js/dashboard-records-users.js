// DASHBOARD
// ════════════════════════════════════
function setDashFilter(f, el) {
  dashFilter = f;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderDashboard();
}

function filterEntries(entries) {
  const now = new Date();
  if (dashFilter === 'month') {
    return entries.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }
  if (dashFilter === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    return entries.filter(e => new Date(e.date) >= startOfWeek);
  }
  return entries;
}

function renderDashboard() {
  const salesActive = document.getElementById('page-sales')?.classList.contains('active');
  const dashActive  = document.getElementById('page-dash')?.classList.contains('active');
  if (salesActive) renderSalesPage();
  if (dashActive)  renderDashPage();
}

function renderSalesPage() {
  const fmtYmd = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const now = new Date();
  const today = fmtYmd(now);
  const yDate = new Date(now);
  yDate.setDate(now.getDate() - 1);
  const yesterday = fmtYmd(yDate);
  const ym = today.slice(0,7);
  const monthStart = ym + '-01';
  const basisMeta = getOrderBasisMeta();
  const monthEntries = allEntries.filter(e => e.date?.startsWith(ym));
  const todayEntries = allEntries.filter(e => e.date === today);
  const yesterdayEntries = allEntries.filter(e => e.date === yesterday);
  const erpMonth = allOrders.filter(e => {
    const d = e.date || '';
    return d >= monthStart && d <= today;
  });
  const useErpForCharts = erpMonth.length > 0;
  const rankSub = document.getElementById('sh-rank-sub');
  if (rankSub) rankSub.textContent = useErpForCharts ? `${basisMeta.label} 공급가 기준 (원)` : '당사 구매액 기준 (원)';
  const personSub = document.getElementById('sh-person-sub');
  if (personSub) personSub.textContent = useErpForCharts ? `이번달 ${basisMeta.label} 공급가 기준 (원)` : '이번달 당사 구매액 기준 (원)';
  const monthSales = useErpForCharts
    ? Math.round(erpMonth.reduce((s,e) => s+(parseFloat(e.supply)||0),0))
    : monthEntries.reduce((s,e) => s+(e.ourPurchase||0),0);
  const erpToday = allOrders.filter(e => e.date===today);
  const todaySales = erpToday.length > 0
    ? Math.round(erpToday.reduce((s,e)=>s+(parseFloat(e.supply)||0),0))
    : todayEntries.reduce((s,e)=>s+(e.ourPurchase||0),0);
  const erpYest = allOrders.filter(e => e.date===yesterday);
  const yesterdaySales = erpYest.length > 0
    ? Math.round(erpYest.reduce((s,e)=>s+(parseFloat(e.supply)||0),0))
    : yesterdayEntries.reduce((s,e)=>s+(e.ourPurchase||0),0);
  const prevM = new Date(); prevM.setMonth(prevM.getMonth()-1);
  const prevYm = prevM.getFullYear()+'-'+String(prevM.getMonth()+1).padStart(2,'0');
  const prevMonthSales = useErpForCharts
    ? Math.round(allOrders.filter(e => (e.date||'').startsWith(prevYm)).reduce((s,e) => s+(parseFloat(e.supply)||0),0))
    : allEntries.filter(e => e.date?.startsWith(prevYm)).reduce((s,e) => s + (e.ourPurchase||0), 0);
  const monthDiff = prevMonthSales > 0 ? ((monthSales - prevMonthSales) / prevMonthSales * 100) : 0;
  const dayDiff = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100) : 0;

  document.getElementById('sh-month-val').textContent = monthSales.toLocaleString();
  if (targets.salesTarget) {
    const sPct = Math.min(Math.round(monthSales / targets.salesTarget * 100), 999);
    const bar = document.getElementById('sh-sales-target-bar');
    if (bar) bar.style.width = Math.min(sPct, 100) + '%';
    const pctEl = document.getElementById('sh-sales-target-pct');
    if (pctEl) pctEl.textContent = sPct + '%';
    const lblEl = document.getElementById('sh-sales-target-label');
    if (lblEl) lblEl.textContent = '목표 ' + targets.salesTarget.toLocaleString() + '원';
  } else {
    const pctEl = document.getElementById('sh-sales-target-pct');
    if (pctEl) pctEl.textContent = '-';
    const lblEl = document.getElementById('sh-sales-target-label');
    if (lblEl) lblEl.textContent = '목표 미설정';
  }
  document.getElementById('sh-month-sub').innerHTML = prevMonthSales > 0
    ? `전월 대비 <span class="sales-kpi-badge ${monthDiff>=0?'up':'down'}">${monthDiff>=0?'▲':'▼'} ${Math.abs(monthDiff).toFixed(1)}%</span>`
    : `${useErpForCharts ? erpMonth.length+'건 '+basisMeta.action+' 기준' : monthEntries.length+'건 방문 기준'}`;
  document.getElementById('sh-today-val').textContent = todaySales.toLocaleString();
  document.getElementById('sh-today-sub').innerHTML = erpToday.length > 0 ? `${erpToday.length}건 ${basisMeta.action}` : `${todayEntries.length}건 방문`;
  document.getElementById('sh-yesterday-val').textContent = yesterdaySales.toLocaleString();
  document.getElementById('sh-yesterday-sub').innerHTML = yesterdaySales > 0
    ? `전일 대비 <span class="sales-kpi-badge ${dayDiff>=0?'up':'down'}">${dayDiff>=0?'▲':'▼'} ${Math.abs(dayDiff).toFixed(1)}%</span>`
    : `${erpYest.length > 0 ? erpYest.length+'건 '+basisMeta.action : yesterdayEntries.length+'건 방문'}`;

  const daysInMonth = new Date(parseInt(ym.split('-')[0]), parseInt(ym.split('-')[1]), 0).getDate();
  const dayLabels = [], daySalesData = [], dailyBarColors = [];
  const DOW = ['일','월','화','수','목','금','토'];
  const HOLIDAYS = {'01-01':'신정','03-01':'삼일절','05-05':'어린이날','06-06':'현충일','08-15':'광복절','10-03':'개천절','10-09':'한글날','12-25':'크리스마스'};
  const LUNAR_HOLIDAYS = {'2025-01-28':'설연휴','2025-01-29':'설날','2025-01-30':'설연휴','2025-05-05':'어린이날/부처님오신날','2025-10-05':'추석연휴','2025-10-06':'추석','2025-10-07':'추석연휴','2026-02-16':'설연휴','2026-02-17':'설날','2026-02-18':'설연휴','2026-05-24':'부처님오신날','2026-09-24':'추석연휴','2026-09-25':'추석','2026-09-26':'추석연휴'};
  const dailyDowType = [];
  for (let d=1; d<=daysInMonth; d++) {
    const ds = ym + '-' + String(d).padStart(2,'0');
    const dow = new Date(ds).getDay();
    const mmdd = ds.slice(5);
    const holidayName = LUNAR_HOLIDAYS[ds] || (HOLIDAYS[mmdd] ? HOLIDAYS[mmdd] : null);
    const isSun = dow === 0, isSat = dow === 6, isRed = holidayName || isSun || isSat;
    dailyDowType.push(holidayName ? 'holiday' : isSun ? 'sun' : isSat ? 'sat' : 'weekday');
    dayLabels.push([d+'일', holidayName ? DOW[dow]+'🔴' : DOW[dow]]);
    daySalesData.push(useErpForCharts
      ? (ds > today ? 0 : Math.round(allOrders.filter(e=>e.date===ds).reduce((s,e)=>s+(parseFloat(e.supply)||0),0)))
      : allEntries.filter(e=>e.date===ds).reduce((s,e)=>s+(e.ourPurchase||0),0));
    dailyBarColors.push(isRed ? '#D94040CC' : '#2B72C8CC');
  }
  document.getElementById('sh-chart-label').textContent = ym.replace('-','년 ')+'월';
  const workdays = dailyDowType.filter(t => t === 'weekday').length;
  const passedWorkdays = dailyDowType.filter((t,i) => { const ds = ym+'-'+String(i+1).padStart(2,'0'); return t === 'weekday' && ds <= today; }).length;
  const wdEl = document.getElementById('sh-workdays-label');
  if (wdEl) wdEl.textContent = `영업일 ${workdays}일 (경과 ${passedWorkdays}일)`;
  rcDaily('chart-sales-daily', dayLabels, daySalesData, dailyBarColors, dailyDowType);

  const salesByInst = {};
  if (useErpForCharts) {
    erpMonth.forEach(e => { if (e.client) salesByInst[e.client] = (salesByInst[e.client]||0) + (parseFloat(e.supply)||0); });
  } else {
    monthEntries.forEach(e => { if (e.institution && e.ourPurchase) salesByInst[e.institution] = (salesByInst[e.institution]||0) + (e.ourPurchase||0); });
  }
  window._shRankList = Object.entries(salesByInst).sort((a,b) => b[1]-a[1]);
  window._shRankPage = 1;
  shRenderRankPage();
  const top10r = window._shRankList.slice(0, 10);
  const otherAmt = window._shRankList.slice(10).reduce((s, r) => s + r[1], 0);
  const rlabels = top10r.map(r => r[0]); const rdata = top10r.map(r => r[1]);
  if (otherAmt > 0) { rlabels.push('기타'); rdata.push(otherAmt); }
  rc('chart-sales-rank','doughnut', rlabels, rdata, ['#2B72C8','#009E6A','#7856C8','#E8900A','#D94040','#3DB8A0','#6C8EBF','#C75BAB','#8BC34A','#FF7043','#9E9E9E']);

  const salesByPerson = {};
  if (useErpForCharts) {
    erpMonth.forEach(e => { if (e.person) salesByPerson[e.person] = (salesByPerson[e.person]||0) + (parseFloat(e.supply)||0); });
  } else {
    monthEntries.forEach(e => { if (e.person) salesByPerson[e.person] = (salesByPerson[e.person]||0) + (e.ourPurchase||0); });
  }
  const personList = Object.entries(salesByPerson).sort((a,b) => b[1]-a[1]);
  const maxPerson = personList[0]?.[1] || 1;
  const personSalesTgt = {};
  allUsers.forEach(u => { personSalesTgt[u.name] = (targets.personalSales||{})[u.id] || 0; });
  const PERSON_COLORS = ['#E53935','#2B72C8','#43A047','#E8900A','#7856C8','#26c6da'];
  const getPersonColor = (name, i) => { const u = allUsers.find(u => u.name === name); return u ? u.color : PERSON_COLORS[i % PERSON_COLORS.length]; };
  document.getElementById('sh-person-list').innerHTML = personList.length === 0
    ? '<div style="color:var(--text3);font-size:13px;padding:24px 0">이번달 데이터가 없습니다</div>'
    : personList.map(([name, amt], i) => {
        const tgt = personSalesTgt[name] || 0;
        const achPct = tgt ? Math.min(Math.round(amt/tgt*100), 999) : null;
        const pc = getPersonColor(name, i);
        const barWidth = tgt ? Math.min(amt/tgt*100, 100) : (amt/maxPerson*100);
        const metaRight = tgt ? `<span style="font-size:11px;color:var(--text3)">목표 ${tgt.toLocaleString()}만</span>` : '<span style="font-size:11px;color:var(--text3)">목표 미설정</span>';
        const pctBadge = achPct !== null ? `<span style="font-size:13px;font-weight:700;font-family:var(--mono);color:${pc}">${achPct}%</span>` : '<span style="font-size:11px;color:var(--text3)">-</span>';
        return `<div class="leader-item"><div class="leader-rank ${['r1','r2','r3'][i]||''}">${i+1}</div><div class="leader-name">${name}<div class="leader-meta">${(useErpForCharts ? erpMonth : monthEntries).filter(e=>e.person===name).length}건 ${useErpForCharts?basisMeta.action:''} ${metaRight}</div></div><div class="leader-bar-wrap"><div class="leader-bar-fill" style="width:${barWidth}%;background:${pc}"></div></div><div class="leader-num" style="color:${pc};font-weight:700">${Math.round(amt).toLocaleString()}<br>${pctBadge}</div></div>`;
      }).join('');
  rc('chart-person-sales','doughnut', personList.map(p=>p[0]), personList.map(p=>p[1]), personList.map((p,i)=>getPersonColor(p[0],i)));
}

function renderDashPage() {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const ym = today.slice(0,7);
    const isAdmin = currentUser?.role === 'admin';
    const pool = isAdmin ? allEntries : allEntries.filter(e => e.personId === currentUser?.id);
    const monthEntries = pool.filter(e => (e.date||'').startsWith(ym));
    const todayCount = pool.filter(e => e.date === today).length;
    const monthCount = monthEntries.length;

    // KPI: 이번달 누적 방문
    const _set = (id,val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    _set('kpi-total', monthCount);
    _set('kpi-total-sub', '오늘 ' + todayCount + '건 포함');
    const vt = targets.visitTarget || 0;
    const bar = document.getElementById('kpi-visit-bar');
    if (vt > 0) {
      const pct = Math.min(Math.round(monthCount / vt * 100), 100);
      if (bar) bar.style.width = pct + '%';
      _set('kpi-visit-pct', Math.min(Math.round(monthCount / vt * 100), 999) + '%');
      _set('kpi-visit-target-label', '목표 ' + vt + '건');
    } else {
      if (bar) bar.style.width = '0%';
      _set('kpi-visit-pct', '-');
      _set('kpi-visit-target-label', '목표 미설정');
    }

    // 유형별 방문 사업소 (중복 제거)
    const newInst = new Set(monthEntries.filter(e=>e.clientType==='신규거래처').map(e=>e.institution));
    const dormInst = new Set(monthEntries.filter(e=>e.clientType==='휴면거래처').map(e=>e.institution));
    const existInst = new Set(monthEntries.filter(e=>e.clientType==='기존 거래처').map(e=>e.institution));
    const tgtNew = targets.visitNewTarget || 0;
    const tgtDorm = targets.visitDormTarget || 0;
    const tgtExist = targets.visitExistTarget || 0;
    const rate = (a,t) => t > 0 ? Math.round(a/t*100)+'%' : '0%';
    _set('kpi-type-new', newInst.size);
    _set('kpi-type-new-tgt', tgtNew);
    _set('kpi-type-new-rate', rate(newInst.size, tgtNew));
    _set('kpi-type-dormant', dormInst.size);
    _set('kpi-type-dormant-tgt', tgtDorm);
    _set('kpi-type-dormant-rate', rate(dormInst.size, tgtDorm));
    _set('kpi-type-existing', existInst.size);
    _set('kpi-type-existing-tgt', tgtExist);
    _set('kpi-type-existing-rate', rate(existInst.size, tgtExist));

    // 신규/휴면 사업소 거래가능성 (사업소별 최근 방문 기준)
    const dedup = (arr) => {
      const map = {};
      arr.forEach(e => {
        if (!e.institution) return;
        if (!map[e.institution] || e.date > map[e.institution].date) map[e.institution] = e;
      });
      return Object.values(map);
    };
    const newDeals = dedup(monthEntries.filter(e=>e.clientType==='신규거래처'));
    const dormDeals = dedup(monthEntries.filter(e=>e.clientType==='휴면거래처'));
    const cnt = (arr,sym) => arr.filter(e=>e.dealPossibility===sym).length;
    _set('kpi-new-pos', cnt(newDeals,'○'));
    _set('kpi-new-mid', cnt(newDeals,'△'));
    _set('kpi-new-neg', cnt(newDeals,'×'));
    _set('kpi-dormant-pos', cnt(dormDeals,'○'));
    _set('kpi-dormant-mid', cnt(dormDeals,'△'));
    _set('kpi-dormant-neg', cnt(dormDeals,'×'));

    // 일별 방문 차트 (최근 14일)
    const DOW=['일','월','화','수','목','금','토'];
    const HOLIDAYS={'01-01':'신정','03-01':'삼일절','05-05':'어린이날','06-06':'현충일','08-15':'광복절','10-03':'개천절','10-09':'한글날','12-25':'크리스마스'};
    const LUNAR={'2026-02-16':'설','2026-02-17':'설','2026-02-18':'설','2026-05-24':'부처님','2026-09-24':'추석','2026-09-25':'추석','2026-09-26':'추석'};
    const dLabels=[], dData=[], dColors=[], dDows=[];
    for(let i=13;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i);
      const ds=d.toISOString().split('T')[0];
      const dow=d.getDay(); const mmdd=ds.slice(5);
      const isRed=LUNAR[ds]||HOLIDAYS[mmdd]||dow===0||dow===6;
      dLabels.push([ds.slice(8)+'일', DOW[dow]+(isRed?'🔴':'')]);
      dData.push(pool.filter(e=>e.date===ds).length);
      dColors.push(isRed?'#D94040CC':'#2B72C8CC');
      dDows.push(LUNAR[ds]?'holiday':dow===0?'sun':dow===6?'sat':'weekday');
    }
    if (typeof rcDaily === 'function') rcDaily('chart-daily', dLabels, dData, dColors, dDows);

    // 거래처 유형 도넛
    const typeMap={};
    monthEntries.forEach(e=>{const k=e.clientType||'미분류'; typeMap[k]=(typeMap[k]||0)+1;});
    if (typeof rc === 'function') rc('chart-type','doughnut',Object.keys(typeMap),Object.values(typeMap),['#009E6A','#2B72C8','#E8900A','#D94040','#7856C8']);

    // 영업사원별 리더보드
    const personMap={};
    monthEntries.forEach(e=>{if(e.person) personMap[e.person]=(personMap[e.person]||0)+1;});
    const personList=Object.entries(personMap).sort((a,b)=>b[1]-a[1]);
    const maxP=personList[0]?.[1]||1;
    const medals=['🥇','🥈','🥉'];
    const PCOL=['#E53935','#2B72C8','#43A047','#E8900A','#7856C8','#26c6da'];
    const getPC=(name,i)=>{const u=allUsers.find(u=>u.name===name);return u?u.color:PCOL[i%PCOL.length];};
    const lbEl = document.getElementById('leaderboard');
    if (lbEl) lbEl.innerHTML = personList.length===0
      ? '<div style="color:var(--text3);font-size:13px;padding:16px 0">이번달 데이터가 없습니다</div>'
      : personList.map(([name,c],i)=>{
          const pc=getPC(name,i);
          const medal=i<3?`<span style="font-size:15px;width:24px;text-align:center;flex-shrink:0">${medals[i]}</span>`:`<div class="leader-rank">${i+1}</div>`;
          const vTgt=(targets.personal||{})[allUsers.find(u=>u.name===name)?.id]||0;
          const pct=vTgt?Math.min(Math.round(c/vTgt*100),999):null;
          return `<div class="leader-item">${medal}<div class="leader-name">${name}<div class="leader-meta">${c}건${vTgt?` / 목표 ${vTgt}건`:''}</div></div><div class="leader-bar-wrap"><div class="leader-bar-fill" style="width:${c/maxP*100}%;background:${pc}"></div></div><div class="leader-num" style="color:${pc}">${c}<br>${pct!==null?`<span style="font-size:11px;color:var(--text3)">${pct}%</span>`:''}</div></div>`;
        }).join('');

    // 지역별 방문 바차트
    const regionMap={};
    monthEntries.forEach(e=>{if(e.region) regionMap[e.region]=(regionMap[e.region]||0)+1;});
    const rKeys=Object.keys(regionMap).sort((a,b)=>regionMap[b]-regionMap[a]).slice(0,8);
    if (typeof rc === 'function') rc('chart-region','bar',rKeys,rKeys.map(k=>regionMap[k]),'#009E6A',false);

    // 거래 가능성 도넛
    const pO=monthEntries.filter(e=>e.dealPossibility==='○').length;
    const pD=monthEntries.filter(e=>e.dealPossibility==='△').length;
    const pX=monthEntries.filter(e=>e.dealPossibility==='×').length;
    if (typeof rc === 'function') rc('chart-deal','doughnut',['○ 긍정적','△ 보통','× 어려움'],[pO,pD,pX],['#009E6A','#E8900A','#D94040']);

    // 월별 방문 추이
    const mLabels=[], mData=[];
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(), now.getMonth()-i, 1);
      const yymm=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      mLabels.push((d.getMonth()+1)+'월');
      mData.push(pool.filter(e=>(e.date||'').startsWith(yymm)).length);
    }
    if (typeof rc === 'function') rc('chart-monthly','bar',mLabels,mData,'#009E6A');

    // TOP10 거래처
    const instMap={};
    pool.forEach(e=>{if(e.institution) instMap[e.institution]=(instMap[e.institution]||0)+1;});
    const top10=Object.entries(instMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const maxT=top10[0]?.[1]||1;
    const top10El = document.getElementById('top10-list');
    if (top10El) top10El.innerHTML = top10.length===0
      ? '<div style="color:var(--text3);font-size:13px;padding:16px 0">데이터가 없습니다</div>'
      : top10.map(([name,c],i)=>`<div class="leader-item"><div class="leader-rank">${i+1}</div><div class="leader-name" style="font-size:12px">${escHtml(name)}</div><div class="leader-bar-wrap"><div class="leader-bar-fill" style="width:${c/maxT*100}%;background:var(--blue)"></div></div><div class="leader-num" style="color:var(--blue)">${c}회</div></div>`).join('');

    // 최근 방문 기록
    const recent=[...pool].sort((a,b)=>new Date(b.ts||b.date)-new Date(a.ts||a.date)).slice(0,10);
    const recEl = document.getElementById('recent-table-wrap');
    if (recEl && typeof tbl === 'function') recEl.innerHTML = tbl(recent, false);

    if (typeof renderDashPending === 'function') renderDashPending();
  } catch (e) {
    console.error('[renderDashPage]', e);
  }
}

function renderDashPending() {
  const card = document.getElementById('dash-pending-card');
  const listEl = document.getElementById('dash-pending-list');
  const countEl = document.getElementById('dash-pending-count');
  if (!card || !listEl) return;
  const pending = [];
  allWeeklyReports.forEach(r => {
    if (!r.highlights) return;
    r.highlights.split('||').forEach(part => {
      const ci = part.indexOf('::');
      if (ci < 0) return;
      const inst = part.slice(0, ci);
      const rest = part.slice(ci + 2);
      const ai = rest.indexOf('@@');
      const issue = ai >= 0 ? rest.slice(0, ai) : rest;
      const afterAt = ai >= 0 ? rest.slice(ai + 2) : '';
      const pi = afterAt.indexOf('%%');
      const response = pi >= 0 ? afterAt.slice(0, pi) : afterAt;
      const status = pi >= 0 ? afterAt.slice(pi + 2) : '';
      if (status === '보류' && issue.trim()) {
        pending.push({ inst, issue, response, week: r.week, year: r.year, person: r.person, id: r.id });
      }
    });
  });
  if (!pending.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  countEl.textContent = pending.length + '건';
  listEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
      <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;font-weight:700">사업소</th>
      <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;font-weight:700">이슈 내용</th>
      <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;font-weight:700">대응</th>
      <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;font-weight:700">담당자</th>
      <th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;font-weight:700">주차</th>
    </tr></thead>
    <tbody>${pending.map((p,i)=>`<tr style="border-bottom:1px solid var(--border);${i%2?'background:var(--surface2)':''}">
      <td style="padding:8px 12px;font-weight:600">${escHtml(p.inst)}</td>
      <td style="padding:8px 12px;color:var(--text)">${escHtml(p.issue)}</td>
      <td style="padding:8px 12px;color:var(--text2)">${escHtml(p.response||'-')}</td>
      <td style="padding:8px 12px;color:var(--text3)">${escHtml(p.person||'-')}</td>
      <td style="padding:8px 12px;color:var(--text3);white-space:nowrap">${escHtml(p.year)}년 ${escHtml(p.week)}주차</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function shRenderRankPage() {
  const list = window._shRankList || [];
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  let page = window._shRankPage || 1;
  if (page > totalPages) page = totalPages;
  window._shRankPage = page;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);
  const maxRank = list[0]?.[1] || 1;
  const totalRankAmt = list.reduce((s, r) => s + r[1], 0);
  const medalIcons = ['🥇','🥈','🥉'];
  document.getElementById('sh-rank-list').innerHTML = pageItems.length === 0
    ? '<div style="color:var(--text3);font-size:13px;padding:24px 0">이번달 매출 데이터가 없습니다</div>'
    : pageItems.map(([name, amt], idx) => {
        const globalIdx = start + idx;
        const pct = totalRankAmt ? Math.round(amt/totalRankAmt*100) : 0;
        const medal = globalIdx < 3 ? `<span style="font-size:15px;line-height:1;width:24px;text-align:center;flex-shrink:0">${medalIcons[globalIdx]}</span>` : `<div class="leader-rank">${globalIdx+1}</div>`;
        return `<div class="leader-item">
          ${medal}
          <div class="leader-name" style="font-size:12px">${escHtml(name)}</div>
          <div class="leader-bar-wrap"><div class="leader-bar-fill" style="width:${amt/maxRank*100}%;background:var(--blue)"></div></div>
          <div class="leader-num" style="color:var(--blue)">${amt.toLocaleString()} <span style="font-size:13px;color:var(--green-dark);font-weight:700">${pct}%</span></div>
        </div>`;
      }).join('');
  // 페이지네이션 렌더링
  const pagerEl = document.getElementById('sh-rank-pager');
  if (totalPages <= 1) { pagerEl.innerHTML = ''; return; }
  const btnStyle = 'background:var(--surface2);border:1px solid var(--border);color:var(--text2);padding:4px 10px;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:12px;min-width:30px';
  const activeStyle = 'background:var(--green);border:1px solid var(--green);color:#fff;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:700;min-width:30px';
  const disabledStyle = 'background:var(--surface2);border:1px solid var(--border);color:var(--text3);padding:4px 10px;border-radius:6px;cursor:not-allowed;font-family:var(--font);font-size:12px;min-width:30px;opacity:.5';
  const ellipsisStyle = 'color:var(--text3);padding:4px 6px;font-size:12px';
  const prevDisabled = page === 1;
  const nextDisabled = page === totalPages;

  // 표시할 페이지 번호 집합 계산
  const pages = new Set();
  pages.add(1);
  pages.add(totalPages);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  let html = `<button style="${prevDisabled?disabledStyle:btnStyle}" ${prevDisabled?'disabled':''} onclick="shRankPageMove(-1)">‹</button>`;
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) html += `<span style="${ellipsisStyle}">...</span>`;
    html += `<button style="${p===page?activeStyle:btnStyle}" onclick="shRankGoPage(${p})">${p}</button>`;
    prev = p;
  }
  html += `<button style="${nextDisabled?disabledStyle:btnStyle}" ${nextDisabled?'disabled':''} onclick="shRankPageMove(1)">›</button>`;
  html += `<span style="color:var(--text3);font-size:11px;margin-left:8px">${page}/${totalPages} · 총 ${list.length}개</span>`;
  pagerEl.innerHTML = html;
}
function shRankPageMove(dir) {
  const totalPages = Math.max(1, Math.ceil((window._shRankList||[]).length / 10));
  window._shRankPage = Math.max(1, Math.min(totalPages, (window._shRankPage||1) + dir));
  shRenderRankPage();
}
function shRankGoPage(p) {
  window._shRankPage = p;
  shRenderRankPage();
}

function rcDaily(id, labels, data, colors, dowTypes) {
  if(charts[id])charts[id].destroy();
  const ctx=document.getElementById(id)?.getContext('2d'); if(!ctx)return;
  // labels는 [숫자라벨, 요일라벨] 배열 또는 문자열
  const chartLabels = labels.map(l => Array.isArray(l) ? l : [l]);
  charts[id]=new Chart(ctx,{type:'bar',data:{labels:chartLabels,datasets:[{data,
    backgroundColor:colors,
    borderColor:colors.map(c=>c.replace('CC','FF')),
    borderWidth:0,borderRadius:5,
  }]},options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},datalabels:{display:false},
      beforeDraw: undefined
    },
    scales:{
      x:{ticks:{display:false},
        grid:{color:'rgba(0,100,60,.06)'},border:{display:false},
        afterFit(scale){scale.paddingBottom=42;}},
      y:{ticks:{color:'#9AB0AA',font:{size:10,family:'Noto Sans KR'}},grid:{color:'rgba(0,100,60,.06)'},border:{display:false}},
    },
  },plugins:[{
    id:'dailyAxisLabels',
    afterDraw(chart) {
      const {ctx:c, chartArea:{bottom}, scales:{x}} = chart;
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'top';
      const ticks = x.ticks;
      ticks.forEach((tick, i) => {
        const xPos = x.getPixelForTick(i);
        const dt = dowTypes ? dowTypes[i] : 'weekday';
        const isRed = dt === 'holiday' || dt === 'sun' || dt === 'sat';
        const lbl = Array.isArray(chartLabels[i]) ? chartLabels[i] : [chartLabels[i]];
        // 숫자 (위줄) - 회색
        c.fillStyle = '#9AB0AA';
        c.font = '11px Noto Sans KR';
        c.fillText(lbl[0]||'', xPos, bottom + 4);
        // 요일 (아래줄)
        if (lbl[1]) {
          c.fillStyle = isRed ? '#D94040' : '#9AB0AA';
          c.font = isRed ? 'bold 13px Noto Sans KR' : '13px Noto Sans KR';
          c.fillText(lbl[1], xPos, bottom + 20);
        }
      });
      c.restore();
    }
  }]});
}

function rc(id,type,labels,data,color,horizontal) {
  if(charts[id])charts[id].destroy();
  const ctx=document.getElementById(id)?.getContext('2d'); if(!ctx)return;
  const ia=Array.isArray(color);
  const doughnutPctPlugin = {
    id:'doughnutPct',
    afterDraw(chart) {
      if(chart.config.type !== 'doughnut') return;
      const {ctx:c, data} = chart;
      const total = data.datasets[0].data.reduce((a,b)=>a+b,0);
      c.save();
      c.textAlign='center'; c.textBaseline='middle';
      c.font='bold 11px Noto Sans KR'; c.fillStyle='#fff';
      chart.getDatasetMeta(0).data.forEach((arc,i)=>{
        const pct = Math.round(data.datasets[0].data[i]/total*100);
        if(pct < 4) return;
        const angle = (arc.startAngle+arc.endAngle)/2;
        const r = (arc.innerRadius+arc.outerRadius)/2;
        c.fillText(pct+'%', arc.x+Math.cos(angle)*r, arc.y+Math.sin(angle)*r);
      });
      c.restore();
    }
  };
  charts[id]=new Chart(ctx,{type,data:{labels,datasets:[{data,
    backgroundColor:ia?color.map(c=>c+'CC'):color+'44',
    borderColor:ia?color:color,borderWidth:type==='doughnut'?2:0,
    borderRadius:type==='bar'?5:0,hoverBackgroundColor:ia?color.map(c=>c+'EE'):color+'88',
  }]},options:{responsive:true,maintainAspectRatio:false,indexAxis:horizontal?'y':'x',
    plugins:{legend:{display:type==='doughnut',labels:{color:'#5A706A',font:{size:11,family:'Noto Sans KR'},padding:14,boxWidth:10}}},
    scales:type!=='doughnut'?{
      x:{ticks:{color:'#9AB0AA',font:{size:10,family:'Noto Sans KR'}},grid:{color:'rgba(0,100,60,.06)'},border:{display:false}},
      y:{ticks:{color:'#9AB0AA',font:{size:10,family:'Noto Sans KR'}},grid:{color:'rgba(0,100,60,.06)'},border:{display:false}},
    }:{}},plugins:[doughnutPctPlugin]});
}

// ════════════════════════════════════
// TABLE
// ════════════════════════════════════
function tbl(entries, showActions) {
  if (!entries.length) return '<div class="empty-state"><div style="font-size:28px;margin-bottom:8px">📋</div>기록이 없습니다</div>';
  const dc={'○':'do','△':'dd','×':'dx'};
  const tc={'기존 거래처':'te','신규거래처':'tn','휴면거래처':'td2','거래 재개':'tr2'};
  const isAdmin = currentUser?.role === 'admin';
  return `<table><thead><tr><th>날짜</th><th>영업사원</th><th>기관명</th><th>유형</th><th>거래가능성</th><th>구매액</th><th>지역</th><th>미팅 요약</th>${isAdmin&&showActions?'<th>관리</th>':''}</tr></thead><tbody>`+
  entries.map(e=>{
    const entryId = escInlineJs(e.id);
    const meeting = String(e.meeting || '');
    return `<tr style="cursor:pointer" onclick="openDetail('${entryId}')">
    <td style="white-space:nowrap;font-family:var(--mono);font-size:11px;color:var(--text3)">${escHtml(e.date||'')}</td>
    <td class="tm">${escHtml(e.person||'-')}</td>
    <td class="tm" style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(e.institution||'-')}</td>
    <td><span class="type-badge ${tc[e.clientType]||''}">${escHtml(e.clientType||'-')}</span></td>
    <td><span class="deal-badge ${dc[e.dealPossibility]||''}">${escHtml(e.dealPossibility||'-')}</span></td>
    <td style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--green-dark)">${e.ourPurchase?e.ourPurchase.toLocaleString()+'만':'-'}</td>
    <td>${escHtml(e.region||'-')}</td>
    <td style="max-width:180px;font-size:11px">${escHtml(meeting.substring(0,50))}${meeting.length>50?'…':''}</td>
    ${isAdmin&&showActions?`<td><div class="action-btns"><button class="btn-icon" onclick="event.stopPropagation();openEditEntry('${entryId}')">✎</button><button class="btn-icon del" onclick="event.stopPropagation();deleteEntry('${entryId}')">✕</button></div></td>`:''}
  </tr>`;
  }).join('')+'</tbody></table>';
}

function renderRecords() {
  const q  = (document.getElementById('search-input').value||'').toLowerCase();
  const fp = document.getElementById('filter-person').value;
  const fd = document.getElementById('filter-deal').value;

  // non-admin sees only own entries
  let pool = currentUser?.role === 'admin' ? [...allEntries] : allEntries.filter(e=>e.personId===currentUser?.id);
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
  sel.innerHTML = '<option value="">전체 영업사원</option>'+persons.map(p=>`<option value="${escHtml(p)}"${p===cur?' selected':''}>${escHtml(p)}</option>`).join('');
  document.getElementById('records-table-wrap').innerHTML = tbl(f, true);
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

// ════════════════════════════════════
// ADMIN: USERS
// ════════════════════════════════════
function renderUsers() {
  const colors = ['#009E6A','#2B72C8','#7856C8','#E8900A','#D94040','#26c6da'];
  const userEntryCount = {};
  allEntries.forEach(e=>{ userEntryCount[e.personId] = (userEntryCount[e.personId]||0)+1; });

  document.getElementById('users-list').innerHTML = allUsers.map(u=>{
    const uid = escInlineJs(u.id);
    const uname = escHtml(u.name || '');
    const unameJs = escInlineJs(u.name || '');
    const color = /^#[0-9a-f]{6}$/i.test(u.color || '') ? u.color : '#009E6A';
    const roleBadges = {
      admin:   '<span class="role-badge-admin" style="font-size:10px">관리자</span>',
      manager: '<span class="role-badge-manager" style="font-size:10px">영업관리</span>',
      planner: '<span class="role-badge-planner" style="font-size:10px">기획</span>',
      user:    ''
    };
    return `
    <div class="user-card">
      <div class="user-card-avatar" style="background:${color}22;color:${color}">${escHtml((u.name||'').slice(0,1))}</div>
      <div class="user-card-info">
        <div class="user-card-name">${uname} ${roleBadges[u.role]||''}</div>
        <div class="user-card-meta">ID: ${escHtml(u.id)} · 가입일: ${escHtml(u.createdAt||'-')}</div>
      </div>
      <div class="user-card-stats">
        <div class="user-card-count">${userEntryCount[u.id]||0}</div>
        <div class="user-card-label">방문 기록</div>
      </div>
      <div class="user-card-actions">
        <button class="btn-sm btn-amber" onclick="openResetPwModal('${uid}','${unameJs}')">비번 초기화</button>
        ${u.id!=='admin'?`<button class="btn-sm btn-danger" onclick="deleteUser('${uid}')">삭제</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function openAddUserModal() { openModal('modal-add-user'); }
function addUser() {
  const name = document.getElementById('nu-name').value.trim();
  const id   = document.getElementById('nu-id').value.trim();
  const pw   = document.getElementById('nu-pw').value;
  const role = document.getElementById('nu-role').value;
  if (!name||!id||!pw) { showToast('모든 항목을 입력하세요.','error'); return; }
  if (allUsers.find(u=>u.id===id)) { showToast('이미 존재하는 아이디입니다.','error'); return; }
  const colors = ['#E53935','#2B72C8','#43A047','#E8900A','#7856C8','#26c6da'];
  allUsers.push({ id, name, password: pw, role, color: colors[allUsers.length % colors.length], createdAt: new Date().toISOString().split('T')[0] });
  setShared('sj-users-v6', allUsers);
  ['nu-name','nu-id','nu-pw'].forEach(x=>document.getElementById(x).value='');
  document.getElementById('nu-role').value='user';
  closeModal('modal-add-user');
  renderUsers();
  showToast(`${name} 계정이 추가되었습니다.`, 'success');
}
function deleteUser(id) {
  const u = allUsers.find(x=>x.id===id);
  if (!confirm(`'${u?.name}' 계정을 삭제할까요?\n해당 사원의 일지 데이터는 보존됩니다.`)) return;
  allUsers = allUsers.filter(x=>x.id!==id);
  setShared('sj-users-v6', allUsers);
  renderUsers();
  showToast('계정이 삭제되었습니다.', 'success');
}

// ── 회원가입 신청 / 승인 ──
function switchAuthMode(mode) {
  document.getElementById('login-mode').style.display  = (mode==='login')  ? 'block' : 'none';
  document.getElementById('signup-mode').style.display = (mode==='signup') ? 'block' : 'none';
  document.getElementById('login-err').style.display = 'none';
  document.getElementById('signup-err').style.display = 'none';
  document.getElementById('signup-err').textContent = '';
}

function showSignupErr(msg) {
  const el = document.getElementById('signup-err');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(()=>{ el.style.display='none'; }, 3500);
}

function submitSignup() {
  const name = document.getElementById('su-name').value.trim();
  const id   = document.getElementById('su-id').value.trim();
  const pw   = document.getElementById('su-pw').value;
  const pw2  = document.getElementById('su-pw-confirm').value;
  const role = document.getElementById('su-role').value || 'user';
  if (!name || !id || !pw || !pw2) { showSignupErr('모든 항목을 입력하세요.'); return; }
  if (id.length < 2 || id.length > 20) { showSignupErr('아이디는 2~20자.'); return; }
  if (pw.length < 4) { showSignupErr('비밀번호는 4자 이상.'); return; }
  if (pw !== pw2) { showSignupErr('비밀번호가 일치하지 않습니다.'); return; }

  ensureUsers();
  if (allUsers.find(u=>u.id===id)) { showSignupErr('이미 존재하는 아이디입니다.'); return; }
  const pending = getShared('sj-signup-pending-v1', []);
  if (pending.find(p=>p.id===id)) { showSignupErr('이미 신청된 아이디입니다. 승인을 기다려주세요.'); return; }

  pending.push({ id, name, password: pw, role, requestedAt: new Date().toISOString() });
  setShared('sj-signup-pending-v1', pending);

  ['su-name','su-id','su-pw','su-pw-confirm'].forEach(x=>document.getElementById(x).value='');
  document.getElementById('su-role').value = 'user';
  alert('가입 신청이 완료되었습니다.\n관리자 승인 후 로그인할 수 있습니다.');
  switchAuthMode('login');
}

function renderPendingSignups() {
  const wrap = document.getElementById('pending-signups-wrap');
  if (!wrap) return;
  const pending = getShared('sj-signup-pending-v1', []);
  if (pending.length === 0) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div style="background:var(--amber-l);border:1px solid var(--amber);border-radius:var(--r);padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:14px">🔔</span>
        <span style="font-size:13px;font-weight:700;color:var(--amber)">가입 신청 대기 ${pending.length}건</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${pending.map(p=>{
          const reqRole = p.role || 'user';
          const roleLabels = {user:'영업사원',manager:'영업관리',planner:'기획',admin:'관리자'};
          const pid = escInlineJs(p.id);
          return `
          <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r2);padding:10px 12px;display:flex;align-items:center;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(p.name)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${escHtml(p.id)})</span> <span style="font-size:10px;color:var(--text2);background:var(--bg);padding:2px 6px;border-radius:3px;margin-left:4px">신청: ${escHtml(roleLabels[reqRole]||reqRole)}</span></div>
              <div style="font-size:11px;color:var(--text2);margin-top:2px">신청일시: ${escHtml((p.requestedAt||'').replace('T',' ').substring(0,16))}</div>
            </div>
            <select id="role-${escHtml(p.id)}" class="form-select" style="width:120px;font-size:12px">
              <option value="user"${reqRole==='user'?' selected':''}>영업사원</option>
              <option value="manager"${reqRole==='manager'?' selected':''}>영업관리</option>
              <option value="planner"${reqRole==='planner'?' selected':''}>기획</option>
              <option value="admin"${reqRole==='admin'?' selected':''}>관리자</option>
            </select>
            <button class="btn-sm btn-primary" onclick="approveSignup('${pid}')">승인</button>
            <button class="btn-sm btn-danger" onclick="rejectSignup('${pid}')">거절</button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function approveSignup(id) {
  const pending = getShared('sj-signup-pending-v1', []);
  const p = pending.find(x=>x.id===id);
  if (!p) { showToast('신청을 찾을 수 없습니다.','error'); return; }
  if (allUsers.find(u=>u.id===id)) { showToast('이미 존재하는 아이디입니다.','error'); return; }
  const role = document.getElementById('role-'+id)?.value || 'user';
  const colors = ['#E53935','#2B72C8','#43A047','#E8900A','#7856C8','#26c6da'];
  allUsers.push({
    id: p.id, name: p.name, password: p.password, role,
    color: colors[allUsers.length % colors.length],
    createdAt: new Date().toISOString().split('T')[0]
  });
  setShared('sj-users-v6', allUsers);
  setShared('sj-signup-pending-v1', pending.filter(x=>x.id!==id));
  renderUsers(); renderPendingSignups();
  showToast(`${p.name} 계정이 승인되었습니다.`, 'success');
}

function rejectSignup(id) {
  const pending = getShared('sj-signup-pending-v1', []);
  const p = pending.find(x=>x.id===id);
  if (!p) return;
  if (!confirm(`'${p.name}'(${p.id}) 신청을 거절할까요?`)) return;
  setShared('sj-signup-pending-v1', pending.filter(x=>x.id!==id));
  renderPendingSignups();
  showToast('신청이 거절되었습니다.', 'success');
}

// ════════════════════════════════════
// ADMIN: TARGETS
// ════════════════════════════════════
// 숫자 입력에 천단위 콤마 자동 표시 (저장 시 saveTargets에서 콤마 제거)
function fmtComma(input) {
  const raw = (input.value || '').replace(/[^0-9]/g, '');
  input.value = raw ? Number(raw).toLocaleString() : '';
}

function renderTargets() {
  document.getElementById('t-visit').value = targets.visitTarget||'';
  document.getElementById('t-sales').value = targets.salesTarget ? targets.salesTarget.toLocaleString() : '';

  // 팀 전체 퍼센트
  const now=new Date(), ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  let teamVisit=0, teamSales=0;
  allEntries.forEach(e=>{if((e.date||'').startsWith(ym)){teamVisit++;teamSales+=(parseFloat(e.ourPurchase)||0);}});
  const vPct=targets.visitTarget?Math.min(Math.round(teamVisit/targets.visitTarget*100),999):0;
  const sPct=targets.salesTarget?Math.min(Math.round(teamSales/targets.salesTarget*100),999):0;
  const tvBar=document.getElementById('t-visit-bar'); if(tvBar)tvBar.style.width=vPct+'%';
  const tsBar=document.getElementById('t-sales-bar'); if(tsBar)tsBar.style.width=sPct+'%';
  const tvPct=document.getElementById('t-visit-pct'); if(tvPct)tvPct.textContent=targets.visitTarget?vPct+'%':'-';
  const tsPct=document.getElementById('t-sales-pct'); if(tsPct)tsPct.textContent=targets.salesTarget?sPct+'%':'-';

  // 영업사원별
  const userList = allUsers.filter(u=>u.role==='user');
  const pm={}, sm={};
  allEntries.forEach(e=>{
    if(!e.personId)return;
    if((e.date||'').startsWith(ym)){
      pm[e.personId]=(pm[e.personId]||0)+1;
      sm[e.personId]=(sm[e.personId]||0)+(parseFloat(e.ourPurchase)||0);
    }
  });
  document.getElementById('personal-targets').innerHTML = userList.map(u=>{
    const uidAttr = escHtml(u.id);
    const vTgt=(targets.personal||{})[u.id]||0;
    const sTgt=(targets.personalSales||{})[u.id]||0;
    const vAct=pm[u.id]||0, sAct=sm[u.id]||0;
    const vpct=vTgt?Math.min(Math.round(vAct/vTgt*100),999):0;
    const spct=sTgt?Math.min(Math.round(sAct/sTgt*100),999):0;
    return `<div class="personal-block">
      <div class="personal-block-name">${escHtml(u.name)}</div>
      <div class="tgt-row">
        <span class="tgt-label">매출 목표</span>
        <input class="target-input-sm" id="pts-${uidAttr}" type="text" value="${sTgt?sTgt.toLocaleString():''}" placeholder="0" oninput="fmtComma(this)" />
        <span class="tgt-unit">원</span>
        <div class="tgt-bar-wrap"><div class="tgt-bar-fill" style="width:${spct}%;background:var(--amber)"></div></div>
        <span class="tgt-pct" style="color:var(--amber)">${sTgt?spct+'%':'-'}</span>
      </div>
      <div class="tgt-row">
        <span class="tgt-label">방문 목표</span>
        <input class="target-input-sm" id="pt-${uidAttr}" type="number" value="${vTgt||''}" placeholder="0" />
        <span class="tgt-unit">건</span>
        <div class="tgt-bar-wrap"><div class="tgt-bar-fill" style="width:${vpct}%;background:var(--green)"></div></div>
        <span class="tgt-pct" style="color:var(--green-dark)">${vTgt?vpct+'%':'-'}</span>
      </div>
    </div>`;
  }).join('');

  // chart
  const labels=userList.map(u=>u.name);
  const actual=userList.map(u=>pm[u.id]||0);
  const tgt=userList.map(u=>(targets.personal||{})[u.id]||0);
  if(charts['chart-target'])charts['chart-target'].destroy();
  const ctx=document.getElementById('chart-target')?.getContext('2d'); if(!ctx)return;
  charts['chart-target']=new Chart(ctx,{type:'bar',data:{labels,datasets:[
    {label:'실적',data:actual,backgroundColor:'#009E6A88',borderColor:'#009E6A',borderWidth:1,borderRadius:4},
    {label:'목표',data:tgt,backgroundColor:'#E8900A44',borderColor:'#E8900A',borderWidth:1,borderRadius:4},
  ]},options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#5A706A',font:{size:11,family:'Noto Sans KR'},boxWidth:10}}},
    scales:{x:{ticks:{color:'#9AB0AA',font:{size:11}},grid:{display:false},border:{display:false}},
            y:{ticks:{color:'#9AB0AA',font:{size:11}},grid:{color:'rgba(0,100,60,.06)'},border:{display:false}}}}});
}

function saveTargets() {
  const _pc = id => parseFloat((document.getElementById(id)?.value||'').replace(/,/g,''))||0;
  targets.visitTarget = parseFloat(document.getElementById('t-visit').value)||0;
  targets.salesTarget = _pc('t-sales');
  targets.personal = {};
  targets.personalSales = {};
  allUsers.filter(u=>u.role==='user').forEach(u=>{
    const v=parseFloat(document.getElementById('pt-'+u.id)?.value)||0;
    if(v)targets.personal[u.id]=v;
    const s=_pc('pts-'+u.id);
    if(s)targets.personalSales[u.id]=s;
  });
  setShared('sj-targets-v4', targets);
  renderDashboard();
  showToast('목표가 저장되었습니다.', 'success');
}

// ════════════════════════════════════
// PASSWORD CHANGE
// ════════════════════════════════════
function changeMyPassword() {
  const current = document.getElementById('cpw-current').value;
  const newPw   = document.getElementById('cpw-new').value;
  const confirm = document.getElementById('cpw-confirm').value;
  const errEl   = document.getElementById('cpw-err');
  errEl.style.display = 'none';

  if (currentUser.password !== current) {
    errEl.textContent = '현재 비밀번호가 올바르지 않습니다.'; errEl.style.display = 'block'; return;
  }
  if (newPw.length < 4) {
    errEl.textContent = '새 비밀번호는 4자 이상이어야 합니다.'; errEl.style.display = 'block'; return;
  }
  if (newPw !== confirm) {
    errEl.textContent = '새 비밀번호가 일치하지 않습니다.'; errEl.style.display = 'block'; return;
  }

  const idx = allUsers.findIndex(u => u.id === currentUser.id);
  allUsers[idx].password = newPw;
  currentUser.password = newPw;
  setShared('sj-users-v6', allUsers);

  ['cpw-current','cpw-new','cpw-confirm'].forEach(id => document.getElementById(id).value = '');
  closeModal('modal-change-pw');
  showToast('비밀번호가 변경되었습니다.', 'success');
}

function openResetPwModal(uid, name) {
  document.getElementById('reset-pw-uid').value = uid;
  document.getElementById('reset-pw-name').textContent = name;
  document.getElementById('rpw-new').value = '';
  document.getElementById('rpw-confirm').value = '';
  document.getElementById('rpw-err').style.display = 'none';
  openModal('modal-reset-pw');
}

async function resetUserPassword() {
  const uid     = document.getElementById('reset-pw-uid').value;
  const newPw   = document.getElementById('rpw-new').value;
  const confirm = document.getElementById('rpw-confirm').value;
  const errEl   = document.getElementById('rpw-err');
  errEl.style.display = 'none';

  if (newPw.length < 4) {
    errEl.textContent = '비밀번호는 4자 이상이어야 합니다.'; errEl.style.display = 'block'; return;
  }
  if (newPw !== confirm) {
    errEl.textContent = '비밀번호가 일치하지 않습니다.'; errEl.style.display = 'block'; return;
  }

  const idx = allUsers.findIndex(u => u.id === uid);
  allUsers[idx].password = newPw;
  setShared('sj-users-v6', allUsers);

  closeModal('modal-reset-pw');
  showToast(`${allUsers[idx].name} 비밀번호가 초기화되었습니다.`, 'success');
}

// ════════════════════════════════════
// EXPORT EXCEL
// ════════════════════════════════════
function exportExcel() {
  const cols = ['날짜','영업사원','기관명','거래처유형','거래가능성','당사구매액(원)','타사구매액(원)','병행업종','지역','미팅내용','이슈사항','연락처'];
  const rows = allEntries.sort((a,b)=>new Date(a.ts)-new Date(b.ts)).map(e=>
    [e.date,e.person,e.institution,e.clientType,e.dealPossibility,e.ourPurchase,e.otherPurchase,e.sideBusiness,e.region,e.meeting?.replace(/\n/g,' '),e.issues?.replace(/\n/g,' '),e.contact]
  );
  const csv = [cols, ...rows].map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `영업일지_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('엑셀 파일이 다운로드됩니다.', 'success');
}

// ════════════════════════════════════
// MODAL
// ════════════════════════════════════
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) {
    console.warn('[openModal] missing modal:', id);
    return;
  }
  // 비번 변경 모달 열 때 필드 초기화
  if (id === 'modal-change-pw') {
    ['cpw-current','cpw-new','cpw-confirm'].forEach(x => { const el = document.getElementById(x); if (el) el.value = ''; });
    const err = document.getElementById('cpw-err');
    if (err) err.style.display = 'none';
  }
  if (id === 'modal-erp-upload') {
    erpRefreshSyncStatus();
    erpUpdateUploadPreview();
  }
  modal.classList.add('open');
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}


// ════════════════════════════════════
// TOAST
// ════════════════════════════════════
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  if (!t) {
    console[type === 'error' ? 'error' : 'log'](msg);
    return;
  }
  t.textContent = (type==='success'?'✓ ':'✕ ') + msg;
  t.className = 'toast ' + type;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.style.display='none', 2800);
}

function updateBadge() {
  const cnt = currentUser?.role==='admin' ? allEntries.length : allEntries.filter(e=>e.personId===currentUser?.id).length;
  const el = document.getElementById('total-badge');
  if (el) el.textContent = cnt;
}





// ════════════════════════════════════
