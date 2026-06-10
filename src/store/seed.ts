import { AppData, Budgets, Transaction } from '../types';
import { toISODate } from '../utils/format';
import { uid } from '../utils/id';

// Monthly limits in Rupiah, based on the couple's cashflow budgets.
export const DEFAULT_BUDGETS: Budgets = {
  cicilan: 2_600_000,
  listrik: 400_000,
  air: 50_000,
  internet: 375_000,
  skincare: 500_000,
  makan: 1_000_000,
  langganan: 500_000,
  art: 1_000_000,
  sekolah: 1_500_000,
  fun: 1_000_000,
  rumah: 1_500_000,
  lainnya: 1_000_000,
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
    merchant: 'Superindo',
    amount: 187_500,
    category: 'rumah',
    who: 'rumah',
    source: 'bca',
    createdAt: Date.now(),
    scanned: true,
    items: [
      { description: 'Beras 5kg', amount: 72_000, category: 'rumah' },
      { description: 'Minyak goreng 2L', amount: 38_500, category: 'rumah' },
      { description: 'Susu UHT', amount: 22_000, category: 'makan' },
      { description: 'Sabun cuci', amount: 25_000, category: 'rumah' },
      { description: 'Buah apel', amount: 30_000, category: 'makan' },
    ],
  },
  { id: uid(), date: daysAgo(0), merchant: 'Kopi Kenangan', amount: 22_000, category: 'makan', who: 'rosi', source: 'ovo', createdAt: Date.now() },
  { id: uid(), date: daysAgo(1), merchant: 'Token Listrik PLN', amount: 200_000, category: 'listrik', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), date: daysAgo(2), merchant: 'Gaji ART', amount: 1_000_000, category: 'art', who: 'rumah', source: 'mandiri', createdAt: Date.now() },
  { id: uid(), date: daysAgo(3), merchant: 'SPP Sekolah Nonik', amount: 850_000, category: 'sekolah', who: 'nonik', source: 'bsi', createdAt: Date.now() },
  { id: uid(), date: daysAgo(4), merchant: 'IndiHome', amount: 375_000, category: 'internet', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), date: daysAgo(5), merchant: 'Bioskop XXI', amount: 100_000, category: 'fun', who: 'rizal', source: 'bca', createdAt: Date.now() },
  { id: uid(), date: daysAgo(6), merchant: 'Somethinc', amount: 180_000, category: 'skincare', who: 'rosi', source: 'shopeepay', createdAt: Date.now() },
  { id: uid(), date: daysAgo(8), merchant: 'Indomaret', amount: 64_300, category: 'rumah', who: 'rumah', source: 'tunai', createdAt: Date.now() },
  { id: uid(), date: daysAgo(10), merchant: 'Netflix', amount: 186_000, category: 'langganan', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), date: daysAgo(12), merchant: 'PDAM', amount: 48_000, category: 'air', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), date: daysAgo(15), merchant: 'Warung Makan Padang', amount: 55_000, category: 'makan', who: 'rizal', source: 'tunai', createdAt: Date.now() },
];

export const SEED_DATA: AppData = {
  transactions: seedTransactions,
  budgets: DEFAULT_BUDGETS,
};
