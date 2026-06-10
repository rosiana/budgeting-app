import { CategoryId, LineItem, ParsedReceipt } from '../types';

/**
 * Heuristic receipt parser. Takes the raw text returned by on-device OCR
 * (ML Kit / Apple Vision) and extracts the fields a budgeting entry needs.
 *
 * It is intentionally forgiving: OCR output is noisy, line order varies, and
 * different stores format totals differently. Every field is best-effort and
 * the UI lets the user correct anything before saving.
 */

// Matches money like 12.34, 1,234.56, $4.00, 4.00$, -3.50
const MONEY = /(-?\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\-?\$?\s?\d+[.,]\d{2})/g;

const TOTAL_KEYWORDS = [
  'grand total',
  'total due',
  'amount due',
  'balance due',
  'total',
  'to pay',
  'total amount',
];

// Lines we never want to treat as the final total or as a line item.
const SUBTOTAL_NOISE = ['subtotal', 'sub total', 'tax', 'change', 'cash', 'tip', 'gratuity', 'tender', 'visa', 'mastercard', 'debit', 'credit', 'balance'];

function parseMoney(raw: string): number | null {
  let s = raw.replace(/[^0-9.,-]/g, '').trim();
  if (!s) return null;
  // Normalise thousands/decimal separators -> a JS-parseable number.
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, ''); // 1,234.56 -> 1234.56
  } else if (s.includes(',')) {
    // Could be European decimal (4,00) or thousands (1,234). Treat trailing
    // ",dd" as decimals.
    if (/,\d{2}$/.test(s)) s = s.replace(/,/g, '.');
    else s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function moneyTokens(line: string): number[] {
  const matches = line.match(MONEY);
  if (!matches) return [];
  return matches
    .map(parseMoney)
    .filter((n): n is number => n !== null);
}

function lastMoney(line: string): number | null {
  const tokens = moneyTokens(line);
  return tokens.length ? tokens[tokens.length - 1] : null;
}

// --- Date extraction -------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function clampDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function extractDate(text: string): string | undefined {
  // ISO: 2024-03-15
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const iso = clampDate(+m[1], +m[2], +m[3]);
    if (iso) return iso;
  }
  // Numeric: 03/15/2024 or 15/03/24 — assume US (m/d) when ambiguous.
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const y = +m[3];
    // If first part can't be a month but second can, swap (d/m order).
    if (a > 12 && b <= 12) {
      const iso = clampDate(y, b, a);
      if (iso) return iso;
    }
    const iso = clampDate(y, a, b);
    if (iso) return iso;
  }
  // Named month: Mar 15, 2024 / 15 March 2024
  m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/);
  if (m) {
    const mon = MONTH_NAMES[m[1].slice(0, 3).toLowerCase()];
    if (mon) {
      const iso = clampDate(+m[3], mon, +m[2]);
      if (iso) return iso;
    }
  }
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/);
  if (m) {
    const mon = MONTH_NAMES[m[2].slice(0, 3).toLowerCase()];
    if (mon) {
      const iso = clampDate(+m[3], mon, +m[1]);
      if (iso) return iso;
    }
  }
  return undefined;
}

// --- Total extraction ------------------------------------------------------

function extractTotal(lines: string[]): number | undefined {
  // Pass 1: explicit "total" keyword lines (prefer the most specific keyword,
  // and the last occurrence, which is usually the grand total).
  let best: { rank: number; value: number } | null = null;
  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (SUBTOTAL_NOISE.some((n) => lower.includes(n))) return;
    const idx = TOTAL_KEYWORDS.findIndex((k) => lower.includes(k));
    if (idx === -1) return;
    const value = lastMoney(line);
    if (value == null) return;
    const rank = TOTAL_KEYWORDS.length - idx; // earlier keyword = higher rank
    if (!best || rank >= best.rank) best = { rank, value };
  });
  if (best) return (best as { value: number }).value;

  // Pass 2: no keyword found — fall back to the largest money value on the
  // receipt, which is almost always the total.
  let max: number | undefined;
  for (const line of lines) {
    for (const v of moneyTokens(line)) {
      if (max === undefined || v > max) max = v;
    }
  }
  return max;
}

// --- Merchant extraction ---------------------------------------------------

function extractMerchant(lines: string[]): string | undefined {
  // The merchant name is usually one of the first non-empty lines and contains
  // letters but not prices or obvious metadata.
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    if (moneyTokens(trimmed).length) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/(receipt|invoice|tel|phone|www\.|http|@|\d{3}[-.]\d{3})/i.test(trimmed)) continue;
    const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
    if (letters < 2) continue;
    return titleCase(trimmed.replace(/\s{2,}/g, ' '));
  }
  return undefined;
}

function titleCase(s: string): string {
  // Leave all-caps short tokens (likely brand) but tidy long shouting names.
  if (s === s.toUpperCase() && s.length > 4) {
    return s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

// --- Line items ------------------------------------------------------------

function extractItems(lines: string[], total?: number): LineItem[] {
  const items: LineItem[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (SUBTOTAL_NOISE.some((n) => lower.includes(n))) continue;
    if (TOTAL_KEYWORDS.some((k) => lower.includes(k))) continue;
    const amount = lastMoney(line);
    if (amount == null || amount <= 0) continue;
    // Description = the text before the trailing price.
    const desc = line
      .replace(MONEY, '')
      .replace(/\b(qty|x\d+|@)\b/gi, '')
      .replace(/[|*•]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (desc.length < 2) continue;
    if (total != null && Math.abs(amount - total) < 0.001) continue; // skip the total row
    items.push({ description: titleCase(desc), amount });
  }
  return items.slice(0, 25);
}

// --- Category guessing -----------------------------------------------------

const CATEGORY_HINTS: { category: CategoryId; words: string[] }[] = [
  { category: 'groceries', words: ['market', 'grocery', 'foods', 'supermarket', 'mart', 'trader', 'aldi', 'kroger', 'safeway', 'costco', 'walmart', 'produce'] },
  { category: 'dining', words: ['cafe', 'coffee', 'restaurant', 'grill', 'pizza', 'burger', 'bar ', 'kitchen', 'bistro', 'chipotle', 'mcdonald', 'starbucks', 'tacos', 'sushi', 'diner'] },
  { category: 'transport', words: ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp ', 'uber', 'lyft', 'parking', 'transit', 'metro', 'toll'] },
  { category: 'shopping', words: ['target', 'amazon', 'store', 'apparel', 'clothing', 'shoes', 'best buy', 'ikea', 'mall'] },
  { category: 'bills', words: ['electric', 'utility', 'pg&e', 'water', 'internet', 'comcast', 'verizon', 'at&t', 'insurance', 'rent'] },
  { category: 'health', words: ['pharmacy', 'cvs', 'walgreens', 'clinic', 'dental', 'medical', 'gym', 'fitness', 'doctor'] },
  { category: 'entertainment', words: ['cinema', 'theater', 'netflix', 'spotify', 'game', 'tickets', 'movie', 'steam'] },
];

export function guessCategory(text: string): CategoryId {
  const lower = text.toLowerCase();
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((w) => lower.includes(w))) return hint.category;
  }
  return 'other';
}

// --- Public API ------------------------------------------------------------

export function parseReceipt(rawText: string): ParsedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const total = extractTotal(lines);
  return {
    merchant: extractMerchant(lines),
    date: extractDate(rawText),
    total,
    items: extractItems(lines, total),
    rawText,
  };
}
