import { CATEGORIES, INCOME_CATEGORIES, SOURCES } from '../theme';
import {
  Budgets,
  CategoryId,
  CreditCardConfig,
  IncomeCategoryId,
  SourceId,
  Transaction,
  WhoId,
} from '../types';
import { ccDueDate, isCcSettled } from '../utils/cc';
import { monthKey, toISODate } from '../utils/format';

export function txForMonth(
  transactions: Transaction[],
  mKey: string
): Transaction[] {
  return transactions.filter((t) => monthKey(t.date) === mKey);
}

const isExpense = (t: Transaction) => t.type !== 'income';
const isIncome = (t: Transaction) => t.type === 'income';
// Reimbursable expenses are the company's cost (we'll get them back), transfer
// legs are money moving between accounts (not spending), and balance
// adjustments are corrections — none of these should pollute the
// spending/budget/income totals.
// A CC purchase that hasn't hit its due date AND wasn't manually paid via
// Bayar Tagihan is "pending" — it must not affect the daily subtotal,
// Anggaran, or Saldo yet. When `cc` isn't supplied we fall back to treating
// nothing as pending (safe for callers that pre-filter).
export function isCcPending(t: Transaction, cc?: CreditCardConfig): boolean {
  return !!t.creditCard && !!cc && !isCcSettled(t, cc);
}

// NB: we can NO LONGER blanket-exclude rows that carry a transferGroup —
// a Transfer now saves three legs, and the third (Biaya / Diskon Transfer)
// IS real spending / income on top of the "money moved" pair. What we
// exclude is the moved-pair itself via the category / incomeCategory check.
//
// Reimbursed rows also drop out of spending totals: once the money came back
// the expense effectively neutralized itself. Reimbursable-but-not-yet-
// reimbursed still counts (the money is out until the payback arrives).
//
// Penyesuaian Saldo / Investasi (both expense and income variants) DO count —
// they represent real changes to net worth that period (fees, interest,
// investment P&L) and need to show up in "Pengeluaran bulan ini" on the
// Dashboard and the day-net on Transaksi.
const countsAsSpending = (t: Transaction, cc?: CreditCardConfig) =>
  isExpense(t) &&
  !t.reimbursed &&
  !isCcPending(t, cc) &&
  t.category !== 'transfer_out';
const countsAsIncome = (t: Transaction) =>
  isIncome(t) &&
  t.incomeCategory !== 'transfer_in' &&
  // Refunds add to a source balance but are NOT new income — they're a
  // return of an existing expense, so we net them out of category totals
  // separately (see addToCategoryTotals) rather than count them here.
  t.incomeCategory !== 'refund';

/** True when a row is a refund of an existing expense. */
export const isRefund = (t: Transaction): boolean =>
  t.type === 'income' && t.incomeCategory === 'refund';

/** Total expenses (income, reimbursed, and pending CC purchases ignored),
 *  net of every refund. A refund is treated as a negative expense against
 *  its own recorded amount — you spent Rp 1.3 mio then got Rp 400 k back, so
 *  the "Pengeluaran bulan ini" number is Rp 900 k. */
export function totalSpent(
  transactions: Transaction[],
  cc?: CreditCardConfig
): number {
  const spent = transactions
    .filter((t) => countsAsSpending(t, cc))
    .reduce((sum, t) => sum + t.amount, 0);
  const refunded = transactions
    .filter(isRefund)
    .reduce((sum, t) => sum + t.amount, 0);
  return Math.max(0, spent - refunded);
}

