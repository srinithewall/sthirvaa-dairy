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
  /** Diamonds needed to take one unit free; unset = not a reward item. */
  rewardCoins?: number;
  active: boolean;
}

export interface StoreSupplier { id: number; name: string; phone?: string; gstin?: string; address?: string; active: boolean; }

/** phone is optional: some customers don't give one. */
export interface StoreFarmer { id: number; name: string; phone?: string; village?: string; cowsCount?: number; creditLimit?: number; active: boolean; }

/** Village pre-filled for new contacts; staff can clear it and type another. */
export const DEFAULT_VILLAGE = 'Halasahalli';

export const PHONE_MESSAGE = 'Please enter a valid 10-digit mobile number, or leave it blank';

/** PHONE_MESSAGE when a typed phone isn't a 10-digit mobile number (an optional +91/0 prefix is fine); blank is allowed. */
export function phoneError(phone?: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return local.length === 10 ? null : PHONE_MESSAGE;
}

export interface StockRow { item: StoreItem; qtyOnHand: number; stockValue: number; earliestExpiry?: string; lowStock: boolean; }

export interface ExpiringBatch { batchId: number; itemId: number; itemName: string; batchNo?: string; qtyRemaining: number; expiryDate: string; daysLeft: number; }

/** redeemed: taken with diamonds; its lineTotal is part of the bill's rewardValue, not paid in money. */
export interface StoreSaleLine { id: number; item: StoreItem; qty: number; unitPrice: number; unitCost: number; lineTotal: number; redeemed?: boolean; }

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
  /** Diamonds earned on the money paid at billing. */
  coinsEarned?: number;
  /** Diamonds spent on redeemed lines, and their rupee value taken off the bill. */
  coinsRedeemed?: number;
  rewardValue?: number;
  lines: StoreSaleLine[];
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** One change to a bill. snapshot: the bill as it was before an edit or delete (JSON of StoreSale). */
export interface StoreSaleAudit {
  id: number;
  saleId: number;
  billNo: string;
  action: 'CREATED' | 'EDITED' | 'DELETED';
  totalBefore?: number;
  totalAfter?: number;
  changes?: string;
  snapshot?: string;
  createdAt: string;
  createdBy?: string;
}

export interface StoreRewardEntry { id: number; entryDate: string; type: 'EARN' | 'REDEEM' | 'ADJUST'; coins: number; saleId?: number; notes?: string; }

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

/** rewardCoins: Sthirvaa Diamonds the contact can spend. */
export interface FarmerAccount {
  farmer: StoreFarmer; balance: number; lastVisit?: string; entries: StoreLedgerEntry[];
  rewardCoins: number; rewardEntries: StoreRewardEntry[];
}

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

// ---- Sthirvaa Diamonds (reward points) ----
export const REWARD_NAME = 'Sthirvaa Diamonds';
/** Diamonds earned per ₹1,000 paid; the owner can change it (settings key store_reward_coins_per_1000). */
let rewardRate = 10;
export const rewardCoinsPer1000 = () => rewardRate;

/** How diamonds work, for the customer: printed on bills and sent on WhatsApp. */
export const rewardsHowTo = () =>
  `Earn ${rewardRate} diamonds for every ₹1,000 you pay, at the counter or when you clear your dues. `
  + 'Use them to take selected items free on your next visit: just tell our staff at billing. '
  + 'Diamonds have no cash value.';

/** Rewards lines for a contact's bill. coins: their diamond balance after this bill, when known. */
function rewardLines(sale: StoreSale, coins?: number): string[] {
  if (!sale.farmer) return [];
  const earned = sale.coinsEarned ?? 0;
  const used = sale.coinsRedeemed ?? 0;
  return [
    [earned > 0 && `Earned on this bill: ${earned}`, used > 0 && `Used: ${used}`].filter(Boolean).join(' · '),
    coins != null ? `Your balance: ${coins} diamonds` : '',
  ].filter(Boolean);
}

