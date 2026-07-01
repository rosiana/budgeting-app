// Expense categories, derived from the couple's cashflow spreadsheet.
export type CategoryId =
  | 'cicilan' // Cicilan Rumah (house installment)
  | 'utilitas' // Utilitas (electricity + water + internet)
  | 'transportasi' // Transportasi
  | 'skincare' // Personal Care
  | 'makan' // Makan & Minum (food & beverages)
  | 'langganan' // Langganan (subscriptions)
  | 'art' // ART (asisten rumah tangga / domestic helper)
  | 'sekolah' // Sekolah (school)
  | 'fun' // Hobi & Hiburan
  | 'rumah' // Kebutuhan Rumah (household needs)
  | 'perabot' // Perabot & Peralatan (furniture & appliances)
  | 'fashion' // Fashion
  | 'rokok' // Rokok & Alkohol
  | 'sedekah' // Sedekah & Hadiah (charity & gifts)
  | 'kesehatan' // Kesehatan (health)
  | 'investasi_luar' // Investasi Luar (outside investment)
  | 'bunga_expense' // Bunga (interest paid — loans, cards, admin fees)
  | 'biaya_pajak' // Biaya / Pajak Transaksi (covers transfer fees + extras)
  | 'diskon' // Diskon — counts as negative spending on a multi-item parent
  | 'rugi_investasi' // Rugi Investasi (auto, when an investment balance is lowered)
  | 'penyesuaian_saldo' // Penyesuaian Saldo (manual balance correction, down)
  | 'transfer_out' // Internal: transfer leg leaving an account
  | 'lainnya'; // Lainnya (others)

/** Which icon font a category's `icon` name comes from. */
export type IconSet = 'ion' | 'mci';

// Income categories, from the cashflow spreadsheet.
export type IncomeCategoryId =
  | 'gaji' // Salary
  | 'bonus' // Bonus
  | 'investasi' // Investment Profit
  | 'jualan' // Selling
  | 'bunga' // Interest (+)
  | 'transfer_in' // Internal: transfer leg arriving at an account
  | 'penyesuaian_saldo_in' // Manual balance correction, up
  | 'lainnya_in'; // Others (+)

export type TxType = 'expense' | 'income' | 'transfer';

// Who the expense was for.
export type WhoId = 'rosi' | 'rizal' | 'nonik' | 'rumah' | 'lainnya';

// Payment / money source. ShopeePay/GoPay/Tunai are per-person (Rosi & Rizal
// each have their own separate account).
export type SourceId =
  | 'bca'
  | 'seabank'
  | 'ovo'
  | 'bibit'
  | 'ajaib'
  | 'emas'
  | 'flazz'
  | 'shopeepay_rosi'
  | 'gopay_rosi'
  | 'tunai_rosi'
  | 'bsi'
  | 'mandiri'
  | 'bni'
  | 'shopeepay_rizal'
  | 'gopay_rizal'
  | 'tunai_rizal';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // icon name (Ionicons by default, or MCI when iconSet === 'mci')
  iconSet?: IconSet;
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
  /** Optional monkey avatar image (require'd asset). */
  avatar?: number;
  /** Pastel circle behind the avatar. */
  avatarBg?: string;
}

/** Who owns a money source. */
export type SourceOwner = 'rosi' | 'rizal';

export interface Source {
  id: SourceId;
  label: string;
  icon: string;
  color: string;
  owner: SourceOwner;
}

export interface LineItem {
  description: string;
  amount: number;
  /** Each scanned/added item carries its own category. */
  category: CategoryId;
  /** Each item can be for a different person; defaults to the parent's who. */
  who?: WhoId;
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
  /**
   * When a CC purchase is paid ahead of the due date (via Bayar Tagihan on the
   * Saldo screen), this holds the ISO date the payment was made. The row then
   * counts as settled from that date, so it deducts from paymentSource
   * immediately instead of waiting for the natural due date.
   */
  ccPaidAt?: string;
  note?: string;
  items?: LineItem[];
  /** Set when the transaction was created from a scanned receipt */
  scanned?: boolean;
  /** Optional attached photo (local file uri). */
  image?: string;
  createdAt: number;
  /** Last edit time (ms epoch). Used for last-write-wins merge sync. */
  updatedAt?: number;
  /** Soft-delete tombstone; the row is hidden from UI but kept for sync. */
  deleted?: boolean;
  /**
   * Links the three legs of a transfer (out / in / fee) so we can render and
   * delete them together. When present, the legs are excluded from spending,
   * budget, and income totals — money only moves between accounts.
   */
  transferGroup?: string;
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
  /** Categories the user has switched off for the budget — excluded from
   *  Anggaran totals and the dashboard preview list. */
  disabledBudgets: CategoryId[];
  /** Starting balance per money source. */
  openingBalances: Partial<Record<SourceId, number>>;
  creditCard: CreditCardConfig;
  /** Last time settings (budgets/openingBalances/creditCard) were edited. */
  settingsUpdatedAt: number;
}

/** Structured result produced by the receipt parser from raw OCR text. */
export interface ParsedReceipt {
  merchant?: string;
  date?: string;
  total?: number;
  items: LineItem[];
  rawText: string;
}
