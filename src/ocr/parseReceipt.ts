import { CategoryId, LineItem, ParsedReceipt } from '../types';

/**
 * Heuristic receipt parser tuned for Indonesian (Rupiah) receipts. Takes the
 * raw text returned by on-device OCR and extracts the fields a budgeting entry
 * needs, including a best-effort category per line item.
 *
 * Everything is best-effort and editable in the UI afterwards — OCR is noisy
 * and store formats vary. When in doubt we prefer "no item" over a wrong one,
 * so the user can add missing rows manually rather than delete guesses.
 */

// Money tokens — Indonesian receipts print thousands as "." (25.000),
// sometimes as space (25 000), rarely as "," (US-style). Trailing decimals
// use "," (25.000,00). We also accept a bare 3+ digit integer (25000).
const MONEY = /\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+,\d{2}|\d+\.\d{2}|\d{3,}/g;

// Anchored version used to check "is this line ONLY an amount" (item wrap).
const MONEY_ONLY =
  /^\s*(?:rp\.?|idr)?\s*\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\s*$|^\s*(?:rp\.?|idr)?\s*\d{3,}\s*$/i;

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
  'ppn', 'pb1', 'pajak', 'tax', 'dpp', 'service', 'biaya', 'svc',
  'diskon', 'discount', 'potongan', 'voucher', 'promo',
  'tunai', 'cash', 'kembali', 'kembalian', 'change',
  'debit', 'kredit', 'credit', 'qris', 'gopay', 'ovo', 'dana', 'shopeepay',
  'npwp', 'kasir', 'cashier', 'no.', 'struk', 'terima kasih', 'thank you',
  'tgl', 'tanggal', 'jam', 'waktu', 'date', 'time',
  'poin', 'reward', 'member', 'membership',
  'invoice', 'receipt', 'nota', 'bill',
  'ref no', 'ref:', 'trace', 'auth',
];

// Lines that contain a date (and little else) shouldn't become line items.
const DATE_LINE = /\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;

