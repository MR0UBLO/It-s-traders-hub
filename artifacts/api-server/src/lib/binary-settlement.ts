/**
 * Single source of truth for binary-trade payout math.
 * The stake is deducted when the trade opens, so on a win the wallet receives
 * the original stake plus the profit. On a loss, nothing is credited because
 * the stake has already been deducted.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateBinarySettlement(
  stake: number,
  payoutPercent: number,
  win: boolean,
) {
  const normalizedStake = roundCurrency(stake);
  const normalizedPayoutPercent = Number.isFinite(payoutPercent) ? payoutPercent : 95;

  if (!win) {
    return {
      profit: roundCurrency(-normalizedStake),
      returnAmount: 0,
    };
  }

  const profit = roundCurrency(normalizedStake * (normalizedPayoutPercent / 100));
  return {
    profit,
    returnAmount: roundCurrency(normalizedStake + profit),
  };
}
