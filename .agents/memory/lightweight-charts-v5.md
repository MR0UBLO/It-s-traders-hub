---
name: Lightweight-charts v5 API changes
description: Breaking API changes in lightweight-charts v5 vs v4 that affect TradersHub trade page chart.
---

**Rule:** `chart.addAreaSeries(opts)` was removed in v5. Use `chart.addSeries(AreaSeries, opts)` instead.

**Import pattern:**
```ts
import { createChart, IChartApi, ISeriesApi, ColorType, AreaSeries, Time } from "lightweight-charts";
// Ref type:
const seriesRef = useRef<ISeriesApi<"Area", Time> | null>(null);
// Create:
const series = chart.addSeries(AreaSeries, { lineColor, topColor, bottomColor, lineWidth });
```

**Why:** v5 moved to a plugin-based series architecture. Old `addAreaSeries` etc. are gone. Also `ISeriesApi` second generic is `Time` (not `number`) since `Time = string | BusinessDay | number`.
