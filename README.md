# Receipt Budget

A cross-platform (iOS + Android) personal budgeting app built with **Expo / React
Native + TypeScript**. Snap a photo of a receipt and it reads the merchant, date,
total, and line items **entirely on-device** using ML Kit / Apple Vision text
recognition — no servers, no API keys, nothing leaves your phone.

## Features

- 📷 **Receipt scanning** — capture with the camera or import from your photo
  library, then on-device OCR + a heuristic parser extracts merchant, date,
  total, and line items, and even guesses the category.
- 📊 **Dashboard** — monthly spend vs. budget, a 7-day spending trend (bar
  chart), and a category breakdown donut.
- 🧾 **Expenses** — grouped-by-day transaction list with category filters; tap
  to edit, long-press to delete.
- 💰 **Budgets** — per-category monthly limits with progress bars and
  over-budget warnings; tap a category to adjust its limit.
- 💾 **Offline & private** — all data is stored locally via AsyncStorage. First
  launch is seeded with sample data so the UI isn't empty.

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
3. `parseReceipt(text)` applies heuristics:
   - **Total** — prefers lines containing total keywords (ignoring subtotal/tax),
     falls back to the largest currency value.
   - **Date** — matches ISO, `mm/dd/yyyy`, and named-month formats.
   - **Merchant** — first meaningful non-price line near the top.
   - **Items** — lines ending in a price (excluding totals/tax/payment rows).
   - **Category** — keyword match on merchant + text.
4. The parsed draft prefills the Add Expense form, where the user can correct
   anything before saving.

The parser is deliberately forgiving — OCR is noisy — and everything is editable.

## Notes & next steps

- **New Architecture:** the ML Kit module isn't formally listed as new-arch
  tested in the RN directory; it works through the interop layer in practice.
  If you hit issues, set `"newArchEnabled": false` via an
  `expo-build-properties` plugin config.
- Possible follow-ups: native date picker, multi-currency, recurring expenses,
  CSV export, cloud sync/accounts, and editable scanned line items.
