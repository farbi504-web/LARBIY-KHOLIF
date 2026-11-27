# LIBRAIRIE SLIMI | مكتبة سليمي — Project Handoff Guide

## Overview
Full-stack bilingual (Arabic RTL / French LTR) e-commerce storefront and digital services platform for **مكتبة سليمي | LIBRAIRIE SLIMI** (Tipaza, Algeria).

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), `motion`, `lucide-react`
- **Backend**: Express (`server.ts`, `server/routes.ts`, `server/auth.ts`, `server/db.ts`)
- **Database**: SQLite stored in `data/slimi.sqlite` (`DATA_DIR` configurable via env)
- **Payments & Notifications**: Chargily Pay webhooks (`CHARGILY_SECRET_KEY`, `CHARGILY_MODE`), Telegram order alerts (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)

## Key Commands
- **Install dependencies**: `npm install`
- **Development server (Express + Vite middleware on port 3000)**: `npm run dev`
- **Type-check**: `npm run lint` (`tsc --noEmit`)
- **Production frontend build**: `npm run build` (`vite build` -> `dist/`)
- **Production start**: `NODE_ENV=production npm start` (`node server.ts`, requires Node.js >= 22.6 with native TypeScript execution, or `npx tsx server.ts`)
- **Commerce unit tests**: `npx tsx --test src/shared/commerce.test.ts`

## Project Structure
- `server.ts` — Express server, CSP & security headers, `/api` routes, Vite dev middleware / `dist` static fallback
- `server/` — `db.ts`, `auth.ts`, `routes.ts`
- `src/App.tsx` — App shell, routing, state bootstrap (`/api/store/bootstrap`), background video control
- `src/components/` — UI views (`StoreHome.tsx`, `CatalogView.tsx`, `ProductDetailView.tsx`, `ProductSkeletons.tsx`, `CartDrawer.tsx`, `CartCheckoutView.tsx`, `Header.tsx`, `AdminConsole.tsx`, `AdminProductsAndSettings.tsx`, `TrackAccountContactLegal.tsx`, `ServiceArtwork.tsx`, etc.)
- `src/shared/` — Shared types, i18n strings (`i18n.ts`), commerce logic & tests (`commerce.test.ts`)
- `public/brand/` — Vector SVG brand identity files (`logo.svg`, `logo-horizontal.svg`, `logo-dark.svg`, `logo-stacked.svg`)

## Brand Identity Rules (Strict)
- **Exact Brand Names**: `LIBRAIRIE SLIMI` / `مكتبة سليمي`
- **Palette**:
  - Deep Navy: `#0B2D5B`
  - Crimson Red: `#D7193F`
  - Pure White: `#FFFFFF`
  - Light Gray: `#F5F6FA`
  - Charcoal: `#17243B`
- **Typography**: `IBM Plex Sans Arabic` (Arabic) and `Manrope` (French/English & numerals)
- **Mark**: Faceted open-book + crimson geometric `S` ribbon emblem (`public/brand/logo.svg` & `SlimiLogoMark` in `src/components/ServiceArtwork.tsx`).

## Environment Setup
Copy `.env.example` to `.env` and fill in any required secrets (`OWNER_PASSWORD`, `CHARGILY_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PUBLIC_URL`, `DATA_DIR`). Never commit `.env` or `data/*.sqlite` secrets.
