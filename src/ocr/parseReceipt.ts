import { CategoryId, LineItem, ParsedReceipt } from '../types';

/**
 * Heuristic receipt parser tuned for Indonesian (Rupiah) receipts. Takes the
 * raw text returned by on-device OCR and extracts the fields a budgeting entry
 * needs, including a best-effort category per line item.
 *
 * Everything is best-effort and editable in the UI afterwards — OCR is noisy
 * and store formats vary.
 */

// Money tokens: grouped thousands (25.000 / 1.250.000 / 25.000,00),
// simple decimals (3.49 / 25,00), or a plain integer (15000).
const MONEY = /\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+,\d{2}|\d+\.\d{2}|\d{3,}/g;

const TOTAL_KEYWORDS = [
  'grand total',
  'total belanja',
  'total bayar',
  'total harga',
  'total tagihan',
  'total pembayaran',
  'jumlah bayar',
  'total',
  'jumlah',
];

// Lines that must never be treated as the grand total or as a product item.
const NOISE = [
  'subtotal', 'sub total', 'sub-total',
  'total item', 'qty', 'jml item', 'jumlah item',
  'ppn', 'pb1', 'pajak', 'tax', 'dpp', 'service', 'biaya',
  'diskon', 'discount', 'potongan', 'voucher',
  'tunai', 'cash', 'kembali', 'kembalian', 'change',
  'debit', 'kredit', 'credit', 'qris', 'gopay', 'ovo', 'dana', 'shopeepay',
  'npwp', 'kasir', 'cashier', 'no.', 'struk', 'terima kasih',
  'tgl', 'tanggal', 'jam', 'waktu', 'date', 'time',
];

// Lines that contain a date (and little else) shouldn't become line items.
const DATE_LINE = /\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;

/** Parse a single money token (Indonesian-first) into a number of Rupiah. */
function parseMoney(raw: string): number | null {
  let s = raw.toLowerCase().replace(/rp|idr/g, '').replace(/[^\d.,]/g, '').trim();
  if (!s) return null;

  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let intPart = s;
  let frac = '';
  if (lastSep >= 0) {
    const after = s.length - lastSep - 1;
    // A trailing group of 1–2 digits is a decimal; 3 digits is thousands.
    if (after === 1 || after === 2) {
      intPart = s.slice(0, lastSep);
      frac = s.slice(lastSep + 1);
    }
  }
  intPart = intPart.replace(/[.,]/g, '');
  const n = parseFloat(frac ? `${intPart}.${frac}` : intPart);
  return Number.isFinite(n) ? n : null;
}

function moneyTokens(line: string): number[] {
  const matches = line.match(MONEY);
  if (!matches) return [];
  return matches.map(parseMoney).filter((n): n is number => n !== null);
}

function lastMoney(line: string): number | null {
  const tokens = moneyTokens(line);
  return tokens.length ? tokens[tokens.length - 1] : null;
}

// --- Date extraction -------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6,
  jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10,
  nov: 11, dec: 12, des: 12,
};

function clampDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function extractDate(text: string): string | undefined {
  // ISO: 2024-03-15
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const iso = clampDate(+m[1], +m[2], +m[3]);
    if (iso) return iso;
  }
  // Numeric: 15/03/2024 — Indonesian receipts use day-first.
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    // Day-first when possible, else fall back to the other order.
    const iso = clampDate(y, b, a) ?? clampDate(y, a, b);
    if (iso) return iso;
  }
  // Named month: 15 Mar 2024 / 15 Maret 2024
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
  let best: { rank: number; value: number } | null = null;
  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (NOISE.some((n) => lower.includes(n))) return;
    const idx = TOTAL_KEYWORDS.findIndex((k) => lower.includes(k));
    if (idx === -1) return;
    const value = lastMoney(line);
    if (value == null) return;
    const rank = TOTAL_KEYWORDS.length - idx; // earlier keyword = higher rank
    if (!best || rank >= best.rank) best = { rank, value };
  });
  if (best) return (best as { value: number }).value;

  // Fallback: the largest money value is almost always the total.
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
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    if (moneyTokens(trimmed).length) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/(struk|invoice|tel|telp|phone|www\.|http|@|npwp|jl\.|jalan)/i.test(trimmed)) continue;
    const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
    if (letters < 2) continue;
    return titleCase(trimmed.replace(/\s{2,}/g, ' '));
  }
  return undefined;
}

