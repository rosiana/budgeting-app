/**
 * MoMoney — Google Apps Script backend (two-way merge sync)
 * =========================================================
 *
 * Both phones can edit freely. On every sync the script merges the incoming
 * snapshot with what's already in the Sheet:
 *  - Per transaction id: keep the row with the higher `updatedAt`.
 *  - Settings (budgets, opening balances, CC config): keep the side with the
 *    higher `settingsUpdatedAt`.
 * Deletes are soft (the app sends a `deleted: true` tombstone). The merged
 * state is written back to the Sheet AND returned to the caller, so both
 * phones converge.
 *
 * Setup (one time):
 *   1. Create a Google Sheet, open Extensions ▸ Apps Script, paste this file.
 *   2. Set TOKEN below to any long random string (use the same in the app).
 *   3. Deploy ▸ New deployment ▸ Web app
 *        - Execute as: Me
 *        - Who has access: Anyone   (the token protects your data)
 *   4. Copy the /exec URL into the app's Saldo ▸ Sinkronisasi card.
 *
 * Tabs created on first sync:
 *   - "Transaksi"  : one row per transaction (flat table you can pivot/chart)
 *   - "Pengaturan" : section | key | value rows for budgets, opening balances,
 *                    credit-card config, and the settingsUpdatedAt timestamp
 */

var TOKEN = 'GANTI_DENGAN_TOKEN_RAHASIA';

var TX_SHEET = 'Transaksi';
var SETTINGS_SHEET = 'Pengaturan';
var TX_HEADERS = [
  'id', 'type', 'date', 'merchant', 'amount', 'category', 'incomeCategory',
  'who', 'source', 'creditCard', 'reimbursable', 'reimbursed', 'note', 'items',
  'image', 'scanned', 'deleted', 'createdAt', 'updatedAt',
];

// --- Entry points ---------------------------------------------------------

function doGet(e) {
  return guard(e, function () {
    return json({ ok: true, data: readAll() });
  });
}

function doPost(e) {
  return guard(e, function () {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.token !== TOKEN) return json({ ok: false, error: 'bad token' });
    var incoming = body.data || {};
    var merged = mergeAndWrite(incoming);
    return json({ ok: true, data: merged, count: merged.transactions.length });
  });
}

function guard(e, fn) {
  try {
    var isPost = e && e.postData;
    if (!isPost) {
      var token = e && e.parameter ? e.parameter.token : '';
      if (token !== TOKEN) return json({ ok: false, error: 'bad token' });
    }
    return fn();
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function sheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

// --- Read existing state --------------------------------------------------

function readAll() {
  return {
    transactions: readTransactions(),
    budgets: readSettingsSection('budget'),
    openingBalances: readSettingsSection('opening'),
    creditCard: readCreditCard(),
    settingsUpdatedAt: readSettingsTimestamp(),
  };
}

function readTransactions() {
  var sh = sheet(TX_SHEET);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row[0]) continue;
    var t = {};
    for (var c = 0; c < headers.length; c++) t[headers[c]] = row[c];
    out.push({
      id: String(t.id),
      type: t.type || 'expense',
      date: formatDate(t.date),
      merchant: String(t.merchant || ''),
      amount: Number(t.amount) || 0,
      category: t.category || 'lainnya',
      incomeCategory: t.incomeCategory || undefined,
      who: t.who || 'rumah',
      source: t.source || 'tunai_rosi',
      creditCard: boolish(t.creditCard) || undefined,
      reimbursable: boolish(t.reimbursable) || undefined,
      reimbursed: boolish(t.reimbursed) || undefined,
      note: t.note || undefined,
      items: parseItems(t.items),
      image: t.image || undefined,
      scanned: boolish(t.scanned) || undefined,
      deleted: boolish(t.deleted) || undefined,
      createdAt: Number(t.createdAt) || 0,
      updatedAt: Number(t.updatedAt) || Number(t.createdAt) || 0,
    });
  }
  return out;
}

function boolish(v) {
  return v === true || v === 'TRUE' || v === 'true';
}

function parseItems(raw) {
  if (!raw) return undefined;
  try {
    var v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v && v.length ? v : undefined;
  } catch (err) {
    return undefined;
  }
}

function formatDate(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '');
}

