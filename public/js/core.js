/* Hosteli Zetu — shared frontend utilities */
const API = '/api';

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('hz_admin_token') || localStorage.getItem('hz_student_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers, credentials: 'include' });
  let data;
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function ensureToastStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

function toast(message, type = '') {
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function fmtKES(n) {
  return 'KES ' + Number(n || 0).toLocaleString('en-KE');
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
}

function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function debounce(fn, ms = 350) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function deviceFingerprint() {
  let fp = localStorage.getItem('hz_device_fp');
  if (!fp) {
    fp = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('hz_device_fp', fp);
  }
  return fp;
}

function statusLabel(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------------------------------------------------------------------------
   Hidden super admin entry point.
   The public site has no visible "Super admin" link anywhere. Platform staff
   reach the login screen by clicking the "Hosteli Zetu" brand/logo 9 times
   in a row (wherever it appears — navbar, footer, etc). A single click still
   behaves like a normal link after a short pause, so it doesn't break normal
   navigation for everyday visitors.
--------------------------------------------------------------------------- */
(function initSecretSuperAdminAccess() {
  const CLICKS_REQUIRED = 9;
  const RESET_MS = 1600;
  let count = 0;
  let resetTimer = null;
  let navTimer = null;

  function bind(el) {
    if (el.dataset.hzSecretBound) return;
    el.dataset.hzSecretBound = '1';

    const fallbackHref = el.tagName === 'A' ? (el.getAttribute('href') || '/') : null;

    el.addEventListener('click', (e) => {
      if (fallbackHref !== null) e.preventDefault();

      count += 1;
      clearTimeout(resetTimer);
      clearTimeout(navTimer);

      if (count >= CLICKS_REQUIRED) {
        count = 0;
        window.location.href = '/superadmin-login.html';
        return;
      }

      resetTimer = setTimeout(() => {
        count = 0;
      }, RESET_MS);

      // Give normal visitors their expected click-through, just slightly
      // deferred so we can tell a single click apart from the secret pattern.
      if (fallbackHref !== null) {
        navTimer = setTimeout(() => {
          window.location.href = fallbackHref;
        }, RESET_MS);
      }
    });
  }

  function attachAll() {
    document.querySelectorAll('.brand').forEach(bind);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll);
  } else {
    attachAll();
  }
})();
