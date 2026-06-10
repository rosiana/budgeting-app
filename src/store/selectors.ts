import { CATEGORIES } from '../theme';
import { Budgets, CategoryId, Transaction, WhoId } from '../types';
import { monthKey, toISODate } from '../utils/format';

export function txForMonth(
  transactions: Transaction[],
  mKey: string
): Transaction[] {
  return transactions.filter((t) => monthKey(t.date) === mKey);
}

export function totalSpent(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Distribute a transaction's amount across categories. When the transaction has
 * per-item categories, each item counts toward its own category and any
 * leftover (total − itemsSum) falls to the primary category. Items that exceed
 * the total are scaled down so category totals stay equal to the amount spent.
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
    if (itemsSum > t.amount && itemsSum > 0) {
      const scale = t.amount / itemsSum;
      t.items.forEach((it) => add(it.category, it.amount * scale));
    } else {
      t.items.forEach((it) => add(it.category, it.amount));
      const remainder = t.amount - itemsSum;
      if (remainder > 0.5) add(t.category, remainder);
    }
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
  for (const t of transactions) addToCategoryTotals(totals, t);
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

export interface WhoSpend {
  who: WhoId;
  spent: number;
}

export function spendByWho(transactions: Transaction[]): WhoSpend[] {
  const totals = {} as Record<WhoId, number>;
  for (const t of transactions) {
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

/** Spending per day for the last `days` days (oldest -> newest). */
export function dailySpend(transactions: Transaction[], days = 7): DayPoint[] {
  const points: DayPoint[] = [];
  const byDate = new Map<string, number>();
  for (const t of transactions) {
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
