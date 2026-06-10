import { CATEGORIES } from '../theme';
import { Budgets, CategoryId, Transaction } from '../types';
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
  for (const t of transactions) {
    totals[t.category] = (totals[t.category] ?? 0) + t.amount;
  }
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

export interface DayPoint {
  label: string; // day-of-month
  iso: string;
  value: number;
}

/** Spending per day for the last `days` days (oldest -> newest). */
export function dailySpend(
  transactions: Transaction[],
  days = 7
): DayPoint[] {
  const points: DayPoint[] = [];
  const byDate = new Map<string, number>();
  for (const t of transactions) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = toISODate(d);
    points.push({
      iso,
      label: String(d.getDate()),
      value: byDate.get(iso) ?? 0,
    });
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
