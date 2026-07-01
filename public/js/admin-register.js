/* Hosteli Zetu — hostel admin self-registration wizard */

const AMENITIES = [
  'WiFi', 'CCTV Security', 'Borehole water', '24/7 Water supply', 'Study room',
  'Kitchen / Cooking area', 'Laundry', 'Backup generator', 'Parking',
  'Gated compound', 'Gym', 'Common lounge',
];

const TOTAL_STEPS = 5; // 0..4 are data steps, 5 is the success panel
let currentStep = 0;
let rules = [];

function buildAmenityGrid() {
  const grid = qs('#amenityGrid');
  grid.innerHTML = AMENITIES.map((a, i) => `
    <label class="amenity-opt" data-idx="${i}">
      <input type="checkbox" value="${a}">
      <span>${a}</span>
    </label>
  `).join('');

  qsa('.amenity-opt', grid).forEach((opt) => {
    const input = qs('input', opt);
    input.addEventListener('change', () => opt.classList.toggle('checked', input.checked));
  });
}

function renderRules() {
  const list = qs('#rulesList');
  if (!rules.length) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = rules.map((r, i) => `
    <div class="rule-row">
      <input type="text" data-rule-idx="${i}" value="${r.replace(/"/g, '&quot;')}" placeholder="e.g. No visitors after 9pm">
      <button type="button" data-remove-idx="${i}" title="Remove">✕</button>
    </div>
  `).join('');

  qsa('[data-rule-idx]', list).forEach((input) => {
    input.addEventListener('input', () => { rules[Number(input.dataset.ruleIdx)] = input.value; });
  });
  qsa('[data-remove-idx]', list).forEach((btn) => {
    btn.addEventListener('click', () => {
      rules.splice(Number(btn.dataset.removeIdx), 1);
      renderRules();
    });
  });
}

qs('#addRuleBtn').addEventListener('click', () => {
  rules.push('');
  renderRules();
});

function showStep(step) {
  qsa('.step-panel').forEach((p) => p.classList.toggle('active', Number(p.dataset.step) === step));

  const track = qs('#progressTrack');
  const labels = qs('#progressLabels');
  const stepNames = ['Your details', 'Hostel basics', 'Location', 'Contact & amenities', 'Review'];

  if (step < TOTAL_STEPS) {
    track.innerHTML = stepNames.map((_, i) =>
      `<div class="progress-step ${i < step ? 'done' : i === step ? 'active' : ''}"></div>`
    ).join('');
    labels.innerHTML = `<span>Step ${step + 1} of ${TOTAL_STEPS}</span><span>${stepNames[step]}</span>`;
  }

  const actions = qs('#stepActions');
  const backBtn = qs('#backBtn');
  const nextBtn = qs('#nextBtn');
  const submitBtn = qs('#submitBtn');

  if (step >= TOTAL_STEPS) {
    actions.style.display = 'none';
    track.style.display = 'none';
    labels.style.display = 'none';
    return;
  }

  backBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
  nextBtn.style.display = step === TOTAL_STEPS - 1 ? 'none' : 'inline-flex';
  submitBtn.style.display = step === TOTAL_STEPS - 1 ? 'inline-flex' : 'none';

  if (step === TOTAL_STEPS - 1) buildReview();
}

function fieldVal(id) { return qs('#' + id).value.trim(); }

function validateStep(step) {
  const errEl = qs(`#step${step}Error`);
  errEl.style.display = 'none';

  if (step === 0) {
    if (!fieldVal('ownerName')) return fail(errEl, 'Please enter your full name.');
    if (!fieldVal('ownerEmail') || !/^\S+@\S+\.\S+$/.test(fieldVal('ownerEmail'))) return fail(errEl, 'Please enter a valid email.');
    if (!fieldVal('ownerPhone')) return fail(errEl, 'Please enter your phone number.');
    if (fieldVal('ownerPassword').length < 8) return fail(errEl, 'Password must be at least 8 characters.');
    if (fieldVal('ownerPassword') !== fieldVal('ownerPasswordConfirm')) return fail(errEl, 'Passwords do not match.');
  }

  if (step === 1) {
    if (!fieldVal('hName')) return fail(errEl, 'Please enter your hostel name.');
    if (!fieldVal('hUniversity')) return fail(errEl, 'Please tell us which university it serves.');
  }

  if (step === 2) {
    if (!fieldVal('hAddress')) return fail(errEl, 'Please enter the hostel address.');
  }

  if (step === 3) {
    if (!fieldVal('cPhone')) return fail(errEl, 'Please enter a contact phone number for the hostel.');
  }

  return true;
}

