function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
}

function makeReceiptPdf(data = {}) {
  const lines = [
    'HOSTELI ZETU',
    'PAYMENT RECEIPT',
    '----------------------------------------',
    `Receipt: ${data.receipt || 'Pending'}`,
    `Transaction: ${data.transactionRef || '-'}`,
    `Booking: ${data.bookingRef || '-'}`,
    `Student: ${data.studentName || '-'}`,
    `Email: ${data.email || '-'}`,
    `Hostel: ${data.hostelName || '-'}`,
    `Room: ${data.roomTitle || '-'}`,
    `Amount: KES ${Number(data.amount || 0).toLocaleString('en-KE')}`,
    `Method: ${String(data.method || 'M-Pesa').toUpperCase()}`,
    `Date: ${data.date || new Date().toISOString()}`,
    '----------------------------------------',
    'Thank you for your payment.',
    'This receipt was generated automatically by Hosteli Zetu.',
  ];
  const content = ['BT', '/F1 16 Tf', '50 760 Td', `(${pdfEscape(lines[0])}) Tj`, '/F1 11 Tf', '0 -28 Td'];
  for (let i = 1; i < lines.length; i++) {
    content.push(`(${pdfEscape(lines[i])}) Tj`, '0 -22 Td');
  }
  content.push('ET');
  const stream = content.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

module.exports = { makeReceiptPdf };
