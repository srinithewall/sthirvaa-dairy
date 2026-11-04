// Monthly auditor package: the API's shape, the figures each section shows, and the merged PDF.

import type { PDFDocument as PdfDoc } from 'pdf-lib';
import { TYPE_LABEL, categoryLabel, typeFromBooking } from '@/lib/bank';

export interface CashExpense {
  id: number;
  ledgerExpenseId?: number | null;
  date: string;
  category?: string | null;
  description?: string | null;
  amount: number;
  paidBy?: string | null;
  excluded: boolean;
  /** Entered by hand in the app: someone ticks it as checked before the package goes out. */
  reviewed: boolean;
  reviewedBy?: string | null;
  /** Changed in the package; the Digital Ledger entry is left as it was. */
  edited: boolean;
  /** A bank line now pays this ledger expense: keeping it would count it twice. */
  paidThroughBank: boolean;
}

export interface LedgerExpense {
  id: number;
  date: string;
  category?: string | null;
  description?: string | null;
  amount: number;
  paidBy?: string | null;
  paidThroughBank: boolean;
}

export interface PackageBankLine {
  id: number;
  date: string;
  narration?: string | null;
  counterparty?: string | null;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  status: 'UNMAPPED' | 'SUGGESTED' | 'MAPPED' | 'IGNORED';
  kind?: 'EXPENSE' | 'INCOME' | 'SETTLEMENT' | null;
  category?: string | null;
  note?: string | null;
  /** A transfer typed Salary to an employee with an audit salary: it pays that salary, so it is not a second one. */
  salaryOf?: string | null;
}

export interface AuditPackageView {
  package: {
    id: number;
    periodFrom: string;
    periodTo: string;
    includeGst: boolean;
    gstNote?: string | null;
    notes?: string | null;
    documentSavedAt?: string | null;
    documentSavedBy?: string | null;
    updatedAt?: string | null;
    updatedBy?: string | null;
  };
  cashExpenses: CashExpense[];
  ledgerExpenses: LedgerExpense[];
  /** Fixed monthly salaries the audit shows (from the salary rules). */
  salaries: { staffId: number; name: string; amount: number; bankName?: string | null }[];
  bank: {
    accountLast4?: string | null;
    openingBalance?: number | null;
    receipts: number;
    payments: number;
    closingBalance?: number | null;
    lines: PackageBankLine[];
  };
  /** What reached the bank (money in booked as Sold or other income); the app's milk records are not used. */
  sales: {
    byCategory: { category: string; count: number; amount: number }[];
    receipts: { date: string; party?: string | null; narration?: string | null; category: string; amount: number; note?: string | null }[];
    /** Money in not yet given a type on the Transactions tab. */
    unreviewedCount: number;
    unreviewedAmount: number;
  };
  statements: { id: number; periodFrom: string; periodTo: string; accountLast4?: string | null; pages?: number | null }[];
  attachments: { id: number; fileName: string; contentType: string; sizeBytes: number; included: boolean; uploadedAt: string }[];
}

/** One line of the purchase register: a bank payment booked as an expense, or a cash expense. */
export interface PurchaseLine {
  date: string;
  description: string;
  category: string;
  via: string;
  amount: number;
  /** BANK: from the Kotak statement. MANUAL: entered by hand in the app. SALARY: fixed salary set for the audit. */
  source: 'BANK' | 'MANUAL' | 'SALARY';
  reviewed: boolean;
}

export interface PackageFigures {
  purchases: PurchaseLine[];
  purchasesByCategory: { category: string; count: number; amount: number }[];
  bankPurchases: number;
  cashPurchases: number;
  salaryPurchases: number;
  /** Bank transfers that pay the audit salaries (not in the register themselves). */
  salaryPayments: number;
  totalPurchases: number;
  totalSales: number;
  staffSettlements: number;
  /** Bank lines not yet reviewed, so not in either register. */
  unreviewed: PackageBankLine[];
  /** Manual (app-entered) purchase lines nobody has ticked as checked yet. */
  manualToReview: number;
  /** Closing balance worked out from opening + receipts - payments, to set against the statement's. */
  computedClosing: number | null;
}

