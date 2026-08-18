// 대시보드/영업현황/계정/목표 화면 렌더링 모듈.
// ERP 주문·출고 데이터(allOrders)를 월별/담당자별로 집계해 화면 카드와 차트를 갱신한다.
// DASHBOARD
let salesTrendMode = 'amount';
let salesTrendPayload = null;
const salesSectionMonths = { summary: '', trend: '', office: '', dist: '', person: '' };

function salesDashboardCurrentYm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function salesDashboardMonthLabel(ym) {
  const [year, month] = String(ym || '').split('-');
  return `${year}년 ${month}월`;
}

function salesMonthContext(section) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentYm = salesDashboardCurrentYm();
  let ym = salesSectionMonths[section] || currentYm;
  if (ym > currentYm) ym = currentYm;
  salesSectionMonths[section] = ym;
  const [year, month] = ym.split('-').map(Number);
  const isCurrentMonth = ym === currentYm;
  const monthEnd = `${ym}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  return {
    ym,
    today,
    currentYm,
    isCurrentMonth,
    year,
    month,
    monthStart: `${ym}-01`,
    monthEnd,
    periodEnd: isCurrentMonth ? today : monthEnd,
    monthLabel: salesDashboardMonthLabel(ym),
    shortMonthLabel: isCurrentMonth ? '이번달' : `${month}월`,
  };
}

function shiftSalesMonth(section, offset) {
  if (!Object.prototype.hasOwnProperty.call(salesSectionMonths, section)) return;
  const currentYm = salesDashboardCurrentYm();
  const baseYm = salesSectionMonths[section] || currentYm;
  const [year, month] = baseYm.split('-').map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  const nextYm = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
  if (nextYm > currentYm) return;
  salesSectionMonths[section] = nextYm;
  if (section === 'summary') renderSalesPage({ refreshIndependentSections: false });
  else if (section === 'trend') renderSalesTrendMonth();
  else if (section === 'person') renderSalesPersonMonth();
  else renderSalesRankMonth(section);
}
// ════════════════════════════════════

function renderDashboard() {
  const salesActive = document.getElementById('page-sales')?.classList.contains('active');
  const dashActive  = document.getElementById('page-dash')?.classList.contains('active');
  if (salesActive) renderSalesPage();
  if (dashActive)  renderDashPage();
}

// 월말 매출 예측용 페이싱 비율: 과거 월들이 'curDay까지 누적한 매출 / 그 달 전체 매출'의 평균.
// 월초 매출이 크고 월말로 갈수록 줄어드는 패턴이면 이 비율이 (선형 경과비율보다) 커져서 과대추정을 막아준다.
// 반환: 0~1 누적비율 g (데이터 부족 시 null → 호출부에서 선형 fallback)
function forecastMonthByPacing(ym, todayStr, rowFilter) {
  if (!allOrders || !allOrders.length) return null;
  const curDay = parseInt(todayStr.slice(8, 10), 10);
  if (!curDay) return null;
  const byMonth = {}; // 'YYYY-MM' -> { day: sales }
  allOrders.forEach(o => {
    if (rowFilter && !rowFilter(o)) return;
    const d = o.date || '';
    if (d.length < 10) return;
    const m = d.slice(0, 7), day = parseInt(d.slice(8, 10), 10);
    if (!byMonth[m]) byMonth[m] = {};
    byMonth[m][day] = (byMonth[m][day] || 0) + (parseFloat(o.supply) || 0);
  });
  const histMonths = Object.keys(byMonth).filter(m => m < ym).sort().slice(-6); // 최근 완료 6개월
  const fracs = [];
  histMonths.forEach(m => {
    const days = byMonth[m];
    const total = Object.values(days).reduce((s, v) => s + v, 0);
    if (total <= 0) return;
    const [yy, mm] = m.split('-').map(Number);
    const monthLen = new Date(yy, mm, 0).getDate();
    const upto = Math.min(curDay, monthLen);
    let cum = 0;
    for (let d = 1; d <= upto; d++) cum += (days[d] || 0);
    fracs.push(cum / total);
  });
  if (!fracs.length) return null;
  return fracs.reduce((s, v) => s + v, 0) / fracs.length;
}

function renderSalesPage(options = {}) {
  const refreshIndependentSections = options.refreshIndependentSections !== false;
  const {
    ym,
    today,
    isCurrentMonth,
    year: selectedYear,
    month: selectedMonth,
    periodEnd,
    monthStart,
    monthLabel,
    shortMonthLabel,
  } = salesMonthContext('summary');
  const monthNavLabel = document.getElementById('sh-month-nav-label');
  const monthNext = document.getElementById('sh-month-next');
  if (monthNavLabel) monthNavLabel.textContent = monthLabel;
  if (monthNext) monthNext.disabled = isCurrentMonth;
  const totalTitle = document.getElementById('sh-total-title');
  const officeTitle = document.getElementById('sh-office-title');
  const distTitle = document.getElementById('sh-dist-title');
  if (totalTitle) totalTitle.textContent = `${shortMonthLabel} 합계 매출`;
  if (officeTitle) officeTitle.textContent = `${shortMonthLabel} 사업소 매출`;
  if (distTitle) distTitle.textContent = `${shortMonthLabel} 유통사 매출`;
  const basisMeta = getOrderBasisMeta();
  const monthEntries = allEntries.filter(e => e.date?.startsWith(ym));
  const erpMonth = allOrders.filter(e => {
    const d = e.date || '';
    return d >= monthStart && d <= periodEnd;
  });
  const useErpForCharts = erpMonth.length > 0;
  // ── 채널 분류 (사업소 / 유통사) ──
  //  · 사업소: 영업사원이 이기현·장재순·이민우·안성종 중 한 명 (고객분류 도매(이름))
  //  · 유통사: 고객분류 == "도도매/유통사" (수집 시 channel='dist'로 표시)
  const isOffice = o => orderChannel(o) === 'office';
  const isDist   = o => orderChannel(o) === 'dist';

  const erpMonthOffice = erpMonth.filter(isOffice);
  const erpMonthDist   = erpMonth.filter(isDist);
  const monthOfficeSales = sumSupplyRounded(erpMonthOffice);
  const monthDistSales   = sumSupplyRounded(erpMonthDist);
  // 합계 매출 = 사업소 + 유통사 (상품 기준)
  const monthSales = useErpForCharts
    ? (monthOfficeSales + monthDistSales)
    : monthEntries.reduce((s,e) => s+(e.ourPurchase||0),0);

  const prevM = new Date(selectedYear, selectedMonth - 2, 1);
  const prevYm = prevM.getFullYear()+'-'+String(prevM.getMonth()+1).padStart(2,'0');
  const prevMonthRows = allOrders.filter(e => (e.date||'').startsWith(prevYm));
  const prevMonthSales = useErpForCharts
    ? (sumSupplyRounded(prevMonthRows.filter(isOffice)) + sumSupplyRounded(prevMonthRows.filter(isDist)))
    : allEntries.filter(e => e.date?.startsWith(prevYm)).reduce((s,e) => s + (e.ourPurchase||0), 0);
  const monthDiff = prevMonthSales > 0 ? ((monthSales - prevMonthSales) / prevMonthSales * 100) : 0;
  // 전월 동월 채널별 (사업소/유통사 카드 전월 대비용)
  const prevMonthOfficeSales = sumSupplyRounded(prevMonthRows.filter(isOffice));
  const prevMonthDistSales   = sumSupplyRounded(prevMonthRows.filter(isDist));
  const officeDiff = prevMonthOfficeSales > 0 ? ((monthOfficeSales - prevMonthOfficeSales) / prevMonthOfficeSales * 100) : 0;
  const distDiff   = prevMonthDistSales   > 0 ? ((monthDistSales   - prevMonthDistSales)   / prevMonthDistSales   * 100) : 0;
  const officeShare = monthSales > 0 ? Math.round(monthOfficeSales / monthSales * 100) : 0;
  const distShare = monthSales > 0 ? Math.round(monthDistSales / monthSales * 100) : 0;
  const selectedPlanTarget = getPlanSalesTargetsForMonth(ym);
  const officeTarget = selectedPlanTarget?.office || parseFloat(targets.officeSalesTarget) || 0;
  const distTarget = selectedPlanTarget?.dist || parseFloat(targets.distSalesTarget) || 0;
  const teamSalesTarget = (officeTarget + distTarget) || (parseFloat(targets.salesTarget) || 0);
  const setSalesKpiTarget = (barId, pctId, labelId, actual, target) => {
    const bar = document.getElementById(barId);
    const pctEl = document.getElementById(pctId);
    const lblEl = document.getElementById(labelId);
    if (target > 0) {
      const pct = Math.min(Math.round(actual / target * 100), 999);
      if (bar) bar.style.width = Math.min(pct, 100) + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (lblEl) lblEl.textContent = '목표 ' + target.toLocaleString() + '원';
    } else {
      if (bar) bar.style.width = '0%';
      if (pctEl) pctEl.textContent = '-';
      if (lblEl) lblEl.textContent = '목표 미설정';
    }
  };

  document.getElementById('sh-month-val').textContent = monthSales.toLocaleString();
  setSalesKpiTarget('sh-sales-target-bar', 'sh-sales-target-pct', 'sh-sales-target-label', monthSales, teamSalesTarget);
  document.getElementById('sh-month-sub').innerHTML = prevMonthSales > 0
    ? `전월 대비 <span class="sales-kpi-badge ${monthDiff>=0?'up':'down'}">${monthDiff>=0?'▲':'▼'} ${Math.abs(monthDiff).toFixed(1)}%</span>`
    : `${useErpForCharts ? erpMonth.length+'건 '+basisMeta.action+' 기준' : monthEntries.length+'건 방문 기준'}`;

  // 카드2 (구 오늘 매출 → 이번달 누적 사업소 매출)
  document.getElementById('sh-today-val').textContent = monthOfficeSales.toLocaleString();
  setSalesKpiTarget('sh-office-target-bar', 'sh-office-target-pct', 'sh-office-target-label', monthOfficeSales, officeTarget);
  document.getElementById('sh-today-sub').innerHTML = prevMonthOfficeSales > 0
    ? `전월 대비 <span class="sales-kpi-badge ${officeDiff>=0?'up':'down'}">${officeDiff>=0?'▲':'▼'} ${Math.abs(officeDiff).toFixed(1)}%</span> · 비중 ${officeShare}%`
    : `${erpMonthOffice.length}건 · 비중 ${officeShare}%`;

  // 카드3 (구 어제 매출 → 이번달 누적 유통사 매출)
  document.getElementById('sh-yesterday-val').textContent = monthDistSales.toLocaleString();
  setSalesKpiTarget('sh-dist-target-bar', 'sh-dist-target-pct', 'sh-dist-target-label', monthDistSales, distTarget);
  document.getElementById('sh-yesterday-sub').innerHTML = prevMonthDistSales > 0
    ? `전월 대비 <span class="sales-kpi-badge ${distDiff>=0?'up':'down'}">${distDiff>=0?'▲':'▼'} ${Math.abs(distDiff).toFixed(1)}%</span> · 비중 ${distShare}%`
    : `${erpMonthDist.length}건 · 비중 ${distShare}%`;

  const daysInMonth = new Date(parseInt(ym.split('-')[0]), parseInt(ym.split('-')[1]), 0).getDate();
  const dailyDowType = [];
  for (let d=1; d<=daysInMonth; d++) {
    const ds = ym + '-' + String(d).padStart(2,'0');
    const dow = new Date(ds).getDay();
    const holidayName = krHolidayName(ds);
    dailyDowType.push(holidayName ? 'holiday' : dow === 0 ? 'sun' : dow === 6 ? 'sat' : 'weekday');
  }
  const workdays = dailyDowType.filter(t => t === 'weekday').length;
  const passedWorkdays = dailyDowType.filter((t,i) => { const ds = ym+'-'+String(i+1).padStart(2,'0'); return t === 'weekday' && ds <= periodEnd; }).length;
  // 월말 매출 예측 (과거 월별 페이싱 반영 — 월초 집중/월말 감소 패턴 보정, 데이터 부족 시 선형 fallback)
  // 합계 카드는 사업소+유통사 예측을 다시 합산해서 실제 매출 집계식과 맞춘다.
  const calcForecast = (actual, rowFilter) => {
    if (!(isCurrentMonth && useErpForCharts && passedWorkdays > 0 && passedWorkdays < workdays)) return null;
    if (actual <= 0) return { forecast: 0, empty: true };
    const pace = forecastMonthByPacing(ym, today, rowFilter);
    const usePace = pace && pace >= 0.05;
    const forecast = usePace
      ? Math.round(actual / pace)
      : Math.round(actual / passedWorkdays * workdays);
    return { forecast, pace, usePace };
  };
  const setForecastText = (id, info, target, title) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (info && !info.empty) {
      let s = `📈 예상 월말 ${info.forecast.toLocaleString()}원`;
      if (target) s += ` · 목표 ${Math.min(Math.round(info.forecast / target * 100), 999)}%`;
      el.textContent = s;
      el.title = title || (info.usePace
        ? `과거 매출 페이싱 반영 (이번달 ${today.slice(8,10)}일까지 보통 ${Math.round(info.pace*100)}% 시점)`
        : '경과 영업일 기준 단순 추정');
    } else {
      el.textContent = '';
      el.title = '';
    }
  };
  const officeForecast = calcForecast(monthOfficeSales, isOffice);
  const distForecast = calcForecast(monthDistSales, isDist);
  const hasOfficeForecast = officeForecast && !officeForecast.empty;
  const hasDistForecast = distForecast && !distForecast.empty;
  const totalForecast = (hasOfficeForecast || hasDistForecast)
    ? {
        forecast: (officeForecast?.forecast || 0) + (distForecast?.forecast || 0),
        usePace: true,
      }
    : null;
  setForecastText(
    'sh-month-forecast',
    totalForecast,
    teamSalesTarget,
    '사업소 예상 월말과 유통사 예상 월말을 합산한 값입니다.'
  );
  setForecastText('sh-office-forecast', officeForecast, officeTarget);
  setForecastText('sh-dist-forecast', distForecast, distTarget);
  if (refreshIndependentSections) {
    renderSalesTrendMonth();
    renderSalesRankMonth('office');
    renderSalesRankMonth('dist');
    renderSalesPersonMonth();
  }
}

function renderDashPage() {
  try {
    const now = new Date();
    const today = ymdLocal(now);
    const ym = today.slice(0,7);
    const isAdmin = isAdminUser(currentUser);
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
    const dLabels=[], dData=[], dColors=[], dDows=[];
    for(let i=13;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i);
      const ds=ymdLocal(d);
      const dow=d.getDay(); const mmdd=ds.slice(5);
      const hol=krHolidayName(ds), isRed=hol||dow===0||dow===6;
      dLabels.push([ds.slice(8)+'일', DOW[dow]]);
      dData.push(pool.filter(e=>e.date===ds).length);
      dColors.push(isRed?'#D94040CC':'#2B72C8CC');
      dDows.push(hol?'holiday':dow===0?'sun':dow===6?'sat':'weekday');
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
      ? emptyState('이번달 방문 기록이 없습니다', '일간일지에서 방문을 등록해 보세요', '📝')
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
      ? emptyState('표시할 데이터가 없습니다', '기간·필터를 바꾸거나 ERP 동기화를 확인해 보세요', '📊')
      : top10.map(([name,c],i)=>`<div class="leader-item"><div class="leader-rank">${i+1}</div><div class="leader-name c360-link" style="font-size:12px" onclick="event.stopPropagation();openClient360('${escInlineJs(name)}')" title="거래처 상세 보기">${escHtml(name)}</div><div class="leader-bar-wrap"><div class="leader-bar-fill" style="width:${c/maxT*100}%;background:var(--blue)"></div></div><div class="leader-num" style="color:var(--blue)">${c}회</div></div>`).join('');

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

function renderSalesPersonMonth() {
  const {
    ym,
    isCurrentMonth,
    periodEnd,
    monthStart,
    monthLabel,
    shortMonthLabel,
  } = salesMonthContext('person');
  const monthLabelEl = document.getElementById('sh-person-month-label');
  const nextEl = document.getElementById('sh-person-month-next');
  if (monthLabelEl) monthLabelEl.textContent = monthLabel;
  if (nextEl) nextEl.disabled = isCurrentMonth;

  const basisMeta = getOrderBasisMeta();
  const monthEntries = allEntries.filter(row => row.date?.startsWith(ym));
  const erpMonth = allOrders.filter(row => {
    const date = row.date || '';
    return date >= monthStart && date <= periodEnd;
  });
  const useErp = erpMonth.length > 0;
  const sourceRows = useErp
    ? erpMonth.filter(row => orderChannel(row) === 'office')
    : monthEntries.filter(row => orderChannel(row) !== 'dist');
  const salesByPerson = {};
  const countByPerson = {};
  sourceRows.forEach(row => {
    const person = String(row.person || '').trim();
    if (!person || person === '도도매/유통사') return;
    const amount = useErp ? (parseFloat(row.supply) || 0) : (parseFloat(row.ourPurchase) || 0);
    salesByPerson[person] = (salesByPerson[person] || 0) + amount;
    countByPerson[person] = (countByPerson[person] || 0) + 1;
  });

  const personList = Object.entries(salesByPerson).sort((a, b) => b[1] - a[1]);
  const maxPerson = personList[0]?.[1] || 1;
  const personSalesTargets = {};
  allUsers.forEach(user => {
    personSalesTargets[user.name] = (targets.personalSales || {})[user.id] || 0;
  });
  const fixedPersonColors = {
    '장재순': '#E53935',
    '이민우': '#2B72C8',
    '안성종': '#43A047',
  };
  const personColors = ['#E8900A','#7856C8','#26c6da','#8D6E63','#607D8B'];
  const getPersonColor = (name, index) => {
    const personName = String(name || '').trim();
    if (fixedPersonColors[personName]) return fixedPersonColors[personName];
    const user = allUsers.find(item => item.name === personName);
    return user?.color || personColors[index % personColors.length];
  };
  const basisText = useErp ? `${shortMonthLabel} ${basisMeta.label} 공급가 기준 (원)` : `${shortMonthLabel} 당사 구매액 기준 (원)`;
  const personSub = document.getElementById('sh-person-sub');
  const shareSub = document.getElementById('sh-person-share-sub');
  if (personSub) personSub.textContent = basisText;
  if (shareSub) shareSub.textContent = `${shortMonthLabel} 기준`;

  const listEl = document.getElementById('sh-person-list');
  if (listEl) {
    listEl.innerHTML = personList.length === 0
      ? emptyState(`${monthLabel} 매출이 없습니다`, '다른 월을 선택하거나 ERP 동기화를 확인해 보세요', '📊')
      : personList.map(([name, amount], index) => {
          const target = personSalesTargets[name] || 0;
          const achievement = target ? Math.min(Math.round(amount / target * 100), 999) : null;
          const color = getPersonColor(name, index);
          const barWidth = target ? Math.min(amount / target * 100, 100) : (amount / maxPerson * 100);
          const targetText = target
            ? `<span style="font-size:11px;color:var(--text3)">목표 ${target.toLocaleString()}만</span>`
            : '<span style="font-size:11px;color:var(--text3)">목표 미설정</span>';
          const achievementText = achievement !== null
            ? `<span style="font-size:13px;font-weight:700;font-family:var(--mono);color:${color}">${achievement}%</span>`
            : '<span style="font-size:11px;color:var(--text3)">-</span>';
          return `<div class="leader-item"><div class="leader-rank ${['r1','r2','r3'][index] || ''}">${index + 1}</div><div class="leader-name">${escHtml(name)}<div class="leader-meta">${countByPerson[name] || 0}건 ${useErp ? basisMeta.action : ''} ${targetText}</div></div><div class="leader-bar-wrap"><div class="leader-bar-fill" style="width:${barWidth}%;background:${color}"></div></div><div class="leader-num" style="color:${color};font-weight:700">${Math.round(amount).toLocaleString()}<br>${achievementText}</div></div>`;
        }).join('');
  }
  rc(
    'chart-person-sales',
    'doughnut',
    personList.map(item => item[0]),
    personList.map(item => item[1]),
    personList.map((item, index) => getPersonColor(item[0], index))
  );
}

function renderSalesTrendMonth() {
  const {
    ym,
    today,
    isCurrentMonth,
    year,
    month,
    periodEnd,
    monthStart,
    monthLabel,
  } = salesMonthContext('trend');
  const labelEl = document.getElementById('sh-chart-month-nav-label');
  const nextEl = document.getElementById('sh-chart-month-next');
  const chartLabel = document.getElementById('sh-chart-label');
  if (labelEl) labelEl.textContent = monthLabel;
  if (nextEl) nextEl.disabled = isCurrentMonth;
  if (chartLabel) chartLabel.textContent = monthLabel;

  const monthEntries = allEntries.filter(e => e.date?.startsWith(ym));
  const erpMonth = allOrders.filter(e => {
    const date = e.date || '';
    return date >= monthStart && date <= periodEnd;
  });
  const useErp = erpMonth.length > 0;
  const isOffice = row => orderChannel(row) === 'office';
  const isDist = row => orderChannel(row) === 'dist';
  const isTrackedSales = row => isOffice(row) || isDist(row);
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = [];
  const dowTypes = [];
  const office = [];
  const dist = [];
  const total = [];
  const dayNames = ['일','월','화','수','목','금','토'];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${ym}-${String(day).padStart(2, '0')}`;
    const dow = new Date(date).getDay();
    const holidayName = krHolidayName(date);
    dowTypes.push(holidayName ? 'holiday' : dow === 0 ? 'sun' : dow === 6 ? 'sat' : 'weekday');
    labels.push([`${day}일`, dayNames[dow]]);
    const officeAmount = useErp
      ? (date > periodEnd ? 0 : Math.round(allOrders.filter(row => row.date === date && isOffice(row)).reduce((sum, row) => sum + (parseFloat(row.supply) || 0), 0)))
      : Math.round(monthEntries.filter(row => row.date === date && isOffice(row)).reduce((sum, row) => sum + (parseFloat(row.ourPurchase) || 0), 0));
    const distAmount = useErp
      ? (date > periodEnd ? 0 : Math.round(allOrders.filter(row => row.date === date && isDist(row)).reduce((sum, row) => sum + (parseFloat(row.supply) || 0), 0)))
      : Math.round(monthEntries.filter(row => row.date === date && isDist(row)).reduce((sum, row) => sum + (parseFloat(row.ourPurchase) || 0), 0));
    office.push(officeAmount);
    dist.push(distAmount);
    total.push(officeAmount + distAmount);
  }

  const workdays = dowTypes.filter(type => type === 'weekday').length;
  const passedWorkdays = dowTypes.filter((type, index) => {
    const date = `${ym}-${String(index + 1).padStart(2, '0')}`;
    return type === 'weekday' && date <= periodEnd;
  }).length;
  const workdaysEl = document.getElementById('sh-workdays-label');
  if (workdaysEl) workdaysEl.textContent = `영업일 ${workdays}일 (경과 ${passedWorkdays}일)`;

  const calcForecast = (actual, rowFilter) => {
    if (!(isCurrentMonth && useErp && passedWorkdays > 0 && passedWorkdays < workdays) || actual <= 0) return null;
    const pace = forecastMonthByPacing(ym, today, rowFilter);
    return Math.round(pace && pace >= 0.05 ? actual / pace : actual / passedWorkdays * workdays);
  };
  const officeTotal = office.reduce((sum, value) => sum + value, 0);
  const distTotal = dist.reduce((sum, value) => sum + value, 0);
  const pointIndex = isCurrentMonth
    ? Math.min(Math.max(parseInt(today.slice(8, 10), 10) - 1, 0), daysInMonth - 1)
    : daysInMonth - 1;

  renderSalesTrendChart({
    ym,
    labels,
    dowTypes,
    total,
    office,
    dist,
    avgFlow: buildSalesTrendAverage(ym, daysInMonth, isTrackedSales, useErp),
    officeBase: Math.max(officeTotal, calcForecast(officeTotal, isOffice) || 0),
    distBase: Math.max(distTotal, calcForecast(distTotal, isDist) || 0),
    pointIndex,
    cutoffIndex: pointIndex,
    workdays,
    passedWorkdays,
  });
}

