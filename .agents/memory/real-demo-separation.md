---
name: Real/Demo account separation
description: Architecture for isolated real vs demo accounts — DB tables, API params, frontend store, codegen hook naming.
---

## Rule
Real and demo accounts are completely separate. No shared data, no localStorage simulation.

## DB
- `wallets` table = real account (balance starts 0)
- `demo_wallets` table = demo account (balance defaults 10,000)
- `trades`, `deposits`, `notifications` tables all have `account_type TEXT DEFAULT 'real'` column
- On register: insert into BOTH walletsTable and demoWalletsTable

## API
- All data endpoints accept `?account=real|demo` query param
- `POST /api/demo/reset` — closes open demo trades, resets demo wallet to $10,000
- Routes registered in `artifacts/api-server/src/routes/index.ts` including `demoRouter`

## Frontend store
- `account-store.ts` only has `{ mode: 'real'|'demo', setMode }` — no balance/trades state
- All data comes from API hooks with `{ account: mode }` as first param

## Hook call pattern (after Orval codegen with params)
```typescript
useGetWallet({ account: mode }, { query: { queryKey: [], refetchInterval: 5000 } })
useGetOpenTrades({ account: mode }, { query: { queryKey: [], refetchInterval: 3000 } })
useGetDashboardSummary({ account: mode }, { query: { queryKey: [] } })
```

## queryKey invalidation pattern
```typescript
queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey({ account: mode }) })
```

## Admin hook naming (Orval codegen output)
Old names (from original repo): `useAdminGetStats`, `useAdminGetUsers`, `useAdminGetDeposits`, `useAdminGetTrades`, `useAdminAdjustBalance`, `getAdminGetUsersQueryKey`
New names (after codegen): `useGetAdminStats`, `useGetAdminUsers`, `useGetAdminDeposits`, `useGetAdminTrades`, `useAdjustBalance`, `getGetAdminUsersQueryKey`

## api-zod typecheck issue
Orval 8 generates `zod.email()` and `zod.looseObject()` (Zod v4 API) but workspace uses zod v3.
Fix: manually patch `lib/api-zod/src/generated/api.ts` after codegen:
- `zod.email()` → `zod.string().email()`
- `zod.looseObject({` → `zod.object({`

**Why:** These are pre-existing in the repo; only affects api-zod (server validation), not api-client-react (frontend hooks).

**How to apply:** After any `pnpm --filter @workspace/api-spec run codegen`, patch the 3 lines in api-zod/src/generated/api.ts before running typecheck.