export function totalIncome(transactions: Transaction[]): number {
  return transactions.filter(countsAsIncome).reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Distribute an expense's amount across categories. When it has per-item
 * categories, each item counts toward its own category and any leftover
 * (total − itemsSum) falls to the primary category. Items exceeding the total
 * are scaled down so category totals stay equal to the amount spent.
 */
function addToCategoryTotals(
  totals: Record<CategoryId, number>,
  t: Transaction
): void {
  const add = (cat: CategoryId, v: number) => {
    totals[cat] = (totals[cat] ?? 0) + v;
  };
  if (t.items && t.items.length) {
    const itemsSum = t.items.reduce((s, it) => s + it.amount, 0);
    t.items.forEach((it) => add(it.category, it.amount));
    const remainder = t.amount - itemsSum;
    // Positive remainder = extra cost on top of the items (tax / service fee /
    //   tip) → goes to Biaya / Pajak Transaksi.
    // Negative remainder = the basket was discounted at checkout → goes as a
    //   negative entry to Diskon, which keeps the parent's `amount` consistent
    //   with the sum of all category contributions.
    if (remainder > 0.5) add('biaya_pajak', remainder);
    else if (remainder < -0.5) add('diskon', remainder);
  } else {
    add(t.category, t.amount);
  }
}

/** Reverse of addToCategoryTotals for a refund row — subtracts each item's
 *  amount from its category so Anggaran / Pengeluaran show the net spend
 *  after the return. Refund shape mirrors the original expense (single-
 *  amount or items[]), just with type='income' and incomeCategory='refund'. */
function subtractRefundFromCategoryTotals(
  totals: Record<CategoryId, number>,
  t: Transaction
): void {
  const sub = (cat: CategoryId, v: number) => {
    totals[cat] = (totals[cat] ?? 0) - v;
  };
  if (t.items && t.items.length) {
    t.items.forEach((it) => sub(it.category, it.amount));
  } else {
    sub(t.category, t.amount);
  }
}

export interface CategorySpend {
  category: CategoryId;
  spent: number;
  budget: number;
  pct: number; // 0..1+ of budget used
}

export function spendByCategory(
  transactions: Transaction[],
  budgets: Budgets,
  cc?: CreditCardConfig
): CategorySpend[] {
  const totals = {} as Record<CategoryId, number>;
  for (const t of transactions) {
    if (countsAsSpending(t, cc)) addToCategoryTotals(totals, t);
    else if (isRefund(t)) subtractRefundFromCategoryTotals(totals, t);
  }
  // Clamp to zero so a category that received more in refunds than it ever
  // saw in spending doesn't show a negative "spent" total on Anggaran.
  Object.keys(totals).forEach((k) => {
    const c = k as CategoryId;
    if (totals[c] < 0) totals[c] = 0;
  });
  return CATEGORIES.map((c) => {
    const spent = totals[c.id] ?? 0;
    const budget = budgets[c.id] ?? 0;
    return {
      category: c.id,
      spent,
      budget,
      pct: budget > 0 ? spent / budget : spent > 0 ? 1 : 0,
    };
  }).sort((a, b) => b.spent - a.spent);
}

export interface IncomeSpend {
  category: IncomeCategoryId;
  amount: number;
}

export function incomeByCategory(transactions: Transaction[]): IncomeSpend[] {
  const totals = {} as Record<IncomeCategoryId, number>;
  for (const t of transactions) {
    if (!countsAsIncome(t)) continue;
    const c = t.incomeCategory ?? 'lainnya_in';
    totals[c] = (totals[c] ?? 0) + t.amount;
  }
  return INCOME_CATEGORIES.map((c) => ({ category: c.id, amount: totals[c.id] ?? 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export interface WhoSpend {
  who: WhoId;
  spent: number;
}

export function spendByWho(
  transactions: Transaction[],
  cc?: CreditCardConfig
): WhoSpend[] {
  const totals = {} as Record<WhoId, number>;
  const add = (who: WhoId, v: number) => {
    totals[who] = (totals[who] ?? 0) + v;
  };
  for (const t of transactions) {
    if (countsAsSpending(t, cc)) {
      // Multi-item transactions can have per-item `who` (a mixed Superindo
      // basket where some items are for Nonik, others for Rumah). Distribute
      // per item so each person gets credit for THEIR items; any Biaya/Diskon
      // remainder falls to the parent's who.
      if (t.items && t.items.length) {
        const itemsSum = t.items.reduce((s, it) => s + it.amount, 0);
        for (const it of t.items) add(it.who ?? t.who, it.amount);
        const remainder = t.amount - itemsSum;
        if (Math.abs(remainder) >= 0.5) add(t.who, remainder);
      } else {
        add(t.who, t.amount);
      }
    } else if (isRefund(t)) {
      // Refunds reduce whichever person's spending they refund. Mirror the
      // shape: per-item subtraction for a multi-item return, else use the
      // parent-level who.
      if (t.items && t.items.length) {
        for (const it of t.items) add(it.who ?? t.who, -it.amount);
      } else {
        add(t.who, -t.amount);
      }
    }
  }
  // Never surface negative totals (heavy refunds on one person shouldn't
  // read like "Nonik earned money this month").
  (Object.keys(totals) as WhoId[]).forEach((w) => {
    if (totals[w] < 0) totals[w] = 0;
  });
  return (Object.keys(totals) as WhoId[])
    .map((who) => ({ who, spent: totals[who] }))
    .sort((a, b) => b.spent - a.spent);
}

export interface DayPoint {
  label: string; // day-of-month
  iso: string;
  value: number;
}

/** Expense spending per day for the last `days` days (oldest -> newest). */
export function dailySpend(
  transactions: Transaction[],
  days = 7,
  cc?: CreditCardConfig
): DayPoint[] {
  const points: DayPoint[] = [];
  const byDate = new Map<string, number>();
  for (const t of transactions) {
    if (countsAsSpending(t, cc)) {
      byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
    } else if (isRefund(t)) {
      // Refund lowers the day's spending on the refund's own date.
      byDate.set(t.date, (byDate.get(t.date) ?? 0) - t.amount);
    }
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = toISODate(d);
    points.push({ iso, label: String(d.getDate()), value: byDate.get(iso) ?? 0 });
  }
  return points;
}

export function groupByDate(
  transactions: Transaction[]
): { date: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date)!.push(t);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

// --- Balances & credit card ------------------------------------------------

export interface SourceBalance {
  source: SourceId;
  balance: number;
}

/**
 * Running balance per source:
 *   opening + income(source) − cash expenses(source) − settled CC bills(paySrc)
 * Credit-card expenses don't reduce a balance until their due date passes,
 * at which point the lump is deducted from the CC payment account.
 */
export function sourceBalances(
  transactions: Transaction[],
  opening: Partial<Record<SourceId, number>>,
  cc: CreditCardConfig
): SourceBalance[] {
  const bal = {} as Record<SourceId, number>;
  for (const s of SOURCES) bal[s.id] = opening[s.id] ?? 0;

  // Net of settled CC purchases MINUS settled CC refunds. Purchases in a
  // cycle whose due date has passed hit paymentSource; refunds in a settled
  // cycle credit paymentSource. Refunds landing in a later cycle stay on the
  // CC side (they'll net against that cycle's purchases when it settles).
  let settledCc = 0;
  for (const t of transactions) {
    if (isIncome(t)) {
      // A CC refund's credit goes back to the credit-card side, not the
      // source account. Fold it into settledCc via the cycle logic; the
      // regular income path below runs only for non-CC income.
      if (isRefund(t) && t.creditCard) {
        if (isCcSettled(t, cc)) settledCc -= t.amount;
        continue;
      }
      bal[t.source] = (bal[t.source] ?? 0) + t.amount;
      continue;
    }
    // A reimbursed expense is netted to zero — money went out then came back.
    if (t.reimbursed) continue;
    if (t.creditCard) {
      if (isCcSettled(t, cc)) settledCc += t.amount;
    } else {
      bal[t.source] = (bal[t.source] ?? 0) - t.amount;
    }
  }
  bal[cc.paymentSource] = (bal[cc.paymentSource] ?? 0) - settledCc;

  return SOURCES.map((s) => ({ source: s.id, balance: bal[s.id] ?? 0 }));
}

export function totalBalance(balances: SourceBalance[]): number {
  return balances.reduce((s, b) => s + b.balance, 0);
}

/**
 * Month-end total balance for the last 12 months, derived from actual
 * transactions (no dummy data). For each month, we recompute balances using
 * only the transactions up to and including that month's last day.
 */
export interface MonthBalance {
  key: string; // yyyy-mm
  total: number;
}
export function monthlyBalances(
  transactions: Transaction[],
  opening: Partial<Record<SourceId, number>>,
  cc: CreditCardConfig,
  months = 12
): MonthBalance[] {
  const out: MonthBalance[] = [];
  const today = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - i + 1, 0); // last day of month
    const cutoffIso = toISODate(ref);
    const upTo = transactions.filter((t) => t.date <= cutoffIso);
    const total = totalBalance(sourceBalances(upTo, opening, cc));
    const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, total });
  }
  return out;
}

/** Total refunded so far against a specific original expense. */
export function totalRefundedFor(
  transactions: Transaction[],
  originalId: string
): number {
  return transactions
    .filter((t) => isRefund(t) && t.refundOf === originalId)
    .reduce((s, t) => s + t.amount, 0);
}

/** All refund rows linked to a specific original expense. */
export function refundsFor(
  transactions: Transaction[],
  originalId: string
): Transaction[] {
  return transactions.filter((t) => isRefund(t) && t.refundOf === originalId);
}

/** Reimbursable expenses still awaiting payback (either not marked reimbursed
 *  the old way, OR the linked refund rows don't yet cover the full amount).
 *  As we migrate away from the boolean `reimbursed` flag, both mechanisms
 *  stay honored so existing data doesn't break. */
export function pendingReimbursements(transactions: Transaction[]): Transaction[] {
  return transactions
    .filter((t) => {
      if (!isExpense(t) || !t.reimbursable) return false;
      if (t.reimbursed) return false; // legacy shortcut still works
      // New model: pending until refund rows cover the original amount.
      const refunded = totalRefundedFor(transactions, t.id);
      return refunded + 0.5 < t.amount;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function reimbursementOutstanding(transactions: Transaction[]): number {
  return pendingReimbursements(transactions).reduce((s, t) => {
    const refunded = totalRefundedFor(transactions, t.id);
    return s + Math.max(0, t.amount - refunded);
  }, 0);
}

export interface CreditCardStatus {
  /** Unpaid CC purchases (due date still in the future). */
  outstanding: number;
  /** The next due date (ISO) bills must be paid. */
  nextDue: string;
  /** Amount due specifically on that next due date. */
  dueNext: number;
}

export function creditCardStatus(
  transactions: Transaction[],
  cc: CreditCardConfig
): CreditCardStatus {
  let outstanding = 0;
  const dueBuckets = new Map<string, number>();
  const bucket = (date: string, delta: number) => {
    outstanding += delta;
    const due = ccDueDate(date, cc);
    dueBuckets.set(due, (dueBuckets.get(due) ?? 0) + delta);
  };
  for (const t of transactions) {
    if (!t.creditCard) continue;
    if (isCcSettled(t, cc)) continue;
    if (isRefund(t)) {
      // A CC refund in a still-unsettled cycle credits that cycle's total.
      bucket(t.date, -t.amount);
    } else if (isIncome(t)) {
      // Non-refund income on a CC (uncommon) doesn't affect the bill.
      continue;
    } else {
      bucket(t.date, t.amount);
    }
  }
  // The soonest unpaid due date with a non-zero balance.
  const nextDue = [...dueBuckets.entries()]
    .filter(([, v]) => Math.abs(v) >= 0.5)
    .map(([k]) => k)
    .sort()[0] ?? '';
  return { outstanding, nextDue, dueNext: nextDue ? dueBuckets.get(nextDue)! : 0 };
}