function renderSalesRankMonth(kind) {
  if (kind !== 'office' && kind !== 'dist') return;
  const {
    ym,
    isCurrentMonth,
    periodEnd,
    monthStart,
    monthLabel,
    shortMonthLabel,
  } = salesMonthContext(kind);
  const label = kind === 'office' ? '사업소' : '유통사';
  const monthLabelEl = document.getElementById(`sh-rank-${kind}-month-label`);
  const nextEl = document.getElementById(`sh-rank-${kind}-next`);
  const titleEl = document.getElementById(`sh-rank-${kind}-title`);
  if (monthLabelEl) monthLabelEl.textContent = monthLabel;
  if (nextEl) nextEl.disabled = isCurrentMonth;
  if (titleEl) titleEl.textContent = `${shortMonthLabel} ${label} 매출 순위`;

  const basisMeta = getOrderBasisMeta();
  const monthEntries = allEntries.filter(row => row.date?.startsWith(ym));
  const erpMonth = allOrders.filter(row => {
    const date = row.date || '';
    return date >= monthStart && date <= periodEnd;
  });
  const useErp = erpMonth.length > 0;
  const rowFilter = row => orderChannel(row) === kind;
  const sourceRows = useErp ? erpMonth.filter(rowFilter) : monthEntries.filter(rowFilter);
  const rankMap = {};
  sourceRows.forEach(row => {
    const name = String(row.client || row.institution || '').trim();
    if (!name) return;
    const amount = useErp ? (parseFloat(row.supply) || 0) : (parseFloat(row.ourPurchase) || 0);
    rankMap[name] = (rankMap[name] || 0) + amount;
  });

  const basisText = useErp ? `${basisMeta.label} 공급가 기준 (원)` : '당사 구매액 기준 (원)';
  const subEl = document.getElementById(`sh-rank-${kind}-sub`);
  if (subEl) subEl.textContent = basisText;
  window._shRankLists = window._shRankLists || {};
  window._shRankLists[kind] = Object.entries(rankMap).sort((a, b) => b[1] - a[1]);
  window._shRankExportMeta = window._shRankExportMeta || {};
  window._shRankExportMeta[kind] = {
    ym,
    periodEnd,
    basis: basisText,
    source: useErp ? `${basisMeta.label} ERP 공급가` : '당사 구매액',
  };
  window._shRankPages = window._shRankPages || {};
  window._shRankPages[kind] = 1;
  shRenderRankPage(kind);
}

