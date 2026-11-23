import { Component, useState, useEffect, useMemo, useCallback, useRef, useId, lazy, Suspense } from "react";
import {
  Search,
  UserRound,
  Heart,
  ShoppingBag,
  ArrowRight,
  MapPin,
  Clock,
  Eye,
  ScanFace,
  X,
  Minus,
  Plus,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  Navigation,
} from "lucide-react";
import "./App.css";

// Face analysis is heavy and only used on demand, so load it lazily.
const FaceAnalysis = lazy(() => import("./FaceAnalysis"));

/* =========================
   CONSTANTS
========================= */

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || (import.meta.env.DEV ? "http://localhost:8080/api" : "");
const API_URL = `${API_BASE}/products`;
const CART_KEY = "nmk-cart";
const WISHLIST_KEY = "nmk-wishlist";
const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const JSON_HEADERS = { "Content-Type": "application/json" };
const SKELETON_COUNT = 8;
const TOAST_DURATION_MS = 2500;
const SEARCH_FOCUS_DELAY_MS = 400;
const TIME_ZONE = "Asia/Kolkata";
const NETWORK_MESSAGE = "Network error. Check your connection and try again.";
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Category names must match the product "category" values from the API.
const CATEGORIES = [
  {
    name: "Eyeglasses",
    desc: "Frames for every style",
    imageKey: "CATEGORY_EYEGLASSES",
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=700",
  },
  {
    name: "Sunglasses",
    desc: "Style meets protection",
    imageKey: "CATEGORY_SUNGLASSES",
    image: "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=700",
  },
  {
    name: "Power Sunglasses",
    desc: "Sunglasses with your prescription",
    imageKey: "CATEGORY_POWER_SUNGLASSES",
    image: "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=700",
  },
  {
    name: "Computer Glasses",
    desc: "Made for screen time",
    imageKey: "CATEGORY_COMPUTER_GLASSES",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=700",
  },
  {
    name: "Contact Lenses",
    desc: "Comfort in every glance",
    imageKey: "CATEGORY_CONTACT_LENSES",
    image: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=700",
  },
  {
    name: "Accessories",
    desc: "Cases, cleaning kits and more",
    imageKey: "CATEGORY_ACCESSORIES",
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=700",
  },
];

const CATEGORY_FILTERS = [
  "All",
  "Eyeglasses",
  "Sunglasses",
  "Power Sunglasses",
  "Computer Glasses",
  "Contact Lenses",
  "Accessories",
];

// Catalogue sorting, paging and badges
const SORT_OPTIONS = [
  { value: "popularity", label: "Popularity" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
  { value: "name", label: "Name: A to Z" },
];
const PAGE_SIZE = 12;
const NEW_PRODUCT_DAYS = 30;

// Sidebar filter groups. A group is shown only when the current category has data for it.
const FACET_SECTIONS = [
  { key: "brand", label: "Brands", searchable: true },
  { key: "gender", label: "Gender" },
  { key: "price", label: "Price", type: "price" },
  { key: "shape", label: "Shape" },
  { key: "size", label: "Size" },
  { key: "frameStyle", label: "Frame Style" },
  { key: "frameColor", label: "Frame Colour" },
  { key: "material", label: "Material" },
  { key: "lensType", label: "Lens Type" },
  { key: "lensTechnology", label: "Lens Technology" },
  { key: "lensColor", label: "Lens Colour" },
  { key: "disposability", label: "Disposability" },
  { key: "usage", label: "Usage" },
];

// Price ranges. A product is in a band when min < price <= max, so every price falls in exactly one band.
// "Below 500" includes 500, and the next band starts above it.
const PRICE_BANDS = [
  { id: "below-500", label: "Below 500", min: -Infinity, max: 500 },
  { id: "501-1000", label: "501–1,000", min: 500, max: 1000 },
  { id: "1001-1500", label: "1,001–1,500", min: 1000, max: 1500 },
  { id: "1501-2000", label: "1,501–2,000", min: 1500, max: 2000 },
  { id: "2001-2500", label: "2,001–2,500", min: 2000, max: 2500 },
  { id: "2501-4000", label: "2,501–4,000", min: 2500, max: 4000 },
  { id: "4001-6500", label: "4,001–6,500", min: 4000, max: 6500 },
  { id: "6501-plus", label: "6,501 and above", min: 6500, max: Infinity },
];

const TIME_SLOTS = {
  "9 AM - 12 PM": "09:00:00",
  "12 PM - 3 PM": "12:00:00",
  "3 PM - 6 PM": "15:00:00",
};

const EMPTY_BOOKING = { name: "", phone: "", email: "", date: "", slot: "" };

const FALLBACK_IMAGES = {
  product: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=600",
  hero: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1200",
  store: "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=1000",
};

const DEFAULT_OFFER_COLORS = { background: "#172554", text: "#FFFFFF" };

// Lens pricing for eyeglass customization
const LENS_PRICES = {
  "Single Vision": {
    ClearGuard: 899,
    "ClearGuard Blue": 1649,
    "ClearGuard Plus": 1989,
    "ClearGuard NightDrive": 2899,
    photochromic: 689,
  },
  Progressive: {
    ClearGuard: 1799,
    "ClearGuard Blue": 2449,
    "ClearGuard Plus": 2989,
    "ClearGuard NightDrive": 3899,
    photochromic: 989,
  },
  Bifocal: {
    ClearGuard: 1399,
    "ClearGuard Blue": 1849,
    "ClearGuard Plus": 2489,
    "ClearGuard NightDrive": 2999,
    photochromic: 989,
  },
};

// Footer policy links. Exact policy text is not stored in the app, so these point to the store.
// Store details used by the store section and its contact buttons
const STORE_INFO = {
  address: "Avalurpet, Tiruvannamalai",
  mapsUrl: "https://maps.app.goo.gl/5AzTingbW3Jt2GUHA",
  hours: "9:00 AM – 9:00 PM",
  phoneDisplay: "93445 26439",
  callHref: "tel:+919344526439",
  whatsappHref: "https://wa.me/919344526439",
  services: ["Eye tests", "Frames", "Lenses", "Sunglasses", "Contact lenses", "Adjustments", "Repairs"],
};

const INFO_TEXT = {
  "Shipping Policy": "For shipping details and delivery timelines, please contact NMK OPTICALS directly.",
  "Returns & Refunds": "For returns and refund questions, please contact NMK OPTICALS directly.",
};

/* =========================
   HELPERS
========================= */

const formatINR = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

// "frameStyle" -> "Frame Style"
const formatSpecLabel = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

// Calendar day in India, so the booking date matches the store's day
const todayInIndia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date()
  );

// Minutes since midnight in India, used to hide appointment slots that have already started
const minutesNowInIndia = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
};

const slotStartMinutes = (time) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

// A slot is open unless it is for today and has already started
const isSlotAvailable = (time, date, today, nowMinutes) =>
  !(date === today && slotStartMinutes(time) <= nowMinutes);

const readStorage = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    // Only real objects are kept, so a damaged saved entry can never break the page
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
};

// Storage can be full or blocked; the site keeps working without saving
const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignored on purpose
  }
};

// Error responses are not always JSON, so a failed parse returns an empty object
const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

// Links come from the admin panel. Only in-site paths and http(s) links are used as hrefs.
const safeHref = (value) => {
  const link = String(value ?? "").trim();
  if (!link) return "";
  if (link.startsWith("/") && !link.startsWith("//")) return link;

  try {
    return ["http:", "https:"].includes(new URL(link).protocol) ? link : "";
  } catch {
    return "";
  }
};

// The offer bar shows only while it is switched on and inside its start and end time
const isOfferLive = (offer, now = Date.now()) => {
  if (!offer?.active || !offer.message) return false;

  const start = offer.startDateTime ? new Date(offer.startDateTime).getTime() : NaN;
  const end = offer.endDateTime ? new Date(offer.endDateTime).getTime() : NaN;

  if (Number.isFinite(start) && now < start) return false;
  if (Number.isFinite(end) && now > end) return false;
  return true;
};

// A malformed %-sequence in the URL must not crash the page. The raw value then fails the code check.
const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getErrorMessage = (error) => (error instanceof TypeError ? NETWORK_MESSAGE : error.message);

// Loads the Razorpay script once and shares the same promise across calls.
let razorpayPromise = null;
const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve(true);

  if (!razorpayPromise) {
    razorpayPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = RAZORPAY_SRC;
      script.onload = () => resolve(true);
      script.onerror = () => {
        razorpayPromise = null; // allow a retry on the next checkout
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return razorpayPromise;
};

// Overview text built from the product's specifications
const GENDER_TEXT = { men: "men", women: "women", unisex: "men and women", kids: "kids" };

const buildProductOverview = (p) => {
  const s = p.specifications || {};
  const category = p.category || "";
  const clean = (...parts) =>
    parts.map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");

  const brand = clean(p.brand, s.brand);

  if (category === "Contact Lenses") {
    const disposable = s.disposability
      ? `${String(s.disposability).trim()} disposable`
      : "";
    return {
      brand,
      subtitle: clean(disposable, s.lensColor, s.lensType),
      size: "",
    };
  }

  if (["Eyeglasses", "Sunglasses", "Power Sunglasses", "Computer Glasses"].includes(category)) {
    const gender = p.gender
      ? GENDER_TEXT[String(p.gender).trim().toLowerCase()] ||
        String(p.gender).trim().toLowerCase()
      : "";
    return {
      brand,
      subtitle: clean(s.frameColor, s.shape, category, gender ? `for ${gender}` : ""),
      size: clean(s.size),
    };
  }

  return {
    brand,
    subtitle: clean(s.productType),
    size: clean(s.size),
  };
};

const toProduct = (p) => {
  const overview = buildProductOverview(p);
  const variants = (Array.isArray(p.variants) ? p.variants : []).map((variant) => ({
    id: Number(variant.id),
    variantName: variant.variantName || "Standard",
    attributes: variant.attributes || {},
    numericPrice: Number(variant.price ?? p.price ?? 0),
    availableQuantity: Math.max(0, Number(variant.availableQuantity ?? 0)),
  }));
  const numericPrice = variants.length
    ? Math.min(...variants.map((variant) => variant.numericPrice))
    : Number(p.price || 0);
  const stockQuantity = variants.reduce(
    (sum, variant) => sum + variant.availableQuantity,
    0
  );

  return {
    id: Number(p.id),
    name: p.name || p.productName || p.category || "Eyewear",
    brand: overview.brand,
    subtitle: overview.subtitle,
    size: overview.size,
    type: p.category || "Eyewear",
    gender: p.gender || "",
    price: formatINR(numericPrice),
    numericPrice,
    image: p.imageUrl || FALLBACK_IMAGES.product,
    stockQuantity,
    variants,
    description: p.description || "",
    specifications: p.specifications || {},
    createdAt: p.createdAt || null,
    isNew: Boolean(p.isNew),
    isBestSeller: Boolean(p.bestSeller ?? p.isBestSeller),
  };
};

// Every cart line has its own lineId. A plain line is unique per product variant.
const makeLineId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const cartLineKey = (item) => item.lineId ?? `${item.id}:${item.variantId}`;

// Reconcile saved lines against the latest variant-level stock and price from the catalogue.
const reconcileCart = (items, catalogue, unavailableProductIds = []) => {
  const byId = new Map(catalogue.map((product) => [product.id, product]));
  const unavailableIds = new Set(unavailableProductIds.map(Number));
  const usedByVariant = new Map();
  const merged = [];
  let removed = 0;

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || item.id == null || item.variantId == null) {
      removed += 1;
      return;
    }

    const fresh = byId.get(Number(item.id));
    if (!fresh) {
      // A product absent from the current server page is not automatically unavailable.
      // Keep it until its direct cart-reference lookup confirms a 404.
      if (unavailableIds.has(Number(item.id))) {
        removed += 1;
      } else {
        merged.push(item);
      }
      return;
    }

    const freshVariant = fresh.variants.find(
      (variant) => variant.id === Number(item.variantId)
    );

    if (!freshVariant || freshVariant.availableQuantity <= 0) {
      removed += 1;
      return;
    }

    const variantKey = `${fresh.id}:${freshVariant.id}`;
    const used = usedByVariant.get(variantKey) || 0;
    const room = freshVariant.availableQuantity - used;
    if (room <= 0) {
      removed += 1;
      return;
    }

    const variantPrice = Number(freshVariant.numericPrice) || 0;
    const contact = item.lens?.kind === "contact";
    const lens = item.lens
      ? {
          ...item.lens,
          pricing: contact
            ? contactPricing(variantPrice, item.lens.units)
            : calculateLensPricing(
                variantPrice,
                item.lens.powerType,
                item.lens.lensType,
                item.lens.photochromic
              ),
        }
      : null;

    const units = lens ? (contact ? Number(item.lens.units) || 1 : 1) : null;
    if (units !== null && units > room) {
      removed += 1;
      return;
    }

    const lineId = item.lineId || (lens ? makeLineId() : variantKey);
    const quantity = lens
      ? units
      : Math.min(Math.max(1, Number(item.quantity) || 1), room);
    const existing = lens ? null : merged.find((line) => line.lineId === lineId);
    const unitPrice = lens && !contact ? lens.pricing.total : variantPrice;
    const cartProduct = {
      ...fresh,
      variantId: freshVariant.id,
      variantName: freshVariant.variantName,
      variantAttributes: freshVariant.attributes,
      stockQuantity: freshVariant.availableQuantity,
      numericPrice: unitPrice,
      price: formatINR(unitPrice),
    };

    if (existing) {
      existing.quantity += quantity;
    } else {
      merged.push({
        ...cartProduct,
        lineId,
        quantity,
        lens,
      });
    }

    usedByVariant.set(variantKey, used + quantity);
  });

  return { items: merged, removed };
};
/* =========================
   SMALL COMPONENTS
========================= */

