// Money arrives from the API as a string with two decimals ("12500.00") and stays a string.
// It is never turned into a JavaScript number for display or for sums, because a float can't
// hold most cent values exactly (0.1 + 0.2 !== 0.3). See FRONTEND.md "Money and dates".

const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'AED ' };

export function currencySymbol(currency) {
  return SYMBOLS[currency] ?? '';
}

/** "482350" → "4,82,350" for INR (Indian grouping), "482,350" for every other currency. */
function groupDigits(digits, currency) {
  const groups = [];
  let rest = digits;
  if (currency === 'INR' && rest.length > 3) {
    // The last three digits, then groups of two: 4,82,350.
    groups.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
  } else {
    while (rest.length > 3) {
      groups.unshift(rest.slice(-3));
      rest = rest.slice(0, -3);
    }
  }
  groups.unshift(rest);
  return groups.join(',');
}

/** The pieces of an amount, for the hero's large figure: { symbol: '₹', whole: '4,82,350', cents: '00' }. */
export function moneyParts(amount, currency) {
  const [whole = '0', fraction = ''] = String(amount).split('.');
  const digits = whole.replace(/^0+(?=\d)/, '');
  return {
    symbol: currencySymbol(currency),
    whole: groupDigits(digits, currency),
    cents: (fraction + '00').slice(0, 2),
  };
}

/** "482350.00" → "₹4,82,350.00" (INR) or "A$482,350.00" (AUD). Exact: only the string is reshaped. */
export function formatMoney(amount, currency) {
  const { symbol, whole, cents } = moneyParts(amount, currency);
  return `${symbol}${whole}.${cents}`;
}

/**
 * Short labels for the chart and the donut centre only (UI-UX.md "Compact numbers"):
 * ₹56.5k, ₹4.82L, A$482.4k, $1.2M. These are rounded on purpose, so Number() is fine here;
 * every exact amount on screen comes from formatMoney.
 */
export function compactMoney(amount, currency) {
  const value = Number(amount);
  const symbol = currencySymbol(currency).trim();
  const trim = (text) => text.replace(/\.?0+$/, '');
  if (currency === 'INR') {
    if (value >= 1e7) return `${symbol}${trim((value / 1e7).toFixed(2))}Cr`;
    if (value >= 1e5) return `${symbol}${trim((value / 1e5).toFixed(2))}L`;
  } else if (value >= 1e6) {
    return `${symbol}${trim((value / 1e6).toFixed(1))}M`;
  }
  if (value >= 1e3) return `${symbol}${trim((value / 1e3).toFixed(1))}k`;
  return `${symbol}${Math.round(value)}`;
}

/** "12500.5" → 1250050n. Exact integer cents, for the few places the screen compares or adds amounts. */
export function toCents(amount) {
  const [whole = '0', fraction = ''] = String(amount).split('.');
  return BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
}

function fromCents(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

/** a + b, exactly (for the delete-payment preview: "will show ₹25,000.00 outstanding again"). */
export function addMoney(a, b) {
  return fromCents(toCents(a) + toCents(b));
}

/** Whole percent paid, rounded down, so a gig that is 99.9% paid never reads "100% paid". */
export function percentPaid(received, agreed) {
  const agreedCents = toCents(agreed);
  if (agreedCents === 0n) {
    return 0;
  }
  return Number((toCents(received) * 100n) / agreedCents);
}

/** Bar width in percent for drawing only (progress bars, chart points). */
export function shareOf(part, total) {
  const totalCents = toCents(total);
  if (totalCents === 0n) {
    return 0;
  }
  return Math.min(100, (Number(toCents(part)) / Number(totalCents)) * 100);
}

/** What the user typed in an amount field, cleaned of grouping: "45,000" → "45000". */
export function cleanAmount(text) {
  return String(text ?? '').replace(/[\s,]/g, '');
}

const MAX_CENTS = 999999999999n; // 9,999,999,999.99, the backend's limit

/** The UI-UX.md message for an invalid amount, or null. The same rules as the backend's parse_amount. */
export function amountError(text) {
  const value = cleanAmount(text);
  if (!/^(\d+\.?\d*|\.\d+)$/.test(value)) {
    return 'Enter an amount greater than 0.';
  }
  const fraction = value.split('.')[1] ?? '';
  if (fraction.length > 2) {
    return 'Use at most 2 decimal places.';
  }
  const cents = toCents(value);
  if (cents === 0n) {
    return 'Enter an amount greater than 0.';
  }
  if (cents > MAX_CENTS) {
    return 'Enter an amount below 10,000,000,000.';
  }
  return null;
}
