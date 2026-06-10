export type CategoryId =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'health'
  | 'entertainment'
  | 'other';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // Ionicons name
  color: string;
}

export interface LineItem {
  description: string;
  amount: number;
}

export interface Transaction {
  id: string;
  /** ISO date string (yyyy-mm-dd) */
  date: string;
  merchant: string;
  amount: number;
  category: CategoryId;
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