// Escape to close, Tab stays inside the dialog, focus moves in and returns on close
function useDialog(ref, { onClose, closable }) {
  const onCloseRef = useRef(onClose);
  const closableRef = useRef(closable);

  useEffect(() => {
    onCloseRef.current = onClose;
    closableRef.current = closable;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = "hidden";
    (ref.current?.querySelector(FOCUSABLE_SELECTOR) ?? ref.current)?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (closableRef.current) onCloseRef.current();
        return;
      }

      if (e.key !== "Tab" || !ref.current) return;

      const items = [...ref.current.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [ref]);
}

// Right-hand dialog. Clicking the backdrop closes it unless closing is blocked.
function Modal({ title, onClose, closable = true, className = "", children }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  useDialog(dialogRef, { onClose, closable });

  return (
    <div
  className={`site-modal-overlay ${
    className.includes("site-modal--top-center")
      ? "site-modal-overlay--top-center"
      : ""
  }`}
  onClick={() => closable && onClose()}
>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`site-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="site-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="site-modal-close"
            onClick={() => closable && onClose()}
            disabled={!closable}
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// Shows a friendly message if a lazily loaded panel fails, instead of breaking the whole page
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Panel failed to load:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// Swaps to a backup picture when an image link is broken, instead of showing a broken icon
function FallbackImage({ src, fallback, alt = "", ...props }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <img
      {...props}
      src={failed && fallback ? fallback : src}
      alt={alt}
      onError={() => {
        if (fallback && !failed) setFailed(true);
      }}
    />
  );
}

// Shared row for cart and wishlist items
function CartItem({ item, children, actions }) {
  return (
    <div className="cart-item">
      <FallbackImage src={item.image} fallback={FALLBACK_IMAGES.product} alt="" />
      <div className="cart-item-body">
        <h3>{item.name}</h3>
        {item.variantName && <p className="cart-item-variant">{item.variantName}</p>}
        <p>{formatINR(item.numericPrice)}</p>
        {children}
        {actions}
      </div>
    </div>
  );
}

function QuantityControl({ name, quantity, max, onChange }) {
  return (
    <div className="qty-control" role="group" aria-label={`Quantity for ${name}`}>
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= 1}
        aria-label="Decrease quantity"
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span aria-live="polite">{quantity}</span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= max}
        aria-label="Increase quantity"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

// One add-to-cart button used on cards and in the details panel
function StockButton({ product, inCart = 0, onAddToCart }) {
  const outOfStock = product.stockQuantity <= 0;
  const limitReached = !outOfStock && inCart >= product.stockQuantity;

  let label = "Add to Cart";
  if (outOfStock) label = "Out of Stock";
  else if (limitReached) label = "Max in Cart";

  return (
    <button
      type="button"
      className="product-btn"
      onClick={() => onAddToCart(product)}
      disabled={outOfStock || limitReached}
    >
      {label}
    </button>
  );
}


function ProductCard({
  product,
  inCart,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onViewDetails,
}) {
  return (
    <article className="product-card">
      <div className="product-image">
        {(isNewProduct(product) || product.isBestSeller) && (
          <div className="product-badges">
            {isNewProduct(product) && (
              <span className="badge badge-new">New</span>
            )}
            {product.isBestSeller && (
              <span className="badge badge-best">Best Seller</span>
            )}
          </div>
        )}

        <button
          type="button"
          className="product-image-button"
          onClick={() => onViewDetails(product)}
          aria-label={`View details for ${product.name}`}
        >
          <FallbackImage
            src={product.image}
            fallback={FALLBACK_IMAGES.product}
            alt=""
            loading="lazy"
          />
        </button>

        <button
          type="button"
          className={`wishlist ${isWishlisted ? "active" : ""}`}
          onClick={() => onToggleWishlist(product)}
          aria-label={
            isWishlisted
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
          aria-pressed={isWishlisted}
        >
          <Heart
            size={18}
            aria-hidden="true"
            fill={isWishlisted ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="product-info">
        <span className="product-category">{product.type || "\u00a0"}</span>

        <h3 className="product-brand">
          {product.brand || "\u00a0"}
        </h3>

        <p className="product-title">
          <button
            type="button"
            className="product-name-button"
            onClick={() => onViewDetails(product)}
          >
            {product.subtitle || product.name}
          </button>
        </p>

        <p className="product-size">
          {product.size ? (
            <>Size: <strong>{product.size}</strong></>
          ) : (
            <span aria-hidden="true">&nbsp;</span>
          )}
        </p>

        <strong className="product-price">
          <span className="product-currency-symbol">₹</span>
          {Number(product.numericPrice || 0).toLocaleString("en-IN")}
        </strong>

        <StockButton
          product={product}
          inCart={inCart}
          onAddToCart={onAddToCart}
        />
      </div>
    </article>
  );
}


/* =========================
   LENS CUSTOMISATION
   Power type -> lens -> prescription -> review, then add to cart.
========================= */

const PRESCRIPTION_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const PRESCRIPTION_MAX_SIZE = 5 * 1024 * 1024;

const POWERED_STEPS = ["Power Type", "Lenses", "Prescription", "Review"];
const FRAME_ONLY_STEPS = ["Power Type", "Review"];

const POWER_OPTIONS = [
  { value: "Frame Only", description: "The frame only. No lenses or prescription." },
  { value: "Single Vision", description: "One lens power for distance or near vision." },
  { value: "Progressive", description: "Smooth zones for distance, middle and near vision." },
  { value: "Bifocal", description: "Two zones: distance and near vision." },
];

function PowerTypeIllustration({ type }) {
  const frame = (
    <>
      <path d="M4 18H10M62 18H68"
        stroke="#7E8DA0" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="10" y="10" width="52" height="34" rx="12"
        fill="none" stroke="#7E8DA0" strokeWidth="2.2" />
      <path d="M19 16V22"
        stroke="#D1D9E2" strokeWidth="2" strokeLinecap="round" />
    </>
  );

  return (
    <svg viewBox="0 0 72 48" width="64" height="48" fill="none">
      {frame}

      {type === "Frame Only" && (
        <>
          <circle cx="48" cy="27" r="7.5"
            stroke="#0ea5e9" strokeWidth="2" />
          <path d="M43 22L53 32"
            stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {type === "Single Vision" && (
        <>
          <path d="M29 27H37M33 23V31"
            stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M43 27H49"
            stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}

      {type === "Progressive" && (
        <>
          <path d="M18 20C24 24 30 33 36 33C42 33 48 24 54 20"
            stroke="#94A3B8" strokeWidth="1.8"
            strokeDasharray="2 2" strokeLinecap="round" />
          <circle cx="36" cy="33.5" r="3.5" fill="#0284c7" />
        </>
      )}

      {type === "Bifocal" && (
        <>
          <path d="M22 17C22 17 26 27 36 27C46 27 50 17 50 17"
            stroke="#CBD5E1" strokeWidth="1.6"
            strokeDasharray="2 2" strokeLinecap="round" />
          <ellipse cx="36" cy="34" rx="9" ry="4.5"
            fill="#bae6fd" stroke="#0284c7" strokeWidth="1.8" />
        </>
      )}
    </svg>
  );
}

const LENS_OPTIONS = ["ClearGuard", "ClearGuard Blue", "ClearGuard Plus", "ClearGuard NightDrive"];
const LENS_FEATURES = {
  ClearGuard: ["Anti-reflective", "Scratch resistance"],
  "ClearGuard Blue": ["Anti-reflective", "Scratch resistance", "UV protection", "Blue light filter"],
  "ClearGuard Plus": ["Anti-reflective", "Scratch resistance", "UV protection", "Blue light filter", "Dust & water repellent"],
  "ClearGuard NightDrive": ["Anti-reflective", "Scratch resistance", "UV protection", "Blue light filter", "Dust & water repellent", "Visual comfort"],
};

const PRESCRIPTION_MODES = [
  { value: "manual", label: "Enter manually" },
  { value: "image", label: "Upload prescription" },
];

// Diopter values in quarter steps, e.g. "-1.25", "+2.00"
const formatDiopter = (value) => (value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2));
const diopterOptions = (fromQuarters, toQuarters) =>
  Array.from({ length: toQuarters - fromQuarters + 1 }, (_, i) => formatDiopter((fromQuarters + i) / 4));

const SPH_OPTIONS = diopterOptions(-80, 80); // -20.00 to +20.00
const CYL_OPTIONS = diopterOptions(-24, 0); // 0.00 to -6.00
const ADD_OPTIONS = diopterOptions(3, 14); // +0.75 to +3.50

const EMPTY_EYE = { sph: "", cyl: "", axis: "", add: "" };
const EMPTY_PRESCRIPTION = {
  mode: "manual",
  sameForBothEyes: false,
  hasCylinder: true,
  right: EMPTY_EYE,
  left: EMPTY_EYE,
  imageAsset: null,
  imageName: "",
  consent: false,
};

const isPowered = (powerType) => Boolean(powerType) && powerType !== "Frame Only";
const needsAddition = (powerType) => powerType === "Progressive" || powerType === "Bifocal";
const isEyeglasses = (product) => String(product?.type || "").toLowerCase() === "eyeglasses";

// Frame price + lens price + photochromic charge, calculated from the LENS_PRICES table
const calculateLensPricing = (framePrice, powerType, lensType, photochromic) => {
  const frame = Number(framePrice) || 0;
  if (!isPowered(powerType)) return { frame, lens: 0, photochromic: 0, total: frame };

  const table = LENS_PRICES[powerType] || {};
  const lens = table[lensType] ?? 0;
  const photo = photochromic ? table.photochromic ?? 0 : 0;

  return { frame, lens, photochromic: photo, total: frame + lens + photo };
};

const isAxisValid = (value) => /^\d+$/.test(String(value)) && Number(value) >= 0 && Number(value) <= 180;

// Returns an error message, or "" when the prescription is complete
const prescriptionProblem = (rx, addition) => {
  if (rx.mode === "image") {
    if (!rx.imageAsset?.publicId) return "Please upload your prescription image or PDF.";
  } else {
    const eyes = rx.sameForBothEyes ? ["right"] : ["right", "left"];

    for (const eye of eyes) {
      const label = eye === "right" ? "right" : "left";
      const row = rx[eye];

      if (!row.sph) return `Select the SPH power for the ${label} eye.`;

      if (rx.hasCylinder) {
        if (!row.cyl) return `Select the CYL power for the ${label} eye.`;
        if (!isAxisValid(row.axis)) return `Enter an axis between 0 and 180 for the ${label} eye.`;
      }

      if (addition && !row.add) return `Select the ADDL power for the ${label} eye.`;
    }
  }

  if (!rx.consent) return "Please confirm that the prescription details are correct.";
  return "";
};

// Keeps only the fields that apply, so hidden values are never saved
const cleanEye = (row, hasCylinder, addition) => ({
  sph: row.sph,
  cyl: hasCylinder ? row.cyl : "",
  axis: hasCylinder ? String(row.axis) : "",
  add: addition ? row.add : "",
});

const buildPrescriptionPayload = (rx, addition) =>
  rx.mode === "image"
    ? { mode: "image", ...rx.imageAsset }
    : {
        mode: "manual",
        sameForBothEyes: rx.sameForBothEyes,
        hasCylinder: rx.hasCylinder,
        needsAddition: addition,
        right: cleanEye(rx.right, rx.hasCylinder, addition),
        left: cleanEye(rx.sameForBothEyes ? rx.right : rx.left, rx.hasCylinder, addition),
      };

// Uploads through the backend, which validates the file and stores it as a private asset.
const uploadPrescription = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(`${API_BASE}/prescriptions/upload`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(NETWORK_MESSAGE);
  }

  const data = await readJson(response);
  if (!response.ok || !data.publicId || !data.signature) {
    throw new Error(data.message || "Prescription upload failed. Please try again.");
  }
  return data;
};

function LensTypeIllustration({ type }) {
  if (type === "Photochromic") {
    return (
      <svg viewBox="0 0 72 48" aria-hidden="true">
        <defs>
          <linearGradient id="photochromic-lens-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#334155" stopOpacity="0.8" />
            <stop offset="52%" stopColor="#64748b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect x="14" y="9" width="38" height="30" rx="9" fill="url(#photochromic-lens-gradient)" stroke="#94a3b8" strokeWidth="2" />
        <path d="M10 20H14M52 20H55" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="56" cy="14" r="5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.2" />
        <path d="M56 6V8M56 20V22M48 14H50M62 14H64M49 22L45 26M53 24L49 28" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M24 16L21 28M30 16L27 28" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 72 48" aria-hidden="true">
      <rect x="14" y="8" width="44" height="32" rx="10" fill="#ffffff" stroke={type === "ClearGuard Plus" ? "#64748b" : "#94a3b8"} strokeWidth="2" />
      <path d="M10 20H14M58 20H62" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      {type === "ClearGuard" && (
        <>
          <path d="M22 15L36 33" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="2 2" strokeLinecap="round" />
          <path d="M42 16L48 19V24C48 27.5 45.5 29.5 42 31C38.5 29.5 36 27.5 36 24V19L42 16Z" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.2" />
          <path d="M40 23.5L41.5 25L44.5 22" stroke="#0284c7" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {type === "ClearGuard Blue" && (
        <>
          <path d="M22 17C26 21 28 26 26 31M18 14L28 24L18 34" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="43" cy="24" r="8" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.2" />
          <path d="M43 19V29M38 24H48" stroke="#1d4ed8" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {type === "ClearGuard Plus" && (
        <>
          <path d="M36 15C36 15 30 22 30 25.5C30 28.5 32.7 31 36 31C39.3 31 42 28.5 42 25.5C42 22 36 15 36 15Z" fill="#38bdf8" fillOpacity="0.3" stroke="#0284c7" strokeWidth="1.5" />
          <path d="M34 23C34 21.5 35 20 36 19" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="48" cy="18" r="1.5" fill="#0ea5e9" />
          <circle cx="23" cy="27" r="1.5" fill="#0ea5e9" />
          <path d="M46 25L50 29" stroke="#0ea5e9" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {type === "ClearGuard NightDrive" && (
        <>
          <circle cx="36" cy="24" r="5" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.2" />
          <path d="M36 14V17M36 31V34M26 24H29M43 24H46M29 17L31.5 19.5M40.5 28.5L43 31M29 31L31.5 28.5M40.5 19.5L43 17" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function PriceBreakdown({ pricing }) {
  return (
    <div className="price-breakdown" aria-label="Price breakdown">
      <div>
        <span>Frame price</span>
        <span>{formatINR(pricing.frame)}</span>
      </div>
      <div>
        <span>Lens price</span>
        <span>{formatINR(pricing.lens)}</span>
      </div>
      {pricing.photochromic > 0 && (
        <div>
          <span>Photochromic</span>
          <span>{formatINR(pricing.photochromic)}</span>
        </div>
      )}
      <div className="price-total">
        <span>Final price</span>
        <span>{formatINR(pricing.total)}</span>
      </div>
    </div>
  );
}

// Short description of a customised line, used in the cart and at checkout
function LensSummary({ lens }) {
  if (lens.kind === "contact") {
    return (
      <div className="lens-summary">
        {["right", "left"]
          .filter((eye) => lens.prescription?.[eye])
          .map((eye) => {
            const row = lens.prescription[eye];
            return (
              <p key={eye}>
                <strong>{eye === "right" ? "Right" : "Left"}:</strong> SPH {row.sph}
                {row.cyl && `, CYL ${row.cyl}, Axis ${row.axis}`} · {row.boxes} {Number(row.boxes) === 1 ? "box" : "boxes"}
              </p>
            );
          })}
        <p>
          {lens.units} {lens.units === 1 ? "box" : "boxes"} in total
        </p>
      </div>
    );
  }

  const powered = isPowered(lens.powerType);

  return (
    <div className="lens-summary">
      <p>
        <strong>{lens.powerType}</strong>
        {powered && ` · ${lens.lensType}`}
        {powered && lens.photochromic && " · Photochromic"}
      </p>
      <p>
        Frame {formatINR(lens.pricing.frame)}
        {powered && ` + Lens ${formatINR(lens.pricing.lens)}`}
        {lens.pricing.photochromic > 0 && ` + Photochromic ${formatINR(lens.pricing.photochromic)}`}
      </p>
      {lens.prescription && (
        <p>
          {lens.prescription.mode === "image"
            ? `Prescription: ${lens.prescriptionFileName || "image uploaded"}`
            : "Prescription: entered manually"}
        </p>
      )}
    </div>
  );
}

function LensCustomizer({ product, onCancel, onConfirm, onBookEyeTest }) {
  const [powerType, setPowerType] = useState("");
  const [lensType, setLensType] = useState("");
  const [photochromic, setPhotochromic] = useState(false);
  const [prescription, setPrescription] = useState(EMPTY_PRESCRIPTION);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const powered = isPowered(powerType);
  const addition = needsAddition(powerType);
  const steps = powerType === "Frame Only" ? FRAME_ONLY_STEPS : POWERED_STEPS;
  const currentIndex = Math.min(stepIndex, steps.length - 1);
  const currentStep = steps[currentIndex];

  const pricing = calculateLensPricing(product.numericPrice, powerType, lensType, photochromic && powered);

  const stepProblem = (step) => {
    if (step === "Power Type") return powerType ? "" : "Please choose a power type to continue.";
    if (step === "Lenses") return lensType ? "" : "Please choose a lens type to continue.";
    if (step === "Prescription") return prescriptionProblem(prescription, addition);
    return "";
  };

  const selectPower = (value) => {
    setPowerType(value);
    if (value === "Frame Only") setPhotochromic(false);
    setError("");
  };

  const goBack = () => {
    setError("");
    setStepIndex(Math.max(0, currentIndex - 1));
  };

  const goNext = () => {
    const problem = stepProblem(currentStep);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStepIndex(Math.min(currentIndex + 1, steps.length - 1));
  };

  // Every step before Review must be complete. If one is not, jump back to it.
  const confirmLens = () => {
    for (const step of steps.slice(0, -1)) {
      const problem = stepProblem(step);
      if (problem) {
        setError(problem);
        setStepIndex(steps.indexOf(step));
        return;
      }
    }

    onConfirm({
      powerType,
      lensType: powered ? lensType : null,
      photochromic: powered && photochromic,
      prescription: powered ? buildPrescriptionPayload(prescription, addition) : null,
      prescriptionFileName: powered && prescription.mode === "image" ? prescription.imageName : null,
      pricing,
    });
  };

  const updateEye = (eye, field, value) =>
    setPrescription((prev) => {
      if (prev.sameForBothEyes && eye === "left") return prev;

      const row = { ...prev[eye], [field]: value };
      const next = { ...prev, [eye]: row };
      if (prev.sameForBothEyes && eye === "right") next.left = { ...row };
      return next;
    });

  const setSameForBothEyes = (checked) =>
    setPrescription((prev) => ({
      ...prev,
      sameForBothEyes: checked,
      left: checked ? { ...prev.right } : prev.left,
    }));

  const setHasCylinder = (checked) =>
    setPrescription((prev) => ({
      ...prev,
      hasCylinder: checked,
      right: checked ? prev.right : { ...prev.right, cyl: "", axis: "" },
      left: checked ? prev.left : { ...prev.left, cyl: "", axis: "" },
    }));

  const handlePrescriptionFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!PRESCRIPTION_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, WEBP or PDF files are allowed.");
      return;
    }
    if (file.size > PRESCRIPTION_MAX_SIZE) {
      setError("The file must be smaller than 5 MB.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const imageAsset = await uploadPrescription(file);
      setPrescription((prev) => ({ ...prev, imageAsset, imageName: imageAsset.imageName || file.name }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const eyeSelect = (eye, field, options, label) => (
    <select
      aria-label={`${label} for ${eye} eye`}
      value={prescription[eye][field]}
      disabled={eye === "left" && prescription.sameForBothEyes}
      onChange={(e) => updateEye(eye, field, e.target.value)}
    >
      <option value="">Select</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );

  const axisInput = (eye) => (
    <input
      type="number"
      min="0"
      max="180"
      step="1"
      inputMode="numeric"
      placeholder="0–180"
      aria-label={`Axis for ${eye} eye`}
      value={prescription[eye].axis}
      disabled={eye === "left" && prescription.sameForBothEyes}
      onChange={(e) => updateEye(eye, "axis", e.target.value)}
    />
  );

  return (
    <Modal
      title="Customise Your Eyeglasses"
      onClose={onCancel}
      closable={!uploading}
      className="site-modal--form site-modal--top-center"
    >
      <div className="lens-customizer">
        <p className="lens-product">
          {product.name} · Frame {formatINR(product.numericPrice)}
        </p>

        <ol className="lens-stepper" aria-label="Customisation steps">
          {steps.map((step, i) => (
            <li
              key={step}
              className={i < currentIndex ? "done" : i === currentIndex ? "current" : ""}
              aria-current={i === currentIndex ? "step" : undefined}
            >
              <span className="lens-step-dot" aria-hidden="true">
                {i < currentIndex ? <CheckCircle2 size={14} /> : i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        
{currentStep === "Power Type" && (
  <fieldset className="choice-group power-type-grid">
    <legend>Select power type</legend>

    {POWER_OPTIONS.map((option) => (
      <label
        key={option.value}
        className={`power-type-card ${
          powerType === option.value ? "selected" : ""
        }`}
      >
        <input
          className="sr-only"
          type="radio"
          name="power-type"
          value={option.value}
          checked={powerType === option.value}
          onChange={() => selectPower(option.value)}
        />

        <span className="power-type-visual" aria-hidden="true">
          <PowerTypeIllustration type={option.value} />
        </span>

        <span className="power-type-content">
          <strong>{option.value}</strong>
          <small>{option.description}</small>
        </span>

        <span className="power-type-radio" aria-hidden="true" />
      </label>
    ))}
  </fieldset>
)}


        {currentStep === "Lenses" && (
          <>
            <fieldset className="choice-group lens-type-options">
              <legend>Select lens type</legend>
              <p className="lens-type-intro">
                Choose the best protective coating and clarity for your prescription lenses.
              </p>

              {LENS_OPTIONS.map((name) => (
                <label key={name} className={`lens-card ${lensType === name ? "is-selected" : ""}`}>
                  <input
                    className="lens-card-input"
                    type="radio"
                    name="lens-type"
                    value={name}
                    checked={lensType === name}
                    onChange={() => {
                      setLensType(name);
                      setError("");
                    }}
                  />

                  <span className="lens-card-radio" aria-hidden="true"><span /></span>
                  <span className={`lens-card-illustration lens-card-illustration--${name === "ClearGuard Blue" ? "blue" : name === "ClearGuard Plus" ? "plus" : name === "ClearGuard NightDrive" ? "night" : "clear"}`} aria-hidden="true">
                    <LensTypeIllustration type={name} />
                  </span>

                  <span className="lens-card-content">
                    <span className="lens-card-heading">
                      <strong>{name}</strong>
                      {name === "ClearGuard Plus" && <span className="lens-card-popular">Popular</span>}
                      <strong className="lens-card-price">{formatINR(LENS_PRICES[powerType]?.[name])}</strong>
                    </span>
                    <span className="lens-card-features">
                      {LENS_FEATURES[name].map((feature) => (
                        <span key={feature}><CheckCircle2 size={14} aria-hidden="true" />{feature}</span>
                      ))}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className={`photochromic-card ${photochromic ? "is-selected" : ""}`}>
              <input
                className="photochromic-card-input"
                type="checkbox"
                checked={photochromic}
                onChange={(e) => setPhotochromic(e.target.checked)}
              />
              <span className="photochromic-checkbox" aria-hidden="true"><CheckCircle2 size={15} /></span>
              <span className="photochromic-illustration" aria-hidden="true"><LensTypeIllustration type="Photochromic" /></span>
              <span className="photochromic-copy"><strong>Photochromic</strong><small>Adapts to sunlight</small></span>
              <strong className="photochromic-price">+{formatINR(LENS_PRICES[powerType]?.photochromic)}</strong>
            </label>

            <PriceBreakdown pricing={pricing} />
          </>
        )}

        {currentStep === "Prescription" && (
          <div className="rx-step">
            <button type="button" className="rx-help-btn" onClick={onBookEyeTest}>
              <Eye size={17} aria-hidden="true" />
              Don&apos;t know my prescription? Book an eye test
            </button>

            <div className="segmented" role="group" aria-label="Prescription input">
              {PRESCRIPTION_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode.value}
                  className={prescription.mode === mode.value ? "active" : ""}
                  aria-pressed={prescription.mode === mode.value}
                  onClick={() => setPrescription((prev) => ({ ...prev, mode: mode.value }))}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {prescription.mode === "manual" ? (
              <>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={prescription.sameForBothEyes}
                    onChange={(e) => setSameForBothEyes(e.target.checked)}
                  />
                  I have same power for both eyes
                </label>

                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={prescription.hasCylinder}
                    onChange={(e) => setHasCylinder(e.target.checked)}
                  />
                  Include cylindrical (CYL) power
                </label>

                <div className="rx-grid" role="table" aria-label="Prescription powers">
                  <div className="rx-row rx-head" role="row">
                    <span role="columnheader">Power</span>
                    <span role="columnheader">Right</span>
                    <span role="columnheader">Left</span>
                  </div>

                  <div className="rx-row" role="row">
                    <span className="rx-label" role="rowheader">SPH</span>
                    <div role="cell">{eyeSelect("right", "sph", SPH_OPTIONS, "SPH")}</div>
                    <div role="cell">{eyeSelect("left", "sph", SPH_OPTIONS, "SPH")}</div>
                  </div>

                  {prescription.hasCylinder && (
                    <>
                      <div className="rx-row" role="row">
                        <span className="rx-label" role="rowheader">CYL</span>
                        <div role="cell">{eyeSelect("right", "cyl", CYL_OPTIONS, "CYL")}</div>
                        <div role="cell">{eyeSelect("left", "cyl", CYL_OPTIONS, "CYL")}</div>
                      </div>

                      <div className="rx-row" role="row">
                        <span className="rx-label" role="rowheader">Axis</span>
                        <div role="cell">{axisInput("right")}</div>
                        <div role="cell">{axisInput("left")}</div>
                      </div>
                    </>
                  )}

                  {addition && (
                    <div className="rx-row" role="row">
                      <span className="rx-label" role="rowheader">Addl. Power</span>
                      <div role="cell">{eyeSelect("right", "add", ADD_OPTIONS, "ADDL")}</div>
                      <div role="cell">{eyeSelect("left", "add", ADD_OPTIONS, "ADDL")}</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <label className="upload-box">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handlePrescriptionFile}
                  disabled={uploading}
                />
                <span>
                  {uploading
                    ? "Uploading..."
                    : prescription.imageName
                      ? `Uploaded: ${prescription.imageName}`
                      : "Choose your prescription image or PDF"}
                </span>
                <small>JPG, PNG, WEBP or PDF · up to 5 MB</small>
              </label>
            )}

            <label className="check-line">
              <input
                type="checkbox"
                checked={prescription.consent}
                onChange={(e) => setPrescription((prev) => ({ ...prev, consent: e.target.checked }))}
              />
              I confirm the prescription details are correct.
            </label>
          </div>
        )}

        {currentStep === "Review" && (
          <div className="review-panel">
            <dl className="review-list">
              <div>
                <dt>Frame</dt>
                <dd>{product.name}</dd>
              </div>
              <div>
                <dt>Power type</dt>
                <dd>{powerType}</dd>
              </div>
              {powered && (
                <div>
                  <dt>Lens</dt>
                  <dd>
                    {lensType}
                    {photochromic && " · Photochromic"}
                  </dd>
                </div>
              )}
              {powered && (
                <div>
                  <dt>Prescription</dt>
                  <dd>
                    {prescription.mode === "image"
                      ? prescription.imageName || "Image uploaded"
                      : "Entered manually"}
                  </dd>
                </div>
              )}
            </dl>

            <PriceBreakdown pricing={pricing} />
          </div>
        )}

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <div className="lens-actions">
          <button type="button" className="lens-back" onClick={goBack} disabled={currentIndex === 0}>
            Back
          </button>

          {currentStep === "Review" ? (
            <button type="button" className="product-btn" onClick={confirmLens}>
              Confirm &amp; Add to Cart · {formatINR(pricing.total)}
            </button>
          ) : (
            <button type="button" className="product-btn" onClick={goNext}>
              Continue
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* =========================
   CONTACT LENS POWER
   Same table as the reference: RIGHT / LEFT columns, SPH, CYL, Axis, boxes per eye.
========================= */

const AXIS_OPTIONS = Array.from({ length: 181 }, (_, i) => String(i)); // 0 to 180
const BOX_OPTIONS = Array.from({ length: 6 }, (_, i) => String(i + 1));
const EMPTY_CONTACT_EYE = { sph: "", cyl: "", axis: "", boxes: "1" };

const CONTACT_ROWS = [
  { field: "sph", label: "Spherical", sub: "SPH", options: SPH_OPTIONS },
  { field: "cyl", label: "Cylindrical", sub: "CYL", options: CYL_OPTIONS },
  { field: "axis", label: "Axis", sub: "0-180", options: AXIS_OPTIONS },
  { field: "boxes", label: "No. of Boxes", sub: "1 lens/box", options: BOX_OPTIONS },
];

const isContactLens = (product) => String(product?.type || "").toLowerCase() === "contact lenses";

// Price is per box, so the line total is price x boxes across the selected eyes
const contactPricing = (unitPrice, units) => {
  const unit = Number(unitPrice) || 0;
  return { frame: unit, lens: 0, photochromic: 0, total: unit * units };
};

// Returns an error message, or "" when the entry is complete
const contactProblem = (eyes, rx) => {
  const included = ["right", "left"].filter((eye) => eyes[eye]);
  if (included.length === 0) return "Select at least one eye (RIGHT or LEFT).";

  for (const eye of included) {
    const label = eye === "right" ? "right" : "left";
    const row = rx[eye];

    if (!row.sph) return `Select the spherical power for the ${label} eye.`;
    if (Boolean(row.cyl) !== Boolean(row.axis)) {
      return `For the ${label} eye, select both CYL and Axis, or leave both empty.`;
    }
    if (!row.boxes || Number(row.boxes) < 1) return `Select the number of boxes for the ${label} eye.`;
  }

  return "";
};

function ContactLensCustomizer({ product, onCancel, onConfirm }) {
  const [eyes, setEyes] = useState({ right: true, left: true });
  const [rx, setRx] = useState({ right: EMPTY_CONTACT_EYE, left: EMPTY_CONTACT_EYE });
  const [error, setError] = useState("");

  const includedEyes = ["right", "left"].filter((eye) => eyes[eye]);
  const units = includedEyes.reduce((sum, eye) => sum + (Number(rx[eye].boxes) || 0), 0);
  const pricing = contactPricing(product.numericPrice, units);

  const updateEye = (eye, field, value) => {
    setRx((prev) => ({ ...prev, [eye]: { ...prev[eye], [field]: value } }));
    setError("");
  };

  const toggleEye = (eye, checked) => {
    setEyes((prev) => ({ ...prev, [eye]: checked }));
    setError("");
  };

  const confirmContact = () => {
    const problem = contactProblem(eyes, rx);
    if (problem) {
      setError(problem);
      return;
    }

    const cleanEye = (row) => ({ sph: row.sph, cyl: row.cyl, axis: row.axis, boxes: Number(row.boxes) });

    onConfirm({
      kind: "contact",
      eyes: { right: eyes.right, left: eyes.left },
      prescription: {
        right: eyes.right ? cleanEye(rx.right) : null,
        left: eyes.left ? cleanEye(rx.left) : null,
      },
      units,
      pricing,
    });
  };

  return (
    <Modal title="Select Contact Lens Power" onClose={onCancel} className="site-modal--form">
      <div className="lens-customizer">
        <p className="lens-product">
          {product.name} · {formatINR(product.numericPrice)} per box
        </p>

        <div className="rx-grid contact-grid" role="table" aria-label="Contact lens power">
          <div className="rx-row rx-head" role="row">
            <span role="columnheader">Power</span>
            {["right", "left"].map((eye) => (
              <label key={eye} className="eye-toggle" role="columnheader">
                <input type="checkbox" checked={eyes[eye]} onChange={(e) => toggleEye(eye, e.target.checked)} />
                {eye === "right" ? "RIGHT" : "LEFT"}
              </label>
            ))}
          </div>

          {CONTACT_ROWS.map((row) => (
            <div className="rx-row" role="row" key={row.field}>
              <span className="rx-label" role="rowheader">
                {row.label}
                <small>{row.sub}</small>
              </span>

              {["right", "left"].map((eye) => (
                <div role="cell" key={eye}>
                  <select
                    aria-label={`${row.label} for ${eye} eye`}
                    value={rx[eye][row.field]}
                    disabled={!eyes[eye]}
                    onChange={(e) => updateEye(eye, row.field, e.target.value)}
                  >
                    <option value="">Select</option>
                    {row.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="price-breakdown" aria-label="Price breakdown">
          <div>
            <span>Price per box</span>
            <span>{formatINR(pricing.frame)}</span>
          </div>
          <div>
            <span>Boxes</span>
            <span>{units}</span>
          </div>
          <div className="price-total">
            <span>Final price</span>
            <span>{formatINR(pricing.total)}</span>
          </div>
        </div>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <div className="lens-actions">
          <button type="button" className="lens-back" onClick={onCancel}>
            Cancel
          </button>

          <button type="button" className="product-btn" onClick={confirmContact} disabled={units < 1}>
            Add to Cart · {formatINR(pricing.total)}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProductDetails({ product, inCart, onClose, onAddToCart }) {
  const specEntries = Object.entries(product.specifications || {});
  const inStock = product.stockQuantity > 0;

  return (
    <Modal title="Product Details" onClose={onClose} className="site-modal--wide">
      <div className="product-details">
        <div className="product-details-image">
          <FallbackImage src={product.image} fallback={FALLBACK_IMAGES.product} alt={product.name} />
        </div>

        <div className="product-details-info">
          <span className="eyebrow">{product.type}</span>
          <h2>{product.name}</h2>
          {product.subtitle && <p className="product-subtitle">{product.subtitle}</p>}
          {product.size && <p className="product-size">Size: {product.size}</p>}
          <strong className="product-details-price">{product.price}</strong>

          <p className={inStock ? "product-stock" : "product-stock out-of-stock"}>
            {inStock ? "In Stock" : "Out of Stock"}
          </p>

          {product.description && (
            <div>
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
          )}

          {specEntries.length > 0 && (
            <div className="product-specifications">
              <h3>Product Specifications</h3>

              {specEntries.map(([key, value]) => (
                <div className="product-specification-row" key={key}>
                  <span>{formatSpecLabel(key)}</span>
                  <strong>{Array.isArray(value) ? value.join(", ") : String(value)}</strong>
                </div>
              ))}
            </div>
          )}

          <StockButton product={product} inCart={inCart} onAddToCart={onAddToCart} />

          {(isEyeglasses(product) || isContactLens(product)) && inStock && (
            <p className="customise-note">You will choose your power details before this is added to your cart.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}


function VariantPicker({ product, onCancel, onConfirm }) {
  const availableVariants = (product.variants || []).filter(
    (variant) => variant.availableQuantity > 0
  );
  const [selectedId, setSelectedId] = useState(
    String(availableVariants[0]?.id ?? "")
  );
  const selected = availableVariants.find(
    (variant) => String(variant.id) === selectedId
  );

  const describeAttributes = (attributes) =>
    Object.entries(attributes || {})
      .map(([key, value]) => `${formatSpecLabel(key)}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join(" · ");

  return (
    <Modal
      title={`Choose an option for ${product.name}`}
      onClose={onCancel}
      className="site-modal--form"
    >
      <div className="panel-form variant-picker">
        <p>Select the exact variant you want to purchase.</p>
        <label htmlFor="customer-variant-choice">Available variants</label>
        <select
          id="customer-variant-choice"
          className="variant-picker-select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {availableVariants.map((variant, index) => {
            const attributes = describeAttributes(variant.attributes);
            const label = variant.variantName || `Option ${index + 1}`;
            return (
              <option key={variant.id} value={String(variant.id)}>
                {label}{attributes ? ` — ${attributes}` : ""} · {variant.availableQuantity} available
              </option>
            );
          })}
        </select>

        {selected && (
          <div className="variant-picker-summary">
            <strong>{selected.variantName}</strong>
            <span>{formatINR(selected.numericPrice)}</span>
            <small>{selected.availableQuantity} available</small>
          </div>
        )}

        <button
          type="button"
          className="product-btn"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
        >
          Continue
        </button>
      </div>
    </Modal>
  );
}

