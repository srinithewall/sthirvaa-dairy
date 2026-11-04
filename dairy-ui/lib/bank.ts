// Kotak bank feed: types, the sales/purchase report built from mapped lines, and its downloads.

export type BankStatus = 'UNMAPPED' | 'SUGGESTED' | 'MAPPED' | 'IGNORED';
export type BankKind = 'EXPENSE' | 'INCOME' | 'SETTLEMENT';

export interface BankTxn {
  id: number;
  bankRef?: string | null;
  txnDate: string;
  narration?: string | null;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  balance?: number | null;
  mode?: string | null;
  counterparty?: string | null;
  status: BankStatus;
  kind?: BankKind | null;
  category?: string | null;
  segment?: string | null;
  note?: string | null;
  ledgerId?: number | null;
  posted?: boolean;
  ruleId?: number | null;
  matchReason?: string | null;
  /** Name of the employee rule this line matches: always left for a person to choose. */
  employee?: string | null;
}

/** Kotak's own PDF statement on file for a period (content fetched separately). */
export interface BankStatementDoc {
  id: number;
  periodFrom: string;
  periodTo: string;
  accountLast4?: string | null;
  fileName?: string | null;
  pages?: number | null;
}

export interface BankRule {
  id: number;
  pattern: string;
  direction: 'CREDIT' | 'DEBIT' | 'ANY';
  kind: BankKind | 'IGNORE' | 'EMPLOYEE';
  category?: string | null;
  segment?: string | null;
  hits: number;
  lastUsed?: string | null;
}

/**
 * What a bank line is, in plain words, and how each maps onto the backend's booking (kind +
 * category). Sold = a sales receipt kept on the bank side only (SETTLEMENT); Reimbursement and
 * Advance = money to staff that is not an expense (SETTLEMENT); the rest are INCOME or EXPENSE.
 */
export type LineType = 'SOLD' | 'OTHER_INCOME' | 'PURCHASED' | 'SALARY' | 'REIMBURSEMENT' | 'ADVANCE' | 'BANK_CHARGES' | 'IGNORE';

export const TYPE_LABEL: Record<LineType, string> = {
  SOLD: 'Sold', OTHER_INCOME: 'Other income', PURCHASED: 'Purchased', SALARY: 'Salary',
  REIMBURSEMENT: 'Reimbursement', ADVANCE: 'Advance', BANK_CHARGES: 'Bank charges', IGNORE: 'Ignore',
};
export const TYPES_IN: LineType[] = ['SOLD', 'OTHER_INCOME', 'IGNORE'];
export const TYPES_OUT: LineType[] = ['PURCHASED', 'SALARY', 'REIMBURSEMENT', 'ADVANCE', 'BANK_CHARGES', 'IGNORE'];
/** Types whose category is fixed. */
export const FIXED_CATEGORY: Partial<Record<LineType, string>> = { REIMBURSEMENT: 'STAFF_REIMBURSEMENT', ADVANCE: 'STAFF_ADVANCE' };

export const isSalary = (c?: string | null) => !!c && /salar|wage|labou/i.test(c);
export const isBankCharge = (c?: string | null) => !!c && /bank|charge/i.test(c);

export const kindForType = (t: LineType) =>
  t === 'IGNORE' ? 'IGNORE'
    : t === 'SOLD' || t === 'REIMBURSEMENT' || t === 'ADVANCE' ? 'SETTLEMENT'
    : t === 'OTHER_INCOME' ? 'INCOME' : 'EXPENSE';

/** The type a booking reads as. */
export function typeFromBooking(direction: string, kind?: string | null, category?: string | null): LineType | '' {
  if (kind === 'IGNORE') return 'IGNORE';
  if (!kind) return '';
  if (direction === 'CREDIT') return kind === 'SETTLEMENT' ? 'SOLD' : 'OTHER_INCOME';
  if (kind === 'SETTLEMENT') return category === 'STAFF_ADVANCE' ? 'ADVANCE' : 'REIMBURSEMENT';
  return isSalary(category) ? 'SALARY' : isBankCharge(category) ? 'BANK_CHARGES' : 'PURCHASED';
}

