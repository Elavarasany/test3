# NMK Opticals POS Terminal — v1

## Included

The cashier terminal is available at `/admin/pos` after an admin signs in.

- Select an active inventory location.
- Create sellable product variants with SKU, optional barcode, attributes and optional price override.
- Receive stock against a selected variant/location with an idempotency key and audit reason.
- View on-hand, reserved and available stock by variant.
- Search the server catalogue by product name, category, SKU or barcode.
- Select the exact sellable variant and add it to the bill.
- See current location stock and prevent adding more than the displayed available quantity.
- Capture optional walk-in customer name and phone.
- Apply a direct rupee discount (ADMIN/MANAGER only; CASHIER discount requests are rejected by the backend).
- Accept cash, UPI or card, including split tender across up to three methods.
- Calculate cash change.
- Submit the sale through the authenticated POS checkout API.
- View paginated sales history, inspect a transaction and print/reprint an invoice.
- Open a cashier shift with an opening cash float before the first sale.
- Record audited cash-in and cash-out drawer movements with reasons.
- Calculate expected drawer cash from opening float, cash tenders and cash movements.
- Close a shift with an actual cash count and a mandatory explanation for any variance.
- Link each new POS sale and cash tender to the active cashier shift.
- Retry uncertain checkout requests with the same idempotency key and unchanged payload to reduce duplicate-sale risk.

## Backend contract

The terminal uses the existing backend endpoints:

- `GET /api/admin/pos/locations`
- `GET /api/admin/pos/catalog?locationId={id}`
- `POST /api/admin/pos/checkout`
- `GET /api/admin/pos/sales?page={page}&size=20&locationId={id}`
- `GET /api/admin/pos/sales/{saleId}`

Prices, variant ownership, payment totals and stock deductions are validated by the backend. The browser does not submit a trusted price or stock count. A successful checkout records the sale, item/payment snapshots and stock movements in the backend transaction.

Stock receipts are handled separately through the authenticated inventory receipt endpoint; a cashier sale must never be used to create opening stock.

## Deliberate v1 exclusions

The operations branch now includes staff roles, register/shift cash reconciliation, customer returns, full sale voids, physical stock counts, supplier purchasing, goods receipt, supplier returns, reorder thresholds, low-stock alerts and date-scoped sales/refund reports.

The remaining exclusions are:

- Multi-register cashier assignment, shift reopening, supervisor override thresholds and cross-register cash transfers.
- Linked atomic exchanges are implemented on the operations branch. Managers/admins can exchange selected quantities from a completed sale for replacement variants in one backend transaction. The workflow applies non-cash exchange credit, collects only a positive difference or records an actual refund for a negative difference, updates stock with RESTOCK/DAMAGED/DISCARD dispositions, requires one-time manager/admin password authorization, and supports idempotent retries plus exchange audit history. UPI/card difference collections require a transaction reference; the POS records it but does not verify provider settlement. Backend endpoint: `POST /api/admin/pos/sales/{saleId}/exchange`; history: `GET /api/admin/pos/sales/{saleId}/exchange`; manual migration: `014-create-pos-exchanges.sql`. Do not use separate return and checkout operations to simulate an exchange.
- Credit notes, supplier accounts payable, supplier credit settlement and automated provider refund execution. UPI/card refunds must be completed externally and the confirmed reference recorded in POS.
- GST/tax calculation and statutory tax invoices are not implemented: product HSN/SAC, tax rates, immutable tax snapshots and financial-year sequential invoice numbering are absent. The printed POS receipt is not a certified GST tax invoice. Do not enable GST invoicing until accountant-approved classifications, rates, inclusive/exclusive pricing, discount/rounding rules, place-of-supply treatment and invoice-series requirements are supplied. Profit accounting and landed-cost accounting are also excluded.
- A configurable permission-code matrix, per-register access restrictions and threshold-based approval workflows.

These require shop-owner/accountant policy decisions. Completed sales remain immutable; returns and voids are separate, audited records and must never be simulated by editing or deleting the original sale.

## Deployment gate

No live/client database migration is performed by the frontend terminal. Before production POS use, the backend's manual variant/inventory/POS migrations must be reviewed, tested on a restorable staging copy, and explicitly approved for the client database. Set `VITE_API_BASE_URL` consistently for the storefront, admin login/dashboard and POS terminal. In development only, the POS terminal falls back to `http://localhost:8080/api`; in production it has no localhost fallback and fails closed with a configuration error when the variable is missing. For the isolated local E2E backend, explicitly set `VITE_API_BASE_URL=http://localhost:8082/api`. Configure the production API URL at build time and the backend CORS allowlist separately; rebuild/redeploy the frontend after changing the variable. Never deploy a local development API URL.


## Stock adjustment capability (operations branch)

The Inventory tab now also supports an authenticated stock adjustment for verified physical count differences, damage/write-offs and documented discrepancies.

- Positive quantity change adds stock; negative quantity change removes stock.
- A non-zero adjustment reason and a fresh idempotency key are required.
- The exact same request must be retried after an uncertain network response.
- The backend prevents adjustments from reducing on-hand below stock reserved for online orders and writes an append-only stock movement.
- Supplier deliveries must still use stock receipt. This adjustment form is not a full stock-count session with frozen snapshots or approval workflow.


## Staff roles (operations branch)

Administrators can create and manage staff accounts from Admin → Staff. Staff passwords must be at least 12 characters and are BCrypt-hashed by the backend. Existing admin accounts retain the ADMIN role by default after the additive migration.

