# Keuangan Kita

A cross-platform (iOS + Android) personal budgeting app for **Rizal & Rosi**,
built with **Expo / React Native + TypeScript**. The UI is in **Bahasa
Indonesia** and all amounts are in **Rupiah (IDR)**. Snap a photo of a receipt
and it reads the merchant, date, total, and line items **entirely on-device**
using ML Kit / Apple Vision text recognition — no servers, no API keys, nothing
leaves your phone. The data model mirrors the couple's cashflow spreadsheet.

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
  Bibit, Ajaib, Tunai.
- 📊 **Ringkasan** — monthly spend vs. budget, a 7-day trend (bar chart), a
  category-breakdown donut, and a **per-person** breakdown.
- 🧾 **Transaksi** — grouped-by-day list filterable by **Kategori** or **Orang**;
  tap to edit, long-press to delete.
- 💰 **Anggaran** — per-category monthly limits (Rp) with progress bars and
  over-budget warnings; tap a category to adjust its limit.
- 💾 **Offline & private** — all data stored locally via AsyncStorage, seeded
  with Indonesian sample data on first launch.

### Categories (Kategori)

Cicilan Rumah · Listrik · Air · Internet · Skincare · Makan & Minum · Langganan ·
ART · Sekolah · Fun · Kebutuhan Rumah · Lainnya

> Adapted from the spreadsheet: removed *Car Instalment*, renamed *Apartment Rent*
> → *Cicilan Rumah*, and added *ART*, *Sekolah*, *Fun*, and *Kebutuhan Rumah*.

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Framework      | Expo SDK 56, React Native 0.85, React 19, TypeScript |
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
    selectors.ts      # derived data (monthly totals, by-category, daily series)
    seed.ts           # default budgets + sample transactions
  screens/            # Dashboard, Transactions, Budgets, AddTransaction, ScanReceipt
  components/          # ui primitives + svg charts
  navigation/          # tab + stack navigators and route types
  theme.ts            # colors, spacing, categories
```

## Running the app

> ⚠️ **A development build is required — this app will not run in Expo Go.**
> The on-device OCR module (`@react-native-ml-kit/text-recognition`) is a native
> module that Expo Go does not include. You build a custom dev client once, then
> iterate with fast refresh as usual.

### Prerequisites
- Node 18+
- **iOS:** macOS with Xcode + CocoaPods
- **Android:** Android Studio + an emulator or a device with USB debugging

### First run (builds the native dev client)

```bash
npm install

# iOS (simulator or connected device)
npm run ios

# Android (emulator or connected device)
npm run android
```

`npm run ios` / `npm run android` run `expo run:*`, which executes
`expo prebuild` to generate the native projects and then builds and launches the
dev client. After that first build, you can just run `npm start` and reload.

### Type-check

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

## Notes & next steps

- **New Architecture:** the ML Kit module isn't formally listed as new-arch
  tested in the RN directory; it works through the interop layer in practice.
  If you hit issues, set `"newArchEnabled": false` via an
  `expo-build-properties` plugin config.
- Possible follow-ups: native date picker, multi-currency, recurring expenses,
  CSV export, cloud sync/accounts, and editable scanned line items.
