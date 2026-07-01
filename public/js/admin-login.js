qs('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = qs('#loginBtn'); const errEl = qs('#loginError');
  errEl.style.display = 'none'; btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: qs('#email').value, password: qs('#password').value }) });
    localStorage.setItem('hz_admin_token', res.token);
    localStorage.setItem('hz_admin', JSON.stringify(res.admin));
    location.href = res.admin.role === 'super_admin' ? '/superadmin-dashboard.html' : '/admin-dashboard.html';
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});
