import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Store,
  CalendarDays,
  Users,
  Megaphone,
  Settings,
  LogOut,
  Menu,
  TrendingUp,
  AlertTriangle,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Download,
  Upload,
  User,
  MapPin,
  CheckCircle2,
  FileText,
  MessageSquare,
  Copy,
  ExternalLink,
  Printer,
  Info,
  Clock,
  ShieldCheck,
  History,
  Landmark,
  ShieldAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";

/* =========================
   CONSTANTS
========================= */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || (import.meta.env.DEV ? "http://localhost:8080/api" : "");

const ENDPOINTS = {
  products: `${API_BASE_URL}/admin/products`,
  orders: `${API_BASE_URL}/admin/orders`,
  customers: `${API_BASE_URL}/admin/customer-accounts`,
  appointments: `${API_BASE_URL}/appointments`,
  banners: `${API_BASE_URL}/admin/marketing/banners`,
  offers: `${API_BASE_URL}/admin/marketing/offers`,
  websiteImages: `${API_BASE_URL}/admin/website-images`,
  settlements: `${API_BASE_URL}/admin/pos/payments/settlements`,
  disputes: `${API_BASE_URL}/admin/pos/payments/disputes`,
};

const LIST_SOURCES = {
  products: { url: ENDPOINTS.products, message: "Unable to load products" },
  orders: { url: ENDPOINTS.orders, message: "Unable to load orders" },
  appointments: { url: ENDPOINTS.appointments, message: "Unable to load appointments" },
  customers: { url: ENDPOINTS.customers, message: "Unable to load customers" },
  images: { url: ENDPOINTS.websiteImages, message: "Failed to load website images" },
};

const CLOUDINARY_CLOUD_NAME = "ydkweahp";
const CLOUDINARY_UPLOAD_PRESET = "nmk_opticals";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const NOTICE_DURATION_MS = 3000;
const JSON_HEADERS = { "Content-Type": "application/json" };
const NETWORK_ERROR = "Network error. Check your connection and try again.";
const TIME_ZONE = "Asia/Kolkata";
const EMPTY_RANGE = { start: "", end: "" };
const PREFS_KEY = "nmk_admin_prefs";
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MARKETING_MODAL = {
  overlayClass: "modal-overlay",
  panelClass: "modal-content",
  headerClass: "modal-header",
};

// Operational navigation is split by sales channel. Products is the shared
// catalogue used by both the online storefront and the in-store POS.
const MENU_SECTIONS = [
  {
    label: "ONLINE STORE",
    items: [
      { name: "Dashboard", icon: LayoutDashboard },
      { name: "Products", label: "Products & Catalogue", icon: Package },
      { name: "Orders", icon: ShoppingCart },
      { name: "Appointments", icon: CalendarDays },
      { name: "Customer Accounts", icon: Users },
      { name: "Marketing", icon: Megaphone },
      { name: "Payment Settlements", icon: Landmark, adminOnly: true },
      { name: "Payment Disputes", icon: ShieldAlert, adminOnly: true },
    ],
  },
  {
    label: "OFFLINE STORE",
    items: [
      { name: "POS Terminal", icon: Store },
    ],
  },
];

const ADMIN_MENU_ITEMS = [
  { name: "Staff", icon: ShieldCheck, adminOnly: true },
  { name: "Audit Log", icon: History, adminOnly: true },
  { name: "Settings", icon: Settings },
];

const ORDER_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const APPOINTMENT_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const BANNER_PLACEMENTS = [
  { value: "HOME", label: "Home page (standard)" },
  { value: "HOME_HERO", label: "Home page (hero area)" },
];

const WEBSITE_IMAGE_MODES = [
  { mode: "url", label: "Paste URL" },
  { mode: "file", label: "Choose file" },
];

const PRODUCT_CATEGORIES = [
  "Eyeglasses",
  "Sunglasses",
  "Power Sunglasses",
  "Computer Glasses",
  "Contact Lenses",
  "Accessories",
];
const PRODUCT_GENDERS = ["Men", "Women", "Unisex", "Kids"];

const PRODUCT_SPECIFICATIONS = {
  Eyeglasses: [
    {
      key: "brand",
      label: "Brand",
      type: "select-custom",
      options: [
        "Ray-Ban", "Ogle", "Carrera", "Jaguar", "Puma",
        "Titan", "Fastrack", "Canzo", "Ollo", "Para", "Solo",
      ],
    },
    {
      key: "shape",
      label: "Frame Shape",
      type: "select-custom",
      options: [
        "Rectangle", "Square", "Oval", "Aviator",
        "Cat Eye", "Geometric", "Round",
      ],
    },
    {
      key: "frameStyle",
      label: "Frame Style",
      type: "select-custom",
      options: ["Full Rim", "Semi-Rimmed", "Rimless"],
    },
    {
      key: "size",
      label: "Size",
      type: "select-custom",
      options: ["XS", "S", "M", "L"],
    },
    {
      key: "frameColor",
      label: "Frame Color",
      type: "text",
    },
    {
      key: "material",
      label: "Frame Material",
      type: "text",
    },
  ],

  Sunglasses: [
    {
      key: "brand",
      label: "Brand",
      type: "select-custom",
      options: ["Ray-Ban", "Ogle", "Titan", "Fastrack"],
    },
    {
      key: "shape",
      label: "Frame Shape",
      type: "select-custom",
      options: [
        "Aviator", "Butterfly", "Phantos", "Pillow", "Sporty",
        "Teardrop", "Bugeye", "CatEye", "Clubmaster",
        "Geometric", "Navigator", "Oval", "Rectangle",
        "Round", "Square", "Wayfarer", "Wraparound",
        "Hexagon", "Irregular",
      ],
    },
    {
      key: "lensTechnology",
      label: "Lens Technology",
      type: "select-custom",
      options: [
        "Mirrored", "Polarized", "Gradient",
        "Transition", "UV-Protected",
      ],
    },
    {
      key: "size",
      label: "Size",
      type: "select-custom",
      options: ["XS", "S", "M", "L"],
    },
    {
      key: "frameStyle",
      label: "Frame Style",
      type: "select-custom",
      options: ["Full Rim", "Semi-Rimmed", "Rimless"],
    },
    {
      key: "frameColor",
      label: "Frame Color",
      type: "text",
    },
    {
      key: "material",
      label: "Frame Material",
      type: "text",
    },
    {
      key: "lensColor",
      label: "Lens Color",
      type: "text",
    },
  ],

  "Power Sunglasses": [
    {
      key: "brand",
      label: "Brand",
      type: "select-custom",
      options: ["Ray-Ban", "Ogle", "Titan", "Fastrack"],
    },
    {
      key: "shape",
      label: "Frame Shape",
      type: "select-custom",
      options: [
        "Aviator", "Butterfly", "Phantos", "Pillow", "Sporty",
        "Teardrop", "Bugeye", "CatEye", "Clubmaster",
        "Geometric", "Navigator", "Oval", "Rectangle",
        "Round", "Square", "Wayfarer", "Wraparound",
        "Hexagon", "Irregular",
      ],
    },
    {
      key: "lensTechnology",
      label: "Lens Technology",
      type: "select-custom",
      options: [
        "Mirrored", "Polarized", "Gradient",
        "Transition", "UV-Protected",
      ],
    },
    {
      key: "size",
      label: "Size",
      type: "select-custom",
      options: ["XS", "S", "M", "L"],
    },
    {
      key: "frameStyle",
      label: "Frame Style",
      type: "select-custom",
      options: ["Full Rim", "Semi-Rimmed", "Rimless"],
    },
    {
      key: "frameColor",
      label: "Frame Color",
      type: "text",
    },
    {
      key: "material",
      label: "Frame Material",
      type: "text",
    },
    {
      key: "lensColor",
      label: "Lens Color",
      type: "text",
    },
  ],

  "Computer Glasses": [
    {
      key: "brand",
      label: "Brand",
      type: "select-custom",
      options: [
        "Ray-Ban", "Ogle", "Carrera", "Jaguar", "Puma",
        "Titan", "Fastrack", "Canzo", "Ollo", "Para", "Solo",
      ],
    },
    {
      key: "shape",
      label: "Frame Shape",
      type: "select-custom",
      options: [
        "Rectangle", "Square", "Oval", "Aviator",
        "Cat Eye", "Geometric", "Round",
      ],
    },
    {
      key: "size",
      label: "Size",
      type: "select-custom",
      options: ["XS", "S", "M", "L"],
    },
    {
      key: "frameStyle",
      label: "Frame Style",
      type: "select-custom",
      options: ["Full Rim", "Semi-Rimmed", "Rimless"],
    },
    {
      key: "frameColor",
      label: "Frame Color",
      type: "text",
    },
    {
      key: "material",
      label: "Frame Material",
      type: "text",
    },
  ],

  "Contact Lenses": [
    {
      key: "brand",
      label: "Brand",
      type: "select-custom",
      options: ["Bausch + Lomb", "CooperVision", "Johnson & Johnson"],
    },
    {
      key: "disposability",
      label: "Disposability",
      type: "select-custom",
      options: ["Daily", "Fortnightly", "Monthly", "Yearly", "Quarterly"],
    },
    {
      key: "lensType",
      label: "Lens Type",
      type: "select-custom",
      options: ["Non Toric", "Toric", "Multifocal", "Colour"],
    },
    {
      key: "lensColor",
      label: "Lens Color",
      type: "text",
    },
  ],

  Accessories: [
    {
      key: "productType",
      label: "Product Type",
      type: "select-custom",
      options: [
        "Lens cleaner",
        "Contact lens solution",
        "Contact lens cases",
        "Spectacle box",
        "Spectacle cleaning cloth",
      ],
    },
    {
      key: "brand",
      label: "Brand",
      type: "text",
    },
  ],
};
const PRODUCT_SPECIFICATION_CSV_KEYS = [
  ...new Set(
    Object.values(PRODUCT_SPECIFICATIONS)
      .flat()
      .map((spec) => spec.key)
  ),
];


// Multiple values in one cell (lens features, for example) are separated by this
const CSV_LIST_SEPARATOR = "; ";

const PRODUCT_CSV_REQUIRED = ["category", "gender", "price", "stockQuantity"];

const EMPTY_PRODUCT = {
  gender: "",
  category: "",
  description: "",
  price: "",
  stockQuantity: "",
  imageUrl: "",
  active: true,
  specifications: {},
};

const EMPTY_BANNER = {
  title: "",
  imageUrl: "",
  targetUrl: "",
  placement: "HOME",
  displayOrder: 0,
  active: true,
};

const EMPTY_OFFER = {
  message: "",
  backgroundColor: "#172554",
  textColor: "#FFFFFF",
  targetUrl: "",
  startDateTime: "",
  endDateTime: "",
  active: true,
};

// Admin preferences (stored in this browser)
const DASHBOARD_ROW_OPTIONS = [5, 10, 25, 50];

const DEFAULT_PREFS = {
  lowStockThreshold: 5,
  dashboardRows: 5,
  confirmProductDelete: true,
};

/* =========================
   PREFERENCES
========================= */

const PrefsContext = createContext(DEFAULT_PREFS);
const usePrefs = () => useContext(PrefsContext);

// Keeps only valid values, so a corrupted saved setting can never break a page
const sanitizePrefs = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const threshold = Number(source.lowStockThreshold);
  const rows = Number(source.dashboardRows);

  return {
    lowStockThreshold:
      Number.isInteger(threshold) && threshold >= 1 && threshold <= 500
        ? threshold
        : DEFAULT_PREFS.lowStockThreshold,
    dashboardRows: DASHBOARD_ROW_OPTIONS.includes(rows) ? rows : DEFAULT_PREFS.dashboardRows,
    confirmProductDelete:
      typeof source.confirmProductDelete === "boolean"
        ? source.confirmProductDelete
        : DEFAULT_PREFS.confirmProductDelete,
  };
};

const loadPrefs = () => {
  try {
    return sanitizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY)));
  } catch {
    return sanitizePrefs(null);
  }
};

/* =========================
   FORMATTERS
========================= */

const formatINR = (amount, withDecimals = false) =>
  `₹${Number(amount || 0).toLocaleString(
    "en-IN",
    withDecimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined
  )}`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { timeZone: TIME_ZONE }) : "-";

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { timeZone: TIME_ZONE }) : "Date unavailable";

const formatIstDay = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

// Calendar day in India ("YYYY-MM-DD") for today
const todayInIndia = () => formatIstDay(new Date());

// Calendar day in India for a timestamp, or the value itself when it is already YYYY-MM-DD
const toIndiaDay = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : formatIstDay(date);
};

const inDateRange = (value, start, end) => {
  const day = toIndiaDay(value);
  return (!start || day >= start) && (!end || day <= end);
};

// Case-insensitive match of the search term against any of the given fields
// Products no longer have a typed name: the title is the brand
const getProductTitle = (product) =>
  (product?.specifications?.brand || product?.specifications?.productType || product?.name || product?.category || "").toString().trim();

const matchesTerm = (term, ...fields) => !term || fields.join(" ").toLowerCase().includes(term);

/* =========================
   VALIDATION
========================= */

const isValidHttpUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

// Links may be a full URL or an in-site path such as /products
const isValidLink = (value) =>
  !value || (value.startsWith("/") && !value.startsWith("//")) || isValidHttpUrl(value);

const LINK_ERROR = "Destination must be a full URL (https://…) or a page path (/products).";

const isWholeNumber = (value) => value !== "" && Number.isInteger(Number(value)) && Number(value) >= 0;

const isLowStock = (product, threshold = DEFAULT_PREFS.lowStockThreshold) =>
  Number(product.stockQuantity) <= threshold;

const customerKey = (customer) => customer.email || customer.phone || customer.customerName || "";

const getImageFileError = (file) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Only JPG, PNG and WEBP images are allowed.";
  if (file.size > MAX_IMAGE_SIZE) return "Image size must be less than 5 MB.";
  return null;
};

const validateProduct = (form) => {
  if (!form.gender.trim() || !form.category.trim()) {
    return "Gender and category are required.";
  }
  if (form.price === "" || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
    return "Enter a valid product price.";
  }
  if (!isWholeNumber(form.stockQuantity)) return "Enter a valid stock quantity.";
  if (form.imageUrl && !isValidHttpUrl(form.imageUrl.trim())) return "Enter a valid product image URL.";
  return null;
};

const validateBanner = (form) => {
  if (!form.title.trim() || !form.imageUrl.trim()) return "Banner title and image are required.";
  if (!isValidHttpUrl(form.imageUrl.trim())) return "Enter a valid image URL.";
  if (!isValidLink(form.targetUrl.trim())) return LINK_ERROR;
  if (!isWholeNumber(form.displayOrder)) return "Display order must be a whole number, 0 or higher.";
  return null;
};

const validateOffer = (form) => {
  if (!form.message.trim()) return "Offer message is required.";
  if (!isValidLink(form.targetUrl.trim())) return LINK_ERROR;
  if (form.startDateTime && form.endDateTime && new Date(form.endDateTime) <= new Date(form.startDateTime)) {
    return "End date and time must be after the start.";
  }
  return null;
};

const validatePrefs = (prefs) => {
  const threshold = Number(prefs.lowStockThreshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 500) {
    return "Low stock threshold must be a whole number between 1 and 500.";
  }
  return null;
};

const buildProductPayload = (data) => {
  // Keep only real answers: no empty values, no "Other" placeholder, no gender duplicate
  const specifications = Object.fromEntries(
    Object.entries(data.specifications || {})
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(
        ([key, value]) =>
          key !== "gender" &&
          value !== "__custom__" &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
      )
  );
  const gender = data.gender || data.specifications?.gender || "";

  return {
    // The API still stores a name, so it is filled from the brand (not typed by the admin)
    version: data.version ?? null,
    name: String(specifications.brand || specifications.productType || data.name || data.category || "").trim(),
    gender,
    category: (data.category || "").trim(),
    description: (data.description || "").trim(),
    price: Number(data.price),
    stockQuantity: Number(data.stockQuantity),
    imageUrl: (data.imageUrl || "").trim(),
    active: data.active,
    specifications,
  };
};

const getPreviewSrc = (edit, fallback) => {
  if (edit.mode === "file" && edit.previewUrl) return edit.previewUrl;
  if (edit.mode === "url" && isValidHttpUrl(edit.url.trim())) return edit.url.trim();
  return fallback;
};

const sortValue = (product, key) => {
  switch (key) {
    case "price":
      return Number(product.price ?? 0);
    case "stock":
      return Number(product.stockQuantity ?? 0);
    case "status":
      return product.active ? 1 : 0;
    case "category":
      return product.category ?? "";
    case "recent": {
      const timestamp = product.createdAt ? new Date(product.createdAt).getTime() : Number.NaN;
      return Number.isFinite(timestamp) ? timestamp : null;
    }
    default:
      return getProductTitle(product);
  }
};

/* =========================
   CSV EXPORT
========================= */

// Cells starting with = + - @ are prefixed, so Excel cannot run them as formulas
const escapeCsv = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Builds a CSV file in the browser and downloads it. Returns false when there is no data.
function downloadCsv(filename, rows) {
  if (!rows.length) return false;

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(","))];

  // BOM so Excel reads UTF-8 (₹, accents) correctly
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke later, so browsers that start the download asynchronously still get the file
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}

/* =========================
   CSV IMPORT
========================= */

// Parse CSV while supporting quoted values, commas and newlines
function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;

      row.push(value.trim());

      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }

      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());

  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error("CSV must contain headers and at least one product.");
  }

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ""])
    )
  );
}


const EXPORT_TARGETS = [
  {
    source: "products",
    label: "Export products",
    filename: "products.csv",
    
map: (p) => {
  const row = {
    id: p.id,
    name: p.name ?? "",
    category: p.category ?? "",
    gender: p.gender ?? p.specifications?.gender ?? "",
    price: p.price ?? "",
    stockQuantity: p.stockQuantity ?? "",
    active: p.active ? "Yes" : "No",
    imageUrl: p.imageUrl ?? "",
    description: p.description ?? "",
  };

  PRODUCT_SPECIFICATION_CSV_KEYS.forEach((key) => {
    const value = p.specifications?.[key];
    row[key] = Array.isArray(value) ? value.join(CSV_LIST_SEPARATOR) : value ?? "";
  });

  return row;
},

  },
  {
    source: "orders",
    label: "Export orders",
    filename: "orders.csv",
    map: (o) => ({
      id: o.id,
      orderDate: o.orderDate,
      customerName: o.customerName,
      phone: o.phone,
      email: o.email,
      city: o.city,
      state: o.state,
      pincode: o.pincode,
      totalAmount: o.totalAmount,
      paymentStatus: o.paymentStatus,
      refundStatus: o.refundStatus || "NONE",
      orderStatus: o.orderStatus,
    }),
  },
  {
    source: "appointments",
    label: "Export appointments",
    filename: "appointments.csv",
    map: (a) => ({
      id: a.id,
      customerName: a.customerName,
      phone: a.phone,
      email: a.email,
      appointmentDate: a.appointmentDate,
      appointmentTime: a.appointmentTime,
      status: a.status,
    }),
  },
];

/* =========================
   API HELPERS
========================= */

// Uses the server's message when it has one, otherwise the fallback
async function readErrorMessage(response, fallback) {
  try {
    const text = await response.text();
    if (!text) return fallback;
    try {
      const json = JSON.parse(text);
      return json.message || json.error || fallback;
    } catch {
      return text.length <= 200 ? text : fallback;
    }
  } catch {
    return fallback;
  }
}

async function uploadToCloudinary(file, folder) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Image upload failed.");
  return data.secure_url;
}

const saveWebsiteImage = (api, imageKey, title, imageUrl, fallbackMessage) =>
  api.saveRecord({
    url: `${ENDPOINTS.websiteImages}/${imageKey}`,
    method: "PUT",
    payload: { title, imageUrl },
    fallbackMessage,
  });

// Calls "<endpoint>/clear" for every endpoint and reports what happened to each one,
// so a partial failure is shown instead of hidden

async function clearEndpoints(api, endpoints, fallbackMessage, password) {
  const results = await Promise.allSettled(
    endpoints.map(async ({ url, action }) => {
      const authorizationToken = await api.authorizeAction(password, action);

      return api.deleteRecord(
        `${url}/clear`,
        fallbackMessage,
        authorizationToken
      );
    })
  );

  return {
    sessionEnded: results.some(
      (r) => r.status === "fulfilled" && r.value === false
    ),
    failures: results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason?.message || fallbackMessage),
  };
}


/* =========================
   API HOOK
   Auth header, expired sessions, and error handling in one place.
========================= */


