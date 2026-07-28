# TradersHub

A full-stack fintech simulation trading platform where users deposit via real M-PESA and trade virtual assets (XAUUSD, EURUSD, BTCUSD) in a controlled simulation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/big-profits run dev` — run the frontend (port 18154)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- API: Express 5 with JWT auth (bcryptjs + jsonwebtoken)
- DB: PostgreSQL + Drizzle ORM (Replit built-in)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Payments: M-PESA Daraja API (STK Push)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle tables (users, wallets, trades, deposits, followers)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/market.ts` — Simulated price engine (random walk)
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware
- `artifacts/big-profits/src/` — React frontend

## Architecture decisions

- JWT auth stored in localStorage (`bp_token`, `bp_user`) — server-side validation on every request
- M-PESA operates in simulation mode when `MPESA_CONSUMER_KEY` is not set (directly credits wallet)
- Wallet balance only modified server-side (never trust frontend balance)
- Simulated trades: 55% win rate, profit -5% to +12% using `simulateProfitLoss()`
- Copy trading: when a trade is opened, it auto-copies to all followers with sufficient balance
- Admin token includes `isAdmin` claim; admin routes protected by `requireAdmin` middleware

## Product

- Landing page, auth (register/login), dashboard, trading terminal, leaderboard, copy trading, deposits, admin panel
- Real M-PESA STK Push integration (Daraja API) with duplicate-callback prevention
- Simulated random-walk market prices for XAUUSD, EURUSD, BTCUSD (3s refresh)
- Leaderboard ranked by total profit; copy-trading with auto-follow system

## Demo accounts

- Admin: `admin@bigprofits.com` / `admin123` (has admin panel access, email pre-verified)
- Alice: `alice@trader.com` / `pass123` (email pre-verified)
- Bob: `bob@trader.com` / `pass123` (email pre-verified)

## OTP Email Verification

- New accounts require email OTP verification (6-digit code, 10-minute expiry)
- In **dev mode** (no SMTP configured): OTP is logged to the server console AND returned in the API response as `devOtp`
- In **production**: set `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_PORT`, `EMAIL_FROM` to enable real email delivery
- Endpoints: `POST /api/auth/verify-otp`, `POST /api/auth/resend-otp`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck:libs` after any `lib/db/src/schema/` changes before checking artifact types
- M-PESA callback URL must be publicly accessible (use ngrok or deploy to production)
- `CALLBACK_BASE_URL` env var sets the M-PESA callback domain (defaults to placeholder)
- Do NOT restart the frontend workflow mid-design-subagent run

## Required Environment Variables (M-PESA)

Set these secrets for live M-PESA integration:
- `MPESA_CONSUMER_KEY` — Daraja API consumer key
- `MPESA_CONSUMER_SECRET` — Daraja API consumer secret
- `MPESA_PASSKEY` — Lipa na M-PESA online passkey
- `MPESA_SHORTCODE` — Business shortcode (default: 174379 for sandbox)
- `MPESA_ENV` — `sandbox` or `production` (default: sandbox)
- `CALLBACK_BASE_URL` — Your public domain for M-PESA callbacks
- `JWT_SECRET` — JWT signing secret (falls back to SESSION_SECRET)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
