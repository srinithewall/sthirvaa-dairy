# Feed Store Module — Implementation Plan

Village cattle-feed & dairy-accessories store run inside **sthirvaa-dairy**.
Operator: in-law (STAFF login). Investor/owner: ADMIN. Profit split 50:50 for the first 3 months, then revised (owner:operator) with loss carry-forward.

> Naming: the UI already has `/shop` (customer milk/product e-commerce). This module is **Feed Store** — route `/store`, tables `store_*`, Java package classes prefixed `Store*`.

---

## 1. Why separate `store_*` tables (not reuse existing ones)

| Existing | Why not reuse |
|---|---|
| `inventory` | Keyed by unique `item_name`, no cost price, no location — it is the farm's stock. |
| `purchases` | No link to an item master, no batch/expiry, updates farm inventory. |
| `sales` | Requires milk `Customer`; no cost price → cannot compute margin. |
| `customers` | Milk subscription customers (`default_rate` 45.0). Feed farmers are different people. |

Integration points with the farm (kept, not duplicated):
- **Transfer to farm** → adds qty to farm `inventory` via `InventoryService.updateStock(...)` and records a farm `Expense` (category `FEED_FROM_STORE`) at cost.
- **Farm-staff time** → optional fixed monthly allocation (e.g. ₹2,500) treated as a store expense.

---

## 2. Data model (MySQL, `ddl-auto=update` + explicit migration SQL)

Use `BigDecimal` for all money (existing code uses `Double` — do not copy that for the store).

```
store_items            id, name, kannada_name, category(FEED|MINERAL|SUPPLEMENT|ACCESSORY|MEDICINE|FODDER),
                       brand, unit(BAG|KG|LITRE|PIECE), unit_size (e.g. 50 kg),
                       sale_price, min_sale_price, reorder_level, shelf_life_days,
                       feed_master_id (nullable → links to farm FeedMaster), active, audit cols
store_suppliers        id, name, phone, gstin, address, audit cols
store_purchases        id, supplier_id, bill_no, purchase_date, total, paid, notes, audit cols
store_purchase_lines   id, purchase_id, item_id, qty, unit_cost, batch_no, expiry_date
store_stock_batches    id, item_id, purchase_line_id, qty_received, qty_remaining, unit_cost,
                       expiry_date, received_date          ← FIFO cost source
store_farmers          id, name, phone (unique), village, cows_count, credit_limit, active, audit cols
store_sales            id, bill_no, sale_date, farmer_id (nullable = walk-in), type(CUSTOMER|FARM_TRANSFER),
                       subtotal, discount, total, cost_total, payment_mode(CASH|UPI|CREDIT|MIXED),
                       paid_amount, notes, audit cols
store_sale_lines       id, sale_id, item_id, qty, unit_price, unit_cost (FIFO-weighted), line_total
store_stock_moves      id, item_id, batch_id, move_type(PURCHASE|SALE|FARM_TRANSFER|ADJUSTMENT|EXPIRED|RETURN),
                       qty (+/-), unit_cost, ref_type, ref_id, reason, moved_at, moved_by   ← audit trail
store_ledger           id, farmer_id, entry_date, type(SALE_CREDIT|PAYMENT|ADJUSTMENT), amount (+ owed / - paid),
                       sale_id, payment_mode, notes, audit cols                             ← farmer credit
store_expenses         id, date, category(RENT|ELECTRICITY|TRANSPORT|LABOUR_ALLOC|WASTAGE|OTHER),
                       amount, notes, audit cols
store_capital          id, date, type(INVEST|WITHDRAW), amount, notes                         ← owner money in/out
store_settlements      id, month (YYYY-MM, unique), revenue, cogs, expenses, net_profit,
                       loss_carried_in, loss_recovered, distributable, owner_share, operator_share,
                       loss_carried_out, status(DRAFT|CLOSED), closed_at, closed_by
store_profit_split     id, effective_from (YYYY-MM), owner_pct, operator_pct   ← seed 50/50 for first 3 months
store_settings         key/value: labour_alloc=0, bill_prefix, gstin (optional)
```

