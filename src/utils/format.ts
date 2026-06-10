export function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Compact currency for tight spaces, e.g. $1.2k */
export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return '$' + (amount / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return '$' + amount.toFixed(0);
}

/** yyyy-mm-dd in local time */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** yyyy-mm — the month bucket an ISO date belongs to */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

export function formatDateFriendly(isoDate: string): string {
  if (isoDate === todayISO()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate === toISODate(yesterday)) return 'Yesterday';
  return formatDateShort(isoDate);
}
