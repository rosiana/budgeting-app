import {
  Budgets,
  CreditCardConfig,
  SourceId,
  Transaction,
} from '../types';

export interface SyncConfig {
  url: string;
  token: string;
  lastSyncedAt?: number;
}

/** The slice of app state that is mirrored to the spreadsheet. */
export interface SyncData {
  transactions: Transaction[];
  budgets: Budgets;
  openingBalances: Partial<Record<SourceId, number>>;
  creditCard: CreditCardConfig;
}

const TIMEOUT_MS = 20000;

async function withTimeout(p: Promise<Response>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await p;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(url: string): string {
  return url.trim();
}

/** Push the full local dataset to the Sheet (app is the source of truth). */
export async function pushToSheet(
  cfg: SyncConfig,
  data: SyncData
): Promise<{ count: number }> {
  if (!cfg.url) throw new Error('URL Google Sheet belum diisi.');
  const res = await withTimeout(
    fetch(normalizeUrl(cfg.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cfg.token, data }),
    })
  );
  const body = await res.json().catch(() => ({ ok: false, error: 'Respons tidak valid' }));
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Gagal sinkron (HTTP ${res.status}).`);
  }
  return { count: body.count ?? data.transactions.length };
}

/** Pull the dataset from the Sheet (used to restore or set up a new device). */
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
  };
}
