// Browser-side hardening helpers. These do not replace Firebase Security Rules,
// but they reduce XSS, credential leakage, and accidental data corruption.
const SECURITY_PBKDF2_ITERATIONS = 160000;
const SECURITY_PASSWORD_VERSION = 'pbkdf2-sha256';
const SECURITY_MAX_STRING_LENGTH = 20000;
const SECURITY_MAX_DEPTH = 8;
const SECURITY_FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SECURITY_LOGIN_THROTTLE_KEY = 'sj-login-throttle-v1';
const SECURITY_LOGIN_MAX_FAILURES = 5;
const SECURITY_LOGIN_LOCK_MS = 5 * 60 * 1000;
const SECURITY_PASSWORD_MAX_LENGTH = 128;

function securityRandomBytes(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function securityBytesToBase64(bytes) {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function securityBase64ToBytes(value) {
  const bin = atob(String(value || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function securityDerivePasswordHash(password, saltBytes, iterations = SECURITY_PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password || '')),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

function securityConstantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function authBuildPasswordRecord(password) {
  const salt = securityRandomBytes(16);
  const hash = await securityDerivePasswordHash(password, salt);
  return `${SECURITY_PASSWORD_VERSION}$${SECURITY_PBKDF2_ITERATIONS}$${securityBytesToBase64(salt)}$${securityBytesToBase64(hash)}`;
}

async function authVerifyPassword(user, password) {
  if (!user) return false;
  if (String(password || '').length > SECURITY_PASSWORD_MAX_LENGTH) return false;
  if (user.passwordHash && String(user.passwordHash).startsWith(`${SECURITY_PASSWORD_VERSION}$`)) {
    const parts = String(user.passwordHash).split('$');
    if (parts.length !== 4) return false;
    const iterations = Math.max(100000, parseInt(parts[1], 10) || SECURITY_PBKDF2_ITERATIONS);
    const salt = securityBase64ToBytes(parts[2]);
    const expected = securityBase64ToBytes(parts[3]);
    const actual = await securityDerivePasswordHash(password, salt, iterations);
    return securityConstantTimeEqual(actual, expected);
  }
  // Legacy migration path: old data may still contain plaintext passwords.
  return user.password !== undefined && String(user.password) === String(password);
}

async function authSetPassword(user, password) {
  if (!user) return user;
  user.passwordHash = await authBuildPasswordRecord(password);
  delete user.password;
  return user;
}

function authHasLegacyPassword(user) {
  return !!(user && user.password !== undefined && !user.passwordHash);
}

function authValidatePasswordPolicy(password, user = {}) {
  const pw = String(password || '');
  if (pw.length < 10) return '비밀번호는 10자 이상이어야 합니다.';
  if (pw.length > SECURITY_PASSWORD_MAX_LENGTH) return `비밀번호는 ${SECURITY_PASSWORD_MAX_LENGTH}자 이하여야 합니다.`;
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return '비밀번호에는 영문과 숫자를 모두 포함해야 합니다.';
  const lowered = pw.toLowerCase();
  const id = String(user.id || '').toLowerCase();
  const name = String(user.name || '').toLowerCase();
  if (id && id.length >= 3 && lowered.includes(id)) return '비밀번호에 아이디를 포함할 수 없습니다.';
  if (name && name.length >= 2 && lowered.includes(name)) return '비밀번호에 이름을 포함할 수 없습니다.';
  return '';
}

function authValidateUserId(id) {
  const value = String(id || '').trim();
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(value)) return '아이디는 영문, 숫자, _, - 조합 2~32자만 가능합니다.';
  return '';
}

function authThrottleKey(id) {
  return String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || '_blank';
}

function authReadThrottleStore() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SECURITY_LOGIN_THROTTLE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function authWriteThrottleStore(store) {
  try { sessionStorage.setItem(SECURITY_LOGIN_THROTTLE_KEY, JSON.stringify(store)); }
  catch (_) {}
}

function authGetLoginThrottle(id) {
  const store = authReadThrottleStore();
  const key = authThrottleKey(id);
  const item = store[key] || { count: 0, lockedUntil: 0 };
  if (item.lockedUntil && Date.now() < item.lockedUntil) {
    return { locked: true, waitMs: item.lockedUntil - Date.now(), count: item.count || 0 };
  }
  if (item.lockedUntil && Date.now() >= item.lockedUntil) {
    delete store[key];
    authWriteThrottleStore(store);
  }
  return { locked: false, waitMs: 0, count: item.count || 0 };
}

function authRecordLoginFailure(id) {
  const store = authReadThrottleStore();
  const key = authThrottleKey(id);
  const item = store[key] || { count: 0, lockedUntil: 0 };
  item.count = (item.count || 0) + 1;
  item.lastFailedAt = Date.now();
  if (item.count >= SECURITY_LOGIN_MAX_FAILURES) item.lockedUntil = Date.now() + SECURITY_LOGIN_LOCK_MS;
  store[key] = item;
  authWriteThrottleStore(store);
  return authGetLoginThrottle(id);
}

function authClearLoginThrottle(id) {
  const store = authReadThrottleStore();
  delete store[authThrottleKey(id)];
  authWriteThrottleStore(store);
}

function securityNormalizeCredentialRecord(record) {
  if (!record || typeof record !== 'object') return record;
  if (record.passwordHash && record.password !== undefined) delete record.password;
  return record;
}

function securitySanitizeText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, c => c === '<' ? '＜' : '＞')
    .slice(0, SECURITY_MAX_STRING_LENGTH);
}

function securitySanitizeData(value, depth = 0) {
  if (depth > SECURITY_MAX_DEPTH) return null;
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return securitySanitizeText(value);
  if (Array.isArray(value)) return value.slice(0, 10000).map(v => securitySanitizeData(v, depth + 1));
  if (typeof value === 'object') {
    const clean = {};
    Object.entries(value).forEach(([key, val]) => {
      if (SECURITY_FORBIDDEN_KEYS.has(key) || /^on[a-z]/i.test(key)) return;
      clean[securitySanitizeText(key).replace(/[.$#[\]/]/g, '_')] = securitySanitizeData(val, depth + 1);
    });
    return securityNormalizeCredentialRecord(clean);
  }
  return null;
}

function securityNormalizeFirebaseUrl(url) {
  const text = String(url || '').trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(text);
    const allowed = parsed.protocol === 'https:' && (
      parsed.hostname.endsWith('.firebaseio.com') ||
      parsed.hostname.endsWith('.firebasedatabase.app')
    );
    return allowed ? parsed.origin : '';
  } catch (_) {
    return '';
  }
}

function securityAssertSameOriginFrame() {
  try {
    const isProjectFrame = /project-tracker\.html$/i.test(location.pathname);
    if (window.self !== window.top && !isProjectFrame) {
      document.documentElement.innerHTML = '';
      window.top.location = window.location.href;
    }
  } catch (_) {
    document.documentElement.innerHTML = '';
  }
}

securityAssertSameOriginFrame();