Stock on hand = `SUM(store_stock_batches.qty_remaining)` per item (no separate counter to drift).

---

## 3. Core business rules (service layer)

1. **Purchase** → creates batches + `PURCHASE` moves. Supplier dues = total − paid.
2. **Sale** → consume batches FIFO (earliest expiry first); store weighted `unit_cost` on each line; block sale below `min_sale_price` unless ADMIN.
3. **Credit sale** → `store_ledger` +amount; reject if farmer balance + amount > `credit_limit` (ADMIN override).
4. **Payment received** → `store_ledger` −amount.
5. **Farm transfer** → sale with `type=FARM_TRANSFER`, `unit_price = unit_cost` (zero margin), excluded from revenue/profit, pushes qty into farm `inventory` + farm `Expense`.
6. **Expiry / damage** → `ADJUSTMENT`/`EXPIRED` move; cost counted as wastage expense.
7. **Monthly settlement** (ADMIN closes month; closed months are locked):
   ```
   net_profit      = customer revenue − COGS − store_expenses
   if net_profit < 0:  loss_carried_out = loss_carried_in + |net_profit|; shares = 0
   else:
     loss_recovered = min(net_profit, loss_carried_in)        → 100% to owner
     distributable  = net_profit − loss_recovered
     owner_share    = loss_recovered + distributable × owner_pct
     operator_share = distributable × operator_pct   (pcts from store_profit_split for that month)
     loss_carried_out = loss_carried_in − loss_recovered
   ```
   Profit is **accrual** (credit sales count when sold). Report also shows cash collected and outstanding credit so profit isn't paid out on uncollected money — optional setting `share_on_collected_only`.

---

## 4. Backend (Spring Boot, `com.dairy`)

Follow existing layout: `model/`, `repo/`, `service/`, `controller/`, `dto/`.

| Controller | Endpoints |
|---|---|
| `StoreItemController` | `GET/POST/PUT /api/store/items`, `GET /api/store/items/low-stock`, `GET /api/store/items/expiring?days=30` |
| `StoreSupplierController` | CRUD `/api/store/suppliers` |
| `StorePurchaseController` | `GET/POST /api/store/purchases`, `GET /{id}` |
| `StoreSaleController` | `POST /api/store/sales` (bill), `GET /api/store/sales?from&to`, `GET /{id}`, `POST /api/store/farm-transfer` |
| `StoreFarmerController` | CRUD `/api/store/farmers`, `GET /{id}/ledger`, `POST /{id}/payments`, `GET /api/store/farmers/dues` |
| `StoreStockController` | `GET /api/store/stock`, `POST /api/store/stock/adjust`, `GET /api/store/stock/moves?itemId` |
| `StoreExpenseController` | CRUD `/api/store/expenses`, `/api/store/capital` |
| `StoreReportController` | `GET /api/store/dashboard` (today sales, cash, credit given, low stock), `GET /api/store/reports/monthly?month`, `POST /api/store/settlements/{month}/close` |

Permissions: add `role_permissions` rows for module `STORE` —
- STAFF (operator): view/create sales, purchases, payments, stock; no delete; cannot close month or change settings/prices below min.
- ADMIN: everything.
- Edits to a sale after the day ends → ADMIN only (prevents silent changes).

All sale/purchase/settlement writes are `@Transactional`.

---

## 5. Frontend (Next.js `dairy-ui`, mobile-first, Capacitor APK)

> Read `node_modules/next/dist/docs/` first (per `AGENTS.md`). Kannada labels for the operator.

