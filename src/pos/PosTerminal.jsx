import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, RefreshCw, Plus, Minus, Trash2, Receipt,
  History, ShoppingCart, Store, Printer, X, CheckCircle2, Clock3, FileText,
  AlertCircle, UserRound, CreditCard,
  ChevronLeft, ChevronRight, Package, ScanLine, ClipboardCheck, Truck, BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./PosTerminal.css";
import { API_BASE_URL } from "../config/api";

const API_BASE = API_BASE_URL;
const money = (value) => Number(value || 0).toLocaleString("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2
});
const amount = (value) => Number(value || 0).toFixed(2);
const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() ||
  `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const PENDING_CHECKOUT_STORAGE_KEY = "nmk.pos.pending-checkout.v1";
function readPendingCheckout() {
  try {
    const stored = sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (!stored) return null;
    const record = JSON.parse(stored);
    const username = sessionStorage.getItem("adminUsername") || "";
    if (!record?.payload?.idempotencyKey || !record?.payload?.shiftId ||
        !Array.isArray(record.payload.items) || !Array.isArray(record.payload.payments)) return null;
    if (!username || record.username !== username) {
      sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
      return null;
    }
    return record.payload;
  } catch {
    sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
    return null;
  }
}

function readPendingOperation(key, valid) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    const username = sessionStorage.getItem("adminUsername") || "";
    if (!username || record?.username !== username || !valid(record.payload)) {
      sessionStorage.removeItem(key);
      return null;
    }
    return record.payload;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}
function savePendingOperation(key, payload) {
  sessionStorage.setItem(key, JSON.stringify({
    username: sessionStorage.getItem("adminUsername") || "",
    payload,
  }));
}

function readPendingProcurementAction(key, valid) {
  try {
    const record = JSON.parse(sessionStorage.getItem(key) || "null");
    const username = sessionStorage.getItem("adminUsername") || "";
    if (!username || record?.username !== username || !Number.isInteger(Number(record.purchaseOrderId)) || !valid(record.payload)) {
      if (record) sessionStorage.removeItem(key);
      return null;
    }
    return { purchaseOrderId: Number(record.purchaseOrderId), payload: record.payload };
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}
function savePendingProcurementAction(key, purchaseOrderId, payload) {
  sessionStorage.setItem(key, JSON.stringify({
    username: sessionStorage.getItem("adminUsername") || "",
    purchaseOrderId: Number(purchaseOrderId),
    payload,
  }));
}

function readPendingFinancialAction(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    const username = sessionStorage.getItem("adminUsername") || "";
    if (!username || record?.username !== username || !Number.isInteger(Number(record.saleId)) ||
        !record?.payload?.idempotencyKey) {
      sessionStorage.removeItem(key);
      return null;
    }
    return { saleId: Number(record.saleId), payload: record.payload };
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}
function savePendingFinancialAction(key, saleId, payload) {
  sessionStorage.setItem(key, JSON.stringify({
    username: sessionStorage.getItem("adminUsername") || "",
    saleId: Number(saleId),
    payload,
  }));
}

async function authorizePosAction(action, password) {
  if (!password?.trim()) throw new Error("Enter your staff password to authorize this action.");
  const result = await apiRequest("/admin/auth/authorize-action", {
    method: "POST",
    body: JSON.stringify({ action, password }),
  });
  return result.authorizationToken;
}

async function apiRequest(path, options = {}) {
  if (!API_BASE) {
    throw new Error("POS API is not configured. Set VITE_API_BASE_URL to your deployed backend URL ending in /api.");
  }
  const token = sessionStorage.getItem("adminToken");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (response.status === 401) {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminUsername");
    sessionStorage.removeItem("adminRole");
    window.dispatchEvent(new Event("nmk:session-expired"));
    const error = new Error("Your admin session expired. Sign in again; any unfinished operation must be checked before you retry it.");
    error.status = response.status;
    throw error;
  }
  if (response.status === 403) {
    const error = new Error(data?.message || "Your account is not permitted to perform this action. Contact an administrator if this is unexpected.");
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function WebhookReviewPanel() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [providerReview, setProviderReview] = useState(null);
  const [providerReviewOrderId, setProviderReviewOrderId] = useState(null);
  const [providerLoadingOrderId, setProviderLoadingOrderId] = useState(null);
  const [providerError, setProviderError] = useState("");

  const loadProviderStatus = async (localOrderId) => {
    setProviderLoadingOrderId(localOrderId);
    setProviderError("");
    setProviderReview(null);
    setProviderReviewOrderId(localOrderId);
    try {
      const result = await apiRequest("/admin/pos/payments/stale-creation-review/" + localOrderId + "/provider-status");
      setProviderReview(result);
    } catch (err) {
      setProviderError(err.message || "Unable to verify Razorpay status.");
    } finally {
      setProviderLoadingOrderId(null);
    }
  };

  const loadQueue = useCallback(async (nextPage = 0) => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest(`/admin/pos/payments/webhook-review?page=${nextPage}&size=25`);
      setData(result);
      setPage(nextPage);
    } catch (err) {
      setError(err.message || "Unable to load payment exceptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(0); }, [loadQueue]);

  return (
    <section className="pos-history-panel pos-webhook-review">
      <div className="pos-panel-heading">
        <div><h2>Payment exceptions</h2><p>Razorpay webhook events requiring manual reconciliation. This screen is read-only; it does not issue refunds or change provider status.</p></div>
        <button type="button" className="pos-button secondary compact" onClick={() => loadQueue(page)} disabled={loading}>
          <RefreshCw size={15} className={loading ? "pos-spin" : ""} /> Refresh
        </button>
      </div>
      <div className="pos-webhook-warning">
        <AlertCircle size={17} />
        <span>Confirm the refund directly in the Razorpay merchant dashboard and match it to the original POS refund before recording any outcome outside this screen. A recorded UPI/card reference alone is not proof of settlement.</span>
      </div>
      {error && <div className="pos-alert error" role="alert"><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
      {loading && !data ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading payment exceptions…</span></div>
        : !data?.content?.length ? <div className="pos-empty-state"><CheckCircle2 /><strong>No payment exceptions in this queue</strong><span>Events requiring manual reconciliation will appear here.</span></div>
          : <>
            <div className="pos-webhook-summary"><strong>{data.totalElements || 0} event(s) awaiting review</strong><span>Oldest events are listed first · Page {data.totalPages ? page + 1 : 0} of {data.totalPages || 0}</span></div>
            <div className="pos-history-table-wrap">
              <table className="pos-history-table">
                <thead><tr><th>Event / received</th><th>Provider refund / payment</th><th>Order</th><th>Amount</th><th>Provider status</th><th>Attempts / reason</th></tr></thead>
                <tbody>{data.content.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.eventType || "Unknown event"}</strong><small>{item.eventId}</small><small>{item.receivedAt ? new Date(item.receivedAt).toLocaleString("en-IN") : "—"}</small></td>
                    <td><strong>{item.resourceId || "—"}</strong><small>Payment: {item.paymentId || "—"}</small></td>
                    <td>{item.orderId || "—"}</td>
                    <td>{item.amountPaise != null ? money(Number(item.amountPaise) / 100) : "—"}<small>{item.currency || ""}</small></td>
                    <td><span className="pos-webhook-status">{item.providerStatus || item.status}</span></td>
                    <td>{item.attemptCount}<small>{item.processingError || "Requires manual review"}</small></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="pos-pagination">
              <span>{data.totalElements || 0} total events</span>
              <div>
                <button type="button" disabled={page <= 0 || loading} onClick={() => loadQueue(page - 1)} aria-label="Previous review page"><ChevronLeft size={18} /></button>
                <button type="button" disabled={page + 1 >= (data.totalPages || 0) || loading} onClick={() => loadQueue(page + 1)} aria-label="Next review page"><ChevronRight size={18} /></button>
              </div>
            </div>
          </>}
    </section>
  );
}

function StalePaymentCreationReviewPanel() {
  const [page, setPage] = useState(0);
  const [olderThanMinutes, setOlderThanMinutes] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadQueue = useCallback(async (nextPage = 0, threshold = olderThanMinutes) => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/admin/pos/payments/stale-creation-review?page=" + nextPage + "&size=25&olderThanMinutes=" + threshold);
      setData(result);
      setPage(nextPage);
    } catch (err) {
      setError(err.message || "Unable to load expired payment reservations.");
    } finally {
      setLoading(false);
    }
  }, [olderThanMinutes]);

  useEffect(() => { loadQueue(0, olderThanMinutes); }, [loadQueue, olderThanMinutes]);

  return (
    <section className="pos-history-panel pos-webhook-review">
      <div className="pos-panel-heading">
        <div><h2>Expired payment review</h2><p>Pending orders with expired stock reservations and unresolved Razorpay payment creation. Review these before taking any recovery action.</p></div>
        <button type="button" className="pos-button secondary compact" onClick={() => loadQueue(page)} disabled={loading}>
          <RefreshCw size={15} className={loading ? "pos-spin" : ""} /> Refresh
        </button>
      </div>
      <div className="pos-webhook-warning">
        <AlertCircle size={17} />
        <span>Read-only queue. Do not release reserved stock or retry payment creation solely because an order is old. First verify the Razorpay order and all payment attempts in the merchant account.</span>
      </div>
      <div className="pos-report-filters">
        <label>Older than
          <select value={olderThanMinutes} onChange={(event) => setOlderThanMinutes(Number(event.target.value))}>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={1440}>24 hours</option>
          </select>
        </label>
      </div>
      {error && <div className="pos-alert error" role="alert"><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
      {loading && !data ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading expired payment reservations…</span></div>
        : !data?.content?.length ? <div className="pos-empty-state"><CheckCircle2 /><strong>No expired payment reservations</strong><span>There are no expired pending payment reservations older than {olderThanMinutes} minutes.</span></div>
          : <>
            <div className="pos-webhook-summary"><strong>{data.totalElements || 0} order(s) awaiting review</strong><span>Oldest orders first · Page {data.totalPages ? page + 1 : 0} of {data.totalPages || 0}</span></div>
            <div className="pos-history-table-wrap">
              <table className="pos-history-table">
                <thead><tr><th>Order / created</th><th>Razorpay order</th><th>Amount</th><th>Payment / order status</th><th>Stock reservation</th><th>Age / expiry</th><th>Provider check</th></tr></thead>
                <tbody>{data.content.map((item) => (
                  <tr key={item.orderId}>
                    <td><strong>#{item.orderId}</strong><small>{item.orderDate ? new Date(item.orderDate).toLocaleString("en-IN") : "—"}</small></td>
                    <td>{item.razorpayOrderId || "Not recorded"}</td>
                    <td><strong>{money(item.totalAmount)}</strong></td>
                    <td><strong>{item.paymentCreationStatus}</strong><small>{item.paymentStatus} · {item.orderStatus}</small></td>
                    <td><strong>{item.stockReserved ? "Reserved" : "Not reserved"}</strong><small>Location: {item.inventoryLocationId ?? "—"}</small></td>
                    <td><strong>{item.ageMinutes} min</strong><small>Expires: {item.reservationExpiresAt ? new Date(item.reservationExpiresAt).toLocaleString("en-IN") : "—"}</small></td>
                    <td><button type="button" className="pos-button secondary compact" onClick={() => loadProviderStatus(item.orderId)} disabled={providerLoadingOrderId !== null || !item.razorpayOrderId}>{providerLoadingOrderId === item.orderId ? "Checking…" : "Check Razorpay"}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {providerReviewOrderId && (
              <div className="pos-webhook-detail">
                <div className="pos-panel-heading">
                  <div><h3>Razorpay provider status · Local order #{providerReviewOrderId}</h3><p>Checked {providerReview?.checkedAt ? new Date(providerReview.checkedAt).toLocaleString("en-IN") : "—"}</p></div>
                  <button type="button" className="pos-button secondary compact" onClick={() => { setProviderReview(null); setProviderReviewOrderId(null); setProviderError(""); }}>Close</button>
                </div>
                {providerLoadingOrderId === providerReviewOrderId && <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Fetching Razorpay order and payment attempts…</span></div>}
                {providerError && <div className="pos-alert error" role="alert"><AlertCircle size={17} /><span>{providerError}</span></div>}
                {providerReview && <>
                  <div className="pos-webhook-warning"><AlertCircle size={17} /><span>{providerReview.reviewWarning}</span></div>
                  <div className="pos-webhook-summary">
                    <strong>Provider order: {providerReview.providerOrderStatus || "Unknown"}</strong>
                    <span>Attempts: {providerReview.providerAttempts ?? "—"} · Currency: {providerReview.providerCurrency || "—"} · Amount matches local: {providerReview.providerAmountMatchesLocal ? "Yes" : "No"}</span>
                  </div>
                  <div className="pos-webhook-summary">
                    <span>Amount: {providerReview.providerAmountPaise == null ? "—" : "₹" + (providerReview.providerAmountPaise / 100).toFixed(2)}</span>
                    <span>Paid: {providerReview.providerAmountPaidPaise == null ? "—" : "₹" + (providerReview.providerAmountPaidPaise / 100).toFixed(2)}</span>
                    <span>Due: {providerReview.providerAmountDuePaise == null ? "—" : "₹" + (providerReview.providerAmountDuePaise / 100).toFixed(2)}</span>
                  </div>
                  <div className="pos-history-table-wrap">
                    <table className="pos-history-table">
                      <thead><tr><th>Payment ID</th><th>Status</th><th>Amount</th><th>Currency</th><th>Captured</th></tr></thead>
                      <tbody>{(providerReview.paymentAttempts || []).length ? providerReview.paymentAttempts.map((attempt) => (
                        <tr key={attempt.paymentId}><td>{attempt.paymentId || "—"}</td><td>{attempt.status || "—"}</td><td>{attempt.amountPaise == null ? "—" : "₹" + (attempt.amountPaise / 100).toFixed(2)}</td><td>{attempt.currency || "—"}</td><td>{attempt.captured == null ? "—" : attempt.captured ? "Yes" : "No"}</td></tr>
                      )) : <tr><td colSpan={5}>No payment attempts returned by Razorpay.</td></tr>}</tbody>
                    </table>
                  </div>
                </>}
              </div>
            )}
            <div className="pos-pagination">
              <span>{data.totalElements || 0} total orders</span>
              <div>
                <button type="button" disabled={page <= 0 || loading} onClick={() => loadQueue(page - 1)} aria-label="Previous expired payment page"><ChevronLeft size={18} /></button>
                <button type="button" disabled={page + 1 >= (data.totalPages || 0) || loading} onClick={() => loadQueue(page + 1)} aria-label="Next expired payment page"><ChevronRight size={18} /></button>
              </div>
            </div>
          </>}
    </section>
  );
}

function ProductImage({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="pos-product-placeholder"><Package size={28} /></div>;
  return <img src={src} alt={name} onError={() => setFailed(true)} loading="lazy" />;
}

function ReceiptView({ sale, onClose }) {
  if (!sale) return null;
  const print = () => window.print();
  return (
    <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="pos-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="pos-receipt-title">
        <div className="pos-modal-toolbar">
          <div><span className="pos-eyebrow">SALE COMPLETED</span><h2 id="pos-receipt-title">Invoice preview</h2></div>
          <button className="pos-icon-button" type="button" onClick={onClose} aria-label="Close receipt"><X /></button>
        </div>
        <div className="pos-receipt-print">
          <div className="pos-receipt-brand">
            <strong>NMK OPTICALS</strong>
            <span>POS SALES RECEIPT</span>
          </div>
          <div className="pos-receipt-meta">
            <div><span>POS receipt reference</span><strong>{sale.invoiceNumber}</strong></div>
            <div><span>Date</span><strong>{sale.createdAt ? new Date(sale.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</strong></div>
            <div><span>Cashier</span><strong>{sale.cashierUsername || "—"}</strong></div>
            <div><span>Customer</span><strong>{sale.customerName || "Walk-in customer"}</strong></div>
            {sale.customerPhone && <div><span>Phone</span><strong>{sale.customerPhone}</strong></div>}
          </div>
          <table className="pos-receipt-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
            <tbody>{(sale.items || []).map((item, index) => (
              <tr key={`${item.variantId}-${index}`}>
                <td><strong>{item.productName}</strong><small>{item.variantName || item.sku}</small></td>
                <td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.lineTotal)}</td>
              </tr>
            ))}</tbody>
          </table>
          <div className="pos-receipt-totals">
            <div><span>Subtotal</span><strong>{money(sale.subtotal)}</strong></div>
            <div><span>Discount</span><strong>− {money(sale.discountAmount)}</strong></div>
            <div className="grand"><span>Grand total</span><strong>{money(sale.grandTotal)}</strong></div>
          </div>
          <div className="pos-receipt-payments">
            <strong>Payment details</strong>
            {(sale.payments || []).map((payment, index) => (
              <div key={index}><span>{payment.paymentMethod}</span><span>{money(payment.amount)}</span></div>
            ))}
            {Number(sale.exchangeCreditApplied || 0) > 0 && <div><span>Exchange credit applied</span><span>{money(sale.exchangeCreditApplied)}</span></div>}
            {Number(sale.exchangeActualRefund || 0) > 0 && <div><span>Refund issued on original sale</span><span>{money(sale.exchangeActualRefund)}</span></div>}
            {sale.exchangeReference && <div><span>Exchange reference</span><span>EX-{sale.exchangeReference}</span></div>}
            {(sale.payments || []).filter((p) => p.paymentMethod === "CASH" && Number(p.changeAmount) > 0)
              .map((p, index) => <div key={`change-${index}`}><span>Change</span><span>{money(p.changeAmount)}</span></div>)}
          </div>
          <p className="pos-receipt-thanks">Thank you for shopping with NMK Opticals.</p>
          <p className="pos-receipt-footnote">POS-generated receipt · GST tax breakdown and statutory invoice numbering are not configured</p>
        </div>
        <div className="pos-modal-actions">
          <button type="button" className="pos-button secondary" onClick={onClose}>Close</button>
          <button type="button" className="pos-button primary" onClick={print}><Printer size={17} /> Print receipt</button>
        </div>
      </section>
    </div>
  );
}



function ProcurementHistory({ purchaseOrderId }) {
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async (nextKind, nextPage, append = false) => {
    setLoading(true);
    setError("");
    try {
      const suffix = nextKind === "receipts" ? "receipts" : "supplier-returns";
      const data = await apiRequest(
        "/admin/procurement/purchase-orders/" + purchaseOrderId + "/" + suffix +
        "?page=" + nextPage + "&size=25"
      );
      const content = Array.isArray(data?.content) ? data.content : [];
      setRows((current) => append ? [...current, ...content] : content);
      setPage(Number(data?.number || 0));
      setHasMore(Boolean(data?.hasNext));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const openHistory = async (nextKind) => {
    if (kind === nextKind) { setKind(""); setRows([]); setError(""); setHasMore(false); return; }
    setKind(nextKind);
    setRows([]);
    setPage(0);
    setHasMore(false);
    await loadHistory(nextKind, 0);
  };

  return (
    <div className="pos-procurement-history">
      <div className="pos-procurement-history-actions">
        <button type="button" className="pos-button secondary compact" onClick={() => openHistory("receipts")}>Receipt history</button>
        <button type="button" className="pos-button secondary compact" onClick={() => openHistory("returns")}>Supplier return history</button>
      </div>
      {kind && <section className="pos-procurement-history-panel">
        <div className="pos-panel-heading"><h4>{kind === "receipts" ? "Goods receipt audit" : "Supplier return audit"}</h4>
          <button type="button" className="pos-icon-button" onClick={() => { setKind(""); setRows([]); setHasMore(false); }} aria-label="Close procurement history"><X size={16} /></button>
        </div>
        {loading && rows.length === 0 ? <p>Loading audit records…</p> : error ? <p className="pos-return-error">{error}</p>
          : rows.length === 0 ? <p>No {kind === "receipts" ? "goods receipts" : "supplier returns"} recorded for this order.</p>
          : rows.map((record) => <article className="pos-procurement-history-record" key={record.id}>
            <div><strong>{kind === "receipts" ? record.receiptNumber : record.returnNumber}</strong>
              <small>{record.createdAt ? new Date(record.createdAt).toLocaleString("en-IN") : "—"} · {kind === "receipts" ? record.receivedByUsername : record.processedByUsername}</small>
              <small>{record.reason}</small></div>
            <div className="pos-procurement-history-lines">{(record.items || []).map((item) => <span key={item.purchaseOrderItemId}>
              {item.sku}: {item.quantity} × {money(item.unitCost)}
            </span>)}</div>
          </article>)}
        {hasMore && <div className="pos-procurement-history-actions">
          <button type="button" className="pos-button secondary compact"
            onClick={() => loadHistory(kind, page + 1, true)} disabled={loading}>
            {loading ? "Loading…" : "Load more history"}
          </button>
        </div>}
        {loading && rows.length > 0 && <p>Loading more audit records…</p>}
      </section>}
    </div>
  );
}

function InventoryPanel({ locationId, catalog, onRefreshCatalog, onNotice, onError }) {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantForm, setVariantForm] = useState({
    sku: "", barcode: "", variantName: "", attributes: '{"color":"Black","size":"Medium"}', sellingPriceOverride: ""
  });
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("Supplier stock receipt");
  const [receiptSaving, setReceiptSaving] = useState(false);
  const receiptPayload = useRef(readPendingOperation("nmk.pos.pending-inventory-receipt.v1", (payload) =>
    Boolean(payload?.idempotencyKey && payload.locationId && payload.variantId && payload.quantity)));
  const [receiptRetry, setReceiptRetry] = useState(Boolean(receiptPayload.current));
  const [receiptPassword, setReceiptPassword] = useState("");
  const [adjustmentDelta, setAdjustmentDelta] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("Physical stock count correction");
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const adjustmentPayload = useRef(readPendingOperation("nmk.pos.pending-inventory-adjustment.v1", (payload) =>
    Boolean(payload?.idempotencyKey && payload.locationId && payload.variantId
      && Number.isInteger(payload.quantityDelta) && payload.quantityDelta !== 0)));
  const [adjustmentRetry, setAdjustmentRetry] = useState(Boolean(adjustmentPayload.current));
  const [adjustmentPassword, setAdjustmentPassword] = useState("");
  const [stockCount, setStockCount] = useState(null);
  const [stockCountLoading, setStockCountLoading] = useState(false);
  const [stockCountSaving, setStockCountSaving] = useState(false);
  const [stockCountReason, setStockCountReason] = useState("");
  const [stockCountPostPassword, setStockCountPostPassword] = useState("");
  const [stockCountCancelPassword, setStockCountCancelPassword] = useState("");
  const [stockCountDrafts, setStockCountDrafts] = useState({});
  const [reorderDrafts, setReorderDrafts] = useState({});
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [movementRows, setMovementRows] = useState([]);
  const [movementPage, setMovementPage] = useState(0);
  const [movementPages, setMovementPages] = useState(0);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementVariantId, setMovementVariantId] = useState("");
  const stockCountActive = stockCount && ["COUNTING", "READY_FOR_REVIEW"].includes(stockCount.status);
  const currentStaffUsername = sessionStorage.getItem("adminUsername") || "";
  const currentStaffPreparedCount = Boolean(stockCount && currentStaffUsername && (
    [stockCount.startedByUsername, stockCount.submittedByUsername]
      .some((username) => username && username.toLowerCase() === currentStaffUsername.toLowerCase())
    || (stockCount.lines || []).some((line) => line.countedByUsername
      && line.countedByUsername.toLowerCase() === currentStaffUsername.toLowerCase())
  ));

  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [supplierPage, setSupplierPage] = useState(0);
  const [supplierHasMore, setSupplierHasMore] = useState(false);
  const [orderPage, setOrderPage] = useState(0);
  const [orderHasMore, setOrderHasMore] = useState(false);
  const [procurementMoreLoading, setProcurementMoreLoading] = useState(false);
  const [procurementLoading, setProcurementLoading] = useState(false);
  const [procurementSaving, setProcurementSaving] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierBills, setSupplierBills] = useState([]);
  const [supplierBillsLoading, setSupplierBillsLoading] = useState(false);
  const [supplierPayablesAging, setSupplierPayablesAging] = useState(null);
  const [supplierPayablesAgingLoading, setSupplierPayablesAgingLoading] = useState(false);
  const [supplierPaymentHistoryBillId, setSupplierPaymentHistoryBillId] = useState(null);
  const [supplierPaymentHistory, setSupplierPaymentHistory] = useState([]);
  const [supplierPaymentHistoryLoading, setSupplierPaymentHistoryLoading] = useState(false);
  const [supplierCreditNoteTarget, setSupplierCreditNoteTarget] = useState(null);
  const [supplierCreditNoteForm, setSupplierCreditNoteForm] = useState({ creditNoteNumber: "", issueDate: "", amount: "", reason: "", supplierReturnId: "" });
  const [supplierCreditNotePassword, setSupplierCreditNotePassword] = useState("");
  const [supplierCreditNoteSaving, setSupplierCreditNoteSaving] = useState(false);
  const pendingSupplierCreditNoteRecord = useRef(readPendingOperation("nmk.pos.pending-supplier-credit-note.v1", (payload) =>
    Boolean(payload?.idempotencyKey && payload.billId && payload.creditNoteNumber && payload.amount)));
  const [supplierCreditNotePayload, setSupplierCreditNotePayload] = useState(pendingSupplierCreditNoteRecord.current);
  const [supplierCreditNotesBillId, setSupplierCreditNotesBillId] = useState(null);
  const [supplierCreditNotes, setSupplierCreditNotes] = useState([]);
  const [supplierCreditNotesLoading, setSupplierCreditNotesLoading] = useState(false);
  const [supplierBillForm, setSupplierBillForm] = useState(() => {
    const today = new Date();
    return { invoiceNumber: "", invoiceDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`, dueDate: "", amount: "", billType: "GOODS", purchaseOrderId: "" };
  });
  const [supplierBillPassword, setSupplierBillPassword] = useState("");
  const [supplierBillSaving, setSupplierBillSaving] = useState(false);
  const pendingSupplierBillRecord = useRef(readPendingOperation("nmk.pos.pending-supplier-bill.v1", (payload) =>
    Boolean(payload?.idempotencyKey && payload.supplierId && payload.invoiceNumber && payload.amount)));
  const [supplierBillPayload, setSupplierBillPayload] = useState(pendingSupplierBillRecord.current);
  const [supplierPaymentTarget, setSupplierPaymentTarget] = useState(null);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState("");
  const [supplierPaymentMethod, setSupplierPaymentMethod] = useState("BANK");
  const [supplierPaymentReference, setSupplierPaymentReference] = useState("");
  const [supplierPaymentPassword, setSupplierPaymentPassword] = useState("");
  const [supplierPaymentSaving, setSupplierPaymentSaving] = useState(false);
  const pendingSupplierPaymentRecord = useRef(readPendingOperation("nmk.pos.pending-supplier-payment.v1", (payload) =>
    Boolean(payload?.idempotencyKey && payload.billId && payload.amount)));
  const [supplierPaymentPayload, setSupplierPaymentPayload] = useState(pendingSupplierPaymentRecord.current);
  const [landedCostBillId, setLandedCostBillId] = useState(null);
  const [landedCostAllocations, setLandedCostAllocations] = useState([]);
  const [landedCostLoading, setLandedCostLoading] = useState(false);
  const [purchaseOrderNotes, setPurchaseOrderNotes] = useState("");
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([{ variantId: "", orderedQuantity: "1", unitCost: "" }]);
  const [purchaseOrderPayload, setPurchaseOrderPayload] = useState(() => readPendingOperation("nmk.pos.pending-purchase-order.v1", (payload) =>
    Boolean(payload?.idempotencyKey && payload.supplierId && payload.locationId && Array.isArray(payload.items) && payload.items.length)));
  const purchaseOrderPending = useRef(purchaseOrderPayload?.idempotencyKey || null);
  const [purchaseOrderRetry, setPurchaseOrderRetry] = useState(Boolean(purchaseOrderPayload));
  const [purchaseOrderSubmitTarget, setPurchaseOrderSubmitTarget] = useState(null);
  const [purchaseOrderSubmitPassword, setPurchaseOrderSubmitPassword] = useState("");
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [goodsReceiptReason, setGoodsReceiptReason] = useState("");
  const [goodsReceiptQuantities, setGoodsReceiptQuantities] = useState({});
  const [goodsReceiptSaving, setGoodsReceiptSaving] = useState(false);
  const [goodsReceiptRetry, setGoodsReceiptRetry] = useState(false);
  const pendingGoodsReceiptRecord = useRef(readPendingProcurementAction("nmk.pos.pending-goods-receipt.v1", (payload) =>
    Boolean(payload?.idempotencyKey && Array.isArray(payload.items) && payload.items.length && payload.reason)));
  const [goodsReceiptPassword, setGoodsReceiptPassword] = useState("");
  const [goodsReceiptPayload, setGoodsReceiptPayload] = useState(pendingGoodsReceiptRecord.current?.payload || null);
  const [procurementActionError, setProcurementActionError] = useState("");
  const goodsReceiptPending = useRef(goodsReceiptPayload?.idempotencyKey || null);
  const [supplierReturnOrder, setSupplierReturnOrder] = useState(null);
  const [supplierReturnReason, setSupplierReturnReason] = useState("");
  const [supplierReturnQuantities, setSupplierReturnQuantities] = useState({});
  const [supplierReturnSaving, setSupplierReturnSaving] = useState(false);
  const [supplierReturnRetry, setSupplierReturnRetry] = useState(false);
  const [supplierReturnPassword, setSupplierReturnPassword] = useState("");
  const pendingSupplierReturnRecord = useRef(readPendingProcurementAction("nmk.pos.pending-supplier-return.v1", (payload) =>
    Boolean(payload?.idempotencyKey && Array.isArray(payload.items) && payload.items.length && payload.reason)));
  const [supplierReturnPayload, setSupplierReturnPayload] = useState(pendingSupplierReturnRecord.current?.payload || null);
  const supplierReturnPending = useRef(supplierReturnPayload?.idempotencyKey || null);

  const loadProcurement = useCallback(async () => {
    setProcurementLoading(true);
    try {
      const [supplierData, orderData] = await Promise.all([
        apiRequest("/admin/procurement/suppliers?page=0&size=50"),
        apiRequest("/admin/procurement/purchase-orders?page=0&size=25"),
      ]);
      const supplierList = Array.isArray(supplierData?.content) ? supplierData.content : [];
      const orderList = Array.isArray(orderData?.content) ? orderData.content : [];
      setSuppliers(supplierList);
      setSupplierPage(Number(supplierData?.number || 0));
      setSupplierHasMore(Boolean(supplierData?.hasNext));
      setSelectedSupplierId((current) => current && supplierList.some((supplier) => String(supplier.id) === String(current) && supplier.active)
        ? current : (supplierList.find((supplier) => supplier.active)?.id ? String(supplierList.find((supplier) => supplier.active).id) : ""));
      setPurchaseOrders(orderList);
      setOrderPage(Number(orderData?.number || 0));
      setOrderHasMore(Boolean(orderData?.hasNext));

      const pendingReceipt = pendingGoodsReceiptRecord.current;
      const pendingReturn = pendingSupplierReturnRecord.current;
      const pendingOrderId = pendingReceipt?.purchaseOrderId || pendingReturn?.purchaseOrderId;
      if (pendingOrderId && !orderList.some((item) => Number(item.id) === pendingOrderId)) {
        const pendingOrder = await apiRequest("/admin/procurement/purchase-orders/" + pendingOrderId);
        setPurchaseOrders((current) => [pendingOrder, ...current.filter((item) => Number(item.id) !== pendingOrderId)]);
        if (pendingReceipt && !receivingOrder) {
          setReceivingOrder(pendingOrder);
          setGoodsReceiptReason(pendingReceipt.payload.reason);
          setGoodsReceiptQuantities(Object.fromEntries(pendingReceipt.payload.items.map((item) => [item.purchaseOrderItemId, String(item.quantity)])));
          setGoodsReceiptRetry(true);
        } else if (pendingReturn && !supplierReturnOrder) {
          setSupplierReturnOrder(pendingOrder);
          setSupplierReturnReason(pendingReturn.payload.reason);
          setSupplierReturnQuantities(Object.fromEntries(pendingReturn.payload.items.map((item) => [item.purchaseOrderItemId, String(item.quantity)])));
          setSupplierReturnRetry(true);
        }
      } else {
        if (pendingReceipt && !receivingOrder) {
          const order = orderList.find((item) => Number(item.id) === pendingReceipt.purchaseOrderId);
          if (order) {
            setReceivingOrder(order);
            setGoodsReceiptReason(pendingReceipt.payload.reason);
            setGoodsReceiptQuantities(Object.fromEntries(pendingReceipt.payload.items.map((item) => [item.purchaseOrderItemId, String(item.quantity)])));
            setGoodsReceiptRetry(true);
          }
        }
        if (pendingReturn && !supplierReturnOrder) {
          const order = orderList.find((item) => Number(item.id) === pendingReturn.purchaseOrderId);
          if (order) {
            setSupplierReturnOrder(order);
            setSupplierReturnReason(pendingReturn.payload.reason);
            setSupplierReturnQuantities(Object.fromEntries(pendingReturn.payload.items.map((item) => [item.purchaseOrderItemId, String(item.quantity)])));
            setSupplierReturnRetry(true);
          }
        }
      }
    } catch (err) { onError(err.message); }
    finally { setProcurementLoading(false); }
  }, [onError]);

  const loadMoreSuppliers = async () => {
    if (!supplierHasMore || procurementMoreLoading) return;
    setProcurementMoreLoading(true);
    try {
      const data = await apiRequest("/admin/procurement/suppliers?page=" + (supplierPage + 1) + "&size=50");
      const content = Array.isArray(data?.content) ? data.content : [];
      setSuppliers((current) => [...current, ...content.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setSupplierPage(Number(data?.number || supplierPage + 1));
      setSupplierHasMore(Boolean(data?.hasNext));
    } catch (err) { onError(err.message); }
    finally { setProcurementMoreLoading(false); }
  };

  const loadMorePurchaseOrders = async () => {
    if (!orderHasMore || procurementMoreLoading) return;
    setProcurementMoreLoading(true);
    try {
      const data = await apiRequest("/admin/procurement/purchase-orders?page=" + (orderPage + 1) + "&size=25");
      const content = Array.isArray(data?.content) ? data.content : [];
      setPurchaseOrders((current) => [...current, ...content.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setOrderPage(Number(data?.number || orderPage + 1));
      setOrderHasMore(Boolean(data?.hasNext));
    } catch (err) { onError(err.message); }
    finally { setProcurementMoreLoading(false); }
  };

  const loadSupplierBills = useCallback(async () => {
    if (!selectedSupplierId || staffRole !== "ADMIN") { setSupplierBills([]); return; }
    setSupplierBillsLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/admin/procurement/suppliers/${encodeURIComponent(selectedSupplierId)}/bills?page=0&size=50`);
      const rows = Array.isArray(data?.content) ? data.content : [];
      setSupplierBills(rows);
      const pendingCreditNote = pendingSupplierCreditNoteRecord.current;
      if (pendingCreditNote?.billId && String(pendingCreditNote.supplierId) === String(selectedSupplierId)) {
        const target = rows.find((bill) => Number(bill.id) === Number(pendingCreditNote.billId));
        if (target) {
          setSupplierCreditNoteTarget(target);
          setSupplierCreditNoteForm({
            creditNoteNumber: pendingCreditNote.creditNoteNumber || "",
            issueDate: pendingCreditNote.issueDate || "",
            amount: String(pendingCreditNote.amount || ""),
            reason: pendingCreditNote.reason || "",
            supplierReturnId: pendingCreditNote.supplierReturnId ? String(pendingCreditNote.supplierReturnId) : "",
          });
        }
      }
      const pendingPayment = pendingSupplierPaymentRecord.current;
      if (pendingPayment?.billId && String(pendingPayment.supplierId) === String(selectedSupplierId)) {
        const target = rows.find((bill) => Number(bill.id) === Number(pendingPayment.billId));
        if (target) {
          setSupplierPaymentTarget(target);
          setSupplierPaymentAmount(String(pendingPayment.amount));
          setSupplierPaymentMethod(pendingPayment.paymentMethod || "BANK");
          setSupplierPaymentReference(pendingPayment.reference || "");
        }
      }
    } catch (err) { setError(err.message); }
    finally { setSupplierBillsLoading(false); }
  }, [selectedSupplierId, staffRole]);

  const submitSupplierBill = async (event) => {
    event.preventDefault();
    if (staffRole !== "ADMIN") { onError("Only an administrator can post supplier bills."); return; }
    if (!supplierBillPayload && (!selectedSupplierId || !supplierBillForm.invoiceNumber.trim() || !supplierBillForm.amount)) {
      onError("Choose a supplier and enter the supplier invoice number and amount."); return;
    }
    if (!supplierBillPayload && ["GOODS", "LANDED_COST"].includes(supplierBillForm.billType) && !supplierBillForm.purchaseOrderId) {
      onError("Choose the purchase order linked to this supplier invoice."); return;
    }
    let payload = supplierBillPayload;
    if (!payload) {
      payload = {
        supplierId: Number(selectedSupplierId),
        purchaseOrderId: supplierBillForm.purchaseOrderId ? Number(supplierBillForm.purchaseOrderId) : null,
        invoiceNumber: supplierBillForm.invoiceNumber.trim(),
        invoiceDate: supplierBillForm.invoiceDate,
        dueDate: supplierBillForm.dueDate || null,
        amount: Number(supplierBillForm.amount),
        billType: supplierBillForm.billType,
        idempotencyKey: newIdempotencyKey(),
      };
      pendingSupplierBillRecord.current = payload;
      setSupplierBillPayload(payload);
      savePendingOperation("nmk.pos.pending-supplier-bill.v1", payload);
    }
    setSupplierBillSaving(true);
    setError("");
    try {
      const authorizationToken = await authorizePosAction("SUPPLIER_BILL_POST", supplierBillPassword);
      const created = await apiRequest("/admin/procurement/supplier-bills", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "X-Admin-Action-Authorization": authorizationToken },
      });
      pendingSupplierBillRecord.current = null;
      setSupplierBillPayload(null);
      sessionStorage.removeItem("nmk.pos.pending-supplier-bill.v1");
      setSupplierBillPassword("");
      setSupplierBillForm((current) => ({ ...current, invoiceNumber: "", dueDate: "", amount: "", purchaseOrderId: "" }));
      await loadSupplierBills();
      onNotice(`Supplier bill ${created.invoiceNumber} posted. Outstanding: ${money(created.outstandingAmount)}.`);
    } catch (err) {
      if (err.status === 400 || (err.status === 409 && String(err.message || "").toLowerCase().includes("invoice number"))) {
        pendingSupplierBillRecord.current = null;
        setSupplierBillPayload(null);
        sessionStorage.removeItem("nmk.pos.pending-supplier-bill.v1");
      }
      onError(`${err.message}${!err.status || err.status >= 500 || err.status === 409 ? " Retry the exact same bill; its idempotency key is retained." : ""}`);
    } finally { setSupplierBillSaving(false); }
  };

  const loadSupplierCreditNotes = async (billId) => {
    setSupplierCreditNotesBillId(billId);
    setSupplierCreditNotes([]);
    setSupplierCreditNotesLoading(true);
    try {
      const rows = await apiRequest(`/admin/procurement/supplier-bills/${billId}/credit-notes`);
      setSupplierCreditNotes(Array.isArray(rows) ? rows : []);
    } catch (err) { onError(err.message); }
    finally { setSupplierCreditNotesLoading(false); }
  };

  const beginSupplierCreditNote = (bill) => {
    const today = new Date();
    setSupplierCreditNoteTarget(bill);
    setSupplierCreditNoteForm({
      creditNoteNumber: "",
      issueDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
      amount: String(bill.outstandingAmount),
      reason: "",
      supplierReturnId: "",
    });
    setSupplierCreditNotePassword("");
    setSupplierCreditNotePayload(null);
    pendingSupplierCreditNoteRecord.current = null;
    sessionStorage.removeItem("nmk.pos.pending-supplier-credit-note.v1");
  };

  const submitSupplierCreditNote = async (event) => {
    event.preventDefault();
    if (staffRole !== "ADMIN" || !supplierCreditNoteTarget) { onError("Only an administrator can record supplier credit notes."); return; }
    let payload = supplierCreditNotePayload;
    if (!payload) {
      const amount = Number(supplierCreditNoteForm.amount);
      if (!supplierCreditNoteForm.creditNoteNumber.trim() || !supplierCreditNoteForm.issueDate || !supplierCreditNoteForm.reason.trim() || !Number.isFinite(amount) || amount <= 0) {
        onError("Enter the supplier credit note number, date, amount and reason."); return;
      }
      payload = {
        billId: supplierCreditNoteTarget.id,
        supplierId: supplierCreditNoteTarget.supplierId,
        creditNoteNumber: supplierCreditNoteForm.creditNoteNumber.trim(),
        issueDate: supplierCreditNoteForm.issueDate,
        amount,
        reason: supplierCreditNoteForm.reason.trim(),
        supplierReturnId: supplierCreditNoteForm.supplierReturnId ? Number(supplierCreditNoteForm.supplierReturnId) : null,
        idempotencyKey: newIdempotencyKey(),
      };
      pendingSupplierCreditNoteRecord.current = payload;
      setSupplierCreditNotePayload(payload);
      savePendingOperation("nmk.pos.pending-supplier-credit-note.v1", payload);
    }
    setSupplierCreditNoteSaving(true);
    setError("");
    try {
      const authorizationToken = await authorizePosAction("SUPPLIER_CREDIT_NOTE", supplierCreditNotePassword);
      const saved = await apiRequest(`/admin/procurement/supplier-bills/${payload.billId}/credit-notes`, {
        method: "POST",
        body: JSON.stringify({
          creditNoteNumber: payload.creditNoteNumber, issueDate: payload.issueDate,
          amount: payload.amount, reason: payload.reason,
          supplierReturnId: payload.supplierReturnId, idempotencyKey: payload.idempotencyKey,
        }),
        headers: { "X-Admin-Action-Authorization": authorizationToken },
      });
      pendingSupplierCreditNoteRecord.current = null;
      setSupplierCreditNotePayload(null);
      sessionStorage.removeItem("nmk.pos.pending-supplier-credit-note.v1");
      setSupplierCreditNoteTarget(null);
      setSupplierCreditNotePassword("");
      await loadSupplierBills();
      onNotice(`Supplier credit note ${saved.creditNoteNumber} recorded for ${money(saved.amount)}.`);
    } catch (err) {
      if (err.status === 400 || (err.status === 409 && String(err.message || "").toLowerCase().includes("credit note number"))) {
        pendingSupplierCreditNoteRecord.current = null;
        setSupplierCreditNotePayload(null);
        sessionStorage.removeItem("nmk.pos.pending-supplier-credit-note.v1");
      }
      onError(`${err.message}${!err.status || err.status >= 500 || err.status === 409 ? " Retry the exact same credit note; its idempotency key is retained." : ""}`);
    } finally { setSupplierCreditNoteSaving(false); }
  };

  const loadSupplierPayablesAging = useCallback(async () => {
    if (!selectedSupplierId || staffRole !== "ADMIN") { setSupplierPayablesAging(null); return; }
    setSupplierPayablesAging(null);
    setSupplierPayablesAgingLoading(true);
    try {
      const data = await apiRequest(`/admin/procurement/suppliers/${encodeURIComponent(selectedSupplierId)}/payables-aging`);
      setSupplierPayablesAging(data);
    } catch (err) { onError(err.message); }
    finally { setSupplierPayablesAgingLoading(false); }
  }, [selectedSupplierId, staffRole]);

  const loadSupplierPaymentHistory = async (billId) => {
    setSupplierPaymentHistoryBillId(billId);
    setSupplierPaymentHistory([]);
    setSupplierPaymentHistoryLoading(true);
    try {
      const rows = await apiRequest(`/admin/procurement/supplier-bills/${billId}/payments`);
      setSupplierPaymentHistory(Array.isArray(rows) ? rows : []);
    } catch (err) { onError(err.message); }
    finally { setSupplierPaymentHistoryLoading(false); }
  };

  const beginSupplierPayment = (bill) => {
    setSupplierPaymentTarget(bill);
    setSupplierPaymentAmount(String(bill.outstandingAmount));
    setSupplierPaymentMethod("BANK");
    setSupplierPaymentReference("");
    setSupplierPaymentPassword("");
    setSupplierPaymentPayload(null);
    pendingSupplierPaymentRecord.current = null;
    sessionStorage.removeItem("nmk.pos.pending-supplier-payment.v1");
  };

  const submitSupplierPayment = async (event) => {
    event.preventDefault();
    if (staffRole !== "ADMIN" || !supplierPaymentTarget) { onError("Only an administrator can record supplier payments."); return; }
    let payload = supplierPaymentPayload;
    if (!payload) {
      const amount = Number(supplierPaymentAmount);
      if (!Number.isFinite(amount) || amount <= 0) { onError("Enter a valid payment amount."); return; }
      if (supplierPaymentMethod !== "CASH" && !supplierPaymentReference.trim()) { onError("Enter the bank/UPI payment reference."); return; }
      if (supplierPaymentMethod === "CASH" && (!shift || shift.status !== "OPEN")) { onError("Open a cashier shift before recording a supplier cash payment."); return; }
      payload = {
        billId: supplierPaymentTarget.id,
        supplierId: supplierPaymentTarget.supplierId,
        amount,
        paymentMethod: supplierPaymentMethod,
        reference: supplierPaymentReference.trim() || null,
        shiftId: supplierPaymentMethod === "CASH" ? shift.id : null,
        idempotencyKey: newIdempotencyKey(),
      };
      pendingSupplierPaymentRecord.current = payload;
      setSupplierPaymentPayload(payload);
      savePendingOperation("nmk.pos.pending-supplier-payment.v1", payload);
    }
    setSupplierPaymentSaving(true);
    setError("");
    try {
      const authorizationToken = await authorizePosAction("SUPPLIER_PAYMENT", supplierPaymentPassword);
      const saved = await apiRequest(`/admin/procurement/supplier-bills/${payload.billId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: payload.amount, paymentMethod: payload.paymentMethod,
          reference: payload.reference, shiftId: payload.shiftId,
          idempotencyKey: payload.idempotencyKey,
        }),
        headers: { "X-Admin-Action-Authorization": authorizationToken },
      });
      pendingSupplierPaymentRecord.current = null;
      setSupplierPaymentPayload(null);
      sessionStorage.removeItem("nmk.pos.pending-supplier-payment.v1");
      setSupplierPaymentTarget(null);
      setSupplierPaymentPassword("");
      await loadSupplierBills();
      if (payload.paymentMethod === "CASH") await loadCurrentShift();
      onNotice(`Supplier payment ${money(saved.amount)} recorded.`);
    } catch (err) {
      if (err.status === 400) {
        pendingSupplierPaymentRecord.current = null;
        setSupplierPaymentPayload(null);
        sessionStorage.removeItem("nmk.pos.pending-supplier-payment.v1");
      }
      onError(`${err.message}${!err.status || err.status >= 500 || err.status === 409 ? " Retry the exact same payment; its idempotency key is retained." : ""}`);
    } finally { setSupplierPaymentSaving(false); }
  };

  const loadLandedCostAllocations = async (billId) => {
    setLandedCostLoading(true);
    setLandedCostBillId(billId);
    setLandedCostAllocations([]);
    try {
      const rows = await apiRequest(`/admin/procurement/supplier-bills/${billId}/landed-cost-allocations`);
      setLandedCostAllocations(Array.isArray(rows) ? rows : []);
    } catch (err) { onError(err.message); }
    finally { setLandedCostLoading(false); }
  };

  const createSupplier = async (event) => {
    event.preventDefault();
    if (!supplierName.trim()) { onError("Supplier name is required."); return; }
    setProcurementSaving(true);
    onError("");
    try {
      const created = await apiRequest("/admin/procurement/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: supplierName.trim(),
          contactName: supplierContact.trim() || null,
          phone: supplierPhone.trim() || null,
          email: supplierEmail.trim() || null,
          address: supplierAddress.trim() || null,
        }),
      });
      setSupplierName(""); setSupplierContact(""); setSupplierPhone(""); setSupplierEmail(""); setSupplierAddress("");
      await loadProcurement();
      setSelectedSupplierId(String(created.id));
      onNotice(`Supplier ${created.name} created.`);
    } catch (err) { onError(err.message); }
    finally { setProcurementSaving(false); }
  };

  const createPurchaseOrder = async (event) => {
    event.preventDefault();
    if (!purchaseOrderPayload && (!selectedSupplierId || !locationId)) { onError("Choose an active supplier and store location."); return; }
    if (!purchaseOrderPayload) {
      const items = purchaseOrderItems.map((item) => ({
        variantId: Number(item.variantId),
        orderedQuantity: Number(item.orderedQuantity),
        unitCost: Number(item.unitCost),
      }));
      if (!items.length || items.some((item) => !item.variantId || !Number.isInteger(item.orderedQuantity) || item.orderedQuantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost <= 0)) {
        onError("Every purchase order line needs a variant, positive whole quantity and positive unit cost.");
        return;
      }
      if (new Set(items.map((item) => item.variantId)).size !== items.length) {
        onError("Each variant can appear only once in a purchase order.");
        return;
      }
      purchaseOrderPending.current = purchaseOrderPending.current || newIdempotencyKey();
      setPurchaseOrderPayload({
        supplierId: Number(selectedSupplierId),
        locationId: Number(locationId),
        notes: purchaseOrderNotes.trim() || null,
        items,
        idempotencyKey: purchaseOrderPending.current,
      });
      savePendingOperation("nmk.pos.pending-purchase-order.v1", {
        supplierId: Number(selectedSupplierId), locationId: Number(locationId),
        notes: purchaseOrderNotes.trim() || null, items,
        idempotencyKey: purchaseOrderPending.current,
      });
    }
    const payload = purchaseOrderPayload || {
      supplierId: Number(selectedSupplierId),
      locationId: Number(locationId),
      notes: purchaseOrderNotes.trim() || null,
      items: purchaseOrderItems.map((item) => ({
        variantId: Number(item.variantId),
        orderedQuantity: Number(item.orderedQuantity),
        unitCost: Number(item.unitCost),
      })),
      idempotencyKey: purchaseOrderPending.current,
    };
    setProcurementSaving(true);
    onError("");
    try {
      const created = await apiRequest("/admin/procurement/purchase-orders", {
        method: "POST", body: JSON.stringify(payload),
      });
      setPurchaseOrderNotes("");
      setPurchaseOrderItems([{ variantId: "", orderedQuantity: "1", unitCost: "" }]);
      setPurchaseOrderPayload(null);
      purchaseOrderPending.current = null;
      sessionStorage.removeItem("nmk.pos.pending-purchase-order.v1");
      setPurchaseOrderRetry(false);
      await loadProcurement();
      onNotice(`Draft purchase order ${created.orderNumber} created.`);
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      setPurchaseOrderRetry(uncertain);
      if (!uncertain) {
        setPurchaseOrderPayload(null); purchaseOrderPending.current = null;
        sessionStorage.removeItem("nmk.pos.pending-purchase-order.v1");
      }
      onError(`${err.message}${uncertain ? " Retry the exact same draft purchase order; its idempotency key is retained." : ""}`);
    } finally { setProcurementSaving(false); }
  };

  const openPurchaseOrderSubmit = (order) => {
    setProcurementActionError("");
    setPurchaseOrderSubmitPassword("");
    setPurchaseOrderSubmitTarget(order);
  };

  const closePurchaseOrderSubmit = () => {
    if (procurementSaving) return;
    setPurchaseOrderSubmitTarget(null);
    setPurchaseOrderSubmitPassword("");
    setProcurementActionError("");
  };

  const submitPurchaseOrder = async () => {
    if (!purchaseOrderSubmitTarget) return;
    setProcurementSaving(true);
    onError("");
    try {
      const authorizationToken = await authorizePosAction("PURCHASE_ORDER_SUBMIT", purchaseOrderSubmitPassword);
      await apiRequest(`/admin/procurement/purchase-orders/${purchaseOrderSubmitTarget.id}/submit`, {
        method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken },
      });
      const submittedNumber = purchaseOrderSubmitTarget.orderNumber;
      setPurchaseOrderSubmitTarget(null);
      setPurchaseOrderSubmitPassword("");
      await loadProcurement();
      onNotice(`Purchase order ${submittedNumber} submitted to supplier.`);
    } catch (err) { onError(err.message); }
    finally { setProcurementSaving(false); }
  };

  const openGoodsReceipt = (order) => {
    setProcurementActionError("");
    setReceivingOrder(order);
    setGoodsReceiptReason("Supplier delivery checked against purchase order");
    setGoodsReceiptQuantities({});
    setGoodsReceiptRetry(false);
    setGoodsReceiptPassword("");
    setGoodsReceiptPayload(null);
    goodsReceiptPending.current = null;
  };

  const receivePurchaseOrderGoods = async () => {
    if (!receivingOrder || !goodsReceiptReason.trim()) { setProcurementActionError("Goods receipt reason is required."); onError("Goods receipt reason is required."); return; }
    if (!goodsReceiptPayload && stockCountActive) { setProcurementActionError("Inventory is frozen during a physical stock count."); onError("Inventory is frozen during a physical stock count."); return; }
    if (!goodsReceiptPayload) {
      const items = receivingOrder.items
        .filter((item) => Number(goodsReceiptQuantities[item.id] || 0) > 0)
        .map((item) => ({ purchaseOrderItemId: item.id, quantity: Number(goodsReceiptQuantities[item.id]) }));
      if (!items.length) { onError("Enter at least one received quantity."); return; }
      if (items.some((item) => !Number.isInteger(item.quantity))) { onError("Received quantities must be whole numbers."); return; }
      goodsReceiptPending.current = goodsReceiptPending.current || newIdempotencyKey();
      setGoodsReceiptPayload({
        reason: goodsReceiptReason.trim(),
        idempotencyKey: goodsReceiptPending.current,
        items,
      });
      savePendingProcurementAction("nmk.pos.pending-goods-receipt.v1", receivingOrder.id, {
        reason: goodsReceiptReason.trim(), idempotencyKey: goodsReceiptPending.current, items,
      });
    }
    const payload = goodsReceiptPayload || {
      reason: goodsReceiptReason.trim(),
      idempotencyKey: goodsReceiptPending.current,
      items: receivingOrder.items
        .filter((item) => Number(goodsReceiptQuantities[item.id] || 0) > 0)
        .map((item) => ({ purchaseOrderItemId: item.id, quantity: Number(goodsReceiptQuantities[item.id]) })),
    };
    setGoodsReceiptSaving(true);
    onError("");
    try {
      const authorizationToken = await authorizePosAction("GOODS_RECEIPT", goodsReceiptPassword);
      const receipt = await apiRequest(`/admin/procurement/purchase-orders/${receivingOrder.id}/receive`, {
        method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken }, body: JSON.stringify(payload),
      });
      setReceivingOrder(null);
      setGoodsReceiptPayload(null);
      goodsReceiptPending.current = null;
      sessionStorage.removeItem("nmk.pos.pending-goods-receipt.v1");
      pendingGoodsReceiptRecord.current = null;
      setGoodsReceiptRetry(false);
      setGoodsReceiptPassword("");
      setProcurementActionError("");
      await Promise.all([loadProcurement(), onRefreshCatalog()]);
      onNotice(`Goods receipt ${receipt.receiptNumber} saved and stock updated.`);
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      setGoodsReceiptRetry(uncertain);
      setProcurementActionError(`${err.message}${uncertain ? " Retry the exact same receipt; its idempotency key is retained." : ""}`);
      if (!uncertain) {
        setGoodsReceiptPayload(null); goodsReceiptPending.current = null;
        sessionStorage.removeItem("nmk.pos.pending-goods-receipt.v1");
        pendingGoodsReceiptRecord.current = null;
      }
      onError(err.message);
    } finally { setGoodsReceiptSaving(false); }
  };

  const openSupplierReturn = (order) => {
    setProcurementActionError("");
    setSupplierReturnOrder(order);
    setSupplierReturnReason("Goods returned to supplier");
    setSupplierReturnQuantities({});
    setSupplierReturnRetry(false);
    setSupplierReturnPassword("");
    setSupplierReturnPayload(null);
    supplierReturnPending.current = null;
  };

  const returnPurchaseOrderGoods = async () => {
    if (!supplierReturnOrder || !supplierReturnReason.trim()) { setProcurementActionError("Supplier return reason is required."); onError("Supplier return reason is required."); return; }
    if (!supplierReturnPayload && stockCountActive) { setProcurementActionError("Inventory is frozen during a physical stock count."); onError("Inventory is frozen during a physical stock count."); return; }
    if (!supplierReturnPayload) {
      const items = supplierReturnOrder.items
        .filter((item) => Number(supplierReturnQuantities[item.id] || 0) > 0)
        .map((item) => ({ purchaseOrderItemId: item.id, quantity: Number(supplierReturnQuantities[item.id]) }));
      if (!items.length || items.some((item) => !Number.isInteger(item.quantity))) {
        onError("Enter at least one whole supplier return quantity.");
        return;
      }
      supplierReturnPending.current = supplierReturnPending.current || newIdempotencyKey();
      setSupplierReturnPayload({
        reason: supplierReturnReason.trim(),
        idempotencyKey: supplierReturnPending.current,
        items,
      });
      savePendingProcurementAction("nmk.pos.pending-supplier-return.v1", supplierReturnOrder.id, {
        reason: supplierReturnReason.trim(), idempotencyKey: supplierReturnPending.current, items,
      });
    }
    const payload = supplierReturnPayload || {
      reason: supplierReturnReason.trim(),
      idempotencyKey: supplierReturnPending.current,
      items: supplierReturnOrder.items
        .filter((item) => Number(supplierReturnQuantities[item.id] || 0) > 0)
        .map((item) => ({ purchaseOrderItemId: item.id, quantity: Number(supplierReturnQuantities[item.id]) })),
    };
    setSupplierReturnSaving(true);
    onError("");
    try {
      const authorizationToken = await authorizePosAction("SUPPLIER_RETURN", supplierReturnPassword);
      const result = await apiRequest(`/admin/procurement/purchase-orders/${supplierReturnOrder.id}/supplier-returns`, {
        method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken }, body: JSON.stringify(payload),
      });
      setSupplierReturnOrder(null);
      setSupplierReturnPayload(null);
      supplierReturnPending.current = null;
      sessionStorage.removeItem("nmk.pos.pending-supplier-return.v1");
      pendingSupplierReturnRecord.current = null;
      setSupplierReturnRetry(false);
      setSupplierReturnPassword("");
      setProcurementActionError("");
      await Promise.all([loadProcurement(), onRefreshCatalog()]);
      onNotice(`Supplier return ${result.returnNumber} recorded and stock reduced.`);
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      setSupplierReturnRetry(uncertain);
      setProcurementActionError(`${err.message}${uncertain ? " Retry the exact same supplier return; its idempotency key is retained." : ""}`);
      if (!uncertain) {
        setSupplierReturnPayload(null); supplierReturnPending.current = null;
        sessionStorage.removeItem("nmk.pos.pending-supplier-return.v1");
        pendingSupplierReturnRecord.current = null;
      }
      onError(err.message);
    } finally { setSupplierReturnSaving(false); }
  };

  const loadLowStock = useCallback(async () => {
    if (!locationId) { setLowStockAlerts([]); return; }
    setLowStockLoading(true);
    try {
      const data = await apiRequest(`/admin/inventory/low-stock?locationId=${encodeURIComponent(locationId)}`);
      setLowStockAlerts(Array.isArray(data) ? data : []);
    } catch (err) { onError(err.message); }
    finally { setLowStockLoading(false); }
  }, [locationId, onError]);

  const loadMovementHistory = useCallback(async (page = 0) => {
    if (!locationId) {
      setMovementRows([]);
      setMovementPage(0);
      setMovementPages(0);
      return;
    }
    setMovementLoading(true);
    try {
      const variantFilter = movementVariantId
        ? `&variantId=${encodeURIComponent(movementVariantId)}`
        : "";
      const data = await apiRequest(
        `/admin/inventory/movements?locationId=${encodeURIComponent(locationId)}${variantFilter}&page=${page}&size=20`
      );
      setMovementRows(Array.isArray(data?.content) ? data.content : []);
      setMovementPage(Number(data?.number || 0));
      setMovementPages(Number(data?.totalPages || 0));
    } catch (err) {
      onError(err.message);
    } finally {
      setMovementLoading(false);
    }
  }, [locationId, movementVariantId, onError]);

  const updateReorderLevel = async (variantId, currentLevel) => {
    const raw = reorderDrafts[variantId] ?? currentLevel;
    const reorderLevel = Number(raw);
    if (!Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > 1000000) {
      onError("Reorder level must be a whole number from 0 to 1,000,000.");
      return;
    }
    try {
      await apiRequest("/admin/inventory/reorder-level", {
        method: "PATCH",
        body: JSON.stringify({ locationId: Number(locationId), variantId: Number(variantId), reorderLevel }),
      });
      setReorderDrafts((current) => { const next = { ...current }; delete next[variantId]; return next; });
      await Promise.all([onRefreshCatalog(), loadLowStock()]);
      onNotice(reorderLevel === 0 ? "Low stock alert disabled for this variant." : `Reorder alert set to ${reorderLevel} available units.`);
    } catch (err) { onError(err.message); }
  };

  const loadStockCount = useCallback(async () => {
    if (!locationId) { setStockCount(null); return; }
    setStockCountLoading(true);
    try {
      const data = await apiRequest(`/admin/inventory/stock-counts/current?locationId=${encodeURIComponent(locationId)}`);
      setStockCount(data || null);
      setStockCountDrafts({});
    } catch (err) { onError(err.message); }
    finally { setStockCountLoading(false); }
  }, [locationId, onError]);

  const startStockCount = async () => {
    if (!locationId || !stockCountReason.trim()) {
      onError("Enter a reason before starting the physical stock count.");
      return;
    }
    setStockCountSaving(true);
    onError("");
    try {
      const data = await apiRequest("/admin/inventory/stock-counts/start", {
        method: "POST",
        body: JSON.stringify({ locationId: Number(locationId), reason: stockCountReason.trim() }),
      });
      setStockCount(data);
      setStockCountDrafts({});
      setStockCountReason("");
      await onRefreshCatalog();
      onNotice("Physical stock count started. Stock movements are frozen until it is posted or cancelled.");
    } catch (err) {
      onError(err.message);
      await loadStockCount();
    } finally { setStockCountSaving(false); }
  };

  const saveStockCountLine = async (line) => {
    const raw = stockCountDrafts[line.id] ?? line.countedQuantity;
    const countedQuantity = Number(raw);
    if (!Number.isInteger(countedQuantity) || countedQuantity < 0) {
      onError("Counted quantity must be a non-negative whole number.");
      return;
    }
    setStockCountSaving(true);
    onError("");
    try {
      const updated = await apiRequest(`/admin/inventory/stock-counts/${stockCount.id}/lines/${line.id}`, {
        method: "PATCH",
        body: JSON.stringify({ countedQuantity }),
      });
      setStockCount((current) => ({
        ...current,
        lines: current.lines.map((item) => item.id === updated.id ? updated : item),
        countedLineCount: current.lines.filter((item) => item.id === updated.id || item.countedQuantity != null).length,
      }));
      setStockCountDrafts((current) => { const next = { ...current }; delete next[line.id]; return next; });
    } catch (err) { onError(err.message); }
    finally { setStockCountSaving(false); }
  };

  const submitStockCount = async () => {
    if (!stockCount?.id) return;
    setStockCountSaving(true);
    onError("");
    try {
      const data = await apiRequest(`/admin/inventory/stock-counts/${stockCount.id}/submit`, { method: "POST" });
      setStockCount(data);
      onNotice("Stock count submitted for review.");
    } catch (err) { onError(err.message); }
    finally { setStockCountSaving(false); }
  };

  const postStockCount = async () => {
    if (!stockCount?.id) return;
    if (!window.confirm("Post all stock count variances? This will create permanent stock ledger movements.")) return;
    setStockCountSaving(true);
    onError("");
    try {
      const authorizationToken = await authorizePosAction("STOCK_COUNT_POST", stockCountPostPassword);
      const data = await apiRequest(`/admin/inventory/stock-counts/${stockCount.id}/post`, { method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken } });
      setStockCount(data);
      setStockCountDrafts({});
      setStockCountPostPassword("");
      await onRefreshCatalog();
      onNotice(`Stock count #${data.id} posted. ${data.varianceLineCount} stock variances were applied.`);
    } catch (err) { onError(err.message); }
    finally { setStockCountSaving(false); }
  };

  const cancelStockCount = async () => {
    if (!stockCount?.id || !window.confirm("Cancel this stock count and unfreeze inventory? No stock adjustments will be posted.")) return;
    setStockCountSaving(true);
    onError("");
    try {
      const authorizationToken = await authorizePosAction("STOCK_COUNT_CANCEL", stockCountCancelPassword);
      const data = await apiRequest(`/admin/inventory/stock-counts/${stockCount.id}/cancel`, { method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken } });
      setStockCount(data);
      setStockCountDrafts({});
      setStockCountCancelPassword("");
      await onRefreshCatalog();
      onNotice("Stock count cancelled. Inventory operations are available again.");
    } catch (err) { onError(err.message); }
    finally { setStockCountSaving(false); }
  };

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      // Admin product listing is paginated by Spring Data. Load every page so
      // POS inventory can select any catalogue product, not just the first 100.
      let page = 0;
      let totalPages = 1;
      const rows = [];
      do {
        const data = await apiRequest(`/admin/products?page=${page}&size=100`);
        if (Array.isArray(data)) {
          rows.push(...data);
          totalPages = 1;
        } else {
          rows.push(...(Array.isArray(data?.content) ? data.content : []));
          totalPages = Math.max(1, Number(data?.totalPages) || 1);
        }
        page += 1;
      } while (page < totalPages);
      const list = rows.filter((product) => product.active !== false);
      setProducts(list);
      setSelectedProductId((current) => current && list.some((p) => String(p.id) === String(current))
        ? current : (list[0]?.id ? String(list[0].id) : ""));
    } catch (err) { onError(err.message); }
    finally { setProductsLoading(false); }
  }, [onError]);

  const loadVariants = useCallback(async (productId) => {
    if (!productId) { setVariants([]); return; }
    setVariantsLoading(true);
    try {
      const data = await apiRequest(`/admin/products/${productId}/variants`);
      const list = Array.isArray(data) ? data : [];
      setVariants(list);
      setSelectedVariantId((current) => current && list.some((v) => String(v.id) === String(current) && v.active)
        ? current : (list.find((v) => v.active)?.id ? String(list.find((v) => v.active).id) : ""));
    } catch (err) { onError(err.message); }
    finally { setVariantsLoading(false); }
  }, [onError]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (selectedProductId) loadVariants(selectedProductId); else setVariants([]); }, [selectedProductId, loadVariants]);
  useEffect(() => { loadStockCount(); }, [loadStockCount]);
  useEffect(() => { loadLowStock(); }, [loadLowStock]);
  useEffect(() => { loadMovementHistory(0); }, [loadMovementHistory]);
  useEffect(() => { loadProcurement(); }, [loadProcurement]);
  useEffect(() => {
    if (supplierBillPayload?.supplierId) {
      setSelectedSupplierId(String(supplierBillPayload.supplierId));
      setSupplierBillForm({
        invoiceNumber: supplierBillPayload.invoiceNumber || "",
        invoiceDate: supplierBillPayload.invoiceDate || "",
        dueDate: supplierBillPayload.dueDate || "",
        amount: String(supplierBillPayload.amount || ""),
        billType: supplierBillPayload.billType || "GOODS",
        purchaseOrderId: supplierBillPayload.purchaseOrderId ? String(supplierBillPayload.purchaseOrderId) : "",
      });
    }
  }, [supplierBillPayload]);
  useEffect(() => {
    if (pendingSupplierPaymentRecord.current?.supplierId) {
      setSelectedSupplierId(String(pendingSupplierPaymentRecord.current.supplierId));
    }
    if (pendingSupplierCreditNoteRecord.current?.supplierId) {
      setSelectedSupplierId(String(pendingSupplierCreditNoteRecord.current.supplierId));
    }
  }, []);
  useEffect(() => {
    if (selectedSupplierId && staffRole === "ADMIN") {
      loadSupplierBills();
      loadSupplierPayablesAging();
    }
  }, [selectedSupplierId, staffRole, loadSupplierBills, loadSupplierPayablesAging]);
  useEffect(() => {
    if (!purchaseOrderPayload) return;
    setSelectedSupplierId(String(purchaseOrderPayload.supplierId));
    setLocationId(String(purchaseOrderPayload.locationId));
    setPurchaseOrderNotes(purchaseOrderPayload.notes || "");
    setPurchaseOrderItems(purchaseOrderPayload.items.map((item) => ({
      variantId: String(item.variantId),
      orderedQuantity: String(item.orderedQuantity),
      unitCost: String(item.unitCost),
    })));
  }, [purchaseOrderPayload]);


  const updateVariantForm = (field, value) => setVariantForm((current) => ({ ...current, [field]: value }));

  const createVariant = async (event) => {
    event.preventDefault();
    onError("");
    if (stockCountActive) { onError("Cancel or post the active stock count before changing the catalogue."); return; }
    if (!selectedProductId) { onError("Choose a product before creating a variant."); return; }
    let attributes;
    try {
      attributes = variantForm.attributes.trim() ? JSON.parse(variantForm.attributes) : {};
      if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
        throw new Error("Attributes must be a JSON object.");
      }
    } catch (err) { onError(err.message || "Enter valid JSON attributes."); return; }
    const body = {
      sku: variantForm.sku.trim(),
      barcode: variantForm.barcode.trim() || null,
      variantName: variantForm.variantName.trim(),
      attributes,
      ...(variantForm.sellingPriceOverride.trim()
        ? { sellingPriceOverride: Number(variantForm.sellingPriceOverride) } : {}),
    };
    setVariantSaving(true);
    try {
      const created = await apiRequest(`/admin/products/${selectedProductId}/variants`, {
        method: "POST", body: JSON.stringify(body)
      });
      setVariantForm({ sku: "", barcode: "", variantName: "", attributes: '{"color":"Black","size":"Medium"}', sellingPriceOverride: "" });
      await loadVariants(selectedProductId);
      if (created?.id) setSelectedVariantId(String(created.id));
      await onRefreshCatalog();
      onNotice(`Variant ${created?.sku || body.sku} created.`);
    } catch (err) { onError(err.message); }
    finally { setVariantSaving(false); }
  };

  const receiveStock = async (event) => {
    event.preventDefault();
    onError("");
    if (!receiptPayload.current && stockCountActive) { onError("Inventory is frozen while a physical stock count is active."); return; }
    if (!receiptPayload.current && !locationId) { onError("Choose an active inventory location."); return; }
    if (!receiptPayload.current && !selectedVariantId) { onError("Create or select an active variant first."); return; }
    if (!receiptPayload.current && (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0)) {
      onError("Stock quantity must be a positive whole number."); return;
    }
    if (!receiptPayload.current && !reason.trim()) { onError("A stock receipt reason is required."); return; }

    if (!receiptPayload.current) {
      receiptPayload.current = {
        locationId: Number(locationId),
        variantId: Number(selectedVariantId),
        quantity: Number(quantity),
        idempotencyKey: newIdempotencyKey(),
        reason: reason.trim(),
      };
      savePendingOperation("nmk.pos.pending-inventory-receipt.v1", receiptPayload.current);
    }
    setReceiptSaving(true);
    try {
      const authorizationToken = await authorizePosAction("INVENTORY_RECEIPT", receiptPassword);
      const result = await apiRequest("/admin/inventory/receive", {
        method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken }, body: JSON.stringify(receiptPayload.current)
      });
      receiptPayload.current = null;
      sessionStorage.removeItem("nmk.pos.pending-inventory-receipt.v1");
      setReceiptRetry(false);
      setReceiptPassword("");
      setQuantity("1");
      await onRefreshCatalog();
      onNotice(`Stock received. Available quantity is now ${result.availableQuantity}.`);
    } catch (err) {
      if (!err.status || err.status >= 500 || err.status === 409) {
        setReceiptRetry(true);
        onError(`${err.message} Retry this exact receipt to safely reuse its idempotency key.`);
      } else {
        receiptPayload.current = null;
        sessionStorage.removeItem("nmk.pos.pending-inventory-receipt.v1");
        setReceiptRetry(false);
        onError(err.message);
      }
    } finally { setReceiptSaving(false); }
  };

  const adjustStock = async (event) => {
    event.preventDefault();
    onError("");
    const delta = Number(adjustmentDelta);
    if (!adjustmentPayload.current && stockCountActive) { onError("Inventory is frozen while a physical stock count is active."); return; }
    if (!adjustmentPayload.current && !locationId) { onError("Choose an active inventory location."); return; }
    if (!adjustmentPayload.current && !selectedVariantId) { onError("Choose an active variant before adjusting stock."); return; }
    if (!adjustmentPayload.current && (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000000)) {
      onError("Adjustment must be a non-zero whole number between -1,000,000 and 1,000,000.");
      return;
    }
    if (!adjustmentPayload.current && !adjustmentReason.trim()) { onError("A stock adjustment reason is required."); return; }

    if (!adjustmentPayload.current) {
      adjustmentPayload.current = {
        locationId: Number(locationId),
        variantId: Number(selectedVariantId),
        quantityDelta: delta,
        idempotencyKey: newIdempotencyKey(),
        reason: adjustmentReason.trim(),
      };
      savePendingOperation("nmk.pos.pending-inventory-adjustment.v1", adjustmentPayload.current);
    }
    setAdjustmentSaving(true);
    try {
      const authorizationToken = await authorizePosAction("INVENTORY_ADJUSTMENT", adjustmentPassword);
      const result = await apiRequest("/admin/inventory/adjust", {
        method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken }, body: JSON.stringify(adjustmentPayload.current)
      });
      adjustmentPayload.current = null;
      sessionStorage.removeItem("nmk.pos.pending-inventory-adjustment.v1");
      setAdjustmentRetry(false);
      setAdjustmentPassword("");
      setAdjustmentDelta("0");
      await onRefreshCatalog();
      onNotice(`Stock adjusted. On hand: ${result.onHandQuantity}; available: ${result.availableQuantity}.`);
    } catch (err) {
      if (!err.status || err.status >= 500 || err.status === 409) {
        setAdjustmentRetry(true);
        onError(`${err.message} Retry the exact same adjustment to safely reuse its idempotency key.`);
      } else {
        adjustmentPayload.current = null;
        sessionStorage.removeItem("nmk.pos.pending-inventory-adjustment.v1");
        setAdjustmentRetry(false);
        onError(err.message);
      }
    } finally { setAdjustmentSaving(false); }
  };

  const selectedProduct = products.find((product) => String(product.id) === String(selectedProductId));
  const stockRows = catalog.find((product) => String(product.productId) === String(selectedProductId))?.variants || [];
  const procurementVariants = catalog.flatMap((product) => (product.variants || []).map((variant) => ({
    ...variant, productName: product.name,
  })));

  return (
    <section className="pos-inventory-workspace">
      <div className="pos-inventory-intro">
        <div><span className="pos-eyebrow">CATALOGUE & STOCK CONTROL</span><h2>Inventory setup</h2><p>Create sellable variants and receive physical stock into the selected store location.</p></div>
        <button type="button" className="pos-button secondary compact" onClick={() => { loadProducts(); onRefreshCatalog(); }} disabled={productsLoading || variantsLoading}><RefreshCw size={15} /> Refresh inventory</button>
      </div>
      <section className="pos-inventory-card pos-stock-count-card">
        <div className="pos-inventory-card-heading"><ClipboardCheck size={18} /><div><h3>Physical stock count</h3><p>Freeze stock movements, count every sellable variant and post verified variances to the stock ledger.</p></div></div>
        {stockCountLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Checking active stock count…</span></div>
          : !stockCount ? (
            <div className="pos-stock-count-start">
              <label>Reason for count<input value={stockCountReason} onChange={(event) => setStockCountReason(event.target.value)} maxLength={400} placeholder="Monthly physical inventory count" /></label>
              <button type="button" className="pos-button primary" onClick={startStockCount} disabled={stockCountSaving || !locationId || !stockCountReason.trim()}>
                {stockCountSaving ? "Starting…" : "Start physical count"}
              </button>
            </div>
          ) : (
            <>
              <div className="pos-stock-count-summary">
                <span>Session #{stockCount.id} · {stockCount.status.replaceAll("_", " ")}</span>
                <strong>{stockCount.countedLineCount} / {stockCount.lineCount} counted · {stockCount.varianceLineCount} variances</strong>
              </div>
              {stockCount.status === "POSTED" && <p className="pos-retry-note">Posted by {stockCount.postedByUsername || "—"} · {stockCount.postedAt ? new Date(stockCount.postedAt).toLocaleString("en-IN") : "time unavailable"}</p>}
              {stockCount.status === "CANCELLED" && <p className="pos-retry-note">Cancelled by {stockCount.cancelledByUsername || "—"} · {stockCount.cancelledAt ? new Date(stockCount.cancelledAt).toLocaleString("en-IN") : "time unavailable"}</p>}
              <div className="pos-stock-count-table">
                <table><thead><tr><th>Product / SKU</th><th>Expected</th><th>Counted</th><th>Variance</th><th></th></tr></thead>
                  <tbody>{stockCount.lines.map((line) => <tr key={line.id}>
                    <td><strong>{line.productName}</strong><small>{line.variantName} · {line.sku}</small></td>
                    <td>{line.snapshotOnHand}</td>
                    <td>{stockCount.status === "COUNTING"
                      ? <>
                          <input type="number" min="0" step="1" value={stockCountDrafts[line.id] ?? (line.countedQuantity ?? "")}
                            onChange={(event) => setStockCountDrafts((current) => ({ ...current, [line.id]: event.target.value }))}
                            disabled={stockCountSaving || Boolean(line.countedByUsername && line.countedByUsername.toLowerCase() !== currentStaffUsername.toLowerCase())} />
                          {line.countedByUsername && <small>Counted by {line.countedByUsername}</small>}
                        </>
                      : <>{line.countedQuantity}{line.countedByUsername && <small>Counted by {line.countedByUsername}</small>}</>}</td>
                    <td>{line.variance == null ? "—" : <strong className={line.variance === 0 ? "" : line.variance > 0 ? "pos-count-positive" : "pos-count-negative"}>{line.variance > 0 ? "+" : ""}{line.variance}</strong>}</td>
                    <td>{stockCount.status === "COUNTING" && <button type="button" className="pos-button secondary compact" onClick={() => saveStockCountLine(line)} disabled={stockCountSaving || stockCountDrafts[line.id] == null || Boolean(line.countedByUsername && line.countedByUsername.toLowerCase() !== currentStaffUsername.toLowerCase())}>Save</button>}</td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="pos-stock-count-actions">
                {stockCount.status === "READY_FOR_REVIEW" && <label className="pos-action-password">Password to post
                  <input type="password" autoComplete="current-password" value={stockCountPostPassword}
                    onChange={(event) => setStockCountPostPassword(event.target.value)} disabled={stockCountSaving} />
                </label>}
                {stockCountActive && <label className="pos-action-password">Password to cancel
                  <input type="password" autoComplete="current-password" value={stockCountCancelPassword}
                    onChange={(event) => setStockCountCancelPassword(event.target.value)} disabled={stockCountSaving} />
                </label>}
                {stockCount.status === "COUNTING" && <button type="button" className="pos-button primary" onClick={submitStockCount} disabled={stockCountSaving || stockCount.countedLineCount !== stockCount.lineCount}>Submit for review</button>}
                {stockCount.status === "READY_FOR_REVIEW" && <button type="button" className="pos-button primary" onClick={postStockCount} disabled={stockCountSaving || currentStaffPreparedCount || !stockCountPostPassword.trim()}>Post stock variances</button>}
                {stockCountActive && <button type="button" className="pos-button secondary" onClick={cancelStockCount} disabled={stockCountSaving || !stockCountCancelPassword.trim()}>Cancel count</button>}
                {["POSTED", "CANCELLED"].includes(stockCount.status) && <button type="button" className="pos-button secondary" onClick={() => setStockCount(null)}>Start another count</button>}
              </div>
              {stockCount.status === "READY_FOR_REVIEW" && (
                <p className="pos-retry-note">
                  {currentStaffPreparedCount
                    ? "You started, counted or submitted this session. A different manager or administrator must review and post it."
                    : `Submitted by ${stockCount.submittedByUsername || "staff"}. You can independently review and post this count.`}
                </p>
              )}
              <p className="pos-retry-note">Stock receiving, adjustments, online reservations and POS sales are blocked until this count is posted or cancelled.</p>
            </>
          )}
      </section>

      <section className="pos-inventory-card pos-procurement-card">
        <div className="pos-inventory-card-heading"><Truck size={18} /><div><h3>Supplier procurement</h3><p>Create purchase orders, receive partial deliveries and return goods to suppliers with stock ledger references.</p></div>
          <button type="button" className="pos-button secondary compact" onClick={loadProcurement} disabled={procurementLoading}><RefreshCw size={14} /> Refresh</button>
        </div>
        <div className="pos-procurement-grid">
          <form className="pos-procurement-form" onSubmit={createSupplier}>
            <h4>Add supplier</h4>
            <label>Supplier name<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} maxLength={200} required placeholder="Supplier business name" /></label>
            <div className="pos-inventory-fields">
              <label>Contact person<input value={supplierContact} onChange={(event) => setSupplierContact(event.target.value)} maxLength={120} placeholder="Optional" /></label>
              <label>Phone<input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} maxLength={30} placeholder="Optional" /></label>
              <label>Email<input type="email" value={supplierEmail} onChange={(event) => setSupplierEmail(event.target.value)} maxLength={160} placeholder="Optional" /></label>
              <label>Address<input value={supplierAddress} onChange={(event) => setSupplierAddress(event.target.value)} maxLength={500} placeholder="Optional" /></label>
            </div>
            <button type="submit" className="pos-button secondary" disabled={procurementSaving}>{procurementSaving ? "Saving…" : "Save supplier"}</button>
          </form>

          <form className="pos-procurement-form" onSubmit={createPurchaseOrder}>
            <h4>Create purchase order</h4>
            <label>Supplier<select value={selectedSupplierId} onChange={(event) => setSelectedSupplierId(event.target.value)} disabled={purchaseOrderRetry} required>
              <option value="">Choose active supplier</option>
              {suppliers.filter((supplier) => supplier.active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select></label>
            {supplierHasMore && <button type="button" className="pos-button secondary compact" onClick={loadMoreSuppliers} disabled={procurementMoreLoading || purchaseOrderRetry}>{procurementMoreLoading ? "Loading…" : "Load more suppliers"}</button>}
            <label>Order notes<input value={purchaseOrderNotes} onChange={(event) => setPurchaseOrderNotes(event.target.value)} maxLength={500} placeholder="Optional delivery or reference notes" disabled={purchaseOrderRetry} /></label>
            <div className="pos-po-lines">
              {purchaseOrderItems.map((item, index) => <div className="pos-po-line" key={index}>
                <label>Variant<select value={item.variantId} onChange={(event) => setPurchaseOrderItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, variantId: event.target.value } : line))} disabled={purchaseOrderRetry} required>
                  <option value="">Select SKU</option>
                  {procurementVariants.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.productName} · {variant.variantName} · {variant.sku}</option>)}
                </select></label>
                <label>Qty<input type="number" min="1" step="1" value={item.orderedQuantity} onChange={(event) => setPurchaseOrderItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, orderedQuantity: event.target.value } : line))} disabled={purchaseOrderRetry} required /></label>
                <label>Unit cost (₹)<input type="number" min="0.01" step="0.01" value={item.unitCost} onChange={(event) => setPurchaseOrderItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, unitCost: event.target.value } : line))} disabled={purchaseOrderRetry} required /></label>
                <button type="button" className="pos-remove-button" onClick={() => setPurchaseOrderItems((current) => current.filter((_, lineIndex) => lineIndex !== index))} disabled={purchaseOrderItems.length <= 1 || purchaseOrderRetry} aria-label="Remove purchase order line"><X size={15} /></button>
              </div>)}
            </div>
            <div className="pos-procurement-form-actions">
              <button type="button" className="pos-button secondary compact" onClick={() => setPurchaseOrderItems((current) => [...current, { variantId: "", orderedQuantity: "1", unitCost: "" }])} disabled={purchaseOrderRetry}>Add line</button>
              <button type="submit" className="pos-button primary" disabled={procurementSaving || !selectedSupplierId || !locationId}>{procurementSaving ? "Creating…" : purchaseOrderRetry ? "Retry same draft PO" : "Create draft PO"}</button>
            </div>
          </form>
        </div>

        {staffRole === "ADMIN" && <section className="pos-supplier-accounting">
          <div className="pos-panel-heading"><div><h4>Supplier accounts payable</h4><p>Post supplier invoices, record authorized payments and inspect receipt-level landed-cost allocations.</p></div>
            <button type="button" className="pos-button secondary compact" onClick={() => { loadSupplierBills(); loadSupplierPayablesAging(); }} disabled={supplierBillsLoading || supplierPayablesAgingLoading}><RefreshCw size={14} /> Refresh bills</button>
          </div>
          <div className="pos-supplier-accounting-grid">
            <form className="pos-procurement-form" onSubmit={submitSupplierBill}>
              <h5>Post supplier bill</h5>
              <label>Supplier<select value={selectedSupplierId} onChange={(event) => setSelectedSupplierId(event.target.value)} disabled={Boolean(supplierBillPayload)} required>
                <option value="">Choose supplier</option>
                {suppliers.filter((supplier) => supplier.active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select></label>
              <label>Bill type<select value={supplierBillForm.billType} onChange={(event) => setSupplierBillForm((current) => ({ ...current, billType: event.target.value, purchaseOrderId: "" }))} disabled={Boolean(supplierBillPayload)}>
                <option value="GOODS">Goods invoice</option><option value="LANDED_COST">Direct landed cost</option><option value="OTHER">Other supplier expense</option>
              </select></label>
              {supplierBillForm.billType !== "OTHER" && <label>Purchase order<select value={supplierBillForm.purchaseOrderId} onChange={(event) => setSupplierBillForm((current) => ({ ...current, purchaseOrderId: event.target.value }))} disabled={Boolean(supplierBillPayload)} required>
                <option value="">Choose received purchase order</option>
                {purchaseOrders.filter((order) => String(order.supplierId) === String(selectedSupplierId) && ["PARTIALLY_RECEIVED", "RECEIVED"].includes(order.status)).map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.status}</option>)}
              </select></label>}
              <label>Supplier invoice number<input value={supplierBillForm.invoiceNumber} onChange={(event) => setSupplierBillForm((current) => ({ ...current, invoiceNumber: event.target.value }))} maxLength={100} required disabled={Boolean(supplierBillPayload)} /></label>
              <div className="pos-inventory-fields">
                <label>Invoice date<input type="date" value={supplierBillForm.invoiceDate} onChange={(event) => setSupplierBillForm((current) => ({ ...current, invoiceDate: event.target.value }))} required disabled={Boolean(supplierBillPayload)} /></label>
                <label>Due date<input type="date" value={supplierBillForm.dueDate} onChange={(event) => setSupplierBillForm((current) => ({ ...current, dueDate: event.target.value }))} disabled={Boolean(supplierBillPayload)} /></label>
                <label>Bill amount (₹)<input type="number" min="0.01" step="0.01" value={supplierBillForm.amount} onChange={(event) => setSupplierBillForm((current) => ({ ...current, amount: event.target.value }))} required disabled={Boolean(supplierBillPayload)} /></label>
              </div>
              <label className="pos-action-password">Administrator password
                <input type="password" autoComplete="current-password" value={supplierBillPassword} onChange={(event) => setSupplierBillPassword(event.target.value)} disabled={supplierBillSaving} />
              </label>
              <button type="submit" className="pos-button primary" disabled={supplierBillSaving || !selectedSupplierId || !supplierBillPassword.trim()}>
                {supplierBillSaving ? "Posting…" : supplierBillPayload ? "Retry same bill" : "Post supplier bill"}
              </button>
              {supplierBillPayload && <p className="pos-retry-note">Pending retry: {supplierBillPayload.invoiceNumber} · {money(supplierBillPayload.amount)}. Retry the exact same details; editing is locked to prevent duplicate invoices.</p>}
            </form>
            <div className="pos-supplier-bills">
              <h5>Supplier bills · {suppliers.find((supplier) => String(supplier.id) === String(selectedSupplierId))?.name || "Select a supplier"}</h5>
              {supplierPayablesAgingLoading ? <p>Calculating AP aging…</p> : supplierPayablesAging && <div className="pos-supplier-aging-summary">
                <article><span>Total outstanding</span><strong>{money(supplierPayablesAging.totalOutstanding)}</strong><small>{supplierPayablesAging.openBillCount} open bills</small></article>
                <article><span>Not due</span><strong>{money(supplierPayablesAging.notDue)}</strong></article>
                <article><span>1–30 days overdue</span><strong>{money(supplierPayablesAging.overdue1To30Days)}</strong></article>
                <article><span>31–60 days overdue</span><strong>{money(supplierPayablesAging.overdue31To60Days)}</strong></article>
                <article><span>61–90 days overdue</span><strong>{money(supplierPayablesAging.overdue61To90Days)}</strong></article>
                <article><span>Over 90 days overdue</span><strong>{money(supplierPayablesAging.overdueOver90Days)}</strong><small>{supplierPayablesAging.overdueBillCount} overdue bills</small></article>
              </div>}
              {supplierBillsLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading supplier bills…</span></div>
                : !supplierBills.length ? <div className="pos-empty-state"><FileText /><span>No supplier bills recorded for this supplier.</span></div>
                  : supplierBills.map((bill) => <article className="pos-supplier-bill-card" key={bill.id}>
                    <div><strong>{bill.invoiceNumber}</strong><span>{bill.billType.replaceAll("_", " ")} · Invoice {bill.invoiceDate} · Due {bill.dueDate || "on receipt"}</span></div>
                    <div className="pos-supplier-bill-totals"><span>Bill {money(bill.amount)}</span><span>Paid {money(bill.paidAmount)}</span><span>Credited {money(bill.creditedAmount)}</span><strong>Due {money(bill.outstandingAmount)}</strong></div>
                    <div className="pos-procurement-form-actions">
                      <button type="button" className="pos-button secondary compact" onClick={() => loadSupplierPaymentHistory(bill.id)}>Payment history</button>
                      <button type="button" className="pos-button secondary compact" onClick={() => loadSupplierCreditNotes(bill.id)}>Credit notes</button>
                      {bill.billType === "LANDED_COST" && <button type="button" className="pos-button secondary compact" onClick={() => loadLandedCostAllocations(bill.id)}>View allocations</button>}
                      {Number(bill.outstandingAmount) > 0 && <>
                        <button type="button" className="pos-button secondary compact" onClick={() => beginSupplierCreditNote(bill)}>Record credit note</button>
                        <button type="button" className="pos-button primary compact" onClick={() => beginSupplierPayment(bill)}>Record payment</button>
                      </>}
                    </div>
                  </article>)}
              {supplierPaymentHistoryBillId && <div className="pos-supplier-payment-history">
                <h5>Payment history · Bill #{supplierPaymentHistoryBillId}</h5>
                {supplierPaymentHistoryLoading ? <p>Loading payments…</p> : !supplierPaymentHistory.length
                  ? <p>No confirmed payments recorded.</p>
                  : <div className="pos-history-table-wrap"><table className="pos-history-table">
                    <thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Reference</th><th>Recorded by</th></tr></thead>
                    <tbody>{supplierPaymentHistory.map((payment) => <tr key={payment.id}>
                      <td>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN") : "—"}</td>
                      <td>{payment.paymentMethod}</td><td>{money(payment.amount)}</td><td>{payment.reference || (payment.shiftId ? `Cash shift #${payment.shiftId}` : "—")}</td><td>{payment.createdByUsername}</td>
                    </tr>)}</tbody>
                  </table></div>}
              </div>}
              {supplierCreditNotesBillId && <div className="pos-supplier-payment-history">
                <h5>Credit notes · Bill #{supplierCreditNotesBillId}</h5>
                {supplierCreditNotesLoading ? <p>Loading credit notes…</p> : !supplierCreditNotes.length
                  ? <p>No credit notes recorded.</p>
                  : <div className="pos-history-table-wrap"><table className="pos-history-table">
                    <thead><tr><th>Date</th><th>Credit note</th><th>Amount</th><th>Reason</th><th>Supplier return</th></tr></thead>
                    <tbody>{supplierCreditNotes.map((note) => <tr key={note.id}>
                      <td>{note.issueDate}</td><td>{note.creditNoteNumber}</td><td>{money(note.amount)}</td><td>{note.reason}</td><td>{note.supplierReturnNumber || "—"}</td>
                    </tr>)}</tbody>
                  </table></div>}
              </div>}
            </div>
          </div>
          {supplierCreditNoteTarget && <form className="pos-supplier-payment-form" onSubmit={submitSupplierCreditNote}>
            <h5>Record supplier credit note · {supplierCreditNoteTarget.invoiceNumber} · Outstanding {money(supplierCreditNoteTarget.outstandingAmount)}</h5>
            <div className="pos-inventory-fields">
              <label>Credit note number<input value={supplierCreditNoteForm.creditNoteNumber} onChange={(event) => setSupplierCreditNoteForm((current) => ({ ...current, creditNoteNumber: event.target.value }))} maxLength={100} disabled={Boolean(supplierCreditNotePayload)} required /></label>
              <label>Issue date<input type="date" value={supplierCreditNoteForm.issueDate} onChange={(event) => setSupplierCreditNoteForm((current) => ({ ...current, issueDate: event.target.value }))} disabled={Boolean(supplierCreditNotePayload)} required /></label>
              <label>Credit amount (₹)<input type="number" min="0.01" max={supplierCreditNoteTarget.outstandingAmount} step="0.01" value={supplierCreditNoteForm.amount} onChange={(event) => setSupplierCreditNoteForm((current) => ({ ...current, amount: event.target.value }))} disabled={Boolean(supplierCreditNotePayload)} required /></label>
              <label>Supplier return ID (optional)<input type="number" min="1" value={supplierCreditNoteForm.supplierReturnId} onChange={(event) => setSupplierCreditNoteForm((current) => ({ ...current, supplierReturnId: event.target.value }))} disabled={Boolean(supplierCreditNotePayload)} /></label>
            </div>
            <label>Reason<input value={supplierCreditNoteForm.reason} onChange={(event) => setSupplierCreditNoteForm((current) => ({ ...current, reason: event.target.value }))} maxLength={500} disabled={Boolean(supplierCreditNotePayload)} required /></label>
            <label className="pos-action-password">Administrator password
              <input type="password" autoComplete="current-password" value={supplierCreditNotePassword} onChange={(event) => setSupplierCreditNotePassword(event.target.value)} disabled={supplierCreditNoteSaving} />
            </label>
            <div className="pos-procurement-form-actions">
              <button type="button" className="pos-button secondary" onClick={() => { setSupplierCreditNoteTarget(null); setSupplierCreditNotePayload(null); pendingSupplierCreditNoteRecord.current = null; sessionStorage.removeItem("nmk.pos.pending-supplier-credit-note.v1"); }} disabled={supplierCreditNoteSaving || Boolean(supplierCreditNotePayload)}>Cancel</button>
              <button type="submit" className="pos-button primary" disabled={supplierCreditNoteSaving || !supplierCreditNotePassword.trim()}>{supplierCreditNoteSaving ? "Saving…" : supplierCreditNotePayload ? "Retry same credit note" : "Confirm credit note"}</button>
            </div>
            {supplierCreditNotePayload && <p className="pos-retry-note">A credit-note request is pending. Retry the exact same details to avoid duplicate credits.</p>}
          </form>}
          {supplierPaymentTarget && <form className="pos-supplier-payment-form" onSubmit={submitSupplierPayment}>
            <h5>Record payment · {supplierPaymentTarget.invoiceNumber} · Outstanding {money(supplierPaymentTarget.outstandingAmount)}</h5>
            <div className="pos-inventory-fields">
              <label>Payment amount (₹)<input type="number" min="0.01" max={supplierPaymentTarget.outstandingAmount} step="0.01" value={supplierPaymentAmount} onChange={(event) => setSupplierPaymentAmount(event.target.value)} disabled={Boolean(supplierPaymentPayload)} required /></label>
              <label>Method<select value={supplierPaymentMethod} onChange={(event) => setSupplierPaymentMethod(event.target.value)} disabled={Boolean(supplierPaymentPayload)}>
                <option value="BANK">Bank transfer</option><option value="UPI">UPI</option><option value="CASH">Cash from open drawer</option><option value="OTHER">Other</option>
              </select></label>
              {supplierPaymentMethod !== "CASH" && <label>Payment reference<input value={supplierPaymentReference} onChange={(event) => setSupplierPaymentReference(event.target.value)} maxLength={160} disabled={Boolean(supplierPaymentPayload)} required /></label>}
            </div>
            {supplierPaymentMethod === "CASH" && <p className="pos-report-note">{shift?.status === "OPEN" ? `Cash payment will be recorded as an OUT movement in shift #${shift.id}.` : "A register shift must be open before a supplier cash payment can be recorded."}</p>}
            <label className="pos-action-password">Administrator password
              <input type="password" autoComplete="current-password" value={supplierPaymentPassword} onChange={(event) => setSupplierPaymentPassword(event.target.value)} disabled={supplierPaymentSaving} />
            </label>
            <div className="pos-procurement-form-actions">
              <button type="button" className="pos-button secondary" onClick={() => { setSupplierPaymentTarget(null); setSupplierPaymentPayload(null); pendingSupplierPaymentRecord.current = null; sessionStorage.removeItem("nmk.pos.pending-supplier-payment.v1"); }} disabled={supplierPaymentSaving || Boolean(supplierPaymentPayload)}>Cancel</button>
              <button type="submit" className="pos-button primary" disabled={supplierPaymentSaving || !supplierPaymentPassword.trim() || (supplierPaymentMethod === "CASH" && shift?.status !== "OPEN")}>{supplierPaymentSaving ? "Saving…" : supplierPaymentPayload ? "Retry same payment" : "Confirm payment"}</button>
            </div>
            {supplierPaymentPayload && <p className="pos-retry-note">A payment request is pending. Retry the exact same payment to avoid duplicate cash movement.</p>}
          </form>}
          {landedCostBillId && <section className="pos-supplier-landed-costs">
            <div className="pos-panel-heading"><h5>Landed-cost allocation · Bill #{landedCostBillId}</h5><button type="button" className="pos-button secondary compact" onClick={() => { setLandedCostBillId(null); setLandedCostAllocations([]); }}>Close</button></div>
            {landedCostLoading ? <p>Loading allocations…</p> : <div className="pos-history-table-wrap"><table className="pos-history-table">
              <thead><tr><th>SKU</th><th>Received qty</th><th>Base goods value</th><th>Allocated cost</th><th>Derived landed unit cost</th></tr></thead>
              <tbody>{landedCostAllocations.map((row) => <tr key={row.id}><td>{row.sku}</td><td>{row.receivedQuantity}</td><td>{money(row.baseGoodsValue)}</td><td>{money(row.allocatedAmount)}</td><td>{money(row.landedUnitCost)}</td></tr>)}</tbody>
            </table></div>}
          </section>}
          <p className="pos-report-note">Customer accounts receivable is disabled because POS sales must be fully paid. Landed-cost allocations are receipt-level records only; they do not yet update weighted-average inventory valuation or COGS. Supplier credit notes can be recorded against unpaid bill balances; unallocated supplier credits on fully paid bills and bank-statement reconciliation are not yet supported.</p>
        </section>}
        <div className="pos-procurement-orders">
          <div className="pos-panel-heading"><div><h4>Purchase orders</h4><p>Orders for the selected store location.</p></div></div>
          {procurementLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading purchase orders…</span></div>
            : purchaseOrders.filter((order) => String(order.locationId) === String(locationId)).length === 0
              ? <div className="pos-empty-state"><Truck /><strong>No purchase orders yet</strong><span>Create a supplier and draft order above.</span></div>
              : purchaseOrders.filter((order) => String(order.locationId) === String(locationId)).map((order) => (
                <article className="pos-po-card" key={order.id}>
                  <div className="pos-po-card-heading">
                    <div><strong>{order.orderNumber}</strong><span>{order.supplierName} · {order.locationName}</span></div>
                    <div><span className={`pos-po-status ${order.status.toLowerCase().replaceAll("_", "-")}`}>{order.status.replaceAll("_", " ")}</span><strong>{money(order.subtotal)}</strong></div>
                  </div>
                  <details className="pos-po-details">
                    <summary>{order.items.length} SKU lines · View quantities</summary>
                    <div className="pos-po-detail-lines">{order.items.map((item) => <div key={item.id}>
                      <span><strong>{item.productName}</strong><small>{item.variantName} · {item.sku}</small></span>
                      <span>Ordered {item.orderedQuantity}</span><span>Received {item.receivedQuantity}</span><span>Returned {item.returnedQuantity}</span>
                    </div>)}</div>
                  </details>
                  <div className="pos-po-actions">
                    {order.status === "DRAFT" && <button type="button" className="pos-button secondary compact" onClick={() => openPurchaseOrderSubmit(order)} disabled={procurementSaving}>Submit order</button>}
                    {["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status) && <button type="button" className="pos-button primary compact" onClick={() => openGoodsReceipt(order)} disabled={stockCountActive}>Receive goods</button>}
                    {["PARTIALLY_RECEIVED", "RECEIVED"].includes(order.status) && order.items.some((item) => item.receivedQuantity > item.returnedQuantity) &&
                      <button type="button" className="pos-button secondary compact" onClick={() => openSupplierReturn(order)} disabled={stockCountActive}>Return to supplier</button>}
                  </div>
                  <ProcurementHistory purchaseOrderId={order.id} />
                </article>
              ))}
          {orderHasMore && <div className="pos-procurement-history-actions">
            <button type="button" className="pos-button secondary compact" onClick={loadMorePurchaseOrders} disabled={procurementMoreLoading}>
              {procurementMoreLoading ? "Loading…" : "Load more purchase orders"}
            </button>
          </div>}
        </div>
      </section>

      <div className="pos-inventory-grid">
        <section className="pos-inventory-card">
          <div className="pos-inventory-card-heading"><Package size={18} /><div><h3>Create product variant</h3><p>Each sellable colour/size combination needs its own SKU.</p></div></div>
          <form onSubmit={createVariant} className="pos-inventory-form">
            <label>Product
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} disabled={productsLoading || receiptRetry} required>
                {products.length ? products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>) : <option value="">No active products</option>}
              </select>
            </label>
            <div className="pos-inventory-fields">
              <label>Variant name<input value={variantForm.variantName} onChange={(e) => updateVariantForm("variantName", e.target.value)} placeholder="Black - Medium" maxLength={255} required /></label>
              <label>SKU<input value={variantForm.sku} onChange={(e) => updateVariantForm("sku", e.target.value)} placeholder="FRAME-BLK-M" maxLength={100} required /></label>
              <label>Barcode (optional)<input value={variantForm.barcode} onChange={(e) => updateVariantForm("barcode", e.target.value)} placeholder="Scan or enter barcode" maxLength={100} /></label>
              <label>Selling price override (₹)<input type="number" min="0.01" step="0.01" value={variantForm.sellingPriceOverride} onChange={(e) => updateVariantForm("sellingPriceOverride", e.target.value)} placeholder={selectedProduct?.price ? `Default ${money(selectedProduct.price)}` : "Use product price"} /></label>
            </div>
            <label>Variant attributes (JSON)
              <textarea value={variantForm.attributes} onChange={(e) => updateVariantForm("attributes", e.target.value)} rows={3} placeholder='{"color":"Black","size":"Medium"}' spellCheck="false" />
              <small>Example: {"{\"color\":\"Black\",\"size\":\"Medium\"}"}. Attributes are saved with the SKU.</small>
            </label>
            <button type="submit" className="pos-button primary" disabled={variantSaving || productsLoading || !selectedProductId || stockCountActive}>
              {variantSaving ? <><RefreshCw className="pos-spin" size={15} /> Creating…</> : <><Plus size={16} /> Create variant</>}
            </button>
          </form>
        </section>

        <section className="pos-inventory-card">
          <div className="pos-inventory-card-heading"><Store size={18} /><div><h3>Receive stock</h3><p>Record supplier receipts against a specific SKU and location.</p></div></div>
          <form onSubmit={receiveStock} className="pos-inventory-form">
            <label>Product
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} disabled={productsLoading || receiptRetry} required>
                {products.length ? products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>) : <option value="">No active products</option>}
              </select>
            </label>
            <label>Active variant / SKU
              <select value={selectedVariantId} onChange={(e) => setSelectedVariantId(e.target.value)} disabled={variantsLoading || receiptRetry || !variants.some((v) => v.active)} required>
                {variants.filter((v) => v.active).length
                  ? variants.filter((v) => v.active).map((variant) => <option key={variant.id} value={variant.id}>{variant.variantName} · {variant.sku}</option>)
                  : <option value="">Create an active variant first</option>}
              </select>
            </label>
            <div className="pos-inventory-fields">
              <label>Quantity received<input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={receiptRetry} required /></label>
              <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} disabled={receiptRetry} maxLength={500} required /></label>
            </div>
            <label>Confirm staff password<input type="password" autoComplete="current-password" value={receiptPassword}
              onChange={(e) => setReceiptPassword(e.target.value)} disabled={receiptSaving} required placeholder="Required to receive stock" /></label>
            {receiptRetry && <p className="pos-retry-note">A previous receipt response was uncertain. Retry without changing the product, quantity or reason.</p>}
            <button type="submit" className="pos-button primary" disabled={receiptSaving || (!receiptPayload.current && (!locationId || !selectedVariantId || stockCountActive)) || !receiptPassword.trim()}>
              {receiptSaving ? <><RefreshCw className="pos-spin" size={15} /> Receiving…</> : receiptRetry ? <><RefreshCw size={15} /> Retry same receipt</> : <><Plus size={16} /> Receive stock</>}
            </button>
          </form>
        </section>

        <section className="pos-inventory-card">
          <div className="pos-inventory-card-heading"><Package size={18} /><div><h3>Stock adjustment</h3><p>Correct a physical count, damage or verified stock discrepancy. Every change is recorded.</p></div></div>
          <form onSubmit={adjustStock} className="pos-inventory-form">
            <label>Product
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} disabled={productsLoading || adjustmentRetry} required>
                {products.length ? products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>) : <option value="">No active products</option>}
              </select>
            </label>
            <label>Active variant / SKU
              <select value={selectedVariantId} onChange={(e) => setSelectedVariantId(e.target.value)} disabled={variantsLoading || adjustmentRetry || !variants.some((v) => v.active)} required>
                {variants.filter((v) => v.active).length
                  ? variants.filter((v) => v.active).map((variant) => <option key={variant.id} value={variant.id}>{variant.variantName} · {variant.sku}</option>)
                  : <option value="">Create an active variant first</option>}
              </select>
            </label>
            <div className="pos-inventory-fields">
              <label>Quantity change (+ / −)<input type="number" min="-1000000" max="1000000" step="1" value={adjustmentDelta} onChange={(e) => setAdjustmentDelta(e.target.value)} disabled={adjustmentRetry} required /></label>
              <label>Reason<input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} disabled={adjustmentRetry} maxLength={500} required /></label>
            </div>
            <label>Confirm staff password<input type="password" autoComplete="current-password" value={adjustmentPassword}
              onChange={(e) => setAdjustmentPassword(e.target.value)} disabled={adjustmentSaving} required placeholder="Required to adjust stock" /></label>
            <small>Use a positive number to add stock and a negative number to remove stock. Adjustments cannot reduce on-hand below stock already reserved for online orders.</small>
            {adjustmentRetry && <p className="pos-retry-note">A previous adjustment response was uncertain. Retry without changing the product, quantity or reason.</p>}
            <button type="submit" className="pos-button primary" disabled={adjustmentSaving || (!adjustmentPayload.current && (!locationId || !selectedVariantId || stockCountActive)) || !adjustmentPassword.trim()}>
              {adjustmentSaving ? <><RefreshCw className="pos-spin" size={15} /> Adjusting…</> : adjustmentRetry ? <><RefreshCw size={15} /> Retry same adjustment</> : <><Plus size={16} /> Apply adjustment</>}
            </button>
          </form>
        </section>
      </div>

      {purchaseOrderSubmitTarget && <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePurchaseOrderSubmit();
      }}>
        <section className="pos-procurement-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-order-submit-title">
          <div className="pos-modal-toolbar"><div><span className="pos-eyebrow">PURCHASE ORDER</span><h2 id="purchase-order-submit-title">{purchaseOrderSubmitTarget.orderNumber}</h2></div>
            <button type="button" className="pos-icon-button" onClick={closePurchaseOrderSubmit} disabled={procurementSaving} aria-label="Close purchase order confirmation"><X /></button></div>
          <p>Submitting changes this draft into an order placed with the supplier. Confirm the order details before continuing.</p>
          <label className="pos-return-field">Confirm staff password<input type="password" autoComplete="current-password"
            value={purchaseOrderSubmitPassword} onChange={(event) => setPurchaseOrderSubmitPassword(event.target.value)}
            disabled={procurementSaving} placeholder="Required to submit purchase order" /></label>
          <div className="pos-modal-actions">
            <button type="button" className="pos-button secondary" onClick={closePurchaseOrderSubmit} disabled={procurementSaving}>Cancel</button>
            <button type="button" className="pos-button primary" onClick={submitPurchaseOrder}
              disabled={procurementSaving || !purchaseOrderSubmitPassword.trim()}>{procurementSaving ? "Submitting…" : "Confirm and submit order"}</button>
          </div>
        </section>
      </div>}

      {receivingOrder && <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !goodsReceiptSaving && !goodsReceiptRetry) setReceivingOrder(null);
      }}>
        <section className="pos-procurement-modal" role="dialog" aria-modal="true" aria-labelledby="goods-receipt-title">
          <div className="pos-modal-toolbar"><div><span className="pos-eyebrow">GOODS RECEIPT</span><h2 id="goods-receipt-title">{receivingOrder.orderNumber}</h2></div>
            <button type="button" className="pos-icon-button" onClick={() => setReceivingOrder(null)} disabled={goodsReceiptSaving || goodsReceiptRetry} aria-label="Close goods receipt"><X /></button></div>
          <p>Enter quantities physically received. The backend rejects quantities above the outstanding order balance.</p>
          {procurementActionError && <p className="pos-return-error" role="alert">{procurementActionError}</p>}
          {receivingOrder.items.filter((item) => item.outstandingQuantity > 0).map((item) => <label className="pos-procurement-quantity-row" key={item.id}>
            <span><strong>{item.productName}</strong><small>{item.variantName} · {item.sku} · Outstanding {item.outstandingQuantity}</small></span>
            <input type="number" min="0" max={item.outstandingQuantity} step="1" value={goodsReceiptQuantities[item.id] || ""}
              onChange={(event) => setGoodsReceiptQuantities((current) => ({ ...current, [item.id]: Math.min(item.outstandingQuantity, Math.max(0, Number(event.target.value) || 0)) }))}
              disabled={goodsReceiptSaving || goodsReceiptRetry} />
          </label>)}
          <label className="pos-return-field">Receipt reason<input value={goodsReceiptReason} onChange={(event) => setGoodsReceiptReason(event.target.value)} maxLength={500} disabled={goodsReceiptSaving || goodsReceiptRetry} /></label>
          <label className="pos-return-field">Confirm staff password<input type="password" autoComplete="current-password"
            value={goodsReceiptPassword} onChange={(event) => setGoodsReceiptPassword(event.target.value)} disabled={goodsReceiptSaving}
            placeholder="Required to receive purchase order goods" /></label>
          {goodsReceiptRetry && <p className="pos-retry-note">Retry the exact same receipt. Its original idempotency key is retained.</p>}
          <div className="pos-modal-actions">
            <button type="button" className="pos-button secondary" onClick={() => setReceivingOrder(null)} disabled={goodsReceiptSaving || goodsReceiptRetry}>Cancel</button>
            <button type="button" className="pos-button primary" onClick={receivePurchaseOrderGoods} disabled={goodsReceiptSaving || (!goodsReceiptPayload && stockCountActive) || !goodsReceiptPassword.trim()}>{goodsReceiptSaving ? "Receiving…" : goodsReceiptRetry ? "Retry same receipt" : "Confirm goods receipt"}</button>
          </div>
        </section>
      </div>}

      {supplierReturnOrder && <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !supplierReturnSaving && !supplierReturnRetry) setSupplierReturnOrder(null);
      }}>
        <section className="pos-procurement-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-return-title">
          <div className="pos-modal-toolbar"><div><span className="pos-eyebrow">SUPPLIER RETURN</span><h2 id="supplier-return-title">{supplierReturnOrder.orderNumber}</h2></div>
            <button type="button" className="pos-icon-button" onClick={() => setSupplierReturnOrder(null)} disabled={supplierReturnSaving || supplierReturnRetry} aria-label="Close supplier return"><X /></button></div>
          <p>Return received goods to the supplier. The backend prevents returning more than the received quantity or removing reserved stock.</p>
          {procurementActionError && <p className="pos-return-error" role="alert">{procurementActionError}</p>}
          {supplierReturnOrder.items.filter((item) => item.receivedQuantity > item.returnedQuantity).map((item) => {
            const returnable = item.receivedQuantity - item.returnedQuantity;
            return <label className="pos-procurement-quantity-row" key={item.id}>
              <span><strong>{item.productName}</strong><small>{item.variantName} · {item.sku} · Returnable {returnable}</small></span>
              <input type="number" min="0" max={returnable} step="1" value={supplierReturnQuantities[item.id] || ""}
                onChange={(event) => setSupplierReturnQuantities((current) => ({ ...current, [item.id]: Math.min(returnable, Math.max(0, Number(event.target.value) || 0)) }))}
                disabled={supplierReturnSaving || supplierReturnRetry} />
            </label>;
          })}
          <label className="pos-return-field">Supplier return reason<input value={supplierReturnReason} onChange={(event) => setSupplierReturnReason(event.target.value)} maxLength={500} disabled={supplierReturnSaving || supplierReturnRetry} /></label>
          <label className="pos-return-field">Confirm staff password<input type="password" autoComplete="current-password"
            value={supplierReturnPassword} onChange={(event) => setSupplierReturnPassword(event.target.value)} disabled={supplierReturnSaving}
            placeholder="Required to return goods to supplier" /></label>
          {supplierReturnRetry && <p className="pos-retry-note">Retry the exact same supplier return. Its original idempotency key is retained.</p>}
          <div className="pos-modal-actions">
            <button type="button" className="pos-button secondary" onClick={() => setSupplierReturnOrder(null)} disabled={supplierReturnSaving || supplierReturnRetry}>Cancel</button>
            <button type="button" className="pos-button primary" onClick={returnPurchaseOrderGoods} disabled={supplierReturnSaving || (!supplierReturnPayload && stockCountActive) || !supplierReturnPassword.trim()}>{supplierReturnSaving ? "Recording…" : supplierReturnRetry ? "Retry same return" : "Confirm supplier return"}</button>
          </div>
        </section>
      </div>}

      <section className="pos-inventory-card pos-stock-card">
        <div className="pos-inventory-card-heading"><Package size={18} /><div><h3>Current stock by variant</h3><p>{selectedProduct?.name || "Select a product"} · {stockRows.length} active variants at this location</p></div></div>
        <div className="pos-low-stock-alerts">
          <div className="pos-low-stock-heading"><strong>Low stock alerts</strong><span>{lowStockLoading ? "Refreshing…" : `${lowStockAlerts.length} variants at or below reorder level`}</span></div>
          {lowStockLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading alerts…</span></div>
            : lowStockAlerts.length === 0 ? <p>No low-stock alerts. Set a reorder level above zero on a variant to enable alerts.</p>
              : <div className="pos-low-stock-list">{lowStockAlerts.map((item) => <div key={item.variantId}>
                <span><strong>{item.productName}</strong><small>{item.variantName} · {item.sku} · {item.locationName}</small></span>
                <span><strong>{item.availableQuantity} available</strong><small>Reorder at {item.reorderLevel}</small></span>
              </div>)}</div>}
        </div>
        {variantsLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading variants…</span></div>
          : stockRows.length === 0 ? <div className="pos-empty-state"><Package /><strong>No stockable variants yet</strong><span>Create a variant and receive stock to make this product available in POS.</span></div>
          : <div className="pos-history-table-wrap"><table className="pos-history-table"><thead><tr><th>Variant</th><th>SKU</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Reorder level</th><th>Price</th></tr></thead><tbody>{stockRows.map((variant) => <tr key={variant.variantId}><td><strong>{variant.variantName}</strong></td><td>{variant.sku}</td><td>{variant.onHandQuantity}</td><td>{variant.reservedQuantity}</td><td><strong>{variant.availableQuantity}</strong></td><td><div className="pos-reorder-control"><input type="number" min="0" max="1000000" step="1" value={reorderDrafts[variant.variantId] ?? variant.reorderLevel ?? 0} onChange={(event) => setReorderDrafts((current) => ({ ...current, [variant.variantId]: event.target.value }))} aria-label={`Reorder level for ${variant.sku}`} /><button type="button" className="pos-button secondary compact" onClick={() => updateReorderLevel(variant.variantId, variant.reorderLevel ?? 0)} disabled={reorderDrafts[variant.variantId] == null}>Save</button></div></td><td>{money(variant.sellingPrice)}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="pos-inventory-card pos-stock-card">
        <div className="pos-inventory-card-heading">
          <ClipboardCheck size={18} />
          <div><h3>Stock movement history</h3><p>Append-only audit ledger for receipts, sales, reservations, returns and adjustments.</p></div>
          <button type="button" className="pos-button secondary compact" onClick={() => loadMovementHistory(movementPage)} disabled={movementLoading}>
            <RefreshCw size={15} className={movementLoading ? "pos-spin" : ""} /> Refresh
          </button>
        </div>
        <div className="pos-report-filters">
          <label>Filter variant
            <select value={movementVariantId} onChange={(event) => setMovementVariantId(event.target.value)}>
              <option value="">All variants</option>
              {catalog.flatMap((product) => (product.variants || []).map((variant) => (
                <option key={variant.variantId} value={variant.variantId}>{product.name} · {variant.variantName || variant.sku} · {variant.sku}</option>
              )))}
            </select>
          </label>
        </div>
        {movementLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading stock movements…</span></div>
          : movementRows.length === 0 ? <div className="pos-empty-state"><ClipboardCheck /><strong>No stock movements found</strong><span>Receipts, sales and other stock ledger events will appear here.</span></div>
            : <div className="pos-history-table-wrap"><table className="pos-history-table">
              <thead><tr><th>Date</th><th>Product / SKU</th><th>Movement</th><th>Qty Δ</th><th>Reserved Δ</th><th>On hand after</th><th>Reserved after</th><th>Reference</th><th>Actor</th><th>Reason</th></tr></thead>
              <tbody>{movementRows.map((movement) => <tr key={movement.id}>
                <td>{movement.createdAt ? new Date(movement.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                <td><strong>{movement.productName}</strong><small>{movement.variantName} · {movement.sku}</small></td>
                <td>{movement.movementType}</td>
                <td><strong>{Number(movement.quantityDelta) > 0 ? "+" : ""}{movement.quantityDelta}</strong></td>
                <td>{Number(movement.reservedDelta) > 0 ? "+" : ""}{movement.reservedDelta}</td>
                <td>{movement.onHandAfter}</td><td>{movement.reservedAfter}</td>
                <td>{movement.referenceType || "—"}{movement.referenceId ? <small>#{movement.referenceId}</small> : null}</td>
                <td>{movement.actorStaffId != null ? `Staff #${movement.actorStaffId}` : "System / online"}</td>
                <td>{movement.reason || "—"}</td>
              </tr>)}</tbody>
            </table></div>}
        <div className="pos-pagination">
          <span>Page {movementPages ? movementPage + 1 : 0} of {movementPages}</span>
          <div>
            <button type="button" disabled={movementPage <= 0 || movementLoading} onClick={() => loadMovementHistory(movementPage - 1)} aria-label="Previous stock movement page"><ChevronLeft size={18} /></button>
            <button type="button" disabled={movementPage + 1 >= movementPages || movementLoading} onClick={() => loadMovementHistory(movementPage + 1)} aria-label="Next stock movement page"><ChevronRight size={18} /></button>
          </div>
        </div>
      </section>
    </section>
  );
}

export default function PosTerminal() {
  const navigate = useNavigate();
  useEffect(() => {
    const handleExpiredSession = () => navigate("/admin", { replace: true });
    window.addEventListener("nmk:session-expired", handleExpiredSession);
    return () => window.removeEventListener("nmk:session-expired", handleExpiredSession);
  }, [navigate]);
  const staffRole = sessionStorage.getItem("adminRole") || "CASHIER";
  const canManageInventory = staffRole === "ADMIN" || staffRole === "MANAGER";
  const canViewHistory = staffRole === "ADMIN" || staffRole === "MANAGER";
  const canApplyDiscount = staffRole === "ADMIN" || staffRole === "MANAGER";
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(() => String(readPendingCheckout()?.locationId || ""));
  const [locationStockCountLocked, setLocationStockCountLocked] = useState(false);
  const [registers, setRegisters] = useState([]);
  const [registerId, setRegisterId] = useState(() => String(readPendingOperation("nmk.pos.pending-open-shift.v1", (p) => p?.idempotencyKey && p?.registerId)?.registerId || ""));
  const [shift, setShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("0.00");
  const [closingCashCount, setClosingCashCount] = useState("");
  const [closingReason, setClosingReason] = useState("");
  const [pendingClosePayload, setPendingClosePayload] = useState(() => readPendingOperation("nmk.pos.pending-close-shift.v1", (p) => p?.shiftId && p?.closingCashCount != null));
  const [cashMovementType, setCashMovementType] = useState("CASH_IN");
  const [cashMovementAmount, setCashMovementAmount] = useState("");
  const [cashMovementReason, setCashMovementReason] = useState("");
  const [newRegisterCode, setNewRegisterCode] = useState("MAIN");
  const [newRegisterName, setNewRegisterName] = useState("Main Register");
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("checkout");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedVariants, setSelectedVariants] = useState({});
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState("0.00");
  const [payments, setPayments] = useState([{ paymentMethod: "CASH", amount: "0.00", tenderedAmount: "0.00", transactionReference: "" }]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(() => readPendingCheckout());
  const [retryPending, setRetryPending] = useState(() => Boolean(readPendingCheckout()));
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPages, setHistoryPages] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [reportTo, setReportTo] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [salesReport, setSalesReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [shiftHistoryPage, setShiftHistoryPage] = useState(0);
  const [shiftHistoryHasMore, setShiftHistoryHasMore] = useState(false);
  const [shiftHistoryLoading, setShiftHistoryLoading] = useState(false);
  const [shiftHistoryMoreLoading, setShiftHistoryMoreLoading] = useState(false);
  const [cashReconciliationDate, setCashReconciliationDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [cashReconciliation, setCashReconciliation] = useState(null);
  const [cashReconciliationLoading, setCashReconciliationLoading] = useState(false);
  const cashReconciliationRequestRef = useRef(0);
  const [inventoryReportLoading, setInventoryReportLoading] = useState(false);
  const [inventoryReportMoreLoading, setInventoryReportMoreLoading] = useState(false);
  const inventoryReportRequestRef = useRef(0);
  const [procurementCostReport, setProcurementCostReport] = useState(null);
  const [procurementCostReportLoading, setProcurementCostReportLoading] = useState(false);
  const [procurementCostReportMoreLoading, setProcurementCostReportMoreLoading] = useState(false);
  const procurementCostReportRequestRef = useRef(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [selectedHistorySale, setSelectedHistorySale] = useState(null);
  const [selectedSaleReturns, setSelectedSaleReturns] = useState(null);
  const [selectedSaleExchanges, setSelectedSaleExchanges] = useState([]);
  const [saleReturnsLoading, setSaleReturnsLoading] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("Sale cancelled before customer leaves");
  const [voidPassword, setVoidPassword] = useState("");
  const [voidRefunds, setVoidRefunds] = useState([]);
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidRetry, setVoidRetry] = useState(false);
  const [voidPayload, setVoidPayload] = useState(() => readPendingFinancialAction("nmk.pos.pending-void.v1")?.payload || null);
  const [voidError, setVoidError] = useState("");
  const voidPending = useRef(readPendingFinancialAction("nmk.pos.pending-void.v1")?.payload?.idempotencyKey || null);
  const pendingVoidRecord = useRef(readPendingFinancialAction("nmk.pos.pending-void.v1"));
  const [returnSale, setReturnSale] = useState(null);
  const [saleReturns, setSaleReturns] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnPassword, setReturnPassword] = useState("");
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnDispositions, setReturnDispositions] = useState({});
  const [returnDispositionReasons, setReturnDispositionReasons] = useState({});
  const [returnPaymentMethod, setReturnPaymentMethod] = useState("CASH");
  const [returnPaymentReference, setReturnPaymentReference] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnRetryPending, setReturnRetryPending] = useState(false);
  const [returnPendingPayload, setReturnPendingPayload] = useState(() => readPendingFinancialAction("nmk.pos.pending-return.v1")?.payload || null);
  const returnPendingKey = useRef(readPendingFinancialAction("nmk.pos.pending-return.v1")?.payload?.idempotencyKey || null);
  const pendingReturnRecord = useRef(readPendingFinancialAction("nmk.pos.pending-return.v1"));
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeReason, setExchangeReason] = useState("");
  const [exchangePassword, setExchangePassword] = useState("");
  const [exchangeItems, setExchangeItems] = useState([]);
  const [exchangeSelectedVariantId, setExchangeSelectedVariantId] = useState("");
  const [exchangeDiscount, setExchangeDiscount] = useState("0.00");
  const [exchangeCollectionMethod, setExchangeCollectionMethod] = useState("CASH");
  const [exchangeCollectionTendered, setExchangeCollectionTendered] = useState("");
  const [exchangeCollectionReference, setExchangeCollectionReference] = useState("");
  const [exchangeRefundMethod, setExchangeRefundMethod] = useState("CASH");
  const [exchangeRefundReference, setExchangeRefundReference] = useState("");
  const [exchangeSaving, setExchangeSaving] = useState(false);
  const [exchangeRetryPending, setExchangeRetryPending] = useState(false);
  const [exchangePendingPayload, setExchangePendingPayload] = useState(() => readPendingFinancialAction("nmk.pos.pending-exchange.v1")?.payload || null);
  const exchangePendingKey = useRef(readPendingFinancialAction("nmk.pos.pending-exchange.v1")?.payload?.idempotencyKey || null);
  const pendingExchangeRecord = useRef(readPendingFinancialAction("nmk.pos.pending-exchange.v1"));
  const pendingKey = useRef(pendingPayload?.idempotencyKey || null);
  const openShiftPayload = useRef(readPendingOperation("nmk.pos.pending-open-shift.v1", (p) => p?.idempotencyKey && p?.registerId));
  const closeShiftPayload = useRef(readPendingOperation("nmk.pos.pending-close-shift.v1", (p) => p?.shiftId && p?.closingCashCount != null));
  const cashMovementPayload = useRef(readPendingOperation("nmk.pos.pending-cash-movement.v1", (p) => p?.idempotencyKey && p?.shiftId && p?.amount > 0));
  const searchRef = useRef(null);

  useEffect(() => {
    if (openShiftPayload.current) {
      setNotice("An unfinished shift-opening request was recovered. Retry it to confirm the original request; do not create another shift.");
    } else if (cashMovementPayload.current) {
      setNotice("An unfinished drawer cash movement was recovered. Retry the saved movement to confirm its status; do not enter it again.");
    } else if (closeShiftPayload.current) {
      setNotice("An unfinished shift-close request was recovered. Retry the exact saved cash count to confirm closure; do not open another shift.");
    }
  }, []);

  const loadLocations = useCallback(async () => {
    setLocationsLoading(true);
    setError("");
    try {
      const data = await apiRequest("/admin/pos/locations");
      const list = Array.isArray(data) ? data : [];
      setLocations(list);
      setLocationId((current) => current && list.some((item) => String(item.id) === String(current))
        ? current : (list[0]?.id ? String(list[0].id) : ""));
      if (!list.length) setError("No active store location is configured. Create and activate an inventory location before using POS.");
    } catch (err) { setError(err.message); }
    finally { setLocationsLoading(false); }
  }, []);

  const loadRegisters = useCallback(async () => {
    if (!locationId) {
      setRegisters([]);
      setRegisterId("");
      setShift(null);
      return;
    }
    try {
      const data = await apiRequest(`/admin/pos/registers?locationId=${encodeURIComponent(locationId)}`);
      const list = Array.isArray(data) ? data : [];
      setRegisters(list);
      setRegisterId((current) => current && list.some((item) => String(item.id) === String(current))
        ? current : (list[0]?.id ? String(list[0].id) : ""));
      if (!list.length) setShift(null);
    } catch (err) {
      setRegisters([]);
      setRegisterId("");
      setShift(null);
      setError(err.message);
    }
  }, [locationId]);

  const loadCurrentShift = useCallback(async () => {
    if (!registerId) {
      setShift(null);
      return;
    }
    setShiftLoading(true);
    try {
      const data = await apiRequest(`/admin/pos/shifts/current?registerId=${encodeURIComponent(registerId)}`);
      setShift(data || null);
      setClosingCashCount(data?.expectedCash != null ? amount(data.expectedCash) : "");
    } catch (err) {
      setShift(null);
      setError(err.message);
    } finally {
      setShiftLoading(false);
    }
  }, [registerId]);

  const openShift = async () => {
    if (!openShiftPayload.current) {
      if (!registerId) { setError("Select a register before opening a shift."); return; }
      const float = Number(openingFloat);
      if (!Number.isFinite(float) || float < 0) { setError("Enter a valid opening cash float."); return; }
      openShiftPayload.current = {
        registerId: Number(registerId),
        openingFloat: Number(amount(float)),
        idempotencyKey: newIdempotencyKey(),
      };
      savePendingOperation("nmk.pos.pending-open-shift.v1", openShiftPayload.current);
    }
    setShiftSaving(true);
    setError("");
    try {
      const opened = await apiRequest("/admin/pos/shifts/open", {
        method: "POST",
        body: JSON.stringify(openShiftPayload.current),
      });
      openShiftPayload.current = null;
      sessionStorage.removeItem("nmk.pos.pending-open-shift.v1");
      setShift(opened);
      setClosingCashCount(amount(opened.expectedCash));
      setNotice("Cashier shift opened.");
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      if (!uncertain) {
        openShiftPayload.current = null;
        sessionStorage.removeItem("nmk.pos.pending-open-shift.v1");
      }
      setError(`${err.message}${uncertain ? " Retry the exact same shift-opening request; its idempotency key is retained." : ""}`);
      if (uncertain) await loadCurrentShift();
    } finally {
      setShiftSaving(false);
    }
  };

  const createRegister = async () => {
    if (!locationId || !newRegisterCode.trim() || !newRegisterName.trim()) {
      setError("Register code and name are required.");
      return;
    }
    setShiftSaving(true);
    setError("");
    try {
      await apiRequest("/admin/pos/registers", {
        method: "POST",
        body: JSON.stringify({
          locationId: Number(locationId),
          registerCode: newRegisterCode.trim(),
          name: newRegisterName.trim(),
        }),
      });
      await loadRegisters();
      setNotice("Register created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setShiftSaving(false);
    }
  };

  const addCashMovement = async () => {
    if (!cashMovementPayload.current) {
      if (!shift?.id) { setError("Open a shift before recording drawer cash."); return; }
      const value = Number(cashMovementAmount);
      if (!Number.isFinite(value) || value <= 0 || !cashMovementReason.trim()) {
        setError("Enter a positive amount and a reason for the cash movement.");
        return;
      }
      cashMovementPayload.current = {
        shiftId: Number(shift.id),
        movementType: cashMovementType,
        amount: Number(amount(value)),
        idempotencyKey: newIdempotencyKey(),
        reason: cashMovementReason.trim(),
      };
      savePendingOperation("nmk.pos.pending-cash-movement.v1", cashMovementPayload.current);
    }
    const payload = cashMovementPayload.current;
    setShiftSaving(true);
    setError("");
    try {
      const updated = await apiRequest(`/admin/pos/shifts/${payload.shiftId}/cash-movements`, {
        method: "POST",
        body: JSON.stringify({
          movementType: payload.movementType,
          amount: payload.amount,
          idempotencyKey: payload.idempotencyKey,
          reason: payload.reason,
        }),
      });
      cashMovementPayload.current = null;
      sessionStorage.removeItem("nmk.pos.pending-cash-movement.v1");
      setShift(updated);
      setClosingCashCount(amount(updated.expectedCash));
      setCashMovementAmount("");
      setCashMovementReason("");
      setNotice(payload.movementType === "CASH_IN" ? "Cash added to drawer." : "Cash removed from drawer.");
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      if (!uncertain) {
        cashMovementPayload.current = null;
        sessionStorage.removeItem("nmk.pos.pending-cash-movement.v1");
      }
      setError(`${err.message}${uncertain ? " Retry the exact same cash movement; its idempotency key is retained." : ""}`);
      if (uncertain) await loadCurrentShift();
    } finally {
      setShiftSaving(false);
    }
  };

  const closeShift = async () => {
    if (!closeShiftPayload.current) {
      if (!shift?.id || shift.status !== "OPEN") return;
      const counted = Number(closingCashCount);
      if (!Number.isFinite(counted) || counted < 0) {
        setError("Enter the actual cash counted in the drawer.");
        return;
      }
      const variance = Number((counted - Number(shift.expectedCash || 0)).toFixed(2));
      if (Math.abs(variance) > 0.001 && !closingReason.trim()) {
        setError("Explain the cash difference before closing the shift.");
        return;
      }
      closeShiftPayload.current = {
        shiftId: shift.id,
        closingCashCount: Number(amount(counted)),
        reason: closingReason.trim() || null,
      };
      setPendingClosePayload(closeShiftPayload.current);
      savePendingOperation("nmk.pos.pending-close-shift.v1", closeShiftPayload.current);
    }
    const payload = closeShiftPayload.current;
    setShiftSaving(true);
    setError("");
    try {
      const closed = await apiRequest(`/admin/pos/shifts/${payload.shiftId}/close`, {
        method: "POST",
        body: JSON.stringify({
          closingCashCount: payload.closingCashCount,
          reason: payload.reason,
        }),
      });
      closeShiftPayload.current = null;
      setPendingClosePayload(null);
      sessionStorage.removeItem("nmk.pos.pending-close-shift.v1");
      setShift(closed);
      setNotice(`Shift closed. Cash variance: ${money(closed.cashVariance)}.`);
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      if (!uncertain) {
        closeShiftPayload.current = null;
        setPendingClosePayload(null);
        sessionStorage.removeItem("nmk.pos.pending-close-shift.v1");
      }
      setError(`${err.message}${uncertain ? " Retry the exact same shift-close request; its cash count and reason are retained." : ""}`);
      if (uncertain) await loadCurrentShift();
    } finally {
      setShiftSaving(false);
    }
  };

  const loadCatalog = useCallback(async () => {
    if (!locationId) { setCatalog([]); setLocationStockCountLocked(false); return; }
    setCatalogLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`);
      setCatalog(Array.isArray(data?.products) ? data.products : []);
      setLocationStockCountLocked(Boolean(data?.stockCountLocked));
      setSelectedVariants({});
    } catch (err) { setError(err.message); }
    finally { setCatalogLoading(false); }
  }, [locationId]);

  const loadSalesReport = useCallback(async () => {
    if (!locationId || !reportFrom || !reportTo) return;
    setReportLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/admin/pos/reports/sales?locationId=${encodeURIComponent(locationId)}&from=${encodeURIComponent(reportFrom)}&to=${encodeURIComponent(reportTo)}`);
      setSalesReport(data);
    } catch (err) { setError(err.message); }
    finally { setReportLoading(false); }
  }, [locationId, reportFrom, reportTo]);

  const loadShiftHistory = useCallback(async () => {
    if (!locationId) return;
    setShiftHistoryLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/admin/pos/shifts/history?locationId=${encodeURIComponent(locationId)}&page=0&size=25`);
      setShiftHistory(Array.isArray(data?.content) ? data.content : []);
      setShiftHistoryPage(Number(data?.number || 0));
      setShiftHistoryHasMore(Boolean(data?.hasNext));
    } catch (err) { setError(err.message); }
    finally { setShiftHistoryLoading(false); }
  }, [locationId]);

  const loadDailyCashReconciliation = useCallback(async () => {
    if (!locationId || !cashReconciliationDate) return;
    const requestId = ++cashReconciliationRequestRef.current;
    const requestedLocationId = String(locationId);
    setCashReconciliationLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/admin/pos/reports/cash-reconciliation?locationId=${encodeURIComponent(locationId)}&date=${encodeURIComponent(cashReconciliationDate)}`);
      if (requestId === cashReconciliationRequestRef.current && requestedLocationId === String(locationId)) {
        setCashReconciliation(data);
      }
    } catch (err) {
      if (requestId === cashReconciliationRequestRef.current) setError(err.message);
    } finally {
      if (requestId === cashReconciliationRequestRef.current) setCashReconciliationLoading(false);
    }
  }, [locationId, cashReconciliationDate]);

  const loadMoreShiftHistory = async () => {
    if (!locationId || !shiftHistoryHasMore || shiftHistoryMoreLoading) return;
    setShiftHistoryMoreLoading(true);
    setError("");
    try {
      const nextPage = shiftHistoryPage + 1;
      const data = await apiRequest(`/admin/pos/shifts/history?locationId=${encodeURIComponent(locationId)}&page=${nextPage}&size=25`);
      const content = Array.isArray(data?.content) ? data.content : [];
      setShiftHistory((current) => [...current, ...content.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setShiftHistoryPage(Number(data?.number ?? nextPage));
      setShiftHistoryHasMore(Boolean(data?.hasNext));
    } catch (err) { setError(err.message); }
    finally { setShiftHistoryMoreLoading(false); }
  };

  const loadInventoryReport = useCallback(async () => {
    if (!locationId) return;
    const requestId = ++inventoryReportRequestRef.current;
    const requestedLocationId = String(locationId);
    setInventoryReportLoading(true);
    setInventoryReportMoreLoading(false);
    setError("");
    try {
      const data = await apiRequest(`/admin/pos/reports/inventory?locationId=${encodeURIComponent(locationId)}`);
      if (requestId === inventoryReportRequestRef.current && requestedLocationId === String(locationId)) {
        setInventoryReport(data);
      }
    } catch (err) {
      if (requestId === inventoryReportRequestRef.current) setError(err.message);
    } finally {
      if (requestId === inventoryReportRequestRef.current) setInventoryReportLoading(false);
    }
  }, [locationId]);

  const loadMoreInventoryReportEntries = useCallback(async () => {
    if (!locationId || !inventoryReport?.itemsHasNext || inventoryReportMoreLoading) return;
    const requestId = inventoryReportRequestRef.current;
    const requestedLocationId = String(locationId);
    const nextPage = Number(inventoryReport.itemsPage || 0) + 1;
    setInventoryReportMoreLoading(true);
    setError("");
    try {
      const data = await apiRequest(
        `/admin/pos/reports/inventory/entries?locationId=${encodeURIComponent(locationId)}&page=${nextPage}&size=50`
      );
      if (requestId === inventoryReportRequestRef.current && requestedLocationId === String(locationId)) {
        const rows = Array.isArray(data?.content) ? data.content : [];
        setInventoryReport((current) => current ? ({
          ...current,
          items: [...(current.items || []), ...rows.filter((row) => !(current.items || []).some((existing) => existing.variantId === row.variantId))],
          itemsPage: Number(data?.number ?? nextPage),
          itemsSize: Number(data?.size ?? 50),
          itemsHasNext: Boolean(data?.hasNext),
        }) : current);
      }
    } catch (err) {
      if (requestId === inventoryReportRequestRef.current) setError(err.message);
    } finally {
      if (requestId === inventoryReportRequestRef.current) setInventoryReportMoreLoading(false);
    }
  }, [locationId, inventoryReport, inventoryReportMoreLoading]);

  const loadProcurementCostReport = useCallback(async () => {
    if (!locationId || !reportFrom || !reportTo || reportTo < reportFrom) return;
    const requestId = ++procurementCostReportRequestRef.current;
    setProcurementCostReportLoading(true);
    setError("");
    try {
      const data = await apiRequest("/admin/procurement/cost-report?locationId=" + encodeURIComponent(locationId) + "&from=" + encodeURIComponent(reportFrom) + "&to=" + encodeURIComponent(reportTo));
      if (requestId === procurementCostReportRequestRef.current) setProcurementCostReport(data);
    } catch (err) {
      if (requestId === procurementCostReportRequestRef.current) setError(err.message);
    } finally {
      if (requestId === procurementCostReportRequestRef.current) setProcurementCostReportLoading(false);
    }
  }, [locationId, reportFrom, reportTo]);

  const loadMoreProcurementCostReportEntries = useCallback(async () => {
    if (!procurementCostReport?.entriesHasNext || procurementCostReportMoreLoading) return;
    const requestId = procurementCostReportRequestRef.current;
    const nextPage = (procurementCostReport.entriesPage || 0) + 1;
    setProcurementCostReportMoreLoading(true);
    setError("");
    try {
      const data = await apiRequest("/admin/procurement/cost-report/entries?locationId=" + encodeURIComponent(locationId)
        + "&from=" + encodeURIComponent(reportFrom) + "&to=" + encodeURIComponent(reportTo)
        + "&page=" + nextPage + "&size=50");
      if (requestId === procurementCostReportRequestRef.current) {
        setProcurementCostReport((current) => current ? {
          ...current,
          entries: [...(current.entries || []), ...(data.content || [])],
          entriesPage: data.number ?? nextPage,
          entriesSize: data.size ?? 50,
          entriesHasNext: Boolean(data.last === false || data.hasNext === true)
        } : current);
      }
    } catch (err) {
      if (requestId === procurementCostReportRequestRef.current) setError(err.message);
    } finally {
      if (requestId === procurementCostReportRequestRef.current) setProcurementCostReportMoreLoading(false);
    }
  }, [locationId, reportFrom, reportTo, procurementCostReport, procurementCostReportMoreLoading]);

  const invalidateProcurementCostReport = () => {
    procurementCostReportRequestRef.current += 1;
    setProcurementCostReport(null);
    setProcurementCostReportLoading(false);
    setProcurementCostReportMoreLoading(false);
  };

  const openVoidDialog = (sale) => {
    if (selectedSaleReturns === null) {
      setError("Return history could not be verified. Close and reopen this transaction before attempting a full void.");
      return;
    }
    if (selectedSaleReturns.length > 0) {
      setError("A full void is not allowed because this sale already has a return or void record.");
      return;
    }
    setVoidReason("Sale cancelled before customer leaves");
    setVoidPassword("");
    setVoidRefunds((sale.payments || []).map((payment) => ({
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      transactionReference: "",
    })));
    setVoidPayload(null);
    voidPending.current = null;
    setVoidRetry(false);
    setVoidError("");
    setVoidDialogOpen(true);
  };

  const submitVoid = async () => {
    if (!selectedHistorySale) return;
    // For an uncertain response, retry the original immutable payload. The backend
    // replays a committed void by idempotency key before checking the shift state.
    if (!voidPayload && (!shift?.id || !voidReason.trim())) {
      setVoidError("An open manager shift and a void reason are required.");
      return;
    }
    if (!voidPayload) {
      voidPending.current = voidPending.current || newIdempotencyKey();
      const nextPayload = {
        shiftId: shift.id,
        reason: voidReason.trim(),
        idempotencyKey: voidPending.current,
        refundPayments: voidRefunds.map((payment) => ({
          paymentMethod: payment.paymentMethod,
          amount: Number(payment.amount),
          transactionReference: payment.transactionReference.trim() || null,
        })),
      };
      setVoidPayload(nextPayload);
      savePendingFinancialAction("nmk.pos.pending-void.v1", selectedHistorySale.id, nextPayload);
    }
    const payload = voidPayload || {
      shiftId: shift.id,
      reason: voidReason.trim(),
      idempotencyKey: voidPending.current,
      refundPayments: voidRefunds.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: Number(payment.amount),
        transactionReference: payment.transactionReference.trim() || null,
      })),
    };
    setVoidSaving(true);
    setVoidError("");
    try {
      const authorizationToken = await authorizePosAction("POS_VOID", voidPassword);
      const result = await apiRequest(`/admin/pos/sales/${selectedHistorySale.id}/void`, {
        method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken }, body: JSON.stringify(payload),
      });
      setVoidDialogOpen(false);
      setSelectedHistorySale(null);
      setVoidPayload(null);
      voidPending.current = null;
      sessionStorage.removeItem("nmk.pos.pending-void.v1");
      pendingVoidRecord.current = null;
      setVoidRetry(false);
      setVoidPassword("");
      await Promise.all([loadHistory(historyPage), loadCatalog(), loadSalesReport()]);
      setNotice(`Sale ${result.invoiceNumber} voided. Refund ${money(result.refundTotal)} recorded.`);
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      setVoidRetry(uncertain);
      setVoidError(`${err.message}${uncertain ? " Retry the exact same void request; its idempotency key is retained." : ""}`);
      if (!uncertain) {
        setVoidPayload(null); voidPending.current = null;
        sessionStorage.removeItem("nmk.pos.pending-void.v1");
        pendingVoidRecord.current = null;
      }
    } finally { setVoidSaving(false); }
  };

  const loadHistory = useCallback(async (page = 0) => {
    setHistoryLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/admin/pos/sales?page=${page}&size=20${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}`);
      setHistory(Array.isArray(data?.content) ? data.content : []);
      setHistoryPage(Number(data?.number || 0));
      setHistoryPages(Number(data?.totalPages || 0));
    } catch (err) { setError(err.message); }
    finally { setHistoryLoading(false); }
  }, [locationId]);

  useEffect(() => {
    const pending = pendingVoidRecord.current || pendingReturnRecord.current || pendingExchangeRecord.current;
    if (!pending) return;
    let cancelled = false;
    (async () => {
      try {
        const sale = await apiRequest(`/admin/pos/sales/${pending.saleId}`);
        const [returns, exchanges] = await Promise.all([
          apiRequest(`/admin/pos/sales/${pending.saleId}/returns`),
          apiRequest(`/admin/pos/sales/${pending.saleId}/exchange`),
        ]);
        if (cancelled) return;
        setSelectedHistorySale(sale);
        setSelectedSaleReturns(Array.isArray(returns) ? returns : []);
        setSelectedSaleExchanges(Array.isArray(exchanges) ? exchanges : []);
        if (pendingVoidRecord.current) {
          setVoidDialogOpen(true);
          setVoidPayload(pendingVoidRecord.current.payload);
          setVoidRetry(true);
          setVoidReason(pendingVoidRecord.current.payload.reason || "");
          setVoidRefunds(pendingVoidRecord.current.payload.refundPayments || []);
          setVoidError("An unfinished void was recovered. Verify the transaction and enter a manager password to retry the exact original request.");
        } else if (pendingExchangeRecord.current) {
          setReturnSale(sale);
          setSaleReturns(Array.isArray(returns) ? returns : []);
          setExchangeMode(true);
          setExchangePendingPayload(pendingExchangeRecord.current.payload);
          setExchangeRetryPending(true);
          const payload = pendingExchangeRecord.current.payload;
          setExchangeReason(payload.reason || "");
          setReturnQuantities(Object.fromEntries((payload.returnItems || []).map((item) => [item.saleItemId, item.quantity])));
          setReturnDispositions(Object.fromEntries((payload.returnItems || []).map((item) => [item.saleItemId, item.restockDisposition || "RESTOCK"])));
          setReturnDispositionReasons(Object.fromEntries((payload.returnItems || []).map((item) => [item.saleItemId, item.dispositionReason || ""])));
          setExchangeDiscount(String(payload.replacementDiscountAmount || "0.00"));
          const collection = payload.collectionPayments?.[0];
          if (collection) {
            setExchangeCollectionMethod(collection.paymentMethod || "CASH");
            setExchangeCollectionTendered(String(collection.tenderedAmount ?? ""));
            setExchangeCollectionReference(collection.transactionReference || "");
          }
          const refund = payload.refundPayments?.[0];
          if (refund) {
            setExchangeRefundMethod(refund.paymentMethod || "CASH");
            setExchangeRefundReference(refund.transactionReference || "");
          }
          setError("An unfinished exchange was recovered. Review the original sale and enter a manager password to retry the exact original request.");
        } else if (pendingReturnRecord.current) {
          const payload = pendingReturnRecord.current.payload;
          setReturnSale(sale);
          setSaleReturns(Array.isArray(returns) ? returns : []);
          setReturnPendingPayload(payload);
          setReturnRetryPending(true);
          setReturnReason(payload.reason || "");
          setReturnQuantities(Object.fromEntries((payload.items || []).map((item) => [item.saleItemId, item.quantity])));
          setReturnDispositions(Object.fromEntries((payload.items || []).map((item) => [item.saleItemId, item.restockDisposition || "RESTOCK"])));
          setReturnDispositionReasons(Object.fromEntries((payload.items || []).map((item) => [item.saleItemId, item.dispositionReason || ""])));
          const refund = payload.refundPayments?.[0];
          if (refund) {
            setReturnPaymentMethod(refund.paymentMethod || "CASH");
            setReturnPaymentReference(refund.transactionReference || "");
          }
          setError("An unfinished return was recovered. Review the original sale and enter a manager password to retry the exact original request.");
        }
      } catch (err) {
        if (!cancelled) setError(`A pending financial operation could not be restored: ${err.message}. Its saved request remains available in this tab; refresh after connectivity is restored.`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!exchangePendingPayload || !catalog.length || exchangeItems.length) return;
    const restored = (exchangePendingPayload.replacementItems || []).map((line) => {
      const product = catalog.find((row) => Number(row.productId) === Number(line.productId));
      const variant = product?.variants?.find((row) => Number(row.variantId) === Number(line.variantId));
      return product && variant ? {
        productId: Number(line.productId), variantId: Number(line.variantId),
        productName: product.name, variantName: variant.variantName || variant.sku,
        sku: variant.sku, unitPrice: Number(variant.sellingPrice), quantity: Number(line.quantity),
      } : null;
    }).filter(Boolean);
    if (restored.length) setExchangeItems(restored);
  }, [exchangePendingPayload, catalog, exchangeItems.length]);

  useEffect(() => { loadLocations(); }, [loadLocations]);
  useEffect(() => { loadRegisters(); }, [loadRegisters]);
  useEffect(() => { if (registerId) loadCurrentShift(); }, [registerId, loadCurrentShift]);
  useEffect(() => { if (locationId) loadCatalog(); }, [locationId, loadCatalog]);
  useEffect(() => { if (activeTab === "history") loadHistory(0); }, [activeTab, loadHistory]);
  useEffect(() => { if (activeTab === "reports") loadSalesReport(); }, [activeTab, loadSalesReport]);
  useEffect(() => { if (activeTab === "inventory-report") loadInventoryReport(); }, [activeTab, loadInventoryReport]);
  useEffect(() => {
    if (activeTab === "shift-history") {
      loadShiftHistory();
      loadDailyCashReconciliation();
    }
  }, [activeTab, loadShiftHistory, loadDailyCashReconciliation]);

  const categories = useMemo(() => ["All", ...new Set(catalog.map((p) => p.category).filter(Boolean))], [catalog]);
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.filter((product) => {
      if (category !== "All" && product.category !== category) return false;
      if (!term) return true;
      const variants = (product.variants || []).map((v) =>
        [v.sku, v.barcode, v.variantName, ...Object.values(v.attributes || {})].join(" ")
      ).join(" ");
      return [product.name, product.category, product.gender, variants].join(" ").toLowerCase().includes(term);
    });
  }, [catalog, category, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountValue = Math.max(0, Number((Number(discount) || 0).toFixed(2)));
  const grandTotal = Math.max(0, subtotal - discountValue);
  const paymentTotal = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const cashChange = payments.filter((p) => p.paymentMethod === "CASH")
    .reduce((sum, p) => sum + Math.max(0, (Number(p.tenderedAmount) || 0) - (Number(p.amount) || 0)), 0);

  const getReturnLineInfo = (item) => {
    if (!returnSale) return { remaining: 0, refund: 0 };
    const toCents = (value) => Math.round((Number(value) || 0) * 100);
    const fromCents = (value) => value / 100;
    const roundMultiplyDivideHalfUp = (amountCents, multiplier, denominator) => {
      const divisor = BigInt(denominator);
      if (divisor <= 0n) return 0;
      const numerator = BigInt(amountCents) * BigInt(multiplier);
      return Number((numerator + divisor / 2n) / divisor);
    };

    const previous = saleReturns.flatMap((record) => record.items || [])
      .filter((returned) => Number(returned.saleItemId) === Number(item.id));
    const returnedQuantity = previous.reduce((sum, returned) => sum + Number(returned.quantity || 0), 0);
    const previouslyRefundedCents = previous.reduce((sum, returned) => sum + toCents(returned.refundAmount), 0);
    const soldQuantity = Math.max(0, Number(item.quantity || 0));
    const remaining = Math.max(0, soldQuantity - returnedQuantity);
    const quantity = Math.min(remaining, Math.max(0, Number(returnQuantities[item.id] || 0)));

    // Match the backend's ordered, cent-precise discount allocation exactly:
    // round each proportional share HALF_UP, cap it at the remaining discount,
    // and assign the final remainder to the last sale line.
    const sorted = [...(returnSale.items || [])].sort((a, b) => Number(a.id) - Number(b.id));
    const subtotalCents = toCents(returnSale.subtotal);
    const totalDiscountCents = toCents(returnSale.discountAmount);
    let allocatedDiscountCents = 0;
    let lineDiscountCents = 0;
    sorted.forEach((saleLine, index) => {
      const lineGrossCents = toCents(saleLine.lineTotal);
      let shareCents = index === sorted.length - 1
        ? totalDiscountCents - allocatedDiscountCents
        : roundMultiplyDivideHalfUp(totalDiscountCents, lineGrossCents, subtotalCents);
      shareCents = Math.max(0, Math.min(shareCents, totalDiscountCents - allocatedDiscountCents));
      if (Number(saleLine.id) === Number(item.id)) lineDiscountCents = shareCents;
      allocatedDiscountCents += shareCents;
    });

    const netLineCents = Math.max(0, toCents(item.lineTotal) - lineDiscountCents);
    const refundCents = quantity === 0 ? 0
      : quantity === remaining
        ? Math.max(0, netLineCents - previouslyRefundedCents)
        : roundMultiplyDivideHalfUp(netLineCents, quantity, Math.max(1, soldQuantity));
    return { remaining, refund: fromCents(refundCents) };
  };

  const returnQuote = useMemo(() => {
    if (!returnSale) return 0;
    return (returnSale.items || []).reduce((sum, item) => sum + getReturnLineInfo(item).refund, 0);
  }, [returnSale, saleReturns, returnQuantities]);

  const exchangeSubtotal = exchangeItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const exchangeDiscountValue = Math.max(0, Number((Number(exchangeDiscount) || 0).toFixed(2)));
  const exchangeReplacementValue = Math.max(0, exchangeSubtotal - exchangeDiscountValue);
  const exchangeCollectionDue = Math.max(0, exchangeReplacementValue - returnQuote);
  const exchangeRefundDue = Math.max(0, returnQuote - exchangeReplacementValue);
  const exchangeCatalogVariants = useMemo(() => catalog.flatMap((product) =>
    (product.variants || []).map((variant) => ({
      productId: product.productId,
      productName: product.name,
      variantId: variant.variantId,
      variantName: variant.variantName,
      sku: variant.sku,
      sellingPrice: Number(variant.sellingPrice || 0),
      availableQuantity: Number(variant.availableQuantity || 0),
    }))
  ).filter((variant) => variant.productId && variant.variantId && variant.sellingPrice > 0),
  [catalog]);

  useEffect(() => {
    if (!pendingPayload || !catalog.length || cart.length) return;
    const restoredItems = pendingPayload.items.map((saved) => {
      for (const product of catalog) {
        const variant = (product.variants || []).find((item) => Number(item.variantId) === Number(saved.variantId));
        if (variant) return {
          productId: product.productId, variantId: variant.variantId,
          productName: product.name, variantName: variant.variantName, sku: variant.sku,
          imageUrl: product.imageUrl, unitPrice: Number(variant.sellingPrice),
          quantity: Number(saved.quantity), availableQuantity: Number(variant.availableQuantity),
        };
      }
      return null;
    });
    if (restoredItems.some((item) => !item)) {
      setError("An interrupted checkout was recovered, but one or more items are no longer in this location's catalog. Do not create a replacement sale; contact a manager to reconcile the original transaction.");
      return;
    }
    setCart(restoredItems);
    setCustomerName(pendingPayload.customerName || "");
    setCustomerPhone(pendingPayload.customerPhone || "");
    setDiscount(amount(pendingPayload.discountAmount));
    setPayments(pendingPayload.payments.map((payment) => ({
      paymentMethod: payment.paymentMethod,
      amount: amount(payment.amount),
      tenderedAmount: payment.paymentMethod === "CASH" ? amount(payment.tenderedAmount) : "",
      transactionReference: payment.transactionReference || "",
    })));
    setRetryPending(true);
    setNotice("An unfinished checkout was recovered from this browser tab. Verify the details and retry the exact same request.");
  }, [catalog, pendingPayload, cart.length]);

  useEffect(() => {
    if (pendingPayload) return;
    if (payments.length === 1) {
      setPayments((current) => current.length === 1 ? [{
        ...current[0],
        amount: amount(grandTotal),
        tenderedAmount: current[0].paymentMethod === "CASH"
          ? amount(Math.max(Number(current[0].tenderedAmount) || 0, grandTotal))
          : current[0].tenderedAmount,
      }] : current);
    }
  }, [grandTotal, payments.length]);

  const addToCart = (product, variant) => {
    if (variant.availableQuantity <= 0) return;
    setCart((current) => {
      const found = current.find((item) => item.variantId === variant.variantId);
      if (found) {
        if (found.quantity >= variant.availableQuantity) return current;
        return current.map((item) => item.variantId === variant.variantId
          ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, {
        productId: product.productId,
        variantId: variant.variantId,
        productName: product.name,
        variantName: variant.variantName,
        sku: variant.sku,
        imageUrl: product.imageUrl,
        unitPrice: Number(variant.sellingPrice),
        quantity: 1,
        availableQuantity: variant.availableQuantity,
      }];
    });
    setNotice(`${product.name} added to cart`);
  };

  const changeQuantity = (variantId, delta) => {
    setCart((current) => current.map((item) => item.variantId === variantId
      ? { ...item, quantity: Math.min(item.availableQuantity, Math.max(1, item.quantity + delta)) }
      : item));
  };

  const removeFromCart = (variantId) => setCart((current) => current.filter((item) => item.variantId !== variantId));

  const updatePayment = (index, field, value) => setPayments((current) =>
    current.map((payment, i) => {
      if (i !== index) return payment;
      if (field === "paymentMethod") {
        return {
          ...payment,
          paymentMethod: value,
          tenderedAmount: value === "CASH" ? (payment.tenderedAmount || "0.00") : "",
        };
      }
      return { ...payment, [field]: value };
    }));

  const addSplitPayment = () => {
    if (payments.length >= 3) return;
    const used = new Set(payments.map((p) => p.paymentMethod));
    const nextMethod = ["CASH", "UPI", "CARD"].find((method) => !used.has(method)) || "UPI";
    setPayments((current) => [...current, {
      paymentMethod: nextMethod, amount: "0.00", tenderedAmount: "", transactionReference: ""
    }]);
  };

  const removePayment = (index) => setPayments((current) => current.filter((_, i) => i !== index));

  const resetSale = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDiscount("0.00");
    setPayments([{ paymentMethod: "CASH", amount: "0.00", tenderedAmount: "0.00", transactionReference: "" }]);
    pendingKey.current = null;
    sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
    setPendingPayload(null);
    setRetryPending(false);
  };

  const completeSale = async () => {
    setError("");
    setNotice("");
    if (!pendingPayload) {
      if (locationStockCountLocked) { setError("A physical stock count is in progress at this location. Sales are temporarily frozen."); return; }
      if (!shift?.id || shift.status !== "OPEN") { setError("Open your cashier shift before completing a sale."); return; }
      if (!cart.length) { setError("Add at least one item before checkout."); return; }
      if (discountValue > subtotal) { setError("Discount cannot exceed the subtotal."); return; }
      if (Math.abs(paymentTotal - grandTotal) > 0.001) {
        setError("Payment amounts must add up exactly to the grand total."); return;
      }
      if (payments.some((p) => p.paymentMethod === "CASH" && (Number(p.tenderedAmount) || 0) < (Number(p.amount) || 0))) {
        setError("Cash received must be at least the cash payment amount."); return;
      }
      if (payments.some((p) => p.paymentMethod !== "CASH" && p.tenderedAmount !== "" && p.tenderedAmount != null)) {
        setError("Tendered amount is only valid for cash payments."); return;
      }
      if (!pendingKey.current) pendingKey.current = newIdempotencyKey();
    }
    const body = pendingPayload || {
      locationId: Number(locationId),
      shiftId: Number(shift.id),
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      discountAmount: Number(amount(discountValue)),
      idempotencyKey: pendingKey.current,
      items: cart.map((item) => ({
        productId: item.productId, variantId: item.variantId, quantity: item.quantity
      })),
      payments: payments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: Number(amount(payment.amount)),
        ...(payment.paymentMethod === "CASH" ? { tenderedAmount: Number(amount(payment.tenderedAmount)) } : {}),
        ...(payment.transactionReference.trim() ? { transactionReference: payment.transactionReference.trim() } : {}),
      })),
    };
    setPendingPayload(body);
    sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify({
      username: sessionStorage.getItem("adminUsername") || "",
      payload: body,
    }));

    setCheckoutLoading(true);
    try {
      const sale = await apiRequest("/admin/pos/checkout", { method: "POST", body: JSON.stringify(body) });
      pendingKey.current = null;
      sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
      setPendingPayload(null);
      setRetryPending(false);
      setReceipt(sale);
      resetSale();
      await Promise.all([loadCatalog(), loadCurrentShift()]);
      setNotice("Sale completed. Stock and cash drawer have been updated.");
    } catch (err) {
      if (!err.status || err.status >= 500 || err.status === 409) {
        setRetryPending(true);
      } else {
        pendingKey.current = null;
        sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
        setPendingPayload(null);
        setRetryPending(false);
      }
      if (err.status === 409) await loadCatalog();
      setError(`${err.message} Your cart is preserved.${!err.status || err.status >= 500 || err.status === 409 ? " Retry the exact same checkout; the same request key will be reused to prevent a duplicate sale." : " Correct the details and submit again."}`);
    } finally { setCheckoutLoading(false); }
  };

  const beginReturn = async () => {
    if (!selectedHistorySale) return;
    setReturnLoading(true);
    setError("");
    try {
      const rows = await apiRequest(`/admin/pos/sales/${selectedHistorySale.id}/returns`);
      setSaleReturns(Array.isArray(rows) ? rows : []);
      setReturnSale(selectedHistorySale);
      setExchangeMode(false);
      setReturnReason("");
      setReturnPassword("");
      setReturnQuantities({});
      setReturnDispositions({});
      setReturnDispositionReasons({});
      setReturnPaymentMethod("CASH");
      setReturnPaymentReference("");
      setReturnRetryPending(false);
      setReturnPendingPayload(null);
      returnPendingKey.current = null;
      setSelectedHistorySale(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setReturnLoading(false);
    }
  };

  const beginExchange = async () => {
    if (!selectedHistorySale) return;
    setReturnLoading(true);
    setError("");
    try {
      const rows = await apiRequest(`/admin/pos/sales/${selectedHistorySale.id}/returns`);
      setSaleReturns(Array.isArray(rows) ? rows : []);
      setReturnSale(selectedHistorySale);
      setReturnQuantities({});
      setReturnDispositions({});
      setReturnDispositionReasons({});
      setExchangeReason("");
      setExchangePassword("");
      setExchangeItems([]);
      setExchangeSelectedVariantId("");
      setExchangeDiscount("0.00");
      setExchangeCollectionMethod("CASH");
      setExchangeCollectionTendered("");
      setExchangeCollectionReference("");
      setExchangeRefundMethod("CASH");
      setExchangeRefundReference("");
      setExchangeRetryPending(false);
      setExchangePendingPayload(null);
      exchangePendingKey.current = null;
      setExchangeMode(true);
      setSelectedHistorySale(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setReturnLoading(false);
    }
  };

  const addExchangeItem = () => {
    const selected = exchangeCatalogVariants.find((item) => String(item.variantId) === String(exchangeSelectedVariantId));
    if (!selected) return;
    setExchangeItems((current) => {
      const existing = current.find((item) => item.variantId === selected.variantId);
      if (existing) return current.map((item) => item.variantId === selected.variantId
        ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...selected, quantity: 1 }];
    });
  };

  const updateExchangeQuantity = (variantId, quantity) => {
    const next = Math.max(1, Math.min(9999, Number(quantity) || 1));
    setExchangeItems((current) => current.map((item) => item.variantId === variantId ? { ...item, quantity: next } : item));
  };

  const submitExchange = async () => {
    if (!returnSale) return;
    const selectedItems = (returnSale.items || []).filter((item) => Number(returnQuantities[item.id] || 0) > 0);
    // Once an exchange request may have reached the server, only its saved immutable
    // payload is authoritative. Do not revalidate against a now-closed shift or
    // changed catalog/form state; the backend checks idempotency before new work.
    if (!exchangePendingPayload) {
      if (!shift?.id || shift.status !== "OPEN") { setError("Open an authorized shift before processing an exchange."); return; }
      if (!exchangeReason.trim()) { setError("An exchange reason is required."); return; }
      if (!selectedItems.length) { setError("Select at least one original sale quantity to exchange."); return; }
      if (!exchangeItems.length) { setError("Add at least one replacement item."); return; }
      if (exchangeDiscountValue > exchangeSubtotal) { setError("Replacement discount cannot exceed replacement subtotal."); return; }
      for (const item of selectedItems) {
        const disposition = returnDispositions[item.id] || "RESTOCK";
        if (disposition !== "RESTOCK" && !(returnDispositionReasons[item.id] || "").trim()) {
          setError("Explain why each damaged or discarded returned item cannot be restocked."); return;
        }
      }
      if (exchangeRefundDue > 0 && exchangeRefundMethod !== "CASH" && !exchangeRefundReference.trim()) {
        setError("Enter the completed UPI/card refund transaction reference."); return;
      }
      if (exchangeCollectionDue > 0 && exchangeCollectionMethod === "CASH"
          && (Number(exchangeCollectionTendered) || 0) < exchangeCollectionDue) {
        setError("Cash received must cover the amount due for the replacement."); return;
      }
      if (exchangeCollectionDue > 0 && exchangeCollectionMethod !== "CASH"
          && !exchangeCollectionReference.trim()) {
        setError("Enter the UPI/card transaction reference for the replacement collection."); return;
      }
    }
    if (!exchangePendingPayload) {
      exchangePendingKey.current = exchangePendingKey.current || newIdempotencyKey();
      const payload = {
        shiftId: Number(shift.id),
        reason: exchangeReason.trim(),
        idempotencyKey: exchangePendingKey.current,
        returnItems: selectedItems.map((item) => ({
          saleItemId: Number(item.id),
          quantity: Number(returnQuantities[item.id]),
          restockDisposition: returnDispositions[item.id] || "RESTOCK",
          dispositionReason: (returnDispositionReasons[item.id] || "").trim() || null,
        })),
        replacementItems: exchangeItems.map((item) => ({
          productId: Number(item.productId), variantId: Number(item.variantId), quantity: Number(item.quantity),
        })),
        replacementDiscountAmount: Number(amount(exchangeDiscountValue)),
        collectionPayments: exchangeCollectionDue > 0 ? [{
          paymentMethod: exchangeCollectionMethod,
          amount: Number(amount(exchangeCollectionDue)),
          ...(exchangeCollectionMethod === "CASH" ? { tenderedAmount: Number(amount(exchangeCollectionTendered)) } : {}),
          ...(exchangeCollectionReference.trim() ? { transactionReference: exchangeCollectionReference.trim() } : {}),
        }] : [],
        refundPayments: exchangeRefundDue > 0 ? [{
          paymentMethod: exchangeRefundMethod,
          amount: Number(amount(exchangeRefundDue)),
          ...(exchangeRefundMethod !== "CASH" ? { transactionReference: exchangeRefundReference.trim() } : {}),
        }] : [],
      };
      setExchangePendingPayload(payload);
      savePendingFinancialAction("nmk.pos.pending-exchange.v1", returnSale.id, payload);
    }
    const payload = exchangePendingPayload || {
      shiftId: Number(shift.id), reason: exchangeReason.trim(), idempotencyKey: exchangePendingKey.current,
      returnItems: selectedItems.map((item) => ({
        saleItemId: Number(item.id), quantity: Number(returnQuantities[item.id]),
        restockDisposition: returnDispositions[item.id] || "RESTOCK",
        dispositionReason: (returnDispositionReasons[item.id] || "").trim() || null,
      })),
      replacementItems: exchangeItems.map((item) => ({ productId: Number(item.productId), variantId: Number(item.variantId), quantity: Number(item.quantity) })),
      replacementDiscountAmount: Number(amount(exchangeDiscountValue)),
      collectionPayments: exchangeCollectionDue > 0 ? [{
        paymentMethod: exchangeCollectionMethod, amount: Number(amount(exchangeCollectionDue)),
        ...(exchangeCollectionMethod === "CASH" ? { tenderedAmount: Number(amount(exchangeCollectionTendered)) } : {}),
        ...(exchangeCollectionReference.trim() ? { transactionReference: exchangeCollectionReference.trim() } : {}),
      }] : [],
      refundPayments: exchangeRefundDue > 0 ? [{
        paymentMethod: exchangeRefundMethod, amount: Number(amount(exchangeRefundDue)),
        ...(exchangeRefundMethod !== "CASH" ? { transactionReference: exchangeRefundReference.trim() } : {}),
      }] : [],
    };
    setExchangeSaving(true);
    setError("");
    try {
      const authorizationToken = await authorizePosAction("POS_EXCHANGE", exchangePassword);
      const result = await apiRequest(`/admin/pos/sales/${returnSale.id}/exchange`, {
        method: "POST", headers: { "X-Admin-Action-Authorization": authorizationToken }, body: JSON.stringify(payload),
      });
      setReturnSale(null);
      setExchangeMode(false);
      setExchangeItems([]);
      setExchangePendingPayload(null);
      exchangePendingKey.current = null;
      sessionStorage.removeItem("nmk.pos.pending-exchange.v1");
      pendingExchangeRecord.current = null;
      setExchangeRetryPending(false);
      setExchangePassword("");
      let invoiceLoaded = false;
      try {
        const replacementSale = await apiRequest(`/admin/pos/sales/${result.replacementSaleId}`);
        setReceipt({
          ...replacementSale,
          exchangeCreditApplied: result.creditApplied,
          exchangeActualRefund: result.actualRefund,
          exchangeReference: result.id,
        });
        invoiceLoaded = true;
      } catch {
        // The exchange is already committed; invoice retrieval must not trigger an exchange retry.
      }
      setNotice(`Exchange #${result.id} recorded. Credit applied: ${money(result.creditApplied)}. Collected: ${money(result.amountCollected)}. Refunded: ${money(result.actualRefund)}.${invoiceLoaded ? " Replacement invoice is ready to print." : " Replacement invoice is available in sales history."}`);
      await Promise.all([loadCatalog(), loadCurrentShift(), loadHistory(historyPage)]);
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      setExchangeRetryPending(uncertain);
      if (!uncertain) {
        setExchangePendingPayload(null); exchangePendingKey.current = null;
        sessionStorage.removeItem("nmk.pos.pending-exchange.v1");
        pendingExchangeRecord.current = null;
      }
      setError(`${err.message}${uncertain ? " Retry the exact same exchange request; its idempotency key is retained." : ""}`);
    } finally { setExchangeSaving(false); }
  };

  const submitReturn = async () => {
    if (!returnSale) return;
    const selectedItems = (returnSale.items || []).filter((item) => Number(returnQuantities[item.id] || 0) > 0);
    // A retry must use the exact saved request even if the original shift has closed
    // or the editable form/catalog has since changed.
    if (!returnPendingPayload) {
      if (!shift?.id || shift.status !== "OPEN") {
        setError("Open your own cashier shift before processing a return.");
        return;
      }
      if (!returnReason.trim()) {
        setError("A return reason is required.");
        return;
      }
      if (!selectedItems.length) {
        setError("Select at least one quantity to return.");
        return;
      }
      for (const item of selectedItems) {
        const disposition = returnDispositions[item.id] || "RESTOCK";
        if (disposition !== "RESTOCK" && !(returnDispositionReasons[item.id] || "").trim()) {
          setError("Explain why each damaged or discarded item cannot be restocked.");
          return;
        }
      }
      if (returnQuote > 0 && returnPaymentMethod !== "CASH" && !returnPaymentReference.trim()) {
        setError("Enter the completed UPI/card refund transaction reference.");
        return;
      }
    }

    if (!returnPendingPayload) {
      returnPendingKey.current = returnPendingKey.current || newIdempotencyKey();
      const payload = {
        shiftId: Number(shift.id),
        reason: returnReason.trim(),
        idempotencyKey: returnPendingKey.current,
        items: selectedItems.map((item) => ({
          saleItemId: Number(item.id),
          quantity: Number(returnQuantities[item.id]),
          restockDisposition: returnDispositions[item.id] || "RESTOCK",
          dispositionReason: (returnDispositionReasons[item.id] || "").trim() || null,
        })),
        refundPayments: returnQuote > 0 ? [{
          paymentMethod: returnPaymentMethod,
          amount: Number(amount(returnQuote)),
          ...(returnPaymentMethod !== "CASH" ? { transactionReference: returnPaymentReference.trim() } : {}),
        }] : [],
      };
      setReturnPendingPayload(payload);
      savePendingFinancialAction("nmk.pos.pending-return.v1", returnSale.id, payload);
    }

    const payload = returnPendingPayload || {
      shiftId: Number(shift.id),
      reason: returnReason.trim(),
      idempotencyKey: returnPendingKey.current,
      items: selectedItems.map((item) => ({
        saleItemId: Number(item.id),
        quantity: Number(returnQuantities[item.id]),
        restockDisposition: returnDispositions[item.id] || "RESTOCK",
        dispositionReason: (returnDispositionReasons[item.id] || "").trim() || null,
      })),
      refundPayments: returnQuote > 0 ? [{
        paymentMethod: returnPaymentMethod,
        amount: Number(amount(returnQuote)),
        ...(returnPaymentMethod !== "CASH" ? { transactionReference: returnPaymentReference.trim() } : {}),
      }] : [],
    };

    setReturnSaving(true);
    setError("");
    try {
      const authorizationToken = await authorizePosAction("POS_RETURN", returnPassword);
      const record = await apiRequest(`/admin/pos/sales/${returnSale.id}/returns`, {
        method: "POST",
        headers: { "X-Admin-Action-Authorization": authorizationToken },
        body: JSON.stringify(payload),
      });
      setReturnSale(null);
      setReturnPendingPayload(null);
      returnPendingKey.current = null;
      sessionStorage.removeItem("nmk.pos.pending-return.v1");
      pendingReturnRecord.current = null;
      setReturnRetryPending(false);
      setReturnPassword("");
      setNotice(`Return ${record.returnNumber} recorded. Refund total: ${money(record.refundTotal)}.`);
      await Promise.all([loadCatalog(), loadCurrentShift(), loadHistory(historyPage)]);
    } catch (err) {
      const uncertain = !err.status || err.status >= 500 || err.status === 409;
      setReturnRetryPending(uncertain);
      if (!uncertain) {
        setReturnPendingPayload(null);
        returnPendingKey.current = null;
        sessionStorage.removeItem("nmk.pos.pending-return.v1");
        pendingReturnRecord.current = null;
      }
      setError(`${err.message}${uncertain ? " Retry the exact same return request; its original idempotency key is retained." : ""}`);
    } finally {
      setReturnSaving(false);
    }
  };

  const openHistorySale = async (sale) => {
    setSelectedHistorySale(sale);
    setSelectedSaleReturns(null);
    setSelectedSaleExchanges([]);
    setSaleReturnsLoading(true);
    try {
      const full = await apiRequest(`/admin/pos/sales/${sale.id}`);
      setSelectedHistorySale(full);
      const [rows, exchanges] = await Promise.all([
        apiRequest(`/admin/pos/sales/${sale.id}/returns`),
        apiRequest(`/admin/pos/sales/${sale.id}/exchange`),
      ]);
      setSelectedSaleReturns(Array.isArray(rows) ? rows : []);
      setSelectedSaleExchanges(Array.isArray(exchanges) ? exchanges : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaleReturnsLoading(false);
    }
  };

  const openReceiptFromHistory = () => {
    if (selectedHistorySale) {
      setReceipt(selectedHistorySale);
      setSelectedHistorySale(null);
    }
  };

  const formatDate = (value) => value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <main className="pos-app">
      <header className="pos-topbar">
        <div className="pos-brand">
          {staffRole === "ADMIN" && (
            <button type="button" className="pos-back-button" onClick={() => navigate("/admin/dashboard")} aria-label="Back to admin dashboard"><ArrowLeft size={18} /></button>
          )}
          <div><strong>NMK <span>OPTICALS</span></strong><small>POINT OF SALE</small></div>
        </div>
        <div className="pos-topbar-right">
          <label className="pos-location-picker"><Store size={17} /><span>Store</span>
            <select value={locationId} onChange={(e) => { invalidateProcurementCostReport(); setLocationId(e.target.value); setRegisterId(""); setShift(null); }} disabled={locationsLoading || !locations.length || retryPending}>
              {locations.length ? locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.code}</option>) : <option value="">No location</option>}
            </select>
          </label>
          <span className="pos-cashier"><UserRound size={16} /> {sessionStorage.getItem("adminUsername") || "Cashier"} · {staffRole}</span>
        </div>
      </header>

      <div className="pos-page">
        <div className="pos-heading-row">
          <div><span className="pos-eyebrow">STORE OPERATIONS</span><h1>Sales terminal</h1><p>Scan or search products, build the bill, collect payment and print the invoice.</p></div>
          <div className="pos-heading-actions">
            <button type="button" className={`pos-tab-button ${activeTab === "checkout" ? "active" : ""}`} onClick={() => setActiveTab("checkout")}><ShoppingCart size={17} /> New sale</button>
            {canManageInventory && <button type="button" className={`pos-tab-button ${activeTab === "inventory" ? "active" : ""}`} onClick={() => setActiveTab("inventory")}><Package size={17} /> Inventory</button>}
            {canViewHistory && <button type="button" className={`pos-tab-button ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}><History size={17} /> Sales history</button>}
            {canViewHistory && <button type="button" className={`pos-tab-button ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}><BarChart3 size={17} /> Reports</button>}
            {canViewHistory && <button type="button" className={`pos-tab-button ${activeTab === "inventory-report" ? "active" : ""}`} onClick={() => setActiveTab("inventory-report")}><ClipboardCheck size={17} /> Stock report</button>}
            {canViewHistory && <button type="button" className={`pos-tab-button ${activeTab === "shift-history" ? "active" : ""}`} onClick={() => setActiveTab("shift-history")}><Clock3 size={17} /> Shift history</button>}
            {canViewHistory && <button type="button" className={`pos-tab-button ${activeTab === "payment-review" ? "active" : ""}`} onClick={() => setActiveTab("payment-review")}><AlertCircle size={17} /> Payment exceptions</button>}
            {canViewHistory && <button type="button" className={`pos-tab-button ${activeTab === "stale-payment-review" ? "active" : ""}`} onClick={() => setActiveTab("stale-payment-review")}><Clock3 size={17} /> Payment review</button>}
          </div>
        </div>

        {error && <div className="pos-alert error" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
        {notice && <div className="pos-alert success" role="status"><CheckCircle2 size={18} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16} /></button></div>}

        {locationStockCountLocked && <div className="pos-alert error" role="alert"><AlertCircle size={18} /><span>Physical stock count in progress. Sales and stock movements are temporarily frozen at this location.</span></div>}

        <section className="pos-shift-panel">
          <div className="pos-shift-heading">
            <div>
              <span className="pos-eyebrow">CASH REGISTER</span>
              <h2>{shift?.status === "OPEN" ? "Shift is open" : shift?.status === "CLOSED" ? "Shift closed" : "Open a cashier shift"}</h2>
              <p>{shift?.status === "OPEN" ? `Opened by ${shift.openedByUsername} · ${new Date(shift.openedAt).toLocaleString("en-IN")}` : "A shift is required before the terminal can complete sales."}</p>
            </div>
            <span className={shift?.status === "OPEN" ? "pos-shift-status open" : "pos-shift-status closed"}>
              {shiftLoading ? "Checking…" : shift?.status || "NO OPEN SHIFT"}
            </span>
          </div>
          <div className="pos-shift-controls">
            <label>Register
              <select value={registerId} onChange={(event) => { setRegisterId(event.target.value); setShift(null); }} disabled={shiftLoading || shiftSaving || retryPending}>
                {registers.length ? registers.map((register) => <option key={register.id} value={register.id}>{register.registerCode} · {register.name}</option>) : <option value="">No register configured</option>}
              </select>
            </label>
            {pendingClosePayload ? (
              <div className="pos-pending-operation">
                <strong>Shift closure needs confirmation</strong>
                <p>Saved cash count: {money(pendingClosePayload.closingCashCount)}. Retry sends the exact same close request.</p>
                <button type="button" className="pos-button primary" onClick={closeShift} disabled={shiftSaving || shiftLoading}>
                  {shiftSaving ? "Confirming…" : "Retry shift close"}
                </button>
              </div>
            ) : (!shift?.id || shift.status === "CLOSED") ? (
              <>
                <label>Opening cash float (₹)
                  <input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} disabled={shiftSaving || !registerId} />
                </label>
                <button type="button" className="pos-button primary" onClick={openShift} disabled={shiftSaving || shiftLoading || !registerId}>
                  {shiftSaving ? "Opening…" : "Open shift"}
                </button>
              </>
            ) : (
              <>
                <div className="pos-shift-expected"><span>Expected drawer cash</span><strong>{money(shift.expectedCash)}</strong></div>
                <label>Cash counted (₹)
                  <input type="number" min="0" step="0.01" value={closingCashCount} onChange={(event) => setClosingCashCount(event.target.value)} disabled={shiftSaving || shift.status !== "OPEN" || retryPending} />
                </label>
                <label>Variance reason (required if different)
                  <input value={closingReason} onChange={(event) => setClosingReason(event.target.value)} maxLength={500} placeholder="Explain any cash difference" disabled={shiftSaving || shift.status !== "OPEN" || retryPending} />
                </label>
                <button type="button" className="pos-button secondary" onClick={closeShift} disabled={shiftSaving || shift.status !== "OPEN" || retryPending}>
                  {shiftSaving ? "Saving…" : "Close shift"}
                </button>
              </>
            )}
          </div>
          {shift?.status === "OPEN" && (
            <div className="pos-cash-movement-controls">
              <label>Cash drawer action
                <select value={cashMovementType} onChange={(event) => setCashMovementType(event.target.value)} disabled={shiftSaving}>
                  <option value="CASH_IN">Cash in</option>
                  <option value="CASH_OUT">Cash out</option>
                </select>
              </label>
              <label>Amount (₹)
                <input type="number" min="0.01" step="0.01" value={cashMovementAmount} onChange={(event) => setCashMovementAmount(event.target.value)} disabled={shiftSaving} />
              </label>
              <label>Reason
                <input value={cashMovementReason} onChange={(event) => setCashMovementReason(event.target.value)} maxLength={500} placeholder="Petty cash / bank drop / change float" disabled={shiftSaving} />
              </label>
              <button type="button" className="pos-button secondary" onClick={addCashMovement} disabled={shiftSaving}>
                {cashMovementType === "CASH_IN" ? "Record cash in" : "Record cash out"}
              </button>
            </div>
          )}
          {!registers.length && staffRole === "ADMIN" && (
            <div className="pos-register-create">
              <strong>Create the first register</strong>
              <input value={newRegisterCode} onChange={(event) => setNewRegisterCode(event.target.value)} maxLength={40} aria-label="Register code" />
              <input value={newRegisterName} onChange={(event) => setNewRegisterName(event.target.value)} maxLength={120} aria-label="Register name" />
              <button type="button" className="pos-button secondary" onClick={createRegister} disabled={shiftSaving}>Create register</button>
            </div>
          )}
          {shift?.status === "CLOSED" && (
            <p className="pos-shift-closed-note">This shift is closed. Open a new shift to continue selling. Final variance: {money(shift.cashVariance)}{shift.closingReason ? ` · ${shift.closingReason}` : ""}</p>
          )}
        </section>

        {activeTab === "checkout" ? (
          <div className="pos-workspace">
            <section className="pos-catalog-panel">
              <div className="pos-panel-heading">
                <div><h2>Product catalogue</h2><p>{catalog.length} products available at this store</p></div>
                <button type="button" className="pos-icon-button" onClick={loadCatalog} disabled={catalogLoading} aria-label="Refresh catalogue"><RefreshCw size={17} className={catalogLoading ? "pos-spin" : ""} /></button>
              </div>
              <div className="pos-search-wrap"><Search size={18} /><input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(event) => {
                  if (event.key !== "Enter" || !search.trim()) return;
                  const term = search.trim().toLowerCase();
                  const match = catalog.flatMap((product) => (product.variants || []).map((variant) => ({ product, variant })))
                    .find(({ variant }) => [variant.barcode, variant.sku].some((value) => value && String(value).toLowerCase() === term));
                  if (match && match.variant.availableQuantity > 0) {
                    addToCart(match.product, match.variant);
                    setSearch("");
                  }
                }} placeholder="Search product, SKU or barcode…" aria-label="Search products or scan barcode" /><ScanLine size={17} className="pos-search-hint" /></div>
              <div className="pos-category-list">
                {categories.map((item) => <button key={item} type="button" className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              {catalogLoading || locationsLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading store catalogue…</span></div>
                : !locationId ? <div className="pos-empty-state"><Store /><strong>Store location required</strong><span>Configure an active inventory location to start selling.</span></div>
                : filteredProducts.length === 0 ? <div className="pos-empty-state"><Search /><strong>No matching products</strong><span>Try another search or category.</span></div>
                : <div className="pos-product-grid">
                  {filteredProducts.map((product) => {
                    const variants = product.variants || [];
                    const selectedId = selectedVariants[product.productId] ?? variants[0]?.variantId;
                    const variant = variants.find((v) => v.variantId === selectedId) || variants[0];
                    const cartQty = cart.find((item) => item.variantId === variant?.variantId)?.quantity || 0;
                    return <article className="pos-product-card" key={product.productId}>
                      <div className="pos-product-image"><ProductImage src={product.imageUrl} name={product.name} /><span className={variant?.availableQuantity > 0 ? "in-stock" : "out-stock"}>{variant?.availableQuantity > 0 ? `${variant.availableQuantity} available` : "Out of stock"}</span></div>
                      <div className="pos-product-info">
                        <span className="pos-product-category">{product.category || "Product"} · {product.gender || "Unisex"}</span>
                        <h3>{product.name}</h3>
                        <label className="pos-variant-label">Variant
                          <select value={variant?.variantId || ""} onChange={(e) => setSelectedVariants((current) => ({ ...current, [product.productId]: Number(e.target.value) }))}>
                            {variants.map((v) => <option key={v.variantId} value={v.variantId}>{v.variantName || v.sku} · {v.sku}</option>)}
                          </select>
                        </label>
                        {variant && <div className="pos-product-bottom"><strong>{money(variant.sellingPrice)}</strong><button type="button" className="pos-add-button" disabled={retryPending || variant.availableQuantity <= cartQty} onClick={() => addToCart(product, variant)}><Plus size={16} /> {cartQty ? `Add more (${cartQty})` : "Add"}</button></div>}
                      </div>
                    </article>;
                  })}
                </div>}
            </section>

            <aside className="pos-cart-panel">
              <div className="pos-panel-heading">
                <div><h2>Current bill <span className="pos-count">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></h2><p>Items in this transaction</p></div>
                {cart.length > 0 && <button type="button" className="pos-text-button" onClick={() => { setCart([]); pendingKey.current = null; setPendingPayload(null); setRetryPending(false); }} disabled={retryPending}>Clear all</button>}
              </div>
              {cart.length === 0 ? <div className="pos-cart-empty"><ShoppingCart size={34} /><strong>Your bill is empty</strong><span>Select a product and variant to add it here.</span></div> :
                <div className="pos-cart-items">{cart.map((item) => <div className="pos-cart-item" key={item.variantId}>
                  <div className="pos-cart-item-main"><div><strong>{item.productName}</strong><span>{item.variantName || item.sku}</span><small>{item.sku}</small></div><button type="button" className="pos-remove-button" onClick={() => removeFromCart(item.variantId)} disabled={retryPending} aria-label={`Remove ${item.productName}`}><Trash2 size={16} /></button></div>
                  <div className="pos-cart-item-bottom"><div className="pos-quantity-control"><button type="button" onClick={() => changeQuantity(item.variantId, -1)} disabled={retryPending || item.quantity <= 1} aria-label="Decrease quantity"><Minus size={14} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.variantId, 1)} disabled={retryPending || item.quantity >= item.availableQuantity} aria-label="Increase quantity"><Plus size={14} /></button></div><strong>{money(item.unitPrice * item.quantity)}</strong></div>
                </div>)}</div>}

              <div className="pos-cart-form">
                <div className="pos-form-section-title"><UserRound size={16} /> Customer details <span>Optional</span></div>
                <div className="pos-customer-fields"><input value={customerName} disabled={retryPending} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" maxLength={150} /><input value={customerPhone} disabled={retryPending} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number" maxLength={30} inputMode="tel" /></div>
                <div className="pos-discount-row"><label htmlFor="pos-discount">Discount (₹)</label><input id="pos-discount" type="number" min="0" max={subtotal} step="0.01" value={discount} disabled={retryPending || !canApplyDiscount} onChange={(e) => setDiscount(e.target.value)} /></div>
                {!canApplyDiscount && <p className="pos-retry-note">Sale discounts require ADMIN or MANAGER approval.</p>}
              </div>

              <div className="pos-totals">
                <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                <div><span>Discount</span><strong className="discount-value">− {money(discountValue)}</strong></div>
                <div className="pos-grand-total"><span>Amount due</span><strong>{money(grandTotal)}</strong></div>
              </div>

              <div className="pos-payment-section">
                <div className="pos-form-section-title"><CreditCard size={16} /> Payment method</div>
                {payments.map((payment, index) => <div className="pos-payment-row" key={index}>
                  <div className="pos-payment-row-heading"><select aria-label="Payment method" value={payment.paymentMethod} disabled={retryPending} onChange={(e) => updatePayment(index, "paymentMethod", e.target.value)}>
                    <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
                  </select>{payments.length > 1 && <button type="button" className="pos-remove-button" onClick={() => removePayment(index)} disabled={retryPending} aria-label="Remove payment method"><X size={15} /></button>}</div>
                  <div className="pos-payment-inputs">
                    <label>Amount<input type="number" min="0" step="0.01" value={payment.amount} disabled={retryPending} onChange={(e) => updatePayment(index, "amount", e.target.value)} /></label>
                    {payment.paymentMethod === "CASH" ? <label>Cash received<input type="number" min="0" step="0.01" value={payment.tenderedAmount} disabled={retryPending} onChange={(e) => updatePayment(index, "tenderedAmount", e.target.value)} /></label>
                      : <label>UPI / card transaction reference<input value={payment.transactionReference} disabled={retryPending} required onChange={(e) => updatePayment(index, "transactionReference", e.target.value)} placeholder="Enter UTR or card terminal reference" maxLength={150} /></label>}
                  </div>
                </div>)}
                {(payments.some((payment) => payment.paymentMethod === "UPI" || payment.paymentMethod === "CARD")) && (
                  <p className="pos-retry-note">For UPI or card, collect payment using the shop's QR code or card terminal, verify it succeeded, and enter its UTR / terminal reference. This POS records the tender; it does not initiate or independently verify provider settlement.</p>
                )}
                {payments.length < 3 && <button type="button" className="pos-add-split" onClick={addSplitPayment} disabled={retryPending}><Plus size={15} /> Add split payment</button>}
                <div className={Math.abs(paymentTotal - grandTotal) < 0.001 ? "pos-payment-match" : "pos-payment-mismatch"}><span>Payment total</span><strong>{money(paymentTotal)}</strong></div>
                {cashChange > 0 && <div className="pos-change-row"><span>Change to return</span><strong>{money(cashChange)}</strong></div>}
              </div>

              <button type="button" className="pos-complete-button" onClick={completeSale} disabled={checkoutLoading || !cart.length || !locationId || locationStockCountLocked || !shift?.id || shift.status !== "OPEN" || Math.abs(paymentTotal - grandTotal) > 0.001}>
                {checkoutLoading ? <><RefreshCw className="pos-spin" size={18} /> Processing sale…</> : retryPending ? <><RefreshCw size={18} /> Retry same checkout · {money(pendingPayload ? pendingPayload.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) : grandTotal)}</> : <><Receipt size={18} /> Complete sale · {money(grandTotal)}</>}
              </button>
              <p className="pos-secure-note">Prices and stock are verified by the server. Completed sales are recorded with an audit trail.</p>
            </aside>
          </div>
        ) : activeTab === "inventory" ? (
          <InventoryPanel locationId={locationId} catalog={catalog} onRefreshCatalog={loadCatalog} onNotice={setNotice} onError={setError} />
        ) : activeTab === "shift-history" ? (
          <section className="pos-history-panel pos-report-panel">
            <div className="pos-panel-heading">
              <div><h2>Register shift reconciliation</h2><p>Daily cash totals are recalculated from the append-only drawer movement ledger. Managers and administrators only.</p></div>
              <div className="pos-cash-reconciliation-filter">
                <label>Business date
                  <input type="date" value={cashReconciliationDate} onChange={(event) => setCashReconciliationDate(event.target.value)} />
                </label>
                <button type="button" className="pos-button secondary compact" onClick={() => { loadShiftHistory(); loadDailyCashReconciliation(); }} disabled={shiftHistoryLoading || cashReconciliationLoading}>
                  <RefreshCw size={15} className={shiftHistoryLoading || cashReconciliationLoading ? "pos-spin" : ""} /> Refresh
                </button>
              </div>
            </div>
            {cashReconciliationLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Recalculating daily cash reconciliation…</span></div>
              : cashReconciliation ? <>
                <div className="pos-report-summary">
                  <article><span>Shifts</span><strong>{cashReconciliation.shiftCount}</strong></article>
                  <article><span>Expected drawer cash</span><strong>{money(cashReconciliation.expectedCashTotal)}</strong></article>
                  <article><span>Counted cash · closed shifts</span><strong>{money(cashReconciliation.countedCashTotal)}</strong></article>
                  <article><span>Net cash variance</span><strong>{money(cashReconciliation.varianceTotal)}</strong></article>
                  <article><span>Open / closed</span><strong>{cashReconciliation.openShiftCount} / {cashReconciliation.closedShiftCount}</strong></article>
                  <article><span>Shifts needing review</span><strong>{cashReconciliation.discrepancyCount}</strong></article>
                </div>
                <p className="pos-report-note">Expected cash is recomputed from opening float, cash tenders, cash-in, cash-out and cash refunds. Open shifts have no counted cash yet. A ledger consistency mismatch or non-zero closing variance requires review.</p>
                {!cashReconciliation.shifts?.length && <div className="pos-empty-state"><Clock3 /><span>No shifts opened on this business date.</span></div>}
                {!!cashReconciliation.shifts?.length && <div className="pos-history-table-wrap"><table className="pos-history-table">
                  <thead><tr><th>Register / shift</th><th>Cashier</th><th>Opened / closed</th><th>Expected from ledger</th><th>Recorded expected</th><th>Counted</th><th>Recalculated variance</th><th>Ledger check</th></tr></thead>
                  <tbody>{cashReconciliation.shifts.map((row) => <tr key={row.shiftId}>
                    <td><strong>{row.registerCode}</strong><small>Shift #{row.shiftId}</small></td>
                    <td>{row.cashierUsername}</td>
                    <td>{row.openedAt ? new Date(row.openedAt).toLocaleString("en-IN") : "—"}<small>{row.closedAt ? new Date(row.closedAt).toLocaleString("en-IN") : "Still open"}</small></td>
                    <td>{money(row.ledgerExpectedCash)}</td>
                    <td>{row.recordedExpectedCash == null ? "—" : money(row.recordedExpectedCash)}</td>
                    <td>{row.countedCash == null ? "—" : money(row.countedCash)}</td>
                    <td><strong>{row.calculatedVariance == null ? "—" : money(row.calculatedVariance)}</strong></td>
                    <td><span className={row.ledgerConsistent && (row.calculatedVariance == null || Number(row.calculatedVariance) === 0) ? "pos-stock-status healthy" : "pos-stock-status low"}>{!row.ledgerConsistent ? "Ledger mismatch" : row.calculatedVariance != null && Number(row.calculatedVariance) !== 0 ? "Variance" : row.status}</span><small>{row.closingReason || "—"}</small></td>
                  </tr>)}</tbody>
                </table></div>}
              </> : <div className="pos-empty-state"><Clock3 /><span>Choose a business date and refresh to calculate drawer totals.</span></div>}
            {shiftHistoryLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading register shifts…</span></div>
              : !shiftHistory.length ? <div className="pos-empty-state"><Clock3 /><strong>No shifts recorded</strong><span>Register opening and closing reconciliations will appear here.</span></div>
                : <div className="pos-history-table-wrap"><table className="pos-history-table">
                  <thead><tr><th>Register</th><th>Cashier</th><th>Opened</th><th>Closed</th><th>Opening float</th><th>Expected cash</th><th>Counted cash</th><th>Variance</th><th>Status / reason</th></tr></thead>
                  <tbody>{shiftHistory.map((row) => <tr key={row.id}>
                    <td><strong>{row.registerCode}</strong><small>Shift #{row.id}</small></td>
                    <td>{row.openedByUsername}<small>{row.closedByUsername ? `Closed by ${row.closedByUsername}` : "Not yet closed"}</small></td>
                    <td>{row.openedAt ? new Date(row.openedAt).toLocaleString("en-IN") : "—"}</td>
                    <td>{row.closedAt ? new Date(row.closedAt).toLocaleString("en-IN") : "—"}</td>
                    <td>{money(row.openingFloat)}</td><td>{money(row.expectedCash)}</td><td>{row.closingCashCount == null ? "—" : money(row.closingCashCount)}</td>
                    <td><strong>{row.cashVariance == null ? "—" : money(row.cashVariance)}</strong></td>
                    <td><span className={row.status === "OPEN" ? "pos-stock-status low" : "pos-stock-status healthy"}>{row.status}</span><small>{row.closingReason || "—"}</small></td>
                  </tr>)}</tbody>
                </table></div>}
            {shiftHistoryHasMore && !shiftHistoryLoading && <div className="pos-procurement-history-actions">
              <button type="button" className="pos-button secondary compact" onClick={loadMoreShiftHistory} disabled={shiftHistoryMoreLoading}>
                {shiftHistoryMoreLoading ? "Loading…" : "Load more shifts"}
              </button>
            </div>}
          </section>
        ) : activeTab === "inventory-report" ? (
          <section className="pos-history-panel pos-report-panel">
            <div className="pos-panel-heading">
              <div><h2>Inventory on-hand report</h2><p>Quantity-only snapshot for the selected location. Cost valuation and profit are intentionally excluded until unit-cost data is verified.</p></div>
              <button type="button" className="pos-button secondary compact" onClick={loadInventoryReport} disabled={inventoryReportLoading}>
                <RefreshCw size={15} className={inventoryReportLoading ? "pos-spin" : ""} /> Refresh
              </button>
            </div>
            {inventoryReportLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading inventory balances…</span></div>
              : !inventoryReport ? <div className="pos-empty-state"><Package /><strong>No inventory report loaded</strong><span>Refresh to load the selected location's stock balances.</span></div>
              : <>
                <div className="pos-report-summary pos-inventory-report-summary">
                  <article><span>Variants tracked</span><strong>{inventoryReport.variantCount}</strong></article>
                  <article><span>On hand</span><strong>{inventoryReport.onHandQuantity}</strong></article>
                  <article><span>Reserved</span><strong>{inventoryReport.reservedQuantity}</strong></article>
                  <article><span>Available</span><strong>{inventoryReport.availableQuantity}</strong></article>
                  <article><span>Low stock variants</span><strong>{inventoryReport.lowStockCount}</strong></article>
                </div>
                <p className="pos-retry-note">Showing variants with a stock balance at {inventoryReport.locationName} ({inventoryReport.locationCode}). Available quantity is on-hand minus reserved.</p>
                <section className="pos-report-table-section"><h3>Stock by product variant</h3>
                  <div className="pos-history-table-wrap"><table className="pos-history-table">
                    <thead><tr><th>Product</th><th>Variant / SKU</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Reorder level</th><th>Status</th></tr></thead>
                    <tbody>{(inventoryReport.items || []).map((row) => <tr key={row.variantId}>
                      <td><strong>{row.productName}</strong></td>
                      <td>{row.variantName || "—"}<small>{row.sku}</small></td>
                      <td>{row.onHandQuantity}</td><td>{row.reservedQuantity}</td><td><strong>{row.availableQuantity}</strong></td><td>{row.reorderLevel}</td>
                      <td><span className={row.lowStock ? "pos-stock-status low" : "pos-stock-status healthy"}>{row.lowStock ? "Low stock" : "In range"}</span></td>
                    </tr>)}</tbody>
                  </table></div>
                  <p className="pos-retry-note">Showing {(inventoryReport.items || []).length} of {inventoryReport.totalItems ?? inventoryReport.variantCount} variants.</p>
                  {inventoryReport.itemsHasNext && <div className="pos-procurement-history-actions">
                    <button type="button" className="pos-button secondary compact" onClick={loadMoreInventoryReportEntries} disabled={inventoryReportMoreLoading}>
                      {inventoryReportMoreLoading ? "Loading…" : "Load more variants"}
                    </button>
                  </div>}
                </section>
              </>}
          </section>
        ) : activeTab === "payment-review" ? (
          <WebhookReviewPanel />
        ) : activeTab === "stale-payment-review" ? (
          <StalePaymentCreationReviewPanel />
        ) : activeTab === "reports" ? (
          <section className="pos-history-panel pos-report-panel">
            <div className="pos-panel-heading">
              <div><h2>Sales and refund reports</h2><p>Completed POS sales and returns processed during the selected period. No tax or profit calculations are included.</p></div>
              <button type="button" className="pos-button secondary compact" onClick={loadSalesReport} disabled={reportLoading}><RefreshCw size={15} className={reportLoading ? "pos-spin" : ""} /> Refresh</button>
            </div>
            <div className="pos-report-filters">
              <label>From<input type="date" value={reportFrom} onChange={(event) => { invalidateProcurementCostReport(); setReportFrom(event.target.value); }} /></label>
              <label>To<input type="date" value={reportTo} onChange={(event) => { invalidateProcurementCostReport(); setReportTo(event.target.value); }} /></label>
              <button type="button" className="pos-button primary" onClick={loadSalesReport} disabled={reportLoading || !reportFrom || !reportTo || reportTo < reportFrom}>Run report</button>
            </div>
            {reportLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Calculating report…</span></div>
              : !salesReport ? <div className="pos-empty-state"><BarChart3 /><strong>No report loaded</strong><span>Choose a date range and run the report.</span></div>
                : <>
                  <div className="pos-report-summary">
                    <article><span>Transactions</span><strong>{salesReport.transactionCount}</strong></article>
                    <article><span>Subtotal</span><strong>{money(salesReport.subtotal)}</strong></article>
                    <article><span>Discounts</span><strong>{money(salesReport.discounts)}</strong></article>
                    <article><span>Sales after discount</span><strong>{money(salesReport.netSalesBeforeRefunds)}</strong></article>
                    <article><span>Full void reversals</span><strong>{money(salesReport.salesReversals ?? 0)}</strong></article>
                    <article><span>Recorded refund allocations</span><strong>{money(salesReport.recordedRefundPayments ?? salesReport.refunds)}</strong></article>
                    <article><span>Exchange credit applied</span><strong>{money(salesReport.exchangeCreditApplied ?? 0)}</strong></article>
                    <article><span>Net after returns and voids</span><strong>{money(salesReport.netSalesAfterRefunds)}</strong></article>
                  </div>
                  <p className="pos-report-note">UPI/card refund amounts are recorded references, not provider-confirmed settlements. Refunds are grouped by the date processed; full-sale reversals include completed voids only; ordinary customer returns are included in refunds but not full-sale reversals. Exchange credit is reported separately and is not a cash or payment-provider refund.</p>
                  <div className="pos-report-grid">
                    <section><h3>Sales by payment method</h3>
                      {Object.keys(salesReport.salesByPaymentMethod || {}).length ? Object.entries(salesReport.salesByPaymentMethod).map(([method, total]) => <div className="pos-report-row" key={method}><span>{method}</span><strong>{money(total)}</strong></div>) : <p>No sales tenders.</p>}
                    </section>
                    <section><h3>Refunds by payment method</h3>
                      {Object.keys(salesReport.refundsByPaymentMethod || {}).length ? Object.entries(salesReport.refundsByPaymentMethod).map(([method, total]) => <div className="pos-report-row" key={method}><span>{method}</span><strong>{money(total)}</strong></div>) : <p>No refunds in this period.</p>}
                    </section>
                  </div>
                  <section className="pos-report-table-section"><h3>Cashier totals</h3>
                    <div className="pos-history-table-wrap"><table className="pos-history-table"><thead><tr><th>Cashier</th><th>Transactions</th><th>Subtotal</th><th>Discounts</th><th>Net sales</th></tr></thead><tbody>
                      {(salesReport.cashiers || []).map((row) => <tr key={row.cashierUsername}><td>{row.cashierUsername}</td><td>{row.transactionCount}</td><td>{money(row.subtotal)}</td><td>{money(row.discounts)}</td><td><strong>{money(row.netSales)}</strong></td></tr>)}
                    </tbody></table></div>
                  </section>
                  <section className="pos-report-table-section"><h3>Daily totals</h3>
                    <div className="pos-history-table-wrap"><table className="pos-history-table"><thead><tr><th>Date</th><th>Transactions</th><th>Sales</th><th>Returns</th><th>Refunds</th><th>Net after refunds</th></tr></thead><tbody>
                      {(salesReport.daily || []).map((row) => <tr key={row.date}><td>{row.date}</td><td>{row.transactionCount}</td><td>{money(row.netSales)}</td><td>{row.returnCount}</td><td>{money(row.refunds)}</td><td><strong>{money(row.netAfterRefunds)}</strong></td></tr>)}
                    </tbody></table></div>
                  </section>
                  <section className="pos-report-table-section"><h3>Top products</h3>
                    <div className="pos-history-table-wrap"><table className="pos-history-table"><thead><tr><th>Product</th><th>Gross qty sold</th><th>Gross line total</th></tr></thead><tbody>
                      {(salesReport.topProducts || []).map((row) => <tr key={row.productId}><td>{row.productName}</td><td>{row.quantitySold}</td><td><strong>{money(row.grossLineTotal)}</strong></td></tr>)}
                    </tbody></table></div>
                  </section>
                </>}
            <section className="pos-procurement-cost-report">
              <div className="pos-panel-heading">
                <div><h2>Procurement cost report</h2><p>Recorded goods receipts less supplier returns, using the unit costs entered on purchase orders. Freight, tax, discounts, credit notes and other landed-cost allocations are excluded. This is not verified supplier-invoice cost, inventory valuation, supplier payments, COGS or profit.</p></div>
                <button type="button" className="pos-button secondary compact" onClick={loadProcurementCostReport} disabled={procurementCostReportLoading}>
                  <RefreshCw size={15} className={procurementCostReportLoading ? "pos-spin" : ""} /> Refresh
                </button>
              </div>
              <div className="pos-report-filters">
                <label>From<input type="date" value={reportFrom} onChange={(event) => { invalidateProcurementCostReport(); setReportFrom(event.target.value); }} /></label>
                <label>To<input type="date" value={reportTo} onChange={(event) => { invalidateProcurementCostReport(); setReportTo(event.target.value); }} /></label>
                <button type="button" className="pos-button primary" onClick={loadProcurementCostReport} disabled={procurementCostReportLoading || !reportFrom || !reportTo || reportTo < reportFrom}>Run cost report</button>
              </div>
              {procurementCostReportLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Calculating recorded procurement costs…</span></div>
                : !procurementCostReport ? <div className="pos-empty-state"><Package /><strong>No procurement cost report loaded</strong><span>Choose a date range and run the report.</span></div>
                  : <>
                    <div className="pos-report-summary">
                      <article><span>Received units</span><strong>{procurementCostReport.receivedQuantity}</strong></article>
                      <article><span>Returned units</span><strong>{procurementCostReport.returnedQuantity}</strong></article>
                      <article><span>Recorded received cost</span><strong>{money(procurementCostReport.receivedCost)}</strong></article>
                      <article><span>Recorded supplier returns</span><strong>{money(procurementCostReport.returnedCost)}</strong></article>
                      <article><span>Net recorded procurement cost</span><strong>{money(procurementCostReport.netRecordedProcurementCost)}</strong></article>
                    </div>
                    <div className="pos-history-table-wrap"><table className="pos-history-table">
                      <thead><tr><th>Type</th><th>Reference</th><th>Purchase order</th><th>Supplier</th><th>SKU</th><th>Qty</th><th>Unit cost</th><th>Total cost</th><th>Recorded by</th><th>Date</th></tr></thead>
                      <tbody>{(procurementCostReport.entries || []).map((row, index) => <tr key={row.type + "-" + row.reference + "-" + row.sku + "-" + index}>
                        <td>{row.type === "RECEIVED" ? "Goods received" : "Supplier return"}</td><td><strong>{row.reference}</strong></td><td>{row.purchaseOrderNumber}</td><td>{row.supplierName}</td><td>{row.sku}</td>
                        <td>{row.quantity}</td><td>{money(row.unitCost)}</td><td><strong>{money(row.totalCost)}</strong></td><td>{row.recordedBy}</td><td>{row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN") : "—"}</td>
                      </tr>)}</tbody>
                    </table></div>
                    <div className="pos-history-pagination">
                      <span>Showing {(procurementCostReport.entries || []).length} of {procurementCostReport.totalEntries || 0} cost entries</span>
                      {procurementCostReport.entriesHasNext && (
                        <button type="button" className="pos-button secondary compact"
                          onClick={loadMoreProcurementCostReportEntries}
                          disabled={procurementCostReportMoreLoading}>
                          {procurementCostReportMoreLoading ? "Loading…" : "Load more entries"}
                        </button>
                      )}
                    </div>
                  </>}
            </section>
          </section>
        ) : (
          <section className="pos-history-panel">
            <div className="pos-panel-heading"><div><h2>Sales history</h2><p>Completed in-store transactions for the selected location.</p></div><button type="button" className="pos-button secondary compact" onClick={() => loadHistory(historyPage)} disabled={historyLoading}><RefreshCw size={16} className={historyLoading ? "pos-spin" : ""} /> Refresh</button></div>
            {historyLoading ? <div className="pos-empty-state"><RefreshCw className="pos-spin" /><span>Loading sales…</span></div> : history.length === 0 ? <div className="pos-empty-state"><History /><strong>No sales found</strong><span>Completed POS transactions will appear here.</span></div> :
              <div className="pos-history-table-wrap"><table className="pos-history-table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th>Amount</th><th></th></tr></thead><tbody>{history.map((sale) => <tr key={sale.id}>
                <td><strong>{sale.invoiceNumber}</strong><small>#{sale.id}</small></td><td>{formatDate(sale.createdAt)}</td><td>{sale.customerName || "Walk-in"}<small>{sale.customerPhone || "No phone"}</small></td><td>{(sale.payments || []).map((p) => p.paymentMethod).join(" + ") || "—"}</td><td><strong>{money(sale.grandTotal)}</strong></td><td><button type="button" className="pos-view-button" onClick={() => openHistorySale(sale)}>View receipt</button></td>
              </tr>)}</tbody></table></div>}
            <div className="pos-pagination"><span>Page {historyPages ? historyPage + 1 : 0} of {historyPages}</span><div><button type="button" disabled={historyPage <= 0 || historyLoading} onClick={() => loadHistory(historyPage - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button><button type="button" disabled={historyPage + 1 >= historyPages || historyLoading} onClick={() => loadHistory(historyPage + 1)} aria-label="Next page"><ChevronRight size={18} /></button></div></div>
          </section>
        )}
      </div>

      {selectedHistorySale && <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedHistorySale(null); }}>
        <section className="pos-history-modal" role="dialog" aria-modal="true" aria-labelledby="pos-history-title">
          <div className="pos-modal-toolbar"><div><span className="pos-eyebrow">TRANSACTION DETAILS</span><h2 id="pos-history-title">{selectedHistorySale.invoiceNumber}</h2></div><button type="button" className="pos-icon-button" onClick={() => setSelectedHistorySale(null)} aria-label="Close details"><X /></button></div>
          <div className="pos-history-detail-grid"><div><span>Customer</span><strong>{selectedHistorySale.customerName || "Walk-in"}</strong></div><div><span>Phone</span><strong>{selectedHistorySale.customerPhone || "—"}</strong></div><div><span>Cashier</span><strong>{selectedHistorySale.cashierUsername}</strong></div><div><span>Date</span><strong>{formatDate(selectedHistorySale.createdAt)}</strong></div><div><span>Total</span><strong>{money(selectedHistorySale.grandTotal)}</strong></div></div>
          {selectedSaleExchanges.length > 0 && <section className="pos-exchange-history">
            <h3>Exchange history</h3>
            {selectedSaleExchanges.map((exchange) => <div className="pos-exchange-history-row" key={exchange.id}>
              <div><strong>Exchange #{exchange.id}</strong><small>{formatDate(exchange.createdAt)} · {exchange.processedByUsername}</small><small>{exchange.reason}</small><small>Return {exchange.returnNumber} · Shift #{exchange.shiftId}</small></div>
              <div><span>Replacement</span><strong>{exchange.replacementInvoiceNumber}</strong></div>
              <div><span>Returned</span><strong>{money(exchange.returnedValue)}</strong></div>
              <div><span>Replacement value</span><strong>{money(exchange.replacementValue)}</strong></div>
              <div><span>Credit</span><strong>{money(exchange.creditApplied)}</strong></div>
              <div><span>Collected / refunded</span><strong>{money(exchange.amountCollected)} / {money(exchange.actualRefund)}</strong></div>
            </div>)}
          </section>}
          <div className="pos-modal-actions">
            <button type="button" className="pos-button secondary" onClick={() => setSelectedHistorySale(null)}>Close</button>
            {canViewHistory && <button type="button" className="pos-button secondary" onClick={beginReturn} disabled={returnLoading}>{returnLoading ? "Loading…" : "Process return"}</button>}
            {canViewHistory && shift?.status === "OPEN" && <button type="button" className="pos-button secondary" onClick={beginExchange} disabled={returnLoading || locationStockCountLocked}>{returnLoading ? "Loading…" : "Process exchange"}</button>}
            {canViewHistory && shift?.status === "OPEN" && selectedSaleReturns?.length === 0 &&
              <button type="button" className="pos-button secondary" onClick={() => openVoidDialog(selectedHistorySale)} disabled={saleReturnsLoading}>Void full sale</button>}
            {canViewHistory && selectedSaleReturns?.length > 0 &&
              <p className="pos-return-note">Full void unavailable: this sale already has a return or void record.</p>}
            {canViewHistory && saleReturnsLoading && <span className="pos-retry-note">Checking return history…</span>}
            <button type="button" className="pos-button primary" onClick={openReceiptFromHistory}><Printer size={17} /> Print invoice</button>
          </div>
        </section>
      </div>}
      {returnSale && !exchangeMode && (
        <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !returnSaving && !returnRetryPending) setReturnSale(null);
        }}>
          <section className="pos-return-modal" role="dialog" aria-modal="true" aria-labelledby="pos-return-title">
            <div className="pos-modal-toolbar">
              <div><span className="pos-eyebrow">CUSTOMER RETURN</span><h2 id="pos-return-title">{returnSale.invoiceNumber}</h2></div>
              <button type="button" className="pos-icon-button" onClick={() => setReturnSale(null)} disabled={returnSaving || returnRetryPending} aria-label="Close return"><X /></button>
            </div>
            <p className="pos-return-note">Return quantities are checked against the original sale and previous returns. Only resaleable items marked RESTOCK will increase stock.</p>
            {error && <p className="pos-return-error" role="alert">{error}</p>}
            <label className="pos-return-field">Confirm staff password
              <input type="password" autoComplete="current-password" value={returnPassword}
                onChange={(event) => setReturnPassword(event.target.value)} disabled={returnSaving}
                placeholder="Password required for this return" />
            </label>
            <p className="pos-retry-note">A fresh one-time authorization is required for each return, including retries.</p>
            <div className="pos-return-lines">
              <table>
                <thead><tr><th>Item</th><th>Sold</th><th>Remaining</th><th>Return qty</th><th>Disposition</th></tr></thead>
                <tbody>
                  {(returnSale.items || []).map((item) => {
                    const info = getReturnLineInfo(item);
                    return <tr key={item.id}>
                      <td><strong>{item.productName}</strong><small>{item.variantName || item.sku}</small></td>
                      <td>{item.quantity}</td>
                      <td>{info.remaining}</td>
                      <td><input type="number" min="0" max={info.remaining} step="1"
                        value={returnQuantities[item.id] || ""}
                        disabled={returnSaving || returnRetryPending || info.remaining <= 0}
                        onChange={(event) => setReturnQuantities((current) => ({
                          ...current, [item.id]: Math.min(info.remaining, Math.max(0, Number(event.target.value) || 0))
                        }))} /></td>
                      
                      <td>
                        <select value={returnDispositions[item.id] || "RESTOCK"}
                          disabled={returnSaving || returnRetryPending || Number(returnQuantities[item.id] || 0) <= 0}
                          onChange={(event) => setReturnDispositions((current) => ({ ...current, [item.id]: event.target.value }))}>
                          <option value="RESTOCK">Restock</option><option value="DAMAGED">Damaged</option><option value="DISCARD">Discard</option>
                        </select>
                        {(returnDispositions[item.id] || "RESTOCK") !== "RESTOCK" && Number(returnQuantities[item.id] || 0) > 0 &&
                          <input className="pos-return-disposition-reason" value={returnDispositionReasons[item.id] || ""}
                            onChange={(event) => setReturnDispositionReasons((current) => ({ ...current, [item.id]: event.target.value }))}
                            placeholder="Disposition reason" maxLength={500} disabled={returnSaving || returnRetryPending} />}
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <label className="pos-return-field">Return reason
              <input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} maxLength={500}
                placeholder="Reason for return" disabled={returnSaving || returnRetryPending} />
            </label>
            <div className="pos-return-payment">
              <div><span>Calculated refund</span><strong>{money(returnQuote)}</strong></div>
              {returnQuote > 0 && <>
                <label>Refund method
                  <select value={returnPaymentMethod} onChange={(event) => setReturnPaymentMethod(event.target.value)} disabled={returnSaving || returnRetryPending}>
                    <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
                  </select>
                </label>
                {returnPaymentMethod !== "CASH" && <label>Refund transaction reference
                  <input value={returnPaymentReference} onChange={(event) => setReturnPaymentReference(event.target.value)}
                    maxLength={150} placeholder="Provider-confirmed refund reference" disabled={returnSaving || returnRetryPending} />
                </label>}
              </>}
            </div>
            {returnQuote > 0 && returnPaymentMethod !== "CASH" && <p className="pos-return-warning">Complete and verify the refund in the UPI/card provider first. This POS records the reference; it does not send the provider refund.</p>}
            <div className="pos-modal-actions">
              <button type="button" className="pos-button secondary" onClick={() => setReturnSale(null)} disabled={returnSaving || returnRetryPending}>Cancel</button>
              <button type="button" className="pos-button primary" onClick={submitReturn} disabled={returnSaving || (!returnPendingPayload && (!shift?.id || shift.status !== "OPEN")) || !returnPassword.trim()}>
                {returnSaving ? "Recording…" : returnRetryPending ? "Retry same return" : "Confirm return"}
              </button>
            </div>
          </section>
        </div>
      )}
      {returnSale && exchangeMode && (
        <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !exchangeSaving && !exchangeRetryPending) { setReturnSale(null); setExchangeMode(false); }
        }}>
          <section className="pos-return-modal pos-exchange-modal" role="dialog" aria-modal="true" aria-labelledby="pos-exchange-title">
            <div className="pos-modal-toolbar">
              <div><span className="pos-eyebrow">LINKED RETURN + REPLACEMENT SALE</span><h2 id="pos-exchange-title">Exchange {returnSale.invoiceNumber}</h2></div>
              <button type="button" className="pos-icon-button" onClick={() => { setReturnSale(null); setExchangeMode(false); }}
                disabled={exchangeSaving || exchangeRetryPending} aria-label="Close exchange"><X /></button>
            </div>
            <p className="pos-return-note">This creates one linked exchange. The original return and replacement sale, stock movements and actual cash movements commit together. Returned value becomes non-cash exchange credit; only the price difference is collected or refunded.</p>
            {error && <p className="pos-return-error" role="alert">{error}</p>}

            <h3 className="pos-exchange-section-title">1. Original items being returned</h3>
            <div className="pos-return-lines">
              <table>
                <thead><tr><th>Item</th><th>Sold</th><th>Remaining</th><th>Exchange qty</th><th>Return value</th><th>Disposition</th></tr></thead>
                <tbody>
                  {(returnSale.items || []).map((item) => {
                    const info = getReturnLineInfo(item);
                    return <tr key={item.id}>
                      <td><strong>{item.productName}</strong><small>{item.variantName || item.sku}</small></td>
                      <td>{item.quantity}</td><td>{info.remaining}</td>
                      <td><input type="number" min="0" max={info.remaining} step="1"
                        value={returnQuantities[item.id] || ""}
                        disabled={exchangeSaving || exchangeRetryPending || info.remaining <= 0}
                        onChange={(event) => setReturnQuantities((current) => ({
                          ...current, [item.id]: Math.min(info.remaining, Math.max(0, Number(event.target.value) || 0))
                        }))} /></td>
                      <td><strong>{money(info.refund)}</strong></td>
                      <td>
                        <select value={returnDispositions[item.id] || "RESTOCK"}
                          disabled={exchangeSaving || exchangeRetryPending || Number(returnQuantities[item.id] || 0) <= 0}
                          onChange={(event) => setReturnDispositions((current) => ({ ...current, [item.id]: event.target.value }))}>
                          <option value="RESTOCK">Restock</option><option value="DAMAGED">Damaged</option><option value="DISCARD">Discard</option>
                        </select>
                        {(returnDispositions[item.id] || "RESTOCK") !== "RESTOCK" && Number(returnQuantities[item.id] || 0) > 0 &&
                          <input className="pos-return-disposition-reason" value={returnDispositionReasons[item.id] || ""}
                            onChange={(event) => setReturnDispositionReasons((current) => ({ ...current, [item.id]: event.target.value }))}
                            placeholder="Disposition reason" maxLength={500} disabled={exchangeSaving || exchangeRetryPending} />}
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <label className="pos-return-field">Exchange reason
              <input value={exchangeReason} onChange={(event) => setExchangeReason(event.target.value)} maxLength={500}
                placeholder="Reason for exchange" disabled={exchangeSaving || exchangeRetryPending} />
            </label>
            <label className="pos-return-field">Confirm staff password
              <input type="password" autoComplete="current-password" value={exchangePassword}
                onChange={(event) => setExchangePassword(event.target.value)} disabled={exchangeSaving}
                placeholder="Password required for this exchange" />
            </label>
            <p className="pos-retry-note">A fresh one-time authorization is required for each exchange, including retries.</p>

            <h3 className="pos-exchange-section-title">2. Replacement items</h3>
            <div className="pos-exchange-add-row">
              <select value={exchangeSelectedVariantId} onChange={(event) => setExchangeSelectedVariantId(event.target.value)}
                disabled={exchangeSaving || exchangeRetryPending}>
                <option value="">Choose a replacement product / variant</option>
                {exchangeCatalogVariants.map((item) => <option key={item.variantId} value={item.variantId}>
                  {item.productName} — {item.variantName || item.sku} · {money(item.sellingPrice)} · available {item.availableQuantity}
                </option>)}
              </select>
              <button type="button" className="pos-button secondary" onClick={addExchangeItem}
                disabled={!exchangeSelectedVariantId || exchangeSaving || exchangeRetryPending}><Plus size={16} /> Add item</button>
            </div>
            {exchangeItems.length > 0 ? <div className="pos-exchange-items">
              {exchangeItems.map((item) => <div className="pos-exchange-item" key={item.variantId}>
                <div><strong>{item.productName}</strong><small>{item.variantName || item.sku} · {money(item.unitPrice)} each</small></div>
                <label>Qty<input type="number" min="1" max="9999" value={item.quantity}
                  onChange={(event) => updateExchangeQuantity(item.variantId, event.target.value)}
                  disabled={exchangeSaving || exchangeRetryPending} /></label>
                <strong>{money(item.unitPrice * item.quantity)}</strong>
                <button type="button" className="pos-icon-button" onClick={() => setExchangeItems((current) => current.filter((row) => row.variantId !== item.variantId))}
                  disabled={exchangeSaving || exchangeRetryPending} aria-label={`Remove ${item.productName}`}><Trash2 size={16} /></button>
              </div>)}
            </div> : <p className="pos-retry-note">No replacement items added yet.</p>}
            <label className="pos-return-field">Replacement discount
              <input type="number" min="0" step="0.01" value={exchangeDiscount}
                onChange={(event) => setExchangeDiscount(event.target.value)}
                disabled={!canApplyDiscount || exchangeSaving || exchangeRetryPending} />
            </label>

            <h3 className="pos-exchange-section-title">3. Settlement</h3>
            <div className="pos-exchange-settlement">
              <div><span>Returned value</span><strong>{money(returnQuote)}</strong></div>
              <div><span>Replacement subtotal</span><strong>{money(exchangeSubtotal)}</strong></div>
              <div><span>Replacement discount</span><strong>− {money(exchangeDiscountValue)}</strong></div>
              <div><span>Replacement value</span><strong>{money(exchangeReplacementValue)}</strong></div>
              <div><span>Exchange credit applied</span><strong>{money(Math.min(returnQuote, exchangeReplacementValue))}</strong></div>
              <div className="difference"><span>Customer pays</span><strong>{money(exchangeCollectionDue)}</strong></div>
              <div className="difference"><span>Customer receives refund</span><strong>{money(exchangeRefundDue)}</strong></div>
            </div>
            {exchangeCollectionDue > 0 && <div className="pos-exchange-payment">
              <strong>Collect the difference</strong>
              <label>Payment method<select value={exchangeCollectionMethod} onChange={(event) => setExchangeCollectionMethod(event.target.value)} disabled={exchangeSaving || exchangeRetryPending}>
                <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
              </select></label>
              {exchangeCollectionMethod === "CASH" ? <label>Cash received
                <input type="number" min={amount(exchangeCollectionDue)} step="0.01" value={exchangeCollectionTendered}
                  onChange={(event) => setExchangeCollectionTendered(event.target.value)} disabled={exchangeSaving || exchangeRetryPending} />
              </label> : <label>Payment reference
                <input value={exchangeCollectionReference} onChange={(event) => setExchangeCollectionReference(event.target.value)}
                  maxLength={150} placeholder="UPI/card transaction reference" required disabled={exchangeSaving || exchangeRetryPending} />
              </label>}
              {exchangeCollectionMethod !== "CASH" && <p className="pos-return-warning">Complete and verify the UPI/card collection externally first. This POS records the reference; it does not verify provider settlement.</p>}
            </div>}
            {exchangeRefundDue > 0 && <div className="pos-exchange-payment">
              <strong>Refund the excess returned value</strong>
              <label>Refund method<select value={exchangeRefundMethod} onChange={(event) => setExchangeRefundMethod(event.target.value)} disabled={exchangeSaving || exchangeRetryPending}>
                <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
              </select></label>
              {exchangeRefundMethod !== "CASH" && <label>Refund transaction reference
                <input value={exchangeRefundReference} onChange={(event) => setExchangeRefundReference(event.target.value)}
                  maxLength={150} placeholder="Completed provider refund reference" disabled={exchangeSaving || exchangeRetryPending} />
              </label>}
              {exchangeRefundMethod !== "CASH" && <p className="pos-return-warning">Complete and verify the UPI/card refund externally first. This POS records the reference; it does not send the provider refund.</p>}
            </div>}
            <div className="pos-modal-actions">
              <button type="button" className="pos-button secondary" onClick={() => { setReturnSale(null); setExchangeMode(false); }}
                disabled={exchangeSaving || exchangeRetryPending}>Cancel</button>
              <button type="button" className="pos-button primary" onClick={submitExchange}
                disabled={exchangeSaving || (!exchangePendingPayload && (!shift?.id || shift.status !== "OPEN" || !exchangeItems.length)) || !exchangePassword.trim()}>
                {exchangeSaving ? "Processing…" : exchangeRetryPending ? "Retry same exchange" : "Confirm exchange"}
              </button>
            </div>
          </section>
        </div>
      )}
      {voidDialogOpen && selectedHistorySale && <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !voidSaving && !voidRetry) setVoidDialogOpen(false);
      }}>
        <section className="pos-procurement-modal pos-void-modal" role="dialog" aria-modal="true" aria-labelledby="pos-void-title">
          <div className="pos-modal-toolbar"><div><span className="pos-eyebrow">MANAGER ACTION</span><h2 id="pos-void-title">Void {selectedHistorySale.invoiceNumber}</h2></div>
            <button type="button" className="pos-icon-button" onClick={() => setVoidDialogOpen(false)} disabled={voidSaving || voidRetry} aria-label="Close void dialog"><X /></button></div>
          <p>A full void returns every line to stock and records a full refund. Use this only when the sale is being cancelled before goods leave the shop. A sale with an earlier return cannot be voided.</p>
          {voidError && <p className="pos-return-error" role="alert">{voidError}</p>}
          <label className="pos-return-field">Void reason<input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} disabled={voidSaving || voidRetry} /></label>
          <label className="pos-return-field">Confirm staff password
            <input type="password" autoComplete="current-password" value={voidPassword}
              onChange={(event) => setVoidPassword(event.target.value)} disabled={voidSaving}
              placeholder="Password required for this void" />
          </label>
          <p className="pos-retry-note">A fresh one-time authorization is required for each void, including retries.</p>
          <h3>Refund allocation</h3>
          {voidRefunds.map((payment, index) => <div className="pos-void-refund-row" key={index}>
            <span><strong>{payment.paymentMethod}</strong><small>{money(payment.amount)}</small></span>
            {payment.paymentMethod === "CASH" ? <span className="pos-void-cash-note">Cash refund recorded in your open shift</span>
              : <label>Refund transaction reference<input value={payment.transactionReference} onChange={(event) => setVoidRefunds((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, transactionReference: event.target.value } : row))} maxLength={150} disabled={voidSaving || voidRetry} required /></label>}
          </div>)}
          {voidRefunds.length === 0 && <p className="pos-retry-note">This sale has no collected payment amount. The full sale will be voided without a cash refund.</p>}
          <p className="pos-retry-note">Refunds to UPI/card must be completed through the payment provider or bank first. Enter the actual refund reference; this POS records the refund but does not send it to the provider.</p>
          <div className="pos-modal-actions">
            <button type="button" className="pos-button secondary" onClick={() => setVoidDialogOpen(false)} disabled={voidSaving || voidRetry}>Cancel</button>
            <button type="button" className="pos-button primary" onClick={submitVoid} disabled={voidSaving || (!voidPayload && !shift?.id) || !voidReason.trim() || !voidPassword.trim()}>{voidSaving ? "Voiding…" : voidRetry ? "Retry same void" : "Confirm full void"}</button>
          </div>
        </section>
      </div>}

      <ReceiptView sale={receipt} onClose={() => setReceipt(null)} />
    </main>
  );
}
