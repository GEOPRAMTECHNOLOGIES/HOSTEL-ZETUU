// ---- Auth guard ----
const adminToken = localStorage.getItem('hz_admin_token');
const adminInfo = JSON.parse(localStorage.getItem('hz_admin') || 'null');
if (!adminToken || !adminInfo || adminInfo.role !== 'super_admin') {
  localStorage.removeItem('hz_admin_token'); localStorage.removeItem('hz_admin');
  location.href = '/superadmin-login.html';
}

qs('#userAvatar').textContent = initials(adminInfo?.name || 'A');
qs('#userName').textContent = adminInfo?.name || 'Super Admin';
qs('#userRole').textContent = 'Super Admin';

qs('#logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (e) {}
  localStorage.clear();
  location.href = '/superadmin-login.html';
});

qs('#burgerBtn').addEventListener('click', () => qs('#sidebar').classList.toggle('open'));

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ------------------------------ View router ------------------------------ */
const views = { overview: renderOverview, hostels: renderAllHostels, approvals: renderApprovals, admins: renderAdmins, reviews: renderReviews, settings: renderSettings };

function setActiveNav(view) {
  qsa('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  qs('#viewTitle').textContent = { overview: 'Platform Dashboard', hostels: 'All Hostels', approvals: 'Pending Approvals', admins: 'Tenant Admins', reviews: 'Review Moderation', settings: 'Settings' }[view];
  qs('#sidebar').classList.remove('open');
}

async function refreshApprovalBadge() {
  try {
    const { stats } = await apiFetch('/superadmin/dashboard');
    qs('#approvalBadge').innerHTML = stats.pendingCount ? `<span class="tag tag-warn" style="margin-left:6px;">${stats.pendingCount}</span>` : '';
  } catch (e) {}
}

async function navigate() {
  const view = location.hash.replace('#', '') || 'overview';
  setActiveNav(view in views ? view : 'overview');
  const root = qs('#viewRoot');
  root.innerHTML = '<div class="card skeleton" style="height:240px;"></div>';
  try { await (views[view] || renderOverview)(root); }
  catch (e) { root.innerHTML = `<div class="empty-state"><h3>Something went wrong</h3><p>${e.message}</p></div>`; }
  refreshApprovalBadge();
}
window.addEventListener('hashchange', navigate);

/* -------------------------------- Overview -------------------------------- */
async function renderOverview(root) {
  const d = await apiFetch('/superadmin/dashboard');
  const { stats, monthlyBookings, recentBookings, topHostels, pendingHostels, revenueTrend } = d;

  const maxRev = Math.max(1, ...revenueTrend.map((r) => r.total));
  const barChart = revenueTrend.map((r) => `
    <div class="bar-col">
      <div class="bar" style="height:${Math.max(6, (r.total / maxRev) * 100)}%;" title="${fmtKES(r.total)}"></div>
      <div class="bar-label">${MONTHS[r._id.month - 1]}</div>
    </div>`).join('') || '<p class="muted" style="padding:20px;">No revenue data yet.</p>';

  const statusColors = { confirmed: 'var(--success)', pending_payment: 'var(--gold)', cancelled: 'var(--danger)', completed: 'var(--forest)' };
  const totalBk = monthlyBookings.reduce((s, b) => s + b.count, 0) || 1;
  const donutLegend = monthlyBookings.map((b) => `
    <div class="item"><span class="swatch" style="background:${statusColors[b._id]||'var(--ink-soft)'}"></span>${statusLabel(b._id)} — ${b.count} (${Math.round(b.count/totalBk*100)}%)</div>
  `).join('') || '<p class="muted">No bookings this month.</p>';

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon green">🏠</div><div class="stat-value">${stats.hostelCount}</div><div class="stat-label">Total hostels</div><span class="stat-delta up">${stats.publishedCount} published</span></div>
      <div class="stat-card"><div class="stat-icon gold">⏳</div><div class="stat-value">${stats.pendingCount}</div><div class="stat-label">Pending approval</div></div>
      <div class="stat-card"><div class="stat-icon coral">🛏️</div><div class="stat-value">${stats.availableRoomCount}/${stats.roomCount}</div><div class="stat-label">Rooms available</div></div>
      <div class="stat-card"><div class="stat-icon blue">💰</div><div class="stat-value">${fmtKES(stats.totalRevenue)}</div><div class="stat-label">Platform revenue</div></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Revenue — last 6 months</h3></div>
        <div class="bar-chart">${barChart}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Bookings this month</h3></div>
        <div class="donut-legend">${donutLegend}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Top performing hostels</h3><a href="#hostels" class="btn btn-outline btn-sm">View all hostels</a></div>
      <div class="hostel-mini-grid">
        ${topHostels.map((h) => `
          <div class="hostel-mini">
            <div class="thumb">${h.coverImage ? `<img src="${h.coverImage}">` : ''}<span class="rating-chip">★ ${(h.ratingAvg||0).toFixed(1)}</span></div>
            <div class="info"><h4>${h.name}</h4><div class="uni">${h.university}</div>
              <div class="row"><span>${h.availableRooms||0}/${h.totalRooms||0} free</span><span>${h.viewCount||0} views</span></div>
            </div>
          </div>`).join('') || '<p class="muted">No published hostels yet.</p>'}
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Recent bookings</h3></div>
        <div class="table-wrap">
          <table class="dtable">
            <thead><tr><th>Ref</th><th>Hostel</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${recentBookings.map((b) => `<tr><td class="mono">${b.bookingRef}</td><td>${b.hostel?.name||'—'}</td><td><span class="status-pill ${b.status}">${statusLabel(b.status)}</span></td><td>${fmtDate(b.createdAt)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No bookings yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Awaiting your approval</h3><a href="#approvals" class="btn btn-outline btn-sm">Review all</a></div>
        ${pendingHostels.slice(0,5).map((h) => `
          <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--line);">
            <div><strong style="font-size:.86rem;">${h.name}</strong><div class="muted" style="font-size:.74rem;">${h.owner?.name||'—'} · ${h.university}</div></div>
            <button class="btn btn-sm btn-primary" data-approve="${h._id}">Approve</button>
          </div>`).join('') || '<p class="muted">Nothing pending — all caught up.</p>'}
      </div>
    </div>
  `;

  qsa('[data-approve]').forEach((b) => b.addEventListener('click', () => approveHostel(b.dataset.approve)));
}

async function approveHostel(id) {
  try { await apiFetch(`/superadmin/hostels/${id}/approve`, { method: 'PUT' }); toast('Hostel approved and published.', 'success'); navigate(); }
  catch (err) { toast(err.message, 'error'); }
}

/* ----------------------------- All hostels grid ---------------------------- */
async function renderAllHostels(root) {
  root.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>All hostels</h3>
        <div class="input-row">
          <div class="search-mini">🔎 <input type="text" id="hostelSearch" placeholder="Search by name..."></div>
          <select id="statusFilter" style="padding:9px 14px;border-radius:999px;border:1px solid var(--line);font-size:.85rem;">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="pending_review">Pending review</option>
            <option value="suspended">Suspended</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>
      <div class="table-wrap"><table class="dtable">
        <thead><tr><th>Hostel</th><th>University</th><th>Owner</th><th>Rooms</th><th>Rating</th><th>Status</th><th>Featured</th><th></th></tr></thead>
        <tbody id="hostelTableBody"><tr><td colspan="8" class="muted">Loading…</td></tr></tbody>
      </table></div>
    </div>
  `;

  async function fetchAndRender() {
    const params = new URLSearchParams();
    if (qs('#hostelSearch').value) params.set('q', qs('#hostelSearch').value);
    if (qs('#statusFilter').value) params.set('status', qs('#statusFilter').value);
    const { hostels } = await apiFetch(`/superadmin/hostels?${params}`);
    qs('#hostelTableBody').innerHTML = hostels.map((h) => `
      <tr>
        <td><strong>${h.name}</strong></td>
        <td>${h.university}</td>
        <td>${h.owner?.name || '—'}<div class="muted" style="font-size:.72rem;">${h.owner?.email||''}</div></td>
        <td>${h.availableRooms||0}/${h.totalRooms||0}</td>
        <td>${h.ratingCount ? `★ ${h.ratingAvg.toFixed(1)} (${h.ratingCount})` : '—'}</td>
        <td><span class="status-pill ${h.status}">${statusLabel(h.status)}</span></td>
        <td><button class="btn btn-sm ${h.featured ? 'btn-gold' : 'btn-outline'}" data-feature="${h._id}">${h.featured ? '★ Featured' : 'Feature'}</button></td>
        <td>
          ${h.status !== 'published' ? `<button class="btn btn-sm btn-primary" data-approve="${h._id}">Approve</button>` : ''}
          ${h.status !== 'suspended' ? `<button class="btn btn-sm" style="color:var(--danger);" data-suspend="${h._id}">Suspend</button>` : `<button class="btn btn-sm btn-outline" data-approve="${h._id}">Reinstate</button>`}
        </td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">No hostels match.</td></tr>';

    qsa('[data-approve]').forEach((b) => b.addEventListener('click', () => approveHostel(b.dataset.approve).then(fetchAndRender)));
    qsa('[data-feature]').forEach((b) => b.addEventListener('click', async () => { await apiFetch(`/superadmin/hostels/${b.dataset.feature}/feature`, { method: 'PUT' }); fetchAndRender(); }));
    qsa('[data-suspend]').forEach((b) => b.addEventListener('click', () => openSuspendModal(b.dataset.suspend, fetchAndRender)));
  }

  qs('#hostelSearch').addEventListener('input', debounce(fetchAndRender, 350));
  qs('#statusFilter').addEventListener('change', fetchAndRender);
  fetchAndRender();
}

function openSuspendModal(id, onDone) {
  qs('#suspendModal').style.display = 'flex';
  qs('#suspendForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/superadmin/hostels/${id}/suspend`, { method: 'PUT', body: JSON.stringify({ reason: qs('#suspendReason').value }) });
      toast('Hostel suspended.', 'success');
      qs('#suspendModal').style.display = 'none';
      qs('#suspendReason').value = '';
      onDone && onDone();
    } catch (err) { toast(err.message, 'error'); }
  };
}
qs('#closeSuspendModal').addEventListener('click', () => { qs('#suspendModal').style.display = 'none'; });

