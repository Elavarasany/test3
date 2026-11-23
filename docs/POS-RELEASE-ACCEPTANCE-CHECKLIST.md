# POS Release Acceptance Checklist

This checklist is for a disposable staging database and a real browser session. It is not a substitute for automated backend tests, provider settlement verification, accountant approval, or a production migration rehearsal.

## Payment exception review screen

- [ ] Sign in as ADMIN and confirm the POS **Payment exceptions** tab loads the manager/admin manual-review queue.
- [ ] Sign in as MANAGER and confirm the same queue is accessible.
- [ ] Sign in as CASHIER and confirm the tab is hidden and the API denies direct access.
- [ ] Confirm an empty queue shows a clear empty state; confirm populated queue shows event ID/type, provider refund/payment IDs, order ID, amount/currency, provider status and processing error.
- [ ] Confirm pagination and refresh work, and malformed payloads remain visible without exposing raw webhook JSON.
- [ ] Confirm the screen offers no action to issue a refund, mark a refund successful, retry an event or change review status.
- [ ] Follow the interim manual procedure in the backend payment reconciliation readiness document and retain approved evidence.

## Execution status and evidence rules

All unchecked boxes below are **manual release-acceptance checks**. They have not been executed in a real browser against a disposable staging environment as part of repository review. A backend unit/integration test or CI pass is not a substitute for checking the complete cashier workflow, receipt rendering, browser refresh recovery, real staff accounts, or operational sign-off.

Automated coverage exists for selected backend behaviors, including checkout validation/idempotency, MySQL stock contention, return pricing/concurrency, exchange settlement, shift cash calculations, stock-count service rules, procurement idempotency, authorization and report date grouping. Coverage is not exhaustive; use the test suite and CI run links as supporting evidence, not as a claim that every box below passed. The frontend currently has no configured browser E2E runner.

Do not mark a box complete without recording the date, tester, environment/build, test IDs and evidence. Mark a failed or blocked check explicitly; do not silently skip it.

## Test environment

- [ ] Use a disposable database with the same MySQL major/minor version and collation planned for production.
- [ ] Apply the reviewed manual migrations in the documented order; record the migration version and backup/restore point.
- [ ] Configure the frontend build with the staging API URL and configure backend CORS for the staging frontend origin.
- [ ] Use separate ADMIN, MANAGER and CASHIER accounts. Confirm each account is active and has a unique password.
- [ ] Create one active location, register, product and at least two active variants. Receive stock through the inventory API/UI; do not insert inventory balances directly with SQL.
- [ ] Record starting on-hand, reserved and available quantities, cash float and all test IDs.

## Cashier checkout

- [ ] Sign in as CASHIER and open the available MAIN register shift with a counted opening float. Register-to-staff assignment is not implemented; any authorized POS staff can open any active register, and the same employee can open shifts on multiple registers. Confirm owner policy before production.
- [ ] Search by product name, SKU and barcode; select the intended variant and verify the displayed available quantity.
- [ ] Complete a cash sale where tendered cash exceeds the amount due. Verify change is correct and expected drawer cash increases by the payment amount, not by tendered cash.
- [ ] Print the POS receipt (not a statutory GST invoice), reload the page, find the sale in history and reprint it.
- [ ] Attempt a UPI/card sale without a transaction reference. It must be blocked by the UI and rejected by the backend if the API is called directly.
- [ ] Enter a test UTR/card-terminal reference and complete a non-cash sale. Confirm the reference is recorded. Do not interpret this as provider settlement verification.
- [ ] Attempt to apply a discount as CASHIER through a direct API request. The backend must reject it.
- [ ] Sign in as MANAGER/ADMIN and verify a discount is accepted, bounded by the sale subtotal, and reflected consistently in receipt and report. Current behavior has no amount/percentage ceiling or reason/approval audit; obtain owner-approved discount policy before production.

## Retry and inventory contention

- [ ] Simulate an uncertain checkout response after submitting a sale. Refresh the same browser tab and retry the unchanged request. Verify one sale and one stock movement exist.
- [ ] Verify a changed payload cannot be submitted with the original idempotency key.
- [ ] Race an online reservation and a POS sale for the final available unit. Exactly one operation must win; the other must fail for insufficient available stock. The committed balance must never become negative or oversold.
- [ ] Verify a stock count freeze blocks POS sales, online reservations, receipts, adjustments, returns/exchanges and other stock-changing operations until the count is posted or cancelled. Verify posting is rejected if the poster started, submitted or counted any line in that session; a different manager/admin must post it.

## Returns, exchanges and cash drawer