// Values a product has for a facet ("gender" is a product field, the rest are specifications)
const facetValuesOf = (product, key) => {
  const raw = key === "gender" ? product.gender : product.specifications?.[key];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return raw ? [String(raw)] : [];
};

const isInPriceBand = (price, band) => price > band.min && price <= band.max;

const matchesPriceBands = (product, bandIds) =>
  bandIds.some((id) => {
    const band = PRICE_BANDS.find((item) => item.id === id);

    return band && isInPriceBand(product.numericPrice, band);
  });

// Facets combine with AND, values inside one facet with OR.
// skipKey ignores one facet's own selection, which is how its option counts are built.
const matchesFacets = (product, selections, skipKey) => {
  for (const [key, selected] of Object.entries(selections)) {
    if (key === skipKey || !selected?.length) continue;

    if (key === "price") {
      if (!matchesPriceBands(product, selected)) return false;
    } else if (!selected.some((value) => facetValuesOf(product, key).includes(value))) {
      return false;
    }
  }

  return true;
};

// Option list with counts for one facet, based on the products that match everything else
const buildFacetOptions = (base, selections, key) => {
  const pool = base.filter((p) => matchesFacets(p, selections, key));

  if (key === "price") {
    return PRICE_BANDS.map((band) => ({
      value: band.id,
      label: band.label,
      count: pool.filter((p) => isInPriceBand(p.numericPrice, band)).length,
    }));
  }

  const counts = new Map();
  pool.forEach((p) => facetValuesOf(p, key).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1)));

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map(([value, count]) => ({ value, label: value, count }));
};

