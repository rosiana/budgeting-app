import { DEFAULT_CREDIT_CARD } from '../theme';
import { AppData, Budgets, SourceId, Transaction } from '../types';
import { toISODate } from '../utils/format';
import { uid } from '../utils/id';

// Monthly limits in Rupiah, based on the couple's cashflow budgets.
export const DEFAULT_BUDGETS: Budgets = {
  cicilan: 2_600_000,
  utilitas: 825_000, // listrik + air + internet
  transportasi: 700_000,
  skincare: 500_000, // Personal Care
  makan: 1_000_000,
  langganan: 500_000,
  art: 1_000_000,
  sekolah: 1_500_000,
  fun: 1_000_000,
  rumah: 1_500_000,
  perabot: 500_000,
  fashion: 500_000,
  rokok: 500_000,
  sedekah: 500_000,
  kesehatan: 500_000,
  investasi_luar: 1_000_000,
  // Internal categories — kept at 0 since they're system-generated and not
  // really budgeted against; also hidden from Anggaran.
  biaya_pajak: 0,
  diskon: 0,
  rugi_investasi: 0,
  penyesuaian_saldo: 0,
  transfer_out: 0,
  lainnya: 1_000_000,
};

// Start at zero — open Saldo to set your real opening balance per account.
export const DEFAULT_OPENING_BALANCES: Partial<Record<SourceId, number>> = {};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

// Start empty — users add their own data.
const seedTransactions: Transaction[] = [];

// Sample data kept here for reference but no longer used by SEED_DATA.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _seedTransactionsSample: Transaction[] = [
  // Income
  { id: uid(), type: 'income', date: daysAgo(2), merchant: 'Gaji Rizal', amount: 18_000_000, category: 'lainnya', incomeCategory: 'gaji', who: 'rizal', source: 'bca', createdAt: Date.now() },
  { id: uid(), type: 'income', date: daysAgo(2), merchant: 'Gaji Rosi', amount: 12_000_000, category: 'lainnya', incomeCategory: 'gaji', who: 'rosi', source: 'mandiri', createdAt: Date.now() },
  { id: uid(), type: 'income', date: daysAgo(6), merchant: 'Bunga SeaBank', amount: 35_000, category: 'lainnya', incomeCategory: 'bunga', who: 'rumah', source: 'seabank', createdAt: Date.now() },

  // Expenses
  {
    id: uid(),
    type: 'expense',
    date: daysAgo(0),
    merchant: 'Superindo',
    amount: 187_500,
    category: 'rumah',
    who: 'rumah',
    source: 'bca',
    creditCard: true,
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
  { id: uid(), type: 'expense', date: daysAgo(0), merchant: 'Kopi Kenangan', amount: 22_000, category: 'makan', who: 'rosi', source: 'ovo', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(1), merchant: 'Token Listrik PLN', amount: 200_000, category: 'utilitas', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(2), merchant: 'Gaji ART', amount: 1_000_000, category: 'art', who: 'rumah', source: 'mandiri', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(3), merchant: 'SPP Sekolah Nonik', amount: 850_000, category: 'sekolah', who: 'nonik', source: 'bsi', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(4), merchant: 'IndiHome', amount: 375_000, category: 'utilitas', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(5), merchant: 'Bioskop XXI', amount: 100_000, category: 'fun', who: 'rizal', source: 'bca', creditCard: true, createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(6), merchant: 'Somethinc', amount: 180_000, category: 'skincare', who: 'rosi', source: 'shopeepay_rosi', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(8), merchant: 'Indomaret', amount: 64_300, category: 'rumah', who: 'rumah', source: 'tunai_rosi', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(10), merchant: 'Netflix', amount: 186_000, category: 'langganan', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(7), merchant: 'Claude Pro', amount: 320_000, category: 'langganan', who: 'rizal', source: 'bca', creditCard: true, reimbursable: true, createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(9), merchant: 'Uniqlo', amount: 299_000, category: 'fashion', who: 'rosi', source: 'bca', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(11), merchant: 'Rokok Sampoerna', amount: 38_000, category: 'rokok', who: 'rizal', source: 'tunai_rizal', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(12), merchant: 'PDAM', amount: 48_000, category: 'utilitas', who: 'rumah', source: 'bca', createdAt: Date.now() },
  { id: uid(), type: 'expense', date: daysAgo(15), merchant: 'Warung Makan Padang', amount: 55_000, category: 'makan', who: 'rizal', source: 'tunai_rizal', createdAt: Date.now() },
];

export const SEED_DATA: AppData = {
  transactions: seedTransactions.map((t) => ({ ...t, updatedAt: t.createdAt })),
  budgets: DEFAULT_BUDGETS,
  openingBalances: DEFAULT_OPENING_BALANCES,
  disabledBudgets: [],
  creditCard: DEFAULT_CREDIT_CARD,
  recurring: [],
  settingsUpdatedAt: Date.now(),
};
