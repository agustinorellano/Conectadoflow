import { jsPDF } from 'jspdf';
import { formatCurrency, formatDate } from '@/lib/flowUtils';

// Builds the PDF for a generated document. Same visual conventions as the
// other jsPDF exports in the app (Productos, Reportes): bold header, muted
// subtitle, a simple table, page-numbered footer. Returns the jsPDF
// instance — caller decides whether to .save(), .output('blob'), etc.
export function buildDocumentPdf({ doc: docData, issuer, filledIntro, filledConditions, items, showPrices, showSignature, currency }) {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 20;
  let y = 20;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 20) { pdf.addPage(); y = 20; }
  };

  // Header: issuer identity
  pdf.setFontSize(16); pdf.setFont(undefined, 'bold');
  pdf.text(issuer.company_name || issuer.name || 'Mi empresa', marginX, y); y += 7;
  pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); pdf.setTextColor(100);
  const issuerLines = [
    issuer.billing_name && `Razón social: ${issuer.billing_name}`,
    issuer.billing_tax_id && `CUIT: ${issuer.billing_tax_id}`,
    (issuer.billing_address || issuer.address) && `Domicilio: ${issuer.billing_address || issuer.address}`,
    (issuer.billing_email || issuer.email) && `Email: ${issuer.billing_email || issuer.email}`,
  ].filter(Boolean);
  issuerLines.forEach(line => { pdf.text(line, marginX, y); y += 4.5; });
  y += 4;

  // Doc title + number/date, right-aligned block
  pdf.setTextColor(0); pdf.setFontSize(13); pdf.setFont(undefined, 'bold');
  pdf.text(docData.doc_type, marginX, y);
  pdf.setFontSize(9); pdf.setFont(undefined, 'normal'); pdf.setTextColor(100);
  pdf.text(`N° ${docData.document_number || '—'}`, pageWidth - marginX, y - 5, { align: 'right' });
  pdf.text(`Fecha: ${formatDate(docData.date)}`, pageWidth - marginX, y, { align: 'right' });
  y += 8;

  pdf.setDrawColor(220); pdf.line(marginX, y, pageWidth - marginX, y); y += 8;

  // Intro paragraph (already variable-filled by the caller)
  pdf.setTextColor(0); pdf.setFontSize(10); pdf.setFont(undefined, 'normal');
  const introLines = pdf.splitTextToSize(filledIntro || '', pageWidth - marginX * 2);
  ensureSpace(introLines.length * 5 + 4);
  pdf.text(introLines, marginX, y); y += introLines.length * 5 + 6;

  // Items table
  if (items?.length) {
    ensureSpace(14);
    const cols = showPrices
      ? [{ k: 'description', label: 'Producto/Servicio', w: 58 }, { k: 'quantity', label: 'Cant.', w: 16 }, { k: 'delivered', label: 'Entreg.', w: 18 }, { k: 'pending', label: 'Pend.', w: 16 }, { k: 'unit_price', label: 'P. Unit.', w: 24 }, { k: 'subtotal', label: 'Importe', w: 24 }]
      : [{ k: 'description', label: 'Producto/Servicio', w: 80 }, { k: 'quantity', label: 'Cant.', w: 22 }, { k: 'delivered', label: 'Entreg.', w: 22 }, { k: 'pending', label: 'Pend.', w: 22 }];
    let x = marginX;
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(9); pdf.setTextColor(0);
    cols.forEach(c => { pdf.text(c.label, x, y); x += c.w; });
    y += 2; pdf.setDrawColor(200); pdf.line(marginX, y, marginX + cols.reduce((s, c) => s + c.w, 0), y); y += 5;

    pdf.setFont(undefined, 'normal');
    items.forEach(it => {
      ensureSpace(10);
      x = marginX;
      const subtotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      const cells = {
        description: (it.description || '').slice(0, 40),
        quantity: String(it.quantity ?? ''),
        delivered: String(it.delivered ?? ''),
        pending: String(it.pending ?? ''),
        unit_price: showPrices ? formatCurrency(it.unit_price, currency) : '',
        subtotal: showPrices ? formatCurrency(subtotal, currency) : '',
      };
      cols.forEach(c => { pdf.text(String(cells[c.k] ?? ''), x, y); x += c.w; });
      y += 5.5;
      if (it.notes) {
        pdf.setFontSize(8); pdf.setTextColor(130);
        const noteLines = pdf.splitTextToSize(`Obs: ${it.notes}`, pageWidth - marginX * 2 - 10);
        pdf.text(noteLines, marginX + 4, y); y += noteLines.length * 4;
        pdf.setFontSize(9); pdf.setTextColor(0);
      }
    });
    y += 4;

    if (showPrices && docData.total_amount != null) {
      ensureSpace(10);
      pdf.setFont(undefined, 'bold');
      pdf.text(`Total: ${formatCurrency(docData.total_amount, currency)}`, pageWidth - marginX, y, { align: 'right' });
      pdf.setFont(undefined, 'normal');
      y += 8;
    }
  }

  // Conditions / observations
  if (filledConditions) {
    ensureSpace(14);
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(10); pdf.text('Condiciones', marginX, y); y += 5;
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(9); pdf.setTextColor(80);
    const condLines = pdf.splitTextToSize(filledConditions, pageWidth - marginX * 2);
    ensureSpace(condLines.length * 4.5);
    pdf.text(condLines, marginX, y); y += condLines.length * 4.5 + 6;
  }
  if (docData.observations) {
    ensureSpace(14);
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(10); pdf.setTextColor(0); pdf.text('Observaciones', marginX, y); y += 5;
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(9); pdf.setTextColor(80);
    const obsLines = pdf.splitTextToSize(docData.observations, pageWidth - marginX * 2);
    ensureSpace(obsLines.length * 4.5);
    pdf.text(obsLines, marginX, y); y += obsLines.length * 4.5 + 6;
  }

  // Signature / receipt acknowledgement block
  if (showSignature) {
    ensureSpace(35);
    y += 10;
    const colW = (pageWidth - marginX * 2 - 10) / 2;
    pdf.setDrawColor(150);
    pdf.line(marginX, y, marginX + colW, y);
    pdf.line(marginX + colW + 10, y, marginX + colW * 2 + 10, y);
    pdf.setFontSize(8); pdf.setTextColor(100);
    pdf.text('Firma y aclaración — Entrega', marginX, y + 5);
    pdf.text('Firma, aclaración y DNI — Recepción', marginX + colW + 10, y + 5);
    y += 14;
    pdf.text('Fecha de recepción: _____/_____/________', marginX, y);
  }

  // Footer pagination (only when more than one page)
  const pageCount = pdf.internal.pages.length - 1;
  if (pageCount > 1) {
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8); pdf.setTextColor(150);
      pdf.text(`${issuer.company_name || ''} · Página ${p} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  }

  return pdf;
}