function fail(errEl, msg) {
  errEl.textContent = msg;
  errEl.style.display = 'block';
  return false;
}

function collectAmenities() {
  return qsa('#amenityGrid input:checked').map((i) => i.value);
}

function buildReview() {
  const amenities = collectAmenities();
  const nonEmptyRules = rules.filter((r) => r.trim());

  qs('#reviewContent').innerHTML = `
    <div class="review-block">
      <h4>Your details</h4>
      <dl class="review-grid">
        <dt>Name</dt><dd>${fieldVal('ownerName')}</dd>
        <dt>Email</dt><dd>${fieldVal('ownerEmail')}</dd>
        <dt>Phone</dt><dd>${fieldVal('ownerPhone')}</dd>
      </dl>
    </div>
    <div class="review-block">
      <h4>Hostel</h4>
      <dl class="review-grid">
        <dt>Name</dt><dd>${fieldVal('hName')}</dd>
        <dt>University</dt><dd>${fieldVal('hUniversity')}</dd>
        <dt>For</dt><dd>${qs('#hGender').value}</dd>
        <dt>Check-in</dt><dd>${fieldVal('hCheckIn') || '—'}</dd>
      </dl>
    </div>
    <div class="review-block">
      <h4>Location</h4>
      <dl class="review-grid">
        <dt>Address</dt><dd>${fieldVal('hAddress')}</dd>
        <dt>Area</dt><dd>${fieldVal('hArea') || '—'}</dd>
        <dt>City</dt><dd>${fieldVal('hCity') || '—'}</dd>
        <dt>County</dt><dd>${fieldVal('hCounty') || '—'}</dd>
      </dl>
    </div>
    <div class="review-block">
      <h4>Contact</h4>
      <dl class="review-grid">
        <dt>Phone</dt><dd>${fieldVal('cPhone')}</dd>
        <dt>WhatsApp</dt><dd>${fieldVal('cWhatsapp') || '—'}</dd>
      </dl>
    </div>
    <div class="review-block">
      <h4>Amenities</h4>
      <p style="font-size:.88rem;margin:0;">${amenities.length ? amenities.join(', ') : 'None selected'}</p>
    </div>
    ${nonEmptyRules.length ? `
    <div class="review-block">
      <h4>House rules</h4>
      <p style="font-size:.88rem;margin:0;">${nonEmptyRules.join(' · ')}</p>
    </div>` : ''}
  `;
}

qs('#nextBtn').addEventListener('click', () => {
  if (!validateStep(currentStep)) return;
  currentStep += 1;
  showStep(currentStep);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

qs('#backBtn').addEventListener('click', () => {
  currentStep = Math.max(0, currentStep - 1);
  showStep(currentStep);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

qs('#regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateStep(currentStep)) return;

  const submitBtn = qs('#submitBtn');
  const errEl = qs('#step4Error');
  errEl.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const payload = {
    name: fieldVal('ownerName'),
    email: fieldVal('ownerEmail'),
    phone: fieldVal('ownerPhone'),
    password: fieldVal('ownerPassword'),
    hostel: {
      name: fieldVal('hName'),
      tagline: fieldVal('hTagline'),
      description: fieldVal('hDescription'),
      university: fieldVal('hUniversity'),
      gender: qs('#hGender').value,
      location: {
        address: fieldVal('hAddress'),
        area: fieldVal('hArea'),
        city: fieldVal('hCity'),
        county: fieldVal('hCounty'),
        distanceFromCampus: fieldVal('hDistance'),
      },
      contact: {
        phone: fieldVal('cPhone'),
        whatsapp: fieldVal('cWhatsapp'),
        email: fieldVal('cEmail'),
      },
      amenities: collectAmenities(),
      rules: rules.filter((r) => r.trim()),
      checkInTime: fieldVal('hCheckIn'),
    },
  };

  try {
    await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    currentStep = TOTAL_STEPS; // success panel
    showStep(currentStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    fail(errEl, err.message || 'Something went wrong. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit registration';
  }
});

buildAmenityGrid();
renderRules();
showStep(currentStep);