const sortCatalogue = (items, sortBy) => {
  const list = [...items];
  switch (sortBy) {
    case "price-asc":
      return list.sort((a, b) => a.numericPrice - b.numericPrice);
    case "price-desc":
      return list.sort((a, b) => b.numericPrice - a.numericPrice);
    case "newest":
      return list.sort((a, b) => {
        const byDate = (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
        return byDate || Number(b.id) - Number(a.id);
      });
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    default:
      return list; // popularity keeps the order the API returns
  }
};

const isNewProduct = (product) =>
  Boolean(product.isNew) ||
  (Boolean(product.createdAt) &&
    Date.now() - new Date(product.createdAt).getTime() < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000);

// Sidebar: vertical tabs on the left, checkbox options on the right
function FilterPanel({
  sections,
  activeKey,
  onActiveKey,
  optionsByKey,
  selections,
  onToggle,
  facetSearch,
  onFacetSearch,
}) {
  const active = sections.find((s) => s.key === activeKey) ?? sections[0];
  if (!active) return null;

  const selected = selections[active.key] ?? [];
  const term = facetSearch.trim().toLowerCase();

  const visibleOptions = (optionsByKey[active.key] ?? []).filter(
    (option) =>
      // Price ranges always show all eight bands; other facets hide options with no matching products
      (active.type === "price" || option.count > 0 || selected.includes(option.value)) &&
      (!active.searchable || !term || option.label.toLowerCase().includes(term))
  );

  const tabCount = (section) => selections[section.key]?.length ?? 0;

  return (
    <div className="filter-panel">
      <div className="filter-tabs" role="tablist" aria-label="Filter groups">
        {sections.map((section) => {
          const count = tabCount(section);

          return (
            <button
              type="button"
              key={section.key}
              role="tab"
              id={`facet-tab-${section.key}`}
              aria-selected={section.key === active.key}
              aria-controls="facet-panel"
              className="filter-tab"
              onClick={() => {
                onActiveKey(section.key);
                onFacetSearch("");
              }}
            >
              {section.label}
              {count > 0 && <span className="filter-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="filter-options" role="tabpanel" id="facet-panel" aria-labelledby={`facet-tab-${active.key}`}>
        {active.searchable && (
          <div className="facet-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder={`Search ${active.label.toLowerCase()}`}
              aria-label={`Search ${active.label.toLowerCase()}`}
              value={facetSearch}
              onChange={(e) => onFacetSearch(e.target.value)}
            />
          </div>
        )}

        {["shape", "frameStyle", "gender"].includes(active.key) ? (
          <div className={`visual-facet-grid visual-facet-grid--${active.key}`}>
            {visibleOptions.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`visual-facet-tile ${checked ? "selected" : ""}`}
                  onClick={() => onToggle(active.key, option.value)}
                  aria-pressed={checked}
                >
                  <span className="visual-facet-art" aria-hidden="true">
                    {active.key === "shape" ? (
                      <svg viewBox="0 0 88 44" focusable="false">
                        {(() => {
                          const shape = option.value.toLowerCase();
                          if (shape.includes("round")) return <><circle cx="25" cy="21" r="13" /><circle cx="63" cy="21" r="13" /></>;
                          if (shape.includes("oval")) return <><ellipse cx="25" cy="21" rx="17" ry="11" /><ellipse cx="63" cy="21" rx="17" ry="11" /></>;
                          if (shape.includes("aviator")) return <><path d="M8 9 Q25 4 42 11 L39 29 Q25 42 12 28 Z" /><path d="M46 11 Q63 4 80 9 L76 28 Q63 42 49 29 Z" /></>;
                          if (shape.includes("cat")) return <><path d="M7 11 L13 7 Q27 3 42 12 L37 30 Q24 40 12 27 Z" /><path d="M46 12 Q61 3 75 7 L81 11 L76 27 Q64 40 51 30 Z" /></>;
                          if (shape.includes("square")) return <><rect x="9" y="8" width="32" height="26" rx="5" /><rect x="47" y="8" width="32" height="26" rx="5" /></>;
                          if (shape.includes("geometric")) return <><path d="M13 8 L36 8 L42 21 L36 34 L13 34 L7 21 Z" /><path d="M52 8 L75 8 L81 21 L75 34 L52 34 L46 21 Z" /></>;
                          return <><path d="M8 11 Q24 4 41 12 L39 29 Q25 39 12 29 Z" /><path d="M47 12 Q64 4 80 11 L76 29 Q63 39 49 29 Z" /></>;
                        })()}
                        <path d="M41 15 Q44 11 47 15 M2 15 L8 15 M80 15 L86 15" />
                      </svg>
                    ) : active.key === "frameStyle" ? (
                      <svg viewBox="0 0 88 44" focusable="false">
                        {option.value.toLowerCase().includes("semi") ? (
                          <><path d="M8 10 Q23 6 39 11 L38 27 Q24 36 10 27 Z M49 11 Q65 6 80 10 L78 27 Q64 36 50 27 Z" /><path d="M10 27 Q24 36 38 27 M50 27 Q64 36 78 27" strokeWidth="2.5" /></>
                        ) : option.value.toLowerCase().includes("rimless") ? (
                          <><path d="M8 14 L39 14 L39 29 L8 29 Z M49 14 L80 14 L80 29 L49 29 Z" strokeDasharray="2 3" /><path d="M39 20 L49 20 M23 14 L23 8 M65 14 L65 8" /></>
                        ) : (
                          <><rect x="8" y="9" width="32" height="27" rx="9" /><rect x="48" y="9" width="32" height="27" rx="9" /></>
                        )}
                        <path d="M40 19 Q44 15 48 19" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 48 48" focusable="false">
                        {option.value.toLowerCase() === "unisex" ? (
                          <><circle cx="17" cy="13" r="5" /><circle cx="32" cy="13" r="5" /><path d="M6 39 Q6 25 17 25 Q28 25 28 39 M21 39 Q21 25 32 25 Q43 25 43 39" /></>
                        ) : option.value.toLowerCase() === "women" ? (
                          <><circle cx="24" cy="12" r="6" /><path d="M12 40 Q12 24 24 24 Q36 24 36 40 M24 25 L18 39 M24 25 L30 39" /></>
                        ) : (
                          <><circle cx="24" cy="12" r="6" /><path d="M10 40 Q10 24 24 24 Q38 24 38 40 M17 30 L31 30" /></>
                        )}
                      </svg>
                    )}
                  </span>
                  <span className="visual-facet-label">{option.label}</span>
                  <span className="visual-facet-count">{option.count}</span>
                  {checked && <span className="visual-facet-check" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <ul className="facet-list">
            {visibleOptions.map((option) => (
              <li key={option.value}>
                <label className="facet-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => onToggle(active.key, option.value)}
                  />
                  <span className="facet-label">{option.label}</span>
                  <span className="facet-count">{option.count}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {visibleOptions.length === 0 && <p className="facet-empty">No options match this search.</p>}
      </div>
    </div>
  );
}

// Horizontal category chips with scroll arrows, as on the reference page
function CategoryRail({ options, value, onChange }) {
  const trackRef = useRef(null);
  const scrollBy = (direction) => trackRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" });

  return (
    <div className="category-rail">
      <button type="button" className="rail-arrow" onClick={() => scrollBy(-1)} aria-label="Scroll categories left">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <div className="category-rail-track" ref={trackRef} role="group" aria-label="Product categories">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={`rail-chip ${value === option ? "active" : ""}`}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <button type="button" className="rail-arrow" onClick={() => scrollBy(1)} aria-label="Scroll categories right">
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

function OfferBar({ offer }) {
  return (
    <div
      className="offer-bar"
      role="region"
      aria-label="Current offer"
      style={{
        backgroundColor: offer.backgroundColor || DEFAULT_OFFER_COLORS.background,
        color: offer.textColor || DEFAULT_OFFER_COLORS.text,
      }}
    >
      {safeHref(offer.targetUrl) ? <a href={safeHref(offer.targetUrl)}>{offer.message}</a> : offer.message}
    </div>
  );
}

function MarketingBanners({ banners, placement }) {
  const visible = banners
    .filter(
      (b) =>
        b.active !== false &&
        b.imageUrl &&
        (b.placement || "").toUpperCase() === placement
    )
    .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => (visible.length ? current % visible.length : 0));
  }, [visible.length]);

  useEffect(() => {
    if (visible.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visible.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [visible.length]);

  if (visible.length === 0) return null;

  const moveTo = (index) => setActiveIndex((index + visible.length) % visible.length);

  return (
    <section className="marketing-banners" aria-label="Promotions" aria-roledescription="carousel">
      <div className="marketing-banner-track">
        {visible.map((banner, index) => {
          const active = index === activeIndex;
          const href = safeHref(banner.targetUrl);
          const picture = <img src={banner.imageUrl} alt={banner.title || "NMK Opticals promotion"} loading={index === 0 ? "eager" : "lazy"} />;
          const slideContent = href ? (
            <a href={href} tabIndex={active ? 0 : -1}>{picture}</a>
          ) : (
            <div>{picture}</div>
          );

          return (
            <div
              key={banner.id}
              className={`marketing-banner-slide${active ? " is-active" : ""}`}
              aria-hidden={!active}
            >
              {slideContent}
            </div>
          );
        })}
      </div>

      {visible.length > 1 && (
        <>
          <button className="marketing-banner-arrow is-prev" type="button" aria-label="Previous promotion" onClick={() => moveTo(activeIndex - 1)}>‹</button>
          <button className="marketing-banner-arrow is-next" type="button" aria-label="Next promotion" onClick={() => moveTo(activeIndex + 1)}>›</button>
          <div className="marketing-banner-dots" aria-label="Choose promotion">
            {visible.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                className={index === activeIndex ? "is-active" : ""}
                aria-label={`Show promotion ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => moveTo(index)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* =========================
   ORDER TRACKING
   Public page at /track/:token. /track without a token shows the lookup form.
========================= */

const TRACK_STEPS = [
  { key: "PENDING", label: "Order placed" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

const TRACK_STATUS_MESSAGES = {
  PENDING: "We have received your order.",
  CONFIRMED: "Your order is confirmed and is being prepared.",
  SHIPPED: "Your order has been shipped.",
  OUT_FOR_DELIVERY: "Your order is out for delivery.",
  DELIVERED: "Your order has been delivered.",
  CANCELLED: "This order has been cancelled. Please contact NMK OPTICALS if you have any questions.",
};

// Tracking codes are URL-safe. The server makes the final check.
const TRACK_CODE_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

// Accepts a full tracking link or the bare code. Returns the code, or "" when it is not valid.
const extractTrackingCode = (input) => {
  const text = input.trim();
  const fromLink = text.match(/\/track\/([^/?#\s]+)/i)?.[1];
  const code = fromLink ?? text;
  return TRACK_CODE_PATTERN.test(code) ? code : "";
};

const trackStatusLabel = (status) =>
  TRACK_STEPS.find((step) => step.key === status)?.label ?? (status === "CANCELLED" ? "Cancelled" : status || "Pending");

const formatTrackDate = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: TIME_ZONE,
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

function TrackingLookupForm() {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();

    const code = extractTrackingCode(value);
    if (!code) {
      setError("Enter the tracking link or code from your order confirmation message.");
      return;
    }

    window.location.assign(`/track/${encodeURIComponent(code)}`);
  };

  return (
    <form className="track-lookup" onSubmit={submit} noValidate>
      <label htmlFor={inputId}>Tracking link or code</label>

      <div className="track-lookup-row">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          placeholder="Paste your tracking link"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />

        <button type="submit" className="product-btn track-lookup-btn">
          Track order
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}

function OrderTrackingPage({ token }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(token) && TRACK_CODE_PATTERN.test(token));
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Track your order | NMK OPTICALS";
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    // Malformed codes are rejected here, so no request is sent for them
    if (!TRACK_CODE_PATTERN.test(token)) {
      setLoading(false);
      setOrder(null);
      setError("This tracking link is not valid. Check the link from your order confirmation and try again.");
      return undefined;
    }

    const controller = new AbortController();

    setLoading(true);
    setError("");
    setOrder(null);

    const loadOrder = async () => {
      try {
        const response = await fetch(`${API_BASE}/orders/track/${encodeURIComponent(token)}`, {
          signal: controller.signal,
        });
        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "We could not find an order for this tracking link. Check the link and try again."
              : data.message || "Unable to load your order right now. Please try again."
          );
        }

        setOrder(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err instanceof TypeError ? NETWORK_MESSAGE : err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadOrder();
    return () => controller.abort();
  }, [token]);

  const currentIndex = order ? TRACK_STEPS.findIndex((step) => step.key === order.orderStatus) : -1;
  const cancelled = order?.orderStatus === "CANCELLED";
  const items = order?.items ?? [];

  return (
    <div className="website track-page">
      <header className="track-header">
        <a href="/" className="logo track-logo" aria-label="NMK Opticals home">
          <span>NMK</span>
          <small>OPTICALS</small>
        </a>
      </header>

      <main className="track-main">
        <section className="track-card" aria-labelledby="track-heading">
          <span className="eyebrow">ORDER TRACKING</span>
          <h1 id="track-heading">Track your order</h1>

          {!token && (
            <>
              <p className="track-intro">Paste the tracking link from your order confirmation message.</p>
              <TrackingLookupForm />
            </>
          )}

          {token && loading && (
            <p className="track-status" role="status" aria-live="polite">
              Loading your order…
            </p>
          )}

          {token && error && (
            <>
              <p className="track-error" role="alert">
                {error}
              </p>
              <TrackingLookupForm />
            </>
          )}

          {order && (
            <>
              <div className="track-summary">
                <div>
                  <span>Order date</span>
                  <strong>{formatTrackDate(order.orderDate)}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatINR(order.totalAmount, true)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong className={`track-badge track-badge--${String(order.orderStatus).toLowerCase()}`}>
                    {trackStatusLabel(order.orderStatus)}
                  </strong>
                </div>
              </div>

              <p className="track-message">
                {TRACK_STATUS_MESSAGES[order.orderStatus] ?? "Your order status is shown below."}
              </p>

              {!cancelled && (
                <ol className="track-steps" aria-label="Order progress">
                  {TRACK_STEPS.map((step, index) => {
                    const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "";

                    return (
                      <li key={step.key} className={state} aria-current={index === currentIndex ? "step" : undefined}>
                        <span className="track-step-dot" aria-hidden="true">
                          {index < currentIndex ? "✓" : index + 1}
                        </span>
                        <span>{step.label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}

              <dl className="track-delivery">
                <div>
                  <dt>Courier</dt>
                  <dd>{order.courierName || "Not assigned yet"}</dd>
                </div>
                <div>
                  <dt>Tracking number</dt>
                  <dd>{order.trackingNumber || "Not assigned yet"}</dd>
                </div>
                <div>
                  <dt>Delivering to</dt>
                  <dd>{[order.customerName, order.city].filter(Boolean).join(", ") || "-"}</dd>
                </div>
              </dl>

              <section className="track-section" aria-labelledby="track-items-heading">
                <h2 id="track-items-heading">Items</h2>

                {items.length === 0 ? (
                  <p className="track-muted">No items found for this order.</p>
                ) : (
                  <ul className="track-items">
                    {items.map((item, index) => (
                      <li key={`${item.productName}-${index}`}>
                        <span>{item.productName}</span>
                        <span>× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="track-help">
                Questions about your order? Call <a href="tel:+919344526439">93445 26439</a>.
              </p>

              <div className="track-footer-actions">
                <a className="text-btn" href="/">
                  Continue shopping
                </a>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

// Tracking link shown after a successful payment, with copy support
// Always built on this storefront's own origin, so the link opens the page that shows the order
function TrackingLinkBox({ trackingToken }) {
  const url = `${window.location.origin}/track/${encodeURIComponent(trackingToken)}`;
  const [copyState, setCopyState] = useState("idle"); // idle | copied | failed

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="track-link-box">
      <p>Track your order any time with this link:</p>

      <div className="track-link-row">
        <input
          type="text"
          readOnly
          value={url}
          aria-label="Order tracking link"
          onFocus={(e) => e.target.select()}
        />

        <button type="button" className="text-btn" onClick={copyLink}>
          {copyState === "copied" ? "Copied" : "Copy link"}
        </button>
      </div>

      <p className="track-link-note" role="status" aria-live="polite">
        {copyState === "failed" ? "Copying is not available here. Select the link and copy it manually." : ""}
      </p>

      <a className="product-btn track-open-btn" href={url}>
        Track your order
      </a>
    </div>
  );
}

export default function CustomerWebsite() {
  const rawTrackingToken = window.location.pathname.match(/^\/track\/([^/]+)\/?$/)?.[1];
  const trackingToken = rawTrackingToken === undefined ? undefined : safeDecodeURIComponent(rawTrackingToken);
  const isTrackPage =
    window.location.pathname === "/track" || window.location.pathname.startsWith("/track/");

  // DATA
  const [products, setProducts] = useState([]);
  const [productsReady, setProductsReady] = useState(false);
  const [productsPage, setProductsPage] = useState(0);
  const [productsHasNext, setProductsHasNext] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [cartReferenceProducts, setCartReferenceProducts] = useState([]);
  const [cartUnavailableProductIds, setCartUnavailableProductIds] = useState([]);
  const [cartReferencesReady, setCartReferencesReady] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [productReloadKey, setProductReloadKey] = useState(0);
  const [marketingOffer, setMarketingOffer] = useState(null);
  const [marketingBanners, setMarketingBanners] = useState([]);
  const [websiteImages, setWebsiteImages] = useState({});
  const [logoFailed, setLogoFailed] = useState(false);

  // FILTERS
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [facetSelections, setFacetSelections] = useState({}); // { [facetKey]: string[] }
  const [facetSearch, setFacetSearch] = useState("");
  const [activeFacet, setActiveFacet] = useState("brand");
  const [sortBy, setSortBy] = useState("popularity");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Filters are initially hidden on every screen
  const [filtersOpen, setFiltersOpen] = useState(false);

  // CART & WISHLIST (persisted)
  const [cart, setCart] = useState(() => readStorage(CART_KEY));
  const [wishlist, setWishlist] = useState(() => readStorage(WISHLIST_KEY));
  const cartRef = useRef(cart);

  // UI
  const [panel, setPanel] = useState(null); // cart | wishlist | checkout | eye | face | success | info
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variantChoosing, setVariantChoosing] = useState(null);
  const [infoTitle, setInfoTitle] = useState("");
  const [orderResult, setOrderResult] = useState(null);
  const [toast, setToast] = useState(null);

  // FORMS, LOADING, ERRORS
  const [eyeBooking, setEyeBooking] = useState(EMPTY_BOOKING);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const searchTimerRef = useRef(null);

  const notify = useCallback((message) => setToast({ message, id: Date.now() }), []);

  const closePanel = useCallback(() => {
    setPanel(null);
    setCheckoutError("");
    setBookingError("");
  }, []);

  const openInfo = (title) => {
    setInfoTitle(title);
    setPanel("info");
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // Clear the pending search-focus timer on unmount
  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  // PERSIST CART & WISHLIST
  useEffect(() => {
    writeStorage(CART_KEY, cart);
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    writeStorage(WISHLIST_KEY, wishlist);
  }, [wishlist]);

  // FETCH FIRST CATALOGUE PAGE AND REFRESH SAVED CART REFERENCES.
  // Cart lines outside the first page are looked up individually so pagination
  // never mistakes an unloaded product for a deleted or out-of-stock product.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadProducts = async () => {
      setLoadingProducts(true);
      setLoadingMoreProducts(false);
      setProductsReady(false);
      setCartReferencesReady(false);
      setProductError("");
      setProducts([]);
      setCartReferenceProducts([]);
      setCartUnavailableProductIds([]);
      setProductsPage(0);
      setProductsHasNext(false);
      setVisibleCount(PAGE_SIZE);

      try {
        const response = await fetch(`${API_URL}?page=0&size=24`, { signal });
        if (!response.ok) throw new Error("Failed to fetch products");

        const payload = await response.json();
        const rawProducts = Array.isArray(payload) ? payload : payload?.content;
        if (!Array.isArray(rawProducts)) throw new Error("Unexpected product data");

        const firstPage = rawProducts.map(toProduct);
        setProducts(firstPage);
        setProductsPage(Array.isArray(payload) ? 0 : Number(payload.number || 0));
        setProductsHasNext(Array.isArray(payload) ? false : Boolean(payload.last === false));

        const savedCart = Array.isArray(cartRef.current) ? cartRef.current : [];
        const cartProductIds = [...new Set(savedCart
          .map((item) => Number(item?.id))
          .filter((id) => Number.isInteger(id) && id > 0))];
        const missingCartProductIds = cartProductIds.filter(
          (id) => !firstPage.some((product) => Number(product.id) === id)
        );

        const cartLookups = await Promise.all(missingCartProductIds.map(async (id) => {
          try {
            const lookup = await fetch(`${API_URL}/${encodeURIComponent(id)}`, { signal });
            if (lookup.status === 404) return { id, unavailable: true };
            if (!lookup.ok) return { id, unavailable: false };
            return { id, product: toProduct(await lookup.json()), unavailable: false };
          } catch (lookupError) {
            if (lookupError.name === "AbortError") throw lookupError;
            return { id, unavailable: false };
          }
        }));

        setCartReferenceProducts(cartLookups.filter((item) => item.product).map((item) => item.product));
        setCartUnavailableProductIds(cartLookups.filter((item) => item.unavailable).map((item) => item.id));
        setProductsReady(true);
        setCartReferencesReady(true);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Product API error:", error);
        setProductError("We couldn't load the collection right now. Please try again.");
      } finally {
        if (!signal.aborted) setLoadingProducts(false);
      }
    };

    loadProducts();
    return () => controller.abort();
  }, [productReloadKey]);

  const loadMoreProducts = useCallback(async () => {
    if (!productsHasNext || loadingMoreProducts) return;
    const nextPage = productsPage + 1;
    setLoadingMoreProducts(true);
    try {
      const response = await fetch(`${API_URL}?page=${nextPage}&size=24`);
      if (!response.ok) throw new Error("Unable to load more products");
      const payload = await response.json();
      const rawProducts = Array.isArray(payload) ? payload : payload?.content;
      if (!Array.isArray(rawProducts)) throw new Error("Unexpected product data");

      const nextProducts = rawProducts.map(toProduct);
      setProducts((current) => [
        ...current,
        ...nextProducts.filter((product) => !current.some((existing) => Number(existing.id) === Number(product.id))),
      ]);
      setProductsPage(Array.isArray(payload) ? nextPage : Number(payload.number ?? nextPage));
      setProductsHasNext(Array.isArray(payload) ? false : Boolean(payload.last === false));
      setVisibleCount((current) => current + PAGE_SIZE);
    } catch (error) {
      console.error("Load more products error:", error);
      notify("We couldn't load more products right now. Please try again.");
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [productsHasNext, loadingMoreProducts, productsPage, notify]);

  // KEEP SAVED CART IN STEP WITH LOADED PRODUCTS AND DIRECT CART REFERENCES.
  useEffect(() => {
    if (!productsReady || !cartReferencesReady) return;

    const byId = new Map();
    [...cartReferenceProducts, ...products].forEach((product) => byId.set(Number(product.id), product));
    const { items, removed } = reconcileCart(
      cartRef.current,
      [...byId.values()],
      cartUnavailableProductIds
    );
    cartRef.current = items;
    setCart(items);

    if (removed > 0) notify("Some items in your cart are no longer available and were removed.");
  }, [products, cartReferenceProducts, cartUnavailableProductIds, productsReady, cartReferencesReady, notify]);

  // FETCH WEBSITE IMAGES
  useEffect(() => {
    const controller = new AbortController();

    const loadImages = async () => {
      try {
        const response = await fetch(`${API_BASE}/website-images`, { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to fetch website images");

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Unexpected website image data");

        setWebsiteImages(Object.fromEntries(data.map((img) => [img.imageKey, img.imageUrl])));
      } catch (error) {
        if (error.name !== "AbortError") console.error("Website images API error:", error);
      }
    };

    loadImages();
    return () => controller.abort();
  }, []);

  // A new logo link gets a fresh chance to load
  useEffect(() => {
    setLogoFailed(false);
  }, [websiteImages.LOGO]);

  // FETCH MARKETING DATA (offer and banners load independently)
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadMarketing = async () => {
      try {
        const [offerRes, bannerRes] = await Promise.all([
          fetch(`${API_BASE}/marketing/offer`, { signal }),
          fetch(`${API_BASE}/marketing/banners`, { signal }),
        ]);

        if (offerRes.status === 204) setMarketingOffer(null);
        else if (offerRes.ok) setMarketingOffer(await offerRes.json());

        if (bannerRes.ok) setMarketingBanners(await bannerRes.json());
      } catch (error) {
        if (error.name !== "AbortError") console.error("Marketing API error:", error);
      }
    };

    loadMarketing();
    return () => controller.abort();
  }, []);

  /* ---------- DERIVED DATA ---------- */

  // Category and search form the base set; facets and price narrow it further
  const baseProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All" || product.type.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.subtitle || "").toLowerCase().includes(term) ||
        product.type.toLowerCase().includes(term) ||
        product.gender.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  const availableSections = useMemo(
    () =>
      FACET_SECTIONS.filter(
        (section) => section.type === "price" || baseProducts.some((p) => facetValuesOf(p, section.key).length > 0)
      ),
    [baseProducts]
  );

  const facetOptions = useMemo(
    () =>
      Object.fromEntries(
        availableSections.map((section) => [
          section.key,
          buildFacetOptions(baseProducts, facetSelections, section.key),
        ])
      ),
    [availableSections, baseProducts, facetSelections]
  );

  const filteredProducts = useMemo(
    () => sortCatalogue(baseProducts.filter((p) => matchesFacets(p, facetSelections)), sortBy),
    [baseProducts, facetSelections, sortBy]
  );

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  const activeFilterChips = useMemo(() => {
    const chips = [];

    Object.entries(facetSelections).forEach(([key, values]) => {
      const section = FACET_SECTIONS.find((s) => s.key === key);
      values?.forEach((value) => {
        const label = key === "price" ? PRICE_BANDS.find((b) => b.id === value)?.label ?? value : value;
        chips.push({ key, value, label: `${section?.label ?? key}: ${label}` });
      });
    });

    if (selectedCategory !== "All") chips.unshift({ key: "category", value: selectedCategory, label: `Category: ${selectedCategory}` });
    if (searchTerm.trim()) chips.push({ key: "search", value: searchTerm, label: `Search: ${searchTerm.trim()}` });
    return chips;
  }, [facetSelections, selectedCategory, searchTerm]);

  const hasActiveFilters = selectedCategory !== "All" || searchTerm.trim() !== "" || activeFilterChips.length > 0;

  const wishlistIds = useMemo(() => new Set(wishlist.map((item) => item.id)), [wishlist]);

  // Wishlist rows show the live catalogue price and stock instead of the values saved when hearted
  const wishlistItems = useMemo(() => {
    const live = new Map(products.map((p) => [p.id, p]));

    return wishlist.map((saved) => {
      const fresh = live.get(saved.id);
      if (fresh) return fresh;
      return productsReady ? { ...saved, stockQuantity: 0 } : saved; // no longer sold
    });
  }, [wishlist, products, productsReady]);

  // Total units per product id across all lens variants
  const cartCounts = useMemo(() => {
  const counts = new Map();

  cart.forEach((item) => {
    if (!item || item.id == null) return;

    counts.set(
      item.id,
      (counts.get(item.id) || 0) + (Number(item.quantity) || 0)
    );
  });

  return counts;
}, [cart]);

  const cartUnits = cart.reduce(
  (sum, item) => sum + (item ? Number(item.quantity) || 0 : 0),
  0
);

const cartTotal = cart.reduce(
  (sum, item) =>
    sum + (item ? (Number(item.numericPrice) || 0) * (Number(item.quantity) || 0) : 0),
  0
);

  // Booking dates and slot availability follow the India calendar
  const today = todayInIndia();
  const nowMinutes = minutesNowInIndia();

  /* ---------- CART & WISHLIST ACTIONS ---------- */

  // Lens customisation for eyeglasses. The pair stays out of the cart until the customer confirms.
  const [customizing, setCustomizing] = useState(null);

  const unitsInCart = (items, productId, variantId = null) =>
    items
      .filter((item) =>
        item &&
        item.id === productId &&
        (variantId == null || Number(item.variantId) === Number(variantId))
      )
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const addPlainItem = (product) => {
    const lineId = `${product.id}:${product.variantId}`;
    const current = cartRef.current;
    const exists = current.some((item) => cartLineKey(item) === lineId);
    const inCart = unitsInCart(current, product.id, product.variantId);

    if (inCart >= product.stockQuantity) {
      notify(`Only ${product.stockQuantity} of this variant are available.`);
      return false;
    }

    const next = exists
      ? current.map((item) => (cartLineKey(item) === lineId ? { ...item, quantity: item.quantity + 1 } : item))
      : [...current, { ...product, lineId, quantity: 1, lens: null }];

    cartRef.current = next;
    setCart(next);
    notify("Product added to cart!");
    return true;
  };

  const addSelectedVariant = (product, variant) => {
    const selectedProduct = {
      ...product,
      variantId: Number(variant.id),
      variantName: variant.variantName,
      variantAttributes: variant.attributes || {},
      stockQuantity: Number(variant.availableQuantity) || 0,
      numericPrice: Number(variant.numericPrice ?? variant.price) || 0,
      price: formatINR(Number(variant.numericPrice ?? variant.price) || 0),
    };
    const inCart = unitsInCart(
      cartRef.current,
      selectedProduct.id,
      selectedProduct.variantId
    );

    if (selectedProduct.stockQuantity <= 0 || inCart >= selectedProduct.stockQuantity) {
      notify("This variant is no longer available. Please choose another option.");
      return false;
    }

    if (isEyeglasses(selectedProduct) || isContactLens(selectedProduct)) {
      setSelectedProduct(null);
      setPanel(null);
      setCustomizing(selectedProduct);
      return false;
    }

    return addPlainItem(selectedProduct);
  };

  // Leaves the customiser and opens the existing eye test booking form
  const openEyeTestFromCustomizer = () => {
    setCustomizing(null);
    setPanel("eye");
  };

  const addLensLine = (product, lens) => {
    const units = lens.kind === "contact" ? lens.units : 1;
    const inCart = unitsInCart(cartRef.current, product.id, product.variantId);

    if (inCart + units > product.stockQuantity) {
      notify(`Only ${product.stockQuantity} available for this variant. You already have ${inCart} in your cart.`);
      return;
    }

    const unitPrice = lens.kind === "contact" ? Number(product.numericPrice) || 0 : lens.pricing.total;
    const next = [
      ...cartRef.current,
      { ...product, lineId: makeLineId(), quantity: units, lens, numericPrice: unitPrice, price: formatINR(unitPrice) },
    ];

    cartRef.current = next;
    setCart(next);
    notify(lens.kind === "contact" ? "Contact lenses added to your cart." : "Eyeglasses added to your cart with your lens choices.");
  };

  // Every cart line must be tied to a real, active catalogue variant.
  const requestAddToCart = useCallback(
    (product) => {
      if (product.stockQuantity <= 0) {
        notify("This product is out of stock.");
        return false;
      }

      if (unitsInCart(cartRef.current, product.id) >= product.stockQuantity) {
        notify("You already have the available quantity of this product in your cart.");
        return false;
      }

      const availableVariants = (product.variants || []).filter(
        (variant) => variant.availableQuantity > 0
      );

      if (availableVariants.length === 0) {
        notify("No purchasable variants are currently available.");
        return false;
      }

      if (availableVariants.length === 1) {
        return addSelectedVariant(product, availableVariants[0]);
      }

      setSelectedProduct(null);
      setPanel(null);
      setVariantChoosing(product);
      return false;
    },
    [notify]
  );

  const setCartQuantity = useCallback((lineKey, quantity) => {
    setCart((current) => {
      const target = current.find(
  (item) => item && cartLineKey(item) === lineKey
);
      if (!target) return current;

      const others = current
        .filter((item) =>
          item &&
          item.id === target.id &&
          Number(item.variantId) === Number(target.variantId) &&
          cartLineKey(item) !== lineKey
        )
        .reduce((sum, item) => sum + item.quantity, 0);
      const max = Math.max(1, target.stockQuantity - others);

      return current.map((item) =>
        cartLineKey(item) === lineKey ? { ...item, quantity: Math.min(Math.max(1, quantity), max) } : item
      );
    });
  }, []);

  const removeFromCart = useCallback((lineKey) => {
    setCart((current) => current.filter((item) => cartLineKey(item) !== lineKey));
  }, []);

  const toggleWishlist = useCallback((product) => {
    setWishlist((current) =>
      current.some((item) => item.id === product.id)
        ? current.filter((item) => item.id !== product.id)
        : [...current, product]
    );
  }, []);

  /* ---------- FILTER & NAVIGATION HELPERS ---------- */

  const scrollToProducts = useCallback(() => {
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const openSearch = () => {
    scrollToProducts();
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      document.getElementById("product-search")?.focus({ preventScroll: true });
    }, SEARCH_FOCUS_DELAY_MS);
  };

  // Every filter change starts again from the first page of results
  const selectCategoryFilter = (name) => {
    setSelectedCategory(name);
    setFacetSelections({});
    setFacetSearch("");
    setVisibleCount(PAGE_SIZE);
  };

  const selectCategoryFromCard = (name) => {
    selectCategoryFilter(name);
    setSearchTerm("");
    scrollToProducts();
  };

  const updateSearch = (value) => {
    setSearchTerm(value);
    setVisibleCount(PAGE_SIZE);
  };

  const toggleFacetValue = (key, value) => {
    setFacetSelections((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
    setVisibleCount(PAGE_SIZE);
  };

  const removeFilterChip = (chip) => {
    if (chip.key === "category") setSelectedCategory("All");
    else if (chip.key === "search") setSearchTerm("");
    else {
      setFacetSelections((prev) => ({
        ...prev,
        [chip.key]: (prev[chip.key] ?? []).filter((v) => v !== chip.value),
      }));
    }
    setVisibleCount(PAGE_SIZE);
  };

  const clearFacets = () => {
    setFacetSelections({});
    setSelectedCategory("All");
    setSearchTerm("");
    setFacetSearch("");
    setVisibleCount(PAGE_SIZE);
  };

  const resetFilters = () => {
    selectCategoryFilter("All");
    setSearchTerm("");
  };

  /* ---------- EYE APPOINTMENT ---------- */

  const updateBooking = (field) => (e) => setEyeBooking((prev) => ({ ...prev, [field]: e.target.value }));

  // Changing the date clears a chosen slot that has already started on that day
  const updateBookingDate = (e) => {
    const date = e.target.value;

    setEyeBooking((prev) => {
      const stillOpen = !prev.slot || isSlotAvailable(TIME_SLOTS[prev.slot], date, today, nowMinutes);
      return { ...prev, date, slot: stillOpen ? prev.slot : "" };
    });
  };

  const selectSlot = (slot) => setEyeBooking((prev) => ({ ...prev, slot }));

  // Opens the native date picker on click where supported
  const openDatePicker = (e) => {
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // Not supported here; the native input still works
    }
  };

  const handleEyeBooking = async (e) => {
    e.preventDefault();

    const time = TIME_SLOTS[eyeBooking.slot];
    if (!time || !isSlotAvailable(time, eyeBooking.date, todayInIndia(), minutesNowInIndia())) {
      setBookingError("That time slot has already passed. Please choose another time.");
      return;
    }

    setBookingError("");
    setAppointmentLoading(true);

    try {
      const response = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          customerName: eyeBooking.name.trim(),
          phone: eyeBooking.phone.trim(),
          email: eyeBooking.email.trim() || null,
          appointmentDate: eyeBooking.date,
          appointmentTime: time,
        }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || "Unable to book appointment.");

      setEyeBooking(EMPTY_BOOKING);
      closePanel();
      notify("Your eye checkup appointment has been booked!");
    } catch (error) {
      console.error("Appointment booking error:", error);
      setBookingError(getErrorMessage(error));
    } finally {
      setAppointmentLoading(false);
    }
  };

  /* ---------- PAYMENT ---------- */

  const verifyPayment = async (paymentResponse) => {
    try {
      const res = await fetch(`${API_BASE}/payment/verify`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          razorpayOrderId: paymentResponse.razorpay_order_id,
          razorpayPaymentId: paymentResponse.razorpay_payment_id,
          razorpaySignature: paymentResponse.razorpay_signature,
        }),
      });

      const verifyData = await readJson(res);
      if (!res.ok || !verifyData.verified) {
        throw new Error(verifyData.message || "Payment verification failed.");
      }

      cartRef.current = [];
      setCart([]);
      setCheckoutError("");
      setOrderResult({
        orderId: verifyData.databaseOrderId,
        trackingToken: verifyData.trackingToken,
        trackingUrl: verifyData.trackingUrl,
      });
      setPanel("success");
    } catch (error) {
      console.error("Payment verification error:", error);
      // The customer has paid, so keep the cart and give a reference for support
      setCheckoutError(
        `We could not confirm your payment yet. Please contact NMK OPTICALS with payment ID ${
          paymentResponse.razorpay_payment_id || "shown on your receipt"
        }. Your cart has been kept.`
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCheckoutPayment = async (e) => {
    e.preventDefault();
    setCheckoutError("");

    if (cart.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    if (cart.some((item) => !Number.isInteger(Number(item.variantId)) || Number(item.variantId) <= 0)) {
      setCheckoutError("Your cart is still being refreshed. Please wait a moment and try again.");
      return;
    }

    setPaymentLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const field = (name) => String(formData.get(name) ?? "").trim();

      const customer = {
        customerName: field("customerName"),
        email: field("email") || null,
        phone: field("phone"),
        address: field("address"),
        city: field("city"),
        state: field("state"),
        pincode: field("pincode"),
      };

      // CREATE ORDER
      const response = await fetch(`${API_BASE}/orders/checkout`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          ...customer,
          items: cart.map((item) => ({
            productId: Number(item.id),
            variantId: Number(item.variantId),
            quantity: item.quantity,
            lensKind: item.lens?.kind ?? null,
            prescriptionType: item.lens?.powerType ?? null,
            lensType: item.lens?.lensType ?? null,
            photochromic: Boolean(item.lens?.photochromic),
            prescription: item.lens?.prescription ?? null,
            prescriptionFileName: item.lens?.prescriptionFileName ?? null,
          })),
        }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || "Unable to create order.");

      // OPEN RAZORPAY
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Unable to load Razorpay checkout.");

      const razorpay = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "NMK OPTICALS",
        description: "Online Product Purchase",
        order_id: data.razorpayOrderId,
        prefill: {
          name: customer.customerName,
          email: customer.email || undefined,
          contact: customer.phone,
        },
        theme: { color: "#c49a45" },
        handler: verifyPayment,
        modal: {
          ondismiss: () => setPaymentLoading(false),
        },
      });

      razorpay.on("payment.failed", (paymentResponse) => {
        setCheckoutError(paymentResponse.error?.description || "Payment failed. Please try again.");
        setPaymentLoading(false);
      });

      razorpay.open();
    } catch (error) {
      console.error("Checkout error:", error);
      setCheckoutError(getErrorMessage(error));
      setPaymentLoading(false);
    }
  };

  /* ---------- RENDER HELPERS ---------- */

  const renderProducts = () => {
    if (loadingProducts) {
      return Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className="product-skeleton" aria-hidden="true" />
      ));
    }

    if (productError) {
      return (
        <div className="grid-message">
          <p>{productError}</p>
          <button type="button" className="text-btn" onClick={() => setProductReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      );
    }

    if (filteredProducts.length === 0) {
      return (
        <div className="grid-message">
          <p>{productsHasNext ? "No matches in the loaded pages. Load more to search the rest of the catalogue." : "No matching products found."}</p>
          {hasActiveFilters && (
            <button type="button" className="text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </div>
      );
    }

    return visibleProducts.map((item) => (
      <ProductCard
        key={item.id}
        product={item}
        inCart={cartCounts.get(item.id) ?? 0}
        isWishlisted={wishlistIds.has(item.id)}
        onToggleWishlist={toggleWishlist}
        onAddToCart={requestAddToCart}
        onViewDetails={setSelectedProduct}
      />
    ));
  };

  const resultText = loadingProducts
    ? "Loading products"
    : productError
      ? ""
      : `${filteredProducts.length} products loaded${productsHasNext ? " · load more to search the full catalogue" : " found"}`;

  const cartSummary = cart.filter(Boolean).map((item) => (
    <div className="checkout-summary-item" key={cartLineKey(item)}>
      <span>
        <strong>{item.name}</strong>
        {item.variantName && <small className="checkout-variant-name">{item.variantName}</small>}
        {item.quantity > 1 && ` × ${item.quantity}`}
        {item.lens && <LensSummary lens={item.lens} />}
      </span>

      <span>{formatINR(item.numericPrice * item.quantity)}</span>
    </div>
  ));

  const slotsForDay = Object.entries(TIME_SLOTS).map(([slot, time]) => ({
    slot,
    available: isSlotAvailable(time, eyeBooking.date, today, nowMinutes),
  }));
  if (isTrackPage) {
    return <OrderTrackingPage token={trackingToken ?? ""} />;
  }

  return (
    <div className="website">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {isOfferLive(marketingOffer) && <OfferBar offer={marketingOffer} />}

      <div className="topbar">Welcome to NMK OPTICALS | Avalurpet, Tiruvannamalai</div>

      {/* HEADER */}
      <header className="header">
        <div className="header-container">
          <a href="#home" className="logo" aria-label="NMK Opticals home">
            {websiteImages.LOGO && !logoFailed ? (
              <img
                src={websiteImages.LOGO}
                alt="NMK Opticals"
                onError={() => setLogoFailed(true)}
              />
            ) : null}
          </a>

          <nav className="nav-menu" aria-label="Main">
            <a href="#home">Home</a>
            <a href="#categories">Collections</a>
            <a href="#products">Products</a>
            <a href="#store">Our Store</a>
            <a href="#eye-test">Eye Testing</a>
          </nav>

          <div className="header-actions">
            <button type="button" onClick={openSearch} aria-label="Search products">
              <Search aria-hidden="true" />
            </button>

            <button type="button" onClick={() => notify("Customer accounts are coming soon.")} aria-label="Account">
              <UserRound aria-hidden="true" />
            </button>

            <button type="button" onClick={() => setPanel("wishlist")} aria-label={`Wishlist (${wishlist.length} items)`}>
              <Heart aria-hidden="true" />
              {wishlist.length > 0 && (
                <span className="header-badge" aria-hidden="true">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button type="button" onClick={() => setPanel("cart")} aria-label={`Shopping cart (${cartUnits} items)`}>
              <ShoppingBag aria-hidden="true" />
              {cartUnits > 0 && (
                <span className="header-badge" aria-hidden="true">
                  {cartUnits}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* HERO */}
        <section className="hero" id="home">
          <div className="hero-content">
            <span className="hero-eyebrow">NMK OPTICALS · AVALURPET</span>

            <h1>
              See the world
              <br />
              <span>in a new light.</span>
            </h1>

            <p>Discover eyewear that brings your vision, comfort and style together.</p>

            <button type="button" className="hero-btn" onClick={openSearch}>
              Explore Collection
              <ArrowRight size={18} aria-hidden="true" />
            </button>

            <div className="hero-note">Premium eyewear · Free eye testing</div>
          </div>

          <div className="hero-image">
            <FallbackImage
              src={websiteImages.HERO || FALLBACK_IMAGES.hero}
              fallback={FALLBACK_IMAGES.hero}
              alt="Premium eyewear collection"
              decoding="async"
            />
          </div>

          <MarketingBanners banners={marketingBanners} placement="HOME_HERO" />
        </section>

        <MarketingBanners banners={marketingBanners} placement="HOME" />

        {/* CATEGORIES */}
        <section className="category-section section" id="categories" aria-labelledby="categories-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EXPLORE COLLECTIONS</span>
              <h2 id="categories-heading">Shop by Category</h2>
            </div>

            <a href="#products" onClick={resetFilters}>
              View all collections
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>

          <div className="category-grid">
            {CATEGORIES.map((item) => (
              <a key={item.name} className="category-card" href="#products" onClick={() => selectCategoryFromCard(item.name)}>
                <FallbackImage src={websiteImages[item.imageKey] || item.image} fallback={item.image} alt="" loading="lazy" />

                <div className="category-info">
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.desc}</p>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* CATALOGUE: category rail, toolbar, filter sidebar and product grid */}
        <section className="products-section section catalogue" id="products" aria-labelledby="products-heading">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <a href="#home">Home</a>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{selectedCategory === "All" ? "All Eyewear" : selectedCategory}</span>
          </nav>

          <div className="catalogue-heading">
            <h2 id="products-heading">{selectedCategory === "All" ? "All Eyewear" : selectedCategory}</h2>
            <p>Frames and lenses that blend style and comfort for every face.</p>
          </div>

          {products.length > 0 && (
            <CategoryRail options={CATEGORY_FILTERS} value={selectedCategory} onChange={selectCategoryFilter} />
          )}

          <div className="catalogue-toolbar">
            <button
              type="button"
              className="filter-toggle"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="catalogue-filters"
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              {filtersOpen ? "Hide Filters" : "Show Filters"}
              {activeFilterChips.length > 0 && (
                <span className="filter-toggle-count" aria-label={`${activeFilterChips.length} filters applied`}>
                  {activeFilterChips.length}
                </span>
              )}
            </button>

            <div className="product-search catalogue-search">
              <Search size={18} aria-hidden="true" />
              <input
                id="product-search"
                type="search"
                placeholder="Search eyewear..."
                aria-label="Search eyewear"
                value={searchTerm}
                onChange={(e) => updateSearch(e.target.value)}
              />
              {searchTerm && (
                <button type="button" className="search-clear" onClick={() => updateSearch("")} aria-label="Clear search">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>

            <label className="sort-control">
              <span>Sort by</span>
              <span className="sort-select-wrap">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort products">
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
          </div>

          <p className="sr-only" aria-live="polite">
            {resultText}
          </p>

          <div className={`catalogue-layout ${filtersOpen ? "filters-open" : "filters-closed"}`}>
            <aside id="catalogue-filters" className="filter-sidebar" aria-label="Filter products">
              <div className="filter-sidebar-head">
                <h3>Filters</h3>
                <div>
                  <button
                    type="button"
                    className="text-btn clear-facets"
                    onClick={clearFacets}
                    disabled={activeFilterChips.length === 0}
                  >
                    Clear filters
                  </button>
                  <button type="button" className="filter-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {availableSections.length > 0 && (
                <FilterPanel
                  sections={availableSections}
                  activeKey={activeFacet}
                  onActiveKey={setActiveFacet}
                  optionsByKey={facetOptions}
                  selections={facetSelections}
                  onToggle={toggleFacetValue}
                  facetSearch={facetSearch}
                  onFacetSearch={setFacetSearch}
                />
              )}
            </aside>

            {filtersOpen && (
              <button type="button" className="filter-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />
            )}

            <div className="catalogue-main">
              {activeFilterChips.length > 0 && (
                <div className="active-filters" aria-label="Applied filters">
                  {activeFilterChips.map((chip) => (
                    <button
                      type="button"
                      key={`${chip.key}-${chip.value}`}
                      className="active-chip"
                      onClick={() => removeFilterChip(chip)}
                      aria-label={`Remove filter ${chip.label}`}
                    >
                      {chip.label}
                      <X size={13} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              <p className="catalogue-result-count" aria-live="polite">{resultText}</p>
              <div className="product-grid" aria-busy={loadingProducts}>
                {renderProducts()}
              </div>

              {!loadingProducts && !productError && (filteredProducts.length > visibleCount || productsHasNext) && (
                <div className="load-more">
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => {
                      if (filteredProducts.length > visibleCount) {
                        setVisibleCount((n) => n + PAGE_SIZE);
                      } else {
                        loadMoreProducts();
                      }
                    }}
                    disabled={loadingMoreProducts}
                  >
                    {loadingMoreProducts
                      ? "Loading products..."
                      : filteredProducts.length > visibleCount
                        ? `Show more (${filteredProducts.length - visibleCount} remaining)`
                        : "Load more products"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* STORE */}
        <section className="store-section" id="store" aria-labelledby="store-heading">
          <div className="store-image">
            <FallbackImage
              src={websiteImages.STORE || FALLBACK_IMAGES.store}
              fallback={FALLBACK_IMAGES.store}
              alt="Eyewear showroom"
              loading="lazy"
            />
          </div>

          <div className="store-content">
            <span className="eyebrow">VISIT OUR SHOWROOM</span>

            <h2 id="store-heading">
              Experience eyewear
              <br />
              in person.
            </h2>

            <p>Explore our collections, find your perfect frame and experience personal attention at NMK OPTICALS.</p>

            <div className="store-detail">
              <MapPin aria-hidden="true" />
              {STORE_INFO.address}
            </div>

            <div className="store-detail">
              <Clock aria-hidden="true" />
              Open {STORE_INFO.hours}
            </div>

            <div className="store-actions">
              <a className="text-btn" href={STORE_INFO.mapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation size={16} aria-hidden="true" />
                Get directions
              </a>

              <a className="text-btn" href={STORE_INFO.callHref}>
                <Phone size={16} aria-hidden="true" />
                Call {STORE_INFO.phoneDisplay}
              </a>

              <a className="text-btn" href={STORE_INFO.whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} aria-hidden="true" />
                WhatsApp
              </a>
            </div>

            <h3 className="store-services-title">Our services</h3>

            <ul className="store-services">
              {STORE_INFO.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* SERVICES */}
        <section className="services-section section" id="eye-test" aria-labelledby="services-heading">
          <div className="section-heading centered">
            <span className="eyebrow">CARE BEYOND EYEWEAR</span>
            <h2 id="services-heading">Your Vision Deserves the Best</h2>
            <p>More than eyewear. A complete vision-care experience.</p>
          </div>

          <div className="service-grid">
            <article className="service-card">
              <div className="service-icon">
                <Eye aria-hidden="true" />
              </div>
              <h3>Free Eye Testing</h3>
              <p>Book your eye examination at our store with our eye-care service.</p>
              <button type="button" className="text-btn" onClick={() => setPanel("eye")}>
                Book an Appointment
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </article>

            <article className="service-card">
              <div className="service-icon">
                <ScanFace aria-hidden="true" />
              </div>
              <h3>Face Shape Analysis</h3>
              <p>Discover your estimated face shape and get suggestions for suitable frame styles.</p>
              <button type="button" className="text-btn" onClick={() => setPanel("face")}>
                Analyze My Face
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </article>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <span className="eyebrow">NMK OPTICALS</span>
          <h2>A clearer view. A better you.</h2>
          <p>Find eyewear that feels right and looks even better.</p>

          <button type="button" className="white-btn" onClick={openSearch}>
            Explore Our Collection
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <div className="logo footer-logo">
              <span>NMK</span>
              <small>OPTICALS</small>
            </div>
            <p>Bringing clarity, comfort and confidence to every vision.</p>
          </div>

          <div>
            <h4>Shop</h4>
            <a href="#categories">Eyeglasses</a>
            <a href="#categories">Sunglasses</a>
            <a href="#categories">Contact Lenses</a>
            <a href="#categories">Computer Glasses</a>
          </div>

          <div>
            <h4>Customer Care</h4>
            <a href="#store">Contact Us</a>
            <a href="#eye-test">Eye Testing</a>
            <button type="button" className="footer-link" onClick={() => openInfo("Shipping Policy")}>
              Shipping Policy
            </button>
            <button type="button" className="footer-link" onClick={() => openInfo("Returns & Refunds")}>
              Returns &amp; Refunds
            </button>
          </div>

          <div>
            <h4>Visit Us</h4>
            <p>Avalurpet, Tiruvannamalai, Tamil Nadu</p>
            <p>Store enquiries: Contact NMK OPTICALS</p>
          </div>
        </div>

        <div className="copyright">© 2026 NMK OPTICALS. All rights reserved.</div>
      </footer>

      {/* PRODUCT DETAILS */}
      {selectedProduct && (
        <ProductDetails
          product={selectedProduct}
          inCart={cartCounts.get(selectedProduct.id) ?? 0}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={requestAddToCart}
        />
      )}

      {/* SELECT A REAL INVENTORY VARIANT BEFORE ADDING TO CART */}
      {variantChoosing && (
        <VariantPicker
          product={variantChoosing}
          onCancel={() => setVariantChoosing(null)}
          onConfirm={(variant) => {
            const product = variantChoosing;
            setVariantChoosing(null);
            addSelectedVariant(product, variant);
          }}
        />
      )}

      {/* CUSTOMISATION (eyeglasses and contact lenses) */}
      {customizing && isContactLens(customizing) && (
        <ContactLensCustomizer
          product={customizing}
          onCancel={() => setCustomizing(null)}
          onConfirm={(lens) => {
            addLensLine(customizing, lens);
            setCustomizing(null);
          }}
        />
      )}

      {customizing && !isContactLens(customizing) && (
        <LensCustomizer
          product={customizing}
          onCancel={() => setCustomizing(null)}
          onBookEyeTest={openEyeTestFromCustomizer}
          onConfirm={(lens) => {
            addLensLine(customizing, lens);
            setCustomizing(null);
          }}
        />
      )}

      {/* CART */}
      {panel === "cart" && (
        <Modal title={`Your Cart (${cartUnits})`} onClose={closePanel}>
          {cart.length === 0 ? (
            <p className="empty-state">Your cart is empty.</p>
          ) : (
            <>
              {cart.filter(Boolean).map((item) => (
                <CartItem
                  key={cartLineKey(item)}
                  item={item}
                  actions={
                    <button type="button" className="remove-btn" onClick={() => removeFromCart(cartLineKey(item))}>
                      Remove
                    </button>
                  }
                >
                  {item.lens ? (
                    <LensSummary lens={item.lens} />
                  ) : (
                    <QuantityControl
                      name={item.name}
                      quantity={item.quantity}
                      max={item.stockQuantity}
                      onChange={(quantity) => setCartQuantity(cartLineKey(item), quantity)}
                    />
                  )}
                </CartItem>
              ))}

              <div className="cart-total">
                <strong>Total: {formatINR(cartTotal)}</strong>
                <button type="button" className="product-btn" onClick={() => setPanel("checkout")}>
                  Proceed to Checkout
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* WISHLIST */}
      {panel === "wishlist" && (
        <Modal title={`My Wishlist (${wishlist.length})`} onClose={closePanel}>
          {wishlist.length === 0 ? (
            <p className="empty-state">Your wishlist is empty.</p>
          ) : (
            wishlistItems.map((item) => {
              const inCart = cartCounts.get(item.id) ?? 0;
              const unavailable = item.stockQuantity <= 0 || inCart >= item.stockQuantity;

              return (
                <CartItem
                  key={item.id}
                  item={item}
                  actions={
                    <>
                      <button
                        type="button"
                        className="product-btn"
                        disabled={unavailable}
                        onClick={() => {
                          // Only leave the wishlist if the item actually reached the cart
                          if (requestAddToCart(item)) toggleWishlist(item);
                        }}
                      >
                        {item.stockQuantity <= 0 ? "Out of Stock" : inCart >= item.stockQuantity ? "Max in Cart" : "Add to Cart"}
                      </button>
                      <button type="button" className="remove-btn" onClick={() => toggleWishlist(item)}>
                        Remove
                      </button>
                    </>
                  }
                />
              );
            })
          )}
        </Modal>
      )}

      {/* CHECKOUT */}
      {panel === "checkout" && (
        <Modal title="Checkout" onClose={closePanel} closable={!paymentLoading} className="site-modal--form">
          {cart.length === 0 ? (
            <p className="empty-state">Your cart is empty. Add a frame to continue.</p>
          ) : (
            <form className="panel-form" onSubmit={handleCheckoutPayment}>
              <h3 className="form-section-title">Customer Details</h3>

              <input name="customerName" type="text" placeholder="Full Name" aria-label="Full name" autoComplete="name" required />
              <input name="email" type="email" placeholder="Email Address" aria-label="Email address" autoComplete="email" />
              <input
                name="phone"
                type="tel"
                placeholder="10-digit Phone Number"
                aria-label="Phone number"
                autoComplete="tel-national"
                inputMode="tel"
                pattern="[0-9]{10}"
                title="Enter a 10-digit phone number"
                required
              />

              <h3 className="form-section-title">Delivery Address</h3>

              <textarea name="address" placeholder="Full Address" aria-label="Full address" autoComplete="street-address" required />

              <div className="form-row">
                <input name="city" type="text" placeholder="City" aria-label="City" autoComplete="address-level2" required />
                <input name="state" type="text" placeholder="State" aria-label="State" autoComplete="address-level1" required />
              </div>

              <input
                name="pincode"
                type="text"
                placeholder="PIN Code"
                aria-label="PIN code"
                autoComplete="postal-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                title="Enter a 6-digit PIN code"
                required
              />

              <div className="checkout-summary">
                <h3 className="form-section-title">Order Summary</h3>
                {cartSummary}
              </div>

              <div className="cart-total">
                <strong>Order Total: {formatINR(cartTotal)}</strong>
              </div>

              {checkoutError && (
                <p role="alert" className="form-error">
                  {checkoutError}
                </p>
              )}

              <button type="submit" className="product-btn" disabled={paymentLoading}>
                {paymentLoading ? "Processing..." : `Pay ${formatINR(cartTotal)}`}
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* ORDER SUCCESS */}
      {panel === "success" && (
        <Modal title="Order Placed" onClose={closePanel} className="site-modal--form">
          <div className="success-panel">
            <CheckCircle2 size={52} aria-hidden="true" />
            <h3>Thank you for your order!</h3>
            <p>
              {orderResult?.orderId ? (
                <>
                  Your order ID is <strong>#{orderResult.orderId}</strong>.
                </>
              ) : (
                "Your payment was received."
              )}
            </p>

            {orderResult?.trackingToken ? (
              <TrackingLinkBox trackingToken={orderResult.trackingToken} />
            ) : (
              <p className="track-link-note">Keep your order ID handy to ask about your order.</p>
            )}

            <button type="button" className="product-btn" onClick={closePanel}>
              Continue Shopping
            </button>
          </div>
        </Modal>
      )}

      {/* EYE TEST BOOKING */}
      {panel === "eye" && (
        <Modal title="Book Free Eye Test" onClose={closePanel} closable={!appointmentLoading} className="site-modal--form">
          <form className="panel-form" onSubmit={handleEyeBooking}>
            <h3 className="form-section-title">Customer Details</h3>

            <input
              type="text"
              placeholder="Full Name"
              aria-label="Full name"
              autoComplete="name"
              value={eyeBooking.name}
              onChange={updateBooking("name")}
              required
            />
            <input
              type="tel"
              placeholder="10-digit Phone Number"
              aria-label="Phone number"
              autoComplete="tel-national"
              inputMode="tel"
              pattern="[0-9]{10}"
              title="Enter a 10-digit phone number"
              value={eyeBooking.phone}
              onChange={updateBooking("phone")}
              required
            />
            <input
              type="email"
              placeholder="Email Address (Optional)"
              aria-label="Email address (optional)"
              autoComplete="email"
              value={eyeBooking.email}
              onChange={updateBooking("email")}
            />

            <h3 className="form-section-title">Appointment Date</h3>

            <input
              type="date"
              aria-label="Appointment date"
              min={today}
              value={eyeBooking.date}
              onChange={updateBookingDate}
              onClick={openDatePicker}
              required
            />

            <h3 className="form-section-title">Select Time Slot</h3>

            <div className="eye-slots" role="group" aria-label="Time slots">
              {slotsForDay.map(({ slot, available }) => (
                <button
                  type="button"
                  key={slot}
                  className={`eye-slot ${eyeBooking.slot === slot ? "selected" : ""}`}
                  onClick={() => selectSlot(slot)}
                  disabled={!available}
                  aria-pressed={eyeBooking.slot === slot}
                >
                  {slot}
                  {!available && <span className="eye-slot-note"> (already started)</span>}
                </button>
              ))}
            </div>

            {bookingError && (
              <p role="alert" className="form-error">
                {bookingError}
              </p>
            )}

            <button type="submit" className="product-btn" disabled={!eyeBooking.slot || appointmentLoading}>
              {appointmentLoading ? "Booking..." : "Confirm Appointment"}
            </button>
          </form>
        </Modal>
      )}

      {/* FACE SHAPE ANALYSIS (lazy-loaded, failure-safe) */}
      {panel === "face" && (
        <ErrorBoundary
          fallback={
            <Modal title="Face Shape Analysis" onClose={closePanel}>
              <p className="empty-state">This feature is unavailable right now. Please try again later.</p>
            </Modal>
          }
        >
          <Suspense fallback={null}>
            <FaceAnalysis onClose={closePanel} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* INFO (footer policy links) */}
      {panel === "info" && (
        <Modal title={infoTitle} onClose={closePanel} className="site-modal--form">
          <p className="empty-state">{INFO_TEXT[infoTitle]}</p>
        </Modal>
      )}

      {/* TOAST */}
      {toast && (
        <div key={toast.id} className="toast" role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}
