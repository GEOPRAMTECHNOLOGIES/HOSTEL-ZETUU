qs('#trackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ref = qs('#refInput').value.trim().toUpperCase();
  const resultBox = qs('#result');
  resultBox.innerHTML = '<div class="card skeleton" style="height:160px;margin-top:24px;"></div>';
  try {
    const { booking } = await apiFetch(`/bookings/track/${ref}`);
    resultBox.innerHTML = `
      <div class="result-card">
        <div class="flex-between"><h3 style="margin:0;">${booking.bookingRef}</h3><span class="status-pill ${booking.status}">${statusLabel(booking.status)}</span></div>
        <div class="result-row"><span class="muted">Hostel</span><strong>${booking.hostel?.name || '—'}</strong></div>
        <div class="result-row"><span class="muted">Room</span><strong>${booking.room?.title || '—'}</strong></div>
        <div class="result-row"><span class="muted">Move-in date</span><strong>${fmtDate(booking.moveInDate)}</strong></div>
        <div class="result-row"><span class="muted">Booking fee</span><strong>${fmtKES(booking.bookingFee)}</strong></div>
        <div class="result-row"><span class="muted">Payment status</span><span class="status-pill ${booking.paymentStatus === 'paid' ? 'confirmed' : booking.paymentStatus}">${statusLabel(booking.paymentStatus)}</span></div>
        ${booking.payment?.mpesaReceiptNumber ? `<div class="result-row"><span class="muted">M-Pesa Receipt</span><strong class="mono">${booking.payment.mpesaReceiptNumber}</strong></div>` : ''}
        <div class="result-row"><span class="muted">Hostel contact</span><strong>${booking.hostel?.contact?.phone || '—'}</strong></div>
      </div>`;
  } catch (err) {
    resultBox.innerHTML = `<div class="result-card text-center"><p class="muted">${err.message}</p></div>`;
  }
});
