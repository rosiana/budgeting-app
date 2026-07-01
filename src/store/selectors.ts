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
// NB: we can NO LONGER blanket-exclude rows that carry a transferGroup —
// a Transfer now saves three legs, and the third (Biaya / Diskon Transfer)
// IS real spending / income on top of the "money moved" pair. What we
// exclude is the moved-pair itself, done via the category / incomeCategory
// check instead.
const countsAsSpending = (t: Transaction) =>
  isExpense(t) &&
  !t.reimbursable &&
  t.category !== 'penyesuaian_saldo' &&
  t.category !== 'transfer_out' &&
  t.category !== 'rugi_investasi';
const countsAsIncome = (t: Transaction) =>
  isIncome(t) &&
  t.incomeCategory !== 'penyesuaian_saldo_in' &&
  t.incomeCategory !== 'transfer_in' &&
  t.incomeCategory !== 'investasi';

/** Total expenses (income and reimbursables ignored). */
export function totalSpent(transactions: Transaction[]): number {
  return transactions.filter(countsAsSpending).reduce((sum, t) => sum + t.amount, 0);
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

export interface CategorySpend {
  category: CategoryId;
  spent: number;
  budget: number;
  pct: number; // 0..1+ of budget used
}

export function spendByCategory(
  transactions: Transaction[],
  budgets: Budgets
): CategorySpend[] {
  const totals = {} as Record<CategoryId, number>;
  for (const t of transactions) if (countsAsSpending(t)) addToCategoryTotals(totals, t);
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

export function spendByWho(transactions: Transaction[]): WhoSpend[] {
  const totals = {} as Record<WhoId, number>;
  for (const t of transactions) {
    if (!countsAsSpending(t)) continue;
    totals[t.who] = (totals[t.who] ?? 0) + t.amount;
  }
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
export function dailySpend(transactions: Transaction[], days = 7): DayPoint[] {
  const points: DayPoint[] = [];
  const byDate = new Map<string, number>();
  for (const t of transactions) {
    if (!countsAsSpending(t)) continue;
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
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

  let settledCc = 0;
  for (const t of transactions) {
    if (isIncome(t)) {
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

/** Reimbursable expenses still awaiting payback from the company. */
export function pendingReimbursements(transactions: Transaction[]): Transaction[] {
  return transactions
    .filter((t) => isExpense(t) && t.reimbursable && !t.reimbursed)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function reimbursementOutstanding(transactions: Transaction[]): number {
  return pendingReimbursements(transactions).reduce((s, t) => s + t.amount, 0);
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
  for (const t of transactions) {
    if (isIncome(t) || !t.creditCard) continue;
    if (isCcSettled(t, cc)) continue;
    outstanding += t.amount;
    const due = ccDueDate(t.date, cc);
    dueBuckets.set(due, (dueBuckets.get(due) ?? 0) + t.amount);
  }
  // The soonest unpaid due date.
  const nextDue = [...dueBuckets.keys()].sort()[0] ?? '';
  return { outstanding, nextDue, dueNext: nextDue ? dueBuckets.get(nextDue)! : 0 };
}
