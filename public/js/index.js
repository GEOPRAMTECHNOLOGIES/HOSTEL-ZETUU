document.getElementById('yr').textContent = new Date().getFullYear();

let currentPage = 1;
let currentFilters = {};

async function loadStats() {
  try {
    const { stats } = await apiFetch('/public/stats');
    qs('#statHostels').textContent = stats.hostelCount;
    qs('#statRooms').textContent = stats.roomCount;
    qs('#statAvailable').textContent = stats.availableRoomCount;
    qs('#heroHostelCount').textContent = stats.hostelCount;
  } catch (e) { /* silent */ }
}

async function loadUniversities() {
  try {
    const { universities } = await apiFetch('/public/universities');
    const select = qs('#sUniversity');
    universities.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u; opt.textContent = u;
      select.appendChild(opt);
    });

    const chipBox = qs('#uniChips');
    chipBox.innerHTML = '<button class="uni-chip active" data-uni="">All universities</button>' +
      universities.slice(0, 8).map((u) => `<button class="uni-chip" data-uni="${u}">${u}</button>`).join('');

    qsa('.uni-chip', chipBox).forEach((chip) => {
      chip.addEventListener('click', () => {
        qsa('.uni-chip', chipBox).forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilters.university = chip.dataset.uni;
        currentPage = 1;
        loadHostels(true);
      });
    });
  } catch (e) { /* silent */ }
}

function hostelCardHtml(h) {
  const img = h.coverImage || '';
  const fromPrice = h.cheapestPrice ? fmtKES(h.cheapestPrice) : null;
  return `
    <a href="/hostel.html?slug=${h.slug}" class="card hostel-card">
      <div class="thumb">
        ${img ? `<img src="${img}" alt="${h.name}" loading="lazy">` : ''}
        ${h.verified ? '<span class="tag tag-success badge-top">✓ Verified</span>' : ''}
        ${h.ratingCount ? `<span class="badge-rating">★ ${h.ratingAvg.toFixed(1)}</span>` : ''}
      </div>
      <div class="info">
        <h3>${h.name}</h3>
        <div class="uni">${h.university} · ${h.location?.area || h.location?.city || ''}</div>
        <span class="pulse-badge"><span class="pulse-dot"></span>${h.availableRooms ?? 0} rooms available</span>
        <div class="row-bottom">
          <span class="tag">${h.gender === 'mixed' ? 'Mixed' : h.gender === 'male' ? 'Male only' : 'Female only'}</span>
        </div>
      </div>
    </a>`;
}

async function loadHostels(reset = false) {
  const grid = qs('#hostelGrid');
  if (reset) { grid.innerHTML = '<div class="card skeleton" style="height:280px"></div><div class="card skeleton" style="height:280px"></div><div class="card skeleton" style="height:280px"></div>'; }

  const params = new URLSearchParams({ page: currentPage, limit: 9, ...currentFilters });
  Object.keys(currentFilters).forEach((k) => { if (!currentFilters[k]) params.delete(k); });

  try {
    const { hostels, total } = await apiFetch(`/public/hostels?${params.toString()}`);
    if (reset) grid.innerHTML = '';

    if (!hostels.length && reset) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="ic">🏚️</div><h3>No hostels match your search</h3><p>Try a different university or budget.</p></div>`;
      return;
    }

    grid.insertAdjacentHTML('beforeend', hostels.map(hostelCardHtml).join(''));
    qs('#loadMoreBtn').style.display = currentPage * 9 < total ? 'inline-flex' : 'none';
  } catch (e) {
    toast('Could not load hostels. Try refreshing.', 'error');
  }
}

qs('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  currentFilters = {
    university: qs('#sUniversity').value,
    gender: qs('#sGender').value,
    maxPrice: qs('#sMaxPrice').value,
  };
  currentPage = 1;
  document.getElementById('browse').scrollIntoView({ behavior: 'smooth' });
  loadHostels(true);
});

qs('#loadMoreBtn').addEventListener('click', () => { currentPage += 1; loadHostels(false); });

loadStats();
loadUniversities();
loadHostels(true);