/** balance: farmer's total outstanding after this bill, when known. coins: their diamond balance after it. */
export function billText(sale: StoreSale, balance?: number, coins?: number): string {
  const lines = sale.lines.map(
    (l) => `${l.item.name} × ${qty(l.qty)} @ ${rupees(l.unitPrice)} = ${rupees(l.lineTotal)}${l.redeemed ? ' (💎 diamonds)' : ''}`
  );
  const due = sale.total - (sale.paidAmount ?? sale.total);
  const rewards = rewardLines(sale, coins);
  return [
    `*${STORE_NAME}*`,
    `Bill: ${sale.billNo}   Date: ${sale.saleDate}`,
    sale.customerName ? `Customer: ${sale.customerName}` : null,
    '',
    ...lines,
    '',
    sale.discount > 0 || sale.rewardValue ? `Subtotal: ${rupees(sale.subtotal)}` : null,
    sale.discount > 0 ? `Discount: -${rupees(sale.discount)}` : null,
    sale.rewardValue ? `Paid with diamonds: -${rupees(sale.rewardValue)}` : null,
    `*Total: ${rupees(sale.total)}*  (${paymentLabel(sale.paymentMode)})`,
    due > 0 ? `Paid: ${rupees(sale.paidAmount)}   Due: ${rupees(due)}` : null,
    balance != null && balance > 0 ? `Total outstanding: ${rupees(balance)}` : null,
    ...(sale.farmer ? ['', `💎 *${REWARD_NAME}*`, ...rewards, `_${rewardsHowTo()}_`] : []),
    '',
    'Thank you! / ಧನ್ಯವಾದಗಳು',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** WhatsApp link for the bill. Opens a chat with the customer if their number is known. */
export function whatsappBillUrl(sale: StoreSale, balance?: number, coins?: number): string {
  const text = encodeURIComponent(billText(sale, balance, coins));
  return sale.customerPhone ? `https://wa.me/91${sale.customerPhone}?text=${text}` : `https://wa.me/?text=${text}`;
}

// ---- Shop details printed on bills, stored in the app's /settings table. ----
/** rewardRate: diamonds per ₹1,000 paid (same settings key the backend reads). */
export interface ShopDetails { address: string; phone: string; gstin: string; rewardRate: string; }
const SHOP_KEYS: Record<keyof ShopDetails, string> = {
  address: 'store_address', phone: 'store_phone', gstin: 'store_gstin', rewardRate: 'store_reward_coins_per_1000',
};
let shopDetails: ShopDetails = { address: '', phone: '', gstin: '', rewardRate: '' };

/** Loads shop details once per page; printBill() uses the loaded copy (it must run synchronously on click). */
export async function loadShopDetails(): Promise<ShopDetails> {
  const entries = await Promise.all((Object.keys(SHOP_KEYS) as (keyof ShopDetails)[]).map((k) =>
    api.get(`/settings/${SHOP_KEYS[k]}`).then((r) => [k, r.data?.settingValue ?? ''] as const).catch(() => [k, ''] as const)));
  shopDetails = Object.fromEntries(entries) as unknown as ShopDetails;
  // The backend applies the default when the setting is blank or invalid.
  await api.get('/store/rewards/config').then((r) => { rewardRate = r.data?.coinsPer1000 ?? rewardRate; }).catch(() => {});
  shopDetails.rewardRate = String(rewardRate);
  return shopDetails;
}

export async function saveShopDetails(d: ShopDetails) {
  const rate = d.rewardRate.trim() === '' ? 10 : Number(d.rewardRate);
  if (!Number.isInteger(rate) || rate < 0) throw new Error('Diamonds per ₹1,000 must be a whole number, 0 or more');
  const clean: ShopDetails = { address: d.address.trim(), phone: d.phone.trim(), gstin: d.gstin.trim().toUpperCase(), rewardRate: String(rate) };
  await Promise.all((Object.keys(SHOP_KEYS) as (keyof ShopDetails)[]).map((k) =>
    api.post('/settings', { settingKey: SHOP_KEYS[k], settingValue: clean[k], description: `Feed store ${k} (bills)` })));
  shopDetails = clean;
  rewardRate = rate;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const PRINT_ID = 'store-bill-print';

/**
 * Shows the bill full-screen on the page, with Back and Print buttons, and opens the print dialog.
 * size 'thermal' fits 80 mm roll printers, 'a5' a half-sheet. balance: farmer's outstanding after
 * this bill, coins: their diamond balance after it, if known.
 *
 * It used to open a new window, but in the Android app (and some phone browsers) that window
 * replaced the app with no way back. The page's back button / Android back also close it.
 */
export function printBill(sale: StoreSale, size: 'thermal' | 'a5' = 'thermal', balance?: number, coins?: number) {
  if (typeof document === 'undefined') return false;
  document.getElementById(PRINT_ID)?.remove();
  const due = sale.total - (sale.paidAmount ?? sale.total);
  const thermal = size === 'thermal';
  const row = (label: string, value: string, bold = false) =>
    `<tr${bold ? ' class="b"' : ''}><td>${esc(label)}</td><td class="r">${esc(value)}</td></tr>`;
  const rewards = rewardLines(sale, coins);
  const host = document.createElement('div');
  host.id = PRINT_ID;
  host.innerHTML = `<style>
    #${PRINT_ID} { position: fixed; inset: 0; z-index: 5000; background: #E9EEEB; overflow: auto; -webkit-overflow-scrolling: touch; }
    #${PRINT_ID} .bar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: space-between; align-items: center;
      padding: 10px 12px; padding-top: max(10px, env(safe-area-inset-top)); background: #fff; border-bottom: 1px solid #DDE3DF; font-family: Arial, sans-serif; }
    #${PRINT_ID} .bar button { font: bold 15px Arial, sans-serif; border-radius: 8px; padding: 10px 16px; cursor: pointer; }
    #${PRINT_ID} .back { background: #fff; color: #1F2A24; border: 1px solid #C9D2CC; }
    #${PRINT_ID} .print { background: #1B7A4A; color: #fff; border: 1px solid #1B7A4A; }
    #${PRINT_ID} .paper { box-sizing: border-box; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.35;
      width: 100%; max-width: ${thermal ? '380px' : '560px'}; margin: 16px auto 32px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
    #${PRINT_ID} h1 { font-size: 1.4em; text-align: center; margin: 0; } #${PRINT_ID} .c { text-align: center; } #${PRINT_ID} .r { text-align: right; }
    #${PRINT_ID} .b td { font-weight: bold; } #${PRINT_ID} table { width: 100%; border-collapse: collapse; }
    #${PRINT_ID} .items th, #${PRINT_ID} .items td { padding: 3px 0; vertical-align: top; }
    #${PRINT_ID} .items th { border-bottom: 1px dashed #000; text-align: left; font-size: .9em; }
    #${PRINT_ID} .items td.r, #${PRINT_ID} .items th.r { padding-left: 6px; white-space: nowrap; }
    #${PRINT_ID} hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; } #${PRINT_ID} .muted { color: #444; font-size: .9em; } #${PRINT_ID} p { margin: 2px 0; }
    #${PRINT_ID} .total td { font-size: 1.25em; font-weight: bold; padding-top: 4px; }
    @media print {
      @page { ${thermal ? 'size: 80mm auto; margin: 3mm;' : 'size: A5; margin: 10mm;'} }
      body > *:not(#${PRINT_ID}) { display: none !important; }
      #${PRINT_ID} { position: static; background: none; overflow: visible; }
      #${PRINT_ID} .bar { display: none; }
      #${PRINT_ID} .paper { box-shadow: none; margin: 0; padding: 0; max-width: none; width: ${thermal ? '74mm' : 'auto'}; font-size: ${thermal ? '12px' : '13px'}; }
    }
  </style>
  <div class="bar"><button type="button" class="back">← Back</button><button type="button" class="print">Print</button></div>
  <div class="paper">
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
      ${sale.lines.map((l) => `<tr><td>${esc(l.item.name)}${l.redeemed ? ' <span class="muted">(💎 diamonds)</span>' : ''}</td>
        <td class="r">${esc(qty(l.qty))}</td><td class="r">${esc(rupees(l.unitPrice))}</td><td class="r">${esc(rupees(l.lineTotal))}</td></tr>`).join('')}
    </table>
    <hr>
    <table>
      ${sale.discount > 0 || sale.rewardValue ? row('Subtotal', rupees(sale.subtotal)) : ''}
      ${sale.discount > 0 ? row('Discount', '-' + rupees(sale.discount)) : ''}
      ${sale.rewardValue ? row('Paid with diamonds', '-' + rupees(sale.rewardValue)) : ''}
      <tr class="total"><td>Total</td><td class="r">${esc(rupees(sale.total))}</td></tr>
      ${row('Payment', paymentLabel(sale.paymentMode))}
      ${due > 0 ? row('Paid now', rupees(sale.paidAmount)) + row('Due on this bill', rupees(due), true) : ''}
      ${balance != null && balance > 0 ? row('Total outstanding', rupees(balance), true) : ''}
    </table>
    ${sale.farmer ? `<hr><p class="c"><b>💎 ${esc(REWARD_NAME)}</b></p>
      ${rewards.map((r) => `<p class="c">${esc(r)}</p>`).join('')}
      <p class="c muted">${esc(rewardsHowTo())}</p>` : ''}
    <hr>
    <p class="c">Thank you! / ಧನ್ಯವಾದಗಳು</p>
  </div>`;
  document.body.appendChild(host);

  // A history entry so the phone's back button closes the bill instead of leaving the page.
  const close = () => {
    window.removeEventListener('popstate', close);
    window.removeEventListener('afterprint', afterPrint);
    host.remove();
  };
  // On a computer, close once the print dialog is done; on phones leave the bill up to look at.
  const afterPrint = () => {
    if (window.matchMedia('(pointer: fine)').matches) history.back();
  };
  history.pushState({ ...(history.state ?? {}), storeBill: true }, '');
  window.addEventListener('popstate', close);
  window.addEventListener('afterprint', afterPrint);
  host.querySelector<HTMLButtonElement>('.back')!.onclick = () => history.back();
  host.querySelector<HTMLButtonElement>('.print')!.onclick = () => window.print();
  setTimeout(() => window.print(), 300);
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