```
app/store/page.tsx              Dashboard: today's sales, cash/UPI/credit, low stock, expiring, top dues
app/store/billing/page.tsx      Quick bill: pick farmer (or walk-in) → tap items → qty → payment mode → save/print/WhatsApp
app/store/items/page.tsx        Item master + prices
app/store/purchases/page.tsx    Stock-in from supplier bill
app/store/stock/page.tsx        Stock on hand, batches, adjust/expire
app/store/farmers/page.tsx      Farmer list, dues; [id]/ledger + "Receive payment"
app/store/farm-transfer/page.tsx Move stock to own farm (at cost)
app/store/expenses/page.tsx     Rent, electricity, transport…
app/store/reports/page.tsx      Monthly P&L, settlement split, close month (ADMIN)
```
Add a "Feed Store" entry in `components/Sidebar.tsx` and `BottomNav.tsx`, gated by `STORE` permission. API calls via `lib/api.ts`.

Billing screen must take ≤ 15 seconds per bill — large tap targets, recent items first, phone-number search for farmers.

---

## 6. Phases

| Phase | Scope | Done when |
|---|---|---|
| **P1 – Stock & billing** (≈1–1.5 wk) | items, suppliers, purchases, batches/FIFO, cash/UPI sales, stock view, low-stock | Operator can stock-in a supplier bill and bill a sale; stock matches. |
| **P2 – Credit & farm** (≈1 wk) | farmers, credit ledger, payments, credit limits, farm transfer → farm inventory/expense, expiry/adjustments | Dues per farmer correct; farm transfer shows in farm inventory at cost. |
| **P3 – Money & partnership** (≈1.5 wk) | store expenses & capital, entity P&L (Dairy / Store / Combined), partnership settlement — see §9 | Month closes with correct split (50:50) incl. a loss month followed by a profit month. |
| **P4 – Polish** | Kannada UI, bill share on WhatsApp/print, CSV export, dashboard charts, permission hardening | Operator uses it daily without help. |
| **P5 – Later** | Namma Grama listing (prices/offers, order requests via SSO), SMS/WhatsApp due reminders, GST invoices if needed | — |

---

## 7. Testing

- Unit: FIFO costing across batches; settlement math (profit, loss, loss-then-profit, partial recovery); credit-limit rule.
- Integration: purchase → sale → farm transfer → month close end-to-end on MySQL (Testcontainers or dev DB).
- Manual: one week of real bills entered in parallel with a paper book before going live.

---

## 8. Decisions (confirmed 2026-10-12)

1. **Profit recognised when the sale is made** (accrual). Credit sales count in that month's profit; report still shows cash collected and outstanding dues for visibility. Drop the `share_on_collected_only` setting.
2. **Split is 50:50 for the first 3 months**, then to be revised. Store the split as dated rows, not a single setting:
   `store_profit_split(id, effective_from (YYYY-MM), owner_pct, operator_pct)` — seed `{first month, 50, 50}`. Settlement uses the row in effect for that month; ADMIN adds a new row when the split changes, so closed months keep their original split. No separate labour allocation for now (`labour_alloc = 0`).
3. **Investment stays in the business as working capital.** Capital is not repaid before sharing. Each month the cost of goods sold is put back into stock; `store_capital` tracks total money invested and any withdrawals. Monthly report shows: capital invested, stock value at cost, farmer dues, cash in hand — these should add up (working-capital check).
4. **GST:** use the existing GSTIN of Sthirvaa Group Pvt Ltd. Keep `gstin`, `hsn_code` and `gst_rate` as optional fields on `store_settings`/`store_items` (nullable, not shown on bills yet); revisit invoice format later.
5. **Bills sent on WhatsApp.** After saving a bill, generate a bill image/PDF and open WhatsApp share (`https://wa.me/<farmer phone>?text=…` + Capacitor Share plugin for the file). No thermal printer in P1–P4.

---

## 9. Business entities & Partnership Settlement (confirmed 2026-10-12)

The partnership covers **two businesses**, each with its own P&L, settled together once a month.

- Owner: 100% capital (dairy + store). Partner (in-law): land for the cows + daily operations.
- Split: **50:50 on combined profit**, first 3 months; then revised (dated rows in `store_profit_split` → rename to `partnership_split`, shared by both).
- Land: no rent charged — recorded in settings as the partner's contribution.

### 9.1 Entity switcher (UI)

