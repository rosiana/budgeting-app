import { AppData, Budgets, Transaction } from '../types';
import { toISODate } from '../utils/format';
import { uid } from '../utils/id';

export const DEFAULT_BUDGETS: Budgets = {
  groceries: 500,
  dining: 250,
  transport: 150,
  shopping: 200,
  bills: 800,
  health: 100,
  entertainment: 120,
  other: 100,
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

const seedTransactions: Transaction[] = [
  {
    id: uid(),
    date: daysAgo(0),
    merchant: 'Whole Foods Market',
    amount: 64.32,
    category: 'groceries',
    createdAt: Date.now(),
    scanned: true,
    items: [
      { description: 'Organic bananas', amount: 3.49 },
      { description: 'Almond milk', amount: 4.99 },
      { description: 'Chicken breast', amount: 12.85 },
    ],
  },
  { id: uid(), date: daysAgo(1), merchant: 'Shell', amount: 48.1, category: 'transport', createdAt: Date.now() },
  { id: uid(), date: daysAgo(2), merchant: 'Blue Bottle Coffee', amount: 6.5, category: 'dining', createdAt: Date.now() },
  { id: uid(), date: daysAgo(3), merchant: 'Netflix', amount: 15.49, category: 'entertainment', createdAt: Date.now() },
  { id: uid(), date: daysAgo(4), merchant: 'Target', amount: 37.8, category: 'shopping', createdAt: Date.now() },
  { id: uid(), date: daysAgo(6), merchant: 'Trader Joe’s', amount: 52.17, category: 'groceries', createdAt: Date.now() },
  { id: uid(), date: daysAgo(8), merchant: 'Chipotle', amount: 13.25, category: 'dining', createdAt: Date.now() },
  { id: uid(), date: daysAgo(10), merchant: 'PG&E', amount: 96.4, category: 'bills', createdAt: Date.now() },
  { id: uid(), date: daysAgo(12), merchant: 'CVS Pharmacy', amount: 24.99, category: 'health', createdAt: Date.now() },
  { id: uid(), date: daysAgo(15), merchant: 'Uber', amount: 18.7, category: 'transport', createdAt: Date.now() },
];

export const SEED_DATA: AppData = {
  transactions: seedTransactions,
  budgets: DEFAULT_BUDGETS,
};
