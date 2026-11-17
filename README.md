# Sahlify

Open-source Algerian e-commerce store builder designed for **Cash on Delivery (COD)** and **DZD online payments**.

## Features
- **Express Checkout**: 1-step COD checkout + **Chargily Pay** (Edahabia & CIB) with 69-wilaya delivery rates (Home & Stopdesk) and phone blacklisting.
- **Algerian Express Carriers**: Built-in adapters for **Yalidine, Ecotrack, Procolis, Maystro, and Noest** (label creation, live tracking sync, and verified webhooks).
- **Meta Conversions API (CAPI)**: Server-side `Lead` on checkout and `Purchase` on confirmed carrier delivery.
- **Visual Theme Studio & AI**: Customize colors, Arabic/Latin typography, and homepage sections visually or with AI (RTL & LTR).

---

## Quickstart (Docker)

1. Configure your environment variables:
   ```bash
   cp backend/.env.example docker/.env
   ```
   Edit `docker/.env` and set strong random values for `DB_PASSWORD`, `BETTER_AUTH_SECRET`, and `ENCRYPTION_KEY` (`openssl rand -hex 32`).

2. Start Sahlify:
   ```bash
   cd docker
   docker compose up -d --build
   ```
   PostgreSQL migrations and 69-wilaya reference data run automatically on startup.

---

## Local Development

Requires **Node.js 22+** and **PostgreSQL 16+**.

```bash
# 1. Backend API (http://localhost:3000)
cd backend
cp .env.example .env
npm install
npm run dev

# 2. Merchant Dashboard (http://localhost:5173)
cd frontend/frontend
npm install
npm run dev

# 3. Customer Storefront (http://<store-slug>.localhost:3001)
cd storefront
npm install
npm run dev
```

---

## License
Licensed under **AGPL-3.0** (see [LICENSE](LICENSE)).
- Self-hosted deployments must keep the `"Powered by Sahlify"` footer attribution (AGPL-3.0 §7(b)).
- For a **Commercial / White-Label License** (to remove Sahlify branding or deploy proprietary modifications), contact **Sahlify**.
