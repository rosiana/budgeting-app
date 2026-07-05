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
  | 'refund' // Refund from a returned purchase (linked via Transaction.refundOf)
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
  /**
   * When set, this transaction is a REFUND of the referenced expense. Refunds
   * are stored as `type: 'income'` with `incomeCategory: 'refund'` and mirror
   * the refunded portion (single-amount, or per-item via `items[]` for a
   * partial return of a multi-item basket). Refund rows:
   *   • ADD to the source balance on their own date (respecting CC cycles
   *     when `creditCard: true`).
   *   • SUBTRACT from the category totals so Anggaran / Pengeluaran read the
   *     net spend after the return.
   *   • Do NOT count as real income (they aren't new money).
   */
  refundOf?: string;
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

/**
 * A recurring transaction reminder (KPR, Netflix, Nonik's SPP, …). Each rec
 * tx has a monthly (or every-3-months) schedule; at 09:00 on the due day of
 * an active period, a notification fires with the title
 * "Transaksi Rutin: <name>". Tapping the notification (or the Bayar button
 * on Perencanaan) opens Add Transaction pre-filled from these fields.
 *
 * Marking one paid records the period (`YYYY-MM`) in `lastPaidPeriod` so the
 * Dashboard "belum dibayar" count and the next-notification scheduler know
 * to skip it for this period.
 */
export interface RecurringTx {
  id: string;
  enabled: boolean; // whether the notification is scheduled
  name: string; // used as merchant + notification body
  txType: TxType;
  category: CategoryId; // for expense
  incomeCategory?: IncomeCategoryId; // for income
  amount?: number; // optional prefill; user can adjust at Bayar time
  /**
   * PIC — who should pay AND who receives the notification. Also drives the
   * source picker (only accounts owned by this person's side).
   *   • 'both'  → both phones get the notification, all sources available
   *   • 'rosi'  → only Rosi's phone; Rosi's sources only
   *   • 'rizal' → only Rizal's phone; Rizal's sources only
   */
  pic: 'both' | 'rosi' | 'rizal';
  /**
   * Untuk Siapa — pre-fills the transaction's `who` field (Rosi / Rizal /
   * Nonik / Rumah / Lainnya). Different from PIC: PIC is "who pays", who is
   * "who the money is for". Optional; when omitted the transaction form's
   * default kicks in on Bayar.
   */
  who?: WhoId;
  source?: SourceId;
  creditCard?: boolean;
  reimbursable?: boolean;
  /** Transfer-only: source account (from). */
  fromSource?: SourceId;
  /** Transfer-only: destination account (to). */
  toSource?: SourceId;
  /** Transfer-only: transferred amount (money that crossed). */
  transferAmount?: number;
  /** Transfer-only: optional fee on top. */
  transferFee?: number;
  dayOfMonth: number; // 1-31, clamped to last day of month
  /** 1 = monthly (default), 3 = every 3 months. Nonik's SPP uses 3. */
  intervalMonths: 1 | 3;
  /** When intervalMonths > 1, this pins the cycle. e.g. anchorMonth=1 with
   *  intervalMonths=3 → fires in Jan, Apr, Jul, Oct. */
  anchorMonth?: number; // 1-12
  /** Period key (`YYYY-MM`) of the last time this rec tx was marked paid. */
  lastPaidPeriod?: string;
  updatedAt: number;
  /** Soft-delete tombstone for sync — mirrors Transaction.deleted. */
  deleted?: boolean;
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
  /** Recurring transaction schedule (Transaksi Rutin on Perencanaan). */
  recurring: RecurringTx[];
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
