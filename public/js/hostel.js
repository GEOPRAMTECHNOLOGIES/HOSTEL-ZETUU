document.getElementById('yr').textContent = new Date().getFullYear();

const slug = new URLSearchParams(location.search).get('slug');

function galleryHtml(hostel) {
  const imgs = [hostel.coverImage, ...(hostel.gallery || []).map((g) => g.url)].filter(Boolean).slice(0, 5);
  if (!imgs.length) return `<div class="gallery"><div style="background:var(--cream-dark);border-radius:var(--r-lg);height:340px;"></div></div>`;
  return `<div class="gallery">${imgs.map((src, i) => `<a class="g${i}"><img src="${src}" alt="${hostel.name} photo ${i+1}"></a>`).join('')}</div>`;
}

function roomRowHtml(room) {
  const available = room.status === 'available';
  return `
    <div class="room-row">
      <div class="rr-thumb">${room.images?.[0]?.url ? `<img src="${room.images[0].url}" alt="${room.title}">` : ''}</div>
      <div>
        <h4>${room.title}</h4>
        <div class="muted" style="font-size:.82rem;margin-bottom:6px;">${room.type.replace('_',' ')} · Capacity ${room.capacity}</div>
        <span class="status-pill ${available ? 'confirmed' : 'pending_payment'}">${available ? 'Available' : statusLabel(room.status)}</span>
      </div>
      <div class="rr-action text-center">
        <div class="price">${fmtKES(room.price)}<span class="muted" style="font-size:.7rem;font-weight:400;">/mo</span></div>
        <a href="/room.html?id=${room._id}" class="btn ${available ? 'btn-primary' : 'btn-outline'} btn-sm" style="margin-top:8px;">${available ? 'View & Book' : 'View details'}</a>
      </div>
    </div>`;
}

function reviewHtml(r) {
  return `
    <div class="review-item">
      <div class="flex-between">
        <strong style="font-size:.88rem;">${r.student?.name || 'Student'}</strong>
        <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
      </div>
      <p style="margin:6px 0 0;font-size:.86rem;">${r.comment || ''}</p>
    </div>`;
}

async function load() {
  const page = qs('#page');
  if (!slug) { page.innerHTML = '<div class="empty-state"><h3>Hostel not specified</h3></div>'; return; }

  try {
    const { hostel, rooms, reviews } = await apiFetch(`/public/hostels/${slug}`);
    document.title = `${hostel.name} — Hosteli Zetu`;

    page.innerHTML = `
      ${galleryHtml(hostel)}
      <div class="hostel-head">
        <div>
          <div class="flex gap-8" style="margin-bottom:8px;">
            ${hostel.verified ? '<span class="tag tag-success">✓ Verified</span>' : ''}
            <span class="tag">${hostel.gender === 'mixed' ? 'Mixed' : hostel.gender === 'male' ? 'Male only' : 'Female only'}</span>
          </div>
          <h1 style="font-size:1.8rem;">${hostel.name}</h1>
          <p class="muted">${hostel.university} · ${hostel.location?.address || ''} ${hostel.location?.distanceFromCampus ? `· ${hostel.location.distanceFromCampus} from campus` : ''}</p>
        </div>
        <span class="pulse-badge"><span class="pulse-dot"></span>${hostel.availableRooms} rooms available now</span>
      </div>

      <div class="grid-2" style="align-items:start;">
        <div>
          <div class="panel">
            <h3>About this hostel</h3>
            <p>${hostel.description || 'No description provided yet.'}</p>
          </div>

          <div class="panel">
            <h3>Amenities</h3>
            <div class="amenity-grid">${(hostel.amenities || []).map((a) => `<div class="amenity-pill">✓ ${a}</div>`).join('') || '<p class="muted">No amenities listed.</p>'}</div>
          </div>

          <div class="panel">
            <h3>Available rooms</h3>
            <div class="room-list">${rooms.length ? rooms.map(roomRowHtml).join('') : '<p class="muted">No rooms listed yet.</p>'}</div>
          </div>

          <div class="panel">
            <h3>Reviews ${hostel.ratingCount ? `· ★ ${hostel.ratingAvg.toFixed(1)} (${hostel.ratingCount})` : ''}</h3>
            ${reviews.length ? reviews.map(reviewHtml).join('') : '<p class="muted">No reviews yet — be the first to book and review!</p>'}
          </div>
        </div>

        <div class="sidebar-card">
          <h3>Contact</h3>
          <p style="font-size:.88rem;">📞 ${hostel.contact?.phone || 'Not provided'}</p>
          <p style="font-size:.88rem;">✉️ ${hostel.contact?.email || 'Not provided'}</p>
          <hr class="divider">
          <h3>House rules</h3>
          <ul style="font-size:.85rem;color:var(--ink-soft);padding-left:18px;">
            ${(hostel.rules || []).map((r) => `<li>${r}</li>`).join('') || '<li>Standard hostel rules apply.</li>'}
          </ul>
          <p class="muted" style="font-size:.78rem;">Check-in: ${hostel.checkInTime}</p>
        </div>
      </div>
    `;
  } catch (e) {
    page.innerHTML = `<div class="empty-state"><div class="ic">🔍</div><h3>Hostel not found</h3><p>${e.message}</p><a href="/" class="btn btn-primary">Back to home</a></div>`;
  }
}

load();