function useAdminApi(token, onSessionEnded) {
  return useMemo(() => {
    const authFetch = async (
      url,
      options = {},
      { endSessionOnAuthError = true } = {}
    ) => {
      let response;

      try {
        response = await fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        throw new Error(NETWORK_ERROR);
      }

      if (
        endSessionOnAuthError &&
        (response.status === 401 || response.status === 403)
      ) {
        onSessionEnded();
        return null;
      }

      return response;
    };

    const saveRecord = async ({
      url,
      method,
      payload,
      fallbackMessage,
      authorizationToken,
    }) => {
      const response = await authFetch(url, {
        method,
        headers: {
          ...JSON_HEADERS,
          ...(authorizationToken ? { "X-Admin-Action-Authorization": authorizationToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response) return false;

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, fallbackMessage));
      }

      return true;
    };

    const postJson = async (url, payload, authorizationToken, fallbackMessage) => {
      const response = await authFetch(url, {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          ...(authorizationToken ? { "X-Admin-Action-Authorization": authorizationToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response) return null;
      let data = {};
      try { data = await response.json(); } catch { /* empty provider response */ }
      if (!response.ok) {
        const error = new Error(data.message || fallbackMessage || "Request failed.");
        error.status = response.status;
        throw error;
      }
      return data;
    };

    const deleteRecord = async (
      url,
      fallbackMessage,
      authorizationToken
    ) => {
      const headers = {};

      if (authorizationToken) {
        headers["X-Admin-Action-Authorization"] = authorizationToken;
      }

      const response = await authFetch(url, {
        method: "DELETE",
        headers,
      });

      if (!response) return false;

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, fallbackMessage));
      }

      return true;
    };

    const getJson = async (url, fallbackMessage) => {
      const response = await authFetch(url);

      if (!response) return null;

      if (!response.ok) {
        throw new Error(fallbackMessage);
      }

      return response.json();
    };

    const verifyPassword = async (password) => {
      const response = await authFetch(
        `${API_BASE_URL}/admin/auth/verify-password`,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ password }),
        },
        { endSessionOnAuthError: false }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Incorrect admin password.")
        );
      }

      return true;
    };

    const authorizeAction = async (password, action) => {
      const response = await authFetch(
        `${API_BASE_URL}/admin/auth/authorize-action`,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ password, action }),
        },
        { endSessionOnAuthError: false }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Admin password verification failed."
          )
        );
      }

      const data = await response.json();

      if (!data.authorizationToken) {
        throw new Error("Authorization token was not returned by the server.");
      }

      return data.authorizationToken;
    };

    return {
      saveRecord,
      postJson,
      deleteRecord,
      getJson,
      verifyPassword,
      authorizeAction,
    };
  }, [token, onSessionEnded]);
}


/* =========================
   DIALOG BEHAVIOUR
   Escape to close, Tab stays inside the dialog, focus moves in and returns on close.
========================= */

