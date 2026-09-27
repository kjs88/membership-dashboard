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

function updateBadge() {
  const cnt = isAdminUser(currentUser) ? allEntries.length : allEntries.filter(e=>e.personId===currentUser?.id).length;
  const el = document.getElementById('total-badge');
  if (el) el.textContent = cnt;
}





// ════════════════════════════════════