/** Categories offered for a type, from the ledger's own (names are what the ledger stores). */
export function categoryOptions(type: LineType | '', expenseNames: string[], incomeNames: string[], current?: string | null): string[] {
  let list: string[] = [];
  if (type === 'SOLD') list = ['MILK_SALES', ...incomeNames.filter(n => n !== 'MILK_SALES')];
  else if (type === 'OTHER_INCOME') list = incomeNames;
  else if (type === 'SALARY') list = expenseNames.filter(isSalary).length ? expenseNames.filter(isSalary) : ['Salary'];
  else if (type === 'BANK_CHARGES') list = expenseNames.filter(isBankCharge).length ? expenseNames.filter(isBankCharge) : ['Bank charges'];
  else if (type === 'PURCHASED') list = expenseNames;
  if (current && !list.includes(current) && !Object.values(FIXED_CATEGORY).includes(current)) list = [current, ...list];
  return list;
}

/** How a rule reads on the Rules tab. */
export function ruleLabel(r: BankRule): string {
  if (r.kind === 'EMPLOYEE') return 'Employee: always ask me (salary, purchase, reimbursement or advance)';
  const t = typeFromBooking(r.direction, r.kind, r.category);
  if (!t) return r.kind;
  if (t === 'IGNORE') return 'Ignore';
  if (FIXED_CATEGORY[t]) return TYPE_LABEL[t];
  return `${TYPE_LABEL[t]} · ${categoryLabel(r.category)}`;
}

/** Whole rupees, Indian grouping. Amounts are never shown with paise. */
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
/** For the PDF, whose built-in font has no ₹ glyph. */
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;
/** Text the PDF's built-in font can draw (no ₹, no non-Latin letters). */
const pdfText = (s: string) => s.replace(/₹\s?/g, 'Rs ').replace(/[\u2013\u2014]/g, '-').replace(/[^\x00-\xFF]/g, '?');

