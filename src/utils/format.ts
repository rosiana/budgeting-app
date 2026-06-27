/** Group integer digits with "." thousands separators (Indonesian style). */
function groupThousands(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + s;
}

/** Rupiah, no decimals: e.g. Rp187.500 */
export function formatCurrency(amount: number): string {
  return 'Rp' + groupThousands(amount);
}

/** Mask amounts as Rp•••••• when the user has toggled privacy mode. */
export function maybeMask(text: string, hidden: boolean): string {
  if (!hidden) return text;
  // Replace digit runs with dots so the layout doesn't jump too much.
  return text.replace(/\d[\d.,]*/g, (m) => '•'.repeat(Math.max(3, Math.min(7, m.replace(/[.,]/g, '').length))));
}

/** Compact Rupiah for tight spaces: Rp1,2jt / Rp250rb / Rp2M */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  if (abs >= 1_000_000_000) return `${sign}Rp${trim(abs / 1_000_000_000)}M`;
  if (abs >= 1_000_000) return `${sign}Rp${trim(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${sign}Rp${trim(abs / 1_000)}rb`;
  return `${sign}Rp${Math.round(abs)}`;
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

/** Shift a yyyy-mm month key by `delta` months. */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatDateShort(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** Full Indonesian date, e.g. "1 Juni 2026". */
export function formatDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateFriendly(isoDate: string): string {
  if (isoDate === todayISO()) return 'Hari ini';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (isoDate === toISODate(yesterday)) return 'Kemarin';
  return formatDateShort(isoDate);
}
