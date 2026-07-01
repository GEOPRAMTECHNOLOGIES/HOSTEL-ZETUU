const roomId = new URLSearchParams(location.search).get('id');
let roomData = null;
let bookingState = { email: '', bookingFee: 0 };

function reviewHtml(r) {
  return `<div class="review-item"><div class="flex-between"><strong style="font-size:.88rem;">${r.student?.name || 'Student'}</strong><span style="color:var(--gold);font-size:.85rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span></div><p style="margin:6px 0 0;font-size:.86rem;">${r.comment||''}</p></div>`;
}

async function load() {
  const page = qs('#page');
  try {
    const { room, reviews } = await apiFetch(`/public/rooms/${roomId}`);
    roomData = room;
    document.title = `${room.title} — Hosteli Zetu`;
    const available = room.status === 'available';
    const imgs = (room.images || []).map((i) => i.url).filter(Boolean);

    page.innerHTML = `
      <a href="/hostel.html?slug=${room.hostel.slug}" class="muted" style="font-size:.84rem;">← Back to ${room.hostel.name}</a>
      <div class="room-gallery" style="margin:14px 0 24px;">
        ${imgs.length ? imgs.map((src) => `<img src="${src}" alt="${room.title}">`).join('') : `<div style="height:320px;width:100%;background:var(--cream-dark);border-radius:var(--r-lg);"></div>`}
      </div>
      <div class="grid-2" style="align-items:start;">
        <div>
          <span class="tag">${room.type.replace('_',' ')}</span>
          <h1 style="font-size:1.7rem;margin-top:10px;">${room.title}</h1>
          <p class="muted">${room.hostel.name} · ${room.hostel.university} · ${room.hostel.location?.area || ''}</p>
          <div class="panel">
            <h3>Room amenities</h3>
            <div class="amenity-grid">${(room.amenities||[]).map(a=>`<div class="amenity-pill">✓ ${a}</div>`).join('') || '<p class="muted">Standard furnishing.</p>'}</div>
          </div>
          <div class="panel">
            <h3>Reviews</h3>
            ${reviews.length ? reviews.map(reviewHtml).join('') : '<p class="muted">No reviews for this room yet.</p>'}
          </div>
        </div>
        <div class="booking-card">
          <div class="price-big">${fmtKES(room.price)}<span class="muted" style="font-size:.85rem;font-weight:400;"> /month</span></div>
          <p class="muted" style="font-size:.82rem;">Capacity: ${room.capacity} · Deposit: ${fmtKES(room.deposit||0)}</p>
          <span class="status-pill ${available?'confirmed':'pending_payment'}" style="margin:10px 0;display:inline-flex;">${available?'Available now':statusLabel(room.status)}</span>
          <hr class="divider">
          <p style="font-size:.82rem;">Booking fee to reserve: <strong>${fmtKES(room.hostel.bookingFeeAmount || 500)}</strong></p>
          <button class="btn btn-primary btn-block" id="bookBtn" ${available ? '' : 'disabled'}>${available ? 'Book this room' : 'Currently unavailable'}</button>
          <p class="muted" style="font-size:.74rem;margin-top:10px;text-align:center;">Paid securely via M-Pesa. Refundable per hostel policy.</p>
        </div>
      </div>
    `;

    qs('#bookBtn')?.addEventListener('click', openModal);
  } catch (e) {
    page.innerHTML = `<div class="empty-state"><h3>Room not found</h3><p>${e.message}</p><a href="/" class="btn btn-primary">Back to home</a></div>`;
  }
}

function showStep(n) {
  qsa('.step').forEach((s) => s.classList.remove('active'));
  qs(`#step${n}`).classList.add('active');
}

function openModal() {
  qs('#bookingModal').style.display = 'flex';
  showStep(1);
}
qs('#closeModalBtn').addEventListener('click', () => { qs('#bookingModal').style.display = 'none'; });

