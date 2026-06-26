import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { DEFAULT_CREDIT_CARD, migrateCategory } from '../theme';
import { SyncConfig, SyncData } from '../sync/sheets';
import {
  AppData,
  Budgets,
  CategoryId,
  CreditCardConfig,
  SourceId,
  Transaction,
} from '../types';
import { uid } from '../utils/id';
import { DEFAULT_BUDGETS, SEED_DATA } from './seed';

/** Remap any retired category ids (e.g. Listrik/Air/Internet → Utilitas). */
function migrateTransactions(txs: Transaction[]): Transaction[] {
  return txs.map((t) => ({
    ...t,
    category: migrateCategory(t.category),
    items: t.items?.map((it) => ({ ...it, category: migrateCategory(it.category) })),
  }));
}

function migrateBudgets(b: Partial<Budgets> | undefined): Partial<Budgets> {
  const out = {} as Record<CategoryId, number>;
  Object.entries(b ?? {}).forEach(([k, v]) => {
    const nk = migrateCategory(k);
    out[nk] = (out[nk] ?? 0) + (v as number);
  });
  return out;
}

const STORAGE_KEY = 'receipt-budget:data:v3';
const SYNC_KEY = 'receipt-budget:sync:v1';

type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'addTransaction'; tx: Transaction }
  | { type: 'updateTransaction'; tx: Transaction }
  | { type: 'deleteTransaction'; id: string }
  | { type: 'setBudget'; category: CategoryId; amount: number }
  | { type: 'setOpeningBalance'; source: SourceId; amount: number }
  | { type: 'setCreditCard'; patch: Partial<CreditCardConfig> }
  | { type: 'replaceData'; data: SyncData };

const EMPTY: AppData = {
  transactions: [],
  budgets: DEFAULT_BUDGETS,
  openingBalances: {},
  creditCard: DEFAULT_CREDIT_CARD,
};

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'hydrate':
      return action.data;
    case 'addTransaction':
      return { ...state, transactions: [action.tx, ...state.transactions] };
    case 'updateTransaction':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.tx.id ? action.tx : t
        ),
      };
    case 'deleteTransaction':
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.id),
      };
    case 'setBudget':
      return {
        ...state,
        budgets: { ...state.budgets, [action.category]: action.amount },
      };
    case 'setOpeningBalance':
      return {
        ...state,
        openingBalances: { ...state.openingBalances, [action.source]: action.amount },
      };
    case 'setCreditCard':
      return { ...state, creditCard: { ...state.creditCard, ...action.patch } };
    case 'replaceData':
      return {
        transactions: migrateTransactions(action.data.transactions),
        budgets: { ...DEFAULT_BUDGETS, ...migrateBudgets(action.data.budgets) },
        openingBalances: action.data.openingBalances ?? {},
        creditCard: { ...DEFAULT_CREDIT_CARD, ...action.data.creditCard },
      };
    default:
      return state;
  }
}

interface BudgetContextValue {
  ready: boolean;
  transactions: Transaction[];
  budgets: Budgets;
  openingBalances: Partial<Record<SourceId, number>>;
  creditCard: CreditCardConfig;
  addTransaction: (input: NewTransaction) => Transaction;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (category: CategoryId, amount: number) => void;
  setOpeningBalance: (source: SourceId, amount: number) => void;
  setCreditCard: (patch: Partial<CreditCardConfig>) => void;
  /** Snapshot of the data mirrored to the spreadsheet. */
  syncData: SyncData;
  syncConfig: SyncConfig;
  setSyncConfig: (patch: Partial<SyncConfig>) => void;
  /** Replace all local data (used after pulling from the Sheet). */
  replaceData: (data: SyncData) => void;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

const BudgetContext = createContext<BudgetContextValue | undefined>(undefined);

const EMPTY_SYNC: SyncConfig = { url: '', token: '' };

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [ready, setReady] = React.useState(false);
  const [syncConfig, setSyncConfigState] = React.useState<SyncConfig>(EMPTY_SYNC);

  // Load the sync config (kept separate from synced data — it holds a secret).
  useEffect(() => {
    AsyncStorage.getItem(SYNC_KEY)
      .then((raw) => {
        if (raw) setSyncConfigState({ ...EMPTY_SYNC, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  const setSyncConfig = React.useCallback((patch: Partial<SyncConfig>) => {
    setSyncConfigState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SYNC_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Hydrate from disk on mount, seeding on first run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppData>;
          dispatch({
            type: 'hydrate',
            data: {
              budgets: { ...DEFAULT_BUDGETS, ...migrateBudgets(parsed.budgets) },
              transactions: migrateTransactions(parsed.transactions ?? []),
              openingBalances: parsed.openingBalances ?? {},
              creditCard: { ...DEFAULT_CREDIT_CARD, ...parsed.creditCard },
            },
          });
        } else {
          dispatch({ type: 'hydrate', data: SEED_DATA });
        }
      } catch (e) {
        console.warn('Failed to load saved data, starting fresh.', e);
        dispatch({ type: 'hydrate', data: SEED_DATA });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((e) =>
      console.warn('Failed to persist data', e)
    );
  }, [state, ready]);

  const value = useMemo<BudgetContextValue>(
    () => ({
      ready,
      transactions: state.transactions,
      budgets: state.budgets,
      openingBalances: state.openingBalances,
      creditCard: state.creditCard,
      addTransaction: (input) => {
        const tx: Transaction = { ...input, id: uid(), createdAt: Date.now() };
        dispatch({ type: 'addTransaction', tx });
        return tx;
      },
      updateTransaction: (tx) => dispatch({ type: 'updateTransaction', tx }),
      deleteTransaction: (id) => dispatch({ type: 'deleteTransaction', id }),
      setBudget: (category, amount) => dispatch({ type: 'setBudget', category, amount }),
      setOpeningBalance: (source, amount) =>
        dispatch({ type: 'setOpeningBalance', source, amount }),
      setCreditCard: (patch) => dispatch({ type: 'setCreditCard', patch }),
      syncData: {
        transactions: state.transactions,
        budgets: state.budgets,
        openingBalances: state.openingBalances,
        creditCard: state.creditCard,
      },
      syncConfig,
      setSyncConfig,
      replaceData: (data) => dispatch({ type: 'replaceData', data }),
    }),
    [ready, state, syncConfig, setSyncConfig]
  );

  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used within a BudgetProvider');
  return ctx;
}