function shRenderRankPage(kind = 'office') {
  const list = (window._shRankLists && window._shRankLists[kind]) || [];
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  window._shRankPages = window._shRankPages || {};
  let page = window._shRankPages[kind] || 1;
  if (page > totalPages) page = totalPages;
  window._shRankPages[kind] = page;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);
  const maxRank = list[0]?.[1] || 1;
  const totalRankAmt = list.reduce((s, r) => s + r[1], 0);
  const medalIcons = ['🥇','🥈','🥉'];
  const color = kind === 'dist' ? 'var(--amber)' : 'var(--green-dark)';
  const listEl = document.getElementById(`sh-rank-${kind}-list`);
  const pagerEl = document.getElementById(`sh-rank-${kind}-pager`);
  if (!listEl || !pagerEl) return;
  const rankMeta = (window._shRankExportMeta && window._shRankExportMeta[kind]) || {};
  listEl.innerHTML = pageItems.length === 0
    ? emptyState(`${salesDashboardMonthLabel(rankMeta.ym || salesDashboardCurrentYm())} 매출이 없습니다`, '다른 월을 선택해 보세요', '📊')
    : pageItems.map(([name, amt], idx) => {
        const globalIdx = start + idx;
        const pct = totalRankAmt ? (amt / totalRankAmt * 100).toFixed(2) : '0.00';
        const medal = globalIdx < 3 ? `<span style="font-size:15px;line-height:1;width:24px;text-align:center;flex-shrink:0">${medalIcons[globalIdx]}</span>` : `<div class="leader-rank">${globalIdx+1}</div>`;
        return `<div class="leader-item">
          ${medal}
          <div class="leader-name c360-link" style="font-size:12px" onclick="event.stopPropagation();openClient360('${escInlineJs(name)}')" title="거래처 상세 보기">${escHtml(name)}</div>
          <div class="leader-bar-wrap"><div class="leader-bar-fill" style="width:${amt/maxRank*100}%;background:${color}"></div></div>
          <div class="leader-num sales-rank-num" style="color:${color}">
            <span class="sales-rank-amount">${Math.round(amt).toLocaleString()}</span>
            <span class="sales-rank-pct">${pct}%</span>
          </div>
        </div>`;
      }).join('');
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

  let html = `<button style="${prevDisabled?disabledStyle:btnStyle}" ${prevDisabled?'disabled':''} onclick="shRankPageMove('${kind}',-1)">‹</button>`;
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) html += `<span style="${ellipsisStyle}">...</span>`;
    html += `<button style="${p===page?activeStyle:btnStyle}" onclick="shRankGoPage('${kind}',${p})">${p}</button>`;
    prev = p;
  }
  html += `<button style="${nextDisabled?disabledStyle:btnStyle}" ${nextDisabled?'disabled':''} onclick="shRankPageMove('${kind}',1)">›</button>`;
  html += `<span style="color:var(--text3);font-size:11px;margin-left:8px">${page}/${totalPages} · 총 ${list.length}개</span>`;
  pagerEl.innerHTML = html;
}
function shRankPageMove(kind, dir) {
  const list = (window._shRankLists && window._shRankLists[kind]) || [];
  const totalPages = Math.max(1, Math.ceil(list.length / 10));
  window._shRankPages = window._shRankPages || {};
  window._shRankPages[kind] = Math.max(1, Math.min(totalPages, (window._shRankPages[kind]||1) + dir));
  shRenderRankPage(kind);
}
function shRankGoPage(kind, p) {
  window._shRankPages = window._shRankPages || {};
  window._shRankPages[kind] = p;
  shRenderRankPage(kind);
}

