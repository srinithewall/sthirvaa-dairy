// Feed Store types and helpers. Backend: /api/store (StoreController).

import api from '@/lib/api';

export type StoreItemCategory = 'FEED' | 'MINERAL' | 'SUPPLEMENT' | 'ACCESSORY' | 'MEDICINE' | 'FODDER' | 'OTHER';
export type StoreUnit = 'BAG' | 'KG' | 'LITRE' | 'PIECE' | 'PACKET';
export type StorePaymentMode = 'CASH' | 'UPI' | 'CREDIT' | 'MIXED';

export const CATEGORIES: StoreItemCategory[] = ['FEED', 'MINERAL', 'SUPPLEMENT', 'ACCESSORY', 'MEDICINE', 'FODDER', 'OTHER'];
/** Friendly name for a category ("MEDICINE" → "Vet / Medicine"). */
export const categoryLabel = (c: StoreItemCategory) => ({
  FEED: 'Feed', MINERAL: 'Mineral', SUPPLEMENT: 'Supplement', ACCESSORY: 'Accessories',
  MEDICINE: 'Vet / Medicine', FODDER: 'Fodder', OTHER: 'Other',
})[c];

export const UNITS: StoreUnit[] =['BAG', 'KG', 'LITRE', 'PIECE', 'PACKET'];

export interface StoreItem {
  id: number;
  name: string;
  kannadaName?: string;
  category: StoreItemCategory;
  /** Manufacturer, e.g. Cargill. */
  brand?: string;
  /** Suppliers this item can be bought from. */
  supplierIds?: number[];
  unit: StoreUnit;
  unitSize?: number;
  salePrice: number;
  minSalePrice?: number;
  /** Min price is hidden from (and not editable by) STAFF. */
  hidePrice?: boolean;
  reorderLevel?: number;
  shelfLifeDays?: number;
  active: boolean;
}

export interface StoreSupplier { id: number; name: string; phone?: string; gstin?: string; address?: string; active: boolean; }

export interface StoreFarmer { id: number; name: string; phone: string; village?: string; cowsCount?: number; creditLimit?: number; active: boolean; }

export interface StockRow { item: StoreItem; qtyOnHand: number; stockValue: number; earliestExpiry?: string; lowStock: boolean; }

export interface ExpiringBatch { batchId: number; itemId: number; itemName: string; batchNo?: string; qtyRemaining: number; expiryDate: string; daysLeft: number; }

export interface StoreSaleLine { id: number; item: StoreItem; qty: number; unitPrice: number; unitCost: number; lineTotal: number; }

export interface StoreSale {
  id: number;
  billNo: string;
  saleDate: string;
  farmer?: StoreFarmer;
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  discount: number;
  total: number;
  costTotal: number;
  paymentMode: StorePaymentMode;
  /** Amount paid at billing; total − paidAmount went on the farmer's credit account. */
  paidAmount: number;
  lines: StoreSaleLine[];
  createdBy?: string;
}

export interface StoreLedgerEntry {
  id: number;
  entryDate: string;
  type: 'SALE_CREDIT' | 'PAYMENT' | 'ADJUSTMENT';
  /** > 0 adds to what the farmer owes, < 0 is a payment. */
  amount: number;
  saleId?: number;
  paymentMode?: StorePaymentMode;
  notes?: string;
}

export interface FarmerAccount { farmer: StoreFarmer; balance: number; lastVisit?: string; entries: StoreLedgerEntry[]; }