// Lines that look like phone numbers / long ID codes — skip.
const CODE_LINE = /^[\s\d\-/*#()]+$/;

/** Parse a single money token (Indonesian-first) into a number of Rupiah. */
function parseMoney(raw: string): number | null {
  let s = raw.toLowerCase().replace(/rp\.?|idr/g, '').replace(/[^\d.,\s]/g, '').replace(/\s/g, '').trim();
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

function isMoneyOnly(line: string): boolean {
  return MONEY_ONLY.test(line);
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

/**
 * Locate the grand total. Strategy:
 *   1. Look for a total-keyword line (Total, Grand Total, Total Bayar, …).
 *      If the amount is missing on that line, borrow the next non-noise
 *      line's amount (some receipts wrap the label + value across lines).
 *   2. Fall back to the LARGEST money value on the receipt — that's almost
 *      always the total.
 */
function extractTotal(lines: string[]): number | undefined {
  let best: { rank: number; value: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    // Skip lines that describe subtotals / taxes / discounts — they contain
    // the word "total" too sometimes.
    if (NOISE.some((n) => lower.includes(n))) continue;
    const idx = TOTAL_KEYWORDS.findIndex((k) => lower.includes(k));
    if (idx === -1) continue;
    let value = lastMoney(line);
    if (value == null) {
      // Wrap: "TOTAL\n125.000".
      const next = lines[i + 1] ?? '';
      if (isMoneyOnly(next)) value = lastMoney(next);
    }
    if (value == null) continue;
    const rank = TOTAL_KEYWORDS.length - idx; // earlier keyword = higher rank
    if (!best || rank >= best.rank) best = { rank, value };
  }
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
  for (const line of lines.slice(0, 6)) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    if (moneyTokens(trimmed).length) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (CODE_LINE.test(trimmed)) continue;
    if (/(struk|invoice|tel|telp|phone|www\.|http|@|npwp|jl\.|jalan|receipt|nota|bill)/i.test(trimmed)) continue;
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
  { category: 'transportasi', words: ['grab', 'gojek', 'gocar', 'goride', 'gosend', 'bensin', 'pertamina', 'shell', 'spbu', 'parkir', 'tol', 'e-toll', 'etoll', 'taksi', 'bluebird', 'mrt', 'krl', 'transjakarta', 'busway', 'tiket kereta', 'kai', 'ojek'] },
  { category: 'rokok', words: ['rokok', 'sampoerna', 'gudang garam', 'djarum', 'marlboro', 'surya', 'magnum', 'esse', 'bir', 'beer', 'wine', 'anggur', 'alkohol', 'vodka', 'whisky', 'soju'] },
  { category: 'fashion', words: ['uniqlo', 'zara', 'h&m', 'matahari', 'baju', 'celana', 'kemeja', 'kaos', 'dress', 'sepatu', 'sandal', 'tas', 'fashion', 'pakaian', 'jaket', 'hijab'] },
  { category: 'skincare', words: ['skincare', 'facial', 'serum', 'toner', 'sunscreen', 'moisturizer', 'somethinc', 'wardah', 'scarlett', 'azarine', 'parfum', 'shampoo', 'bedak', 'lipstik', 'makeup'] },
  { category: 'langganan', words: ['netflix', 'spotify', 'youtube', 'disney', 'vidio', 'wetv', 'iqiyi', 'canva', 'icloud', 'google one', 'claude', 'chatgpt', 'openai', 'langganan', 'subscription'] },
  { category: 'art', words: ['gaji art', ' art ', 'asisten', 'pembantu', 'helper', 'pengasuh'] },
  { category: 'sekolah', words: ['sekolah', 'spp', 'uang sekolah', 'les', 'bimbel', 'seragam', 'kampus', 'kuliah', 'daycare', 'buku tulis'] },
  { category: 'fun', words: ['tiket', 'bioskop', 'cinema', 'xxi', 'cgv', 'game', 'steam', 'mainan', 'wisata', 'liburan', 'hotel', 'traveloka', 'konser', 'karaoke', 'hobi'] },
  { category: 'sedekah', words: ['sedekah', 'zakat', 'infaq', 'infak', 'donasi', 'donation', 'sumbangan', 'amal', 'hadiah', 'kado', 'gift'] },
  { category: 'perabot', words: ['ikea', 'informa', 'ace hardware', 'furniture', 'perabot', 'sofa', 'kasur', 'lemari', 'meja', 'kursi', 'kompor', 'kulkas', 'mesin cuci', 'blender', 'rice cooker', 'kipas', 'ac ', 'elektronik', 'electronic', 'peralatan'] },
  { category: 'rumah', words: ['indomaret', 'alfamart', 'superindo', 'hypermart', 'transmart', 'giant', 'hero', 'beras', 'minyak', 'sabun', 'deterjen', 'tisu', 'tissue', 'dapur', 'gas elpiji', 'elpiji'] },
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

/**
 * Merge "description on one line, amount on the next line" pairs before
 * item extraction. Common on Indomaret / Alfamart / Superindo receipts where
 * the item name + qty is on line N and the price sits on line N+1 aligned to
 * the right.
 */
function foldWrappedItems(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const next = lines[i + 1] ?? '';
    const curHasMoney = moneyTokens(cur).length > 0;
    const nextIsMoneyOnly = isMoneyOnly(next);
    const curLetters = (cur.match(/[A-Za-z]/g) || []).length;
    // Description on this line (has letters, no amount) + next line is JUST
    // an amount → fold them together.
    if (!curHasMoney && curLetters >= 2 && nextIsMoneyOnly) {
      out.push(`${cur} ${next.trim()}`);
      i += 1;
      continue;
    }
    out.push(cur);
  }
  return out;
}

/**
 * Split a "2 x 15.000 = 30.000" style qty line into a cleaner description
 * plus the FINAL amount. If we can't parse it cleanly, keep the last money
 * token (which is usually the total for that line).
 */
function itemAmount(line: string): number | null {
  const tokens = moneyTokens(line);
  if (!tokens.length) return null;
  // Prefer the largest token — many receipts print "@ 15.000  30.000" with
  // the line total on the right (the largest of the three).
  return tokens.reduce((m, v) => (v > m ? v : m), tokens[0]);
}

function extractItems(lines: string[], total: number | undefined, fallback: CategoryId): LineItem[] {
  const items: LineItem[] = [];
  const folded = foldWrappedItems(lines);
  for (const line of folded) {
    const lower = line.toLowerCase();
    if (NOISE.some((n) => lower.includes(n))) continue;
    if (TOTAL_KEYWORDS.some((k) => lower.includes(k))) continue;
    if (DATE_LINE.test(line)) continue;
    if (CODE_LINE.test(line)) continue;
    const amount = itemAmount(line);
    if (amount == null || amount <= 0) continue;
    // Filter tiny values (< 100 IDR) — those are usually reference codes /
    // reward points printed on the same line as the item.
    if (amount < 100) continue;
    // Skip lines that ARE the total.
    if (total != null && Math.abs(amount - total) < 0.001) continue;
    // Skip items whose amount is larger than the total (misparsed line).
    if (total != null && amount > total * 1.1) continue;

    const desc = line
      .replace(MONEY, '')
      .replace(/\b(qty|x\d+|@|rp\.?|idr)\b/gi, '')
      .replace(/[|*•]/g, ' ')
      .replace(/[-–—]+\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Description must contain some letters and be a reasonable length.
    const letters = (desc.match(/[A-Za-z]/g) || []).length;
    if (desc.length < 2 || letters < 2) continue;
    // Skip lines that are just qty numbers like "2" or "x2".
    if (/^x?\d+$/i.test(desc)) continue;

    const guessed = guessCategory(desc);
    items.push({
      description: titleCase(desc),
      amount,
      category: guessed === 'lainnya' ? fallback : guessed,
    });
  }
  // If items sum wildly exceeds the total (each line was probably counted
  // twice), keep only the top-N by amount that still fits under total*1.05.
  if (total != null && items.length) {
    const sum = items.reduce((s, it) => s + it.amount, 0);
    if (sum > total * 1.5) {
      // Sort descending, keep the ones that (cumulatively) stay within total.
      const sorted = [...items].sort((a, b) => b.amount - a.amount);
      const kept: LineItem[] = [];
      let running = 0;
      for (const it of sorted) {
        if (running + it.amount > total * 1.05) continue;
        kept.push(it);
        running += it.amount;
      }
      if (kept.length) return kept.slice(0, 30);
    }
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