A selector in the header / Finance & Reports pages: **Dairy | Feed Store | Combined**.
Each view shows for the chosen month/range: **Revenue → Expenses (by category) → Profit/Loss**, plus a 6-month trend.

| Entity | Revenue | Expenses |
|---|---|---|
| **Dairy** | existing `sales` + `income` (as in `FinanceService.getFinancialSummary`) | existing `expenses` **excluding** capital categories + feed transferred from store (at cost) |
| **Feed Store** | `store_sales` where `type = CUSTOMER` | COGS (FIFO cost of lines) + `store_expenses` + wastage/expired |
| **Combined** | Dairy + Store | Dairy + Store |

Feed transfers are already counted in the dairy as expense at cost and contribute ₹0 to store revenue/profit — no double counting.

### 9.2 Rules

1. **Labour:** first 3 months, full ₹15,000 worker salary is a **dairy** expense; store labour = ₹0 (`labour_alloc = 0`). Changeable later via dated setting.
2. **Single counting:** every rupee of cost belongs to exactly one entity.
3. **Owner-paid costs** (electricity, fuel, loan interest paid personally) must be entered as expenses — `Expense.paidBy` already supports this.
4. **Capital vs expense:** new expense categories `CAPEX_ANIMAL`, `CAPEX_SHED`, `CAPEX_EQUIPMENT` (dairy) and `store_capital` (store) are **excluded from P&L**; tracked as investment. Optional monthly depreciation (e.g. shed 5 yrs, equipment 3 yrs) — phase 2 of this section.
5. **Losses first:** combined loss carries forward; later combined profit repays it to the owner before the 50:50 split.
6. **Month close** locks dairy expenses/income/sales and store records for that month (ADMIN can reopen with a reason, logged).

### 9.3 Data

```
business_entity        enum DAIRY | STORE (code-level, no table needed)
partnership_split      id, effective_from (YYYY-MM), owner_pct, partner_pct           ← seed 50/50
partnership_settlements id, month (unique), dairy_revenue, dairy_expense, dairy_profit,
                       store_revenue, store_cogs, store_expense, store_profit,
                       combined_profit, loss_carried_in, loss_recovered, distributable,
                       owner_pct, partner_pct, owner_share, partner_share, loss_carried_out,
                       paid_to_partner (bool), paid_on, status(DRAFT|CLOSED), closed_at, closed_by,
                       reopen_reason
```
Replaces the store-only `store_settlements` in §2 (store P&L still computed by the store service).

### 9.4 Backend

- `PnlService.getPnl(entity, from, to)` → `{revenue, revenueByCategory, expense, expenseByCategory, profit}` for DAIRY / STORE / COMBINED. Dairy part reuses `FinanceService`, adding capex exclusion.
- `PartnershipController`
  - `GET  /api/pnl?entity=DAIRY|STORE|COMBINED&from&to`
  - `GET  /api/pnl/trend?entity&months=6`
  - `GET  /api/settlements` / `GET /api/settlements/{month}` (draft computed live if not closed)
  - `POST /api/settlements/{month}/close` (ADMIN) · `POST /{month}/reopen` (ADMIN, reason) · `POST /{month}/mark-paid`
  - `GET/POST /api/partnership/split`
- Partner (STAFF/PARTNER role) can **view** P&L and settlements; only ADMIN closes/reopens.

### 9.5 Frontend

```
app/finance/page.tsx              Entity switcher + month picker → Revenue / Expenses / P&L cards, category breakdown, trend chart
app/finance/settlements/page.tsx  Month list: dairy P/L, store P/L, combined, loss carried, owner/partner share, status
app/finance/settlements/[month]   Statement view (same layout as the table in §9.1) + Close / Mark paid + Share on WhatsApp
```

### 9.6 Phase placement

Settlement work becomes **P3 – Money & partnership** (≈1.5 wk): entity P&L, capex categories, partnership_split, settlements with loss carry-forward, month lock, statement share.
Done when: a month with dairy profit + store loss, followed by a month with combined profit, produces correct shares and carried-forward loss.
