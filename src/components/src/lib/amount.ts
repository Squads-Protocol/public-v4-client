/**
 * Converts a user-entered decimal amount into base units (lamports or the
 * smallest unit of a token) using integer arithmetic only.
 *
 * Using `parseFloat(amount) * 10 ** decimals` loses precision for large
 * balances and can produce fractional base units, which the runtime rejects.
 * Returns `null` for malformed input or for more fractional digits than the
 * mint supports.
 */
export const parseAmountToBaseUnits = (amount: string, decimals: number): bigint | null => {
  const normalized = amount.trim();
  
  // Ensure strict validation of the numerical pattern
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [whole, fraction = ''] = normalized.split('.');
  
  // Reject if the fractional part exceeds the allowed token decimals
  if (fraction.length > decimals) {
    return null;
  }

  // Combine directly as BigInt string concatenation for exact base unit representation
  return BigInt(`${whole}${fraction.padEnd(decimals, '0')}`);
};