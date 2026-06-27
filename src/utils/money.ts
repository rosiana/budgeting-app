import { useBudget } from '../store/BudgetContext';
import { formatCurrency, maybeMask } from './format';

/**
 * Hook to format Rupiah while respecting the user's privacy toggle. Use
 * `const money = useMoney();` then `<Text>{money(123_000)}</Text>` anywhere.
 */
export function useMoney() {
  const { privacyMode } = useBudget();
  return (n: number) => maybeMask(formatCurrency(n), privacyMode);
}

/** Format the digits the user typed into an amount input with "." separators. */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').replace(/^0+(\d)/, '$1');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Parse an "1.234.567" style input back into a number. */
export function parseAmountInput(s: string): number {
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
}
