// Shared output-safety helpers used by every HTML-rendering feature module.

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function escInlineJs(value) {
  const escaped = String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return escHtml(escaped);
}

function safeColor(value, fallback = '#999999') {
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(value || '')) ? value : fallback;
}
