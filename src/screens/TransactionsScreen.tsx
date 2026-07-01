import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomActions, Empty, GridBg, IconCircle, MonthNav, Pill, PrivacyEye, SegmentTabs } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import { groupByDate } from '../store/selectors';
import {
  CATEGORIES,
  CATEGORY_MAP,
  categoryOf,
  colors,
  fill,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_MAP,
  PICKABLE_CATEGORIES,
  PICKABLE_INCOME_CATEGORIES,
  radius,
  sourceOf,
  SOURCES,
  spacing,
  txVisual,
  WHO,
  whoOf,
} from '../theme';
import { CategoryId, LineItem, SourceId, Transaction, WhoId } from '../types';

/** Display-only extensions to LineItem so a synthesized item can override the
 *  who-chip label + color, add a "· extra text" after the chip, use a custom
 *  icon (e.g., the arrow-up/down used by the Keluar/Masuk tabs), and carry a
 *  Masuk/Keluar type for mode-based filtering. Not persisted. */
type DisplayItem = LineItem & {
  chipLabel?: string;
  chipColor?: string;
  metaText?: string | null; // null = hide the "· category" trailing text
  iconOverride?: { name: string; color: string };
  itemType?: 'expense' | 'income';
};
/** Display-only extensions to Transaction: an aggregated transfer / balance-
 *  adjustment carries a `componentIds` array so deleting the row deletes all
 *  its underlying rows, and a `transferSummary` so we can render the special
 *  "from → to" pill on the shell. */
type DisplayTx = Omit<Transaction, 'items'> & {
  items?: DisplayItem[];
  transferSummary?: { fromLabel: string; toLabel: string; fromColor: string; toColor: string };
  componentIds?: string[];
  /** Suppress the auto Biaya/Diskon remainder row — set on synthesized rows
   *  where the fee/discount is already an explicit item. */
  suppressRemainder?: boolean;
};
import {
  currentMonthKey,
  formatCurrency,
  formatDateFriendly,
  formatMonth,
  monthKey as monthKeyOf,
  shiftMonth,
} from '../utils/format';
import { useMoney } from '../utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'semua' | 'pengeluaran' | 'pemasukan';

