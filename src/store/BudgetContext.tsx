import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { AppData, Budgets, CategoryId, Transaction } from '../types';
import { uid } from '../utils/id';
import { DEFAULT_BUDGETS, SEED_DATA } from './seed';

const STORAGE_KEY = 'receipt-budget:data:v1';

type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'addTransaction'; tx: Transaction }
  | { type: 'updateTransaction'; tx: Transaction }
  | { type: 'deleteTransaction'; id: string }
  | { type: 'setBudget'; category: CategoryId; amount: number };

const EMPTY: AppData = { transactions: [], budgets: DEFAULT_BUDGETS };

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
    default:
      return state;
  }
}

interface BudgetContextValue {
  ready: boolean;
  transactions: Transaction[];
  budgets: Budgets;
  addTransaction: (input: NewTransaction) => Transaction;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (category: CategoryId, amount: number) => void;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

const BudgetContext = createContext<BudgetContextValue | undefined>(undefined);

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [ready, setReady] = React.useState(false);

  // Hydrate from disk on mount, seeding on first run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as AppData;
          dispatch({
            type: 'hydrate',
            data: { budgets: { ...DEFAULT_BUDGETS, ...parsed.budgets }, transactions: parsed.transactions ?? [] },
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
      addTransaction: (input) => {
        const tx: Transaction = { ...input, id: uid(), createdAt: Date.now() };
        dispatch({ type: 'addTransaction', tx });
        return tx;
      },
      updateTransaction: (tx) => dispatch({ type: 'updateTransaction', tx }),
      deleteTransaction: (id) => dispatch({ type: 'deleteTransaction', id }),
      setBudget: (category, amount) =>
        dispatch({ type: 'setBudget', category, amount }),
    }),
    [ready, state]
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