/* -------------------------------- Approvals -------------------------------- */
async function renderApprovals(root) {
  const { stats, pendingHostels } = await apiFetch('/superadmin/dashboard');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Pending hostel approvals (${pendingHostels.length})</h3></div>
      ${pendingHostels.length ? pendingHostels.map((h) => `
        <div class="flex-between" style="padding:16px 0;border-bottom:1px solid var(--line);align-items:flex-start;">
          <div>
            <strong>${h.name}</strong>
            <div class="muted" style="font-size:.82rem;">${h.university} · ${h.location?.address||''}</div>
            <div class="muted" style="font-size:.78rem;">Submitted by ${h.owner?.name||'—'} (${h.owner?.email||'—'}, ${h.owner?.phone||'—'})</div>
          </div>
          <div class="flex gap-12">
            <button class="btn btn-sm btn-primary" data-approve="${h._id}">Approve & publish</button>
            <button class="btn btn-sm" style="color:var(--danger);" data-suspend="${h._id}">Reject</button>
          </div>
        </div>`).join('') : '<div class="empty-state"><div class="ic">✅</div><h3>All caught up</h3><p>No hostels awaiting approval.</p></div>'}
    </div>
  `;
  qsa('[data-approve]').forEach((b) => b.addEventListener('click', () => approveHostel(b.dataset.approve)));
  qsa('[data-suspend]').forEach((b) => b.addEventListener('click', () => openSuspendModal(b.dataset.suspend, navigate)));
}

/* --------------------------------- Admins ----------------------------------- */
async function renderAdmins(root) {
  const { admins } = await apiFetch('/superadmin/admins');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Tenant admins (hostel managers)</h3><button class="btn btn-primary btn-sm" id="addAdminBtn">+ Add admin</button></div>
      <div class="table-wrap"><table class="dtable">
        <thead><tr><th>Name</th><th>Email</th><th>Hostels</th><th>Status</th><th>Joined</th><th></th></tr></thead>
        <tbody>${admins.map((a) => `
          <tr><td>${a.name}</td><td>${a.email}</td><td>${(a.hostels||[]).map((h)=>h.name).join(', ')||'—'}</td>
          <td><span class="status-pill ${a.status}">${statusLabel(a.status)}</span></td><td>${fmtDate(a.createdAt)}</td>
          <td>${a.status==='active' ? `<button class="btn btn-sm" style="color:var(--danger);" data-status="${a._id}|suspended">Suspend</button>` : `<button class="btn btn-sm btn-primary" data-status="${a._id}|active">Activate</button>`}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No tenant admins yet.</td></tr>'}</tbody>
      </table></div>
    </div>
  `;
  qs('#addAdminBtn').addEventListener('click', () => { qs('#adminModal').style.display = 'flex'; });
  qsa('[data-status]').forEach((b) => b.addEventListener('click', async () => {
    const [id, status] = b.dataset.status.split('|');
    try { await apiFetch(`/superadmin/admins/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); toast('Updated.', 'success'); navigate(); }
    catch (err) { toast(err.message, 'error'); }
  }));
}
qs('#closeAdminModal').addEventListener('click', () => { qs('#adminModal').style.display = 'none'; });
qs('#adminForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiFetch('/superadmin/admins', { method: 'POST', body: JSON.stringify({ name: qs('#aName').value, email: qs('#aEmail').value, phone: qs('#aPhone').value }) });
    toast('Tenant admin created — credentials emailed.', 'success');
    qs('#adminModal').style.display = 'none';
    e.target.reset();
    navigate();
  } catch (err) { toast(err.message, 'error'); }
});

