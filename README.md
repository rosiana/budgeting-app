# MoMoney

A cross-platform (iOS + Android) personal budgeting app built with **Expo /
React Native + TypeScript**. The UI is in **Bahasa Indonesia** and all amounts
are in **Rupiah (IDR)**. Snap a photo of a receipt and it reads the merchant,
date, total, and line items **entirely on-device** using ML Kit / Apple Vision
text recognition — no servers, no API keys, nothing leaves your phone.

Originally built for a couple (Rosi on iOS, Rizal on Android), but the who /
category / source lists in [`src/theme.ts`](src/theme.ts) are just data — swap
the names, colors, and accounts for your own household in a few minutes. See
[Personalize](#personalize) below.

## Get started

```bash
git clone https://github.com/rosiana/budgeting-app.git
cd budgeting-app
npm install
```

Then, on a Mac with Xcode installed:

```bash
npm run ios       # iOS Simulator, or a connected iPhone
```

Or, with Android Studio + an emulator/USB device:

```bash
npm run android
```

The first run takes a few minutes — it prebuilds the native iOS/Android project
and installs the app as a dev client. After that, iterate with fast refresh via
`npm start`.

> ⚠️ **This app will NOT run in Expo Go.** The on-device OCR module
> (`@react-native-ml-kit/text-recognition`) is a native module Expo Go doesn't
> include. You have to build the dev client once, which is what `npm run ios`
> / `npm run android` does. Everything else works the normal way after that.

### iOS on a real device with a free Apple ID

The included [`plugins/withNoPushEntitlement.js`](plugins/withNoPushEntitlement.js)
config plugin strips `aps-environment` so a **free Apple ID** can sign the
build (paid Apple Developer Program is not required).

First run on the phone:
1. Xcode → Settings → Accounts → add your Apple ID. `npm run ios` will pick it
   up as the signing team.
2. When the app launches, iOS shows **Untrusted Developer** → Settings →
   General → **VPN & Device Management** → tap your Apple ID → **Trust**.
3. Settings → Privacy & Security → **Developer Mode** → **On** (iOS 17+).

Free provisioning profiles **expire after 7 days**. When the app icon greys
out or "Unable to Install" appears, just re-run:

```bash
cd ios
xcodebuild -workspace MoMoney.xcworkspace -scheme MoMoney -configuration Release \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates -quiet build && \
APP=$(ls -dt ~/Library/Developer/Xcode/DerivedData/MoMoney-*/Build/Products/Release-iphoneos/MoMoney.app | head -1) && \
xcrun devicectl device install app --device <YOUR_UDID> "$APP"
```

Your data is safe across reinstalls (stored locally and, if configured, in
your Google Sheet).

If you'd rather not deal with the 7-day renewal, upgrade to the paid Apple
Developer Program ($99/year) — certificates then last 1 year and you can drop
the `withNoPushEntitlement` plugin.

### Android APK without Android Studio

If you don't want to install Android Studio, the included
[`eas.json`](eas.json) has a `preview` profile that builds an installable APK
on Expo's cloud:

```bash
npx eas-cli login                     # first time only
npx eas-cli build --platform android --profile preview
```

Download the resulting `.apk` from the URL printed to the terminal, sideload
onto the phone (Files → Install), and allow install-from-browser once.

## Personalize

The app ships with the original couple's names, categories, and accounts.
Everything is one file to edit:

- **Who (Rosi / Rizal / Nonik / Rumah / Lainnya)** — [`src/theme.ts`](src/theme.ts)
  `WHO` array. Swap the labels, colors, and emoji.
- **Sources (BCA / SeaBank / GoPay / Bibit / …)** — same file, `SOURCES` array.
  Each source has an `owner` (rosi/rizal) so the app knows which person's
  wallet it lives in.
- **Categories** — `CATEGORIES` and `PICKABLE_CATEGORIES` in the same file.
- **Default budgets & opening balances** — [`src/store/seed.ts`](src/store/seed.ts).
- **Which person defaults on which OS** — the app defaults iOS → Rosi and
  Android → Rizal; `DEVICE_PERSON` in `src/theme.ts` handles the split.

If you rename a category or source id (e.g. `bca` → `mandiri`), also add an
entry to `CATEGORY_MIGRATION` / `migrateSource` in `src/theme.ts` so existing
saved data survives the rename.

## Features

- 📷 **Scan struk** — capture with the camera or import from the gallery, then
  on-device OCR + an Indonesian-tuned parser extracts merchant, date, total, and
  line items, guessing a category for the whole receipt **and for each item**.
- 🏷️ **Per-item categories** — one receipt is one transaction, but each line
  item can carry its own category (auto-guessed, editable, and you can add/remove
  items manually). Budgets aggregate spending at the item level.
- 👥 **Untuk siapa (Who)** — tag each expense to **Rosi, Rizal, Nonik, Rumah, or
  Lainnya**. The default follows the device: **Android → Rizal, iOS → Rosi**, and
  it's always editable.
- 💳 **Sumber dana (Source)** — BCA, SeaBank, BSI, Mandiri, BNI, OVO, ShopeePay,
  GoPay, Bibit, Ajaib, Emas, Tunai.
- ☁️ **Sinkron Google Sheet** — push all data to a Google Spreadsheet you own
  (the app stays the source of truth) via a small Apps Script Web App. The Sheet
  becomes a live, pivot-able mirror; you can also pull it back to restore or set
  up a new device. See [Google Sheet sync](#google-sheet-sync).
- 📊 **Ringkasan** — monthly spend vs. budget, a 7-day trend (bar chart), a
  category-breakdown donut, and a **per-person** breakdown.
- 🧾 **Transaksi** — grouped-by-day list filterable by **Kategori** or **Orang**;
  tap to edit, long-press to delete.
- 💰 **Anggaran** — per-category monthly limits (Rp) with progress bars and
  over-budget warnings; tap a category to adjust its limit.
- 💵 **Pemasukan (Income)** — toggle a transaction to income with the
  spreadsheet's income categories (Gaji, Bonus, Untung Investasi, Jualan, Bunga,
  Transfer Masuk, Lainnya). Income adds to a balance and is excluded from
  spending/budget totals; the dashboard shows income vs. expense vs. net.
- 🏦 **Saldo (Balances)** — a tab showing the running balance of every source
  (opening balance + income − cash expenses − settled CC bills). Tap a source to
  set its opening balance.
- 💳 **Kartu Kredit** — flag an expense as credit-card. It still counts as
  spending but does **not** reduce a cash balance when entered; it accumulates
  into the CC bill and is deducted from the configured pay-from account
  (default BCA) once its due date passes. BCA-style cutoff/due dates are
  configurable on the Saldo tab.
- 💾 **Offline & private** — all data stored locally via AsyncStorage, seeded
  with Indonesian sample data on first launch.

### Credit-card billing (gaya BCA)

Each card has a **statement cutoff** (*tanggal cetak*, default day 12) and a
**due date** (*tanggal jatuh tempo*, default day 27). Purchases are grouped by
the cutoff, not the due date:

- Buy on/before the cutoff → on this month's statement → due this month's due day.
- Buy after the cutoff → rolls to next month's statement → due next month.

So with cutoff 12 / due 27: a purchase on Jun 5–12 is due **Jun 27**; Jun 13+ is
due **Jul 27**. A CC purchase only reduces the pay-from balance once its due date
is on/before today. All three settings (cutoff, due day, pay-from account) are
editable on the **Saldo** tab.

### Categories (Kategori)

KPR · Utilitas · Transportasi · Personal Care · Makan & Minum · Langganan ·
ART · Sekolah · Hobi & Hiburan · Kebutuhan Rumah · Perabot & Peralatan ·
Fashion · Rokok & Alkohol · Sedekah & Hadiah · Kesehatan · Investasi Luar ·
Lainnya

Plus a set of **system categories** that appear only when generated by the
app: Biaya / Pajak Transaksi, Diskon, Rugi Investasi, Penyesuaian Saldo,
Transfer.

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Framework      | Expo SDK 55, React Native 0.83, React 19, TypeScript |
| Navigation     | React Navigation (bottom tabs + native stack) |
| On-device OCR  | `@react-native-ml-kit/text-recognition` |
| Camera / media | `expo-camera`, `expo-image-picker` |
| Charts         | Custom `react-native-svg` (donut + bars) |
| Storage        | `@react-native-async-storage/async-storage` |

## Project layout

```
src/
  ocr/
    parseReceipt.ts   # raw OCR text -> { merchant, date, total, items } + category guess
    recognize.ts      # runs ML Kit text recognition, then parseReceipt
  store/
    BudgetContext.tsx # state + AsyncStorage persistence
    selectors.ts      # derived data: spend/income by category, balances, CC status
    seed.ts           # default budgets, opening balances, CC config, samples
  sync/
    sheets.ts         # push/pull the dataset to a Google Sheet (Apps Script)
  utils/
    cc.ts             # BCA-style credit-card due-date / settlement logic
    format.ts         # Rupiah + Indonesian date formatting
  screens/            # Dashboard, Transactions, Budgets, Balances (Saldo),
                      # AddTransaction, ScanReceipt
  components/          # ui primitives + svg charts
  navigation/          # tab + stack navigators and route types
  theme.ts            # colors, spacing, categories, income categories, who, sources
google-apps-script/
  Code.gs             # the Web App backend you deploy on your own Sheet
```

## Google Sheet sync

The app is **local-first** and treats your data as the source of truth; sync
**pushes** everything into a Google Sheet you own through a tiny Apps Script Web
App. No Google login or OAuth is needed in the app — just a URL and a shared
secret token.

### One-time setup

1. Create a new Google Sheet (or copy your cashflow file).
2. **Extensions ▸ Apps Script**, delete the sample, and paste
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. Set `TOKEN` in the script to a long random secret.
4. **Deploy ▸ New deployment ▸ Web app** — *Execute as: Me*, *Who has access:
   Anyone* (the token is what protects the data). Copy the `…/exec` URL.
5. In the app: **Saldo ▸ Sinkronisasi Google Sheet**, paste the URL + the same
   token, then tap **Sinkronkan ke Sheet**.

### What gets written

- **`Transaksi`** — one row per transaction (flat table you can pivot/chart):
  `id, type, date, merchant, amount, category, incomeCategory, who, source,
  creditCard, note, items (JSON), scanned, createdAt`.
- **`Pengaturan`** — `section | key | value` rows for budgets (`budget`),
  opening balances (`opening`), and credit-card config (`cc`).

> This intentionally **adjusts** the original pivot-style `TEMPLATE` sheet into a
> normalized transactions table, which is what the app reads/writes cleanly. Your
> own pivots, monthly summaries, and charts can be built on top of `Transaksi`.

**Tarik dari Sheet** pulls the Sheet back and replaces local data — handy for a
new phone or to restore a backup. (Sync direction is app → Sheet; pulling is a
full replace, not a merge.)

## Type-check

```bash
npm run typecheck
```

## How receipt scanning works

1. `ScanReceiptScreen` captures an image (camera or library).
2. `recognizeReceipt(uri)` runs on-device text recognition and returns the raw
   text.
3. `parseReceipt(text)` applies Indonesian-tuned heuristics:
   - **Money** — parses Rupiah formats (`25.000`, `1.250.000`, `25.000,00`),
     treating `.`/`,` as thousands and a trailing 1–2 digit group as decimals.
   - **Total** — prefers total keywords (`total`, `total belanja/bayar`,
     `jumlah`…) while ignoring `subtotal`, `ppn`/`pajak`, `kembali`, etc.; falls
     back to the largest value.
   - **Date** — matches ISO and Indonesian day-first formats; date lines are
     never treated as items.
   - **Merchant** — first meaningful non-price line near the top.
   - **Items** — lines ending in a price (excluding totals/tax/payment rows),
     each assigned its **own** category via keyword match (falling back to the
     receipt's overall category).
4. The parsed draft prefills the form (with Who defaulted by platform), where
   everything — amount, who, source, and each item's category — is editable.

The parser is deliberately forgiving — OCR is noisy — and everything is editable.

## Deeper docs

- [HANDOFF.md](HANDOFF.md) — full walkthrough for taking over the project:
  secrets checklist, first-run signing quirks, moving to a new Google Sheet,
  where to change common things, known quirks.

## Notes

- **New Architecture:** the ML Kit module isn't formally listed as new-arch
  tested in the RN directory; it works through the interop layer in practice.
  If you hit issues, set `"newArchEnabled": false` via an
  `expo-build-properties` plugin config.
