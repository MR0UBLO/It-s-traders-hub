---
name: Orval generated hooks + React Query v5 queryKey requirement
description: How to correctly pass queryKey to Orval-generated React Query v5 hooks without sharing cache entries.
---

**Rule:** Orval-generated hooks accept `{ query?: UseQueryOptions<...> }`. In RQ v5, `UseQueryOptions` requires `queryKey`. You must pass the proper computed query key from the matching `getGet*QueryKey(params)` getter.

**CRITICAL WARNING:** Do NOT pass `queryKey: []`. The generated `getGet*QueryOptions` uses `queryOptions?.queryKey ?? computedKey`, so `[]` is NOT null/undefined and will NOT fall back — every hook that passes `queryKey: []` shares cache key `[]`, causing queries to overwrite each other's data with incompatible shapes (e.g. wallet object returned where trade array expected).

**Correct pattern:**
```ts
import {
  useGetTrades, getGetTradesQueryKey,
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetWallet, getGetWalletQueryKey,
} from "@workspace/api-client-react";

// Pass the matching getter:
useGetTrades({ account: mode }, { query: { queryKey: getGetTradesQueryKey({ account: mode }) } })
useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey(), refetchInterval: 3000 } })
useGetWallet({ account: mode }, { query: { queryKey: getGetWalletQueryKey({ account: mode }), refetchInterval: 5000 } })
```

**Why:** React Query v5 made `queryKey` a required field in `UseQueryOptions`. Orval doesn't generate `Omit<UseQueryOptions, 'queryKey'>` for the override param, so callers must supply it. The `??` in the generated options function only falls back if the value is `null` or `undefined` — `[]` is neither, so it wins and becomes the actual cache key.