function useDialog(ref, { onClose, closable = true, lockScroll = true }) {
  const onCloseRef = useRef(onClose);
  const closableRef = useRef(closable);

  useEffect(() => {
    onCloseRef.current = onClose;
    closableRef.current = closable;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    if (lockScroll) document.body.style.overflow = "hidden";
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
      if (lockScroll) document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [ref, lockScroll]);
}

/* =========================
   SHARED HOOKS
========================= */

// Confirmation popup shared by the whole admin. Resolves true (Yes) or false (No / Escape).
const ConfirmContext = createContext(() => Promise.resolve(false));
const useConfirm = () => useContext(ConfirmContext);

/*
  Two-step clear flow used by Dashboard, Orders and Appointments:
    idle -> confirm (warning) -> password -> delete
*/
function useBulkClear({ api, onNotice, onReload }) {
  const [step, setStep] = useState("idle"); // "idle" | "confirm" | "password"
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [pendingClear, setPendingClear] = useState(null);

  const reset = () => {
    setStep("idle");
    setAdminPassword("");
    setPendingClear(null);
    setError("");
  };

  // Start the flow with the page's own endpoints and messages
  const clear = (options) => {
    setError("");
    setAdminPassword("");
    setPendingClear(options);
    setStep("confirm");
  };

  const cancel = () => {
    if (!clearing) reset();
  };

  const confirmPassword = async () => {
    if (!adminPassword.trim() || !pendingClear || clearing) return;

    setClearing(true);
    setError("");

    try {

      const { sessionEnded, failures } = await clearEndpoints(
  api,
  pendingClear.endpoints,
  pendingClear.fallbackMessage,
  adminPassword
);

      if (sessionEnded) {
        setError("Session ended. Please log in again.");
        return;
      }

      // Refresh even after a partial failure, so the screen matches the server
      pendingClear.onCleared?.();
      await onReload();

      if (failures.length) {
        setError(`${failures[0]} Some data may not have been cleared. Please try again.`);
        return;
      }

      onNotice(pendingClear.successMessage);
      reset();
    } catch (err) {
      setError(err.message || pendingClear.fallbackMessage);
    } finally {
      setClearing(false);
    }
  };

  return {
    step,
    clearing,
    error,
    warning: pendingClear?.warning ?? "",
    clear,
    confirmYes: () => setStep("password"),
    cancel,
    adminPassword,
    setAdminPassword,
    confirmPassword,
  };
}

function useStatusUpdater({ api, baseUrl, label, onNotice, onReload }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const update = async (id, status) => {
    setError("");
    setBusyId(id);

    try {
      const saved = await api.saveRecord({
        url: `${baseUrl}/${id}/status`,
        method: "PUT",
        payload: { status },
        fallbackMessage: `Unable to update ${label.toLowerCase()} status`,
      });

      if (saved) {
        onNotice(`${label} #${id} updated.`);
        await onReload();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return { busyId, error, update };
}

/* =========================
   SHARED UI
========================= */

function Modal({
  title,
  subtitle,
  onClose,
  closable = true,
  overlayClass = "admin-modal-overlay",
  panelClass = "admin-product-modal",
  headerClass = "admin-modal-heading",
  children,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  useDialog(panelRef, { onClose, closable });

  return (
    <div className={overlayClass}>
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={headerClass}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            disabled={!closable}
            aria-label="Close dialog"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// Popup anchored to the top of the screen, used for every confirmation in the admin
function TopPopup({ title, onCancel, busy = false, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  useDialog(panelRef, { onClose: onCancel, closable: !busy, lockScroll: false });

  return (
    <div
      className="admin-top-popup-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="admin-top-popup"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h3 id={titleId}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// Yes / No popup driven by askConfirm() from the root component
function ConfirmPopup({ options, onResult }) {
  if (!options) return null;

  return (
    <TopPopup title={options.title} onCancel={() => onResult(false)}>
      <p className="admin-top-popup-text">{options.message}</p>

      <div className="admin-top-popup-actions">
        <button type="button" className="admin-secondary-button" onClick={() => onResult(false)}>
          {options.cancelLabel || "Cancel"}
        </button>

        <button
          type="button"
          className={options.danger ? "admin-clear-button" : "admin-primary-button"}
          onClick={() => onResult(true)}
        >
          {options.confirmLabel || "Confirm"}
        </button>
      </div>
    </TopPopup>
  );
}

// Both steps of the clear flow: warning first, then the admin password
function ClearDataPopup({ bulk }) {
  if (bulk.step === "confirm") {
    return (
      <TopPopup title="Permanent Delete" onCancel={bulk.cancel}>
        <p className="admin-top-popup-text">
          <strong>Warning:</strong> {bulk.warning} Do you want to continue?
        </p>

        <div className="admin-top-popup-actions">
          <button type="button" className="admin-secondary-button" onClick={bulk.cancel}>
            No, cancel
          </button>

          <button type="button" className="admin-clear-button" onClick={bulk.confirmYes}>
            Yes, continue
          </button>
        </div>
      </TopPopup>
    );
  }

  if (bulk.step === "password") {
    return (
      <TopPopup title="Enter Admin Password" onCancel={bulk.cancel} busy={bulk.clearing}>
        <p className="admin-top-popup-text">Enter your admin password to permanently delete the data.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            bulk.confirmPassword();
          }}
        >
          <input
            className="admin-top-popup-input"
            type="password"
            value={bulk.adminPassword}
            onChange={(e) => bulk.setAdminPassword(e.target.value)}
            placeholder="Enter admin password"
            autoComplete="current-password"
            required
            disabled={bulk.clearing}
          />

          <ErrorMessage>{bulk.error}</ErrorMessage>

          <div className="admin-top-popup-actions">
            <button type="button" className="admin-secondary-button" onClick={bulk.cancel} disabled={bulk.clearing}>
              Cancel
            </button>

            <button
              type="submit"
              className="admin-clear-button"
              disabled={bulk.clearing || !bulk.adminPassword.trim()}
            >
              {bulk.clearing ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </form>
      </TopPopup>
    );
  }

  return null;
}

function StatusBadge({ active }) {
  return <span className={`admin-status ${active ? "available" : "inactive"}`}>{active ? "Active" : "Inactive"}</span>;
}

function StatCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className="admin-stat-card">
      {Icon && (
        <div className={`admin-stat-icon ${tone || ""}`} aria-hidden="true">
          <Icon size={23} />
        </div>
      )}
      <p>{label}</p>
      <h2>{value}</h2>
      {hint && <span>{hint}</span>}
    </div>
  );
}

function ErrorMessage({ children }) {
  if (!children) return null;
  return (
    <div className="admin-error-message" role="alert">
      {children}
    </div>
  );
}

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="admin-empty">
        {children}
      </td>
    </tr>
  );
}

function PageHeading({ title, description, action }) {
  return (
    <div className="admin-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function RefreshButton({ onClick, loading, label = "Refresh" }) {
  return (
    <button type="button" className="admin-secondary-button" onClick={onClick} disabled={loading}>
      <RefreshCw size={16} aria-hidden="true" />
      {loading ? "Loading..." : label}
    </button>
  );
}

function ClearButton({ label, onClick, busy }) {
  return (
    <button type="button" className="admin-clear-button" onClick={onClick} disabled={busy}>
      <Trash2 size={16} aria-hidden="true" />
      {busy ? "Deleting..." : label}
    </button>
  );
}

function SearchBox({ label, placeholder, value, onChange }) {
  return (
    <div className="admin-search-box">
      <Search size={19} aria-hidden="true" />
      <input
        type="search"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// Start and end date inputs that keep each other in range
function DateRangeFilter({ start, end, onChange }) {
  return (
    <div className="admin-date-filter">
      <label>
        Start Date
        <input type="date" value={start} max={end || undefined} onChange={(e) => onChange({ start: e.target.value, end })} />
      </label>

      <label>
        End Date
        <input type="date" value={end} min={start || undefined} onChange={(e) => onChange({ start, end: e.target.value })} />
      </label>
    </div>
  );
}

// Sortable column header. Uses a real button, so it works with the keyboard.
function SortableTh({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.direction === "asc" ? "↑" : "↓") : "";

  return (
    <th aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="admin-sort-button" onClick={() => onSort(sortKey)}>
        {label} <span aria-hidden="true">{arrow}</span>
      </button>
    </th>
  );
}

function FormGroup({ id, label, required, full, children }) {
  return (
    <div className={`admin-form-group${full ? " admin-form-full" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required && " *"}
      </label>
      {children}
    </div>
  );
}

// Shared change handler for forms whose fields are named after their state keys
const handleFieldChange = (setForm) => (e) => {
  const { name, value, type, checked } = e.target;
  setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
};

/* =========================
   DASHBOARD
========================= */

function DashboardPage({ api, products, orders, appointments, refreshing, onRefresh, onViewProducts, onNotice }) {
  const { lowStockThreshold, dashboardRows } = usePrefs();
  const [range, setRange] = useState(EMPTY_RANGE);
  const bulk = useBulkClear({ api, onNotice, onReload: onRefresh });

  const stats = useMemo(() => {
    const today = todayInIndia();
    const filteredOrders = orders.filter((o) => inDateRange(o.orderDate, range.start, range.end));
    const filteredAppointments = appointments.filter((a) => inDateRange(a.appointmentDate, range.start, range.end));
    const bookable = filteredAppointments.filter((a) => a.status !== "CANCELLED");
    const paid = filteredOrders.filter((o) => o.paymentStatus === "PAID");

    return {
      totalAppointments: filteredAppointments.length,
      todayAppointments: bookable.filter((a) => a.appointmentDate === today).length,
      upcomingAppointments: bookable.filter((a) => a.appointmentDate > today).length,
      pastAppointments: bookable.filter((a) => a.appointmentDate < today).length,
      totalProducts: products.length,
      lowStock: products.filter((p) => isLowStock(p, lowStockThreshold)).length,
      totalOrders: filteredOrders.length,
      paidOrders: paid.length,
      revenue: paid.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
    };
  }, [products, orders, appointments, range, lowStockThreshold]);

  const cards = [
    { label: "Total Appointments", value: stats.totalAppointments, hint: "Customer eye checkup bookings", icon: CalendarDays, tone: "gold" },
    { label: "Today's Appointments", value: stats.todayAppointments, hint: "Scheduled for today" },
    { label: "Upcoming Appointments", value: stats.upcomingAppointments, hint: "Future bookings" },
    { label: "Past Appointments", value: stats.pastAppointments, hint: "Previous bookings" },
    { label: "Total Products", value: stats.totalProducts, hint: "Products in catalogue", icon: Package, tone: "blue" },
    { label: "Total Orders", value: stats.totalOrders, hint: `${stats.paidOrders} paid orders`, icon: ShoppingCart, tone: "gold" },
    { label: "Total Revenue", value: formatINR(stats.revenue), hint: "Successfully paid orders", icon: TrendingUp, tone: "green" },
    { label: "Low Stock", value: stats.lowStock, hint: `${lowStockThreshold} or fewer units`, icon: AlertTriangle, tone: "red" },
  ];

  // Dashboard figures come from orders and appointments, so both are cleared
  const handleClear = () =>
    bulk.clear({
      endpoints: [
  { url: ENDPOINTS.orders, action: "CLEAR_ORDERS" },
  { url: ENDPOINTS.appointments, action: "CLEAR_APPOINTMENTS" },
],
      warning:
        "This will permanently delete ALL orders, their order items, and ALL appointments. Products will not be affected. This cannot be undone.",
      successMessage: "Dashboard, orders and appointments data permanently deleted.",
      fallbackMessage: "Unable to clear dashboard data.",
      onCleared: () => setRange(EMPTY_RANGE),
    });

  return (
    <section className="admin-content">
      <PageHeading
        title="Dashboard Overview"
        description="Here's what's happening at your store."
        action={
          <div className="admin-dashboard-actions">
            <RefreshButton onClick={onRefresh} loading={refreshing} />
            <ClearButton label="Clear Dashboard" onClick={handleClear} busy={bulk.clearing} />
          </div>
        }
      />

      <DateRangeFilter start={range.start} end={range.end} onChange={setRange} />

      <div className="admin-stats-grid">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <h3>Product Overview</h3>
          <button type="button" className="admin-text-button" onClick={onViewProducts}>
            View all
          </button>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Legacy stock</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, dashboardRows).map((product) => (
                <tr key={product.id}>
                  <td>{getProductTitle(product)}</td>
                  <td>{product.category}</td>
                  <td>{formatINR(product.price)}</td>
                  <td className={isLowStock(product, lowStockThreshold) ? "admin-stock-low" : ""}>
                    {product.stockQuantity}
                  </td>
                  <td>
                    <StatusBadge active={product.active} />
                  </td>
                </tr>
              ))}

              {products.length === 0 && <EmptyRow colSpan={5}>No products to display.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </div>

      <ClearDataPopup bulk={bulk} />
    </section>
  );
}

/* =========================
   PRODUCTS
========================= */


// Dropdown with an "Other" option. Custom mode is kept in state, so an empty custom
// text box stays open while the admin types.
function CustomSelectField({ field, id, value, onChange }) {
  const current = value ?? "";
  const isPredefined = field.options.includes(current);
  const [customMode, setCustomMode] = useState(!isPredefined && current !== "");
  const selectValue = customMode ? "__custom__" : isPredefined ? current : "";

  return (
    <div className="admin-form-group">
      <label htmlFor={id}>{field.label}</label>

      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "__custom__") {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(next);
          }
        }}
      >
        <option value="">Select {field.label}</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value="__custom__">Other (enter custom value)</option>
      </select>

      {customMode && (
        <input
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter custom ${field.label.toLowerCase()}`}
        />
      )}
    </div>
  );
}

// Admin-facing explanation of the product CSV columns, shown above the products table
function CsvColumnsGuide() {
  const columns = [
    { name: "id", note: "Leave blank to add a new product. Enter an existing product ID to update that product." },
    { name: "name", note: "Optional. The product title is taken from the brand specification; this is used only when there is no brand." },
    { name: "category", note: "Required. Must match a category exactly, for example Eyeglasses or Contact Lenses." },
    { name: "gender", note: "Required. Men, Women, Unisex or Kids." },
    { name: "price", note: "Required. Number in rupees, for example 1299." },
    { name: "stockQuantity", note: "Required. Whole number, 0 or more." },
    { name: "active", note: "Yes or No. Blank keeps the current value, or Yes for a new product." },
    { name: "imageUrl", note: "Optional. Full https:// link to the product image." },
    { name: "description", note: "Optional. Text may contain commas and quotes." },
    { name: "Specification columns", note: `${PRODUCT_SPECIFICATION_CSV_KEYS.join(", ")}. Only the columns for the product's category are used. Separate several values with semicolons, e.g. Mirror; Polarized.` },
  ];

  return (
    <details className="csv-guide">
      <summary>Product CSV columns and import rules</summary>

      <div className="csv-guide-body">
        <p>
          Export and import use the same columns. Export a file, edit it in Excel or Google Sheets, then import it back.
          Required columns are: {PRODUCT_CSV_REQUIRED.join(", ")}.
        </p>

        <dl className="csv-guide-list">
          {columns.map((column) => (
            <div key={column.name}>
              <dt>{column.name}</dt>
              <dd>{column.note}</dd>
            </div>
          ))}
        </dl>

        <p>
          Blank cells keep the current value when updating an existing product. Rows with errors are skipped, and each
          error shows its row number. Keep the file as CSV (UTF-8) when saving.
        </p>
      </div>
    </details>
  );
}

function SpecField({ field, value, onChange }) {
  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];

    return (
      <fieldset className="admin-form-group admin-fieldset">
        <legend className="admin-field-label">{field.label}</legend>
        <div className="admin-spec-checkboxes">
          {field.options.map((option) => (
            <label key={option} className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, option]
                      : selected.filter((item) => item !== option)
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const id = `spec-${field.key}`;

  if (field.type === "select-custom") {
    return <CustomSelectField field={field} id={id} value={value} onChange={onChange} />;
  }

  return (
    <div className="admin-form-group">
      <label htmlFor={id}>{field.label}</label>

      {field.type === "select" ? (
        <select
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {field.label}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      )}
    </div>
  );
}


function ProductsPage({ api, products, pageInfo, loading, onReload, onLoadMore, onNotice }) {
  const csvInputRef = useRef(null);
const [importingCsv, setImportingCsv] = useState(false);
  const prefs = usePrefs();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [productNameFilter, setProductNameFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priceFilter, setPriceFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  // Product starts with newest first; each sortable column keeps its own sort key.
  const [sort, setSort] = useState({ key: "recent", direction: "desc" });

  const [modal, setModal] = useState(null); // null | { mode: "add" } | { mode: "edit", id }
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [keepDetails, setKeepDetails] = useState(false);
  const [rowBusyId, setRowBusyId] = useState(null);
  const [pageError, setPageError] = useState("");

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const direction = sort.direction === "asc" ? 1 : -1;

    return products
      .filter(
        (p) =>
          matchesTerm(term, getProductTitle(p), p.category) &&
matchesTerm(productNameFilter.trim().toLowerCase(), getProductTitle(p)) &&
          (categoryFilter === "ALL" || p.category === categoryFilter) &&
          String(p.price ?? "").includes(priceFilter.trim()) &&
          String(p.stockQuantity ?? "").includes(stockFilter.trim()) &&
          (statusFilter === "ALL" || (statusFilter === "ACTIVE") === Boolean(p.active))
      )
      .sort((a, b) => {
        if (sort.key === "recent") {
          const aDate = sortValue(a, "recent");
          const bDate = sortValue(b, "recent");

          // Newest timestamp first; missing/invalid timestamps fall back to the
          // database-generated ID so older records still have a stable order.
          if (aDate !== null && bDate !== null && aDate !== bDate) {
            return (aDate - bDate) * direction;
          }
          if (aDate !== null && bDate === null) return 1 * direction;
          if (aDate === null && bDate !== null) return -1 * direction;

          const idResult = Number(a.id ?? 0) - Number(b.id ?? 0);
          return idResult * direction;
        }

        const x = sortValue(a, sort.key);
        const y = sortValue(b, sort.key);
        const result =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });

        return result * direction;
      });
    }, [products, search, productNameFilter, categoryFilter, priceFilter, stockFilter, statusFilter, sort]);

  const handleSort = (key) =>
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));

  const closeModal = useCallback(() => {
    setModal(null);
    setFormError("");
    setKeepDetails(false);
  }, []);

  const openAdd = () => {
    setForm(EMPTY_PRODUCT);
    setFormError("");
    setKeepDetails(false);
    setModal({ mode: "add" });
  };

  const openEdit = (product) => {
    setForm({
      version: product.version,
      name: product.name ?? "",
      gender: product.gender ?? product.specifications?.gender ?? "",
      category: product.category ?? "",
      description: product.description ?? "",
      price: product.price ?? "",
      stockQuantity: product.stockQuantity ?? "",
      imageUrl: product.imageUrl ?? "",
      active: product.active ?? true,
      specifications: product.specifications || {},
    });
    setFormError("");
    setModal({ mode: "edit", id: product.id });
  };

  // Changing the category clears specifications that belong to the old category
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    setForm((prev) =>
      name === "category" ? { ...prev, category: value, specifications: {} } : { ...prev, [name]: nextValue }
    );
  };

  const handleSpecChange = (key, value) =>
    setForm((prev) => ({ ...prev, specifications: { ...(prev.specifications || {}), [key]: value } }));
  const handleProductImageUpload = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";

  if (!file) return;

  const problem = getImageFileError(file);

  if (problem) {
    setFormError(problem);
    return;
  }

  setFormError("");
  setUploadingImage(true);

  try {
    const imageUrl = await uploadToCloudinary(file, "nmk-products");

    setForm((prev) => ({
      ...prev,
      imageUrl,
    }));
  } catch (err) {
    setFormError(err.message);
  } finally {
    setUploadingImage(false);
  }
};
  const handleSubmit = async (e) => {
    e.preventDefault();

    const problem = validateProduct(form);
    if (problem) {
      setFormError(problem);
      return;
    }

    const isEdit = modal?.mode === "edit";
    setSaving(true);
    setFormError("");

    try {
      const saved = await api.saveRecord({
        url: isEdit ? `${ENDPOINTS.products}/${modal.id}` : ENDPOINTS.products,
        method: isEdit ? "PUT" : "POST",
        payload: buildProductPayload(form),
        fallbackMessage: "Unable to save product",
      });

      if (!saved) return;

      // "Keep same details": clear only the product-specific fields and stay open
      if (!isEdit && keepDetails) {
        setForm((prev) => ({ ...prev, name: "", imageUrl: "", price: "", stockQuantity: "" }));
        onNotice("Product added. Enter the next product's details.");
        await onReload();
        setTimeout(() => document.getElementById("product-gender")?.focus(), 0);
        return;
      }

      closeModal();
      onNotice(isEdit ? "Product updated." : "Product added.");
      await onReload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

const handleProductCsvImport = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";

  if (!file) return;

  setPageError("");
  setImportingCsv(true);

  try {
    const text = await file.text();
    const rows = parseCsv(text);

    const missingColumns = PRODUCT_CSV_REQUIRED.filter((column) => !(column in rows[0]));
    if (missingColumns.length) {
      throw new Error(`The CSV file is missing required column(s): ${missingColumns.join(", ")}.`);
    }

    let created = 0;
    let updated = 0;
    let sessionEnded = false;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const id = row.id?.trim();

        let existingProduct = id
          ? products.find((p) => String(p.id) === id)
          : null;

        if (id && !existingProduct) {
          existingProduct = await api.getJson(
            `${ENDPOINTS.products}/${encodeURIComponent(id)}`,
            `Product ID ${id} could not be loaded.`
          );
        }

        if (id && !existingProduct) {
          throw new Error(`Product ID ${id} does not exist.`);
        }

        const category = row.category?.trim() ?? "";
        const categorySpecifications = PRODUCT_SPECIFICATIONS[category];

        if (!categorySpecifications) {
          throw new Error(`Invalid product category: ${category || "(empty)"}`);
        }

        // A blank cell keeps the current value when updating, so data is never erased by accident
        const cell = (name) => (row[name] ?? "").trim();
        const pick = (name, currentValue) => (cell(name) !== "" ? cell(name) : existingProduct ? String(currentValue ?? "") : "");

        const specifications = {};

        categorySpecifications.forEach((spec) => {
          const raw = cell(spec.key);

          if (raw !== "") {
            specifications[spec.key] =
              spec.type === "multiselect"
                ? raw.split(";").map((item) => item.trim()).filter(Boolean)
                : raw;
          } else if (existingProduct?.specifications?.[spec.key] !== undefined) {
            specifications[spec.key] = existingProduct.specifications[spec.key];
          }
        });

        const activeCell = cell("active").toLowerCase();

        const product = {
          version: existingProduct?.version ?? null,
          name: pick("name", existingProduct?.name),
          gender: pick("gender", existingProduct?.gender),
          category,
          description: pick("description", existingProduct?.description),
          price: pick("price", existingProduct?.price),
          stockQuantity: pick("stockQuantity", existingProduct?.stockQuantity),
          imageUrl: pick("imageUrl", existingProduct?.imageUrl),
          active:
            activeCell === ""
              ? existingProduct
                ? Boolean(existingProduct.active)
                : true
              : ["yes", "true", "1"].includes(activeCell),
          specifications,
        };

        const problem = validateProduct(product);

        if (problem) {
          throw new Error(problem);
        }

        const saved = await api.saveRecord({
          url: existingProduct
            ? `${ENDPOINTS.products}/${id}`
            : ENDPOINTS.products,
          method: existingProduct ? "PUT" : "POST",
          payload: buildProductPayload(product),
          fallbackMessage: "Unable to save product",
        });

        // false means the admin session ended: stop instead of counting rows as saved
        if (!saved) {
          sessionEnded = true;
          break;
        }

        if (existingProduct) {
          updated++;
        } else {
          created++;
        }
      } catch (err) {
        errors.push(`CSV row ${i + 2}: ${err.message}`);
      }
    }

    if (sessionEnded) return;

    await onReload();

    if (errors.length) {
      setPageError(
        `Import completed: ${created} created, ${updated} updated, ${errors.length} failed.\n${errors.join("\n")}`
      );
    } else {
      onNotice(`CSV import completed: ${created} created, ${updated} updated.`);
    }
  } catch (err) {
    setPageError(err.message);
  } finally {
    setImportingCsv(false);
  }
};


  const runRowAction = async (productId, action) => {
    setPageError("");
    setRowBusyId(productId);

    try {
      await action();
    } catch (err) {
      setPageError(err.message);
    } finally {
      setRowBusyId(null);
    }
  };

  const toggleActive = (product) =>
    runRowAction(product.id, async () => {
      const saved = await api.saveRecord({
        url: `${ENDPOINTS.products}/${product.id}`,
        method: "PUT",
        payload: buildProductPayload({ ...product, active: !product.active }),
        fallbackMessage: "Unable to update product status",
      });
      if (saved) await onReload();
    });

  const deleteProduct = async (product) => {
    if (prefs.confirmProductDelete) {
      const ok = await confirm({
        title: "Deactivate product",
        message: `Remove "${getProductTitle(product)}" from the active catalogue? Inventory and sales history will be retained. You can reactivate it later.`,
        confirmLabel: "Deactivate",
        danger: true,
      });
      if (!ok) return;
    }

    runRowAction(product.id, async () => {
      const deleted = await api.deleteRecord(`${ENDPOINTS.products}/${product.id}`, "Unable to delete product");
      if (deleted) {
        onNotice("Product deactivated. Inventory and sales history were retained.");
        await onReload();
      }
    });
  };

  const specFields = PRODUCT_SPECIFICATIONS[form.category] || [];

  return (
    <section className="admin-content">
      
<PageHeading
  title="Products Management"
  description="Manage your optical store products."
  action={
    <div className="admin-dashboard-actions">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={handleProductCsvImport}
      />

      <button
        type="button"
        className="admin-secondary-button"
        onClick={() => csvInputRef.current?.click()}
        disabled={importingCsv}
      >
        <Upload size={18} aria-hidden="true" />
        {importingCsv ? "Importing..." : "Import CSV"}
      </button>

      <button
        type="button"
        className="admin-primary-button"
        onClick={openAdd}
      >
        <Plus size={18} aria-hidden="true" /> Add Product
      </button>
    </div>
  }
/>


      <ErrorMessage>{pageError}</ErrorMessage>

      <div className="admin-product-toolbar">
        <SearchBox
          label="Search products"
          placeholder="Search by brand or category..."
          value={search}
          onChange={setSearch}
        />
        <RefreshButton onClick={onReload} loading={loading} />
      </div>

      
      <CsvColumnsGuide />

      <div className="admin-product-toolbar">
        <span aria-live="polite">
          {visibleProducts.length} shown · {products.length} loaded of {pageInfo?.totalElements ?? products.length} products
        </span>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <SortableTh label="Product" sortKey="recent" sort={sort} onSort={handleSort} />
                <SortableTh label="Category" sortKey="category" sort={sort} onSort={handleSort} />
                <SortableTh label="Price" sortKey="price" sort={sort} onSort={handleSort} />
                <SortableTh label="Stock" sortKey="stock" sort={sort} onSort={handleSort} />
                <SortableTh label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && <EmptyRow colSpan={6}>Loading products...</EmptyRow>}

              {!loading && visibleProducts.length === 0 && (
                <EmptyRow colSpan={6}>
                  {products.length === 0
                    ? "No products found. Add your first product."
                    : "No products match your search or filters."}
                </EmptyRow>
              )}

              {!loading && visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td data-label="Product">
                    <div className="order-cell-name">
                      {getProductTitle(product)}
                    </div>
                    <small className="order-cell-sub">
                      ID: {product.id}
                    </small>
                  </td>

                  <td data-label="Category">{product.category || "-"}</td>

                  <td data-label="Price">
                    {formatINR(product.price, true)}
                  </td>

                  <td data-label="Legacy stock">
                    {product.stockQuantity ?? 0}
                  </td>

                  <td data-label="Status">
  <button
    type="button"
    className={`admin-status-badge ${product.active ? "is-active" : "is-inactive"}`}
    onClick={() => toggleActive(product)}
    disabled={rowBusyId === product.id}
    title="Click to change product status"
  >
    {rowBusyId === product.id
      ? "Updating..."
      : product.active
        ? "Active"
        : "Inactive"}
  </button>
</td>

                  <td data-label="Actions">
                    <div className="admin-row-actions">
                      <button
  type="button"
  className="admin-secondary-button"
  onClick={() => openEdit(product)}
  title="Edit product"
  aria-label="Edit product"
>
  <Pencil size={16} aria-hidden="true" />
</button>

                      <button
  type="button"
  className="admin-clear-button"
  onClick={() => deleteProduct(product)}
  disabled={rowBusyId === product.id}
  title="Deactivate product"
  aria-label="Deactivate product"
>
  <Trash2 size={16} aria-hidden="true" />
</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!pageInfo?.last && (
        <div className="admin-load-more" style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button type="button" className="admin-secondary-button" disabled={loading} onClick={onLoadMore}>
            {loading ? "Loading..." : "Load more products"}
          </button>
        </div>
      )}

      {modal && (

        <Modal
          title={modal.mode === "edit" ? "Edit Product" : "Add New Product"}
          subtitle="Enter your product information below."
          onClose={closeModal}
          closable={!saving}
        >
          <form onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <FormGroup id="product-gender" label="Gender" required>
                <select id="product-gender" name="gender" value={form.gender} onChange={handleChange} required>
                  <option value="">Select gender</option>
                  {PRODUCT_GENDERS.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              </FormGroup>

              <FormGroup id="product-category" label="Category" required>
                <select id="product-category" name="category" value={form.category} onChange={handleChange} required>
                  <option value="">Select category</option>
                  {form.category && !PRODUCT_CATEGORIES.includes(form.category) && (
                    <option value={form.category}>{form.category}</option>
                  )}
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FormGroup>

              {specFields.map((field) => (
                <SpecField
                  key={field.key}
                  field={field}
                  value={form.specifications?.[field.key]}
                  onChange={(value) => handleSpecChange(field.key, value)}
                />
              ))}

              <FormGroup id="product-price" label="Price (₹)" required>
                <input
                  id="product-price"
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="Enter price"
                  required
                />
              </FormGroup>

              <FormGroup id="product-stock" label="Legacy Stock Quantity (not used for POS availability)" required>
                <input
                  id="product-stock"
                  type="number"
                  name="stockQuantity"
                  min="0"
                  step="1"
                  value={form.stockQuantity}
                  onChange={handleChange}
                  placeholder="Legacy product field only"
                  required
                />
              </FormGroup>

              <FormGroup id="product-image" label="Product Image URL" full>
  <input
    id="product-image"
    type="url"
    name="imageUrl"
    value={form.imageUrl}
    onChange={handleChange}
    placeholder="Paste image URL or choose a file"
    disabled={uploadingImage}
  />

  <label htmlFor="product-image-file">
    Or Choose Image File
  </label>

  <input
    id="product-image-file"
    type="file"
    accept={IMAGE_ACCEPT}
    onChange={handleProductImageUpload}
    disabled={saving || uploadingImage}
  />

  <small>
    {uploadingImage
      ? "Uploading image..."
      : "JPG, PNG or WEBP. Maximum 5 MB."}
  </small>

  {form.imageUrl && isValidHttpUrl(form.imageUrl) && (
    <img
      src={form.imageUrl}
      alt="Product preview"
      style={{
        width: "120px",
        height: "120px",
        objectFit: "contain",
        marginTop: "10px",
      }}
    />
  )}
</FormGroup>

              <FormGroup id="product-description" label="Description" full>
                <textarea
                  id="product-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Enter product description"
                  rows={3}
                />
              </FormGroup>

              <div className="admin-form-group admin-form-full">
                <label className="admin-checkbox-label">
                  <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
                  Make this product visible in the store
                </label>
              </div>

              {modal.mode === "add" && (
                <div className="admin-form-group admin-form-full">
                  <label className="admin-checkbox-label">
                    <input type="checkbox" checked={keepDetails} onChange={(e) => setKeepDetails(e.target.checked)} />
                    Keep same details for the next product (only name, image, price and stock are cleared)
                  </label>
                </div>
              )}
            </div>

            <ErrorMessage>{formError}</ErrorMessage>

            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-button" onClick={closeModal} disabled={saving}>
                Cancel
              </button>

              <button
  type="submit"
  className="admin-primary-button"
  disabled={saving || uploadingImage}
>
  {uploadingImage
    ? "Uploading Image..."
    : saving
      ? "Saving..."
      : modal.mode === "edit"
        ? "Update Product"
        : "Add Product"}
</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/* =========================
   ORDERS
   Compact list. "View details" opens the full order in a dialog.
========================= */

const ORDER_STATUS_LABELS = Object.fromEntries(ORDER_STATUSES.map((s) => [s.value, s.label]));

// Set to the storefront URL when the admin is hosted apart from the website. Empty uses this site's origin.
const CUSTOMER_SITE_URL = "";

const orderTrackingLink = (order) => {
  if (!order.trackingToken) return "";
  const base = (CUSTOMER_SITE_URL || window.location.origin).replace(/\/+$/, "");
  return `${base}/track/${encodeURIComponent(order.trackingToken)}`;
};

// "#101" finds exactly order 101. Other text matches the order number, name, email or phone.
// Phone digits match once four or more are typed, and spaces or dashes in the number are ignored.
const matchesOrderSearch = (order, rawTerm) => {
  const term = rawTerm.trim().toLowerCase();
  if (!term) return true;
  if (term.startsWith("#")) return String(order.id) === term.slice(1).trim();
  if (matchesTerm(term, order.id, order.customerName, order.email)) return true;
  const digits = term.replace(/\D/g, "");
  return digits.length >= 4 && String(order.phone ?? "").replace(/\D/g, "").includes(digits);
};

const isOrderPaid = (order) => String(order.paymentStatus || "").toUpperCase() === "PAID";

const countUnits = (order) => (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

// Plain-language lens summary for one order line
const lensSummary = (item) => {
  if (!item.prescriptionType) return "-";
  if (item.prescriptionType === "Frame Only") return "Frame only";

  return [item.prescriptionType, item.lensType, item.photochromic ? "Photochromic" : null]
    .filter(Boolean)
    .join(" · ");
};

function OrderStatusBadge({ status }) {
  const value = status || "PENDING";

  return (
    <span className="admin-order-status" data-status={value}>
      {ORDER_STATUS_LABELS[value] ?? value}
    </span>
  );
}

const RX_FIELDS = [
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "axis", label: "Axis" },
  { key: "add", label: "ADDL" },
];

// Prescription the customer entered for one item. Shown only when the order record includes it;
// otherwise the admin sees that the values were not recorded.

function PrescriptionBlock({ item, api, orderId }) {
  const rx = item.prescription;
  const [secureUrl, setSecureUrl] = useState("");
  const [secureError, setSecureError] = useState("");
  const [loadingSecureUrl, setLoadingSecureUrl] = useState(false);

  useEffect(() => {
    let active = true;
    if (!rx || rx.mode !== "image") {
      setSecureUrl("");
      return () => { active = false; };
    }
    if (!rx.publicId) {
      setSecureUrl(rx.imageUrl || "");
      return () => { active = false; };
    }
    setLoadingSecureUrl(true);
    setSecureError("");
    api.getJson(
      `${ENDPOINTS.orders}/${orderId}/items/${item.id}/prescription`,
      "Unable to open prescription"
    ).then((data) => {
      if (active) setSecureUrl(data?.url || "");
    }).catch((error) => {
      if (active) setSecureError(error.message || "Unable to open prescription.");
    }).finally(() => {
      if (active) setLoadingSecureUrl(false);
    });
    return () => { active = false; };
  }, [api.getJson, item.id, orderId, rx?.mode, rx?.publicId, rx?.imageUrl]);

  if (!rx) {
    return (
      <p className="order-detail-small">
        {item.productName}: no prescription was saved for this item.
        Orders placed before prescriptions were saved show this.
      </p>
    );
  }

  if (rx.mode === "image") {
    const url = secureUrl;
    const isPdf = /\.pdf$/i.test(rx.format || "") || /\.pdf$/i.test(rx.imageName || "");
    return (
      <div className="order-rx-image">
        <p className="order-detail-main">{item.productName}: uploaded prescription</p>
        {loadingSecureUrl && <p className="order-detail-small">Preparing secure file access…</p>}
        {secureError && <p className="order-detail-small" role="alert">{secureError}</p>}
        {!loadingSecureUrl && !secureError && !url && (
          <p className="order-detail-small">The prescription file is not available.</p>
        )}
        {url && !isPdf && (
          <a href={url} target="_blank" rel="noreferrer" className="order-rx-thumb">
            <img src={url} alt={`Prescription for ${item.productName}`} loading="lazy" />
          </a>
        )}
        {url && (
          <p>
            <a href={url} target="_blank" rel="noreferrer">
              {rx.imageName || "Open prescription file"}
            </a>
            {rx.publicId && <span className="order-detail-small"> · Secure link expires in 5 minutes</span>}
          </p>
        )}
      </div>
    );
  }

  if (rx.mode === "contact") {
    const contactFields = [
      { key: "sph", label: "SPH" },
      { key: "cyl", label: "CYL" },
      { key: "axis", label: "Axis" },
      { key: "boxes", label: "Boxes" },
    ];
    return (
      <div className="order-rx-block">
        <p className="order-detail-main">{item.productName}: contact lens prescription</p>
        <table className="admin-table order-items-table">
          <thead><tr><th scope="col">Power</th><th scope="col">Right eye</th><th scope="col">Left eye</th></tr></thead>
          <tbody>{contactFields.map((field) => (
            <tr key={field.key}><td>{field.label}</td><td>{rx.right?.[field.key] || "–"}</td><td>{rx.left?.[field.key] || "–"}</td></tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  const sameForBoth = Boolean(rx.sameForBothEyes);
  const hasAddition = [rx.right, rx.left].some((row) => row?.add);
  const fields = RX_FIELDS.filter((field) => {
    if (field.key === "cyl" || field.key === "axis") return Boolean(rx.hasCylinder);
    if (field.key === "add") return hasAddition;
    return true;
  });
  return (
    <div className="order-rx-block">
      <p className="order-detail-main">
        {item.productName}
        {sameForBoth && <span className="order-detail-small"> · Same power for both eyes</span>}
      </p>
      <table className="admin-table order-items-table">
        <thead><tr><th scope="col">Power</th><th scope="col">Right eye</th>{!sameForBoth && <th scope="col">Left eye</th>}</tr></thead>
        <tbody>{fields.map((field) => (
          <tr key={field.key}><td>{field.label}</td><td>{rx.right?.[field.key] || "–"}</td>{!sameForBoth && <td>{rx.left?.[field.key] || "–"}</td>}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function SettlementReconciliationPage({ api }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [day, setDay] = useState("");
  const [settlements, setSettlements] = useState([]);
  const [pageInfo, setPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, first: true, last: true });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesPageInfo, setEntriesPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, last: true });
  const [entriesLoading, setEntriesLoading] = useState(false);

  const loadSettlements = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const data = await api.getJson(
        `${ENDPOINTS.settlements}?page=${page}&size=50`,
        "Unable to load Razorpay settlements"
      );
      setSettlements(Array.isArray(data?.content) ? data.content : []);
      setPageInfo({
        number: Number(data?.number || 0),
        totalPages: Number(data?.totalPages || 0),
        totalElements: Number(data?.totalElements || 0),
        first: Boolean(data?.first),
        last: Boolean(data?.last),
      });
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load Razorpay settlements");
    } finally {
      setLoading(false);
    }
  }, [api.getJson]);

  useEffect(() => {
    loadSettlements(0);
  }, [loadSettlements]);

  const syncSettlements = async () => {
    if (syncing) return;
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({ year, month });
      if (day) params.set("day", day);
      const result = await api.postJson(
        `${ENDPOINTS.settlements}/sync?${params.toString()}`,
        {},
        null,
        "Unable to synchronize Razorpay settlements"
      );
      if (!result) return;
      setNotice(result.message || "Razorpay settlement report synchronized.");
      setSelected(null);
      setEntries([]);
      await loadSettlements(0);
    } catch (err) {
      setError(err.message || "Unable to synchronize Razorpay settlements");
    } finally {
      setSyncing(false);
    }
  };

  const viewEntries = async (settlement) => {
    setSelected(settlement);
    setEntriesLoading(true);
    try {
      const data = await api.getJson(
        `${ENDPOINTS.settlements}/${settlement.id}/entries?page=0&size=100`,
        "Unable to load settlement entries"
      );
      setEntries(Array.isArray(data?.content) ? data.content : []);
      setEntriesPageInfo({
        number: Number(data?.number || 0),
        totalPages: Number(data?.totalPages || 0),
        totalElements: Number(data?.totalElements || 0),
        last: Boolean(data?.last),
      });
    } catch (err) {
      setError(err.message || "Unable to load settlement entries");
    } finally {
      setEntriesLoading(false);
    }
  };

  const loadMoreEntries = async () => {
    if (!selected || entriesLoading || entriesPageInfo.last) return;
    setEntriesLoading(true);
    try {
      const nextPage = entriesPageInfo.number + 1;
      const data = await api.getJson(
        `${ENDPOINTS.settlements}/${selected.id}/entries?page=${nextPage}&size=100`,
        "Unable to load more settlement entries"
      );
      setEntries((current) => [...current, ...(Array.isArray(data?.content) ? data.content : [])]);
      setEntriesPageInfo({
        number: Number(data?.number || nextPage),
        totalPages: Number(data?.totalPages || 0),
        totalElements: Number(data?.totalElements || 0),
        last: Boolean(data?.last),
      });
    } catch (err) {
      setError(err.message || "Unable to load more settlement entries");
    } finally {
      setEntriesLoading(false);
    }
  };

  const statusClass = (status) => {
    if (status === "PROVIDER_RECONCILED" || status === "MATCHED") return "available";
    if (status === "FAILED" || status === "REVIEW_REQUIRED" || status === "MISMATCH" || status === "UNMATCHED" || status === "MANUAL_REVIEW") return "inactive";
    return "pending";
  };

  return (
    <section className="admin-content">
      <div className="admin-section-header">
        <div>
          <h2>Razorpay settlement reconciliation</h2>
          <p>Fetch provider settlement reports and match payment/refund rows against NMK orders.</p>
        </div>
        <button type="button" className="admin-secondary-button" onClick={() => loadSettlements(0)} disabled={loading || syncing}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="admin-table-card" style={{ marginBottom: 16 }}>
        <div className="admin-table-heading">
          <div>
            <h3>Synchronize provider report</h3>
            <p>Choose a month or a single day. The sync is read-only against Razorpay.</p>
          </div>
        </div>
        <div className="admin-form-grid" style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <label className="admin-form-group">
            <span>Year</span>
            <input type="number" min="2020" max={now.getFullYear()} value={year} onChange={(event) => setYear(event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>Month</span>
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{String(value).padStart(2, "0")}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-field">
            <span>Day (optional)</span>
            <input type="number" min="1" max="31" placeholder="Whole month" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" className="admin-primary-button" onClick={syncSettlements} disabled={syncing || loading || !year || !month}>
              {syncing ? "Synchronizing…" : "Sync Razorpay report"}
            </button>
          </div>
        </div>
        {notice && <p className="admin-success-message" role="status" style={{ margin: "0 16px 16px" }}>{notice}</p>}
        {error && <p className="admin-error-message" role="alert" style={{ margin: "0 16px 16px" }}>{error}</p>}
      </div>

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Settlement batches</h3>
            <p>{pageInfo.totalElements.toLocaleString("en-IN")} batches · newest first</p>
          </div>
          <span className="admin-help-text">Provider report records only</span>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Settlement / date</th><th>Provider status</th><th>Net amount</th>
                <th>Fees</th><th>Tax</th><th>UTR</th><th>Provider reconciliation</th><th>Rows</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow colSpan={9}>Loading settlement batches…</EmptyRow>
                : settlements.length === 0 ? <EmptyRow colSpan={9}>No settlement batches imported yet. Synchronize a report above.</EmptyRow>
                  : settlements.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.providerSettlementId}</strong>
                        <div className="admin-help-text">{formatDateTime(item.providerCreatedAt)}</div>
                      </td>
                      <td><span className="admin-status">{item.status}</span></td>
                      <td>{formatINR(Number(item.amountPaise || 0) / 100, true)}</td>
                      <td>{formatINR(Number(item.feesPaise || 0) / 100, true)}</td>
                      <td>{formatINR(Number(item.taxPaise || 0) / 100, true)}</td>
                      <td className="od-mono">{item.utr || "—"}</td>
                      <td><span className={`admin-status ${statusClass(item.reconciliationStatus)}`}>{item.reconciliationStatus}</span></td>
                      <td>
                        {Number(item.matchedEntries || 0)} / {Number(item.totalEntries || 0)} matched
                        {Number(item.unmatchedEntries || 0) + Number(item.manualReviewEntries || 0) + Number(item.pendingEntries || 0) > 0 && (
                          <div className="admin-help-text">
                            {Number(item.unmatchedEntries || 0)} unmatched · {Number(item.manualReviewEntries || 0)} review · {Number(item.pendingEntries || 0)} pending
                          </div>
                        )}
                      </td>
                      <td>
                        <button type="button" className="admin-secondary-button" onClick={() => viewEntries(item)}>
                          View rows
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-heading" style={{ borderTop: "1px solid var(--admin-border, #e5e7eb)" }}>
          <span className="admin-help-text">Page {pageInfo.totalPages === 0 ? 0 : pageInfo.number + 1} of {pageInfo.totalPages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="admin-secondary-button" disabled={loading || pageInfo.first || pageInfo.number === 0} onClick={() => loadSettlements(pageInfo.number - 1)}>Previous</button>
            <button type="button" className="admin-secondary-button" disabled={loading || pageInfo.last} onClick={() => loadSettlements(pageInfo.number + 1)}>Next</button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="admin-table-card" style={{ marginTop: 16 }}>
          <div className="admin-table-heading">
            <div>
              <h3>Settlement rows · {selected.providerSettlementId}</h3>
              <p>{selected.utr || "No UTR returned"} · {entriesPageInfo.totalElements.toLocaleString("en-IN")} provider entries</p>
            </div>
            <button type="button" className="admin-secondary-button" onClick={() => { setSelected(null); setEntries([]); }}>Close</button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr><th>Type / entity</th><th>Order / payment</th><th>Amount</th><th>Debit</th><th>Credit</th><th>Fee + tax</th><th>Match</th></tr>
              </thead>
              <tbody>
                {entriesLoading && entries.length === 0 ? <EmptyRow colSpan={7}>Loading settlement rows…</EmptyRow>
                  : entries.length === 0 ? <EmptyRow colSpan={7}>No entries found for this settlement.</EmptyRow>
                    : entries.map((entry) => (
                      <tr key={entry.id}>
                        <td><strong>{entry.entryType}</strong><div className="admin-help-text od-mono">{entry.providerEntityId}</div></td>
                        <td><div>{entry.orderId || "—"}</div><div className="admin-help-text od-mono">{entry.paymentId || "—"}</div>{entry.localDisputeId && <div className="admin-help-text">Dispute #{entry.localDisputeId}</div>}</td>
                        <td>{formatINR(Number(entry.amountPaise || 0) / 100, true)}</td>
                        <td>{formatINR(Number(entry.debitPaise || 0) / 100, true)}</td>
                        <td>{formatINR(Number(entry.creditPaise || 0) / 100, true)}</td>
                        <td>{formatINR((Number(entry.feePaise || 0) + Number(entry.taxPaise || 0)) / 100, true)}</td>
                        <td><span className={`admin-status ${statusClass(entry.matchStatus)}`}>{entry.matchStatus}</span><div className="admin-help-text">{entry.matchMessage}</div></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!entriesPageInfo.last && (
            <div style={{ padding: 12, textAlign: "center" }}>
              <button type="button" className="admin-secondary-button" disabled={entriesLoading} onClick={loadMoreEntries}>
                {entriesLoading ? "Loading…" : "Load more rows"}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="admin-help-text" style={{ marginTop: 14 }}>
        “Provider reconciled” means Razorpay’s settlement totals and payment/refund entries match the local order/refund ledgers. It does not confirm that the UTR credit appears in the shop’s bank statement. Bank-statement matching is a separate step and requires the client’s bank statement format.
      </p>
    </section>
  );
}

function PaymentDisputesPage({ api }) {
  const [disputes, setDisputes] = useState([]);
  const [pageInfo, setPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, first: true, last: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDisputes = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const data = await api.getJson(
        `${ENDPOINTS.disputes}?page=${page}&size=50`,
        "Unable to load Razorpay disputes"
      );
      setDisputes(Array.isArray(data?.content) ? data.content : []);
      setPageInfo({
        number: Number(data?.number || 0),
        totalPages: Number(data?.totalPages || 0),
        totalElements: Number(data?.totalElements || 0),
        first: Boolean(data?.first),
        last: Boolean(data?.last),
      });
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load Razorpay disputes");
    } finally {
      setLoading(false);
    }
  }, [api.getJson]);

  useEffect(() => {
    loadDisputes(0);
  }, [loadDisputes]);

  const statusClass = (status) => {
    if (status === "WON" || status === "MATCHED") return "available";
    if (status === "LOST" || status === "ACTION_REQUIRED" || status === "UNMATCHED" || status === "MISMATCH" || status === "MANUAL_REVIEW") return "inactive";
    return "pending";
  };

  return (
    <section className="admin-content">
      <div className="admin-section-header">
        <div>
          <h2>Razorpay payment disputes</h2>
          <p>Track chargeback status, response deadlines and disputed amounts from signed provider webhooks.</p>
        </div>
        <button type="button" className="admin-secondary-button" onClick={() => loadDisputes(0)} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <p className="admin-error-message" role="alert">{error}</p>}

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Dispute ledger</h3>
            <p>{pageInfo.totalElements.toLocaleString("en-IN")} disputes · response deadlines first</p>
          </div>
          <span className="admin-help-text">Webhook-driven · no automatic order or stock changes</span>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dispute / payment</th><th>Local order</th><th>Disputed amount</th>
                <th>Amount deducted</th><th>Reason</th><th>Phase / status</th>
                <th>Respond by</th><th>Local match</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow colSpan={8}>Loading disputes…</EmptyRow>
                : disputes.length === 0 ? <EmptyRow colSpan={8}>No Razorpay disputes received yet.</EmptyRow>
                  : disputes.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong className="od-mono">{item.providerDisputeId}</strong>
                        <div className="admin-help-text od-mono">{item.providerPaymentId}</div>
                      </td>
                      <td>{item.localOrderId ? `#${item.localOrderId}` : "Unmatched"}</td>
                      <td>{formatINR(Number(item.amountPaise || 0) / 100, true)}</td>
                      <td>{formatINR(Number(item.amountDeductedPaise || 0) / 100, true)}</td>
                      <td>
                        <strong>{item.reasonCode || "—"}</strong>
                        <div className="admin-help-text">{item.reasonDescription || "No provider description"}</div>
                      </td>
                      <td>
                        <span className={`admin-status ${statusClass(item.status)}`}>{item.status}</span>
                        <div className="admin-help-text">{item.phase || "—"}</div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {item.respondBy ? formatDateTime(item.respondBy) : "—"}
                        {item.status === "ACTION_REQUIRED" && <div className="admin-help-text">Action required in Razorpay</div>}
                      </td>
                      <td>
                        <span className={`admin-status ${statusClass(item.matchStatus)}`}>{item.matchStatus}</span>
                        <div className="admin-help-text">{item.matchMessage}</div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-heading" style={{ borderTop: "1px solid var(--admin-border, #e5e7eb)" }}>
          <span className="admin-help-text">Page {pageInfo.totalPages === 0 ? 0 : pageInfo.number + 1} of {pageInfo.totalPages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="admin-secondary-button" disabled={loading || pageInfo.first || pageInfo.number === 0} onClick={() => loadDisputes(pageInfo.number - 1)}>Previous</button>
            <button type="button" className="admin-secondary-button" disabled={loading || pageInfo.last} onClick={() => loadDisputes(pageInfo.number + 1)}>Next</button>
          </div>
        </div>
      </div>

      <p className="admin-help-text" style={{ marginTop: 14 }}>
        Dispute status and deadlines are updated from signed Razorpay webhooks. Evidence submission and accept/contest decisions must be handled in Razorpay Dashboard. This screen does not submit evidence, change dispute outcomes, cancel orders or adjust inventory.
      </p>
    </section>
  );
}

function OnlineRefundPanel({ order, api, onNotice, onReload }) {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [retryKey, setRetryKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getJson(
        `${ENDPOINTS.orders}/${order.id}/refunds`,
        "Unable to load refund history"
      );
      const rows = Array.isArray(data) ? data : [];
      setRefunds(rows);
      setLoadError("");
      const unresolved = rows.find((refund) =>
        refund.status === "PENDING" && !refund.razorpayRefundId && refund.requestIdempotencyKey
      );
      if (unresolved) {
        setRetryKey(unresolved.requestIdempotencyKey);
        setAmount((Number(unresolved.amountPaise) / 100).toFixed(2));
        setReason(unresolved.reason || "");
      } else {
        setRetryKey("");
      }
    } catch (err) {
      setLoadError(err.message || "Unable to load refund history");
    } finally {
      setLoading(false);
    }
  }, [api.getJson, order.id]);

  useEffect(() => {
    loadRefunds();
  }, [loadRefunds]);

  const activeRefundPaise = refunds
    .filter((refund) => ["PENDING", "PROCESSED"].includes(refund.status))
    .reduce((total, refund) => total + Number(refund.amountPaise || 0), 0);
  const totalPaise = Math.round(Number(order.totalAmount || 0) * 100);
  const remainingPaise = Math.max(0, totalPaise - activeRefundPaise);
  const pendingProvider = refunds.some((refund) => refund.status === "PENDING");
  const canInitiate = order.paymentStatus === "PAID"
    && remainingPaise >= 100
    && !pendingProvider
    && !busy;

  const parseAmountPaise = (value) => {
    const match = String(value || "").trim().match(/^(\d{1,10})(?:\.(\d{1,2}))?$/);
    if (!match) return null;
    const paise = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
    return Number.isSafeInteger(paise) ? paise : null;
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    if (busy) return;

    const retryRecord = retryKey
      ? refunds.find((refund) => refund.requestIdempotencyKey === retryKey && refund.status === "PENDING")
      : null;
    const amountPaise = retryKey && retryRecord
      ? Number(retryRecord.amountPaise)
      : parseAmountPaise(amount);
    if (amountPaise == null || amountPaise < 100
      || (!retryKey && amountPaise > remainingPaise)
      || (retryKey && !retryRecord)) {
      setError("Enter a refund amount of at least ₹1.00 within the remaining refundable balance.");
      return;
    }
    if (!reason.trim() || reason.trim().length > 255) {
      setError("Enter a reason of up to 255 characters.");
      return;
    }
    if (!password.trim()) {
      setError("Enter your admin password to authorize this financial action.");
      return;
    }

    const idempotencyKey = retryKey || crypto.randomUUID().replace(/-/g, "");
    setBusy(true);
    setError("");
    try {
      const authorizationToken = await api.authorizeAction(password, "RAZORPAY_REFUND");
      const result = await api.postJson(
        `${ENDPOINTS.orders}/${order.id}/refunds`,
        { amountPaise, reason: reason.trim(), idempotencyKey },
        authorizationToken,
        "Unable to initiate Razorpay refund"
      );
      if (!result) return;

      setPassword("");
      setRetryKey(result.retryWithSameKey ? idempotencyKey : "");
      onNotice(result.message || "Refund request submitted.");
      await loadRefunds();
      await onReload();
    } catch (err) {
      setError(err.message || "Unable to initiate refund.");
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 409) {
        setRetryKey("");
      }
      await loadRefunds();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="od-card" aria-labelledby={`od-${order.id}-refunds`}>
      <div className="od-section-head">
        <div>
          <h3 id={`od-${order.id}-refunds`}>Razorpay refunds</h3>
          <p className="od-muted">Normal-speed full or partial refunds. Admin password required for every request.</p>
        </div>
        <span className="admin-status">{formatINR(remainingPaise / 100, true)} remaining</span>
      </div>

      {loading ? (
        <p className="od-muted">Loading refund history…</p>
      ) : loadError ? (
        <p className="od-warning" role="alert">{loadError}</p>
      ) : refunds.length === 0 ? (
        <p className="od-muted">No Razorpay refunds have been recorded for this order.</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table od-items-table">
            <thead>
              <tr><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Razorpay refund ID</th><th scope="col">Reason</th></tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td><span className={`admin-status ${refund.status === "FAILED" ? "inactive" : "available"}`}>{refund.status}</span></td>
                  <td>{formatINR(Number(refund.amountPaise || 0) / 100, true)}</td>
                  <td className="od-mono">{refund.razorpayRefundId || "Awaiting provider confirmation"}</td>
                  <td>{refund.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingProvider && !retryKey && (
        <div className="od-warning" role="note">
          A refund is still pending at Razorpay. Wait for its webhook status before starting another refund.
        </div>
      )}

      {order.paymentStatus !== "PAID" ? (
        <p className="od-muted">Only orders with a verified captured payment can be refunded.</p>
      ) : remainingPaise < 100 && !retryKey ? (
        <p className="od-muted">The full captured amount is already refunded or reserved by pending refunds.</p>
      ) : (
        <form className="od-courier-form" onSubmit={submitRefund} noValidate>
          {retryKey && (
            <div className="od-warning" role="note">
              The previous provider response was uncertain. Retry this exact request with the same idempotency key; do not create a new refund request.
            </div>
          )}
          <FormGroup id={`refund-amount-${order.id}`} label="Refund amount (₹)">
            <input
              id={`refund-amount-${order.id}`}
              type="number"
              min="1"
              max={(remainingPaise / 100).toFixed(2)}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={!canInitiate || Boolean(retryKey)}
            />
          </FormGroup>
          <FormGroup id={`refund-reason-${order.id}`} label="Reason">
            <input
              id={`refund-reason-${order.id}`}
              type="text"
              maxLength={255}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for refund"
              disabled={!canInitiate || Boolean(retryKey)}
            />
          </FormGroup>
          <FormGroup id={`refund-password-${order.id}`} label="Admin password">
            <input
              id={`refund-password-${order.id}`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Re-enter admin password"
              disabled={busy}
            />
          </FormGroup>
          <ErrorMessage>{error}</ErrorMessage>
          <div className="od-actions-right">
            <button type="submit" className="od-primary-btn" disabled={(!canInitiate && !retryKey) || busy}>
              {busy ? "Submitting…" : retryKey ? "Retry same refund request" : "Initiate normal refund"}
            </button>
          </div>
          <p className="od-muted">
            Refunds do not automatically cancel the order or restore stock. Reconcile inventory separately after the refund is confirmed.
          </p>
        </form>
      )}
    </section>
  );
}

function OrderDetailsDialog({ api, order, onClose, onNotice, onReload }) {
  const { busyId, error: statusError, update } = useStatusUpdater({
    api,
    baseUrl: ENDPOINTS.orders,
    label: "Order",
    onNotice,
    onReload,
  });

  const [courierName, setCourierName] = useState(order.courierName || "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [deliveryError, setDeliveryError] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [statusDraft, setStatusDraft] = useState(order.orderStatus || "PENDING");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Show the saved courier details for this order, including after a reload
  useEffect(() => {
    setCourierName(order.courierName || "");
    setTrackingNumber(order.trackingNumber || "");
    setDeliveryError("");
  }, [order.id, order.courierName, order.trackingNumber]);

  // Keep the status draft in step with the saved status
  useEffect(() => {
    setStatusDraft(order.orderStatus || "PENDING");
  }, [order.id, order.orderStatus]);

  const paid = isOrderPaid(order);
  const locked = ["DELIVERED", "CANCELLED"].includes(order.orderStatus);
  const trackingUrl = orderTrackingLink(order);
  const items = order.items ?? [];
  const statusBusy = busyId === order.id;
  const statusLabel = ORDER_STATUS_LABELS[order.orderStatus] ?? order.orderStatus ?? "Pending";
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity || 0), 0);
  const deliveryDetailsSaved = Boolean(order.courierName && order.trackingNumber);
  const dispatchNeedsDetails = !paid || !deliveryDetailsSaved;
  const statusChanged = statusDraft !== (order.orderStatus || "PENDING");
  const notes = order.notes?.trim() || "";

  const saveDelivery = async (e) => {
    e.preventDefault();

    if (!courierName.trim() || !trackingNumber.trim()) {
      setDeliveryError("Enter both the courier name and the tracking number.");
      return;
    }

    setDeliveryError("");
    setSavingDelivery(true);

    try {
      const saved = await api.saveRecord({
        url: `${ENDPOINTS.orders}/${order.id}/delivery`,
        method: "PUT",
        payload: { courierName: courierName.trim(), trackingNumber: trackingNumber.trim() },
        fallbackMessage: "Unable to save delivery details",
      });

      if (saved) {
        onNotice("Delivery details saved.");
        await onReload();
      }
    } catch (err) {
      setDeliveryError(err.message);
    } finally {
      setSavingDelivery(false);
    }
  };

  const copyTrackingLink = async () => {
    if (!trackingUrl) return;

    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotice("Copying is not available here. Select the link and copy it manually.");
    }
  };

  const titleSubtitle = (
    <span className="od-title-meta">
      <span className="od-order-no">#OD-{order.id}</span>
      <span className="admin-order-status od-status-pill" data-status={order.orderStatus || "PENDING"}>
        <span className="od-status-dot" aria-hidden="true" />
        {statusLabel}
      </span>
    </span>
  );

  return (
    <Modal
      title="Order Details"
      subtitle={titleSubtitle}
      onClose={onClose}
      panelClass="admin-order-modal od-modal"
      headerClass="od-modal-header"
    >
      <div className="od-body">
        <div className="od-summary-grid">
          <section className="od-card" aria-labelledby={`od-${order.id}-customer`}>
            <div className="od-card-head">
              <span className="od-icon" aria-hidden="true">
                <User size={18} />
              </span>
              <div>
                <p className="od-eyebrow" id={`od-${order.id}-customer`}>Customer</p>
                <p className="od-card-title">{order.customerName || "-"}</p>
              </div>
            </div>
            <dl className="od-kv">
              <div>
                <dt>Phone</dt>
                <dd>{order.phone ? <a href={`tel:${order.phone}`}>{order.phone}</a> : "Not provided"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{order.email || "Not provided"}</dd>
              </div>
            </dl>
          </section>

          <section className="od-card" aria-labelledby={`od-${order.id}-address`}>
            <div className="od-card-head">
              <span className="od-icon" aria-hidden="true">
                <MapPin size={18} />
              </span>
              <div>
                <p className="od-eyebrow" id={`od-${order.id}-address`}>Shipping address</p>
                <p className="od-card-title">Delivery address</p>
              </div>
            </div>
            <p className="od-address">
              {order.address || "Not provided"}
              {(order.city || order.state || order.pincode) && (
                <>
                  <br />
                  {[order.city, order.state].filter(Boolean).join(", ")}
                  {order.pincode ? ` – ${order.pincode}` : ""}
                </>
              )}
            </p>
          </section>

          <section className="od-card" aria-labelledby={`od-${order.id}-payment`}>
            <div className="od-card-head">
              <span className="od-icon" aria-hidden="true">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <p className="od-eyebrow" id={`od-${order.id}-payment`}>Payment status</p>
                <span className={`admin-status ${paid ? "available" : "inactive"}`}>
                  {order.paymentStatus || "PENDING"}
                </span>
              </div>
              <p className="od-amount">{formatINR(order.totalAmount, true)}</p>
            </div>
            <dl className="od-kv">
              <div>
                <dt>Refund status</dt>
                <dd>{order.refundStatus || "NONE"}</dd>
              </div>
              <div>
                <dt>Payment ID</dt>
                <dd className="od-mono">{order.razorpayPaymentId || "Not available"}</dd>
              </div>
              <div>
                <dt>Razorpay order</dt>
                <dd className="od-mono">{order.razorpayOrderId || "Not available"}</dd>
              </div>
            </dl>
          </section>
        </div>

        <OnlineRefundPanel order={order} api={api} onNotice={onNotice} onReload={onReload} />

        <section className="od-card" aria-labelledby={`od-${order.id}-items`}>
          <div className="od-section-head">
            <div>
              <h3 id={`od-${order.id}-items`}>Order Items</h3>
              <p className="od-muted">Eyewear, optical lenses, and coatings configured for this order</p>
            </div>
            <span className="od-count-pill">
              {items.length} {items.length === 1 ? "Product Line" : "Product Lines"}
            </span>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-table od-items-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Lens details</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Unit price</th>
                  <th scope="col">Line total</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const lens = lensSummary(item);

                  return (
                    <tr key={item.id ?? `${item.productId}-${item.productName}`}>
                      <td>
                        <div className="od-product">
                          <span className="od-icon od-icon-sm" aria-hidden="true">
                            <Package size={16} />
                          </span>
                          <span>{item.productName}</span>
                        </div>
                      </td>
                      <td>{lens ? <span className="od-lens-pill">{lens}</span> : "–"}</td>
                      <td>{item.quantity}</td>
                      <td>{formatINR(item.price, true)}</td>
                      <td>{formatINR(Number(item.price) * Number(item.quantity), true)}</td>
                    </tr>
                  );
                })}

                {items.length === 0 && <EmptyRow colSpan={5}>No items recorded for this order.</EmptyRow>}
              </tbody>
            </table>
          </div>

          <dl className="od-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatINR(subtotal, true)}</dd>
            </div>
            <div className="od-total-final">
              <dt>Order total</dt>
              <dd>{formatINR(order.totalAmount, true)}</dd>
            </div>
          </dl>
        </section>

        <section className="od-card od-courier" aria-labelledby={`od-${order.id}-delivery`}>
          <h3 id={`od-${order.id}-delivery`}>Courier and tracking</h3>

          {!paid && <p className="od-muted">Delivery details can be added once payment is confirmed.</p>}

          {paid && locked && (
            <p className="od-muted">
              Delivery details are locked for {ORDER_STATUS_LABELS[order.orderStatus]?.toLowerCase()} orders.
            </p>
          )}

          <form className="od-courier-form" onSubmit={saveDelivery} noValidate>
            <FormGroup id={`courier-${order.id}`} label="Courier name">
              <input
                id={`courier-${order.id}`}
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. Delhivery"
                disabled={!paid || locked || savingDelivery}
              />
            </FormGroup>

            <FormGroup id={`tracking-${order.id}`} label="Tracking number">
              <input
                id={`tracking-${order.id}`}
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Courier tracking number"
                disabled={!paid || locked || savingDelivery}
              />
            </FormGroup>

            <button type="submit" className="od-primary-btn" disabled={!paid || locked || savingDelivery}>
              {savingDelivery ? "Saving…" : "Save delivery"}
            </button>
          </form>

          <ErrorMessage>{deliveryError}</ErrorMessage>
        </section>

        <div className="od-two-col">
          <section className="od-card" aria-labelledby={`od-${order.id}-rx`}>
            <div className="od-card-title-row">
              <FileText size={18} aria-hidden="true" />
              <h3 id={`od-${order.id}-rx`}>Prescription and dispatch notes</h3>
            </div>

            {items.length === 0 && <p className="od-muted">No items recorded for this order.</p>}
            {items.map((item) => (
              <PrescriptionBlock key={item.id ?? `${item.productId}-rx`} item={item} api={api} orderId={order.id} />
            ))}
          </section>

          <section className="od-card" aria-labelledby={`od-${order.id}-notes`}>
            <div className="od-card-title-row">
              <MessageSquare size={18} aria-hidden="true" />
              <h3 id={`od-${order.id}-notes`}>Order notes</h3>
            </div>

            {notes ? (
              <div className="od-note-box">
                <p>{notes}</p>
              </div>
            ) : (
              <div className="od-note-box od-note-empty">
                <MessageSquare size={18} aria-hidden="true" />
                <p>No order notes provided by customer.</p>
              </div>
            )}
          </section>
        </div>

        <div className="od-two-col">
          <section className="od-card" aria-labelledby={`od-${order.id}-status`}>
            <h3 id={`od-${order.id}-status`}>Order status</h3>
            <p className="od-muted">Manage optical workshop &amp; delivery fulfillment phase</p>

            <label htmlFor={`order-status-${order.id}`} className="od-field-label">
              Delivery status
            </label>
            <select
              id={`order-status-${order.id}`}
              className="od-select"
              value={statusDraft}
              disabled={statusBusy}
              onChange={(e) => setStatusDraft(e.target.value)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {dispatchNeedsDetails && (
              <div className="od-warning" role="note">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  Shipping needs payment to be confirmed and the courier and tracking details to be saved before marks
                  as dispatched.
                </span>
              </div>
            )}

            {statusBusy && <small role="status" className="od-muted">Updating…</small>}
            <ErrorMessage>{statusError}</ErrorMessage>

            <div className="od-actions-right">
              <button
                type="button"
                className="od-primary-btn"
                disabled={statusBusy || !statusChanged}
                onClick={() => update(order.id, statusDraft)}
              >
                {statusBusy ? "Updating…" : "Save & Update Status"}
              </button>
            </div>
          </section>

          <section className="od-card" aria-labelledby={`od-${order.id}-link`}>
            <h3 id={`od-${order.id}-link`}>Customer tracking link</h3>
            <p className="od-muted">Shareable tracking URL for real-time customer lens fabrication updates</p>

            {trackingUrl ? (
              <>
                <label htmlFor={`od-link-${order.id}`} className="od-field-label">
                  Public tracking URL
                </label>
                <div className="od-link-box">
                  <input
                    id={`od-link-${order.id}`}
                    type="text"
                    readOnly
                    value={trackingUrl}
                    aria-label="Customer tracking link"
                    onFocus={(e) => e.target.select()}
                  />
                  <button type="button" className="od-copy-btn" onClick={copyTrackingLink}>
                    <Copy size={14} aria-hidden="true" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="od-link-foot">
                  <span className="od-muted">Preview what the customer sees</span>
                  <a className="od-link" href={trackingUrl} target="_blank" rel="noopener noreferrer">
                    Open customer view <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </div>
              </>
            ) : (
              <p className="od-muted">No tracking link is available for this order.</p>
            )}
          </section>
        </div>
      </div>

      <footer className="od-footer">
        <span className="od-footer-meta">
          <Clock size={14} aria-hidden="true" /> Placed {formatDateTime(order.orderDate)}
        </span>
        <div className="od-footer-actions">
          <button type="button" className="od-secondary-btn" onClick={() => window.print()}>
            <Printer size={15} aria-hidden="true" /> Print
          </button>
          <button type="button" className="od-primary-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </footer>
    </Modal>
  );
}

function OrdersPage({ api, orders, pageInfo, loading, loadError, onReload, onLoadMore, onNotice }) {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState(EMPTY_RANGE);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);

  const bulk = useBulkClear({ api, onNotice, onReload });

  const visibleOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        matchesOrderSearch(o, search) &&
        (statusFilter === "ALL" || (o.orderStatus || "PENDING") === statusFilter) &&
        inDateRange(o.orderDate, range.start, range.end)
    );
  }, [orders, search, statusFilter, range]);

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;

  // Close the dialog if its order disappears, for example after clearing orders
  useEffect(() => {
    if (selectedId !== null && !loading && !orders.some((o) => o.id === selectedId)) {
      setSelectedId(null);
    }
  }, [orders, selectedId, loading]);

  const resetFilters = () => {
    setSearch("");
    setRange(EMPTY_RANGE);
    setStatusFilter("ALL");
  };

  const handleClear = () =>
    bulk.clear({
      endpoints: [
  { url: ENDPOINTS.orders, action: "CLEAR_ORDERS" },
],
      warning: "This will permanently delete ALL orders and their order items. This cannot be undone.",
      successMessage: "All orders permanently deleted.",
      fallbackMessage: "Unable to delete orders.",
      onCleared: () => {
        resetFilters();
        setSelectedId(null);
      },
    });

  // Refresh keeps the search and filters the admin has set
  const handleRefresh = async () => {
    await onReload();
  };

  return (
    <section className="admin-content">
      <PageHeading
        title="Orders Management"
        description="Review orders and manage deliveries. Select View details to see the full order."
        action={<RefreshButton onClick={handleRefresh} loading={loading} />}
      />

      <div className="admin-dashboard-actions">
        <DateRangeFilter start={range.start} end={range.end} onChange={setRange} />
        <ClearButton label="Clear Orders" onClick={handleClear} busy={bulk.clearing} />
      </div>

      <div className="admin-product-toolbar">
        <SearchBox
          label="Search orders"
          placeholder="Search order ID, customer or phone…"
          value={search}
          onChange={setSearch}
        />

        <select
          className="admin-filter-select"
          aria-label="Filter orders by delivery status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All delivery statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <span aria-live="polite">
          {visibleOrders.length} shown · {orders.length} loaded of {pageInfo?.totalElements ?? orders.length} orders
        </span>
      </div>

      {loadError && (
        <div className="orders-load-error" role="alert">
          <span>Orders could not be refreshed. {loadError} The list below may be out of date.</span>
          <button type="button" className="admin-secondary-button" onClick={onReload}>
            Try again
          </button>
        </div>
      )}

      <div className="admin-table-card">
        <div className="admin-table-scroll">
          <table className="admin-table admin-order-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Payment</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && <EmptyRow colSpan={7}>Loading orders…</EmptyRow>}

              {!loading &&
                visibleOrders.map((order) => {
                  const paid = isOrderPaid(order);
                  const selected = order.id === selectedId;

                  return (
                    <tr key={order.id} className={selected ? "is-selected" : ""}>
                      <td data-label="Order">
                        <strong className="order-id">#{order.id}</strong>
                        <small className="order-cell-sub">{formatDate(order.orderDate)}</small>
                      </td>

                      <td data-label="Customer">
                        <span className="order-cell-name" title={order.customerName || undefined}>
                          {order.customerName || "-"}
                        </span>
                        {order.phone && <small className="order-cell-sub">{order.phone}</small>}
                      </td>

                      <td data-label="Items">{countUnits(order)}</td>

                      <td data-label="Total" className="order-cell-amount">
                        {formatINR(order.totalAmount, true)}
                      </td>

                      <td data-label="Payment">
                        <span className={`admin-status ${paid ? "available" : "inactive"}`}>
                          {order.paymentStatus || "PENDING"}
                        </span>
                        {order.refundStatus && order.refundStatus !== "NONE" && (
                          <small className="order-cell-sub">Refund: {order.refundStatus}</small>
                        )}
                      </td>

                      <td data-label="Status">
                        <OrderStatusBadge status={order.orderStatus} />
                      </td>

                      <td className="order-cell-action">
                        <button
                          type="button"
                          className="admin-text-button order-view-button"
                          aria-haspopup="dialog"
                          onClick={() => setSelectedId(order.id)}
                          aria-label={`View details for order ${order.id}`}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!loading && loadError && orders.length === 0 && (
                <EmptyRow colSpan={7}>
                  <span role="alert">{loadError}</span>{" "}
                  <button type="button" className="admin-text-button" onClick={onReload}>
                    Try again
                  </button>
                </EmptyRow>
              )}

              {!loading && !loadError && visibleOrders.length === 0 && (
                <EmptyRow colSpan={7}>
                  {orders.length === 0 ? "No orders received yet." : "No matching orders found."}
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!pageInfo?.last && (
        <div className="admin-load-more" style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button
            type="button"
            className="admin-secondary-button"
            disabled={loading}
            onClick={onLoadMore}
          >
            {loading ? "Loading..." : "Load more orders"}
          </button>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsDialog
          key={selectedOrder.id}
          api={api}
          order={selectedOrder}
          onClose={() => setSelectedId(null)}
          onNotice={onNotice}
          onReload={onReload}
        />
      )}

      <ClearDataPopup bulk={bulk} />
    </section>
  );
}

/* =========================
   APPOINTMENTS
========================= */

function AppointmentsPage({ api, appointments, pageInfo, loading, onReload, onLoadMore, onNotice }) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [range, setRange] = useState(EMPTY_RANGE);

  const bulk = useBulkClear({ api, onNotice, onReload });
  const { busyId, error: statusError, update } = useStatusUpdater({
    api,
    baseUrl: ENDPOINTS.appointments,
    label: "Appointment",
    onNotice,
    onReload,
  });

  const counts = useMemo(() => {
    const result = { total: Number(pageInfo?.totalElements ?? appointments.length) };
    APPOINTMENT_STATUSES.forEach((s) => {
      result[s.value] = appointments.filter((a) => a.status === s.value).length;
    });
    return result;
  }, [appointments, pageInfo?.totalElements]);

  const visibleAppointments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return appointments.filter(
      (a) =>
        matchesTerm(term, a.customerName, a.phone, a.email) &&
        (statusFilter === "ALL" || a.status === statusFilter) &&
        inDateRange(a.appointmentDate, range.start, range.end)
    );
  }, [appointments, search, statusFilter, range]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setRange(EMPTY_RANGE);
  };

  const handleClear = () =>
    bulk.clear({
      endpoints: [
  { url: ENDPOINTS.appointments, action: "CLEAR_APPOINTMENTS" },
],
      warning: "This will permanently delete ALL appointment records. This cannot be undone.",
      successMessage: "All appointments permanently deleted.",
      fallbackMessage: "Unable to delete appointments.",
      onCleared: resetFilters,
    });

  const handleRefresh = async () => {
    resetFilters();
    await onReload();
  };

  const cancelAppointment = async (appointment) => {
    const ok = await confirm({
      title: "Cancel appointment",
      message: `Cancel the eye checkup appointment for ${appointment.customerName}?`,
      confirmLabel: "Yes, cancel it",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (ok) update(appointment.id, "CANCELLED");
  };

  return (
    <section className="admin-content">
      <PageHeading
        title="Eye Checkup Appointments"
        description="Manage customer eye checkup bookings."
        action={<RefreshButton onClick={handleRefresh} loading={loading} />}
      />

      <ErrorMessage>{statusError}</ErrorMessage>

      <div className="admin-stats-grid">
        <StatCard label="Total Appointments" value={counts.total} />
        {APPOINTMENT_STATUSES.map((s) => (
          <StatCard key={s.value} label={`${s.label} (loaded)`} value={counts[s.value]} />
        ))}
      </div>

      <div className="admin-dashboard-actions">
        <DateRangeFilter start={range.start} end={range.end} onChange={setRange} />
        <ClearButton label="Clear Appointments" onClick={handleClear} busy={bulk.clearing} />
      </div>

      <div className="admin-product-toolbar">
        <SearchBox
          label="Search appointments"
          placeholder="Search by customer name or phone..."
          value={search}
          onChange={setSearch}
        />

        <select
          className="admin-filter-select"
          aria-label="Filter appointments by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <span aria-live="polite">{visibleAppointments.length} shown · {appointments.length} loaded of {pageInfo?.totalElements ?? appointments.length}</span>
      </div>

      {loading ? (
        <p className="admin-loading">Loading appointments...</p>
      ) : visibleAppointments.length === 0 ? (
        <div className="admin-placeholder">
          <CalendarDays size={35} aria-hidden="true" />
          <h3>No appointments found</h3>
          <p>Customer bookings will appear here.</p>
        </div>
      ) : (
        <div className="admin-orders-list">
          {visibleAppointments.map((appointment) => {
            const busy = busyId === appointment.id;
            const cancelled = appointment.status === "CANCELLED";

            return (
              <article className="admin-order-card" key={appointment.id}>
                <div className="admin-order-header">
                  <div>
                    <h3>{appointment.customerName}</h3>
                    <span>Appointment #{appointment.id}</span>
                  </div>

                  <span className="admin-status-badge" data-status={appointment.status}>
                    {appointment.status}
                  </span>
                </div>

                <div className="admin-order-details">
                  <div>
                    <h4>Customer Details</h4>
                    <p>
                      <strong>Phone:</strong> {appointment.phone}
                    </p>
                    <p>
                      <strong>Email:</strong> {appointment.email || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <h4>Appointment Details</h4>
                    <p>
                      <strong>Date:</strong> {appointment.appointmentDate}
                    </p>
                    <p>
                      <strong>Time:</strong> {appointment.appointmentTime}
                    </p>
                  </div>
                </div>

                <div className="admin-order-footer">
                  <div>
                    <label htmlFor={`appointment-status-${appointment.id}`}>Update Status</label>

                    <select
                      id={`appointment-status-${appointment.id}`}
                      value={appointment.status}
                      disabled={busy}
                      onChange={(e) => update(appointment.id, e.target.value)}
                    >
                      {APPOINTMENT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    {busy && <small role="status">Updating...</small>}
                  </div>

                  <button
                    type="button"
                    className="admin-appointment-cancel"
                    disabled={cancelled || busy}
                    onClick={() => cancelAppointment(appointment)}
                  >
                    <X size={16} aria-hidden="true" />
                    Cancel Appointment
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!pageInfo?.last && (
        <div className="admin-load-more">
          <button
            type="button"
            className="admin-secondary-button"
            disabled={loading}
            onClick={onLoadMore}
          >
            {loading ? "Loading..." : "Load more appointments"}
          </button>
        </div>
      )}

      <ClearDataPopup bulk={bulk} />
    </section>
  );
}

/* =========================
   CUSTOMERS
========================= */

function CustomersPage({ api, customers, pageInfo, loading, onReload, onLoadMore }) {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyPageInfo, setHistoryPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, last: true });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const selected = useMemo(
    () => customers.find((c) => (c.id ?? customerKey(c)) === selectedKey) ?? null,
    [customers, selectedKey]
  );

  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((c) => matchesTerm(term, c.customerName, c.email, c.phone));
  }, [customers, search]);

  useEffect(() => {
    if (!selected?.id) {
      setHistoryOrders([]);
      setHistoryPageInfo({ number: 0, totalPages: 0, totalElements: 0, last: true });
      setHistoryError("");
      return undefined;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    api.getJson(`${ENDPOINTS.customers}/${selected.id}/history`, "Unable to load customer purchase history")
      .then((data) => {
        if (!active || !data) return;
        const rows = Array.isArray(data.history) ? data.history : [];
        setHistoryOrders(rows);
        setHistoryPageInfo({ number: 0, totalPages: 1, totalElements: rows.length, last: true });
      })
      .catch((err) => { if (active) setHistoryError(err.message || "Unable to load customer purchase history"); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [api, selected?.id, selectedKey]);


  const loadMoreHistory = async () => {
    if (!selected || historyLoading || historyPageInfo.last) return;
    const nextPage = historyPageInfo.number + 1;
    const params = new URLSearchParams({ page: String(nextPage), size: "25" });
    if (selected.email?.trim()) params.set("email", selected.email.trim());
    else if (selected.phone?.trim()) params.set("phone", selected.phone.trim());

    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await api.getJson(`${ENDPOINTS.customers}/history?${params.toString()}`, "Unable to load more customer orders");
      if (!data) return;
      setHistoryOrders((previous) => [
        ...previous,
        ...(Array.isArray(data.content) ? data.content.filter((order) => !previous.some((existing) => existing.id === order.id)) : []),
      ]);
      setHistoryPageInfo({
        number: Number(data.number || nextPage),
        totalPages: Number(data.totalPages || 0),
        totalElements: Number(data.totalElements || 0),
        last: Boolean(data.last),
      });
    } catch (err) {
      setHistoryError(err.message || "Unable to load more customer orders");
    } finally {
      setHistoryLoading(false);
    }
  };

  const totals = useMemo(
    () => ({
      orders: customers.reduce((sum, c) => sum + Number(c.totalOrders || 0), 0),
      spent: customers.reduce((sum, c) => sum + Number(c.totalSpent || 0), 0),
    }),
    [customers]
  );

  return (
    <section className="admin-content">
      <PageHeading
        title="Customer Accounts"
        description="One customer profile for online orders and in-store POS purchases."
        action={<RefreshButton onClick={onReload} loading={loading} />}
      />

      <div className="admin-stats-grid">
        <StatCard label="Total Customers" value={pageInfo?.totalElements ?? customers.length} />
        <StatCard label="Loaded Customer Orders" value={totals.orders} />
        <StatCard label="Loaded Customer Spending" value={formatINR(totals.spent, true)} />
      </div>

      <div className="admin-product-toolbar">
        <SearchBox
          label="Search customers"
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={setSearch}
        />
        <span aria-live="polite">
          {visibleCustomers.length} shown · {customers.length} loaded of {pageInfo?.totalElements ?? customers.length} customers
        </span>
      </div>

      {loading ? (
        <p className="admin-loading">Loading customers...</p>
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Online</th>
                  <th scope="col">In-store</th>
                  <th scope="col">Total Spent</th>
                </tr>
              </thead>

              <tbody>
                {visibleCustomers.map((customer) => {
                  const key = customer.id ?? customerKey(customer);
                  const isSelected = key === selectedKey;

                  return (
                    <tr
                      key={key || customer.customerName}
                      className={isSelected ? "customer-row selected" : "customer-row"}
                    >
                      <td>
                        <button
                          type="button"
                          className="admin-row-select"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedKey(key)}
                        >
                          {customer.customerName || "-"}
                        </button>
                      </td>
                      <td>{customer.email || "-"}</td>
                      <td>{customer.phone || "-"}</td>
                      <td>{customer.onlineOrders || 0}</td>
                      <td>{customer.inStoreSales || 0}</td>
                      <td>{formatINR(customer.totalSpent, true)}</td>
                    </tr>
                  );
                })}

                {visibleCustomers.length === 0 && (
                  <EmptyRow colSpan={6}>
                    {customers.length === 0 ? "No customers found." : "No matching customers found."}
                  </EmptyRow>
                )}
              </tbody>
            </table>
          </div>

          {!pageInfo?.last && (
            <div className="admin-load-more" style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button type="button" className="admin-secondary-button" disabled={loading} onClick={onLoadMore}>
                {loading ? "Loading..." : "Load more customers"}
              </button>
            </div>
          )}

          {selected && (
            <div className="customer-history">
              <div className="admin-section-header">
                <div>
                  <h2>{selected.customerName}</h2>
                  <p>{selected.email || "No email"}</p>
                  <p>{selected.phone || "No phone"} · {selected.channel === "BOTH" ? "Online + In-store" : selected.channel === "ONLINE" ? "Online" : "In-store"}</p>
                </div>

                <button type="button" className="admin-secondary-button" onClick={() => setSelectedKey(null)}>
                  <X size={16} aria-hidden="true" />
                  Close
                </button>
              </div>

              <h3>Purchase History</h3>
              <p className="admin-help-text">
                {historyOrders.length} purchases across online and in-store channels.
              </p>

              {historyLoading && historyOrders.length === 0 ? (
                <p className="admin-loading">Loading customer order history...</p>
              ) : historyError && historyOrders.length === 0 ? (
                <p className="admin-error" role="alert">{historyError}</p>
              ) : historyOrders.length === 0 ? (
                <p>No purchases found for this customer.</p>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Reference</th>
                        <th scope="col">Date</th>
                        <th scope="col">Channel</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {historyOrders.map((order) => (
                        <tr key={order.id}>
                          <td>{order.reference}</td>
                          <td>{formatDate(order.date)}</td>
                          <td>{order.channel === "IN_STORE" ? "In-store POS" : "Online"}</td>
                          <td>{formatINR(order.total, true)}</td>
                          <td>{order.status || order.paymentStatus || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {historyError && historyOrders.length > 0 && (
                <p className="admin-error" role="alert">{historyError}</p>
              )}

              {!historyPageInfo.last && (
                <div className="admin-load-more" style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                  <button type="button" className="admin-secondary-button" disabled={historyLoading} onClick={loadMoreHistory}>
                    {historyLoading ? "Loading..." : "Load more customer orders"}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* =========================
   MARKETING
========================= */

function BannerModal({ api, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial.data);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isEdit = Boolean(initial.id);
  const handleChange = handleFieldChange(setForm);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const problem = getImageFileError(file);
    if (problem) {
      setError(problem);
      return;
    }

    setError("");
    setUploading(true);

    try {
      const imageUrl = await uploadToCloudinary(file, "nmk-marketing");
      setForm((prev) => ({ ...prev, imageUrl }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const problem = validateBanner(form);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const saved = await api.saveRecord({
        url: isEdit ? `${ENDPOINTS.banners}/${initial.id}` : ENDPOINTS.banners,
        method: isEdit ? "PUT" : "POST",
        payload: {
          title: form.title.trim(),
          imageUrl: form.imageUrl.trim(),
          targetUrl: form.targetUrl.trim(),
          placement: form.placement,
          displayOrder: Number(form.displayOrder),
          active: form.active,
        },
        fallbackMessage: "Unable to save banner",
      });

      if (saved) onSaved(isEdit ? "Banner updated." : "Banner added.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;
  const previewReady = Boolean(form.imageUrl) && isValidHttpUrl(form.imageUrl);

  return (
    <Modal title={isEdit ? "Edit Banner" : "Add Banner"} onClose={onClose} closable={!busy} {...MARKETING_MODAL}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="banner-title">Banner Title *</label>
          <input id="banner-title" type="text" name="title" value={form.title} onChange={handleChange} placeholder="Enter banner title" required />
        </div>

        <div className="form-group">
          <label htmlFor="banner-image">Image URL *</label>
          <input id="banner-image" type="url" name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="https://example.com/banner.jpg" required />
        </div>

        <div className="form-group">
          <label htmlFor="banner-upload">Or upload from your computer</label>
          <input id="banner-upload" type="file" accept={IMAGE_ACCEPT} onChange={handleUpload} disabled={busy} />
          <small role="status">{uploading ? "Uploading..." : "JPG, PNG or WEBP. Maximum 5 MB."}</small>
        </div>

        {previewReady && (
          <div className="form-group">
            <span className="admin-field-label">Preview</span>
            <img src={form.imageUrl} alt="Banner preview" className="admin-banner-preview" />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="banner-target">Destination</label>
          <input id="banner-target" type="text" name="targetUrl" value={form.targetUrl} onChange={handleChange} placeholder="/products or https://example.com" />
        </div>

        <div className="form-group">
          <label htmlFor="banner-placement">Display Placement</label>
          <select id="banner-placement" name="placement" value={form.placement} onChange={handleChange}>
            {BANNER_PLACEMENTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="banner-order">Display Order</label>
          <input id="banner-order" type="number" name="displayOrder" min="0" step="1" value={form.displayOrder} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label className="admin-checkbox-label">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            Active
          </label>
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            {saving ? "Saving..." : isEdit ? "Update Banner" : "Save Banner"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Trims ISO timestamps to the "YYYY-MM-DDTHH:mm" form that datetime-local inputs use
const toLocalInput = (value) => (value ? String(value).slice(0, 16) : "");

function OfferModal({ api, existing, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    existing
      ? {
          message: existing.message || "",
          backgroundColor: existing.backgroundColor || EMPTY_OFFER.backgroundColor,
          textColor: existing.textColor || EMPTY_OFFER.textColor,
          targetUrl: existing.targetUrl || "",
          startDateTime: existing.startDateTime || "",
          endDateTime: existing.endDateTime || "",
          active: existing.active ?? true,
        }
      : EMPTY_OFFER
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const handleChange = handleFieldChange(setForm);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const problem = validateOffer(form);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const saved = await api.saveRecord({
        url: existing ? `${ENDPOINTS.offers}/${existing.id}` : ENDPOINTS.offers,
        method: existing ? "PUT" : "POST",
        payload: {
          message: form.message.trim(),
          backgroundColor: form.backgroundColor,
          textColor: form.textColor,
          targetUrl: form.targetUrl.trim(),
          startDateTime: form.startDateTime || null,
          endDateTime: form.endDateTime || null,
          active: form.active,
        },
        fallbackMessage: "Unable to save offer",
      });

      if (saved) onSaved("Offer bar saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={existing ? "Edit Offer Bar" : "Create Offer Bar"} onClose={onClose} closable={!saving} {...MARKETING_MODAL}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="offer-message">Offer Message *</label>
          <input id="offer-message" type="text" name="message" value={form.message} onChange={handleChange} placeholder="Example: Get 20% off on sunglasses!" required />
        </div>

        <div className="form-group">
          <label htmlFor="offer-bg">Background Colour</label>
          <input id="offer-bg" type="color" name="backgroundColor" value={form.backgroundColor} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label htmlFor="offer-text">Text Colour</label>
          <input id="offer-text" type="color" name="textColor" value={form.textColor} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label htmlFor="offer-target">Destination</label>
          <input id="offer-target" type="text" name="targetUrl" value={form.targetUrl} onChange={handleChange} placeholder="/products" />
        </div>

        <div className="form-group">
          <label htmlFor="offer-start">Start Date and Time</label>
          <input id="offer-start" type="datetime-local" name="startDateTime" value={toLocalInput(form.startDateTime)} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label htmlFor="offer-end">End Date and Time</label>
          <input id="offer-end" type="datetime-local" name="endDateTime" value={toLocalInput(form.endDateTime)} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label className="admin-checkbox-label">
            <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
            Enable Offer Bar
          </label>
        </div>

        <div className="admin-offer-preview" style={{ background: form.backgroundColor, color: form.textColor }}>
          {form.message || "Your offer preview will appear here"}
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Offer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Single-image slots on the customer website. Each one is saved under its own image key,
// and the customer site reads the same keys (HERO, LOGO, STORE).
const HERO_IMAGE_SLOT = {
  imageKey: "HERO",
  title: "Homepage Hero Image",
  heading: "Homepage Hero Image",
  description: "The large picture shown beside the headline at the top of the customer website home page.",
  noun: "hero image",
  urlLabel: "Hero Image URL",
  uploadLabel: "Or Upload Hero Image",
  hint: "Use a bright, wide photo, at least 1200 px wide. JPG, PNG or WEBP, maximum 5 MB.",
  updateLabel: "Update Hero Image",
  removeLabel: "Remove Hero Image",
  updatedNotice: "Homepage hero image updated successfully.",
  removedNotice: "Custom hero image removed. The default image is shown on the website.",
  removeMessage: "Remove the custom hero image? The default hero image will be shown instead.",
};

const LOGO_IMAGE_SLOT = {
  imageKey: "LOGO",
  title: "Website Logo",
  heading: "Customer Website Logo",
  description: "Change the logo displayed in the customer website header.",
  noun: "logo",
  urlLabel: "Logo Image URL",
  uploadLabel: "Or Upload Logo",
  hint: "JPG, PNG or WEBP, maximum 5 MB.",
  updateLabel: "Update Logo",
  removeLabel: "Remove Logo",
  updatedNotice: "Website logo updated successfully.",
  removedNotice: "Custom logo removed.",
  removeMessage: "Remove the custom website logo? The store name will be shown instead.",
};

const STORE_IMAGE_SLOT = {
  imageKey: "STORE",
  title: "Store Image",
  heading: "Our Store Image",
  description: "Change the showroom image displayed in the customer website.",
  noun: "store image",
  urlLabel: "Store Image URL",
  uploadLabel: "Or Upload Store Image",
  hint: "JPG, PNG or WEBP, maximum 5 MB.",
  updateLabel: "Update Store Image",
  removeLabel: "Remove Store Image",
  updatedNotice: "Store image updated successfully.",
  removedNotice: "Custom store image removed. The default image is shown on the website.",
  removeMessage: "Remove the custom store image? The default store image will be shown instead.",
};

// One editor for every single-image slot: shows the saved image, previews a new one before
// saving, accepts a URL or an uploaded file, and can go back to the website's default image.
function SingleImageEditor({ api, images, loading, onReload, onNotice, slot }) {
  const confirm = useConfirm();
  const saved = images.find((image) => image.imageKey === slot.imageKey);
  const savedUrl = saved?.imageUrl || "";
  const fieldId = `website-image-${slot.imageKey.toLowerCase()}`;

  const [imageUrl, setImageUrl] = useState(savedUrl);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Keep the URL box in sync when the saved image changes
  useEffect(() => {
    setImageUrl(savedUrl);
  }, [savedUrl]);

  // Local preview of a chosen file, released when it is replaced or cleared
  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const trimmed = imageUrl.trim();
  const pendingUrl = filePreview || (isValidHttpUrl(trimmed) && trimmed !== savedUrl ? trimmed : "");
  const previewSrc = pendingUrl || savedUrl;
  const canSave = Boolean(file) || (trimmed !== "" && trimmed !== savedUrl);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    const problem = getImageFileError(selected);
    if (problem) return setError(problem);

    setFile(selected);
    setError("");
  };

  const handleSave = async () => {
    setError("");

    if (!file && !trimmed) return setError(`Choose a ${slot.noun} or enter an image URL.`);
    if (!file && !isValidHttpUrl(trimmed)) return setError("Enter a valid image URL.");

    setSaving(true);

    try {
      const finalUrl = file ? await uploadToCloudinary(file, "nmk-website") : trimmed;
      const done = await saveWebsiteImage(api, slot.imageKey, slot.title, finalUrl, `Failed to update ${slot.noun}`);

      if (done) {
        setFile(null);
        onNotice(slot.updatedNotice);
        await onReload();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: `Remove ${slot.noun}`,
      message: slot.removeMessage,
      confirmLabel: "Yes, remove",
      danger: true,
    });
    if (!ok) return;

    setError("");
    setSaving(true);

    try {
      const done = await saveWebsiteImage(api, slot.imageKey, slot.title, "", `Failed to remove ${slot.noun}`);

      if (done) {
        setImageUrl("");
        setFile(null);
        onNotice(slot.removedNotice);
        await onReload();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-table-card logo-editor">
      <div className="admin-table-heading">
        <div>
          <h3>{slot.heading}</h3>
          <p>{slot.description}</p>
        </div>
      </div>

      {loading && !saved ? (
        <div className="admin-empty">Loading {slot.noun}...</div>
      ) : (
        <div className="logo-editor-content">
          {previewSrc && (
            <div className="form-group">
              <span className="admin-field-label">{pendingUrl ? "Preview (not saved yet)" : "Current image"}</span>
              <div className="logo-preview">
                <img src={previewSrc} alt={`${slot.heading} preview`} style={{ maxWidth: "100%" }} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor={`${fieldId}-url`}>{slot.urlLabel}</label>
            <input
              id={`${fieldId}-url`}
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setFile(null);
                setError("");
              }}
              placeholder="https://example.com/image.jpg"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${fieldId}-file`}>{slot.uploadLabel}</label>
            <input
              id={`${fieldId}-file`}
              type="file"
              accept={IMAGE_ACCEPT}
              disabled={saving}
              onChange={handleFileChange}
            />
            <small>{file ? `Selected: ${file.name}` : slot.hint}</small>
          </div>

          <ErrorMessage>{error}</ErrorMessage>

          <div className="logo-editor-actions">
            <button
              type="button"
              className="admin-primary-button"
              onClick={handleSave}
              disabled={saving || !canSave}
            >
              {saving ? "Saving..." : slot.updateLabel}
            </button>

            <button
              type="button"
              className="admin-secondary-button"
              onClick={handleRemove}
              disabled={saving || !savedUrl}
            >
              {slot.removeLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketingPage({ api, banners, offer, loading, onReload, onNotice, images, imagesLoading, onReloadImages }) {
  const confirm = useConfirm();
  const [bannerModal, setBannerModal] = useState(null); // null | { id, data }
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [pageError, setPageError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [activeTab, setActiveTab] = useState("brand");

  const openAddBanner = () => setBannerModal({ id: null, data: EMPTY_BANNER });

  const openEditBanner = (banner) =>
    setBannerModal({
      id: banner.id,
      data: {
        title: banner.title || "",
        imageUrl: banner.imageUrl || "",
        targetUrl: banner.targetUrl || "",
        placement: banner.placement || "HOME",
        displayOrder: banner.displayOrder ?? 0,
        active: banner.active ?? true,
      },
    });

  const deleteBanner = async (banner) => {
    const ok = await confirm({
      title: "Delete banner",
      message: `Delete the banner "${banner.title}"? This cannot be undone.`,
      confirmLabel: "Yes, delete",
      danger: true,
    });
    if (!ok) return;

    setPageError("");
    setDeletingId(banner.id);

    try {
      const deleted = await api.deleteRecord(`${ENDPOINTS.banners}/${banner.id}`, "Failed to delete banner");
      if (deleted) {
        onNotice("Banner deleted.");
        await onReload();
      }
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBannerSaved = async (message) => {
    setBannerModal(null);
    onNotice(message);
    await onReload();
  };

  const handleOfferSaved = async (message) => {
    setOfferModalOpen(false);
    onNotice(message);
    await onReload();
  };

  // Everything on this page comes from two sources: marketing data and website images
  const refreshAll = () => Promise.all([onReload(), onReloadImages()]);
  const imageProps = { api, images, loading: imagesLoading, onReload: onReloadImages, onNotice };

  
return (
  <section className="admin-content">
    <PageHeading
      title="Marketing Management"
      description="Manage your website branding, category images, banners and promotional offers."
      action={
        <RefreshButton
          onClick={refreshAll}
          loading={loading || imagesLoading}
        />
      }
    />

    <ErrorMessage>{pageError}</ErrorMessage>

    {/* MARKETING TABS */}
    <div className="marketing-tabs" role="tablist" aria-label="Marketing sections">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "brand"}
        className={`marketing-tab ${activeTab === "brand" ? "active" : ""}`}
        onClick={() => setActiveTab("brand")}
      >
        Brand Assets
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "categories"}
        className={`marketing-tab ${activeTab === "categories" ? "active" : ""}`}
        onClick={() => setActiveTab("categories")}
      >
        Category Images
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "banners"}
        className={`marketing-tab ${activeTab === "banners" ? "active" : ""}`}
        onClick={() => setActiveTab("banners")}
      >
        Marketing Banners
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "offer"}
        className={`marketing-tab ${activeTab === "offer" ? "active" : ""}`}
        onClick={() => setActiveTab("offer")}
      >
        Promotional Offer
      </button>
    </div>

    {/* BRAND ASSETS */}
    {activeTab === "brand" && (
      <div className="marketing-tab-content">
        <div className="admin-table-heading">
          <div>
            <h3>Brand Assets</h3>
            <p>Manage your logo, store image and homepage hero image.</p>
          </div>
        </div>

        <div className="marketing-image-row">
          <SingleImageEditor {...imageProps} slot={LOGO_IMAGE_SLOT} />
          <SingleImageEditor {...imageProps} slot={STORE_IMAGE_SLOT} />
          <SingleImageEditor {...imageProps} slot={HERO_IMAGE_SLOT} />
        </div>
      </div>
    )}

    {/* CATEGORY IMAGES */}
    {activeTab === "categories" && (
      <div className="admin-table-card category-images-card">
        <div className="admin-table-heading">
          <div>
            <h3>Shop by Category Images</h3>
            <p>
              Manage images for Eyeglasses, Sunglasses, Power Sunglasses,
              Computer Glasses, Contact Lenses and Accessories.
            </p>
          </div>
        </div>

        <div className="category-images-body">
          <CategoryImagesEditor {...imageProps} />
        </div>
      </div>
    )}

    {/* MARKETING BANNERS */}
    {activeTab === "banners" && (
      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Website Marketing Banners</h3>
            <span>{banners.length} banners</span>
          </div>

          <button
            type="button"
            className="admin-primary-button"
            onClick={openAddBanner}
          >
            <Plus size={17} aria-hidden="true" />
            Add Banner
          </button>
        </div>

        {loading ? (
          <div className="admin-empty">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="admin-empty">No marketing banners added yet.</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Preview</th>
                  <th scope="col">Title</th>
                  <th scope="col">Placement</th>
                  <th scope="col">Order</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {banners.map((banner) => {
                  const busy = deletingId === banner.id;

                  return (
                    <tr key={banner.id}>
                      <td>
                        <img
                          src={banner.imageUrl}
                          alt=""
                          className="admin-banner-thumb"
                        />
                      </td>
                      <td>{banner.title}</td>
                      <td>
                        {BANNER_PLACEMENTS.find(
                          (p) => p.value === banner.placement
                        )?.label ?? banner.placement}
                      </td>
                      <td>{banner.displayOrder}</td>
                      <td>
                        <StatusBadge active={banner.active} />
                      </td>
                      <td>
                        <div className="admin-action-buttons">
                          <button
                            type="button"
                            className="admin-edit-button"
                            title="Edit banner"
                            aria-label={`Edit banner ${banner.title}`}
                            onClick={() => openEditBanner(banner)}
                            disabled={busy}
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            className="admin-delete-button"
                            title="Delete banner"
                            aria-label={`Delete banner ${banner.title}`}
                            onClick={() => deleteBanner(banner)}
                            disabled={busy}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}

    {/* PROMOTIONAL OFFER */}
    {activeTab === "offer" && (
      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Promotional Offer Bar</h3>
            <p>The promotional message displayed across the top of your website.</p>
          </div>
        </div>

        {offer ? (
          <div className="admin-offer-summary">
            <div
              className="admin-offer-preview"
              style={{
                background: offer.backgroundColor || EMPTY_OFFER.backgroundColor,
                color: offer.textColor || EMPTY_OFFER.textColor,
              }}
            >
              {offer.message}
            </div>

            <p>
              <strong>Status:</strong> {offer.active ? "Active" : "Inactive"}
            </p>
            <p>
              <strong>Start:</strong>{" "}
              {offer.startDateTime
                ? formatDateTime(offer.startDateTime)
                : "Not specified"}
            </p>
            <p>
              <strong>End:</strong>{" "}
              {offer.endDateTime
                ? formatDateTime(offer.endDateTime)
                : "Not specified"}
            </p>
          </div>
        ) : (
          <div className="admin-empty">
            No promotional offer configured.
          </div>
        )}

        <div className="admin-offer-footer">
          <button
            type="button"
            className="admin-primary-button"
            onClick={() => setOfferModalOpen(true)}
          >
            <Pencil size={16} aria-hidden="true" />
            {offer ? "Edit Offer" : "Create Offer"}
          </button>
        </div>
      </div>
    )}

    {bannerModal && (
      <BannerModal
        api={api}
        initial={bannerModal}
        onClose={() => setBannerModal(null)}
        onSaved={handleBannerSaved}
      />
    )}

    {offerModalOpen && (
      <OfferModal
        api={api}
        existing={offer}
        onClose={() => setOfferModalOpen(false)}
        onSaved={handleOfferSaved}
      />
    )}
  </section>
);

}

/* =========================
   CATEGORY IMAGES
   The "Shop by Category" pictures. They are edited from the Marketing page.
========================= */

// Category image slots, in the order shown on the customer site
const CATEGORY_IMAGE_SLOTS = [
  { imageKey: "CATEGORY_EYEGLASSES", title: "Eyeglasses" },
  { imageKey: "CATEGORY_SUNGLASSES", title: "Sunglasses" },
  { imageKey: "CATEGORY_POWER_SUNGLASSES", title: "Power Sunglasses" },
  { imageKey: "CATEGORY_COMPUTER_GLASSES", title: "Computer Glasses" },
  { imageKey: "CATEGORY_CONTACT_LENSES", title: "Contact Lenses" },
  { imageKey: "CATEGORY_ACCESSORIES", title: "Accessories" },
];

function CategoryImagesEditor({ api, images, loading, onReload, onNotice }) {
  const confirm = useConfirm();
  const [removingKey, setRemovingKey] = useState("");
  // Only one image can be edited at a time:
  // { imageKey, mode: "url" | "file", url, file, previewUrl, error, saving }
  const [edit, setEdit] = useState(null);
  const previewUrl = edit?.previewUrl;

  // Every category is listed in store order, including ones without a custom image yet
  const slots = CATEGORY_IMAGE_SLOTS.map(
    (slot) => images.find((image) => image.imageKey === slot.imageKey) ?? { ...slot, imageUrl: "" }
  );

  // Release the object URL when it is replaced, the editor closes, or the page unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openEditor = (image) =>
    setEdit({ imageKey: image.imageKey, mode: "url", url: "", file: null, previewUrl: "", error: "", saving: false });

  const closeEditor = () => setEdit(null);

  // Ignores updates after the editor has closed
  const updateEdit = (changes) => setEdit((prev) => (prev ? { ...prev, ...changes } : prev));

  const switchMode = (mode) => updateEdit({ mode, error: "", file: null, previewUrl: "" });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const problem = getImageFileError(file);
    if (problem) return updateEdit({ error: problem });

    updateEdit({ file, previewUrl: URL.createObjectURL(file), error: "" });
  };

  const removeImage = async (image) => {
    const ok = await confirm({
      title: "Remove category image",
      message: `Remove the uploaded image for ${image.title}? The category image area will be left blank on the website.`,
      confirmLabel: "Remove image",
      danger: true,
    });
    if (!ok) return;

    setRemovingKey(image.imageKey);
    try {
      const done = await saveWebsiteImage(
        api,
        image.imageKey,
        image.title,
        "",
        `Failed to remove ${image.title} image`
      );
      if (done) {
        onNotice(`${image.title} image removed. The website image area is now blank.`);
        await onReload();
      }
    } catch (err) {
      onNotice(err.message || `Failed to remove ${image.title} image.`);
    } finally {
      setRemovingKey("");
    }
  };

  const save = async (image) => {
    const current = edit;
    if (!current) return;

    updateEdit({ saving: true, error: "" });

    try {
      let imageUrl;

      if (current.mode === "file") {
        if (!current.file) throw new Error("Please choose an image file.");
        imageUrl = await uploadToCloudinary(current.file, "nmk-website");
      } else {
        imageUrl = current.url.trim();
        if (!imageUrl) throw new Error("Please enter an image URL.");
        if (!isValidHttpUrl(imageUrl)) throw new Error("Please enter a valid image URL.");
      }

      const done = await saveWebsiteImage(api, image.imageKey, image.title, imageUrl, "Failed to save category image");

      if (!done) return updateEdit({ saving: false });

      closeEditor();
      onNotice(`${image.title} image updated.`);
      await onReload();
    } catch (err) {
      updateEdit({ saving: false, error: err.message });
    }
  };

  if (loading && images.length === 0) {
    return <p className="wi-message">Loading category images...</p>;
  }

  return (
    <div className="wi-grid">
      {slots.map((image) => {
        const isEditing = edit?.imageKey === image.imageKey;
        const previewSrc = isEditing ? getPreviewSrc(edit, image.imageUrl) : image.imageUrl;

        return (
          <div className="wi-card" key={image.id ?? image.imageKey}>
            {previewSrc ? (
              <img className="wi-image" src={previewSrc} alt={`${image.title} category`} />
            ) : (
              <div
                className="wi-image"
                role="img"
                aria-label={`${image.title}: no uploaded image`}
                style={{
                  display: "grid",
                  placeItems: "center",
                  padding: "12px",
                  textAlign: "center",
                  fontSize: "13px",
                  color: "#6b7280",
                  background: "#f3f4f6",
                }}
              >
                No image uploaded. This area will stay blank on the website.
              </div>
            )}

            <h3 className="wi-title">{image.title}</h3>

            {!isEditing && (
              <div className="wi-category-image-actions">
                <button type="button" className="wi-edit-button" onClick={() => openEditor(image)} disabled={Boolean(edit) || Boolean(removingKey)}>
                  <Pencil size={16} aria-hidden="true" />
                  Edit
                </button>
                {image.imageUrl && (
                  <button
                    type="button"
                    className="wi-edit-button wi-remove-button"
                    onClick={() => removeImage(image)}
                    disabled={Boolean(edit) || Boolean(removingKey)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {removingKey === image.imageKey ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            )}

            {isEditing && (
              <div className="wi-edit-panel">
                <div className="wi-edit-header">
                  <span>Edit image</span>
                  <button
                    type="button"
                    className="wi-close"
                    onClick={closeEditor}
                    disabled={edit.saving}
                    aria-label="Close editor"
                    title="Close"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="wi-tabs" role="group" aria-label="Image source">
                  {WEBSITE_IMAGE_MODES.map((tab) => (
                    <button
                      key={tab.mode}
                      type="button"
                      className={`wi-tab ${edit.mode === tab.mode ? "active" : ""}`}
                      onClick={() => switchMode(tab.mode)}
                      disabled={edit.saving}
                      aria-pressed={edit.mode === tab.mode}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {edit.mode === "url" ? (
                  <input
                    className="wi-input"
                    type="url"
                    aria-label="Image URL"
                    placeholder="https://example.com/image.jpg"
                    value={edit.url}
                    onChange={(e) => updateEdit({ url: e.target.value, error: "" })}
                    disabled={edit.saving}
                  />
                ) : (
                  <div className="wi-file-row">
                    <input
                      type="file"
                      aria-label="Image file"
                      accept={IMAGE_ACCEPT}
                      onChange={handleFileChange}
                      disabled={edit.saving}
                    />
                    {edit.file && <small>{edit.file.name}</small>}
                  </div>
                )}

                {edit.error && (
                  <p className="wi-error" role="alert">
                    {edit.error}
                  </p>
                )}

                <div className="wi-actions">
                  <button type="button" className="wi-cancel" onClick={closeEditor} disabled={edit.saving}>
                    Cancel
                  </button>

                  <button type="button" className="wi-save" onClick={() => save(image)} disabled={edit.saving}>
                    {edit.saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   SETTINGS
========================= */

function SettingsPage({ prefs, onSavePrefs, onResetPrefs, products, orders, appointments, username, onLogout, onNotice }) {
  const confirm = useConfirm();
  // Edits stay in a draft until "Save changes" is clicked
  const [draft, setDraft] = useState(prefs);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setDraft(prefs);
  }, [prefs]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs);
  const dataSources = { products, orders, appointments };

  const updateDraft = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const saveSettings = () => {
    const problem = validatePrefs(draft);
    if (problem) {
      setFormError(problem);
      return;
    }

    setFormError("");
    onSavePrefs(sanitizePrefs(draft));
    onNotice("Settings saved.");
  };

  const discardChanges = () => {
    setDraft(prefs);
    setFormError("");
  };

  const resetSettings = async () => {
    const ok = await confirm({
      title: "Reset settings",
      message: "Reset all settings on this page to their default values?",
      confirmLabel: "Yes, reset",
      danger: true,
    });
    if (!ok) return;

    onResetPrefs();
    setFormError("");
    onNotice("Settings reset to default.");
  };

  const exportData = (target) => {
    const rows = (dataSources[target.source] || []).map(target.map);

    if (!downloadCsv(target.filename, rows)) {
      onNotice(`No ${target.source} to export.`);
      return;
    }

    onNotice(`${rows.length} ${target.source} exported.`);
  };

  return (
    <section className="admin-content">
      <PageHeading
        title="Settings"
        description="Customise the admin panel. Preferences are saved in this browser."
        action={
          <div className="admin-dashboard-actions">
            <button type="button" className="admin-secondary-button" onClick={discardChanges} disabled={!dirty}>
              Discard
            </button>
            <button type="button" className="admin-primary-button" onClick={saveSettings} disabled={!dirty}>
              Save changes
            </button>
          </div>
        }
      />

      <ErrorMessage>{formError}</ErrorMessage>

      <div className="admin-table-card settings-preference-card">
        <div className="admin-table-heading">
          <div>
            <h3>Inventory</h3>
            <p>Control how low stock and product lists behave.</p>
          </div>
        </div>

        <div className="admin-form-grid settings-grid">
          <FormGroup id="set-threshold" label="Low stock alert (units)">
            <input
              id="set-threshold"
              type="number"
              min="1"
              max="500"
              step="1"
              value={draft.lowStockThreshold}
              onChange={(e) => updateDraft("lowStockThreshold", e.target.value)}
            />
          </FormGroup>

        </div>
      </div>

      <div className="admin-table-card settings-preference-card settings-safety-card">
        <div className="admin-table-heading">
          <div>
            <h3>Dashboard and safety</h3>
            <p>Choose what the dashboard shows and how careful deletes should be.</p>
          </div>
        </div>

        <div className="admin-form-grid settings-grid">
          <FormGroup id="set-rows" label="Rows in Product Overview">
            <select
              id="set-rows"
              value={draft.dashboardRows}
              onChange={(e) => updateDraft("dashboardRows", Number(e.target.value))}
            >
              {DASHBOARD_ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} rows
                </option>
              ))}
            </select>
          </FormGroup>

          <div className="admin-form-group">
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={draft.confirmProductDelete}
                onChange={(e) => updateDraft("confirmProductDelete", e.target.checked)}
              />
              Ask before deleting a product
            </label>
          </div>
        </div>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Export data</h3>
            <p>Download a copy of your store data as a CSV file (opens in Excel).</p>
          </div>
        </div>

        <div className="admin-dashboard-actions settings-export">
          {EXPORT_TARGETS.map((target) => (
            <button key={target.source} type="button" className="admin-secondary-button" onClick={() => exportData(target)}>
              <Download size={16} aria-hidden="true" />
              {target.label} ({(dataSources[target.source] || []).length})
            </button>
          ))}
        </div>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Session</h3>
            <p>Signed in as {username}.</p>
          </div>

          <button type="button" className="admin-clear-button" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Reset</h3>
            <p>Restore all settings on this page to their default values.</p>
          </div>

          <button type="button" className="admin-secondary-button" onClick={resetSettings}>
            <RefreshCw size={16} aria-hidden="true" />
            Reset to default
          </button>
        </div>
      </div>
    </section>
  );
}

function StaffManagementPage({ api, onNotice }) {
  const confirm = useConfirm();
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", role: "CASHIER" });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, locationData] = await Promise.all([
        api.getJson(`${API_BASE_URL}/admin/staff`, "Unable to load staff accounts."),
        api.getJson(`${API_BASE_URL}/admin/pos/locations`, "Unable to load active locations for staff assignments."),
      ]);
      const accounts = Array.isArray(data) ? data : [];
      const activeLocations = Array.isArray(locationData) ? locationData : [];
      const assignmentRows = await Promise.all(accounts
        .filter((account) => account.role !== "ADMIN")
        .map(async (account) => {
          const result = await api.getJson(
            `${API_BASE_URL}/admin/staff/${account.id}/locations`,
            `Unable to load location assignments for ${account.username}.`
          );
          return [account.id, Array.isArray(result?.locationIds) ? result.locationIds.map(Number) : []];
        }));
      setStaff(accounts);
      setLocations(activeLocations);
      setAssignmentDrafts(Object.fromEntries(assignmentRows));
    } catch (err) {
      setError(err.message || "Unable to load staff accounts.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const createStaff = async (event) => {
    event.preventDefault();
    const username = form.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
      setError("Username must be 3–50 characters and use only letters, numbers, dots, underscores or hyphens.");
      return;
    }
    if (form.password.length < 12 || new TextEncoder().encode(form.password).length > 72) {
      setError("Password must be at least 12 characters and no more than 72 UTF-8 bytes.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const saved = await api.saveRecord({
        url: `${API_BASE_URL}/admin/staff`,
        method: "POST",
        payload: { username, password: form.password, role: form.role },
        fallbackMessage: "Unable to create staff account.",
      });
      if (saved) {
        setForm({ username: "", password: "", role: "CASHIER" });
        await loadStaff();
        onNotice("Staff account created.");
      }
    } catch (err) {
      setError(err.message || "Unable to create staff account.");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (account, role) => {
    if (role === account.role) return;
    const approved = await confirm({
      title: "Change staff role",
      message: `Change ${account.username} from ${account.role} to ${role}?`,
      confirmLabel: "Change role",
    });
    if (!approved) return;

    setSaving(true);
    setError("");
    try {
      const saved = await api.saveRecord({
        url: `${API_BASE_URL}/admin/staff/${account.id}/role`,
        method: "PATCH",
        payload: { role },
        fallbackMessage: "Unable to change staff role.",
      });
      if (saved) {
        await loadStaff();
        onNotice("Staff role updated.");
      }
    } catch (err) {
      setError(err.message || "Unable to change staff role.");
    } finally {
      setSaving(false);
    }
  };

  const saveLocationAssignments = async (account) => {
    if (account.role === "ADMIN") return;
    const locationIds = (assignmentDrafts[account.id] || []).map(Number);
    setSaving(true);
    setError("");
    try {
      const saved = await api.saveRecord({
        url: `${API_BASE_URL}/admin/staff/${account.id}/locations`,
        method: "PUT",
        payload: { locationIds },
        fallbackMessage: "Unable to save staff location assignments.",
      });
      if (saved) {
        await loadStaff();
        onNotice(`Location access updated for ${account.username}.`);
      }
    } catch (err) {
      setError(err.message || "Unable to save staff location assignments.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (account) => {
    const enabled = !account.enabled;
    const approved = await confirm({
      title: enabled ? "Enable staff account" : "Disable staff account",
      message: enabled
        ? `Allow ${account.username} to sign in again?`
        : `Disable ${account.username}? Their existing JWT will stop working immediately.`,
      confirmLabel: enabled ? "Enable account" : "Disable account",
      danger: !enabled,
    });
    if (!approved) return;

    setSaving(true);
    setError("");
    try {
      const saved = await api.saveRecord({
        url: `${API_BASE_URL}/admin/staff/${account.id}/status`,
        method: "PATCH",
        payload: { enabled },
        fallbackMessage: "Unable to update staff status.",
      });
      if (saved) {
        await loadStaff();
        onNotice(enabled ? "Staff account enabled." : "Staff account disabled.");
      }
    } catch (err) {
      setError(err.message || "Unable to update staff status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-content">
      <PageHeading
        title="Staff & permissions"
        description="Create cashier and manager logins. Existing administrator accounts remain administrators."
        action={<RefreshButton onClick={loadStaff} loading={loading} />}
      />
      <ErrorMessage>{error}</ErrorMessage>

      <div className="admin-table-card" style={{ marginBottom: 22 }}>
        <div className="admin-table-heading">
          <div>
            <h3>Create staff account</h3>
            <p>Passwords are stored as BCrypt hashes and are never shown again.</p>
          </div>
        </div>
        <form className="admin-form-grid" style={{ padding: "0 22px 22px" }} onSubmit={createStaff}>
          <FormGroup id="staff-username" label="Username" required>
            <input id="staff-username" autoComplete="off" value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              maxLength={50} required />
          </FormGroup>
          <FormGroup id="staff-password" label="Temporary password (12+ characters)" required>
            <input id="staff-password" type="password" autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              minLength={12} required />
          </FormGroup>
          <FormGroup id="staff-role" label="Role" required>
            <select id="staff-role" value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="CASHIER">Cashier</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </FormGroup>
          <div className="admin-form-actions">
            <button type="submit" className="admin-primary-button" disabled={saving}>
              {saving ? "Saving…" : "Create account"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Staff accounts</h3>
            <p>{staff.length} account{staff.length === 1 ? "" : "s"} · disabled accounts cannot use existing tokens</p>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr><th>Username</th><th>Role</th><th>Location access</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <EmptyRow colSpan={6}>Loading staff accounts…</EmptyRow>
                : staff.length === 0 ? <EmptyRow colSpan={6}>No staff accounts found.</EmptyRow>
                  : staff.map((account) => (
                    <tr key={account.id}>
                      <td><strong>{account.username}</strong></td>
                      <td>
                        <select aria-label={`Role for ${account.username}`} value={account.role}
                          disabled={saving || account.username === sessionStorage.getItem("adminUsername")}
                          onChange={(event) => changeRole(account, event.target.value)}>
                          <option value="ADMIN">Administrator</option>
                          <option value="MANAGER">Manager</option>
                          <option value="CASHIER">Cashier</option>
                        </select>
                      </td>
                      <td>
                        {account.role === "ADMIN" ? (
                          <span className="admin-help-text">All active locations</span>
                        ) : (
                          <div style={{ display: "grid", gap: 8, minWidth: 220 }}>
                            <select
                              aria-label={`Assigned locations for ${account.username}`}
                              multiple
                              size={Math.min(4, Math.max(2, locations.length))}
                              value={(assignmentDrafts[account.id] || []).map(String)}
                              disabled={saving || locations.length === 0}
                              onChange={(event) => setAssignmentDrafts((current) => ({
                                ...current,
                                [account.id]: Array.from(event.target.selectedOptions, (option) => Number(option.value)),
                              }))}
                            >
                              {locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.code} · {location.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="admin-secondary-button"
                              disabled={saving || locations.length === 0}
                              onClick={() => saveLocationAssignments(account)}
                            >
                              Save locations
                            </button>
                          </div>
                        )}
                      </td>
                      <td><span className={account.enabled ? "admin-status available" : "admin-status inactive"}>
                        {account.enabled ? "Active" : "Disabled"}
                      </span></td>
                      <td>{formatDate(account.createdAt)}</td>
                      <td>
                        <button type="button" className="admin-secondary-button"
                          disabled={saving || account.username === sessionStorage.getItem("adminUsername")}
                          onClick={() => changeStatus(account)}>
                          {account.enabled ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="admin-help-text" style={{ marginTop: 14 }}>
        Cashiers can create sales only. Managers can use POS inventory and sales history. Only administrators can manage staff and the rest of the admin portal.
      </p>
    </section>
  );
}

function AdminAuditLogPage({ api }) {
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(0);
  const [pageInfo, setPageInfo] = useState({ totalElements: 0, totalPages: 0, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [integrity, setIntegrity] = useState(null);
  const [integrityError, setIntegrityError] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.getJson(
        `${API_BASE_URL}/admin/audit/events?page=${page}&size=50`,
        "Unable to load the admin audit log."
      );
      setEvents(Array.isArray(result?.content) ? result.content : []);
      setPageInfo({
        totalElements: Number(result?.totalElements || 0),
        totalPages: Number(result?.totalPages || 0),
        first: Boolean(result?.first),
        last: Boolean(result?.last),
      });
      try {
        const check = await api.getJson(
          `${API_BASE_URL}/admin/audit/events/integrity`,
          "Unable to verify audit-chain integrity."
        );
        setIntegrity(check);
        setIntegrityError("");
      } catch (integrityFailure) {
        setIntegrity(null);
        setIntegrityError(integrityFailure.message || "Audit-chain integrity could not be checked.");
      }
    } catch (err) {
      setError(err.message || "Unable to load the admin audit log.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [api, page]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const formatTimestamp = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString("en-IN", { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "medium" });
  };

  return (
    <section className="admin-content">
      <PageHeading
        title="Admin audit log"
        description="Review recorded administrator and staff mutations, response outcomes and request metadata."
        action={<RefreshButton onClick={loadEvents} loading={loading} />}
      />
      <ErrorMessage>{error}</ErrorMessage>
      <div className="admin-table-card" style={{ marginBottom: 16 }}>
        <div className="admin-table-heading">
          <div>
            <h3>Audit-chain integrity</h3>
            <p>
              {integrity
                ? `${Number(integrity.checkedEvents || 0).toLocaleString("en-IN")} events checked`
                : integrityError || "Integrity status has not been checked."}
            </p>
            {integrity?.failureReason && (
              <p style={{ color: "var(--admin-danger, #b42318)" }}>{integrity.failureReason}</p>
            )}
          </div>
          <span className={integrity?.valid ? "admin-status available" : "admin-status inactive"}>
            {integrity?.valid ? "Chain verified" : "Not verified"}
          </span>
        </div>
      </div>
      <div className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h3>Recorded mutations</h3>
            <p>{pageInfo.totalElements.toLocaleString("en-IN")} events · newest first · 50 per page</p>
          </div>
          <span className="admin-help-text">Times shown in India Standard Time</span>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th><th>Actor</th><th>Authorities</th><th>Action</th>
                <th>Resource</th><th>Result</th><th>Remote address</th><th>Request ID</th><th>Error</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <EmptyRow colSpan={9}>Loading audit events…</EmptyRow>
                : events.length === 0 ? <EmptyRow colSpan={9}>No audit events found.</EmptyRow>
                  : events.map((event) => (
                    <tr key={event.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatTimestamp(event.createdAt)}</td>
                      <td><strong>{event.actorUsername || "Unauthenticated"}</strong></td>
                      <td>{event.actorAuthorities || "—"}</td>
                      <td>
                        <strong>{event.httpMethod}</strong>
                        <div className="admin-help-text">HTTP {event.responseStatus}</div>
                      </td>
                      <td style={{ minWidth: 240, maxWidth: 420, overflowWrap: "anywhere" }}>{event.requestPath}</td>
                      <td>
                        <span className={event.outcome === "SUCCESS" ? "admin-status available" : "admin-status inactive"}>
                          {event.outcome || "UNKNOWN"}
                        </span>
                      </td>
                      <td>{event.remoteAddress || "—"}</td>
                      <td style={{ maxWidth: 180, overflowWrap: "anywhere" }}>{event.requestId || "—"}</td>
                      <td style={{ maxWidth: 220, overflowWrap: "anywhere" }}>{event.errorType || "—"}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-heading" style={{ borderTop: "1px solid var(--admin-border, #e5e7eb)" }}>
          <span className="admin-help-text">
            Page {pageInfo.totalPages === 0 ? 0 : page + 1} of {pageInfo.totalPages}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="admin-secondary-button"
              disabled={loading || pageInfo.first || page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}>
              Previous
            </button>
            <button type="button" className="admin-secondary-button"
              disabled={loading || pageInfo.last || page + 1 >= pageInfo.totalPages}
              onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
      <p className="admin-help-text" style={{ marginTop: 14 }}>
        Hash-chain verification and append-only database triggers require manual backend migration 016 before deployment. Rejected admin mutations returning 401 or 403 are also recorded at the security layer. Upstream proxy failures and some pre-security failures may not be captured. A database administrator could still alter both the events and chain state; external backups and restricted database access remain necessary.
      </p>
    </section>
  );
}

/* =========================
   ROOT COMPONENT
   Owns the session, shared data, navigation, notices, preferences and confirmations.
========================= */

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("adminToken");
  const username = sessionStorage.getItem("adminUsername") || "Admin";
  const role = sessionStorage.getItem("adminRole") || "ADMIN";
  const isAdmin = role === "ADMIN";

  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);

  const [lists, setLists] = useState({ products: [], orders: [], appointments: [], customers: [], images: [] });
  const [appointmentsPageInfo, setAppointmentsPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, last: true });
  const [ordersPageInfo, setOrdersPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, last: true });
  const [customersPageInfo, setCustomersPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, last: true });
  const [productsPageInfo, setProductsPageInfo] = useState({ number: 0, totalPages: 0, totalElements: 0, last: true });
  const [loading, setLoading] = useState({});
  const [listErrors, setListErrors] = useState({});

  const [banners, setBanners] = useState([]);
  const [offer, setOffer] = useState(null);
  const [marketingLoading, setMarketingLoading] = useState(false);

  const [confirmOptions, setConfirmOptions] = useState(null);
  const confirmResolver = useRef(null);

  const { products, orders, appointments, customers, images } = lists;

  // Opens the shared confirmation popup and resolves with the user's answer
  const askConfirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        confirmResolver.current?.(false);
        confirmResolver.current = resolve;
        setConfirmOptions(options);
      }),
    []
  );

  const settleConfirm = (value) => {
    confirmResolver.current?.(value);
    confirmResolver.current = null;
    setConfirmOptions(null);
  };

  const savePrefs = (next) => {
    const clean = sanitizePrefs(next);
    setPrefs(clean);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(clean));
    } catch {
      // Storage full or blocked: the settings still apply for this session
    }
  };

  const resetPrefs = () => savePrefs(DEFAULT_PREFS);

  const endSession = useCallback(() => {
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminUsername");
    sessionStorage.removeItem("adminRole");
    navigate("/admin", { replace: true });
  }, [navigate]);

  const logout = async () => {
    const ok = await askConfirm({
      title: "Log out",
      message: "Are you sure you want to log out?",
      confirmLabel: "Yes, log out",
    });
    if (ok) endSession();
  };

  const api = useAdminApi(token, endSession);
  const { getJson } = api;

  // Loads one list into state, with its own loading flag
  const loadList = useCallback(
    async (key, page = 0, append = false) => {
      const { url, message } = LIST_SOURCES[key];
      const requestUrl = key === "appointments"
        ? `${url}?page=${page}&size=50`
        : key === "orders" ? `${url}?page=${page}&size=25`
        : key === "customers" ? `${url}?page=${page}&size=50`
        : key === "products" ? `${url}?page=${page}&size=50` : url;

      setLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const data = await getJson(requestUrl, message);
        if (key === "appointments" && Array.isArray(data?.content)) {
          setLists((prev) => ({
            ...prev,
            appointments: append ? [...prev.appointments, ...data.content] : data.content,
          }));
          setAppointmentsPageInfo({
            number: Number(data.number || 0),
            totalPages: Number(data.totalPages || 0),
            totalElements: Number(data.totalElements || 0),
            last: Boolean(data.last),
          });
        } else if (key === "orders" && Array.isArray(data?.content)) {
          setLists((prev) => ({
            ...prev,
            orders: append ? [...prev.orders, ...data.content.filter((item) => !prev.orders.some((existing) => existing.id === item.id))] : data.content,
          }));
          setOrdersPageInfo({
            number: Number(data.number || 0),
            totalPages: Number(data.totalPages || 0),
            totalElements: Number(data.totalElements || 0),
            last: Boolean(data.last),
          });
        } else if (key === "customers" && Array.isArray(data?.content)) {
          setLists((prev) => ({
            ...prev,
            customers: append ? [...prev.customers, ...data.content] : data.content,
          }));
          setCustomersPageInfo({
            number: Number(data.number || 0),
            totalPages: Number(data.totalPages || 0),
            totalElements: Number(data.totalElements || 0),
            last: Boolean(data.last),
          });
        } else if (key === "products" && Array.isArray(data?.content)) {
          setLists((prev) => ({
            ...prev,
            products: append ? [...prev.products, ...data.content.filter((item) => !prev.products.some((existing) => existing.id === item.id))] : data.content,
          }));
          setProductsPageInfo({
            number: Number(data.number || 0),
            totalPages: Number(data.totalPages || 0),
            totalElements: Number(data.totalElements || 0),
            last: Boolean(data.last),
          });
        } else if (data) {
          setLists((prev) => ({ ...prev, [key]: data }));
        }
        setListErrors((prev) => ({ ...prev, [key]: "" }));
      } catch (err) {
        setListErrors((prev) => ({ ...prev, [key]: err.message || message }));
        setError(err.message || message);
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [getJson]
  );

  const loadMarketing = useCallback(async () => {
    setMarketingLoading(true);
    try {
      const [bannerData, offerData] = await Promise.all([
        getJson(ENDPOINTS.banners, "Failed to load marketing data"),
        getJson(ENDPOINTS.offers, "Failed to load marketing data"),
      ]);

      if (!bannerData || !offerData) return;

      setBanners(bannerData);
      setOffer(offerData[0] ?? null);
    } catch (err) {
      setError(err.message || "Failed to load marketing data");
    } finally {
      setMarketingLoading(false);
    }
  }, [getJson]);

  // Initial load, or redirect when there is no session
  useEffect(() => {
    if (!token) {
      navigate("/admin", { replace: true });
      return;
    }

    loadList("products");
    loadList("orders");
    loadList("appointments");
  }, [token, navigate, loadList]);

  // Notices disappear after a few seconds
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Escape closes the mobile navigation drawer
  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // The Marketing page also edits the website images, so it loads both
  const reloadImages = useCallback(() => loadList("images"), [loadList]);

  const reloaders = {
    Products: () => loadList("products"),
    Orders: () => loadList("orders"),
    Appointments: () => loadList("appointments"),
    "Customer Accounts": () => loadList("customers"),
    Marketing: () => Promise.all([loadMarketing(), reloadImages()]),
  };

  const refreshDashboard = async () => {
    setDashboardRefreshing(true);
    try {
      await Promise.all([reloaders.Products(), reloaders.Orders(), reloaders.Appointments()]);
    } finally {
      setDashboardRefreshing(false);
    }
  };

  const navigateTo = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
    setError("");
    reloaders[page]?.();
  };

  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return (
          <DashboardPage
            api={api}
            products={products}
            orders={orders}
            appointments={appointments}
            refreshing={dashboardRefreshing}
            onRefresh={refreshDashboard}
            onViewProducts={() => navigateTo("Products")}
            onNotice={setNotice}
          />
        );
      case "Products":
        return (
          <ProductsPage
            api={api}
            products={products}
            pageInfo={productsPageInfo}
            loading={loading.products}
            onReload={reloaders.Products}
            onLoadMore={() => loadList("products", productsPageInfo.number + 1, true)}
            onNotice={setNotice}
          />
        );
      case "Payment Settlements":
        return isAdmin ? <SettlementReconciliationPage api={api} /> : null;
      case "Payment Disputes":
        return isAdmin ? <PaymentDisputesPage api={api} /> : null;
      case "Orders":
        return (
          <OrdersPage
            api={api}
            orders={orders}
            pageInfo={ordersPageInfo}
            loading={loading.orders}
            loadError={listErrors.orders}
            onReload={reloaders.Orders}
            onLoadMore={() => loadList("orders", ordersPageInfo.number + 1, true)}
            onNotice={setNotice}
          />
        );
      case "Appointments":
        return (
          <AppointmentsPage
            api={api}
            appointments={appointments}
            pageInfo={appointmentsPageInfo}
            loading={loading.appointments}
            onReload={reloaders.Appointments}
            onLoadMore={() => loadList("appointments", appointmentsPageInfo.number + 1, true)}
            onNotice={setNotice}
          />
        );
      case "Customer Accounts":
        return (
          <CustomersPage
            api={api}
            customers={customers}
            pageInfo={customersPageInfo}
            loading={loading.customers}
            onReload={reloaders["Customer Accounts"]}
            onLoadMore={() => loadList("customers", customersPageInfo.number + 1, true)}
          />
        );
      case "Marketing":
        return (
          <MarketingPage
            api={api}
            banners={banners}
            offer={offer}
            loading={marketingLoading}
            onReload={loadMarketing}
            onNotice={setNotice}
            images={images}
            imagesLoading={loading.images}
            onReloadImages={reloadImages}
          />
        );
      case "Staff":
        return isAdmin ? <StaffManagementPage api={api} onNotice={setNotice} /> : null;
      case "Audit Log":
        return isAdmin ? <AdminAuditLogPage api={api} /> : null;
      case "Settings":
        return (
          <SettingsPage
            prefs={prefs}
            onSavePrefs={savePrefs}
            onResetPrefs={resetPrefs}
            products={products}
            orders={orders}
            appointments={appointments}
            username={username}
            onLogout={logout}
            onNotice={setNotice}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ConfirmContext.Provider value={askConfirm}>
      <PrefsContext.Provider value={prefs}>
        <div className="admin-layout">
          {sidebarOpen && (
            <button
              type="button"
              className="admin-sidebar-overlay"
              aria-label="Close navigation menu"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside id="admin-sidebar" className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
            <div className="admin-sidebar-brand">
              <h2>
                NMK <span>OPTICALS</span>
              </h2>
              <p>ADMIN PANEL</p>
            </div>

            <nav className="admin-navigation" aria-label="Admin">
              {MENU_SECTIONS.map((section) => (
                <section className="admin-nav-section" key={section.label} aria-label={section.label}>
                  <h3 className="admin-menu-label">{section.label}</h3>
                  <div className="admin-nav-section-items">
                    {section.items.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                      const Icon = item.icon;
                      const isActive = activePage === item.name;

                      return (
                        <button
                          key={item.name}
                          type="button"
                          className={`admin-nav-item ${isActive ? "active" : ""}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => {
                            if (item.name === "POS Terminal") {
                              setActivePage(item.name);
                              setSidebarOpen(false);
                              navigate("/admin/pos");
                              return;
                            }
                            navigateTo(item.name);
                          }}
                        >
                          <Icon size={19} aria-hidden="true" />
                          <span>{item.label || item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              <section className="admin-nav-section admin-nav-admin-section" aria-label="Administration">
                <h3 className="admin-menu-label">ADMINISTRATION</h3>
                <div className="admin-nav-section-items">
                  {ADMIN_MENU_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        className={`admin-nav-item ${isActive ? "active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => navigateTo(item.name)}
                      >
                        <Icon size={19} aria-hidden="true" />
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </nav>

            <button type="button" className="admin-logout-button" onClick={logout}>
              <LogOut size={19} aria-hidden="true" />
              <span>Logout</span>
            </button>
          </aside>

          <main className="admin-main">
            <header className="admin-topbar">
              <button
                type="button"
                className="admin-mobile-menu"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
                aria-controls="admin-sidebar"
                aria-expanded={sidebarOpen}
              >
                <Menu size={23} aria-hidden="true" />
              </button>

              <div>
                <h2>{activePage}</h2>
                <p>Welcome back, {username}</p>
              </div>

              <div className="admin-profile">
                <div className="admin-avatar" aria-hidden="true">
                  {username.charAt(0).toUpperCase()}
                </div>
                <span>{username}</span>
              </div>
            </header>

            <div className="admin-page-messages">
              <ErrorMessage>{error}</ErrorMessage>
              {notice && (
                <div className="admin-success-message" role="status">
                  {notice}
                </div>
              )}
            </div>

            {renderPage()}
          </main>

          <ConfirmPopup options={confirmOptions} onResult={settleConfirm} />
        </div>
      </PrefsContext.Provider>
    </ConfirmContext.Provider>
  );
}
