/**
 * Keuangan Kita — Google Apps Script backend
 * ===========================================
 * Turns a Google Spreadsheet into the sync target for the app.
 *
 * Setup (one time):
 *   1. Create a new Google Sheet (or copy your cashflow file).
 *   2. Extensions ▸ Apps Script. Delete the sample, paste this whole file.
 *   3. Set TOKEN below to any long random secret (also paste it into the app).
 *   4. Deploy ▸ New deployment ▸ type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone   (the token is what protects your data)
 *   5. Copy the Web app URL (ends with /exec) and paste it + the token into the
 *      app's Saldo ▸ Sinkronisasi card.
 *
 * The script keeps two tabs, creating them on first sync:
 *   - "Transaksi"  : one row per transaction (flat table you can pivot/chart).
 *   - "Pengaturan" : section | key | value rows for budgets, opening balances,
 *                    and credit-card config.
 */

var TOKEN = 'GANTI_DENGAN_TOKEN_RAHASIA';

var TX_SHEET = 'Transaksi';
var SETTINGS_SHEET = 'Pengaturan';
var TX_HEADERS = [
  'id', 'type', 'date', 'merchant', 'amount', 'category', 'incomeCategory',
  'who', 'source', 'creditCard', 'note', 'items', 'scanned', 'createdAt',
];

function doGet(e) {
  return guard(e, function () {
    return json({ ok: true, data: readAll() });
  });
}

function doPost(e) {
  return guard(e, function () {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.token !== TOKEN) return json({ ok: false, error: 'bad token' });
    var count = writeAll(body.data || {});
    return json({ ok: true, count: count });
  });
}

/** Token check for GET (query param). POST checks inside the body too. */
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

// --- Read ------------------------------------------------------------------

function readAll() {
  return {
    transactions: readTransactions(),
    budgets: readSettingsSection('budget'),
    openingBalances: readSettingsSection('opening'),
    creditCard: readCreditCard(),
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
      source: t.source || 'tunai',
      creditCard: t.creditCard === true || t.creditCard === 'TRUE' || t.creditCard === 'true' || undefined,
      note: t.note || undefined,
      items: parseItems(t.items),
      scanned: t.scanned === true || t.scanned === 'TRUE' || t.scanned === 'true' || undefined,
      createdAt: Number(t.createdAt) || Date.now(),
    });
  }
  return out;
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

// --- Write -----------------------------------------------------------------

function writeAll(data) {
  var n = writeTransactions(data.transactions || []);
  writeSettings(data);
  return n;
}

function writeTransactions(transactions) {
  var sh = sheet(TX_SHEET);
  sh.clearContents();
  sh.getRange(1, 1, 1, TX_HEADERS.length).setValues([TX_HEADERS]);
  if (!transactions.length) return 0;
  var rows = transactions.map(function (t) {
    return [
      t.id, t.type, t.date, t.merchant, t.amount, t.category,
      t.incomeCategory || '', t.who, t.source, t.creditCard ? true : false,
      t.note || '', t.items ? JSON.stringify(t.items) : '',
      t.scanned ? true : false, t.createdAt,
    ];
  });
  sh.getRange(2, 1, rows.length, TX_HEADERS.length).setValues(rows);
  return rows.length;
}

function writeSettings(data) {
  var sh = sheet(SETTINGS_SHEET);
  sh.clearContents();
  var rows = [['section', 'key', 'value']];
  var budgets = data.budgets || {};
  Object.keys(budgets).forEach(function (k) { rows.push(['budget', k, budgets[k]]); });
  var opening = data.openingBalances || {};
  Object.keys(opening).forEach(function (k) { rows.push(['opening', k, opening[k]]); });
  var cc = data.creditCard || {};
  Object.keys(cc).forEach(function (k) { rows.push(['cc', k, cc[k]]); });
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
}
