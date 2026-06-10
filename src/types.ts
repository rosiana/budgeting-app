// Expense categories, derived from the couple's cashflow spreadsheet.
export type CategoryId =
  | 'cicilan' // Cicilan Rumah (house installment) — was "Apartment Rent"
  | 'listrik' // Listrik (electricity)
  | 'air' // Air (water)
  | 'internet' // Internet
  | 'skincare' // Skincare
  | 'makan' // Makan & Minum (food & beverages)
  | 'langganan' // Langganan (subscriptions)
  | 'art' // ART (asisten rumah tangga / domestic helper)
  | 'sekolah' // Sekolah (school)
  | 'fun' // Fun (hiburan)
  | 'rumah' // Kebutuhan Rumah (household needs)
  | 'lainnya'; // Lainnya (others)

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
  | 'bibit'
  | 'ajaib'
  | 'tunai';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // Ionicons name
  color: string;
}

export interface Who {
  id: WhoId;
  label: string;
  color: string;
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
  /** ISO date string (yyyy-mm-dd) */
  date: string;
  merchant: string;
  amount: number;
  /** Primary category (fallback when there are no per-item categories). */
  category: CategoryId;
  who: WhoId;
  source: SourceId;
  note?: string;
  items?: LineItem[];
  /** Set when the transaction was created from a scanned receipt */
  scanned?: boolean;
  createdAt: number;
}

/** Per-category monthly spending limit, keyed by CategoryId. */
export type Budgets = Record<CategoryId, number>;

export interface AppData {
  transactions: Transaction[];
  budgets: Budgets;
}

/** Structured result produced by the receipt parser from raw OCR text. */
export interface ParsedReceipt {
  merchant?: string;
  date?: string;
  total?: number;
  items: LineItem[];
  rawText: string;
}
