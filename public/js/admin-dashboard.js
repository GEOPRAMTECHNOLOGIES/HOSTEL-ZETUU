// ---- Auth guard ----
const adminToken = localStorage.getItem('hz_admin_token');
const adminInfo = JSON.parse(localStorage.getItem('hz_admin') || 'null');
if (!adminToken || !adminInfo) location.href = '/admin-login.html';

qs('#userAvatar').textContent = initials(adminInfo?.name || 'A');
qs('#userName').textContent = adminInfo?.name || 'Admin';
qs('#userRole').textContent = (adminInfo?.role || '').replace('_', ' ');

qs('#logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (e) {}
  localStorage.removeItem('hz_admin_token'); localStorage.removeItem('hz_admin');
  location.href = '/admin-login.html';
});

qs('#burgerBtn').addEventListener('click', () => qs('#sidebar').classList.toggle('open'));

let myHostels = [];

/* ------------------------------ View router ------------------------------ */
const views = {
  overview: renderOverview,
  hostels: renderHostels,
  rooms: renderRooms,
  bookings: renderBookings,
  reviews: renderReviews,
  settings: renderSettings,
};

function setActiveNav(view) {
  qsa('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  qs('#viewTitle').textContent = { overview: 'Dashboard', hostels: 'My Hostels', rooms: 'Rooms', bookings: 'Bookings', reviews: 'Reviews', settings: 'Settings' }[view];
  qs('#sidebar').classList.remove('open');
}

async function navigate() {
  const view = location.hash.replace('#', '') || 'overview';
  setActiveNav(view in views ? view : 'overview');
  const root = qs('#viewRoot');
  root.innerHTML = '<div class="card skeleton" style="height:240px;"></div>';
  try {
    await (views[view] || renderOverview)(root);
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><h3>Something went wrong</h3><p>${e.message}</p></div>`;
  }
}
window.addEventListener('hashchange', navigate);

/* -------------------------------- Overview -------------------------------- */
async function renderOverview(root) {
  const { stats, hostels, recentBookings } = await apiFetch('/admin/dashboard');
  myHostels = hostels;

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon green">🏠</div><div class="stat-value">${stats.hostelCount}</div><div class="stat-label">Hostels managed</div></div>
      <div class="stat-card"><div class="stat-icon gold">🛏️</div><div class="stat-value">${stats.availableRooms}/${stats.roomCount}</div><div class="stat-label">Rooms available</div></div>
      <div class="stat-card"><div class="stat-icon coral">📅</div><div class="stat-value">${stats.bookingsThisMonth}</div><div class="stat-label">Bookings this month</div></div>
      <div class="stat-card"><div class="stat-icon blue">💰</div><div class="stat-value">${fmtKES(stats.totalRevenue)}</div><div class="stat-label">Total revenue collected</div></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><h3>Recent bookings</h3><a href="#bookings" class="btn btn-outline btn-sm">View all</a></div>
        <div class="table-wrap">
          <table class="dtable">
            <thead><tr><th>Ref</th><th>Hostel</th><th>Room</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${recentBookings.map((b) => `
              <tr><td class="mono">${b.bookingRef}</td><td>${b.hostel?.name||'—'}</td><td>${b.room?.title||'—'}</td>
              <td><span class="status-pill ${b.status}">${statusLabel(b.status)}</span></td><td>${fmtDate(b.createdAt)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No bookings yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Your hostels</h3></div>
        ${hostels.length ? hostels.map((h) => `
          <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--line);">
            <div><strong style="font-size:.88rem;">${h.name}</strong><div class="muted" style="font-size:.76rem;">${h.availableRooms||0}/${h.totalRooms||0} rooms free</div></div>
            <span class="status-pill ${h.status}">${statusLabel(h.status)}</span>
          </div>`).join('') : `<p class="muted">No hostels yet. <a href="#hostels" style="color:var(--forest);font-weight:600;">Add your first hostel →</a></p>`}
      </div>
    </div>
  `;
}

/* -------------------------------- Hostels -------------------------------- */
async function renderHostels(root) {
  const { hostels } = await apiFetch('/admin/hostels');
  myHostels = hostels;

  root.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>My hostels</h3><button class="btn btn-primary btn-sm" id="addHostelBtn">+ Add hostel</button></div>
      <div class="hostel-mini-grid">
        ${hostels.map((h) => `
          <div class="hostel-mini">
            <div class="thumb">${h.coverImage ? `<img src="${h.coverImage}">` : ''}</div>
            <div class="info">
              <h4>${h.name}</h4>
              <div class="uni">${h.university}</div>
              <div class="row"><span class="status-pill ${h.status}">${statusLabel(h.status)}</span><button class="btn btn-outline btn-sm edit-hostel" data-id="${h._id}">Edit</button></div>
            </div>
          </div>`).join('') || ''}
      </div>
      ${!hostels.length ? '<div class="empty-state"><div class="ic">🏠</div><h3>No hostels yet</h3><p>Add your first property to start listing rooms.</p></div>' : ''}
    </div>
  `;

  qs('#addHostelBtn').addEventListener('click', () => openHostelModal());
  qsa('.edit-hostel').forEach((b) => b.addEventListener('click', () => openHostelModal(hostels.find((h) => h._id === b.dataset.id))));
}

function openHostelModal(hostel) {
  qs('#hostelModalTitle').textContent = hostel ? 'Edit hostel' : 'Add a hostel';
  qs('#hName').value = hostel?.name || '';
  qs('#hUniversity').value = hostel?.university || '';
  qs('#hAddress').value = hostel?.location?.address || '';
  qs('#hArea').value = hostel?.location?.area || '';
  qs('#hGender').value = hostel?.gender || 'mixed';
  qs('#hFee').value = hostel?.bookingFeeAmount || 500;
  qs('#hDescription').value = hostel?.description || '';
  qs('#hAmenities').value = (hostel?.amenities || []).join(', ');
  qs('#hCover').value = hostel?.coverImage || '';
  qs('#hostelForm').dataset.editId = hostel?._id || '';
  qs('#hostelModal').style.display = 'flex';
}
qs('#closeHostelModal').addEventListener('click', () => { qs('#hostelModal').style.display = 'none'; });

qs('#hostelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = e.target.dataset.editId;
  const payload = {
    name: qs('#hName').value, university: qs('#hUniversity').value,
    location: { address: qs('#hAddress').value, area: qs('#hArea').value },
    gender: qs('#hGender').value, bookingFeeAmount: Number(qs('#hFee').value),
    description: qs('#hDescription').value,
    amenities: qs('#hAmenities').value.split(',').map((s) => s.trim()).filter(Boolean),
    coverImage: qs('#hCover').value,
  };
  try {
    if (editId) await apiFetch(`/admin/hostels/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await apiFetch('/admin/hostels', { method: 'POST', body: JSON.stringify(payload) });
    toast(editId ? 'Hostel updated.' : 'Hostel submitted for review.', 'success');
    qs('#hostelModal').style.display = 'none';
    navigate();
  } catch (err) { toast(err.message, 'error'); }
});

/* --------------------------------- Rooms ---------------------------------- */
async function renderRooms(root) {
  if (!myHostels.length) { const r = await apiFetch('/admin/hostels'); myHostels = r.hostels; }

  let allRooms = [];
  for (const h of myHostels) {
    const { rooms } = await apiFetch(`/admin/hostels/${h._id}/rooms`);
    allRooms = allRooms.concat(rooms.map((r) => ({ ...r, hostelName: h.name, hostelId: h._id })));
  }

  root.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Rooms</h3><button class="btn btn-primary btn-sm" id="addRoomBtn" ${!myHostels.length ? 'disabled' : ''}>+ Add room</button></div>
      ${!myHostels.length ? '<p class="muted">Add a hostel first before listing rooms.</p>' : ''}
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr><th>Room</th><th>Hostel</th><th>Type</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>${allRooms.map((r) => `
            <tr><td>${r.title}</td><td>${r.hostelName}</td><td>${r.type.replace('_',' ')}</td><td class="mono">${fmtKES(r.price)}</td>
            <td><span class="status-pill ${r.status}">${statusLabel(r.status)}</span></td>
            <td><button class="btn btn-outline btn-sm edit-room" data-id="${r._id}">Edit</button> <button class="btn btn-sm" style="color:var(--danger);" data-del="${r._id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No rooms yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  qs('#addRoomBtn')?.addEventListener('click', () => openRoomModal(null, allRooms));
  qsa('.edit-room').forEach((b) => b.addEventListener('click', () => openRoomModal(allRooms.find((r) => r._id === b.dataset.id), allRooms)));
  qsa('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this room? This cannot be undone.')) return;
    try { await apiFetch(`/admin/rooms/${b.dataset.del}`, { method: 'DELETE' }); toast('Room deleted.', 'success'); navigate(); }
    catch (err) { toast(err.message, 'error'); }
  }));
}

function openRoomModal(room) {
  qs('#roomModalTitle').textContent = room ? 'Edit room' : 'Add a room';
  const hostelSelect = qs('#rHostel');
  hostelSelect.innerHTML = myHostels.map((h) => `<option value="${h._id}">${h.name}</option>`).join('');
  if (room) hostelSelect.value = room.hostelId;

  qs('#rTitle').value = room?.title || '';
  qs('#rType').value = room?.type || 'single';
  qs('#rPrice').value = room?.price || '';
  qs('#rCapacity').value = room?.capacity || 1;
  qs('#rStatus').value = room?.status || 'available';
  qs('#rAmenities').value = (room?.amenities || []).join(', ');
  qs('#rImage').value = room?.images?.[0]?.url || '';
  qs('#roomForm').dataset.editId = room?._id || '';
  qs('#roomModal').style.display = 'flex';
}
qs('#closeRoomModal').addEventListener('click', () => { qs('#roomModal').style.display = 'none'; });

qs('#roomForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = e.target.dataset.editId;
  const hostelId = qs('#rHostel').value;
  const payload = {
    title: qs('#rTitle').value, type: qs('#rType').value, price: Number(qs('#rPrice').value),
    capacity: Number(qs('#rCapacity').value), status: qs('#rStatus').value,
    amenities: qs('#rAmenities').value.split(',').map((s) => s.trim()).filter(Boolean),
    images: qs('#rImage').value ? [{ url: qs('#rImage').value }] : [],
  };
  try {
    if (editId) await apiFetch(`/admin/rooms/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await apiFetch(`/admin/hostels/${hostelId}/rooms`, { method: 'POST', body: JSON.stringify(payload) });
    toast('Room saved.', 'success');
    qs('#roomModal').style.display = 'none';
    navigate();
  } catch (err) { toast(err.message, 'error'); }
});

/* ------------------------------- Bookings ---------------------------------- */
async function renderBookings(root) {
  const { bookings } = await apiFetch('/admin/bookings');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Bookings</h3></div>
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr><th>Ref</th><th>Hostel</th><th>Room</th><th>Status</th><th>Payment</th><th>Date</th><th></th></tr></thead>
          <tbody>${bookings.map((b) => `
            <tr><td class="mono">${b.bookingRef}</td><td>${b.hostel?.name||'—'}</td><td>${b.room?.title||'—'}</td>
            <td><span class="status-pill ${b.status}">${statusLabel(b.status)}</span></td>
            <td><span class="status-pill ${b.payment?.status==='success'?'confirmed':b.payment?.status||'pending'}">${statusLabel(b.payment?.status||b.paymentStatus)}</span></td>
            <td>${fmtDate(b.createdAt)}</td>
            <td>${b.status==='confirmed' ? `<button class="btn btn-sm" style="color:var(--danger);" data-cancel="${b._id}">Cancel</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No bookings yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
  qsa('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
    const reason = prompt('Reason for cancelling this booking?') || 'Cancelled by hostel admin';
    try { await apiFetch(`/admin/bookings/${b.dataset.cancel}/status`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled', cancelReason: reason }) }); toast('Booking cancelled.', 'success'); navigate(); }
    catch (err) { toast(err.message, 'error'); }
  }));
}

/* -------------------------------- Reviews ----------------------------------- */
async function renderReviews(root) {
  const { reviews } = await apiFetch('/admin/reviews?status=pending');
  root.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Pending review moderation</h3></div>
      ${reviews.length ? reviews.map((r) => `
        <div style="padding:14px 0;border-bottom:1px solid var(--line);">
          <div class="flex-between"><strong>${r.student?.name||'Student'}</strong><span style="color:var(--gold);">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div>
          <p style="font-size:.86rem;margin:6px 0;">${r.comment||''}</p>
          <div class="flex gap-12"><button class="btn btn-sm btn-primary" data-approve="${r._id}">Approve</button><button class="btn btn-sm btn-outline" data-reject="${r._id}">Reject</button></div>
        </div>`).join('') : '<div class="empty-state"><div class="ic">⭐</div><h3>All caught up</h3><p>No reviews pending moderation.</p></div>'}
    </div>
  `;
  qsa('[data-approve]').forEach((b) => b.addEventListener('click', () => moderateReview(b.dataset.approve, 'approved')));
  qsa('[data-reject]').forEach((b) => b.addEventListener('click', () => moderateReview(b.dataset.reject, 'rejected')));
}
async function moderateReview(id, status) {
  try { await apiFetch(`/admin/reviews/${id}/moderate`, { method: 'PUT', body: JSON.stringify({ status }) }); toast(`Review ${status}.`, 'success'); navigate(); }
  catch (err) { toast(err.message, 'error'); }
}

/* -------------------------------- Settings ----------------------------------- */
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
      setTimeout(() => { localStorage.clear(); location.href = '/admin-login.html'; }, 1200);
    } catch (err) { toast(err.message, 'error'); }
  });
}

navigate();