function readSettingsSection(section) {
  var sh = sheet(SETTINGS_SHEET);
  var values = sh.getDataRange().getValues();
  var out = {};
  for (var r = 1; r < values.length; r++) {
    if (values[r][0] === section) out[String(values[r][1])] = Number(values[r][2]);
  }
  return out;
}

function readCreditCard() {
  var sh = sheet(SETTINGS_SHEET);
  var values = sh.getDataRange().getValues();
  var cc = {};
  for (var r = 1; r < values.length; r++) {
    if (values[r][0] === 'cc') {
      var key = String(values[r][1]);
      var val = values[r][2];
      cc[key] = key === 'paymentSource' ? String(val) : Number(val);
    }
  }
  return cc;
}

function readSettingsTimestamp() {
  var sh = sheet(SETTINGS_SHEET);
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (values[r][0] === 'meta' && values[r][1] === 'settingsUpdatedAt') {
      return Number(values[r][2]) || 0;
    }
  }
  return 0;
}

// --- Merge & write --------------------------------------------------------

function mergeAndWrite(incoming) {
  var existing = readAll();

  // 1) Merge transactions by id, picking the higher updatedAt.
  var byId = {};
  (existing.transactions || []).forEach(function (t) { byId[t.id] = t; });
  (incoming.transactions || []).forEach(function (t) {
    if (!t || !t.id) return;
    var ex = byId[t.id];
    if (!ex || Number(t.updatedAt || 0) >= Number(ex.updatedAt || 0)) {
      byId[t.id] = t;
    }
  });
  var mergedTx = Object.keys(byId).map(function (k) { return byId[k]; });

  // 2) Merge settings: last-write-wins by settingsUpdatedAt.
  var existingTs = Number(existing.settingsUpdatedAt) || 0;
  var incomingTs = Number(incoming.settingsUpdatedAt) || 0;
  var settings;
  if (incomingTs >= existingTs) {
    settings = {
      budgets: incoming.budgets || existing.budgets || {},
      openingBalances: incoming.openingBalances || existing.openingBalances || {},
      creditCard: incoming.creditCard || existing.creditCard || {},
      settingsUpdatedAt: incomingTs || existingTs,
    };
  } else {
    settings = {
      budgets: existing.budgets || {},
      openingBalances: existing.openingBalances || {},
      creditCard: existing.creditCard || {},
      settingsUpdatedAt: existingTs,
    };
  }

  writeTransactions(mergedTx);
  writeSettings(settings);

  return {
    transactions: mergedTx,
    budgets: settings.budgets,
    openingBalances: settings.openingBalances,
    creditCard: settings.creditCard,
    settingsUpdatedAt: settings.settingsUpdatedAt,
  };
}

function writeTransactions(transactions) {
  var sh = sheet(TX_SHEET);
  sh.clearContents();
  sh.getRange(1, 1, 1, TX_HEADERS.length).setValues([TX_HEADERS]);
  if (!transactions.length) return;
  var rows = transactions.map(function (t) {
    return [
      t.id, t.type, t.date, t.merchant, t.amount, t.category,
      t.incomeCategory || '', t.who, t.source,
      t.creditCard ? true : false,
      t.reimbursable ? true : false,
      t.reimbursed ? true : false,
      t.note || '',
      t.items ? JSON.stringify(t.items) : '',
      t.image || '',
      t.scanned ? true : false,
      t.deleted ? true : false,
      t.createdAt || 0,
      t.updatedAt || t.createdAt || 0,
    ];
  });
  sh.getRange(2, 1, rows.length, TX_HEADERS.length).setValues(rows);
}

function writeSettings(s) {
  var sh = sheet(SETTINGS_SHEET);
  sh.clearContents();
  var rows = [['section', 'key', 'value']];
  var budgets = s.budgets || {};
  Object.keys(budgets).forEach(function (k) { rows.push(['budget', k, budgets[k]]); });
  var opening = s.openingBalances || {};
  Object.keys(opening).forEach(function (k) { rows.push(['opening', k, opening[k]]); });
  var cc = s.creditCard || {};
  Object.keys(cc).forEach(function (k) { rows.push(['cc', k, cc[k]]); });
  rows.push(['meta', 'settingsUpdatedAt', s.settingsUpdatedAt || 0]);
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
}