/** MILK_SALES -> Milk sales; ledger names like "Cattle Feed" are kept. */
export const categoryLabel = (c?: string | null) => {
  if (!c) return 'Uncategorised';
  if (!c.includes('_') && c !== c.toUpperCase()) return c;
  const s = c.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const partyOf = (t: BankTxn) => t.counterparty || t.narration || '—';

export interface ReportGroup { category: string; count: number; total: number }
export interface BankReport {
  from: string;
  to: string;
  sales: ReportGroup[];
  purchases: ReportGroup[];
  /** Money out that is not an expense: staff paid back for cash already in the ledger, or advances. */
  staffSettlements: ReportGroup[];
  totalStaffSettlements: number;
  totalIn: number;
  totalOut: number;
  /** Mapped lines in the period, newest first: what the totals are made of. */
  lines: BankTxn[];
  pending: { count: number; amount: number };
}

const groupBy = (lines: BankTxn[]): ReportGroup[] => {
  const m = new Map<string, ReportGroup>();
  lines.forEach(t => {
    const key = categoryLabel(t.category);
    const g = m.get(key) || { category: key, count: 0, total: 0 };
    g.count += 1;
    g.total += t.amount;
    m.set(key, g);
  });
  return [...m.values()].sort((a, b) => b.total - a.total);
};

/** Money in is sales, money out is purchases and expenses. Only confirmed (MAPPED) lines count. */
export function buildReport(txns: BankTxn[], from: string, to: string, segment: 'ALL' | 'CATTLE' | 'POULTRY'): BankReport {
  const inSegment = (t: BankTxn) => segment === 'ALL' || (t.segment || 'CATTLE') === segment;
  const lines = txns.filter(t => t.status === 'MAPPED' && inSegment(t));
  const open = txns.filter(t => t.status === 'UNMAPPED' || t.status === 'SUGGESTED');
  const sales = groupBy(lines.filter(t => t.direction === 'CREDIT'));
  const purchases = groupBy(lines.filter(t => t.direction === 'DEBIT' && t.kind !== 'SETTLEMENT'));
  const staffSettlements = groupBy(lines.filter(t => t.direction === 'DEBIT' && t.kind === 'SETTLEMENT'));
  return {
    from, to, sales, purchases, lines,
    totalIn: sales.reduce((a, g) => a + g.total, 0),
    totalOut: purchases.reduce((a, g) => a + g.total, 0),
    staffSettlements,
    totalStaffSettlements: staffSettlements.reduce((a, g) => a + g.total, 0),
    pending: { count: open.length, amount: open.reduce((a, t) => a + t.amount, 0) },
  };
}

const fileStem = (r: BankReport) => `sales-purchase-${r.from}-to-${r.to}`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadExcel(r: BankReport) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sthirvaa Farms';
  const money = '#,##,##0';

  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 34 }, { width: 10 }, { width: 16 }];
  sum.addRow(['Sales & Purchase Report — Kotak current account']).font = { bold: true, size: 14 };
  sum.addRow([`${r.from} to ${r.to}`]);
  sum.addRow([]);
  const section = (title: string, groups: ReportGroup[], total: number) => {
    const head = sum.addRow([title, 'Entries', 'Amount (₹)']);
    head.font = { bold: true };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EE' } };
    groups.forEach(g => sum.addRow([g.category, g.count, Math.round(g.total)]));
    const t = sum.addRow(['Total', groups.reduce((a, g) => a + g.count, 0), Math.round(total)]);
    t.font = { bold: true };
    sum.addRow([]);
  };
  section('Sales (money in)', r.sales, r.totalIn);
  section('Purchases & expenses (money out)', r.purchases, r.totalOut);
  if (r.staffSettlements.length) section('Staff settlements & advances (not expenses)', r.staffSettlements, r.totalStaffSettlements);
  const net = sum.addRow(['Net', '', Math.round(r.totalIn - r.totalOut)]);
  net.font = { bold: true };
  if (r.pending.count > 0) {
    sum.addRow([]);
    sum.addRow([`${r.pending.count} bank lines (₹${Math.round(r.pending.amount).toLocaleString('en-IN')}) still to be reviewed are not included.`]).font = { italic: true };
  }
  sum.getColumn(3).numFmt = money;

  const det = wb.addWorksheet('Transactions');
  det.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Party', key: 'party', width: 28 },
    { header: 'Narration', key: 'narration', width: 48 },
    { header: 'Mode', key: 'mode', width: 9 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'For', key: 'segment', width: 10 },
    { header: 'Money in (₹)', key: 'in', width: 14 },
    { header: 'Money out (₹)', key: 'out', width: 14 },
    { header: 'Note', key: 'note', width: 24 },
    { header: 'Bank ref', key: 'ref', width: 20 },
  ];
  det.getRow(1).font = { bold: true };
  [...r.lines].reverse().forEach(t => det.addRow({
    date: t.txnDate,
    party: partyOf(t),
    narration: t.narration || '',
    mode: t.mode || '',
    type: t.kind === 'SETTLEMENT' ? 'Settlement' : t.direction === 'CREDIT' ? 'Sale' : 'Purchase',
    category: categoryLabel(t.category),
    segment: t.segment === 'POULTRY' ? 'Poultry' : 'Cattle',
    in: t.direction === 'CREDIT' ? Math.round(t.amount) : null,
    out: t.direction === 'DEBIT' ? Math.round(t.amount) : null,
    note: t.note || '',
    ref: t.bankRef || '',
  }));
  det.getColumn('in').numFmt = money;
  det.getColumn('out').numFmt = money;
  det.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  save(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileStem(r)}.xlsx`);
}

/**
 * The report as PDF, with Kotak's own statement(s) for the period appended after it, so one file
 * carries both the books and the bank's record of the same money.
 */
export async function downloadPdf(r: BankReport, statements: BankStatementDoc[] = [],
                                  fetchStatement?: (id: number) => Promise<ArrayBuffer>) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const green: [number, number, number] = [27, 67, 50];
  const red: [number, number, number] = [224, 82, 82];
  const attach = fetchStatement ? statements : [];

  doc.setFontSize(16);
  doc.text('Sales & Purchase Report', 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Sthirvaa Farms · Kotak current account · ${r.from} to ${r.to}`, 40, 68);
  if (attach.length) {
    doc.text(`Attached after this report: Kotak statement ${attach.map(d => `${d.periodFrom} to ${d.periodTo}`).join(', ')}`, 40, 80);
  }
  doc.setTextColor(0);

  const groupTable = (title: string, groups: ReportGroup[], total: number, startY: number, isRed = false) => {
    autoTable(doc, {
      startY,
      head: [[title, 'Entries', 'Amount']],
      body: groups.map(g => [g.category, String(g.count), rs(g.total)]),
      foot: [['Total', String(groups.reduce((a, g) => a + g.count, 0)), rs(total)]],
      headStyles: { fillColor: isRed ? red : green },
      footStyles: isRed ? { fillColor: [252, 232, 232], textColor: red } : { fillColor: [232, 245, 238], textColor: 0 },
      ...(isRed ? { bodyStyles: { textColor: [150, 30, 30] } } : {}),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    });
    return (doc as any).lastAutoTable.finalY as number;
  };
  let y = groupTable('Sales (money in)', r.sales, r.totalIn, attach.length ? 94 : 84);
  y = groupTable('Purchases & expenses (money out)', r.purchases, r.totalOut, y + 18, true);
  if (r.staffSettlements.length) {
    y = groupTable('Staff settlements & advances (not expenses)', r.staffSettlements, r.totalStaffSettlements, y + 18);
  }

  doc.setFontSize(12);
  doc.text(`Net: ${r.totalIn - r.totalOut < 0 ? '-' : ''}${rs(Math.abs(r.totalIn - r.totalOut))}`, 40, y + 24);
  if (r.pending.count > 0) {
    doc.setFontSize(9);
    doc.setTextColor(150, 90, 0);
    doc.text(`${r.pending.count} bank lines (${rs(r.pending.amount)}) still to be reviewed are not included.`, 40, y + 40);
    doc.setTextColor(0);
  }

  doc.setFontSize(11);
  doc.text('Transactions', 40, y + 62);
  autoTable(doc, {
    startY: y + 70,
    head: [['Date', 'Description', 'Category', 'In', 'Out']],
    body: [...r.lines].reverse().map(t => [
      t.txnDate,
      pdfText([t.narration || partyOf(t), t.note].filter(Boolean).join('\n')),
      `${categoryLabel(t.category)}${t.kind === 'SETTLEMENT' ? ' (settlement)' : ''}`,
      t.direction === 'CREDIT' ? rs(t.amount) : '',
      t.direction === 'DEBIT' ? rs(t.amount) : '',
    ]),
    headStyles: { fillColor: green },
    styles: { fontSize: 8, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 90 },
      3: { cellWidth: 62, halign: 'right' },
      4: { cellWidth: 62, halign: 'right' },
    },
    margin: { left: 40, right: 40 },
  });

  const reportBytes = doc.output('arraybuffer');
  if (!attach.length) {
    save(new Blob([reportBytes], { type: 'application/pdf' }), `${fileStem(r)}.pdf`);
    return;
  }

  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();
  const report = await PDFDocument.load(reportBytes);
  (await merged.copyPages(report, report.getPageIndices())).forEach(p => merged.addPage(p));
  for (const d of attach) {
    const statement = await PDFDocument.load(await fetchStatement!(d.id));
    (await merged.copyPages(statement, statement.getPageIndices())).forEach(p => merged.addPage(p));
  }
  const bytes = await merged.save();
  save(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${fileStem(r)}-with-kotak-statement.pdf`);
}