function downloadShRankExcel(kind = 'office') {
  const list = (window._shRankLists && window._shRankLists[kind]) || [];
  if (!list.length) {
    showToast('다운로드할 매출 순위 데이터가 없습니다.', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    return;
  }

  const meta = (window._shRankExportMeta && window._shRankExportMeta[kind]) || {};
  const total = list.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);
  const label = kind === 'office' ? '사업소' : '유통사';
  const rows = list.map(([name, amount], index) => {
    const sales = Math.round(Number(amount) || 0);
    return {
      '순위': index + 1,
      [label]: name,
      '매출액(원)': sales,
      '비중(%)': total ? Number((sales / total * 100).toFixed(2)) : 0,
      '기준': meta.source || '',
      '기간': meta.ym ? `${meta.ym}-01 ~ ${meta.periodEnd || ''}` : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 34 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 24 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${label} 매출 순위`);
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
  XLSX.writeFile(workbook, `${label}_매출순위_${meta.ym || ymLocal(now)}_${stamp}.xlsx`);
  showToast(`${label} 매출 순위 엑셀 파일이 다운로드됩니다.`, 'success');
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

function setSalesTrendMode(mode) {
  salesTrendMode = ['amount', 'flow', 'share'].includes(mode) ? mode : 'amount';
  document.querySelectorAll('.sales-trend-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.salesTrendMode === salesTrendMode);
  });
  if (salesTrendPayload) renderSalesTrendChart(salesTrendPayload);
}

function buildSalesTrendAverage(ym, daysInMonth, rowFilter, useErpForCharts) {
  const source = useErpForCharts ? (allOrders || []) : (allEntries || []);
  const byMonth = {};
  source.forEach(row => {
    if (rowFilter && !rowFilter(row)) return;
    const d = row.date || '';
    if (d.length < 10) return;
    const m = d.slice(0, 7);
    if (m >= ym) return;
    const day = parseInt(d.slice(8, 10), 10);
    if (!day) return;
    const amount = useErpForCharts ? (parseFloat(row.supply) || 0) : (parseFloat(row.ourPurchase) || 0);
    if (!amount) return;
    if (!byMonth[m]) byMonth[m] = {};
    byMonth[m][day] = (byMonth[m][day] || 0) + amount;
  });
  const months = Object.keys(byMonth).sort().slice(-6);
  if (!months.length) return Array.from({ length: daysInMonth }, (_, i) => Math.round((i + 1) / daysInMonth * 100));

  const sums = Array(daysInMonth).fill(0);
  let count = 0;
  months.forEach(m => {
    const days = byMonth[m];
    const total = Object.values(days).reduce((s, v) => s + v, 0);
    if (total <= 0) return;
    const [yy, mm] = m.split('-').map(Number);
    const monthLen = new Date(yy, mm, 0).getDate();
    let cum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= monthLen) cum += (days[d] || 0);
      sums[d - 1] += Math.min(100, Math.round(cum / total * 100));
    }
    count++;
  });
  if (!count) return Array.from({ length: daysInMonth }, (_, i) => Math.round((i + 1) / daysInMonth * 100));
  return sums.map(v => Math.round(v / count));
}

function salesTrendCum(values) {
  let total = 0;
  return values.map(v => {
    total += Number(v) || 0;
    return total;
  });
}

function salesTrendPct(values, base) {
  const cum = salesTrendCum(values);
  const denom = Math.max(Number(base) || 0, cum[cum.length - 1] || 0);
  if (!denom) return values.map(() => 0);
  return cum.map(v => Math.min(100, Math.round(v / denom * 1000) / 10));
}

function salesTrendClipFuture(values, cutoffIndex) {
  const cutoff = Number.isFinite(cutoffIndex) ? cutoffIndex : values.length - 1;
  return values.map((v, i) => i <= cutoff ? v : null);
}

function salesTrendMoney(v) {
  return Math.round(Number(v) || 0).toLocaleString() + '원';
}

function salesTrendClassify(series) {
  const day5 = series[Math.min(4, series.length - 1)] || 0;
  const day15 = series[Math.min(14, series.length - 1)] || 0;
  if (day5 >= 32) return { label: '월초 집중형', text: `월 매출의 ${Math.round(day5)}%가 초반 5일 안에 쌓인 패턴입니다.` };
  if (day15 >= 70) return { label: '중반 집중형', text: `월 매출의 ${Math.round(day15)}%가 15일 전후까지 쌓인 패턴입니다.` };
  return { label: '완만한 후행형', text: '월 매출이 초반에 몰리지 않고 중후반까지 나누어 쌓이는 패턴입니다.' };
}

function renderSalesTrendInsights(payload, derived) {
  const el = document.getElementById('sales-trend-insights');
  if (!el || !payload) return;
  const sum = arr => arr.reduce((s, v) => s + (Number(v) || 0), 0);
  const officeTotal = sum(payload.office);
  const distTotal = sum(payload.dist);
  const total = officeTotal + distTotal;
  const idx = Math.max(0, Math.min(payload.pointIndex || 0, payload.labels.length - 1));

  if (salesTrendMode === 'flow') {
    const officeInfo = salesTrendClassify(derived.officeFlow);
    const distInfo = salesTrendClassify(derived.distFlow);
    const diff = Math.round(((derived.officeFlow[idx] || 0) - (derived.distFlow[idx] || 0)) * 10) / 10;
    const officePct = derived.officeFlow[idx] || 0;
    const distPct = derived.distFlow[idx] || 0;
    el.innerHTML = `
      <div class="sales-trend-insight">
        <div class="sales-trend-insight-label">사업소 누적률</div>
        <div class="sales-trend-insight-value office">${officePct}%</div>
        <p>${idx + 1}일까지 사업소 월 매출이 전체의 ${officePct}%까지 쌓였습니다. ${officeInfo.text}</p>
      </div>
      <div class="sales-trend-insight">
        <div class="sales-trend-insight-label">유통사 누적률</div>
        <div class="sales-trend-insight-value dist">${distPct}%</div>
        <p>${idx + 1}일까지 유통사 월 매출이 전체의 ${distPct}%까지 쌓였습니다. ${distInfo.text}</p>
      </div>
      <div class="sales-trend-insight is-summary">
        <div class="sales-trend-insight-label">${idx + 1}일 기준 누적률 차이</div>
        <div class="sales-trend-insight-value">${diff >= 0 ? '+' : ''}${diff}%p</div>
        <p>${diff >= 0 ? '사업소가 유통사보다 이번 달 매출이 더 빠르게 쌓이고 있습니다.' : '유통사가 사업소보다 이번 달 매출이 더 빠르게 쌓이고 있습니다.'}</p>
      </div>`;
    return;
  }

  if (salesTrendMode === 'share') {
    const distShare = total ? Math.round(distTotal / total * 1000) / 10 : 0;
    const officeShare = total ? Math.round(officeTotal / total * 1000) / 10 : 0;
    const validDaily = derived.dailyDistShare.filter(v => v !== null);
    const avgDaily = validDaily.length ? Math.round(validDaily.reduce((s, v) => s + v, 0) / validDaily.length * 10) / 10 : 0;
    el.innerHTML = `
      <div class="sales-trend-insight">
        <div class="sales-trend-insight-label">누적 사업소 비중</div>
        <div class="sales-trend-insight-value office">${officeShare}%</div>
        <p>현재 누적 합계 매출 중 사업소가 차지하는 비율입니다.</p>
      </div>
      <div class="sales-trend-insight">
        <div class="sales-trend-insight-label">누적 유통사 비중</div>
        <div class="sales-trend-insight-value dist">${distShare}%</div>
        <p>현재 누적 합계 매출 중 유통사가 차지하는 비율입니다.</p>
      </div>
      <div class="sales-trend-insight is-summary">
        <div class="sales-trend-insight-label">일별 평균 유통사 비중</div>
        <div class="sales-trend-insight-value">${avgDaily}%</div>
        <p>매출이 발생한 날짜만 기준으로 계산했습니다.</p>
      </div>`;
    return;
  }

  let topIdx = 0;
  payload.total.forEach((v, i) => { if (v > payload.total[topIdx]) topIdx = i; });
  el.innerHTML = `
    <div class="sales-trend-insight">
      <div class="sales-trend-insight-label">합계 매출</div>
      <div class="sales-trend-insight-value">${salesTrendMoney(total)}</div>
      <p>사업소와 유통사 일별 매출을 합산한 금액입니다.</p>
    </div>
    <div class="sales-trend-insight">
      <div class="sales-trend-insight-label">사업소 / 유통사</div>
      <div class="sales-trend-insight-value office">${Math.round(total ? officeTotal / total * 100 : 0)}% / ${Math.round(total ? distTotal / total * 100 : 0)}%</div>
      <p>${salesTrendMoney(officeTotal)} / ${salesTrendMoney(distTotal)}</p>
    </div>
    <div class="sales-trend-insight is-summary">
      <div class="sales-trend-insight-label">최고 매출일</div>
      <div class="sales-trend-insight-value">${topIdx + 1}일</div>
      <p>${salesTrendMoney(payload.total[topIdx])} 발생</p>
    </div>`;
}

function renderSalesTrendChart(payload) {
  if (!payload) return;
  salesTrendPayload = payload;
  document.querySelectorAll('.sales-trend-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.salesTrendMode === salesTrendMode);
  });

  const id = 'chart-sales-daily';
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;

  const chartLabels = payload.labels.map(l => Array.isArray(l) ? l : [l]);
  const cutoffIndex = Number.isFinite(payload.cutoffIndex) ? payload.cutoffIndex : chartLabels.length - 1;
  const officeFlow = salesTrendPct(payload.office, payload.officeBase);
  const distFlow = salesTrendPct(payload.dist, payload.distBase);
  const officeCum = salesTrendCum(payload.office);
  const distCum = salesTrendCum(payload.dist);
  const dailyDistShare = payload.total.map((v, i) => v > 0 ? Math.round((payload.dist[i] || 0) / v * 1000) / 10 : null);
  const cumDistShare = payload.total.map((_, i) => {
    const total = (officeCum[i] || 0) + (distCum[i] || 0);
    return total > 0 ? Math.round((distCum[i] || 0) / total * 1000) / 10 : null;
  });
  const derived = { officeFlow, distFlow, dailyDistShare, cumDistShare };
  renderSalesTrendInsights(payload, derived);
  const officeFlowChart = salesTrendClipFuture(officeFlow, cutoffIndex);
  const distFlowChart = salesTrendClipFuture(distFlow, cutoffIndex);
  const avgFlowChart = salesTrendClipFuture(payload.avgFlow || [], cutoffIndex);
  const dailyDistShareChart = salesTrendClipFuture(dailyDistShare, cutoffIndex);
  const cumDistShareChart = salesTrendClipFuture(cumDistShare, cutoffIndex);
  const officeAmountChart = salesTrendClipFuture(payload.office, cutoffIndex);
  const distAmountChart = salesTrendClipFuture(payload.dist, cutoffIndex);

  const dailyAxisLabels = {
    id: 'salesTrendAxisLabels',
    afterDraw(chart) {
      const { ctx: c, chartArea: { bottom }, scales: { x } } = chart;
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'top';
      x.ticks.forEach((tick, i) => {
        const xPos = x.getPixelForTick(i);
        const dt = payload.dowTypes ? payload.dowTypes[i] : 'weekday';
        const isRed = dt === 'holiday' || dt === 'sun' || dt === 'sat';
        const lbl = Array.isArray(chartLabels[i]) ? chartLabels[i] : [chartLabels[i]];
        c.fillStyle = '#9AB0AA';
        c.font = '11px Noto Sans KR';
        c.fillText(lbl[0] || '', xPos, bottom + 4);
        if (lbl[1]) {
          c.fillStyle = isRed ? '#D94040' : '#9AB0AA';
          c.font = isRed ? 'bold 13px Noto Sans KR' : '13px Noto Sans KR';
          c.fillText(lbl[1], xPos, bottom + 20);
        }
      });
      c.restore();
    }
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', align: 'end', labels: { color: '#5A706A', font: { size: 11, family: 'Noto Sans KR', weight: '700' }, boxWidth: 10, padding: 14 } },
      datalabels: { display: false },
    },
    scales: {
      x: { ticks: { display: false }, grid: { color: 'rgba(0,100,60,.06)' }, border: { display: false }, afterFit(scale) { scale.paddingBottom = 42; } },
      y: { ticks: { color: '#9AB0AA', font: { size: 10, family: 'Noto Sans KR' } }, grid: { color: 'rgba(0,100,60,.06)' }, border: { display: false } },
    },
  };

  if (salesTrendMode === 'flow') {
    charts[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          { label: '사업소 월 매출 누적률', data: officeFlowChart, borderColor: '#2B72C8', backgroundColor: '#2B72C8', borderWidth: 3, pointRadius: 2.8, pointHoverRadius: 5, tension: .28 },
          { label: '유통사 월 매출 누적률', data: distFlowChart, borderColor: '#76A8E3', backgroundColor: '#76A8E3', borderWidth: 3, pointRadius: 2.8, pointHoverRadius: 5, tension: .28 },
          { label: '과거 월 평균 누적률', data: avgFlowChart, borderColor: '#9AB0AA', backgroundColor: '#9AB0AA', borderWidth: 2, borderDash: [6, 6], pointRadius: 0, tension: .25 },
        ]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? 0}%` } }
        },
        scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, max: 100, ticks: { ...commonOptions.scales.y.ticks, callback: v => v + '%' } } }
      },
      plugins: [dailyAxisLabels]
    });
    return;
  }

  if (salesTrendMode === 'share') {
    charts[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          { label: '일별 유통사 비중', data: dailyDistShareChart, borderColor: '#76A8E3', backgroundColor: 'rgba(118,168,227,.16)', borderWidth: 2, pointRadius: 3, spanGaps: false, tension: .25 },
          { label: '누적 유통사 비중', data: cumDistShareChart, borderColor: '#2B72C8', backgroundColor: '#2B72C8', borderWidth: 3, pointRadius: 2.5, spanGaps: false, tension: .25 },
        ]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? 0}%` } }
        },
        scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, max: 100, ticks: { ...commonOptions.scales.y.ticks, callback: v => v + '%' } } }
      },
      plugins: [dailyAxisLabels]
    });
    return;
  }

  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [
        { label: '사업소', data: officeAmountChart, backgroundColor: '#2B72C8CC', borderColor: '#2B72C8', borderWidth: 0, borderRadius: 5, stack: 'sales', maxBarThickness: 42 },
        { label: '유통사', data: distAmountChart, backgroundColor: '#76A8E3CC', borderColor: '#76A8E3', borderWidth: 0, borderRadius: 5, stack: 'sales', maxBarThickness: 42 },
      ]
    },
    options: {
      ...commonOptions,
      plugins: {
        ...commonOptions.plugins,
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${salesTrendMoney(ctx.parsed.y || 0)}`,
            footer: items => items.length ? `합계: ${salesTrendMoney(payload.total[items[0].dataIndex] || 0)}` : ''
          }
        }
      },
      scales: {
        x: { ...commonOptions.scales.x, stacked: true },
        y: { ...commonOptions.scales.y, stacked: true, ticks: { ...commonOptions.scales.y.ticks, callback: v => Number(v).toLocaleString() } }
      }
    },
    plugins: [dailyAxisLabels]
  });
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
  const isAdmin = isAdminUser(currentUser);
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
function getLoginLogList() {
  const raw = getShared('sj-login-logs-v1', []) || [];
  const list = Array.isArray(raw) ? raw : Object.values(raw || {});
  return list.filter(item => item && item.id).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function readReportActivityEntries(prefix, label) {
  const rows = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const userId = key.slice(prefix.length);
      const reports = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(reports)) continue;
      reports.forEach(report => {
        rows.push({
          id: report.personId || userId,
          name: report.person || '',
          at: report.savedAt || report.updatedAt || report.createdAt || '',
          type: label,
          title: report.title || '',
        });
      });
    }
  } catch (_) {}
  return rows;
}

