import {
  Budgets,
  CreditCardConfig,
  RecurringTx,
  SourceId,
  Transaction,
} from '../types';

export interface SyncConfig {
  url: string;
  token: string;
  lastSyncedAt?: number;
}

/** The slice of app state mirrored to the spreadsheet (and merged on sync). */
export interface SyncData {
  transactions: Transaction[];
  budgets: Budgets;
  disabledBudgets?: import('../types').CategoryId[];
  openingBalances: Partial<Record<SourceId, number>>;
  creditCard: CreditCardConfig;
  recurring?: RecurringTx[];
  settingsUpdatedAt: number;
}

const TIMEOUT_MS = 25000;

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return await Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Sync timed out')), TIMEOUT_MS);
    }),
  ]);
}

function normalizeUrl(url: string): string {
  return url.trim();
}

/**
 * Two-way sync: POST the local snapshot to the Apps Script; it merges with the
 * Sheet's current state via last-write-wins (by `updatedAt` per transaction id
 * and `settingsUpdatedAt` for settings), writes the merged state to the Sheet,
 * and returns the merged state for the app to adopt.
 */
export async function syncWithSheet(
  cfg: SyncConfig,
  data: SyncData
): Promise<SyncData> {
  if (!cfg.url) throw new Error('URL Google Sheet belum diisi.');
  const res = await withTimeout(
    fetch(normalizeUrl(cfg.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cfg.token, data, op: 'sync' }),
    })
  );
  const body = await res.json().catch(() => ({ ok: false, error: 'Respons tidak valid' }));
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Gagal sinkron (HTTP ${res.status}).`);
  }
  const d = body.data ?? {};
  return {
    transactions: Array.isArray(d.transactions) ? d.transactions : data.transactions,
    budgets: d.budgets ?? data.budgets,
    openingBalances: d.openingBalances ?? data.openingBalances,
    creditCard: d.creditCard ?? data.creditCard,
    settingsUpdatedAt: d.settingsUpdatedAt ?? data.settingsUpdatedAt,
  };
}

/** Pull a fresh copy from the Sheet — only useful for a hard restore. */
export async function pullFromSheet(cfg: SyncConfig): Promise<SyncData> {
  if (!cfg.url) throw new Error('URL Google Sheet belum diisi.');
  const sep = cfg.url.includes('?') ? '&' : '?';
  const url = `${normalizeUrl(cfg.url)}${sep}token=${encodeURIComponent(cfg.token)}`;
  const res = await withTimeout(fetch(url, { method: 'GET' }));
  const body = await res.json().catch(() => ({ ok: false, error: 'Respons tidak valid' }));
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Gagal menarik data (HTTP ${res.status}).`);
  }
  const d = body.data ?? {};
  return {
    transactions: Array.isArray(d.transactions) ? d.transactions : [],
    budgets: d.budgets ?? {},
    openingBalances: d.openingBalances ?? {},
    creditCard: d.creditCard ?? {},
    settingsUpdatedAt: d.settingsUpdatedAt ?? 0,
  };
}
