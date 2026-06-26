import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomActions, Empty, GridBg, IconCircle, MonthNav, Pill } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import { groupByDate } from '../store/selectors';
import {
  CATEGORIES,
  colors,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_MAP,
  radius,
  sourceOf,
  spacing,
  txVisual,
  WHO,
  whoOf,
} from '../theme';
import { CategoryId, LineItem, Transaction, WhoId } from '../types';
import {
  currentMonthKey,
  formatCurrency,
  formatDateFriendly,
  formatMonth,
  monthKey as monthKeyOf,
  shiftMonth,
} from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'pengeluaran' | 'pemasukan' | 'orang';

export default function TransactionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, deleteTransaction } = useBudget();
  const [month, setMonth] = useState(currentMonthKey());
  const [mode, setMode] = useState<Mode>('pengeluaran');
  const [catFilter, setCatFilter] = useState<string>('all'); // expense category id
  const [incFilter, setIncFilter] = useState<string>('all'); // income category id
  const [whoFilter, setWhoFilter] = useState<WhoId | 'all'>('all');

  const monthTx = useMemo(
    () => transactions.filter((t) => monthKeyOf(t.date) === month),
    [transactions, month]
  );

  // The active expense category (for showing per-item portions), if any.
  const activeCat: CategoryId | null =
    mode === 'pengeluaran' && catFilter !== 'all' ? (catFilter as CategoryId) : null;

  const filtered = useMemo(() => {
    if (mode === 'orang') {
      return whoFilter === 'all' ? monthTx : monthTx.filter((t) => t.who === whoFilter);
    }
    if (mode === 'pemasukan') {
      const inc = monthTx.filter((t) => t.type === 'income');
      return incFilter === 'all' ? inc : inc.filter((t) => t.incomeCategory === incFilter);
    }
    // Pengeluaran: expenses, optionally by category (matching item categories too).
    const exp = monthTx.filter((t) => t.type !== 'income');
    if (catFilter === 'all') return exp;
    return exp.filter(
      (t) => t.category === catFilter || t.items?.some((it) => it.category === catFilter)
    );
  }, [monthTx, mode, catFilter, incFilter, whoFilter]);

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
        data: g.items,
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

      {/* Mode toggle: spending / income / person */}
      <View style={styles.toggle}>
        {(['pengeluaran', 'pemasukan', 'orang'] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={[styles.toggleBtn, mode === m && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]} numberOfLines={1}>
              {m === 'pengeluaran' ? 'Keluar' : m === 'pemasukan' ? 'Masuk' : 'Orang'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {mode === 'pengeluaran' ? (
            <>
              <Pill label="Semua" active={catFilter === 'all'} onPress={() => setCatFilter('all')} />
              {CATEGORIES.map((c) => (
                <Pill
                  key={c.id}
                  label={c.label}
                  icon={c.iconSet ? undefined : (c.icon as any)}
                  color={c.color}
                  active={catFilter === c.id}
                  onPress={() => setCatFilter(c.id)}
                />
              ))}
            </>
          ) : mode === 'pemasukan' ? (
            <>
              <Pill label="Semua" active={incFilter === 'all'} onPress={() => setIncFilter('all')} />
              {INCOME_CATEGORIES.map((c) => (
                <Pill
                  key={c.id}
                  label={c.label}
                  icon={c.icon as any}
                  color={colors.success}
                  active={incFilter === c.id}
                  onPress={() => setIncFilter(c.id)}
                />
              ))}
            </>
          ) : (
            <>
              <Pill label="Semua" active={whoFilter === 'all'} onPress={() => setWhoFilter('all')} />
              {WHO.map((w) => (
                <Pill
                  key={w.id}
                  label={`${w.emoji} ${w.label}`}
                  color={w.color}
                  active={whoFilter === w.id}
                  onPress={() => setWhoFilter(w.id)}
                />
              ))}
            </>
          )}
        </ScrollView>
      </View>

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
              {formatCurrency(Math.abs(section.subtotal))}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const vis = txVisual(item);
          const person = whoOf(item.who);
          const src = sourceOf(item.source);
          const income = item.type === 'income';
          const shown = rowAmount(item);
          const partial = activeCat != null && shown !== item.amount;
          const itemsForCat = matchingItems(item);
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              style={styles.row}
            >
              <IconCircle icon={vis.icon} iconSet={vis.iconSet} color={vis.color} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.rowTop}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.merchant}
                  </Text>
                  <Text style={[styles.amount, income && { color: colors.success }]}>
                    {income ? '+' : ''}
                    {formatCurrency(shown)}
                  </Text>
                </View>
                {partial && itemsForCat.length ? (
                  <View style={styles.itemLines}>
                    {itemsForCat.map((it, i) => (
                      <View key={i} style={styles.itemLine}>
                        <Text style={styles.itemLineDesc} numberOfLines={1}>· {it.description}</Text>
                        <Text style={styles.itemLineAmt}>{formatCurrency(it.amount)}</Text>
                      </View>
                    ))}
                    <Text style={styles.itemLineTotal}>dari total {formatCurrency(item.amount)}</Text>
                  </View>
                ) : null}
                <View style={styles.rowBottom}>
                  <View style={[styles.whoTag, { backgroundColor: person.color + '22' }]}>
                    <Text style={[styles.whoTagText, { color: person.color }]}>{person.label}</Text>
                  </View>
                  <Text style={styles.meta}>· {src.label}</Text>
                  {item.creditCard ? (
                    <View style={styles.ccBadge}>
                      <Ionicons name="card" size={10} color={colors.primary} />
                      <Text style={styles.ccBadgeText}>KK</Text>
                    </View>
                  ) : null}
                  {item.reimbursable ? (
                    <View style={[styles.ccBadge, item.reimbursed && { backgroundColor: colors.success + '22' }]}>
                      <Ionicons name="repeat" size={10} color={item.reimbursed ? colors.success : colors.accent} />
                      <Text style={[styles.ccBadgeText, { color: item.reimbursed ? colors.success : colors.accent }]}>
                        {item.reimbursed ? 'Diganti' : 'Reimburse'}
                      </Text>
                    </View>
                  ) : null}
                  {item.items && item.items.length ? (
                    <Text style={styles.meta}>· {item.items.length} item</Text>
                  ) : null}
                  {item.scanned ? (
                    <Ionicons name="scan" size={12} color={colors.primary} />
                  ) : null}
                  {item.image ? (
                    <Ionicons name="image" size={12} color={colors.textMuted} />
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <BottomActions
        insetsBottom={insets.bottom}
        onScan={() => navigation.navigate('ScanReceipt')}
        onAdd={() => navigation.navigate('AddTransaction')}
      />
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
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.card },
  toggleText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: colors.primary },
  filterRow: { height: 52, marginTop: spacing.sm },
  filterContent: { alignItems: 'center', paddingHorizontal: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionDate: { fontSize: 14, fontWeight: '700', color: colors.text },
  sectionSubtotal: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