- ADMIN: full admin portal, POS, staff management and inventory operations.
- MANAGER: POS checkout, sales history and inventory receipt/adjustment APIs.
- CASHIER: POS checkout and product/location lookup only; no sale discounts, all-sales history, inventory adjustments or admin portal. The backend rejects cashier discount requests even if the browser is modified.

Disabled staff accounts are rejected at login and their previously issued tokens are rejected on subsequent API requests. A staff member cannot disable their own account, and the final active administrator cannot be disabled or demoted.

Backend migration: `nmk-backend/src/main/resources/db/manual/006-add-staff-roles.sql`. This migration is manual and additive. It must be reviewed and tested on a disposable staging copy before use; it has not been run against any live/client database.


## Register and shift operation

The backend migration `007-create-register-shifts-cash.sql` creates a MAIN register for each active location and the append-only cash movement ledger. A cashier must open a shift before checkout; a new sale must reference that shift. Cash sales add the payment allocation (not the tendered amount) to expected drawer cash. Change returned to the customer is excluded from drawer income.

The POS page shows register selection, opening float, expected drawer cash, cash-in/out and shift closing. A cash variance requires an explanation. Cashier access is limited to their own shift; managers and administrators can review and close shifts. The checkout, cash tender ledger and stock deduction commit in one backend transaction.

Migration 007 is manual and has not been executed against any live/client database.


## Customer returns

Managers and administrators can open a completed sale from Sales history and process a partial or full return. The POS calculates the refund from the original sale line snapshot and allocates the original sale discount proportionally. Previously returned quantities are shown as remaining quantities; the backend enforces the same limit under a sale-row lock.

Each returned line must be classified as RESTOCK, DAMAGED or DISCARD. Only RESTOCK adds inventory, and it writes a dedicated append-only stock movement. DAMAGED and DISCARD require a reason and do not increase stock. Cash refunds reduce the active shift's expected drawer cash. UPI/card refunds require a provider transaction reference; the POS records that reference but does not itself execute the provider refund.

Backend migration: `008-create-customer-returns.sql`. It is manual and has not been run against any live/client database.


## Physical stock count sessions

Managers and administrators can start a physical stock count from the Inventory tab. The backend snapshots every variant at the location and freezes stock-changing operations until the count is posted or cancelled. Enter and save the physical quantity for each line, submit the completed count for review, then post the variances. Each non-zero difference becomes a `COUNT_VARIANCE` stock movement linked to the session.

The POS catalogue exposes the location freeze state so the cashier terminal warns and disables checkout while a count is active. A failed post leaves the location frozen; retry the post or cancel the session after reviewing it. Do not manually clear the location lock in the database.

Backend migration: `009-create-stock-count-sessions.sql`. It is manual and has not been run against any live/client database.


## Supplier procurement

The Inventory tab includes supplier creation, DRAFT purchase order creation, order submission, partial/full goods receipt and supplier return actions. Goods receipt creates stock only after the receipt is recorded; supplier returns reduce stock and cannot remove reserved units. Both flows use idempotency keys and append-only stock movements. Uncertain receipt/return responses retain the original payload and key for safe retry.
The same tab includes a newest-first, paginated stock movement history with optional variant filtering. It displays quantity/reservation deltas, resulting balances, movement type, reference, reason and timestamp from the append-only backend ledger.

Supplier credit notes, accounts payable, GST/landed-cost accounting and automatic supplier payments are not included. These require the client's accounting policies and accountant-approved tax rules.

Backend migration: `010-create-procurement.sql`. It is manual and has not been run against any live/client database.


## Low-stock alerts

The Inventory tab supports a per-location reorder level for each variant. A threshold of zero disables the alert. The low-stock list compares available quantity (on-hand less reserved) against the configured threshold, so online reservations are not mistakenly treated as available stock. Threshold changes record the staff username and timestamp.

Backend migration: `011-audit-reorder-level-changes.sql`. It is manual and has not been run against any live/client database.


## Sales and refund reporting

The Reports tab provides date-scoped totals for transactions, subtotal, discounts, sales after discount, returns/refunds processed during the selected dates, net after refunds, sales and refund payment methods, cashier totals, daily totals and top products. Refunds are reported on the date the return is processed. The report is limited to 367 calendar days and is available to managers and administrators.

The report is operational POS reporting only. It does not calculate GST, profit, supplier liabilities, bank settlements or accountant-approved financial statements.

## Full sale voids

ADMIN and MANAGER users can void an entire completed sale from its transaction details. The POS checks that no return already exists, requires a reason and a full refund allocation, and submits the dedicated manager-only `/admin/pos/sales/{saleId}/void` endpoint. The backend restores every original sale line to stock and writes a separate `VOID` audit record; the original sale and invoice are retained.

Cash refunds are paid from the open drawer and are rejected when expected drawer cash is insufficient. UPI/card refunds require the refund to be completed and verified with the provider first; the POS stores the provider reference but does not initiate the provider transfer. A full void is blocked after any partial or full return.


## Full sale voids

Managers and administrators can void a completed sale from transaction details only when no earlier return exists. The full void restores all original sale lines to stock and records a full refund on an open shift. It is intended only for a sale cancelled before goods leave the shop. Cash refunds are posted to the shift drawer; UPI/card refunds must first be completed externally and their actual provider/bank reference entered. The POS does not initiate provider refunds.

Migration: `012-distinguish-pos-voids.sql`. It is manual and has not been run against any live/client database.
