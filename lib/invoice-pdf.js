/** Facture 0 € — séance d'essai offerte (PDF minimal, sans dépendance). */

function pdfEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapWinAnsi(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/€/g, 'EUR')
    .replace(/[^\x20-\x7E]/g, ' ');
}

export function seanceInvoiceFilename(orderId) {
  return `facture-seance-essai-${String(orderId || 'SOLO').replace(/[^\w.-]+/g, '')}.pdf`;
}

export function buildSeanceInvoicePdf({
  orderId,
  prenom,
  nom,
  email,
  salleLabel,
  visitLabel,
} = {}) {
  const invoiceNo = `FAC-${String(orderId || 'ESSAI').slice(0, 24)}`;
  const today = new Date().toLocaleDateString('fr-FR');
  const lines = [
    'BOXING CENTER',
    `Facture ${invoiceNo}  -  ${today}`,
    '',
    `Client : ${wrapWinAnsi(`${prenom || ''} ${nom || ''}`.trim())}`,
    email ? `Email : ${wrapWinAnsi(email)}` : '',
    salleLabel ? `Salle : ${wrapWinAnsi(salleLabel)}` : '',
    visitLabel ? `Seance prevue : ${wrapWinAnsi(visitLabel)}` : '',
    '',
    "Prestation : seance d'essai offerte (valeur 10,00 EUR)",
    'Montant TTC : 0,00 EUR',
    '',
    "Cette facture confirme l'inscription a une seance d'essai offerte.",
    "Elle ne constitue pas un contrat d'abonnement.",
  ].filter((line, i, arr) => line !== '' || (arr[i - 1] !== '' && i !== 0));

  const content = lines
    .map((line, i) => `BT /F1 12 Tf 50 ${760 - i * 18} Td (${pdfEscape(wrapWinAnsi(line))}) Tj ET`)
    .join('\n');

  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
  add(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