/** "today", "yesterday", "5 days ago" for an ISO date. */
export function daysAgo(iso?: string): string {
  if (!iso) return 'first visit';
  const days = Math.round((new Date(todayIso()).getTime() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export interface StorePurchase {
  id: number;
  supplier?: StoreSupplier;
  billNo?: string;
  purchaseDate: string;
  total: number;
  paid: number;
  notes?: string;
  lines: { id: number; item: StoreItem; qty: number; unitCost: number; lineTotal: number; batchNo?: string; expiryDate?: string }[];
}

export interface StoreDashboard {
  date: string;
  billCount: number;
  salesTotal: number;
  grossMargin: number;
  byPaymentMode: Partial<Record<StorePaymentMode, number>>;
  monthSales: number;
  monthMargin: number;
  stockValue: number;
  lowStock: StockRow[];
  expiring: ExpiringBatch[];
}

export const STORE_NAME = 'Sthirvaa Feed Store';

export const rupees = (n?: number | null) =>
  '₹' + Math.round(Number(n ?? 0)).toLocaleString('en-IN'); // amounts are always shown rounded off

export const qty = (n?: number | null) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Pack size in words, matching the unit: "50 kg bag", "1 L", "pack of 10", "per kg". */
export function packLabel(i: Pick<StoreItem, 'unit' | 'unitSize'>): string {
  const s = i.unitSize ? Number(i.unitSize) : 0;
  switch (i.unit) {
    case 'BAG': return s ? `${s} kg bag` : 'bag';
    case 'PACKET': return s ? `${s} kg packet` : 'packet';
    case 'LITRE': return s ? `${s} L` : 'per litre';
    case 'PIECE': return s > 1 ? `pack of ${s}` : 'piece';
    case 'KG': return 'per kg';
  }
}

export const itemLabel =(i: StoreItem) => (i.kannadaName ? `${i.name} / ${i.kannadaName}` : i.name);

// ---- In-memory cache for item/supplier lists, so switching shop tabs doesn't refetch them. ----
// Lives until a page reload, 5 minutes pass, or a save calls clearStoreCache(). Keyed per login
// because staff get item lists with hidden prices removed.
const CACHE_MS = 5 * 60 * 1000;
const storeCache = new Map<string, { at: number; data: Promise<unknown> }>();

export function cachedGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const token = typeof window === 'undefined' ? '' : localStorage.getItem('token') || '';
  const key = `${token}|${url}|${JSON.stringify(params ?? {})}`;
  const hit = storeCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as Promise<T>;
  const data = api.get(url, { params }).then((r) => r.data as T);
  data.catch(() => storeCache.delete(key)); // don't keep failed requests
  storeCache.set(key, { at: Date.now(), data });
  return data;
}

export const clearStoreCache = () => storeCache.clear();

/** True when an item's brand looks like the supplier's name, e.g. "Sunil Agro" ↔ "Sunil Agro Industries". */
export function brandMatches(brand: string | undefined, supplierName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const b = norm(brand ?? '');
  const s = norm(supplierName);
  return !!b && (s.startsWith(b) || b.startsWith(s));
}

/** Pulls the backend's error message out of an axios error. */
export const apiError = (err: any, fallback: string) => err?.response?.data?.message || fallback;

export const paymentLabel = (m: StorePaymentMode) =>
  ({ CASH: 'Cash', UPI: 'UPI', CREDIT: 'Pay later', MIXED: 'Part paid' })[m];

/** balance: farmer's total outstanding after this bill, when known. */
export function billText(sale: StoreSale, balance?: number): string {
  const lines = sale.lines.map(
    (l) => `${l.item.name} × ${qty(l.qty)} @ ${rupees(l.unitPrice)} = ${rupees(l.lineTotal)}`
  );
  const due = sale.total - (sale.paidAmount ?? sale.total);
  return [
    `*${STORE_NAME}*`,
    `Bill: ${sale.billNo}   Date: ${sale.saleDate}`,
    sale.customerName ? `Customer: ${sale.customerName}` : null,
    '',
    ...lines,
    '',
    sale.discount > 0 ? `Subtotal: ${rupees(sale.subtotal)}\nDiscount: -${rupees(sale.discount)}` : null,
    `*Total: ${rupees(sale.total)}*  (${paymentLabel(sale.paymentMode)})`,
    due > 0 ? `Paid: ${rupees(sale.paidAmount)}   Due: ${rupees(due)}` : null,
    balance != null && balance > 0 ? `Total outstanding: ${rupees(balance)}` : null,
    '',
    'Thank you! / ಧನ್ಯವಾದಗಳು',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** WhatsApp link for the bill. Opens a chat with the customer if their number is known. */
export function whatsappBillUrl(sale: StoreSale, balance?: number): string {
  const text = encodeURIComponent(billText(sale, balance));
  return sale.customerPhone ? `https://wa.me/91${sale.customerPhone}?text=${text}` : `https://wa.me/?text=${text}`;
}

// ---- Shop details printed on bills, stored in the app's /settings table. ----
export interface ShopDetails { address: string; phone: string; gstin: string; }
const SHOP_KEYS: Record<keyof ShopDetails, string> = { address: 'store_address', phone: 'store_phone', gstin: 'store_gstin' };
let shopDetails: ShopDetails = { address: '', phone: '', gstin: '' };

/** Loads shop details once per page; printBill() uses the loaded copy (it must run synchronously on click). */
export async function loadShopDetails(): Promise<ShopDetails> {
  const entries = await Promise.all((Object.keys(SHOP_KEYS) as (keyof ShopDetails)[]).map((k) =>
    api.get(`/settings/${SHOP_KEYS[k]}`).then((r) => [k, r.data?.settingValue ?? ''] as const).catch(() => [k, ''] as const)));
  shopDetails = Object.fromEntries(entries) as unknown as ShopDetails;
  return shopDetails;
}

export async function saveShopDetails(d: ShopDetails) {
  await Promise.all((Object.keys(SHOP_KEYS) as (keyof ShopDetails)[]).map((k) =>
    api.post('/settings', { settingKey: SHOP_KEYS[k], settingValue: d[k].trim(), description: `Feed store ${k} printed on bills` })));
  shopDetails = { address: d.address.trim(), phone: d.phone.trim(), gstin: d.gstin.trim().toUpperCase() };
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Opens a print-ready bill in a new window. size 'thermal' fits 80 mm roll printers,
 * 'a5' a half-sheet. balance: farmer's outstanding after this bill, if known.
 */
export function printBill(sale: StoreSale, size: 'thermal' | 'a5' = 'thermal', balance?: number) {
  const due = sale.total - (sale.paidAmount ?? sale.total);
  const page = size === 'thermal' ? '@page { size: 80mm auto; margin: 3mm; } body { width: 74mm; font-size: 12px; }'
    : '@page { size: A5; margin: 10mm; } body { font-size: 13px; }';
  const row = (label: string, value: string, bold = false) =>
    `<tr${bold ? ' class="b"' : ''}><td>${esc(label)}</td><td class="r">${esc(value)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.billNo)}</title><style>
    ${page}
    body { font-family: Arial, sans-serif; margin: 0 auto; color: #000; }
    h1 { font-size: 1.4em; text-align: center; margin: 0; } .c { text-align: center; } .r { text-align: right; }
    .b td { font-weight: bold; } table { width: 100%; border-collapse: collapse; }
    .items th, .items td { padding: 3px 0; } .items th { border-bottom: 1px dashed #000; text-align: left; font-size: .9em; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; } .muted { color: #444; font-size: .9em; } p { margin: 2px 0; }
    .total td { font-size: 1.25em; font-weight: bold; padding-top: 4px; }
  </style></head><body>
    <h1>${esc(STORE_NAME)}</h1>
    <p class="c muted">Cattle feed &amp; supplements</p>
    ${shopDetails.address ? `<p class="c muted">${esc(shopDetails.address)}</p>` : ''}
    ${shopDetails.phone || shopDetails.gstin ? `<p class="c muted">${[
      shopDetails.phone && `Ph: ${esc(shopDetails.phone)}`, shopDetails.gstin && `GSTIN: ${esc(shopDetails.gstin.toUpperCase())}`,
    ].filter(Boolean).join(' &nbsp;·&nbsp; ')}</p>` : ''}
    <hr>
    <table>${row('Bill', sale.billNo)}${row('Date', sale.saleDate)}
      ${row('Customer', sale.customerName || 'Walk-in')}${sale.customerPhone ? row('Phone', sale.customerPhone) : ''}</table>
    <hr>
    <table class="items"><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
      ${sale.lines.map((l) => `<tr><td>${esc(l.item.name)}</td><td class="r">${esc(qty(l.qty))}</td>
        <td class="r">${esc(rupees(l.unitPrice))}</td><td class="r">${esc(rupees(l.lineTotal))}</td></tr>`).join('')}
    </table>
    <hr>
    <table>
      ${sale.discount > 0 ? row('Subtotal', rupees(sale.subtotal)) + row('Discount', '-' + rupees(sale.discount)) : ''}
      <tr class="total"><td>Total</td><td class="r">${esc(rupees(sale.total))}</td></tr>
      ${row('Payment', paymentLabel(sale.paymentMode))}
      ${due > 0 ? row('Paid now', rupees(sale.paidAmount)) + row('Due on this bill', rupees(due), true) : ''}
      ${balance != null && balance > 0 ? row('Total outstanding', rupees(balance), true) : ''}
    </table>
    <hr>
    <p class="c">Thank you! / ಧನ್ಯವಾದಗಳು</p>
    <script>window.onload = () => { window.print(); };</script>
  </body></html>`;
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return false; // popup blocked
  w.document.write(html);
  w.document.close();
  return true;
}

export const canManageStore = (role?: string) => role === 'ADMIN' || role === 'PARTNER';

export function currentRole(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').role;
  } catch {
    return undefined;
  }
}
