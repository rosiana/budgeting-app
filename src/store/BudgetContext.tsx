import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { DEFAULT_CREDIT_CARD, migrateCategory, migrateSource } from '../theme';
import { pullFromSheet, syncWithSheet, SyncConfig, SyncData } from '../sync/sheets';
import {
  AppData,
  Budgets,
  CategoryId,
  CreditCardConfig,
  RecurringTx,
  SourceId,
  Transaction,
} from '../types';
import { currentPeriodKey } from '../utils/recurring';
import { uid } from '../utils/id';
import { DEFAULT_BUDGETS, SEED_DATA } from './seed';

/** Remap retired category ids and split per-person sources. */
function migrateTransactions(txs: Transaction[]): Transaction[] {
  return txs.map((t) => ({
    ...t,
    category: migrateCategory(t.category),
    source: migrateSource(t.source, t.who),
    items: t.items?.map((it) => ({ ...it, category: migrateCategory(it.category) })),
    updatedAt: t.updatedAt ?? t.createdAt ?? 0,
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

/** Old shared opening-balance keys (shopeepay/gopay/tunai) → Rosi's variant. */
function migrateOpening(
  o: Partial<Record<SourceId, number>> | undefined
): Partial<Record<SourceId, number>> {
  const out = {} as Record<SourceId, number>;
  Object.entries(o ?? {}).forEach(([k, v]) => {
    const nk = migrateSource(k, 'rosi');
    out[nk] = (out[nk] ?? 0) + (v as number);
  });
  return out;
}

const STORAGE_KEY = 'receipt-budget:data:v3';
const SYNC_KEY = 'receipt-budget:sync:v1';
const PRIVACY_KEY = 'receipt-budget:privacy:v1';

type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'addTransaction'; tx: Transaction }
  | { type: 'updateTransaction'; tx: Transaction }
  | { type: 'deleteTransaction'; id: string }
  | { type: 'setBudget'; category: CategoryId; amount: number }
  | { type: 'toggleBudget'; category: CategoryId }
  | { type: 'setOpeningBalance'; source: SourceId; amount: number }
  | { type: 'setCreditCard'; patch: Partial<CreditCardConfig> }
  | { type: 'upsertRecurring'; rec: RecurringTx }
  | { type: 'deleteRecurring'; id: string }
  | { type: 'markRecurringPaid'; id: string; period: string }
  | { type: 'replaceData'; data: SyncData }
  | { type: 'reset' };

const EMPTY: AppData = {
  transactions: [],
  budgets: DEFAULT_BUDGETS,
  disabledBudgets: [],
  openingBalances: {},
  creditCard: DEFAULT_CREDIT_CARD,
  recurring: [],
  settingsUpdatedAt: 0,
};

function reducer(state: AppData, action: Action): AppData {
  const now = Date.now();
  switch (action.type) {
    case 'hydrate':
      return action.data;
    case 'addTransaction':
      return { ...state, transactions: [action.tx, ...state.transactions] };
    case 'updateTransaction':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.tx.id ? { ...action.tx, updatedAt: now } : t
        ),
      };
    case 'deleteTransaction':
      // Soft delete: keep a tombstone so sync can propagate the removal.
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.id ? { ...t, deleted: true, updatedAt: now } : t
        ),
      };
    case 'setBudget':
      return {
        ...state,
        budgets: { ...state.budgets, [action.category]: action.amount },
        settingsUpdatedAt: now,
      };
    case 'toggleBudget': {
      const list = state.disabledBudgets ?? [];
      const next = list.includes(action.category)
        ? list.filter((c) => c !== action.category)
        : [...list, action.category];
      return { ...state, disabledBudgets: next, settingsUpdatedAt: now };
    }
    case 'setOpeningBalance':
      return {
        ...state,
        openingBalances: { ...state.openingBalances, [action.source]: action.amount },
        settingsUpdatedAt: now,
      };
    case 'setCreditCard':
      return {
        ...state,
        creditCard: { ...state.creditCard, ...action.patch },
        settingsUpdatedAt: now,
      };
    case 'upsertRecurring': {
      const list = state.recurring ?? [];
      const exists = list.some((r) => r.id === action.rec.id);
      const next = exists
        ? list.map((r) => (r.id === action.rec.id ? { ...action.rec, updatedAt: now } : r))
        : [{ ...action.rec, updatedAt: now }, ...list];
      return { ...state, recurring: next };
    }
    case 'deleteRecurring': {
      const list = state.recurring ?? [];
      return {
        ...state,
        recurring: list.map((r) =>
          r.id === action.id ? { ...r, deleted: true, updatedAt: now } : r
        ),
      };
    }
    case 'markRecurringPaid': {
      const list = state.recurring ?? [];
      return {
        ...state,
        recurring: list.map((r) =>
          r.id === action.id ? { ...r, lastPaidPeriod: action.period, updatedAt: now } : r
        ),
      };
    }
    case 'replaceData':
      return {
        transactions: migrateTransactions(action.data.transactions),
        budgets: { ...DEFAULT_BUDGETS, ...migrateBudgets(action.data.budgets) },
        disabledBudgets: action.data.disabledBudgets ?? state.disabledBudgets ?? [],
        openingBalances: migrateOpening(action.data.openingBalances),
        creditCard: {
          ...DEFAULT_CREDIT_CARD,
          ...action.data.creditCard,
          ...(action.data.creditCard?.paymentSource
            ? { paymentSource: migrateSource(action.data.creditCard.paymentSource, 'rosi') }
            : {}),
        },
        recurring: action.data.recurring ?? state.recurring ?? [],
        settingsUpdatedAt: action.data.settingsUpdatedAt ?? state.settingsUpdatedAt,
      };
    case 'reset':
      return {
        transactions: [],
        budgets: DEFAULT_BUDGETS,
        disabledBudgets: [],
        openingBalances: {},
        creditCard: DEFAULT_CREDIT_CARD,
        recurring: [],
        settingsUpdatedAt: Date.now(),
      };
    default:
      return state;
  }
}

