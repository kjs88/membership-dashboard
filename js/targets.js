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
  uiSetHtml(wrap, `<div class="target-plan-scroll"><table class="target-plan-table">${head}<tbody>${body}</tbody></table></div><div class="target-plan-note">현재 월 사업소/유통사 계획값은 매출 목표에 자동 반영됩니다.</div>`);
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
  uiSetHtml(document.getElementById('personal-targets'), userList.map(u => {
  const uidAttr = escHtml(u.id);
  const vTgt = (targets.personal || {})[u.id] || 0;
  const sTgt = (targets.personalSales || {})[u.id] || 0;
  const vAct = pm[u.id] || 0,
    sAct = sm[u.id] || 0;
  const vpct = vTgt ? Math.min(Math.round(vAct / vTgt * 100), 999) : 0;
  const spct = sTgt ? Math.min(Math.round(sAct / sTgt * 100), 999) : 0;
  return `<div class="personal-block">
      <div class="personal-block-name">${escHtml(u.name)}</div>
      <div class="tgt-row">
        <span class="tgt-label">매출 목표</span>
        <input class="target-input-sm" id="pts-${uidAttr}" type="text" value="${sTgt ? sTgt.toLocaleString() : ''}" placeholder="0" ${uiAction("input", function (event, uiValues) {
    fmtComma(this);
  }, [])} />
        <span class="tgt-unit">원</span>
        <div class="tgt-bar-wrap"><div class="tgt-bar-fill" style="width:${spct}%;background:var(--amber)"></div></div>
        <span class="tgt-pct" style="color:var(--amber)">${sTgt ? spct + '%' : '-'}</span>
      </div>
      <div class="tgt-row">
        <span class="tgt-label">방문 목표</span>
        <input class="target-input-sm" id="pt-${uidAttr}" type="number" value="${vTgt || ''}" placeholder="0" />
        <span class="tgt-unit">건</span>
        <div class="tgt-bar-wrap"><div class="tgt-bar-fill" style="width:${vpct}%;background:var(--green)"></div></div>
        <span class="tgt-pct" style="color:var(--green-dark)">${vTgt ? vpct + '%' : '-'}</span>
      </div>
    </div>`;
}).join(''));

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
