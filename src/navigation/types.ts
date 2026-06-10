import {
  CategoryId,
  IncomeCategoryId,
  LineItem,
  SourceId,
  TxType,
  WhoId,
} from '../types';

/** Prefill payload passed from the scanner into the add/edit form. */
export interface TransactionDraft {
  id?: string; // present when editing an existing transaction
  type?: TxType;
  merchant?: string;
  amount?: number;
  date?: string;
  category?: CategoryId;
  incomeCategory?: IncomeCategoryId;
  who?: WhoId;
  source?: SourceId;
  creditCard?: boolean;
  note?: string;
  items?: LineItem[];
  scanned?: boolean;
}

export type RootStackParamList = {
  Tabs: undefined;
  ScanReceipt: undefined;
  AddTransaction: { draft?: TransactionDraft } | undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Budgets: undefined;
  Saldo: undefined;
};
