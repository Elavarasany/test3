
import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import CustomerWebsite from "./CustomerWebsite";
import { API_CONFIGURATION_ERROR } from "./config/api";

// Admin pages load on demand.
const AdminLogin = lazy(() => import("./admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const PosTerminal = lazy(() => import("./pos/PosTerminal"));

const TOKEN_KEY = "adminToken";
const LOGIN_PATH = "/admin";
const DASHBOARD_PATH = "/admin/dashboard";

const isAdminAuthenticated = () =>
  Boolean(sessionStorage.getItem(TOKEN_KEY));

function ProtectedAdminRoute({ children, adminOnly = false }) {
  const location = useLocation();

  if (!isAdminAuthenticated()) {
    return (
      <Navigate
        to={LOGIN_PATH}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (adminOnly && sessionStorage.getItem("adminRole") !== "ADMIN") {
    return <Navigate to="/admin/pos" replace />;
  }

  return children;
}

function GuestOnlyRoute({ children }) {
  return isAdminAuthenticated()
    ? <Navigate to={DASHBOARD_PATH} replace />
    : children;
}

function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      Loading…
    </div>
  );
}

export default function App() {
  if (API_CONFIGURATION_ERROR) {
    return (
      <main role="alert" style={{ minHeight: "100vh", display: "grid", placeContent: "center", gap: 12, padding: 24, fontFamily: "system-ui, sans-serif", color: "#17283d", background: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>NMK Opticals configuration required</h1>
        <p>{API_CONFIGURATION_ERROR}</p>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Customer storefront */}
          <Route path="/" element={<CustomerWebsite />} />

          {/* Public customer order tracking */}
          <Route path="/track" element={<CustomerWebsite />} />
          <Route path="/track/:token" element={<CustomerWebsite />} />

          {/* Admin login */}
          <Route
            path={LOGIN_PATH}
            element={
              <GuestOnlyRoute>
                <AdminLogin />
              </GuestOnlyRoute>
            }
          />

          {/* Protected admin dashboard */}
          <Route
            path={DASHBOARD_PATH}
            element={
              <ProtectedAdminRoute adminOnly>
                <AdminDashboard />
              </ProtectedAdminRoute>
            }
          />

          {/* Protected in-store POS terminal */}
          <Route
            path="/admin/pos"
            element={
              <ProtectedAdminRoute>
                <PosTerminal />
              </ProtectedAdminRoute>
            }
          />

          {/* Unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
