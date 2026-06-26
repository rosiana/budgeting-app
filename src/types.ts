// Expense categories, derived from the couple's cashflow spreadsheet.
export type CategoryId =
  | 'cicilan' // Cicilan Rumah (house installment)
  | 'utilitas' // Utilitas (electricity + water + internet)
  | 'skincare' // Personal Care
  | 'makan' // Makan & Minum (food & beverages)
  | 'langganan' // Langganan (subscriptions)
  | 'art' // ART (asisten rumah tangga / domestic helper)
  | 'sekolah' // Sekolah (school)
  | 'fun' // Fun (hiburan)
  | 'rumah' // Kebutuhan Rumah (household needs)
  | 'fashion' // Fashion
  | 'rokok' // Rokok & Alkohol
  | 'lainnya'; // Lainnya (others)

// Income categories, from the cashflow spreadsheet.
export type IncomeCategoryId =
  | 'gaji' // Salary
  | 'bonus' // Bonus
  | 'investasi' // Investment Profit
  | 'jualan' // Selling
  | 'bunga' // Interest (+)
  | 'transfer_in' // Transfer (+)
  | 'lainnya_in'; // Others (+)

export type TxType = 'expense' | 'income';

// Who the expense was for.
export type WhoId = 'rosi' | 'rizal' | 'nonik' | 'rumah' | 'lainnya';

// Payment / money source.
export type SourceId =
  | 'bca'
  | 'seabank'
  | 'bsi'
  | 'mandiri'
  | 'bni'
  | 'ovo'
  | 'shopeepay'
  | 'gopay'
  | 'bibit'
  | 'ajaib'
  | 'emas'
  | 'tunai';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // Ionicons name
  color: string;
}

export interface IncomeCategory {
  id: IncomeCategoryId;
  label: string;
  icon: string;
  color: string;
}

export interface Who {
  id: WhoId;
  label: string;
  color: string;
  emoji: string;
}

export interface Source {
  id: SourceId;
  label: string;
  icon: string;
  color: string;
}

export interface LineItem {
  description: string;
  amount: number;
  /** Each scanned/added item carries its own category. */
  category: CategoryId;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** ISO date string (yyyy-mm-dd) */
  date: string;
  merchant: string;
  amount: number;
  /** Expense category (used when type === 'expense'; fallback for items). */
  category: CategoryId;
  /** Income category (used when type === 'income'). */
  incomeCategory?: IncomeCategoryId;
  who: WhoId;
  source: SourceId;
  /**
   * Expense paid by credit card. CC expenses still count as spending but do
   * not reduce a cash balance until their billing cycle's due date passes.
   */
  creditCard?: boolean;
  /** Expense the company will pay back. Excluded from spending/budgets. */
  reimbursable?: boolean;
  /** Set once the reimbursement has been received (balance restored). */
  reimbursed?: boolean;
  note?: string;
  items?: LineItem[];
  /** Set when the transaction was created from a scanned receipt */
  scanned?: boolean;
  createdAt: number;
}

/** Per-category monthly spending limit, keyed by CategoryId. */
export type Budgets = Record<CategoryId, number>;

/** Credit-card billing configuration (BCA-style cutoff + due date). */
export interface CreditCardConfig {
  /** Statement cutoff day of month (tanggal cetak). */
  statementDay: number;
  /** Payment due day of month (tanggal jatuh tempo). */
  dueDay: number;
  /** Account the settled CC bill is deducted from. */
  paymentSource: SourceId;
}

export interface AppData {
  transactions: Transaction[];
  budgets: Budgets;
  /** Starting balance per money source. */
  openingBalances: Partial<Record<SourceId, number>>;
  creditCard: CreditCardConfig;
}

/** Structured result produced by the receipt parser from raw OCR text. */
export interface ParsedReceipt {
  merchant?: string;
  date?: string;
  total?: number;
  items: LineItem[];
  rawText: string;
}