interface BudgetContextValue {
  ready: boolean;
  transactions: Transaction[];
  budgets: Budgets;
  disabledBudgets: CategoryId[];
  openingBalances: Partial<Record<SourceId, number>>;
  creditCard: CreditCardConfig;
  addTransaction: (input: NewTransaction) => Transaction;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (category: CategoryId, amount: number) => void;
  toggleBudget: (category: CategoryId) => void;
  setOpeningBalance: (source: SourceId, amount: number) => void;
  setCreditCard: (patch: Partial<CreditCardConfig>) => void;
  /** Live recurring-tx list (soft-deleted tombstones hidden). */
  recurring: RecurringTx[];
  upsertRecurring: (rec: RecurringTx) => void;
  deleteRecurring: (id: string) => void;
  /** Mark this rec tx paid for the current period (called after Bayar). */
  markRecurringPaidNow: (id: string) => void;
  /** Snapshot of the data mirrored to the spreadsheet. */
  syncData: SyncData;
  syncConfig: SyncConfig;
  setSyncConfig: (patch: Partial<SyncConfig>) => void;
  /** Sync state for the UI to surface. */
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  syncError?: string;
  /** Force a sync right now (no debounce). */
  syncNow: () => Promise<void>;
  /** Replace all local data (used after pulling from the Sheet). */
  replaceData: (data: SyncData) => void;
  /** Wipe everything (transactions + opening balances) back to a fresh start. */
  resetAllData: () => void;
  /** When true, all displayed amounts are masked as Rp•••••• */
  privacyMode: boolean;
  setPrivacyMode: (v: boolean) => void;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

const BudgetContext = createContext<BudgetContextValue | undefined>(undefined);

const EMPTY_SYNC: SyncConfig = { url: '', token: '' };

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [ready, setReady] = React.useState(false);
  const [syncConfig, setSyncConfigState] = React.useState<SyncConfig>(EMPTY_SYNC);
  const [privacyMode, setPrivacyModeState] = React.useState<boolean>(false);

  // Load the privacy preference once.
  useEffect(() => {
    AsyncStorage.getItem(PRIVACY_KEY).then((raw) => {
      if (raw === '1') setPrivacyModeState(true);
    }).catch(() => {});
  }, []);

