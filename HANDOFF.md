# MoMoney — Project Handoff

Everything a new Claude Code account (or a new developer) needs to pick up
where this session left off. Skim once end-to-end before touching anything —
the order matters.

---

## 1. What you're inheriting

- A cross-platform (iOS + Android) personal budgeting app called **MoMoney**,
  in Bahasa Indonesia, IDR currency, for a couple (Rosi on iOS, Rizal on
  Android).
- **Local-first**: the phone is the source of truth. Optional two-way sync
  with a Google Sheet via an Apps Script Web App.
- **No servers, no API keys**, no OAuth. Data lives on the phones and (if
  configured) in the user's own Google Sheet.

Snapshot of the tech surface:

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK 55, React Native 0.83, React 19, TypeScript |
| Nav | React Navigation (bottom tabs + native stack) |
| OCR | `@react-native-ml-kit/text-recognition` (native module — needs a dev/prod build, **not** Expo Go) |
| Charts | Custom `react-native-svg` |
| Storage | `@react-native-async-storage/async-storage` |
| iOS signing | **Free Apple ID** (uses `plugins/withNoPushEntitlement.js` to strip `aps-environment`) |
| Android | EAS `preview` profile builds an installable APK |
| Sync | Google Apps Script Web App at `google-apps-script/Code.gs` |

---

## 2. Get the code

The repo is public at **https://github.com/rosiana/budgeting-app**:

```bash
git clone https://github.com/rosiana/budgeting-app.git
cd budgeting-app
npm install
```

To take over as the primary maintainer, fork it on GitHub (or push a fresh
copy to your own account) and update the `origin` remote:

```bash
git remote set-url origin git@github.com:<your-account>/budgeting-app.git
git push -u origin main
```

---

## 3. Secrets the new account will need

Nothing lives in the repo. Collect these out-of-band and put them where the
new dev / account can reach them (1Password, a shared vault — do **not**
paste into chat):

- **Google Apps Script `TOKEN`** — the shared secret pasted into `Code.gs`
  and into the app's Saldo → Sinkronisasi form. If the new account will use
  a **new** Sheet, they can pick a fresh token.
- **Google Apps Script Web App `/exec` URL** — same story: reusable if you
  want to keep the existing Sheet, otherwise regenerated after they redeploy
  the script.
- **iCloud / Apple ID email** used to sign the iOS build (free tier is
  fine). If handing off to a different Apple ID, plan for a first-run
  device trust prompt (Settings → General → VPN & Device Management → trust
  the developer).
- **EAS / Expo account** — the new dev can create their own; there are no
  secrets baked into `eas.json`. `eas-cli` will prompt on first `build`.

---

## 4. New-machine bring-up

### 4.1 Prerequisites

- Node 18+
- **iOS**: macOS + Xcode (Command Line Tools installed). Free Apple ID is
  fine.
- **Android**: Android Studio, or just use EAS to build the APK in the
  cloud (no local Android SDK needed).

### 4.2 First run — iOS on a real device

MoMoney will not run in Expo Go (OCR is a native module). The first build
generates the native iOS project.

```bash
# One-time prebuild + build + install to the connected iPhone.
npx expo run:ios --configuration Release --device "<phone-name>"
```

If the install step hangs with `TypeError: Cannot convert object to primitive
value`, the build itself already succeeded — install manually:

```bash
APP=$(ls -dt ~/Library/Developer/Xcode/DerivedData/MoMoney-*/Build/Products/Release-iphoneos/MoMoney.app | head -1)
xcrun devicectl device list                 # find your device UDID
xcrun devicectl device install app --device <UDID> "$APP"
```

**First time trusting the app on the phone**: Settings → General → VPN &
Device Management → tap the developer profile → Trust. Then launch the app.

### 4.3 Android APK (no Android Studio required)

The `preview` profile in `eas.json` builds an installable APK on Expo's
servers.

```bash
npx eas-cli login                    # first time only
npx eas-cli build --platform android --profile preview --non-interactive --no-wait
```

The build URL prints to the terminal; the finished `.apk` is downloadable
from that page and can be sideloaded (Files → Install) on the Android
phone. Enable "Install unknown apps" for the browser used to download it.

### 4.4 Type-check

```bash
npm run typecheck
```

Do this after any code change before building — the tsc errors are far
faster than watching a build fail.

---

## 5. Google Sheet sync — moving to a new Sheet

If the new account wants to run their **own** Sheet (recommended for a
clean handover):

1. Create a new Google Sheet.
2. Extensions → Apps Script → paste `google-apps-script/Code.gs`, then set
   `TOKEN` at the top to a fresh long random string.
3. Deploy → New deployment → Web app → *Execute as: Me*, *Who has access:
   Anyone* — copy the `/exec` URL.
