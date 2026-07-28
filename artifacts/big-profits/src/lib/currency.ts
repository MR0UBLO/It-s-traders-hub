export const USD_RATE = 130; // 1 USD = 130 KES (approximate rate)

export const kesToUsd = (kes: number) => kes / USD_RATE;
export const usdToKes = (usd: number) => usd * USD_RATE;

export const fmtUsd = (kes: number) =>
  `$${(kes / USD_RATE).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtUsdRaw = (usd: number) =>
  `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtKesEq = (usd: number) =>
  `KES ${Math.round(usd * USD_RATE).toLocaleString("en-US")}`;