const byCategory = <T,>(rows: T[], cat: (r: T) => string, amt: (r: T) => number) => {
  const m = new Map<string, { category: string; count: number; amount: number }>();
  rows.forEach(r => {
    const k = cat(r);
    const g = m.get(k) || { category: k, count: 0, amount: 0 };
    g.count += 1;
    g.amount += amt(r);
    m.set(k, g);
  });
  return [...m.values()].sort((a, b) => b.amount - a.amount);
};

export function figures(v: AuditPackageView): PackageFigures {
  const bankExpenses = v.bank.lines.filter(l => l.status === 'MAPPED' && l.direction === 'DEBIT' && l.kind === 'EXPENSE' && !l.salaryOf);
  const salaryTransfers = v.bank.lines.filter(l => l.salaryOf);
  const cash = v.cashExpenses.filter(c => !c.excluded);
  const salaries = v.salaries || [];
  const purchases: PurchaseLine[] = [
    ...bankExpenses.map(l => ({
      date: l.date,
      description: [l.narration || l.counterparty || '', l.note].filter(Boolean).join(' · '),
      category: categoryLabel(l.category),
      via: 'Bank',
      amount: l.amount,
      source: 'BANK' as const,
      reviewed: true,
    })),
    ...cash.map(c => ({
      date: c.date,
      description: [c.description, c.paidBy && `paid by ${c.paidBy}`].filter(Boolean).join(' · '),
      category: categoryLabel(c.category),
      via: 'Manual',
      amount: c.amount,
      source: 'MANUAL' as const,
      reviewed: c.reviewed,
    })),
    ...salaries.map(sal => ({
      date: v.package.periodTo,
      description: `Salary for ${monthLabel(v.package.periodFrom)} - ${sal.name}`,
      category: 'Salary',
      via: 'Salary',
      amount: sal.amount,
      source: 'SALARY' as const,
      reviewed: true,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const bankPurchases = bankExpenses.reduce((a, l) => a + l.amount, 0);
  const cashPurchases = cash.reduce((a, c) => a + c.amount, 0);
  const salaryPurchases = salaries.reduce((a, s) => a + s.amount, 0);
  const o = v.bank.openingBalance;
  return {
    purchases,
    purchasesByCategory: byCategory(purchases, p => p.category, p => p.amount),
    bankPurchases,
    cashPurchases,
    salaryPurchases,
    salaryPayments: salaryTransfers.reduce((a, l) => a + l.amount, 0),
    totalPurchases: bankPurchases + cashPurchases + salaryPurchases,
    totalSales: v.sales.byCategory.reduce((a, s) => a + s.amount, 0),
    staffSettlements: v.bank.lines.filter(l => l.status === 'MAPPED' && l.direction === 'DEBIT' && l.kind === 'SETTLEMENT')
      .reduce((a, l) => a + l.amount, 0),
    unreviewed: v.bank.lines.filter(l => l.status === 'UNMAPPED' || l.status === 'SUGGESTED'),
    manualToReview: cash.filter(c => !c.reviewed).length,
    computedClosing: o == null ? null : o + v.bank.receipts - v.bank.payments,
  };
}

/** "Oct 2026" for a whole month. */
export const monthLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/**
 * Text the PDF's built-in font can draw: it has no ₹ and no non-Latin letters, which otherwise
 * come out as wide gaps and stray symbols ("T r a i l ... ¹100").
 */
export const pdfText = (s: string) => s.replace(/₹\s?/g, 'Rs ').replace(/[\u2013\u2014]/g, '-').replace(/[^\x00-\xFF]/g, '?');

/** Whole rupees for the PDF, whose built-in font has no ₹ glyph. */
const rs = (n: number | null | undefined) =>
  n == null ? '—' : `${n < 0 ? '-' : ''}Rs ${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
const day = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const SECTIONS = [
  'Executive Summary',
  'Purchase Register Summary',
  'Sales Register Summary',
  'Bank Reconciliation Summary',
  'GST Summary',
  'Bank Statement (Annexure A)',
  'Invoices (Annexure B)',
] as const;

const GREEN: [number, number, number] = [27, 67, 50];
/** Purchase register rows: from the bank statement, or entered by hand in the app. */
const BANK_FILL: [number, number, number] = [226, 238, 251];
const MANUAL_FILL: [number, number, number] = [253, 242, 220];
const SALARY_FILL: [number, number, number] = [237, 233, 254];

/**
 * Builds the package as one PDF, sections in the agreed order: 1-7 written here, then Kotak's own
 * statement (Annexure A), then the ticked invoices (Annexure B). Returns the bytes; the caller
 * saves a copy with the package and downloads it.
 */
export async function buildPackagePdf(
  v: AuditPackageView,
  fetchStatement: (id: number) => Promise<ArrayBuffer>,
  fetchAttachment: (id: number) => Promise<ArrayBuffer>,
  preparedBy: string,
): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const f = figures(v);
  const p = v.package;
  const month = monthLabel(p.periodFrom);

  // Attachments first, so the contents page can give their page numbers.
  const statements = await Promise.all(v.statements.map(async s => PDFDocument.load(await fetchStatement(s.id))));
  const invoices = v.attachments.filter(a => a.included);
  const invoiceDocs: { name: string; doc?: PdfDoc; image?: { bytes: ArrayBuffer; png: boolean } }[] = [];
  for (const a of invoices) {
    const bytes = await fetchAttachment(a.id);
    if (a.contentType === 'application/pdf') invoiceDocs.push({ name: a.fileName, doc: await PDFDocument.load(bytes) });
    else invoiceDocs.push({ name: a.fileName, image: { bytes, png: a.contentType === 'image/png' } });
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const start: Record<number, number> = {};
  /** Where the last table or note ended, so a short section follows on the same page. */
  let cursor = H;

  /** Sections run on from one another; a new page only when the last one left too little room. */
  const heading = (n: number, title: string) => {
    let y = cursor + 30;
    if (doc.getNumberOfPages() === 1 || y > H - 150) {
      doc.addPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(month, M, 32);
      doc.setTextColor(0);
      y = 60;
    }
    start[n] = doc.getNumberOfPages();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${n}. ${title}`, M, y);
    doc.setFont('helvetica', 'normal');
    cursor = y + 16;
    return cursor;
  };
  const table = (startY: number, head: string[], body: (string | number)[][], opts: any = {}) => {
    autoTable(doc, {
      startY,
      head: [head],
      body: body.map(r => r.map(c => pdfText(String(c)))),
      headStyles: { fillColor: GREEN, fontSize: 9 },
      styles: { fontSize: 8.5, valign: 'top' },
      margin: { left: M, right: M, top: 48 },
      ...opts,
    });
    cursor = (doc as any).lastAutoTable.finalY as number;
    return cursor;
  };
  const note = (y: number, text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(90);
    const lines = doc.splitTextToSize(pdfText(text), W - 2 * M);
    doc.text(lines, M, y);
    doc.setTextColor(0);
    cursor = y + lines.length * 11 + 6;
    return cursor;
  };
  /** A small sub-heading inside a section. */
  const sub = (y: number, text: string) => {
    if (y > H - 90) { doc.addPage(); y = 60; }
    doc.setFontSize(11);
    doc.text(text, M, y);
    cursor = y + 8;
    return cursor;
  };
  const right = (cols: number[]) => Object.fromEntries(cols.map(c => [c, { halign: 'right' }]));

  // Page 1 is the executive summary, written last once every section's page is known.

  // 2. Purchase register
  let y = heading(2, SECTIONS[1]);
  y = table(y, ['Category', 'Entries', 'Amount'],
    f.purchasesByCategory.map(g => [g.category, g.count, rs(g.amount)]),
    { foot: [['Total', f.purchases.length, rs(f.totalPurchases)]], footStyles: { fillColor: [232, 245, 238], textColor: 0 }, columnStyles: right([1, 2]) });
  y = note(y + 14, `From the bank statement: ${rs(f.bankPurchases)} (blue rows). Entered by hand in the app (manual, not through the bank): ${rs(f.cashPurchases)} (amber rows).`
    + (f.salaryPurchases ? ` Salaries: ${rs(f.salaryPurchases)} (violet rows), the fixed monthly salary; the bank transfers that pay them (${rs(f.salaryPayments)}) are not counted again.` : '')
    + (f.manualToReview ? ` ${f.manualToReview} manual line(s) were not yet checked.` : ''));
  table(y + 4, ['Date', 'Description', 'Category', 'Source', 'Amount'],
    f.purchases.map(l => [day(l.date), l.description, l.category, l.source === 'MANUAL' && !l.reviewed ? 'Manual, not checked' : l.via, rs(l.amount)]),
    {
      columnStyles: { 0: { cellWidth: 62 }, 2: { cellWidth: 80 }, 3: { cellWidth: 100 }, 4: { cellWidth: 66, halign: 'right' } },
      didParseCell: (d: any) => {
        if (d.section !== 'body') return;
        const src = f.purchases[d.row.index]?.source;
        d.cell.styles.fillColor = src === 'BANK' ? BANK_FILL : src === 'SALARY' ? SALARY_FILL : MANUAL_FILL;
      },
    });

  // 3. Sales register
  y = heading(3, SECTIONS[2]);
  y = table(y, ['Sales', 'Receipts', 'Amount'],
    v.sales.byCategory.map(s => [categoryLabel(s.category), s.count, rs(s.amount)]),
    { foot: [['Total', v.sales.byCategory.reduce((a, s) => a + s.count, 0), rs(f.totalSales)]], footStyles: { fillColor: [232, 245, 238], textColor: 0 }, columnStyles: right([1, 2]) });
  y = note(y + 14, 'Sales are the money received in the bank in the month, as on the bank statement (Annexure A). '
    + 'The app\'s own daily milk records are estimates and are not used.'
    + (v.sales.unreviewedCount ? ` ${v.sales.unreviewedCount} receipt(s) of ${rs(v.sales.unreviewedAmount)} were not yet reviewed and are not included.` : ''));
  if (v.sales.receipts.length) {
    y = sub(y + 6, 'Receipts');
    table(y + 6, ['Date', 'From', 'Narration', 'Sale', 'Amount'],
      v.sales.receipts.map(r => [day(r.date), r.party || '', [r.narration, r.note].filter(Boolean).join(' · '), categoryLabel(r.category), rs(r.amount)]),
      {
        columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 110 }, 3: { cellWidth: 72 }, 4: { cellWidth: 66, halign: 'right' } },
        didParseCell: (d: any) => { if (d.section === 'body') d.cell.styles.fillColor = BANK_FILL; },
      });
  }

  // 4. Bank reconciliation
  y = heading(4, SECTIONS[3]);
  y = note(y, `Kotak current account${v.bank.accountLast4 ? ` ending ${v.bank.accountLast4}` : ''}, ${day(p.periodFrom)} to ${day(p.periodTo)}.`);
  const diff = f.computedClosing != null && v.bank.closingBalance != null ? v.bank.closingBalance - f.computedClosing : null;
  y = table(y, ['', 'Amount'], [
    ['Opening balance', rs(v.bank.openingBalance)],
    ['Add: receipts', rs(v.bank.receipts)],
    ['Less: payments', rs(v.bank.payments)],
    ['Closing balance, worked out', rs(f.computedClosing)],
    ['Closing balance, per bank statement', rs(v.bank.closingBalance)],
    ['Difference', diff == null ? '—' : Math.abs(diff) < 1 ? 'Nil' : rs(diff)],
  ], { columnStyles: right([1]) });
  const group = (label: string, pick: (l: PackageBankLine) => boolean) => {
    const ls = v.bank.lines.filter(pick);
    return [label, ls.length, rs(ls.reduce((a, l) => a + l.amount, 0))];
  };
  y = sub(y + 22, 'How the bank lines are accounted for');
  y = table(y + 6, ['', 'Lines', 'Amount'], [
    group('Receipts booked as income', l => l.status === 'MAPPED' && l.direction === 'CREDIT' && l.kind === 'INCOME'),
    group('Receipts settling income already booked (e.g. milk)', l => l.status === 'MAPPED' && l.direction === 'CREDIT' && l.kind === 'SETTLEMENT'),
    group('Payments booked as expenses (in the purchase register)', l => l.status === 'MAPPED' && l.direction === 'DEBIT' && l.kind === 'EXPENSE' && !l.salaryOf),
    group('Salary transfers (the register shows the fixed salary instead)', l => !!l.salaryOf),
    group('Payments to staff: reimbursements and advances', l => l.status === 'MAPPED' && l.direction === 'DEBIT' && l.kind === 'SETTLEMENT'),
    group('Ignored (own transfers, reversals)', l => l.status === 'IGNORED'),
    group('Not yet reviewed', l => l.status === 'UNMAPPED' || l.status === 'SUGGESTED'),
  ], { columnStyles: right([1, 2]) });
  if (f.unreviewed.length) {
    y = sub(y + 22, 'Lines not yet reviewed');
    table(y + 6, ['Date', 'Narration', 'In', 'Out'],
      f.unreviewed.map(l => [day(l.date), l.narration || '', l.direction === 'CREDIT' ? rs(l.amount) : '', l.direction === 'DEBIT' ? rs(l.amount) : '']),
      { columnStyles: { 0: { cellWidth: 62 }, 2: { cellWidth: 66, halign: 'right' }, 3: { cellWidth: 66, halign: 'right' } } });
  }

  // 5. GST - only when it applies
  if (p.includeGst) {
    y = heading(5, SECTIONS[4]);
    note(y, p.gstNote || 'No GST details recorded.');
  }

  // 6. Annexure A: a line here, Kotak's own pages straight after the report (no page of its own)
  y = heading(6, SECTIONS[5]);
  note(y, statements.length
    ? `Kotak Mahindra Bank's own statement for the month follows from page ${doc.getNumberOfPages() + 1} (${statements.reduce((a, s) => a + s.getPageCount(), 0)} pages), as downloaded from net banking.`
    : 'No bank statement PDF is on file for this month.');
  const reportPages = doc.getNumberOfPages();
  const statementPages = statements.reduce((a, s) => a + s.getPageCount(), 0);

  // Page 1: contents, then 1. Executive summary
  doc.setPage(1);
  start[1] = 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(month, M, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Period ${day(p.periodFrom)} to ${day(p.periodTo)} · prepared ${day(new Date().toISOString().slice(0, 10))} by ${preparedBy}`, M, 72);
  doc.setTextColor(0);

  // Contents first, then the executive summary under it
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Contents', M, 100);
  doc.setFont('helvetica', 'normal');
  const invoicePagesStart = reportPages + statementPages + 1;
  y = table(110, ['Section', 'Page'], SECTIONS.map((title, i) => {
    const n = i + 1;
    if (n === 5 && !p.includeGst) return [`${n}. ${title}`, 'Not applicable'];
    if (n === 7) return [`${n}. ${title}`, invoiceDocs.length ? String(invoicePagesStart) : 'None attached'];
    if (n === 6) return [`${n}. ${title}`, statementPages ? String(reportPages + 1) : 'Not on file'];
    return [`${n}. ${title}`, String(start[n] ?? '')];
  }), { columnStyles: right([1]), bodyStyles: { fontSize: 9 } });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('1. Executive Summary', M, y + 26);
  doc.setFont('helvetica', 'normal');
  y = table(y + 36, ['', 'Amount'], [
    ['Sales (received in the bank)', rs(f.totalSales)],
    ['Purchases & expenses', rs(f.totalPurchases)],
    ['   from the bank statement', rs(f.bankPurchases)],
    ['   entered by hand in the app (manual)', rs(f.cashPurchases)],
    ...(f.salaryPurchases ? [['   salaries (fixed monthly)', rs(f.salaryPurchases)]] : []),
    ['Net result for the month', rs(f.totalSales - f.totalPurchases)],
    ['Bank: opening balance', rs(v.bank.openingBalance)],
    ['Bank: closing balance', rs(v.bank.closingBalance)],
    ['Staff reimbursements / advances paid through the bank', rs(f.staffSettlements)],
  ], { columnStyles: right([1]), bodyStyles: { fontSize: 9 } });
  if (f.unreviewed.length) {
    y = note(y + 12, `${f.unreviewed.length} bank line(s) were not yet reviewed and are in neither register; see section 4.`);
  }
  if (p.notes) {
    // Kept short so the first page holds it; the full text is in the package.
    const short = p.notes.length > 500 ? `${p.notes.slice(0, 500)}…` : p.notes;
    doc.setFontSize(11);
    doc.text('Notes', M, y + 16);
    note(y + 30, short);
  }

  // Merge: report, Kotak's statement, invoices
  const merged = await PDFDocument.create();
  const report = await PDFDocument.load(doc.output('arraybuffer'));
  (await merged.copyPages(report, report.getPageIndices())).forEach(pg => merged.addPage(pg));
  for (const s of statements) (await merged.copyPages(s, s.getPageIndices())).forEach(pg => merged.addPage(pg));
  if (invoiceDocs.length) {
    const font = await merged.embedFont(StandardFonts.HelveticaBold);
    const divider = merged.addPage([595.28, 841.89]);
    divider.drawText(`7. ${SECTIONS[6]}`, { x: M, y: 841.89 - 60, size: 15, font });
    invoiceDocs.forEach((d, i) => divider.drawText(`${i + 1}. ${d.name}`, { x: M, y: 841.89 - 92 - i * 14, size: 9, font }));
    for (const d of invoiceDocs) {
      if (d.doc) {
        (await merged.copyPages(d.doc, d.doc.getPageIndices())).forEach(pg => merged.addPage(pg));
      } else if (d.image) {
        const img = d.image.png ? await merged.embedPng(d.image.bytes) : await merged.embedJpg(d.image.bytes);
        const page = merged.addPage([595.28, 841.89]);
        const scale = Math.min((595.28 - 2 * M) / img.width, (841.89 - 2 * M) / img.height, 1);
        page.drawImage(img, { x: (595.28 - img.width * scale) / 2, y: (841.89 - img.height * scale) / 2,
          width: img.width * scale, height: img.height * scale });
      }
    }
  }

  // Page numbers across the whole file, top right, so the auditor can cite any page.
  const small = await merged.embedFont(StandardFonts.Helvetica);
  const total = merged.getPageCount();
  merged.getPages().forEach((pg, i) => {
    const { width, height } = pg.getSize();
    const text = `${month} · page ${i + 1} of ${total}`;
    pg.drawText(text, { x: width - M - small.widthOfTextAtSize(text, 7), y: height - 18, size: 7, font: small, color: rgb(0.45, 0.45, 0.45) });
  });
  return merged.save();
}

/** How a bank line was booked, in the Transactions table's words (Sold, Purchased, Reimbursement...). */
const bookedAs = (l: PackageBankLine) => {
  if (l.salaryOf) return `Salary of ${l.salaryOf}`;
  if (l.status === 'IGNORED') return 'Ignored';
  if (l.status !== 'MAPPED') return 'Not reviewed';
  const t = typeFromBooking(l.direction, l.kind, l.category);
  return t ? TYPE_LABEL[t] : '';
};

/** A CSV cell: quoted when it holds a comma, quote or line break. */
const csvCell = (v: string | number | null | undefined) => {
  const t = v == null ? '' : String(v);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/**
 * The same package as one CSV, section by section in the same order as the PDF, for opening in
 * Excel. Amounts are whole rupees. Kotak's statement is given as its lines; invoices by file name.
 */
export function buildPackageCsv(v: AuditPackageView, preparedBy: string): string {
  const f = figures(v);
  const p = v.package;
  const rows: (string | number | null | undefined)[][] = [];
  const blank = () => rows.push([]);
  const r = (n: number) => Math.round(n);
  const sec = (n: number, title: string) => { if (rows.length) blank(); rows.push([`${n}. ${title}`]); };

  rows.push([monthLabel(p.periodFrom), `Period ${p.periodFrom} to ${p.periodTo}`, `Prepared ${new Date().toISOString().slice(0, 10)} by ${preparedBy}`]);

  sec(1, SECTIONS[0]);
  rows.push(['Item', 'Amount']);
  rows.push(['Sales (received in the bank)', r(f.totalSales)]);
  rows.push(['Purchases & expenses', r(f.totalPurchases)]);
  rows.push(['  from the bank statement', r(f.bankPurchases)]);
  rows.push(['  entered by hand in the app (manual)', r(f.cashPurchases)]);
  if (f.salaryPurchases) rows.push(['  salaries (fixed monthly)', r(f.salaryPurchases)]);
  rows.push(['Net result for the month', r(f.totalSales - f.totalPurchases)]);
  rows.push(['Bank: opening balance', v.bank.openingBalance == null ? '' : r(v.bank.openingBalance)]);
  rows.push(['Bank: closing balance', v.bank.closingBalance == null ? '' : r(v.bank.closingBalance)]);
  rows.push(['Staff reimbursements / advances paid through the bank', r(f.staffSettlements)]);
  if (p.notes) rows.push(['Notes', p.notes]);

  sec(2, SECTIONS[1]);
  rows.push(['Date', 'Description', 'Category', 'Source', 'Checked', 'Amount']);
  f.purchases.forEach(l => rows.push([l.date, l.description, l.category, l.via, l.source === 'MANUAL' ? (l.reviewed ? 'yes' : 'no') : '', r(l.amount)]));
  rows.push(['Total', '', '', '', '', r(f.totalPurchases)]);

  sec(3, SECTIONS[2]);
  rows.push(['Date', 'From', 'Narration', 'Sale', 'Amount']);
  v.sales.receipts.forEach(x => rows.push([x.date, x.party, [x.narration, x.note].filter(Boolean).join(' · '), categoryLabel(x.category), r(x.amount)]));
  rows.push(['Total', '', '', '', r(f.totalSales)]);
  if (v.sales.unreviewedCount) rows.push([`${v.sales.unreviewedCount} receipt(s) not yet reviewed, not included`, '', '', '', r(v.sales.unreviewedAmount)]);

  sec(4, SECTIONS[3]);
  rows.push(['Item', 'Amount']);
  rows.push(['Opening balance', v.bank.openingBalance == null ? '' : r(v.bank.openingBalance)]);
  rows.push(['Add: receipts', r(v.bank.receipts)]);
  rows.push(['Less: payments', r(v.bank.payments)]);
  rows.push(['Closing balance, worked out', f.computedClosing == null ? '' : r(f.computedClosing)]);
  rows.push(['Closing balance, per bank statement', v.bank.closingBalance == null ? '' : r(v.bank.closingBalance)]);
  if (f.unreviewed.length) {
    rows.push(['Lines not yet reviewed']);
    f.unreviewed.forEach(l => rows.push([l.date, l.narration, l.direction === 'CREDIT' ? 'in' : 'out', r(l.amount)]));
  }

  sec(5, SECTIONS[4]);
  rows.push([p.includeGst ? (p.gstNote || 'No GST details recorded.') : 'Not applicable']);

  sec(6, SECTIONS[5]);
  rows.push(['Date', 'Narration', 'Withdrawal', 'Deposit', 'Booked as', 'Category']);
  v.bank.lines.forEach(l => rows.push([l.date, l.narration, l.direction === 'DEBIT' ? r(l.amount) : '', l.direction === 'CREDIT' ? r(l.amount) : '',
    bookedAs(l), categoryLabel(l.category)]));

  sec(7, SECTIONS[6]);
  const inv = v.attachments.filter(a => a.included);
  if (inv.length) inv.forEach(a => rows.push([a.fileName])); else rows.push(['None attached']);

  // Byte-order mark so Excel reads ₹ and other characters correctly.
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
