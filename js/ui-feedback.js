// Shared modal and toast behavior used across feature modules.

const MODAL_OPEN_HOOKS = Object.freeze({
  'modal-change-pw': () => {
    ['cpw-current', 'cpw-new', 'cpw-confirm'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
    const error = document.getElementById('cpw-err');
    if (error) error.style.display = 'none';
  },
  'modal-erp-upload': () => {
    if (typeof erpRefreshSyncStatus === 'function') erpRefreshSyncStatus();
    if (typeof erpUpdateUploadPreview === 'function') erpUpdateUploadPreview();
  },
});

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) {
    console.warn('[openModal] missing modal:', id);
    return;
  }
  MODAL_OPEN_HOOKS[id]?.();
  modal.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

let toastTimer;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) {
    console[type === 'error' ? 'error' : 'log'](message);
    return;
  }
  toast.textContent = `${type === 'success' ? '✓' : '✕'} ${message}`;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2800);
}
