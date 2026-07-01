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
  reimbursable?: boolean;
  reimbursed?: boolean;
  note?: string;
  items?: LineItem[];
  image?: string;
  scanned?: boolean;
  /** Transfer editing payload — when set, the form opens on the Transfer
   *  tab pre-filled with these values, and Simpan replaces every leg of
   *  the existing transfer group with a fresh set. */
  transfer?: {
    /** The transferGroup id shared by every leg; used to delete/replace. */
    group: string;
    fromSource: SourceId;
    toSource: SourceId;
    amountOut: number;
    amountIn: number;
  };
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
