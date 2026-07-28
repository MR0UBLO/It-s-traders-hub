---
name: Orval generated hooks + React Query v5 queryKey requirement
description: TypeScript error when passing only refetchInterval to Orval-generated React Query v5 hooks.
---

**Rule:** Orval-generated hooks accept `{ query?: UseQueryOptions<...> }`. In RQ v5, `UseQueryOptions` requires `queryKey`. Pass `queryKey: []` as a stub — the hook's internal `getGet*QueryOptions()` overrides it at runtime.

**Pattern:**
```ts
useGetMarketPrices({ query: { queryKey: [], refetchInterval: 3000 } })
useGetPriceHistory(symbol, { query: { queryKey: [], enabled: !!symbol, refetchInterval: 3000 } })
```

**Why:** React Query v5 made `queryKey` a required field in `UseQueryOptions`. Orval doesn't yet generate `Omit<UseQueryOptions, 'queryKey'>` for the override param type, so callers must include it even though it's ignored.