4. In the app: Saldo → Sinkronisasi Google Sheet → paste URL + the token,
   tap Simpan & sinkron sekarang.
5. The FIRST sync pushes local data up and pulls the merged result back —
   next syncs (2-way merge, per-tx `updatedAt` LWW) happen automatically.

To hand over the **existing** Sheet, share the Sheet with the new owner's
Google account and hand them the URL + token; no redeploy needed.

**Tombstones**: deletes are soft — a `deleted: true` row stays on the Sheet
so the other phone converges. You'll see them in the `Transaksi` tab of the
Sheet; that's expected.

**Recently added columns**: `transferGroup` (links the two legs of a
Transfer) and `ccPaidAt` (Bayar Tagihan on Saldo pre-pays a CC bill). The
first sync from a phone running the latest app will extend the sheet header
automatically; old-schema sheets stay backward compatible.

---

## 6. Signing quirks (free Apple ID)

The stripping of the push-notification entitlement is done by a **config
plugin**, not by hand-editing Xcode. Files involved:

- `plugins/withNoPushEntitlement.js` — removes `aps-environment` after
  `expo-notifications` inserts it. Free Apple IDs can't sign that
  entitlement.
- `ios/MoMoney/MoMoney.entitlements` — should stay `<dict/>` (empty). If
  you see it grow after a prebuild, re-run the plugin (it's referenced from
  `app.json`).
- **Don't** add `expo-notifications` to the `plugins` array in `app.json`
  above the no-push plugin — order matters.

If the new dev switches to a **paid Apple Developer team**, they can drop
the `withNoPushEntitlement` plugin and let `expo-notifications` install the
push entitlement normally.

---

## 7. Running the CC / transfer / adjustment features

Non-obvious behaviors a new maintainer should know:

- **Bayar Tagihan** (Saldo → Kartu Kredit) marks every outstanding CC row
  with `ccPaidAt = today`, which the selector treats as an early-settlement
  date. The amount deducts from `creditCard.paymentSource` immediately.
- **Transfer** stores TWO transactions linked by `transferGroup`. The
  Transaksi screen COLLAPSES them into ONE accordion at render time; both
  underlying rows are still persisted (needed for correct per-account
  balances). Deleting the accordion deletes both legs.
- **Penyesuaian Saldo / Investasi**: multiple adjustments on the same date
  merge into one accordion at render time. Single-adjustment days render
  as a normal row. Both aggregations are visual only — the underlying
  transactions stay individual.
- Aggregated rows are **not editable** — Alert prompts the user to delete +
  re-add.

---

## 8. Where to change common things

| Change | File |
| --- | --- |
| Add / rename a category | `src/theme.ts` (CATEGORIES, PICKABLE_CATEGORIES, ANGGARAN_CATEGORIES) + `src/types.ts` union + a migration in `src/theme.ts` `migrateCategory` |
| Add a new source account | `src/theme.ts` SOURCES + `src/types.ts` SourceId union + `migrateSource` if renaming |
| Change default budgets / opening balances | `src/store/seed.ts` |
| CC billing rules | `src/utils/cc.ts` + Saldo screen |
| Receipt parser heuristics | `src/ocr/parseReceipt.ts` |
| Google Sheet schema | `google-apps-script/Code.gs` `TX_HEADERS` + `readTransactions` + `writeTransactions` — mirror any change on both sides |
| Sync merge semantics | `google-apps-script/Code.gs` `mergeAndWrite` and `src/sync/sheets.ts` |
| Notification schedule | `src/utils/notifications.ts` |

---

## 9. Known quirks to expect

- **`TypeError: Cannot convert object to primitive value`** at the end of an
  `expo run:ios` command is a known Expo issue when it tries to auto-install
  to the device. The build did succeed; install manually with `xcrun
  devicectl device install app …` (see §4.2).
- **Fredoka font** is applied via wrapper components in
  `src/components/typography.tsx` (Text + TextInput). Don't import Text /
  TextInput from `react-native` directly in screens — use the wrappers so
  the font stays consistent.
- **`SectionTitle` owns the top margin** between sections. Don't add
  `marginBottom` to Card components — that used to compound with SectionTitle
  and made spacing inconsistent.
- **Grid background** is drawn with `react-native-svg` `Pattern`, not
  `ImageBackground`, because the latter rendered at different densities on
  Android.
- **Sync signature loop guard**: `BudgetContext` hashes state to skip
  redundant syncs. When adding a new field that should trigger a resync,
  include it in `dataSignature`.

---

## 10. Contact tickets in the code

Search these to find implementation notes:

```bash
grep -rn "TODO\|FIXME\|XXX" src/ google-apps-script/ | grep -v node_modules
```

Nothing critical is outstanding at handoff time — the todos there are
minor polish items.

Good luck. 🐒