  const setPrivacyMode = React.useCallback((v: boolean) => {
    setPrivacyModeState(v);
    AsyncStorage.setItem(PRIVACY_KEY, v ? '1' : '0').catch(() => {});
  }, []);

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

  const [syncStatus, setSyncStatus] = React.useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [syncError, setSyncError] = React.useState<string | undefined>();
  // Refs so the latest snapshot is always available to the debounced effect
  // without re-running on every state tick.
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncingRef = useRef(false);
  const queuedRef = useRef(false);
  // Hash of the last data we sent OR received from the Sheet. We compare to
  // the current state to decide whether an auto-sync is actually needed —
  // this is what stops the infinite loop after a successful sync.
  const lastSyncedSigRef = useRef<string>('');

  function dataSignature(s: AppData): string {
    const txSig = s.transactions
      .map((t) => `${t.id}:${t.updatedAt || t.createdAt || 0}:${t.deleted ? 'D' : ''}`)
      .sort()
      .join('|');
    const recSig = (s.recurring ?? [])
      .map((r) => `${r.id}:${r.updatedAt || 0}:${r.deleted ? 'D' : ''}:${r.lastPaidPeriod ?? ''}`)
      .sort()
      .join('|');
    return `${txSig}#${recSig}#${s.settingsUpdatedAt}`;
  }

  const runSync = React.useCallback(
    async (cfg: SyncConfig) => {
      if (!cfg.url || !cfg.token) return;
      if (syncingRef.current) {
        queuedRef.current = true;
        return;
      }
      syncingRef.current = true;
      setSyncStatus('syncing');
      setSyncError(undefined);
      try {
        const snapshot: SyncData = {
          transactions: stateRef.current.transactions,
          budgets: stateRef.current.budgets,
          disabledBudgets: stateRef.current.disabledBudgets,
          openingBalances: stateRef.current.openingBalances,
          creditCard: stateRef.current.creditCard,
          settingsUpdatedAt: stateRef.current.settingsUpdatedAt,
        };
        const serverMerged = await syncWithSheet(cfg, snapshot);
        // Defense in depth: preserve any LOCAL tombstones the server response
        // is missing (or has as un-deleted with an older updatedAt). This
        // rescues deletes when a race let a stale un-deleted row round-trip
        // — the local delete should always win over an older non-tombstone.
        const localById = new Map(
          stateRef.current.transactions.map((t) => [t.id, t] as const)
        );
        const mergedById = new Map(
          serverMerged.transactions.map((t) => [t.id, t] as const)
        );
        for (const local of stateRef.current.transactions) {
          if (!local.deleted) continue;
          const remote = mergedById.get(local.id);
          const localTs = local.updatedAt ?? local.createdAt ?? 0;
          const remoteTs = remote?.updatedAt ?? remote?.createdAt ?? 0;
          if (!remote || remoteTs <= localTs) mergedById.set(local.id, local);
        }
        const mergedTransactions = Array.from(mergedById.values());
        // Sanity: also keep any purely-local rows the server hasn't seen yet
        // (e.g., an add that hit the network right as the response returned).
        for (const [id, t] of localById) {
          if (!mergedById.has(id)) mergedTransactions.push(t);
        }
        const merged = { ...serverMerged, transactions: mergedTransactions };
        dispatch({ type: 'replaceData', data: merged });
        // Mark this data as "in sync" so the auto-sync effect doesn't re-fire
        // off the dispatch we just did.
        lastSyncedSigRef.current = dataSignature({
          ...stateRef.current,
          transactions: merged.transactions,
          budgets: merged.budgets,
          openingBalances: merged.openingBalances,
          creditCard: merged.creditCard,
          settingsUpdatedAt: merged.settingsUpdatedAt,
        });
        setSyncConfig({ lastSyncedAt: Date.now() });
        setSyncStatus('synced');
      } catch (e: any) {
        setSyncStatus('error');
        setSyncError(String(e?.message ?? e));
      } finally {
        syncingRef.current = false;
        if (queuedRef.current) {
          queuedRef.current = false;
          setTimeout(() => runSync(cfg), 800);
        }
      }
    },
    [setSyncConfig]
  );

  const syncNow = React.useCallback(
    async () => runSync(syncConfig),
    [runSync, syncConfig]
  );

