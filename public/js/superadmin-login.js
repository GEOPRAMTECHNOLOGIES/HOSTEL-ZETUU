qs('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = qs('#loginBtn'); const errEl = qs('#loginError');
  errEl.style.display = 'none'; btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: qs('#email').value, password: qs('#password').value }) });
    localStorage.setItem('hz_admin_token', res.token);
    localStorage.setItem('hz_admin', JSON.stringify(res.admin));
    if (res.admin.role !== 'super_admin') {
      errEl.textContent = 'This account is not a platform super admin.'; errEl.style.display = 'block';
      localStorage.removeItem('hz_admin_token'); localStorage.removeItem('hz_admin');
      return;
    }
    location.href = "/superadmin-dashboard.html";
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});
