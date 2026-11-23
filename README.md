# NMK Opticals — Customer Website, Admin and POS

React 19 + Vite frontend for the NMK Opticals storefront, staff login, admin dashboard and in-store POS.

## Requirements

- Node.js **20.19+** or **22.12+** (required by Vite 8).
- npm (the repository includes `package-lock.json`).

## Local setup

From the repository root:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The local example points to the Spring Boot API at `http://localhost:8080/api`. Start the backend separately before testing API-dependent features.

## Backend API configuration

The frontend reads one shared variable: `VITE_API_BASE_URL`.

- Local: `http://localhost:8080/api`
- Deployed: the full HTTPS backend URL ending in `/api`, for example `https://api.example.com/api`.

Vite embeds environment variables at build time. After changing the hosting variable, rebuild and redeploy. A production build with a missing or invalid API URL displays a configuration error instead of silently issuing requests to relative URLs.

The backend must allow the exact frontend origin in `APP_CORS_ALLOWED_ORIGINS`. Do not use wildcard CORS origins with staff credentials.

## Useful commands

```powershell
npm ci
npm run dev
npm run build
npm run lint
```

## Security notes

- Never commit `.env` or API credentials.
- Admin route checks in React are only a user-interface convenience. Backend JWT and role authorization remain the security boundary.
- Do not treat POS operator-entered cash/card/UPI payment references as gateway-verified payments.
- See the backend repository's `POS_API.md` and `LOCAL-DATABASE-SETUP.md` for API behavior, schema prerequisites and known release limitations.