qs('#detailsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = qs('#continueBtn');
  btn.disabled = true; btn.textContent = 'Sending code…';

  bookingState = {
    name: qs('#fName').value.trim(),
    email: qs('#fEmail').value.trim().toLowerCase(),
    phone: qs('#fPhone').value.trim(),
    university: qs('#fUniversity').value.trim(),
    moveInDate: qs('#fMoveIn').value,
  };

  try {
    const res = await apiFetch('/bookings/otp/request', {
      method: 'POST',
      body: JSON.stringify({ ...bookingState, deviceFingerprint: deviceFingerprint() }),
    });

    if (res.skipOtp) {
      localStorage.setItem('hz_student_token', res.token);
      await submitBooking();
    } else {
      qs('#otpEmailLabel').textContent = bookingState.email;
      showStep(2);
      qsa('.otp-inputs input')[0].focus();
    }
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Continue';
  }
});

// OTP input auto-advance
const otpInputs = qsa('.otp-inputs input');
otpInputs.forEach((inp, idx) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '');
    if (inp.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !inp.value && idx > 0) otpInputs[idx - 1].focus();
  });
});

qs('#verifyOtpBtn').addEventListener('click', async () => {
  const code = otpInputs.map((i) => i.value).join('');
  const errEl = qs('#otpError');
  errEl.style.display = 'none';

  if (code.length !== 6) { errEl.textContent = 'Enter all 6 digits.'; errEl.style.display = 'block'; return; }

  try {
    const res = await apiFetch('/bookings/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email: bookingState.email, code, deviceFingerprint: deviceFingerprint(), deviceLabel: navigator.userAgent.slice(0,60) }),
    });
    localStorage.setItem('hz_student_token', res.token);
    await submitBooking();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

qs('#resendOtpBtn').addEventListener('click', async () => {
  try {
    await apiFetch('/bookings/otp/request', { method: 'POST', body: JSON.stringify({ ...bookingState, deviceFingerprint: deviceFingerprint() }) });
    toast('A new code has been sent.', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

async function submitBooking() {
  showStep(3);
  qs('#stkAmount').textContent = roomData.hostel.bookingFeeAmount || 500;

  try {
    const res = await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        email: bookingState.email,
        phone: bookingState.phone,
        name: bookingState.name,
        university: bookingState.university,
        moveInDate: bookingState.moveInDate,
      }),
    });
    pollPaymentStatus(res.checkoutRequestId, res.bookingRef);
  } catch (err) {
    qs('#stkTitle').textContent = 'Payment could not start';
    qs('#stkMsg').textContent = err.message;
    qs('#stkSpinner').style.display = 'none';
  }
}

async function pollPaymentStatus(checkoutRequestId, bookingRef) {
  let attempts = 0;
  const maxAttempts = 24; // ~2 minutes at 5s interval
  const interval = setInterval(async () => {
    attempts += 1;
    try {
      const { status } = await apiFetch(`/bookings/status/${checkoutRequestId}`);
      if (status === 'success') {
        clearInterval(interval);
        qs('#bookingRefDisplay').textContent = bookingRef;
        showStep(4);
      } else if (status === 'failed' || status === 'cancelled') {
        clearInterval(interval);
        qs('#stkTitle').textContent = 'Payment not completed';
        qs('#stkMsg').textContent = 'The M-Pesa transaction was cancelled or failed. You can try booking again.';
        qs('#stkSpinner').style.display = 'none';
      }
    } catch (e) { /* keep polling */ }

    if (attempts >= maxAttempts) {
      clearInterval(interval);
      qs('#stkTitle').textContent = 'Still waiting on M-Pesa';
      qs('#stkMsg').innerHTML = `Track your booking anytime using reference <strong>${bookingRef}</strong> on the Track Booking page.`;
      qs('#stkSpinner').style.display = 'none';
    }
  }, 5000);
}

load();
