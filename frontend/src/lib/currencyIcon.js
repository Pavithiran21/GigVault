import {
  IconCurrencyDirham,
  IconCurrencyDollar,
  IconCurrencyEuro,
  IconCurrencyPound,
  IconCurrencyRupee,
} from '@tabler/icons-react';

const ICONS = {
  INR: IconCurrencyRupee,
  EUR: IconCurrencyEuro,
  GBP: IconCurrencyPound,
  AED: IconCurrencyDirham,
};

/** The icon at the start of an amount field: ₹ for INR, $ for USD, AUD, CAD and SGD, and so on. */
export function currencyIcon(currency) {
  return ICONS[currency] ?? IconCurrencyDollar;
}
