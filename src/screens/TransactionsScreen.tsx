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
import { CATEGORIES, categoryOf, colors, radius, spacing } from '../theme';
import { CategoryId, Transaction } from '../types';
import { formatCurrency, formatDateFriendly } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TransactionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, deleteTransaction } = useBudget();
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? transactions : transactions.filter((t) => t.category === filter)),
    [transactions, filter]
  );

  const sections = useMemo(
    () =>
      groupByDate(filtered).map((g) => ({
        title: formatDateFriendly(g.date),
        subtotal: g.items.reduce((s, t) => s + t.amount, 0),
        data: g.items,
      })),
    [filtered]
  );

  const confirmDelete = (tx: Transaction) => {
    Alert.alert('Delete expense', `Remove "${tx.merchant}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(tx.id) },
    ]);
  };

  const openEdit = (tx: Transaction) => {
    navigation.navigate('AddTransaction', {
      draft: {
        id: tx.id,
        merchant: tx.merchant,
        amount: tx.amount,
        date: tx.date,
        category: tx.category,
        note: tx.note,
        items: tx.items,
        scanned: tx.scanned,
      },
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.count}>{transactions.length} total</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        <Pill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        {CATEGORIES.map((c) => (
          <Pill
            key={c.id}
            label={c.label}
            icon={c.icon as any}
            color={c.color}
            active={filter === c.id}
            onPress={() => setFilter(c.id)}
          />
        ))}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: spacing.lg }}
        ListEmptyComponent={
          <Empty
            icon="receipt-outline"
            title="No expenses yet"
            subtitle="Scan a receipt or add an expense to get started."
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{section.title}</Text>
            <Text style={styles.sectionSubtotal}>{formatCurrency(section.subtotal)}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const cat = categoryOf(item.category);
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              style={styles.row}
            >
              <IconCircle icon={cat.icon as any} color={cat.color} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.rowTop}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.merchant}
                  </Text>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.cat}>{cat.label}</Text>
                  {item.scanned ? (
                    <View style={styles.scanTag}>
                      <Ionicons name="scan" size={11} color={colors.primary} />
                      <Text style={styles.scanText}>Scanned</Text>
                    </View>
                  ) : null}
                  {item.items && item.items.length ? (
                    <Text style={styles.cat}>· {item.items.length} items</Text>
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
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  cat: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  scanTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  scanText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
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
