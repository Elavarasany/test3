<<<<<<< HEAD
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.


## NMK Opticals POS configuration

The POS frontend uses `VITE_API_BASE_URL` for its backend API.

- Local development: create a local `.env` with `VITE_API_BASE_URL=http://localhost:8080/api`.
- Production hosting: configure `VITE_API_BASE_URL` in the frontend hosting provider to the deployed backend origin followed by `/api` (for example, `https://api.example.com/api`). Rebuild and redeploy after changing this variable; Vite embeds it at build time.
- The production POS no longer silently falls back to `localhost:8080`. If the variable is missing, it shows a configuration error instead of sending requests to the visitor's own computer.

The backend must allow the exact deployed frontend origin through `APP_CORS_ALLOWED_ORIGINS` (comma-separated origins, no wildcard). Set `APP_CORS_REQUIRE_HTTPS=true` in production. Configure the database, `JWT_SECRET`, Razorpay credentials and webhook secret as hosting secrets; never commit them.

See the backend repository's `POS_API.md` and POS deployment runbook for API behavior, database prerequisites, migration review, and external integration limitations.
=======
# test3
>>>>>>> 8b6a20cb8f65b331bbeaedead8ac932b330b520c
