const configuredBase = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const localFallback = import.meta.env.DEV ? "http://localhost:8080/api" : "";

let configurationError = "";
if (configuredBase) {
  try {
    const parsed = new URL(configuredBase);
    const validProtocol = parsed.protocol === "http:" || parsed.protocol === "https:";
    const validApiPath = parsed.pathname.replace(/\/+$/, "").endsWith("/api");
    if (!validProtocol || !validApiPath || parsed.search || parsed.hash) {
      configurationError = "VITE_API_BASE_URL must be an absolute HTTP(S) backend URL ending in /api (for example, https://api.example.com/api).";
    }
  } catch {
    configurationError = "VITE_API_BASE_URL is not a valid absolute backend URL. Set it to a URL ending in /api.";
  }
}

export const API_BASE_URL = configuredBase || localFallback;
export const API_CONFIGURATION_ERROR = configurationError ||
  (!API_BASE_URL
    ? "Set VITE_API_BASE_URL to your deployed backend URL ending in /api, then rebuild and redeploy the frontend."
    : "");