- [ ] Process a partial return. Verify returned quantities cannot exceed the remaining sold quantity.
- [ ] Test RESTOCK, DAMAGED and DISCARD dispositions. Only RESTOCK may increase available inventory; damaged/discarded items require a reason.
- [ ] Attempt to void a sale after a partial return. It must be rejected.
- [ ] For a cash refund, verify expected drawer cash decreases by the refund amount. For UPI/card, verify the POS records the reference only and that the refund was independently completed and confirmed through the provider.
- [ ] Complete an exchange with a positive balance due and one with a negative balance due. Verify only the positive difference is collected and the negative difference is recorded as a refund; verify stock dispositions and audit history. Confirm fresh action-specific password authorization is consumed once. Current control is self-approval; obtain owner policy for value thresholds, dual approval and evidence before production.
- [ ] Record cash-in and cash-out with reasons. Attempt cash-out greater than expected drawer cash; it must be rejected. Verify actor and reason are retained. Current behavior has no amount ceiling or fresh supervisor approval for cash-in/out; obtain owner-approved limits and approval policy before production.
- [ ] Close the shift using a counted cash amount. A variance must require an explanation and remain visible in manager review. Confirm the owner-approved procedure for independent cash count verification; the current system does not enforce a second counter.

## Manager inventory and procurement

- [ ] Receive stock against the exact variant and location; verify the movement history and actor.
- [ ] Apply a reasoned stock adjustment as MANAGER/ADMIN. Verify CASHIER cannot call the endpoint.
- [ ] Start a physical count, enter and submit counts, then have a different manager/admin review and post it. Verify the location unlocks only after successful post/cancel.
- [ ] Create a purchase order, receive it partially, refresh the page, and retry any uncertain operation with the exact same idempotency key and payload.
- [ ] Process a supplier return and verify stock and movement history.

## Security and staff authorization

- [ ] Use direct API requests (not only hidden UI controls) to confirm CASHIER is denied sales history, returns, voids, exchanges, reports, inventory, procurement and manager shift history.
- [ ] Confirm CASHIER can only view, add cash movements to and close their own shift; another cashier's shift is inaccessible. Confirm MANAGER/ADMIN can review and close another staff member's shift.
- [ ] Confirm CASHIER cannot apply sale or exchange discounts, even when the request is sent directly to the API. Confirm MANAGER/ADMIN discount requests are bounded by subtotal; separately obtain owner approval for the missing discount ceilings, reason requirement and exception-approval rules.
- [ ] Confirm manager/admin sensitive actions (return, void, exchange, inventory receipt/adjustment, stock-count post/cancel, goods receipt, supplier return and PO submit) require a fresh password authorization for the exact action.
- [ ] Confirm a sensitive-action authorization token cannot be reused, used by another account, used for a different action, or used after its two-minute expiry.
- [ ] Disable a staff account after issuing its JWT; verify subsequent API requests with that token are rejected. Confirm role changes take effect on the next request.

## Reports and release evidence

- [ ] Reconcile sales, discounts, refunds, exchanges, tender totals and shift cash against the underlying transactions.
- [ ] Confirm refund reports distinguish recorded POS references from provider-confirmed refunds.
- [ ] Confirm procurement reports are not treated as accounts payable, landed cost, inventory valuation, COGS or profit.
- [ ] Export test evidence: screenshots, request/response IDs, sale/return/exchange IDs, stock movement IDs, closing cash variance, migration log and CI run links. Confirm the audit trail captures the actor, reason, timestamp and resulting record; current POS history is not tamper-evident and does not provide a unified log of denied/failed actions, actor role, IP/device or authorization-to-outcome linkage.
- [ ] Obtain shop-owner approval for operating procedures and accountant approval for GST/HSN, tax treatment, receipt/invoice numbering and financial reporting before enabling statutory invoicing.

## Current release-gate count

There are 45 unchecked manual acceptance items in the sections above. Repository review and automated tests do not complete these checks. Treat all 45 as pending until a tester records actual staging/browser evidence. In addition, the separate production gates below (client database rehearsal, opening-stock reconciliation, accountant approval, provider/bank reconciliation, HTTPS/CORS and owner sign-off) must be completed before production use.

## Known limitations

- The frontend currently has build/lint checks but no configured browser E2E test runner. These browser scenarios must be executed and signed off manually until an E2E suite is added.
- The POS does not execute UPI/card refunds or independently verify payment settlement.
- GST calculations, statutory tax invoice snapshots and financial-year sequential invoice numbering are not implemented.
- This checklist does not authorize migration or deployment to the client database.

- [ ] Idempotency collision and retention checks: verify same-key/same-payload replay, same-key/different-payload rejection, exchange-generated sale/return prefix collision with caller-supplied checkout keys, cash-movement key collisions across manual and internally generated movements, and confirm no independent deletion of financial idempotency records.

- [ ] Location-isolation acceptance: verify checkout/return/exchange reject a shift from another location; verify staff cannot access unassigned locations, sales, registers, shifts or reports once staff-location assignments are introduced; test cross-location sale/register/shift ID substitution and query scoping. Current roles are global and no staff-location assignment exists, so multi-branch isolation is not yet supported.
