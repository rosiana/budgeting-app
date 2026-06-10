import { CreditCardConfig } from '../types';
import { todayISO } from './format';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function clampDay(year: number, monthIndex0: number, day: number): number {
  // Last day of the given month, so day 31 in February becomes the 28th/29th.
  const last = new Date(year, monthIndex0 + 1, 0).getDate();
  return Math.min(day, last);
}

/**
 * BCA-style due date for a credit-card purchase: purchases on/before the
 * statement cutoff land on this month's statement (due this month); purchases
 * after the cutoff roll to next month's statement (due next month). The due day
 * sits after the cutoff in the statement month.
 */
export function ccDueDate(expenseISO: string, cfg: CreditCardConfig): string {
  const [y, m, d] = expenseISO.split('-').map(Number);
  // Statement month (1-based month, may overflow to next year).
  let stmtY = y;
  let stmtM = m;
  if (d > cfg.statementDay) {
    stmtM += 1;
    if (stmtM > 12) {
      stmtM = 1;
      stmtY += 1;
    }
  }
  // Due date: same statement month when dueDay is after the cutoff, else next.
  let dueY = stmtY;
  let dueM = stmtM;
  if (cfg.dueDay <= cfg.statementDay) {
    dueM += 1;
    if (dueM > 12) {
      dueM = 1;
      dueY += 1;
    }
  }
  const day = clampDay(dueY, dueM - 1, cfg.dueDay);
  return `${dueY}-${pad(dueM)}-${pad(day)}`;
}

/** A CC purchase counts as settled once its due date is on or before today. */
export function isCcSettled(expenseISO: string, cfg: CreditCardConfig): boolean {
  return ccDueDate(expenseISO, cfg) <= todayISO();
}

/** The next upcoming due date from today (the next time a bill must be paid). */
export function nextDueDate(cfg: CreditCardConfig): string {
  const now = new Date();
  const d = now.getDate();
  let y = now.getFullYear();
  let mIndex = now.getMonth(); // 0-based
  if (d > cfg.dueDay) {
    mIndex += 1;
    if (mIndex > 11) {
      mIndex = 0;
      y += 1;
    }
  }
  const day = clampDay(y, mIndex, cfg.dueDay);
  return `${y}-${pad(mIndex + 1)}-${pad(day)}`;
}
