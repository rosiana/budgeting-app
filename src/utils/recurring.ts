import { RecurringTx } from '../types';
import { monthKey, toISODate } from './format';

/**
 * Period key that a recurring transaction "belongs to" today. For a monthly
 * rec tx this is just the current YYYY-MM. For a tri-monthly (every 3 months)
 * rec tx it's the most recent anchor month <= today.
 *
 * Example: today = 2026-08-15, anchor = 1, intervalMonths = 3
 *   → anchor months are 1, 4, 7, 10 each year
 *   → most recent <= today is 2026-07 → returns "2026-07"
 */
export function currentPeriodKey(r: RecurringTx, today = new Date()): string {
  const y = today.getFullYear();
  const m1 = today.getMonth() + 1; // 1-12
  if (r.intervalMonths <= 1) {
    return monthKey(toISODate(today));
  }
  const anchor = clampMonth(r.anchorMonth ?? 1);
  const interval = r.intervalMonths;
  // Walk back from this month until we hit an anchor-aligned month.
  for (let back = 0; back < 12; back++) {
    const raw = m1 - back;
    const year = raw > 0 ? y : y + Math.floor((raw - 1) / 12);
    const month = ((((raw - 1) % 12) + 12) % 12) + 1; // 1-12
    if ((month - anchor + 120) % interval === 0) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }
  return monthKey(toISODate(today));
}

/** Next scheduled ISO date this rec tx's notification should fire (09:00 on
 *  the due day of the current or next period). */
export function nextDueDate(r: RecurringTx, today = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const period = currentPeriodKey(r, today);
  const [py, pm] = period.split('-').map(Number);
  const day = clampDayOfMonth(py, pm, r.dayOfMonth);
  const thisPeriodDue = new Date(py, pm - 1, day, 9, 0, 0);
  if (thisPeriodDue.getTime() > today.getTime()) return isoOf(thisPeriodDue);
  // Already past this period's due date → schedule for the NEXT active period.
  return isoOf(nextActivePeriodDate(r, today));
}

/** The exact ISO date+time of the NEXT active period (skipping the current
 *  one). Used both for scheduling and to display "berikutnya <date>". */
export function nextActivePeriodDate(r: RecurringTx, today = new Date()): Date {
  const y = today.getFullYear();
  const m1 = today.getMonth() + 1;
  const interval = r.intervalMonths <= 1 ? 1 : r.intervalMonths;
  const anchor = clampMonth(r.anchorMonth ?? m1);
  for (let ahead = 1; ahead < 24; ahead++) {
    const raw = m1 + ahead;
    const year = y + Math.floor((raw - 1) / 12);
    const month = ((((raw - 1) % 12) + 12) % 12) + 1;
    if ((month - anchor + 120) % interval === 0) {
      const day = clampDayOfMonth(year, month, r.dayOfMonth);
      return new Date(year, month - 1, day, 9, 0, 0);
    }
  }
  return new Date(y, m1 - 1, r.dayOfMonth, 9, 0, 0);
}

/** True if this rec tx hasn't been paid for the current active period yet. */
export function isUnpaidThisPeriod(r: RecurringTx, today = new Date()): boolean {
  const period = currentPeriodKey(r, today);
  return (r.lastPaidPeriod ?? '') < period;
}

function clampDayOfMonth(year: number, month1: number, day: number): number {
  const last = new Date(year, month1, 0).getDate();
  return Math.min(Math.max(1, day), last);
}

function clampMonth(m: number): number {
  return Math.min(Math.max(1, Math.round(m)), 12);
}

function isoOf(d: Date): string {
  return d.toISOString();
}
