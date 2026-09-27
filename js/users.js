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
    return `
    <div class="user-card">
      <div class="user-card-avatar" style="background:${color}22;color:${color}">${escHtml((u.name||'').slice(0,1))}</div>
      <div class="user-card-info">
        <div class="user-card-name">${uname}</div>
        <div class="user-card-meta">ID: ${escHtml(u.id)} · 가입일: ${escHtml(u.createdAt||'-')}</div>
      </div>
      <div class="user-card-stats">
        <div class="user-card-count" style="color:var(--blue)">${displayCount}</div>
        <div class="user-card-label">접속 횟수</div>
      </div>
      <div class="user-card-stats">
        <div class="user-card-count" style="font-size:13px;line-height:1.6">${fmtLoginAt(displayLast)}</div>
        <div class="user-card-label">최근 접속</div>
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