function getUserActivityList(userId = '') {
  const rows = [];
  (Array.isArray(allEntries) ? allEntries : []).forEach(entry => {
    if (!entry || !entry.personId) return;
    rows.push({
      id: entry.personId,
      name: entry.person || '',
      at: entry.ts || entry.date || '',
      type: '일간일지',
      title: entry.institution || '',
    });
  });
  rows.push(...readReportActivityEntries('sj-weekly-reports-', '주간보고'));
  rows.push(...readReportActivityEntries('sj-monthly-reports-', '월간보고'));
  return rows
    .filter(item => item && item.id && (!userId || item.id === userId))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function getUserAccountStats() {
  const stats = {};
  const ensure = id => stats[id] || (stats[id] = { loginCount: 0, loginLast: '', activityCount: 0, activityLast: '' });
  getLoginLogList().forEach(log => {
    const row = ensure(log.id);
    row.loginCount++;
    if (!row.loginLast || String(log.at || '') > row.loginLast) row.loginLast = log.at || '';
  });
  getUserActivityList().forEach(activity => {
    const row = ensure(activity.id);
    row.activityCount++;
    if (!row.activityLast || String(activity.at || '') > row.activityLast) row.activityLast = activity.at || '';
  });
  return stats;
}

function renderUsers() {
  const colors = ['#009E6A','#2B72C8','#7856C8','#E8900A','#D94040','#26c6da'];
  // 접속기록 집계 (횟수 + 최근 접속)
  const accountStats = getUserAccountStats();
  const fmtLoginAt = iso => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const menuSettingsHtml = u => {
    if (u.id === 'admin') {
      return `<div class="user-menu-fixed">관리자 계정은 전체 메뉴를 항상 사용할 수 있습니다.</div>`;
    }
    const access = new Set(getUserMenuAccess(u));
    return `
      <div class="user-menu-toolbar">
        <button class="btn-sm btn-ghost" onclick="setUserMenuPreset('${escInlineJs(u.id)}','default')">기본 메뉴</button>
        <button class="btn-sm btn-ghost" onclick="setUserMenuPreset('${escInlineJs(u.id)}','all')">전체 메뉴</button>
      </div>
      <div class="user-menu-grid">
        ${MENU_ACCESS_ITEMS.map(item => {
          const fixed = typeof isAlwaysVisibleMenuKey === 'function' && isAlwaysVisibleMenuKey(item.key);
          return `
          <label class="user-menu-check" title="${escHtml(item.label)}">
            <input type="checkbox" ${fixed || access.has(item.key)?'checked':''} ${fixed?'disabled':''} onchange="toggleUserMenuAccess('${escInlineJs(u.id)}','${escInlineJs(item.key)}',this.checked)" />
            <span>${escHtml(item.label)}</span>
          </label>`;
        }).join('')}
      </div>`;
  };

  document.getElementById('users-list').innerHTML = allUsers.map(u=>{
    const uid = escInlineJs(u.id);
    const uname = escHtml(u.name || '');
    const unameJs = escInlineJs(u.name || '');
    const color = /^#[0-9a-f]{6}$/i.test(u.color || '') ? u.color : '#009E6A';
    const stat = accountStats[u.id] || {};
    const displayCount = stat.loginCount || stat.activityCount || 0;
    const displayLast = stat.loginLast || stat.activityLast || '';
    const countLabel = stat.loginCount ? '접속 횟수' : (stat.activityCount ? '활동 기록' : '접속 횟수');
    const lastLabel = stat.loginLast ? '최근 접속' : (stat.activityLast ? '최근 활동' : '최근 접속');
    return `
    <div class="user-card">
      <div class="user-card-avatar" style="background:${color}22;color:${color}">${escHtml((u.name||'').slice(0,1))}</div>
      <div class="user-card-info">
        <div class="user-card-name">${uname}</div>
        <div class="user-card-meta">ID: ${escHtml(u.id)} · 가입일: ${escHtml(u.createdAt||'-')}</div>
      </div>
      <div class="user-card-stats">
        <div class="user-card-count" style="color:var(--blue)">${displayCount}</div>
        <div class="user-card-label">${countLabel}</div>
      </div>
      <div class="user-card-stats">
        <div class="user-card-count" style="font-size:13px;line-height:1.6">${fmtLoginAt(displayLast)}</div>
        <div class="user-card-label">${lastLabel}</div>
      </div>
      <div class="user-card-actions">
        <button class="btn-sm btn-ghost" onclick="openLoginLogs('${uid}')">접속기록</button>
        <button class="btn-sm btn-amber" onclick="openResetPwModal('${uid}','${unameJs}')">비번 초기화</button>
        ${u.id!=='admin'?`<button class="btn-sm btn-danger" onclick="deleteUser('${uid}')">삭제</button>`:''}
      </div>
      <div class="user-menu-settings">
        ${menuSettingsHtml(u)}
      </div>
    </div>`;
  }).join('');
}

// ── 접속기록 모달 ──
function openLoginLogs(userId) {
  const list = getLoginLogList().filter(l => !userId || l.id === userId);
  const activityList = getUserActivityList(userId);
  const titleEl = document.getElementById('login-logs-title');
  if (titleEl) {
    const uname = userId ? (allUsers.find(u=>u.id===userId)?.name || userId) : null;
    titleEl.textContent = uname ? `접속기록 — ${uname}` : '전체 접속기록';
  }
  const body = document.getElementById('login-logs-body');
  if (body) {
    if (!list.length && activityList.length) {
      const fmtActivity = iso => {
        const d = new Date(iso);
        if (isNaN(d)) return '-';
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      };
      body.innerHTML = `<div style="padding:10px 12px;color:var(--text2);font-size:12px;border-bottom:1px solid var(--border)">로그인 기록은 남아있지 않지만, 아래 작성 활동 기록이 확인됩니다.</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            ${['일시','계정','활동','내용'].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.06em;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface)">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${activityList.slice(0,300).map(a=>`
            <tr>
              <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-family:var(--mono)">${escHtml(fmtActivity(a.at))}</td>
              <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-weight:600">${escHtml(a.name||a.id||'-')}</td>
              <td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text2)">${escHtml(a.type||'-')}</td>
              <td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text2)">${escHtml(a.title||'-')}</td>
            </tr>`).join('')}
          </tbody></table>`;
    } else
    if (!list.length) {
      body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">접속기록이 없습니다.<br>이 기능 적용 이후의 로그인부터 기록됩니다.</div>';
    } else {
      const fmt = iso => {
        const d = new Date(iso);
        if (isNaN(d)) return '-';
        const dow = ['일','월','화','수','목','금','토'][d.getDay()];
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} (${dow}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      };
      body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          ${['일시','계정','기기','IP'].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.06em;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface)">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${list.slice(0,300).map(l=>`
          <tr>
            <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-family:var(--mono)">${escHtml(fmt(l.at))}</td>
            <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-weight:600">${escHtml(l.name||l.id||'-')}</td>
            <td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text2)">${escHtml(l.device||'-')}</td>
            <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-family:var(--mono);color:var(--text2)">${escHtml(l.ip||'-')}</td>
          </tr>`).join('')}
        </tbody></table>
        ${list.length>300?`<div style="padding:10px;text-align:center;color:var(--text3);font-size:11px">최근 300건만 표시 (전체 ${list.length}건)</div>`:''}`;
    }
  }
  openModal('modal-login-logs');
}

