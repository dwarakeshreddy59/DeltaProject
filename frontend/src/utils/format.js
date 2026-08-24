/**
 * Shared number formatting utilities.
 */

/** Format as Indian Rupee string: ₹ 1,23,456.78 */
export const inr = (n) =>
  "₹ " +
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

/** Format as plain number with 2 decimal places */
export const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);