export default function TransactionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, deleteTransaction } = useBudget();
  const money = useMoney();
  const [month, setMonth] = useState(currentMonthKey());
  const [mode, setMode] = useState<Mode>('semua');
  const [catFilter, setCatFilter] = useState<string>('all'); // expense category id
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Extra filters (separate from the mode tabs and the category pills).
  const [filterOpen, setFilterOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [whoFilter, setWhoFilter] = useState<WhoId | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceId | 'all'>('all');
  const hasExtraFilter =
    nameQuery.trim().length > 0 || whoFilter !== 'all' || sourceFilter !== 'all';
  const [incFilter, setIncFilter] = useState<string>('all'); // income category id

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyOf(t.date) === month),
    [transactions, month]
  );

  // Collapse related rows into single accordions:
  //  - Transfers: the two legs (expense + income) sharing a transferGroup are
  //    merged into ONE row with items = [Ke <to>, Dari <from>, +/− Biaya/Diskon].
  //  - Penyesuaian Saldo: every manual balance adjustment on the same date
  //    becomes one row grouped by date, with each leg as an item.
  //  - Investasi: Rugi Investasi + Untung Investasi on the same date are
  //    aggregated into one "Penyesuaian Investasi" accordion.
  const collapsed: DisplayTx[] = useMemo(() => {
    const out: DisplayTx[] = [];
    const seenTransfer = new Set<string>();
    const penyesuaianByDate = new Map<string, Transaction[]>();
    const investasiByDate = new Map<string, Transaction[]>();

    const isPenyesuaian = (t: Transaction) =>
      t.category === 'penyesuaian_saldo' || t.incomeCategory === 'penyesuaian_saldo_in';
    const isInvestasi = (t: Transaction) =>
      t.category === 'rugi_investasi' || t.incomeCategory === 'investasi';

    for (const t of monthTx) {
      if (t.transferGroup) {
        if (seenTransfer.has(t.transferGroup)) continue;
        seenTransfer.add(t.transferGroup);
        const legs = monthTx.filter((x) => x.transferGroup === t.transferGroup);
        // Under the 3-leg model:
        //   - transfer_out expense = "money moved" out (equal to transfer_in)
        //   - transfer_in income   = "money moved" in
        //   - biaya_pajak expense  = fee (out > in case), optional
        //   - diskon income        = discount (in > out case), optional
        // Legacy 2-leg rows (from before the split) are still valid: no fee
        // leg, transfer_out.amount already = transfer_in.amount.
        const movedOutLeg = legs.find((x) => x.category === 'transfer_out');
        const movedInLeg = legs.find((x) => x.incomeCategory === 'transfer_in');
        const feeLeg = legs.find((x) => x.category === 'biaya_pajak');
        const discountLeg = legs.find((x) => x.category === 'diskon' && x.type === 'income');
        if (!movedOutLeg || !movedInLeg) {
          out.push(t); // malformed — leave alone
          continue;
        }
        const fromSrc = sourceOf(movedOutLeg.source);
        const toSrc = sourceOf(movedInLeg.source);
        const fromOwner = whoOf(fromSrc.owner);
        const toOwner = whoOf(toSrc.owner);
        const moved = movedOutLeg.amount;
        const items: DisplayItem[] = [
          {
            description: `Ke ${toSrc.label}`,
            amount: moved,
            category: 'transfer_out',
            who: fromOwner.id,
            chipLabel: fromOwner.label,
            chipColor: fromOwner.color,
            metaText: fromSrc.label,
            iconOverride: { name: 'arrow-up-circle', color: colors.danger },
            itemType: 'expense',
          },
          {
            description: `Dari ${fromSrc.label}`,
            amount: moved,
            category: 'lainnya',
            who: toOwner.id,
            chipLabel: toOwner.label,
            chipColor: toOwner.color,
            metaText: toSrc.label,
            iconOverride: { name: 'arrow-down-circle', color: colors.success },
            itemType: 'income',
          },
        ];
        // Fee = real expense on the source account. Uses the standard chip
        // (owner + account name) — no more "otomatis" label.
        if (feeLeg) {
          items.push({
            description: 'Biaya / Pajak Transaksi',
            amount: feeLeg.amount,
            category: 'biaya_pajak',
            who: fromOwner.id,
            chipLabel: fromOwner.label,
            chipColor: fromOwner.color,
            metaText: fromSrc.label,
            iconOverride: { name: 'arrow-up-circle', color: colors.danger },
            itemType: 'expense',
          });
        } else if (discountLeg) {
          items.push({
            description: 'Diskon',
            amount: discountLeg.amount,
            category: 'diskon',
            who: toOwner.id,
            chipLabel: toOwner.label,
            chipColor: toOwner.color,
            metaText: toSrc.label,
            iconOverride: { name: 'arrow-down-circle', color: colors.success },
            itemType: 'income',
          });
        }
        out.push({
          ...movedOutLeg,
          merchant: `Transfer ${fromSrc.label} → ${toSrc.label}`,
          // Shell amount = the transferred amount (money that actually
          // moved), rendered NEUTRAL / black. Fee / discount contribute to
          // the daily subtotal but don't inflate the shell amount.
          amount: moved,
          items,
          transferSummary: {
            fromLabel: fromOwner.label,
            toLabel: toOwner.label,
            fromColor: fromOwner.color,
            toColor: toOwner.color,
          },
          componentIds: legs.map((l) => l.id),
          suppressRemainder: true,
        });
        continue;
      }
      if (isPenyesuaian(t)) {
        const key = t.date;
        if (!penyesuaianByDate.has(key)) penyesuaianByDate.set(key, []);
        penyesuaianByDate.get(key)!.push(t);
        continue;
      }
      if (isInvestasi(t)) {
        const key = t.date;
        if (!investasiByDate.has(key)) investasiByDate.set(key, []);
        investasiByDate.get(key)!.push(t);
        continue;
      }
      out.push(t);
    }

    const emitDayGroup = (
      key: string,
      legs: Transaction[],
      merchant: string,
      parentCategory: CategoryId,
      kind: 'penyesuaian' | 'investasi'
    ) => {
      if (legs.length === 1) {
        // Only one adjustment that day — no need to synthesize a group.
        out.push(legs[0]);
        return;
      }
      // Signed net: income adds, expense subtracts. The parent shell uses the
      // magnitude of that net for the amount so the shell reads sensibly at a
      // glance; per-leg items keep their real amounts.
      const net = legs.reduce(
        (s, l) => s + (l.type === 'income' ? l.amount : -l.amount),
        0
      );
      const items: DisplayItem[] = legs.map((l) => {
        const s = sourceOf(l.source);
        const owner = whoOf(s.owner);
        // metaText:
        //   - Penyesuaian Saldo: null (chip only — user wants no trailing text)
        //   - Investasi:        "Untung Investasi" / "Rugi Investasi"
        const metaText =
          kind === 'penyesuaian'
            ? null
            : l.type === 'income'
              ? 'Untung Investasi'
              : 'Rugi Investasi';
        return {
          description: `${l.type === 'income' ? '+ ' : '− '}${s.label}`,
          amount: l.amount,
          category: l.category,
          who: owner.id,
          chipLabel: owner.label,
          chipColor: owner.color,
          metaText,
          iconOverride: {
            name: l.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle',
            color: l.type === 'income' ? colors.success : colors.danger,
          },
          itemType: l.type === 'income' ? 'income' : 'expense',
        } as DisplayItem;
      });
      // Represent as an expense-typed row (so the shell renders neutrally) but
      // display the signed amount in the merchant amount slot.
      out.push({
        id: `grp:${parentCategory}:${key}`,
        type: 'expense',
        date: key,
        merchant,
        // Amount here is the sum of item amounts — TxRow reads shell amount
        // from items when suppressRemainder is on. We stash the signed net
        // on `note` so the amount label can show sign properly (below).
        amount: legs.reduce((s, l) => s + l.amount, 0),
        category: parentCategory,
        who: 'rumah',
        source: legs[0].source,
        createdAt: Math.max(...legs.map((l) => l.createdAt || 0)),
        updatedAt: Math.max(...legs.map((l) => l.updatedAt || l.createdAt || 0)),
        items,
        componentIds: legs.map((l) => l.id),
        suppressRemainder: true,
        // Piggy-back the signed net so TxRow can display "+X" / "−X".
        note: `__net__:${net}`,
      });
    };

    for (const [key, legs] of penyesuaianByDate) {
      emitDayGroup(key, legs, 'Penyesuaian Saldo', 'penyesuaian_saldo', 'penyesuaian');
    }
    for (const [key, legs] of investasiByDate) {
      emitDayGroup(key, legs, 'Penyesuaian Investasi', 'rugi_investasi', 'investasi');
    }
    return out;
  }, [monthTx]);

  // The active expense category (for showing per-item portions), if any.
  const activeCat: CategoryId | null =
    mode !== 'pemasukan' && catFilter !== 'all' ? (catFilter as CategoryId) : null;
  // When the user typed a name query, we also narrow multi-item accordions to
  // the matching items (same UX as the category filter — "dari total X").
  const activeNameQuery = nameQuery.trim().toLowerCase();
  // Mode-driven item type filter: in Masuk we show only income items inside
  // an accordion; in Keluar only expense items. Applied to both aggregated
  // rows (transfer / daily group) and regular multi-item baskets.
  const activeItemType: 'income' | 'expense' | null =
    mode === 'pemasukan' ? 'income' : mode === 'pengeluaran' ? 'expense' : null;
  // For regular multi-item rows (not synthesized), items don't carry an
  // explicit itemType — fall back to the parent's type.
  const effectiveItemType = (it: DisplayItem, parent: DisplayTx): 'income' | 'expense' =>
    it.itemType ?? (parent.type === 'income' ? 'income' : 'expense');

  const filtered: DisplayTx[] = useMemo(() => {
    let list: DisplayTx[] = collapsed;

    // 1) Mode gate. Aggregated rows survive as long as AT LEAST ONE of
    //    their items matches the target itemType — so a Transfer row shows
    //    in Masuk (its income leg) and in Keluar (its expense leg), and a
    //    Penyesuaian Saldo group shows in whichever tab has legs to display.
    if (mode === 'pemasukan') {
      list = list.filter(
        (t) =>
          t.type === 'income' ||
          (t.items?.some((it) => effectiveItemType(it, t) === 'income') ?? false)
      );
    } else if (mode === 'pengeluaran') {
      list = list.filter(
        (t) =>
          t.type !== 'income' ||
          (t.items?.some((it) => effectiveItemType(it, t) === 'expense') ?? false)
      );
    }

    // 2) Category / income-category tab filter.
    if (mode === 'pemasukan') {
      if (incFilter !== 'all') {
        list = list.filter((t) => t.incomeCategory === incFilter);
      }
    } else if (catFilter !== 'all') {
      list = list.filter(
        (t) =>
          t.category === catFilter ||
          (t.items?.some((it) => it.category === catFilter) ?? false)
      );
    }

    // 3) Extra filters from the filter sheet.
    const q = nameQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        if ((t.merchant || '').toLowerCase().includes(q)) return true;
        return t.items?.some((it) => (it.description || '').toLowerCase().includes(q)) ?? false;
      });
    }
    if (whoFilter !== 'all') {
      list = list.filter(
        (t) =>
          t.who === whoFilter ||
          (t.items?.some((it) => it.who === whoFilter) ?? false)
      );
    }
    if (sourceFilter !== 'all') {
      list = list.filter((t) => {
        if (t.source === sourceFilter) return true;
        // Aggregated transfers / daily groups: match the sourceFilter if any
        // of their underlying legs used that account.
        if (t.componentIds?.length) {
          const legs = monthTx.filter((x) => t.componentIds!.includes(x.id));
          if (legs.some((l) => l.source === sourceFilter)) return true;
        }
        return false;
      });
    }
    return list;
  }, [collapsed, monthTx, mode, catFilter, incFilter, nameQuery, whoFilter, sourceFilter]);

  // Amount to show for a row — when either a category or a name query is
  // active, an itemized transaction shows just the sum of items that match.
  // If both are active, items must match both.
  const itemMatchesFilters = (it: DisplayItem, parent: DisplayTx): boolean => {
    if (activeCat && it.category !== activeCat) return false;
    if (activeNameQuery && !(it.description || '').toLowerCase().includes(activeNameQuery)) return false;
    if (activeItemType && effectiveItemType(it, parent) !== activeItemType) return false;
    return true;
  };
  // hasItemFilter now also flips true when a mode filter is active on a row
  // whose items span both types (transfer aggregation, daily groups).
  const hasItemFilter = !!activeCat || !!activeNameQuery || !!activeItemType;
  const parentNameMatches = (t: DisplayTx): boolean =>
    !activeNameQuery || (t.merchant || '').toLowerCase().includes(activeNameQuery);

  const rowAmount = (t: DisplayTx): number => {
    if (hasItemFilter && t.items && t.items.length) {
      // Parent name hit + no other item-level filter → row is "the whole
      // transaction", show the full amount.
      if (
        activeNameQuery &&
        parentNameMatches(t) &&
        !activeCat &&
        !activeItemType
      )
        return t.amount;
      const portion = t.items.filter((it) => itemMatchesFilters(it, t)).reduce((s, it) => s + it.amount, 0);
      return portion || t.amount;
    }
    return t.amount;
  };
  const matchingItems = (t: DisplayTx): DisplayItem[] => {
    if (!hasItemFilter || !t.items) return [];
    if (
      activeNameQuery &&
      parentNameMatches(t) &&
      !activeCat &&
      !activeItemType
    )
      return [];
    return t.items.filter((it) => itemMatchesFilters(it, t));
  };
  // When all matching items are income (Masuk mode showing the income leg of
  // a Transfer, or the +ve legs of Penyesuaian Saldo), display the parent
  // amount as green +N to signal "this row IS an income here".
  const displayType = (t: DisplayTx): 'expense' | 'income' => {
    if (t.type === 'income') return 'income';
    const items = matchingItems(t);
    if (items.length && items.every((it) => effectiveItemType(it, t) === 'income')) {
      return 'income';
    }
    return 'expense';
  };

  const sections = useMemo(
    () =>
      groupByDate(filtered).map((g) => ({
        title: formatDateFriendly(g.date),
        // Net for the day: income adds, expense subtracts.
        // Special cases:
        //   - Regular tx: income ? +amount : -rowAmount(shown, respecting filter)
        //   - Aggregated Transfer: contributes only the fee (−) or discount
        //     (+) — the moved-pair itself is zero net (money just switched
        //     accounts). In Masuk/Keluar mode uses the filtered items sum.
        //   - Aggregated Penyesuaian Saldo / Investasi: signed net of every
        //     leg (income adds, expense subtracts). User wants Investasi to
        //     move the daily subtotal even though selectors don't count it
        //     as real income/spending, because on Saldo it still affected
        //     net worth that day.
        subtotal: g.items.reduce((s, tRaw) => {
          const t = tRaw as DisplayTx;
          if (t.transferSummary || t.componentIds) {
            // Aggregated. Under a mode filter, use the filtered item sum;
            // otherwise walk the underlying legs.
            if (activeItemType) {
              const sum = matchingItems(t).reduce((a, it) => a + it.amount, 0);
              return s + (activeItemType === 'income' ? sum : -sum);
            }
            if (t.transferSummary) {
              // Sum fee (−) + discount (+) legs only. The moved pair cancels
              // to zero for daily-net purposes.
              const legs = monthTx.filter((l) => t.componentIds?.includes(l.id));
              let net = 0;
              for (const l of legs) {
                if (l.category === 'biaya_pajak') net -= l.amount;
                else if (l.category === 'diskon' && l.type === 'income') net += l.amount;
              }
              return s + net;
            }
            // Daily group: signed net across all legs.
            const legs = monthTx.filter((l) => t.componentIds?.includes(l.id));
            const net = legs.reduce(
              (a, l) => a + (l.type === 'income' ? l.amount : -l.amount),
              0
            );
            return s + net;
          }
          return s + (t.type === 'income' ? t.amount : -rowAmount(t));
        }, 0),
        // Newest first within the day (by createdAt; updatedAt as tiebreaker).
        data: [...g.items].sort(
          (a, b) =>
            (b.createdAt ?? b.updatedAt ?? 0) - (a.createdAt ?? a.updatedAt ?? 0)
        ),
      })),
    [filtered, monthTx, activeCat, activeNameQuery, activeItemType]
  );

  const confirmDelete = (tx: DisplayTx) => {
    Alert.alert('Hapus transaksi', `Hapus "${tx.merchant}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          // Aggregated rows (Transfer, Penyesuaian Saldo/Investasi grouping)
          // carry the underlying ids so we clean up every leg in one tap.
          const ids = tx.componentIds && tx.componentIds.length ? tx.componentIds : [tx.id];
          ids.forEach((id) => deleteTransaction(id));
        },
      },
    ]);
  };

  const openEdit = (tx: DisplayTx) => {
    // Transfer aggregate → open the form on the Transfer tab, pre-filled
    // with the group's from/to accounts and the actual out / in amounts.
    // Save wipes the old legs and writes fresh ones (see AddTransactionScreen).
    if (tx.transferSummary && tx.componentIds && tx.componentIds.length >= 2) {
      const legs = transactions.filter((t) => t.transferGroup === tx.transferGroup);
      const outLeg = legs.find((l) => l.category === 'transfer_out');
      const inLeg = legs.find((l) => l.incomeCategory === 'transfer_in');
      const feeLeg = legs.find((l) => l.category === 'biaya_pajak');
      const discountLeg = legs.find((l) => l.category === 'diskon' && l.type === 'income');
      if (!outLeg || !inLeg || !tx.transferGroup) return;
      const moved = outLeg.amount;
      const feeAmt = feeLeg?.amount ?? 0;
      const discAmt = discountLeg?.amount ?? 0;
      navigation.navigate('AddTransaction', {
        draft: {
          type: 'transfer',
          date: tx.date,
          transfer: {
            group: tx.transferGroup,
            fromSource: outLeg.source,
            toSource: inLeg.source,
            amountOut: moved + feeAmt,
            amountIn: moved + discAmt,
          },
        },
      });
      return;
    }
    // Daily penyesuaian / investasi groups still aren't a single row to edit.
    if (tx.componentIds && tx.componentIds.length > 1) {
      Alert.alert(
        'Grup harian tidak bisa diubah',
        'Hapus lalu tambah ulang penyesuaian jika perlu diubah.',
        [{ text: 'OK' }]
      );
      return;
    }
    navigation.navigate('AddTransaction', {
      draft: {
        id: tx.id,
        type: tx.type,
        merchant: tx.merchant,
        amount: tx.amount,
        date: tx.date,
        category: tx.category,
        incomeCategory: tx.incomeCategory,
        who: tx.who,
        source: tx.source,
        creditCard: tx.creditCard,
        reimbursable: tx.reimbursable,
        reimbursed: tx.reimbursed,
        note: tx.note,
        items: tx.items,
        image: tx.image,
        scanned: tx.scanned,
      },
    });
  };

  return (
    <View style={styles.root}>
      <GridBg />
      <PrivacyEye topOffset={insets.top} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Transaksi</Text>
        <Text style={styles.count}>{monthTx.length} bulan ini</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <MonthNav
          label={formatMonth(month)}
          onPrev={() => setMonth((m) => shiftMonth(m, -1))}
          onNext={() => setMonth((m) => shiftMonth(m, 1))}
          canNext={month < currentMonthKey()}
        />
      </View>

      {/* Mode toggle + filter button */}
      <View style={styles.modeRow}>
        <View style={{ flex: 1 }}>
          <SegmentTabs
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { id: 'semua', label: 'Semua' },
              { id: 'pengeluaran', label: 'Keluar', icon: 'arrow-up-circle', activeIconColor: colors.danger },
              { id: 'pemasukan', label: 'Masuk', icon: 'arrow-down-circle', activeIconColor: colors.success },
            ]}
          />
        </View>
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={[styles.filterBtn, hasExtraFilter && styles.filterBtnOn]}
          hitSlop={8}
        >
          <Ionicons
            name="options"
            size={18}
            color={hasExtraFilter ? colors.white : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {mode !== 'semua' ? (
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {mode === 'pengeluaran' ? (
              <>
                <Pill label="Semua" active={catFilter === 'all'} onPress={() => setCatFilter('all')} />
                {PICKABLE_CATEGORIES.map((id) => {
                  const c = CATEGORY_MAP[id];
                  return (
                    <Pill
                      key={id}
                      label={c.label}
                      icon={c.iconSet ? undefined : (c.icon as any)}
                      color={c.color}
                      active={catFilter === id}
                      onPress={() => setCatFilter(id)}
                    />
                  );
                })}
              </>
            ) : (
              <>
                <Pill label="Semua" active={incFilter === 'all'} onPress={() => setIncFilter('all')} />
                {PICKABLE_INCOME_CATEGORIES.map((id) => {
                  const c = INCOME_CATEGORY_MAP[id];
                  return (
                    <Pill
                      key={id}
                      label={c.label}
                      icon={c.icon as any}
                      color={colors.success}
                      active={incFilter === id}
                      onPress={() => setIncFilter(id)}
                    />
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: spacing.lg }}
        ListEmptyComponent={
          <Empty
            icon="receipt-outline"
            title="Belum ada transaksi"
            subtitle="Scan struk atau tambah pengeluaran untuk mulai mencatat."
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{section.title}</Text>
            <Text style={styles.sectionSubtotal}>
              {section.subtotal >= 0 ? '+' : '-'}
              {money(Math.abs(section.subtotal))}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TxRow
            tx={item}
            money={money}
            hasItemFilter={hasItemFilter}
            rowAmount={rowAmount}
            matchingItems={matchingItems}
            displayType={displayType(item)}
            expanded={!!expanded[item.id]}
            onToggleExpand={() => setExpanded((m) => ({ ...m, [item.id]: !m[item.id] }))}
            onEdit={openEdit}
            onDelete={confirmDelete}
          />
        )}
      />

      <BottomActions
        insetsBottom={insets.bottom}
        onScan={() => navigation.navigate('ScanReceipt')}
        onAdd={() => navigation.navigate('AddTransaction')}
      />

      <FilterSheet
        visible={filterOpen}
        nameQuery={nameQuery}
        whoFilter={whoFilter}
        sourceFilter={sourceFilter}
        nameSuggestions={Array.from(
          new Set(transactions.map((t) => (t.merchant || '').trim()).filter(Boolean))
        )}
        onClose={() => setFilterOpen(false)}
        onApply={(n, w, s) => {
          setNameQuery(n);
          setWhoFilter(w);
          setSourceFilter(s);
          setFilterOpen(false);
        }}
        onClear={() => {
          setNameQuery('');
          setWhoFilter('all');
          setSourceFilter('all');
          setFilterOpen(false);
        }}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

/** Bottom sheet for the extra filters that don't belong on a horizontal pill
 *  strip (nama with autosuggest, untuk siapa, sumber dana). Applies on top of
 *  whichever mode tab is active. */
function FilterSheet({
  visible,
  nameQuery,
  whoFilter,
  sourceFilter,
  nameSuggestions,
  bottomInset,
  onApply,
  onClear,
  onClose,
}: {
  visible: boolean;
  nameQuery: string;
  whoFilter: WhoId | 'all';
  sourceFilter: SourceId | 'all';
  nameSuggestions: string[];
  bottomInset: number;
  onApply: (name: string, who: WhoId | 'all', source: SourceId | 'all') => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(nameQuery);
  const [who, setWho] = useState<WhoId | 'all'>(whoFilter);
  const [source, setSource] = useState<SourceId | 'all'>(sourceFilter);

  // Sync internal state when the sheet re-opens with parent values.
  React.useEffect(() => {
    if (visible) {
      setName(nameQuery);
      setWho(whoFilter);
      setSource(sourceFilter);
    }
  }, [visible, nameQuery, whoFilter, sourceFilter]);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return nameSuggestions
      .filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .slice(0, 5);
  }, [name, nameSuggestions]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* KAV pushes the sheet above the keyboard; ScrollView lets the body
       *  scroll so the Nama input + suggestions stay reachable even on a
       *  small screen with the keyboard open. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.fsWrap}
      >
        <TouchableOpacity style={styles.fsBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.fsSheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: bottomInset + spacing.xl }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.fsTitle}>Filter Transaksi</Text>

            <Text style={styles.fsLabel}>Nama Transaksi</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="cari nama..."
              placeholderTextColor={colors.textMuted}
              style={styles.fsInput}
            />
            {suggestions.length ? (
              <View style={styles.fsSuggestRow}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setName(s)}
                    style={styles.fsSuggestChip}
                  >
                    <Text style={styles.fsSuggestText} numberOfLines={1}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.fsLabel}>Untuk Siapa</Text>
            <View style={styles.fsChipRow}>
              <FsChip label="Semua" active={who === 'all'} onPress={() => setWho('all')} />
              {WHO.map((w) => (
                <FsChip
                  key={w.id}
                  label={`${w.emoji} ${w.label}`}
                  color={w.color}
                  active={who === w.id}
                  onPress={() => setWho(w.id)}
                />
              ))}
            </View>

            <Text style={styles.fsLabel}>Sumber Dana</Text>
            <View style={styles.fsChipRow}>
              <FsChip label="Semua" active={source === 'all'} onPress={() => setSource('all')} />
              {SOURCES.map((s) => {
                // Only disambiguate labels that would otherwise collide across
                // owners (ShopeePay, GoPay, Tunai). BCA, Bibit, etc. are
                // unique so we skip the "· Rosi/Rizal" suffix.
                const dup =
                  SOURCES.filter((o) => o.label === s.label).length > 1;
                const label = dup
                  ? `${s.label} · ${whoOf(s.owner).label}`
                  : s.label;
                return (
                  <FsChip
                    key={s.id}
                    label={label}
                    color={s.color}
                    sourceIcon={s.icon}
                    active={source === s.id}
                    onPress={() => setSource(s.id)}
                  />
                );
              })}
            </View>

            <View style={styles.fsButtons}>
              <TouchableOpacity onPress={onClear} style={styles.fsClearBtn}>
                <Text style={styles.fsClearText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onApply(name, who, source)}
                style={styles.fsApplyBtn}
              >
                <Text style={styles.fsApplyText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FsChip({
  label,
  color,
  active,
  onPress,
  sourceIcon,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
  /** When set, the chip shows the same colored icon-circle the Saldo screen
   *  uses for that source, so the filter feels visually consistent. */
  sourceIcon?: string;
}) {
  const c = color ?? colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.fsChip,
        active
          ? { borderColor: c, backgroundColor: c + '18' }
          : { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      {sourceIcon ? (
        <View style={[styles.fsChipIcon, { backgroundColor: c + '22' }]}>
          <Ionicons name={sourceIcon as any} size={12} color={c} />
        </View>
      ) : null}
      <Text style={[styles.fsChipText, active && { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Single row in the Transaksi SectionList. Itemized expense transactions are
 *  rendered as an accordion: tap the parent row to expand into per-item rows
 *  styled like single-tx rows. When a category filter is active, the parent
 *  total reflects only items in that category. */
function TxRow({
  tx,
  money,
  hasItemFilter,
  rowAmount,
  matchingItems,
  displayType,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  tx: DisplayTx;
  money: (n: number) => string;
  hasItemFilter: boolean;
  rowAmount: (t: DisplayTx) => number;
  matchingItems: (t: DisplayTx) => DisplayItem[];
  displayType: 'expense' | 'income';
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (tx: DisplayTx) => void;
  onDelete: (tx: DisplayTx) => void;
}) {
  const person = whoOf(tx.who);
  const src = sourceOf(tx.source);
  const income = displayType === 'income';
  const isItemized = !!(tx.items && tx.items.length);
  const shown = rowAmount(tx);
  const filteredItems = matchingItems(tx);
  const itemsList = filteredItems.length ? filteredItems : tx.items ?? [];

  // Synthetic Diskon / Biaya / Pajak Transaksi row derived from parent - items.
  // Suppressed for synthesized rows (transfer / daily group) where the fee /
  // discount is already an explicit item, and when an item-level filter is
  // active (filtered subset no longer sums to the parent amount).
  const itemsSum = (tx.items ?? []).reduce((s, it) => s + it.amount, 0);
  const remainder = tx.amount - itemsSum;
  const showRemainderRow =
    !hasItemFilter &&
    isItemized &&
    !tx.suppressRemainder &&
    Math.abs(remainder) >= 1;
  const remainderCat = remainder > 0 ? categoryOf('biaya_pajak') : categoryOf('diskon');
  const remainderLabel = remainder > 0 ? 'Biaya / Pajak Transaksi' : 'Diskon';

  // For synthesized daily groups the amount to display is a SIGNED net
  // stashed on `note` as "__net__:<n>"; falls back to `shown` otherwise.
  const groupNet = tx.note?.startsWith('__net__:')
    ? Number(tx.note.slice('__net__:'.length))
    : null;

  return (
    <View style={styles.row}>
      {/* Tap the body to edit (single OR itemized). Long-press deletes. */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onEdit(tx)}
        onLongPress={() => onDelete(tx)}
        style={styles.rowTouch}
      >
        {/* Itemized parents: the +/− toggle occupies the icon slot on the
         *  left. Sits where the category icon would, so the merchant + meta
         *  columns stay aligned with single-tx rows next to them.
         *  Single-tx rows still show the category icon. */}
        {isItemized ? (
          <TouchableOpacity
            onPress={onToggleExpand}
            hitSlop={12}
            style={styles.toggleCircle}
            activeOpacity={0.7}
          >
            <Ionicons
              name={expanded ? 'remove' : 'add'}
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        ) : (
          (() => {
            const vis = txVisual(tx);
            return <IconCircle icon={vis.icon} iconSet={vis.iconSet} color={vis.color} />;
          })()
        )}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={styles.rowTopRow}>
            <Text style={styles.merchant} numberOfLines={1}>
              {tx.merchant}
            </Text>
            {/* Amount rendering:
             *   - Transfer aggregate in Semua mode → BLACK, no sign. It's
             *     the "money moved" amount; neither income nor expense.
             *   - Daily group (Penyesuaian) in Semua mode → signed net for
             *     the whole day, green+/red-.
             *   - Any row with displayType=income (real income, filter
             *     narrowed to income items) → green +.
             *   - Any row with displayType=expense → RED with a leading −.
             */}
            {(() => {
              const isTransferShell = !!tx.transferSummary && !hasItemFilter;
              const useNet = groupNet != null && !hasItemFilter && !isTransferShell;
              if (isTransferShell) {
                return (
                  <Text style={styles.amount}>{money(shown)}</Text>
                );
              }
              if (useNet) {
                return (
                  <Text
                    style={[
                      styles.amount,
                      { color: groupNet! >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    {groupNet! >= 0 ? '+' : '−'}
                    {money(Math.abs(groupNet!))}
                  </Text>
                );
              }
              return (
                <Text
                  style={[
                    styles.amount,
                    income ? { color: colors.success } : { color: colors.danger },
                  ]}
                >
                  {income ? '+' : '−'}
                  {money(shown)}
                </Text>
              );
            })()}
          </View>
          <View style={styles.rowBottom}>
            {/* Shell "Untuk Siapa":
             *   - Transfer aggregation: a two-tone [from → to] chip so the
             *     user sees the direction at a glance.
             *   - Single-tx row: standard person chip.
             *   - Regular multi-item / daily-group shell: no chip (items carry
             *     their own or account labels). */}
            {tx.transferSummary ? (
              <View style={styles.transferPair}>
                <View style={[styles.whoTag, { backgroundColor: tx.transferSummary.fromColor + '22' }]}>
                  <Text style={[styles.whoTagText, { color: tx.transferSummary.fromColor }]}>{tx.transferSummary.fromLabel}</Text>
                </View>
                <Ionicons name="arrow-forward" size={12} color={colors.textMuted} />
                <View style={[styles.whoTag, { backgroundColor: tx.transferSummary.toColor + '22' }]}>
                  <Text style={[styles.whoTagText, { color: tx.transferSummary.toColor }]}>{tx.transferSummary.toLabel}</Text>
                </View>
              </View>
            ) : !isItemized ? (
              <View style={[styles.whoTag, { backgroundColor: person.color + '22' }]}>
                <Text style={[styles.whoTagText, { color: person.color }]}>{person.label}</Text>
              </View>
            ) : null}
            {/* Sumber Dana is meaningless on a transfer aggregate (each leg
             *  has its own) and on a daily group (each item shows its
             *  account), so hide it there. */}
            {!tx.transferSummary && !tx.componentIds ? (
              <Text style={styles.meta}>
                {!isItemized ? '· ' : ''}
                {src.label}
              </Text>
            ) : null}
            {tx.creditCard ? (
              <View style={styles.ccBadge}>
                <Ionicons name="card" size={10} color={colors.primary} />
                <Text style={styles.ccBadgeText}>KK</Text>
              </View>
            ) : null}
            {tx.reimbursable ? (
              <View style={[styles.ccBadge, tx.reimbursed && { backgroundColor: colors.success + '22' }]}>
                <Ionicons name="repeat" size={10} color={tx.reimbursed ? colors.success : colors.accent} />
                <Text style={[styles.ccBadgeText, { color: tx.reimbursed ? colors.success : colors.accent }]}>
                  {tx.reimbursed ? 'Diganti' : 'Reimburse'}
                </Text>
              </View>
            ) : null}
            {/* "· N item" on the shell reads as noise on aggregated rows
             *  (transfer / daily group), where the accordion contents are
             *  a fixed shape rather than an arbitrary basket. Hide it there;
             *  regular multi-item baskets still get the hint. When a
             *  filter is narrowing the accordion, show the filtered count. */}
            {isItemized && !tx.componentIds ? (
              <Text style={styles.meta}>
                · {(hasItemFilter && matchingItems(tx).length) || tx.items!.length} item
              </Text>
            ) : null}
            {tx.scanned ? <Ionicons name="scan" size={12} color={colors.primary} /> : null}
            {tx.image ? <Ionicons name="image" size={12} color={colors.textMuted} /> : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded item list — only for itemized parents. Items render in the
       *  same visual style as a single-tx row, minus Sumber Dana (the parent
       *  carries it). The synthetic Diskon / Biaya row is appended last. */}
      {isItemized && expanded ? (
        <View style={styles.itemListWrap}>
          {itemsList.map((it, i) => {
            const cat = categoryOf(it.category);
            const w = whoOf(it.who ?? tx.who);
            const chipLabel = it.chipLabel ?? w.label;
            const chipColor = it.chipColor ?? w.color;
            // Auto / synthesized biaya-diskon leg = no chipLabel on an
            // aggregated row. Renders as "otomatis" plain text (no chip).
            const isAutoItem = !!tx.componentIds && !it.chipLabel;
            // metaText:
            //   - explicit null → hide the trailing "· ..." entirely
            //   - explicit string → use it verbatim after the chip
            //   - undefined → fall back to the category label (default)
            const metaText =
              it.metaText === null ? null : it.metaText ?? cat.label;
            const itemIsIncome = it.itemType === 'income';
            return (
              <View key={i} style={styles.itemRowSingle}>
                {it.iconOverride ? (
                  // Custom icon (transfer legs use arrow-up/down circles that
                  // match the Keluar/Masuk tab icons).
                  <View style={[styles.itemIconOverride, { backgroundColor: it.iconOverride.color + '22' }]}>
                    <Ionicons name={it.iconOverride.name as any} size={20} color={it.iconOverride.color} />
                  </View>
                ) : (
                  <IconCircle icon={cat.icon} iconSet={cat.iconSet} color={cat.color} />
                )}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.rowTopRow}>
                    <Text style={styles.merchant} numberOfLines={1}>
                      {it.description}
                    </Text>
                    <Text
                      style={[
                        styles.amount,
                        itemIsIncome ? { color: colors.success } : { color: colors.danger },
                      ]}
                    >
                      {itemIsIncome ? '+' : '−'}
                      {money(it.amount)}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    {isAutoItem ? (
                      <Text style={styles.meta}>otomatis</Text>
                    ) : (
                      <>
                        <View style={[styles.whoTag, { backgroundColor: chipColor + '22' }]}>
                          <Text style={[styles.whoTagText, { color: chipColor }]}>{chipLabel}</Text>
                        </View>
                        {metaText ? <Text style={styles.meta}>· {metaText}</Text> : null}
                      </>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
          {showRemainderRow ? (
            <View style={styles.itemRowSingle}>
              <IconCircle
                icon={remainderCat.icon}
                iconSet={remainderCat.iconSet}
                color={remainderCat.color}
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.rowTopRow}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {remainderLabel}
                  </Text>
                  <Text
                    style={[
                      styles.amount,
                      remainder < 0 ? { color: colors.success } : { color: colors.danger },
                    ]}
                  >
                    {remainder < 0 ? '+' : '−'}
                    {money(Math.abs(remainder))}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.meta}>otomatis</Text>
                </View>
              </View>
            </View>
          ) : null}
          {hasItemFilter && filteredItems.length ? (
            <Text style={styles.itemListTotal}>
              dari total {money(tx.amount)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  count: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: colors.card },
  toggleText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: colors.primary },
  filterRow: { height: 52, marginTop: spacing.sm },
  filterContent: { alignItems: 'center', paddingHorizontal: spacing.lg },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  // Filter sheet
  fsWrap: { flex: 1, justifyContent: 'flex-end' },
  fsBackdrop: { ...fill, backgroundColor: 'rgba(0,0,0,0.4)' },
  fsSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    // Cap at ~85% of the viewport so the keyboard has room to push everything
    // up without clipping the input. The inner ScrollView handles overflow.
    maxHeight: '85%',
  },
  fsTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  // Matches add-transaction form's label style so the two look consistent.
  fsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  fsInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  fsSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  fsSuggestChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  fsSuggestText: { fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
  fsChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    // Symmetric padding so chips without an icon (like "Semua") stay centered.
    // The icon-circle style pulls itself in visually via its own width.
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  fsChipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudge the icon slightly leftward so the chip visually looks balanced
    // when both icon and text are present.
    marginLeft: -4,
  },
  fsChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  fsButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  fsClearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  fsClearText: { fontSize: 15, fontWeight: '700', color: colors.text },
  fsApplyBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  fsApplyText: { fontSize: 15, fontWeight: '800', color: colors.white },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionDate: { fontSize: 14, fontWeight: '700', color: colors.text },
  sectionSubtotal: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rowTouch: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  // 40pt to match IconCircle's default so multi-item and single-tx rows share
  // the same left column width and their merchant text lines up.
  toggleCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '18',
  },
  rowTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemListWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Each expanded item renders like a single-tx row (40pt icon, name + amount
  // on top, whoTag + category meta below). The only difference vs the parent
  // row is no Sumber Dana (the parent carries it).
  itemRowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  itemListTotal: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'right',
  },
  merchant: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, marginRight: 8 },
  amount: { fontSize: 15, fontWeight: '800', color: colors.text },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  whoTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  transferPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemIconOverride: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoTagText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  ccBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  ccBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  itemLines: { marginTop: 4, marginBottom: 2, gap: 1 },
  itemLine: { flexDirection: 'row', justifyContent: 'space-between' },
  itemLineDesc: { flex: 1, fontSize: 12, color: colors.textMuted, marginRight: 8 },
  itemLineAmt: { fontSize: 12, color: colors.text, fontWeight: '600' },
  itemLineTotal: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 1 },
});