function openAddUserModal() { openModal('modal-add-user'); }
async function addUser() {
  const name = document.getElementById('nu-name').value.trim();
  const id   = document.getElementById('nu-id').value.trim();
  const pw   = document.getElementById('nu-pw').value;
  if (!name||!id||!pw) { showToast('모든 항목을 입력하세요','error'); return; }
  const idPolicyErr = typeof authValidateUserId === 'function'
    ? authValidateUserId(id)
    : (!/^[A-Za-z0-9_-]{2,32}$/.test(id) ? '아이디는 영문, 숫자, _, - 조합 2~32자만 가능합니다.' : '');
  if (idPolicyErr) { showToast(idPolicyErr, 'error'); return; }
  const pwPolicyErr = authValidatePasswordPolicy(pw, { id, name });
  if (pwPolicyErr) { showToast(pwPolicyErr, 'error'); return; }
  if (allUsers.find(u=>u.id===id)) { showToast('이미 존재하는 아이디입니다.','error'); return; }
  const colors = ['#E53935','#2B72C8','#43A047','#E8900A','#7856C8','#26c6da'];
  allUsers.push({ id, name, passwordHash: await authBuildPasswordRecord(pw), menuAccess: getDefaultMenuAccess('user'), color: colors[allUsers.length % colors.length], createdAt: todayYmd() });
  setShared('sj-users-v6', allUsers);
  ['nu-name','nu-id','nu-pw'].forEach(x=>document.getElementById(x).value='');
  closeModal('modal-add-user');
  renderUsers();
  showToast(`${name} 계정을 추가했습니다.`, 'success');
}

function toggleUserMenuAccess(id, key, checked) {
  const u = allUsers.find(x=>x.id===id);
  if (!u || u.id === 'admin') return;
  const access = new Set(getUserMenuAccess(u));
  if (checked) access.add(key);
  else access.delete(key);
  u.menuAccess = normalizeMenuAccess([...access], 'user');
  setShared('sj-users-v6', allUsers);
  if (currentUser?.id === id) {
    currentUser = { ...currentUser, ...u };
    initUI();
  }
}

