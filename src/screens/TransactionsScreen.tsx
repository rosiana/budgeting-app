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

  // The active expense category (for showing per-item portions), if any.
  const activeCat: CategoryId | null =
    mode !== 'pemasukan' && catFilter !== 'all' ? (catFilter as CategoryId) : null;

  const filtered = useMemo(() => {
    // 1) Mode + category/income tab filter (existing).
    let list: Transaction[];
    if (mode === 'pemasukan') {
      const inc = monthTx.filter((t) => t.type === 'income');
      list = incFilter === 'all' ? inc : inc.filter((t) => t.incomeCategory === incFilter);
    } else {
      const base = mode === 'pengeluaran' ? monthTx.filter((t) => t.type !== 'income') : monthTx;
      list = catFilter === 'all'
        ? base
        : base.filter(
            (t) =>
              t.type !== 'income' &&
              (t.category === catFilter || t.items?.some((it) => it.category === catFilter))
          );
    }
    // 2) Extra filters from the filter sheet.
    const q = nameQuery.trim().toLowerCase();
    if (q) list = list.filter((t) => (t.merchant || '').toLowerCase().includes(q));
    if (whoFilter !== 'all') list = list.filter((t) => t.who === whoFilter);
    if (sourceFilter !== 'all') list = list.filter((t) => t.source === sourceFilter);
    return list;
  }, [monthTx, mode, catFilter, incFilter, nameQuery, whoFilter, sourceFilter]);

  // Amount to show for a row — when filtered by a category, an itemized
  // transaction shows just that category's portion.
  const rowAmount = (t: Transaction): number => {
    if (activeCat && t.type !== 'income' && t.items && t.items.length) {
      const portion = t.items
        .filter((it) => it.category === activeCat)
        .reduce((s, it) => s + it.amount, 0);
      return portion || t.amount;
    }
    return t.amount;
  };
  const matchingItems = (t: Transaction): LineItem[] =>
    activeCat && t.items ? t.items.filter((it) => it.category === activeCat) : [];

  const sections = useMemo(
    () =>
      groupByDate(filtered).map((g) => ({
        title: formatDateFriendly(g.date),
        // Net for the day: income adds, expense subtracts (using shown amount).
        subtotal: g.items.reduce(
          (s, t) => s + (t.type === 'income' ? t.amount : -rowAmount(t)),
          0
        ),
        // Newest first within the day (by createdAt; updatedAt as tiebreaker).
        data: [...g.items].sort(
          (a, b) =>
            (b.createdAt ?? b.updatedAt ?? 0) - (a.createdAt ?? a.updatedAt ?? 0)
        ),
      })),
    [filtered, activeCat]
  );

  const confirmDelete = (tx: Transaction) => {
    Alert.alert('Hapus transaksi', `Hapus "${tx.merchant}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteTransaction(tx.id) },
    ]);
  };

  const openEdit = (tx: Transaction) => {
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
            activeCat={activeCat}
            rowAmount={rowAmount}
            matchingItems={matchingItems}
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
              {SOURCES.map((s) => (
                <FsChip
                  key={s.id}
                  label={`${whoOf(s.owner).emoji} ${s.label}`}
                  color={s.color}
                  sourceIcon={s.icon}
                  active={source === s.id}
                  onPress={() => setSource(s.id)}
                />
              ))}
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
  activeCat,
  rowAmount,
  matchingItems,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  money: (n: number) => string;
  activeCat: CategoryId | null;
  rowAmount: (t: Transaction) => number;
  matchingItems: (t: Transaction) => LineItem[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const vis = txVisual(tx);
  const person = whoOf(tx.who);
  const src = sourceOf(tx.source);
  const income = tx.type === 'income';
  const isItemized = !!(tx.items && tx.items.length);
  const shown = rowAmount(tx);
  const itemsForCat = matchingItems(tx);
  const itemsList = activeCat && itemsForCat.length ? itemsForCat : tx.items ?? [];

  // Synthetic Diskon / Biaya / Pajak Transaksi row derived from the parent's
  // total - itemsSum. Shown only in the unfiltered (no activeCat) expanded view
  // so the totals add up visually.
  const itemsSum = (tx.items ?? []).reduce((s, it) => s + it.amount, 0);
  const remainder = tx.amount - itemsSum;
  const showRemainderRow = !activeCat && isItemized && Math.abs(remainder) >= 1;
  const remainderCat = remainder > 0 ? categoryOf('biaya_pajak') : categoryOf('diskon');
  const remainderLabel = remainder > 0 ? 'Biaya / Pajak Transaksi' : 'Diskon';

  return (
    <View style={styles.row}>
      {/* Tap the body to edit (single OR itemized). Long-press deletes. The
       *  chevron pill on the right is the only thing that toggles expand, so
       *  the parent shell stays fully editable. */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onEdit(tx)}
        onLongPress={() => onDelete(tx)}
        style={styles.rowTouch}
      >
        {/* Itemized parents use a distinct "basket" icon to signal multi-item;
         *  single-tx rows use the category icon. */}
        {isItemized ? (
          <IconCircle icon="basket" iconSet="ion" color={vis.color} />
        ) : (
          <IconCircle icon={vis.icon} iconSet={vis.iconSet} color={vis.color} />
        )}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={styles.rowTopRow}>
            <Text style={styles.merchant} numberOfLines={1}>
              {tx.merchant}
            </Text>
            <Text style={[styles.amount, income && { color: colors.success }]}>
              {income ? '+' : ''}
              {money(shown)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            {/* Shell of a multi-item tx has no "Untuk Siapa" — each item
             *  carries its own. Single tx still shows the parent's who. */}
            {!isItemized ? (
              <View style={[styles.whoTag, { backgroundColor: person.color + '22' }]}>
                <Text style={[styles.whoTagText, { color: person.color }]}>{person.label}</Text>
              </View>
            ) : null}
            <Text style={styles.meta}>
              {!isItemized ? '· ' : ''}
              {src.label}
            </Text>
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
            {isItemized ? (
              <Text style={styles.meta}>· {tx.items!.length} item</Text>
            ) : null}
            {tx.scanned ? <Ionicons name="scan" size={12} color={colors.primary} /> : null}
            {tx.image ? <Ionicons name="image" size={12} color={colors.textMuted} /> : null}
          </View>
        </View>
        {/* Dedicated chevron tap target — toggles expand without triggering
         *  edit. Sits at the right edge so it doesn't compete with the body. */}
        {isItemized ? (
          <TouchableOpacity
            onPress={onToggleExpand}
            hitSlop={12}
            style={styles.chevBtn}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* Expanded item list — only for itemized parents. Items render in the
       *  same visual style as a single-tx row, minus Sumber Dana (the parent
       *  carries it). The synthetic Diskon / Biaya row is appended last. */}
      {isItemized && expanded ? (
        <View style={styles.itemListWrap}>
          {itemsList.map((it, i) => {
            const cat = categoryOf(it.category);
            const w = whoOf(it.who ?? tx.who);
            return (
              <View key={i} style={styles.itemRowSingle}>
                <IconCircle icon={cat.icon} iconSet={cat.iconSet} color={cat.color} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.rowTopRow}>
                    <Text style={styles.merchant} numberOfLines={1}>
                      {it.description}
                    </Text>
                    <Text style={styles.amount}>{money(it.amount)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <View style={[styles.whoTag, { backgroundColor: w.color + '22' }]}>
                      <Text style={[styles.whoTagText, { color: w.color }]}>{w.label}</Text>
                    </View>
                    <Text style={styles.meta}>· {cat.label}</Text>
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
                  <Text style={[styles.amount, remainder < 0 && { color: colors.success }]}>
                    {remainder < 0 ? '−' : ''}{money(Math.abs(remainder))}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.meta}>otomatis</Text>
                </View>
              </View>
            </View>
          ) : null}
          {activeCat && itemsForCat.length ? (
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
  fsLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.md },
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
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  fsChipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
  chevBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
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