function titleCase(s: string): string {
  if (s === s.toUpperCase() && s.length > 4) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

// --- Category guessing -----------------------------------------------------

const CATEGORY_HINTS: { category: CategoryId; words: string[] }[] = [
  { category: 'cicilan', words: ['cicilan', 'angsuran', 'kpr', 'installment'] },
  { category: 'utilitas', words: ['listrik', 'pln', 'token listrik', 'pdam', 'air minum', 'galon', 'tagihan air', 'internet', 'indihome', 'wifi', 'biznet', 'firstmedia', 'pulsa', 'paket data', 'telkomsel', 'by.u', 'smartfren', 'kuota'] },
  { category: 'rokok', words: ['rokok', 'sampoerna', 'gudang garam', 'djarum', 'marlboro', 'surya', 'magnum', 'esse', 'bir', 'beer', 'wine', 'anggur', 'alkohol', 'vodka', 'whisky', 'soju'] },
  { category: 'fashion', words: ['uniqlo', 'zara', 'h&m', 'matahari', 'baju', 'celana', 'kemeja', 'kaos', 'dress', 'sepatu', 'sandal', 'tas', 'fashion', 'pakaian', 'jaket', 'hijab'] },
  { category: 'skincare', words: ['skincare', 'facial', 'serum', 'toner', 'sunscreen', 'moisturizer', 'somethinc', 'wardah', 'scarlett', 'azarine', 'parfum', 'shampoo', 'bedak', 'lipstik', 'makeup'] },
  { category: 'langganan', words: ['netflix', 'spotify', 'youtube', 'disney', 'vidio', 'wetv', 'iqiyi', 'canva', 'icloud', 'google one', 'claude', 'chatgpt', 'openai', 'langganan', 'subscription'] },
  { category: 'art', words: ['gaji art', ' art ', 'asisten', 'pembantu', 'helper', 'pengasuh'] },
  { category: 'sekolah', words: ['sekolah', 'spp', 'uang sekolah', 'les', 'bimbel', 'seragam', 'kampus', 'kuliah', 'daycare', 'buku tulis'] },
  { category: 'fun', words: ['tiket', 'bioskop', 'cinema', 'xxi', 'cgv', 'game', 'steam', 'mainan', 'wisata', 'liburan', 'hotel', 'traveloka', 'konser', 'karaoke'] },
  { category: 'rumah', words: ['indomaret', 'alfamart', 'superindo', 'hypermart', 'transmart', 'giant', 'hero', 'ikea', 'informa', 'ace hardware', 'beras', 'minyak', 'sabun', 'deterjen', 'tisu', 'tissue', 'peralatan', 'dapur', 'gas elpiji', 'elpiji'] },
  { category: 'makan', words: ['makan', 'resto', 'restaurant', 'cafe', 'kafe', 'kopi', 'coffee', 'warung', 'bakso', 'ayam', 'nasi', 'mie', 'minum', 'gofood', 'grabfood', 'shopeefood', 'snack', 'roti', 'kue', 'susu', 'buah', 'sayur'] },
];

export function guessCategory(text: string): CategoryId {
  const lower = ` ${text.toLowerCase()} `;
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((w) => lower.includes(w))) return hint.category;
  }
  return 'lainnya';
}

// --- Line items ------------------------------------------------------------

function extractItems(lines: string[], total: number | undefined, fallback: CategoryId): LineItem[] {
  const items: LineItem[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (NOISE.some((n) => lower.includes(n))) continue;
    if (TOTAL_KEYWORDS.some((k) => lower.includes(k))) continue;
    if (DATE_LINE.test(line)) continue;
    const amount = lastMoney(line);
    if (amount == null || amount <= 0) continue;
    const desc = line
      .replace(MONEY, '')
      .replace(/\b(qty|x\d+|@|rp|idr)\b/gi, '')
      .replace(/[|*•]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (desc.length < 2) continue;
    if (total != null && Math.abs(amount - total) < 0.001) continue; // skip the total row
    const guessed = guessCategory(desc);
    items.push({
      description: titleCase(desc),
      amount,
      category: guessed === 'lainnya' ? fallback : guessed,
    });
  }
  return items.slice(0, 30);
}

// --- Public API ------------------------------------------------------------

export function parseReceipt(rawText: string): ParsedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const total = extractTotal(lines);
  const merchant = extractMerchant(lines);
  // Category guessed from the merchant + whole receipt; used as the fallback
  // for items the per-line guesser can't classify.
  const overall = guessCategory(`${merchant ?? ''} ${rawText}`);

  return {
    merchant,
    date: extractDate(rawText),
    total,
    items: extractItems(lines, total, overall),
    rawText,
  };
}