function setUserMenuPreset(id, preset) {
  const u = allUsers.find(x=>x.id===id);
  if (!u || u.id === 'admin') return;
  u.menuAccess = preset === 'all' ? MENU_ACCESS_ITEMS.map(item=>item.key) : getDefaultMenuAccess('user');
  setShared('sj-users-v6', allUsers);
  if (currentUser?.id === id) {
    currentUser = { ...currentUser, ...u };
    initUI();
  }
  renderUsers();
  showToast('메뉴 권한이 저장되었습니다.', 'success');
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

async function submitSignup() {
  const name = document.getElementById('su-name').value.trim();
  const id   = document.getElementById('su-id').value.trim();
  const pw   = document.getElementById('su-pw').value;
  const pw2  = document.getElementById('su-pw-confirm').value;
  if (!name || !id || !pw || !pw2) { showSignupErr('모든 항목을 입력하세요.'); return; }
  const idPolicyErr = typeof authValidateUserId === 'function'
    ? authValidateUserId(id)
    : (!/^[A-Za-z0-9_-]{2,32}$/.test(id) ? '아이디는 영문, 숫자, _, - 조합 2~32자만 가능합니다.' : '');
  if (idPolicyErr) { showSignupErr(idPolicyErr); return; }
  const pwPolicyErr = authValidatePasswordPolicy(pw, { id, name });
  if (pwPolicyErr) { showSignupErr(pwPolicyErr); return; }
  if (pw !== pw2) { showSignupErr('비밀번호가 일치하지 않습니다.'); return; }

  await syncAuthFromFirebase();
  ensureUsers({ persist: false });
  if (allUsers.find(u=>u.id===id)) { showSignupErr('이미 존재하는 아이디입니다.'); return; }
  const pending = getShared('sj-signup-pending-v1', []);
  if (pending.find(p=>p.id===id)) { showSignupErr('이미 신청된 아이디입니다. 승인을 기다려주세요.'); return; }

  pending.push({ id, name, passwordHash: await authBuildPasswordRecord(pw), requestedAt: new Date().toISOString() });
  setShared('sj-signup-pending-v1', pending);

  ['su-name','su-id','su-pw','su-pw-confirm'].forEach(x=>document.getElementById(x).value='');
  alert('가입 신청이 완료되었습니다.\n관리자 승인 후 로그인할 수 있습니다.');
  switchAuthMode('login');
}

function getPendingMenuAccess(id) {
  const checked = Array.from(document.querySelectorAll('.pending-menu-cb'))
    .filter(cb => cb.dataset.pendingId === id && cb.checked)
    .map(cb => cb.value);
  return normalizeMenuAccess(checked.length ? checked : getDefaultMenuAccess('user'), 'user');
}

function renderPendingSignups() {
  const wrap = document.getElementById('pending-signups-wrap');
  if (!wrap) return;
  const pending = getShared('sj-signup-pending-v1', []);
  if (pending.length === 0) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div style="background:var(--amber-l);border:1px solid var(--amber);border-radius:var(--r);padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:14px">⏳</span>
        <span style="font-size:13px;font-weight:700;color:var(--amber)">가입 신청 대기 ${pending.length}건</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${pending.map(p=>{
          const pid = escInlineJs(p.id);
          const access = new Set(normalizeMenuAccess(p.menuAccess, 'user'));
          return `
          <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r2);padding:12px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div style="flex:1 1 180px;min-width:0">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(p.name)} <span style="font-size:11px;color:var(--text3);font-weight:400">(${escHtml(p.id)})</span></div>
              <div style="font-size:11px;color:var(--text2);margin-top:2px">신청일시: ${escHtml((p.requestedAt||'').replace('T',' ').substring(0,16))}</div>
            </div>
            <div class="user-menu-grid" style="flex:2 1 420px;margin:0">
              ${MENU_ACCESS_ITEMS.map(item => {
                const fixed = typeof isAlwaysVisibleMenuKey === 'function' && isAlwaysVisibleMenuKey(item.key);
                return `
                <label class="user-menu-check" title="${escHtml(item.label)}">
                  <input class="pending-menu-cb" data-pending-id="${escHtml(p.id)}" type="checkbox" value="${escHtml(item.key)}" ${fixed || access.has(item.key)?'checked':''} ${fixed?'disabled':''} />
                  <span>${escHtml(item.label)}</span>
                </label>`;
              }).join('')}
            </div>
            <div style="display:flex;gap:6px;margin-left:auto">
              <button class="btn-sm btn-primary" onclick="approveSignup('${pid}')">승인</button>
              <button class="btn-sm btn-danger" onclick="rejectSignup('${pid}')">거절</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

async function approveSignup(id) {
  const pending = getShared('sj-signup-pending-v1', []);
  const p = pending.find(x=>x.id===id);
  if (!p) { showToast('요청을 찾을 수 없습니다.','error'); return; }
  if (allUsers.find(u=>u.id===id)) { showToast('이미 존재하는 아이디입니다.','error'); return; }
  const colors = ['#E53935','#2B72C8','#43A047','#E8900A','#7856C8','#26c6da'];
  const passwordHash = p.passwordHash || (p.password ? await authBuildPasswordRecord(p.password) : '');
  allUsers.push({
    id: p.id, name: p.name, passwordHash,
    menuAccess: getPendingMenuAccess(id),
    color: colors[allUsers.length % colors.length],
    createdAt: todayYmd()
  });
  setShared('sj-users-v6', allUsers);
  setShared('sj-signup-pending-v1', pending.filter(x=>x.id!==id));
  renderUsers(); renderPendingSignups();
  showToast(`${p.name} 계정을 승인했습니다.`, 'success');
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

const TARGET_PLAN_MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const TARGET_PLAN_WORKDAYS = [21,17,21,22,18,21,22,20,20,20,21,22];
const TARGET_PLAN_OFFICE_SALES_MONTHLY = [
  1124242712, 899394729, 1329403190, 1473747828, 1260967241, 1391271956,
  1318329555, 1204473821, 1264296020, 1330738811, 1454607272, 1570052294
];
const TARGET_PLAN_DIST_SALES_MONTHLY = [
  510784044, 540064926, 653654121, 558642688, 543675371, 511701597,
  486116517, 461810691, 438720157, 416784149, 395944941, 376147694
];
const TARGET_PLAN_COLUMNS = [...TARGET_PLAN_MONTHS,'합계'];
const TARGET_PLAN_ROWS = [
  { section:'매출', rows:[
    { group:'', label:'합계', values:['1,715,208,248','1,527,761,040','2,067,929,457','2,107,626,664','1,881,058,336','1,998,052,651','1,868,400,432','1,747,918,872','1,784,530,537','1,829,237,320','1,932,766,574','2,029,234,348','22,507,724,479'] },
    { group:'대여', label:'대대여', values:['54,585,826','53,800,884','54,087,268','53,862,275','52,425,235','52,474,360','51,954,360','51,634,360','51,514,360','51,714,360','52,214,360','53,034,360','633,302,008'] },
    { group:'상품', label:'사업소', values:['1,124,242,712','899,394,729','1,329,403,190','1,473,747,828','1,260,967,241','1,391,271,956','1,318,329,555','1,204,473,821','1,264,296,020','1,330,738,811','1,454,607,272','1,570,052,294','15,621,525,429'] },
    { group:'상품', label:'유통사', values:['510,784,044','540,064,926','653,654,121','558,642,688','543,675,371','511,701,597','486,116,517','461,810,691','438,720,157','416,784,149','395,944,941','376,147,694','5,894,046,897'] },
    { group:'중고', label:'', values:['25,595,666','34,500,501','30,784,878','21,373,873','23,990,489','42,604,738','30,000,000','30,000,000','30,000,000','30,000,000','30,000,000','30,000,000','358,850,145'] },
  ]},
  { section:'원가', rows:[
    { group:'', label:'합계', values:['1,564,565,187','1,382,599,766','1,902,459,715','1,965,772,458','1,760,657,074','1,858,192,189','1,752,003,712','1,621,078,930','1,654,694,745','1,695,815,489','1,792,131,937','1,881,701,946','20,831,673,147'] },
    { group:'대여', label:'대대여', values:['27,441,367','25,180,158','24,193,466','25,262,666','26,515,726','25,187,693','24,938,093','24,784,493','24,726,893','24,822,893','25,062,893','25,456,493','303,572,833'] },
    { group:'상품', label:'사업소', values:['1,037,847,930','833,752,418','1,240,783,903','1,390,754,085','1,192,532,992','1,314,751,998','1,239,229,782','1,132,205,391','1,188,438,259','1,250,894,483','1,367,330,836','1,475,849,156','14,664,371,233'] },
    { group:'상품', label:'유통사', values:['499,275,890','523,667,190','637,482,346','549,755,707','531,380,553','499,932,460','474,935,837','451,189,045','428,629,593','407,198,113','386,838,208','367,496,297','5,757,781,241'] },
    { group:'중고', label:'', values:['-','-','-','-','10,227,803','18,320,037','12,900,000','12,900,000','12,900,000','12,900,000','12,900,000','12,900,000','105,947,840'] },
  ]},
  { section:'원가율', rows:[
    { group:'', label:'합계', values:['91.2%','90.5%','92.0%','93.3%','93.6%','93.0%','92.9%','92.7%','92.7%','92.7%','92.7%','92.7%','92.6%'] },
    { group:'대여', label:'대대여', values:['50.3%','46.8%','44.7%','46.9%','50.6%','48.0%','48.0%','48.0%','48.0%','48.0%','48.0%','48.0%','47.9%'] },
    { group:'상품', label:'사업소', values:['92.3%','92.7%','93.3%','94.4%','94.6%','94.5%','94.0%','94.0%','94.0%','94.0%','94.0%','94.0%','93.9%'] },
    { group:'상품', label:'유통사', values:['97.7%','97.0%','97.5%','98.4%','97.7%','97.7%','97.7%','97.7%','97.7%','97.7%','97.7%','97.7%','97.7%'] },
    { group:'중고', label:'', values:['0.0%','0.0%','0.0%','0.0%','42.6%','43.0%','43.0%','43.0%','43.0%','43.0%','43.0%','43.0%','29.5%'] },
  ]},
  { section:'매익', rows:[
    { group:'', label:'합계', values:['150,643,061','145,161,274','165,469,742','141,854,206','120,401,262','139,860,462','134,396,720','126,839,942','129,835,792','133,421,831','140,634,637','147,532,402','1,676,051,332'] },
    { group:'대여', label:'대대여', values:['27,144,459','28,620,726','29,893,802','28,599,609','25,909,509','27,286,667','27,016,267','26,849,867','26,787,467','26,891,467','27,151,467','27,577,867','329,729,175'] },
    { group:'상품', label:'사업소', values:['86,394,782','65,642,311','88,619,287','82,993,743','68,434,249','76,519,958','79,099,773','72,268,429','75,857,761','79,844,329','87,276,436','94,203,138','957,154,196'] },
    { group:'상품', label:'유통사', values:['11,508,154','16,397,736','16,171,775','8,886,981','12,294,818','11,769,137','11,180,680','10,621,646','10,090,564','9,586,035','9,106,734','8,651,397','136,265,656'] },
    { group:'중고', label:'', values:['25,595,666','34,500,501','30,784,878','21,373,873','13,762,686','24,284,701','17,100,000','17,100,000','17,100,000','17,100,000','17,100,000','17,100,000','252,902,305'] },
  ]},
  { section:'매익률', rows:[
    { group:'', label:'합계', values:['8.8%','9.5%','8.0%','6.7%','6.4%','7.0%','7.1%','7.3%','7.3%','7.3%','7.3%','7.3%','7.4%'] },
    { group:'대여', label:'대대여', values:['49.7%','53.2%','55.3%','53.1%','49.4%','52.0%','52.0%','52.0%','52.0%','52.0%','52.0%','52.0%','52.1%'] },
    { group:'상품', label:'사업소', values:['7.7%','7.3%','6.7%','5.6%','5.4%','5.5%','6.0%','6.0%','6.0%','6.0%','6.0%','6.0%','6.1%'] },
    { group:'상품', label:'유통사', values:['2.3%','3.0%','2.5%','1.6%','2.3%','2.3%','2.3%','2.3%','2.3%','2.3%','2.3%','2.3%','2.3%'] },
    { group:'중고', label:'', values:['100.0%','100.0%','100.0%','100.0%','57.4%','57.0%','57.0%','57.0%','57.0%','57.0%','57.0%','57.0%','70.5%'] },
  ]},
];

function getPlanSalesTargetsForMonth(ym) {
  if (!ym || !ym.startsWith('2026-')) return 0;
  const idx = parseInt(ym.slice(5, 7), 10) - 1;
  const office = TARGET_PLAN_OFFICE_SALES_MONTHLY[idx] || 0;
  const dist = TARGET_PLAN_DIST_SALES_MONTHLY[idx] || 0;
  return { office, dist, total: office + dist };
}

function applyPlannedSalesTarget() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const planTarget = getPlanSalesTargetsForMonth(ym);
  if (planTarget?.total) {
    targets.officeSalesTarget = planTarget.office;
    targets.distSalesTarget = planTarget.dist;
    targets.salesTarget = planTarget.total;
  }
  return planTarget;
}

function renderTargetPlanTable() {
  const wrap = document.getElementById('target-plan-table-wrap');
  if (!wrap) return;
  const currentMonthIdx = new Date().getFullYear() === 2026 ? new Date().getMonth() : -1;
  const workdayCells = TARGET_PLAN_WORKDAYS.map((d, i) => `<th class="${i===currentMonthIdx?'plan-current-month':''}">${d}</th>`).join('');
  const head = `<thead>
    <tr><th colspan="3"></th><th colspan="12">영업일수</th><th></th></tr>
    <tr><th colspan="3"></th>${workdayCells}<th></th></tr>
    <tr><th rowspan="2">구분</th><th rowspan="2">분류</th><th rowspan="2">항목</th><th colspan="13">2026년 계획</th></tr>
    <tr>${TARGET_PLAN_COLUMNS.map((c,i)=>`<th class="${i===currentMonthIdx?'plan-current-month':''}">${c}</th>`).join('')}</tr>
  </thead>`;
  const body = TARGET_PLAN_ROWS.map(section => section.rows.map((row, i) => {
    const sectionCell = i === 0 ? `<th class="plan-section" rowspan="${section.rows.length}">${section.section}</th>` : '';
    const groupCell = `<th class="plan-group">${row.group || ''}</th>`;
    const cells = row.values.map((v, idx) => `<td class="${idx===currentMonthIdx?'plan-current-month':''}">${v}</td>`).join('');
    return `<tr class="${i===0?'plan-section-start':''}">${sectionCell}${groupCell}<th class="plan-label">${row.label}</th>${cells}</tr>`;
  }).join('')).join('');
  wrap.innerHTML = `<div class="target-plan-scroll"><table class="target-plan-table">${head}<tbody>${body}</tbody></table></div><div class="target-plan-note">현재 월 사업소/유통사 계획값은 매출 목표에 자동 반영됩니다.</div>`;
}

function renderTargets() {
  const now=new Date(), ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  applyPlannedSalesTarget();
  document.getElementById('t-visit').value = targets.visitTarget||'';
  document.getElementById('t-sales-office').value = targets.officeSalesTarget ? targets.officeSalesTarget.toLocaleString() : '';
  document.getElementById('t-sales-dist').value = targets.distSalesTarget ? targets.distSalesTarget.toLocaleString() : '';

  // team totals
  let teamVisit=0;
  allEntries.forEach(e=>{if((e.date||'').startsWith(ym)){teamVisit++;}});
  const officePersons = ['이기현','장재순','이민우','안성종'];
  const isOfficeRow = o => o.channel ? o.channel === 'office' : officePersons.includes((o.person||'').trim());
  const isDistRow = o => o.channel ? o.channel === 'dist' : ((o.person||'').trim() === '도도매/유통사' || (o.custClass||'').trim() === '도매(도도매/유통사)');
  const monthOrders = (allOrders || []).filter(o => (o.date || '').startsWith(ym));
  const officeActualSales = sumSupply(monthOrders.filter(isOfficeRow));
  const distActualSales = sumSupply(monthOrders.filter(isDistRow));
  const officeTarget = parseFloat(targets.officeSalesTarget) || 0;
  const distTarget = parseFloat(targets.distSalesTarget) || 0;
  const vPct=targets.visitTarget?Math.min(Math.round(teamVisit/targets.visitTarget*100),999):0;
  const officeSalesPct=officeTarget?Math.min(Math.round(officeActualSales/officeTarget*100),999):0;
  const distSalesPct=distTarget?Math.min(Math.round(distActualSales/distTarget*100),999):0;
  const tvBar=document.getElementById('t-visit-bar'); if(tvBar)tvBar.style.width=vPct+'%';
  const officeBar=document.getElementById('t-sales-office-bar'); if(officeBar)officeBar.style.width=officeSalesPct+'%';
  const distBar=document.getElementById('t-sales-dist-bar'); if(distBar)distBar.style.width=distSalesPct+'%';
  const tvPct=document.getElementById('t-visit-pct'); if(tvPct)tvPct.textContent=targets.visitTarget?vPct+'%':'-';
  const officePct=document.getElementById('t-sales-office-pct'); if(officePct)officePct.textContent=officeTarget?officeSalesPct+'%':'-';
  const distPct=document.getElementById('t-sales-dist-pct'); if(distPct)distPct.textContent=distTarget?distSalesPct+'%':'-';

  // 영업사원별
  const userList = allUsers.filter(isSalesUserAccount);
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
  renderTargetPlanTable();
}

function saveTargets() {
  const _pc = id => parseFloat((document.getElementById(id)?.value||'').replace(/,/g,''))||0;
  targets.visitTarget = parseFloat(document.getElementById('t-visit').value)||0;
  targets.officeSalesTarget = _pc('t-sales-office');
  targets.distSalesTarget = _pc('t-sales-dist');
  targets.salesTarget = (targets.officeSalesTarget || 0) + (targets.distSalesTarget || 0);
  targets.personal = {};
  targets.personalSales = {};
  allUsers.filter(isSalesUserAccount).forEach(u=>{
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
async function changeMyPassword() {
  const current = document.getElementById('cpw-current').value;
  const newPw   = document.getElementById('cpw-new').value;
  const confirm = document.getElementById('cpw-confirm').value;
  const errEl   = document.getElementById('cpw-err');
  errEl.style.display = 'none';

  if (!(await authVerifyPassword(currentUser, current))) {
    errEl.textContent = '현재 비밀번호가 올바르지 않습니다.'; errEl.style.display = 'block'; return;
  }
  const pwPolicyErr = authValidatePasswordPolicy(newPw, currentUser);
  if (pwPolicyErr) {
    errEl.textContent = pwPolicyErr; errEl.style.display = 'block'; return;
  }
  if (newPw !== confirm) {
    errEl.textContent = '새 비밀번호가 일치하지 않습니다.'; errEl.style.display = 'block'; return;
  }

  const idx = allUsers.findIndex(u => u.id === currentUser.id);
  await authSetPassword(allUsers[idx], newPw);
  currentUser = { ...currentUser, ...allUsers[idx] };
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

  const idx = allUsers.findIndex(u => u.id === uid);
  const pwPolicyErr = authValidatePasswordPolicy(newPw, allUsers[idx] || {});
  if (pwPolicyErr) { errEl.textContent = pwPolicyErr; errEl.style.display = 'block'; return; }
  if (newPw !== confirm) {
    errEl.textContent = '비밀번호가 일치하지 않습니다.'; errEl.style.display = 'block'; return;
  }

  await authSetPassword(allUsers[idx], newPw);
  setShared('sj-users-v6', allUsers);

  closeModal('modal-reset-pw');
  showToast(`${allUsers[idx].name} 비밀번호가 초기화되었습니다.`, 'success');
}

// ════════════════════════════════════
// EXPORT EXCEL
// ════════════════════════════════════
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
  const cnt = isAdminUser(currentUser) ? allEntries.length : allEntries.filter(e=>e.personId===currentUser?.id).length;
  const el = document.getElementById('total-badge');
  if (el) el.textContent = cnt;
}





// ════════════════════════════════════
