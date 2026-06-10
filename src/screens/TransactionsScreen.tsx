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
import { Empty, IconCircle, Pill } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import { groupByDate } from '../store/selectors';
import {
  CATEGORIES,
  colors,
  radius,
  sourceOf,
  spacing,
  txVisual,
  WHO,
  whoOf,
} from '../theme';
import { CategoryId, Transaction, WhoId } from '../types';
import { formatCurrency, formatDateFriendly } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'kategori' | 'orang';

export default function TransactionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, deleteTransaction } = useBudget();
  const [mode, setMode] = useState<Mode>('kategori');
  const [catFilter, setCatFilter] = useState<CategoryId | 'all'>('all');
  const [whoFilter, setWhoFilter] = useState<WhoId | 'all'>('all');

  const filtered = useMemo(() => {
    if (mode === 'kategori') {
      return catFilter === 'all'
        ? transactions
        : transactions.filter((t) => t.category === catFilter);
    }
    return whoFilter === 'all'
      ? transactions
      : transactions.filter((t) => t.who === whoFilter);
  }, [transactions, mode, catFilter, whoFilter]);

  const sections = useMemo(
    () =>
      groupByDate(filtered).map((g) => ({
        title: formatDateFriendly(g.date),
        // Net for the day: income adds, expense subtracts.
        subtotal: g.items.reduce(
          (s, t) => s + (t.type === 'income' ? t.amount : -t.amount),
          0
        ),
        data: g.items,
      })),
    [filtered]
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
        note: tx.note,
        items: tx.items,
        scanned: tx.scanned,
      },
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Transaksi</Text>
        <Text style={styles.count}>{transactions.length} catatan</Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.toggle}>
        {(['kategori', 'orang'] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={[styles.toggleBtn, mode === m && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
              {m === 'kategori' ? 'Kategori' : 'Orang'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {mode === 'kategori' ? (
          <>
            <Pill label="Semua" active={catFilter === 'all'} onPress={() => setCatFilter('all')} />
            {CATEGORIES.map((c) => (
              <Pill
                key={c.id}
                label={c.label}
                icon={c.icon as any}
                color={c.color}
                active={catFilter === c.id}
                onPress={() => setCatFilter(c.id)}
              />
            ))}
          </>
        ) : (
          <>
            <Pill label="Semua" active={whoFilter === 'all'} onPress={() => setWhoFilter('all')} />
            {WHO.map((w) => (
              <Pill
                key={w.id}
                label={w.label}
                color={w.color}
                active={whoFilter === w.id}
                onPress={() => setWhoFilter(w.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

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
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              style={styles.row}
            >
              <IconCircle icon={vis.icon as any} color={vis.color} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.rowTop}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.merchant}
                  </Text>
                  <Text style={[styles.amount, income && { color: colors.success }]}>
                    {income ? '+' : ''}
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
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
                  {item.items && item.items.length ? (
                    <Text style={styles.meta}>· {item.items.length} item</Text>
                  ) : null}
                  {item.scanned ? (
                    <Ionicons name="scan" size={12} color={colors.primary} />
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ScanReceipt')}
      >
        <Ionicons name="scan" size={26} color={colors.white} />
      </TouchableOpacity>
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
  filterRow: { flexGrow: 0, paddingVertical: spacing.sm },
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
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