  // Auto-sync on every meaningful change (debounced) — but skip if the data
  // already matches what the Sheet has. That's what stops the loop.
  useEffect(() => {
    if (!ready) return;
    if (!syncConfig.url || !syncConfig.token) return;
    const sig = dataSignature(state);
    if (sig === lastSyncedSigRef.current) return;
    const t = setTimeout(() => runSync(syncConfig), 2500);
    return () => clearTimeout(t);
  }, [
    ready,
    syncConfig,
    runSync,
    state.transactions,
    state.budgets,
    state.openingBalances,
    state.creditCard,
    state.settingsUpdatedAt,
  ]);

  // Sync once at app start so we pick up any changes the other phone made.
  useEffect(() => {
    if (!ready) return;
    if (!syncConfig.url || !syncConfig.token) return;
    runSync(syncConfig);
    // Only on (ready, having a config) — not on every config change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, syncConfig.url, syncConfig.token]);

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
              disabledBudgets: parsed.disabledBudgets ?? [],
              transactions: migrateTransactions(parsed.transactions ?? []),
              openingBalances: migrateOpening(parsed.openingBalances),
              creditCard: {
                ...DEFAULT_CREDIT_CARD,
                ...parsed.creditCard,
                ...(parsed.creditCard?.paymentSource
                  ? { paymentSource: migrateSource(parsed.creditCard.paymentSource, 'rosi') }
                  : {}),
              },
              recurring: parsed.recurring ?? [],
              settingsUpdatedAt: parsed.settingsUpdatedAt ?? 0,
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
      // Hide tombstones from UI; sync still carries them in syncData.
      transactions: state.transactions.filter((t) => !t.deleted),
      budgets: state.budgets,
      disabledBudgets: state.disabledBudgets ?? [],
      openingBalances: state.openingBalances,
      creditCard: state.creditCard,
      addTransaction: (input) => {
        const now = Date.now();
        const tx: Transaction = { ...input, id: uid(), createdAt: now, updatedAt: now };
        dispatch({ type: 'addTransaction', tx });
        return tx;
      },
      updateTransaction: (tx) => dispatch({ type: 'updateTransaction', tx }),
      deleteTransaction: (id) => {
        dispatch({ type: 'deleteTransaction', id });
        // Push the tombstone to the sheet as soon as React has committed the
        // new state to stateRef. A 300ms delay is enough for the next render
        // tick, and much better than the 2.5s auto-sync debounce for making
        // deletes stick even if the user backgrounds/kills the app shortly
        // after tapping Hapus.
        setTimeout(() => runSync(syncConfig), 300);
      },
      setBudget: (category, amount) => dispatch({ type: 'setBudget', category, amount }),
      toggleBudget: (category) => dispatch({ type: 'toggleBudget', category }),
      setOpeningBalance: (source, amount) =>
        dispatch({ type: 'setOpeningBalance', source, amount }),
      setCreditCard: (patch) => dispatch({ type: 'setCreditCard', patch }),
      recurring: (state.recurring ?? []).filter((r) => !r.deleted),
      upsertRecurring: (rec) => dispatch({ type: 'upsertRecurring', rec }),
      deleteRecurring: (id) => dispatch({ type: 'deleteRecurring', id }),
      markRecurringPaidNow: (id) => {
        const rec = (state.recurring ?? []).find((r) => r.id === id);
        if (!rec) return;
        dispatch({ type: 'markRecurringPaid', id, period: currentPeriodKey(rec) });
      },
      syncData: {
        transactions: state.transactions, // includes tombstones for sync
        budgets: state.budgets,
        disabledBudgets: state.disabledBudgets,
        openingBalances: state.openingBalances,
        creditCard: state.creditCard,
        recurring: state.recurring ?? [],
        settingsUpdatedAt: state.settingsUpdatedAt,
      },
      syncConfig,
      setSyncConfig,
      replaceData: (data) => dispatch({ type: 'replaceData', data }),
      syncStatus,
      syncError,
      syncNow,
      resetAllData: () => dispatch({ type: 'reset' }),
      privacyMode,
      setPrivacyMode,
    }),
    [ready, state, syncConfig, setSyncConfig, syncStatus, syncError, syncNow, privacyMode, setPrivacyMode]
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