/* -------------------------------- Reviews ------------------------------------ */
async function renderReviews(root) {
  const { reviews } = await apiFetch('/superadmin/reviews/pending');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Reviews pending moderation</h3></div>
      ${reviews.length ? reviews.map((r) => `
        <div style="padding:14px 0;border-bottom:1px solid var(--line);">
          <div class="flex-between"><strong>${r.student?.name||'Student'} on ${r.hostel?.name||''}</strong><span style="color:var(--gold);">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div>
          <p style="font-size:.86rem;margin:6px 0;">${r.comment||''}</p>
        </div>`).join('') : '<div class="empty-state"><div class="ic">⭐</div><h3>Nothing pending</h3></div>'}
    </div>
  `;
}

/* -------------------------------- Settings ------------------------------------ */
async function renderSettings(root) {
  root.innerHTML = `
    <div class="panel" style="max-width:480px;">
      <h3>Change password</h3>
      <form id="pwForm">
        <div class="field"><label>Current password</label><input type="password" id="curPw" required></div>
        <div class="field"><label>New password</label><input type="password" id="newPw" minlength="8" required></div>
        <button class="btn btn-dark btn-block" type="submit">Update password</button>
      </form>
    </div>
  `;
  qs('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: qs('#curPw').value, newPassword: qs('#newPw').value }) });
      toast('Password updated. Please log in again.', 'success');
      setTimeout(() => { localStorage.clear(); location.href = '/superadmin-login.html'; }, 1200);
    } catch (err) { toast(err.message, 'error'); }
  });
}

navigate();
