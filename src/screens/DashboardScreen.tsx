import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryDonut, WeeklyBars } from '../components/charts';
import { Card, ProgressBar, SectionTitle } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import {
  creditCardStatus,
  dailySpend,
  spendByCategory,
  spendByWho,
  totalIncome,
  totalSpent,
  txForMonth,
} from '../store/selectors';
import { categoryOf, colors, radius, spacing, whoOf } from '../theme';
import {
  currentMonthKey,
  formatCurrency,
  formatDateShort,
  formatMonth,
} from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, budgets, creditCard } = useBudget();

  const mKey = currentMonthKey();
  const monthTx = useMemo(() => txForMonth(transactions, mKey), [transactions, mKey]);
  const spent = useMemo(() => totalSpent(monthTx), [monthTx]);
  const totalBudget = useMemo(
    () => Object.values(budgets).reduce((s, b) => s + b, 0),
    [budgets]
  );
  const byCat = useMemo(() => spendByCategory(monthTx, budgets), [monthTx, budgets]);
  const byWho = useMemo(() => spendByWho(monthTx), [monthTx]);
  const income = useMemo(() => totalIncome(monthTx), [monthTx]);
  const cc = useMemo(() => creditCardStatus(transactions, creditCard), [transactions, creditCard]);
  const net = income - spent;
  const week = useMemo(() => dailySpend(transactions, 7), [transactions]);
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const remaining = totalBudget - spent;
  const topCats = byCat.filter((c) => c.spent > 0).slice(0, 4);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.xxl * 2,
          paddingHorizontal: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>{formatMonth(mKey)}</Text>
        <Text style={styles.hero}>Ringkasan Bulan Ini</Text>

        {/* Balance summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Pengeluaran bulan ini</Text>
              <Text style={styles.summaryValue}>{formatCurrency(spent)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryLabel}>
                {remaining >= 0 ? 'Sisa' : 'Lebih'}
              </Text>
              <Text
                style={[
                  styles.summaryValueSm,
                  { color: remaining >= 0 ? colors.success : colors.danger },
                ]}
              >
                {formatCurrency(Math.abs(remaining))}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar
              pct={totalBudget > 0 ? spent / totalBudget : 0}
              color={colors.primary}
              height={10}
            />
            <Text style={styles.budgetCaption}>
              dari anggaran {formatCurrency(totalBudget)}
            </Text>
          </View>
        </Card>

        {/* Cashflow: income vs expense vs net */}
        <View style={styles.cashflowRow}>
          <Card style={styles.cashflowCard}>
            <View style={styles.cashflowTop}>
              <Ionicons name="arrow-down-circle" size={16} color={colors.success} />
              <Text style={styles.cashflowLabel}>Pemasukan</Text>
            </View>
            <Text style={[styles.cashflowValue, { color: colors.success }]}>{formatCurrency(income)}</Text>
          </Card>
          <Card style={styles.cashflowCard}>
            <View style={styles.cashflowTop}>
              <Ionicons name="swap-vertical" size={16} color={net >= 0 ? colors.primary : colors.danger} />
              <Text style={styles.cashflowLabel}>Selisih</Text>
            </View>
            <Text style={[styles.cashflowValue, { color: net >= 0 ? colors.primary : colors.danger }]}>
              {net >= 0 ? '' : '-'}{formatCurrency(Math.abs(net))}
            </Text>
          </Card>
        </View>

        {/* Credit card bill */}
        {cc.outstanding > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Tabs', { screen: 'Saldo' } as any)}
            style={styles.ccCard}
          >
            <View style={styles.ccIcon}>
              <Ionicons name="card" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ccLabel}>Tagihan Kartu Kredit</Text>
              <Text style={styles.ccDue}>
                {formatCurrency(cc.dueNext)} jatuh tempo {formatDateShort(cc.nextDue)}
              </Text>
            </View>
            <Text style={styles.ccAmount}>{formatCurrency(cc.outstanding)}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Quick actions */}
        <View style={styles.actions}>
          <ActionButton
            icon="scan"
            label="Scan struk"
            primary
            onPress={() => navigation.navigate('ScanReceipt')}
          />
          <ActionButton
            icon="add"
            label="Tambah"
            onPress={() => navigation.navigate('AddTransaction')}
          />
        </View>

        {/* Weekly trend */}
        <SectionTitle>7 Hari Terakhir</SectionTitle>
        <Card style={{ marginBottom: spacing.xl }}>
          <Text style={styles.weekTotal}>{formatCurrency(weekTotal)}</Text>
          <Text style={styles.weekCaption}>pengeluaran minggu ini</Text>
          <View style={{ marginTop: spacing.md }}>
            <WeeklyBars data={week} />
          </View>
        </Card>

        {/* Category breakdown */}
        <SectionTitle>Per Kategori</SectionTitle>
        <Card style={{ marginBottom: spacing.xl }}>
          {spent > 0 ? (
            <View style={styles.breakdown}>
              <CategoryDonut data={byCat} total={spent} />
              <View style={styles.legend}>
                {topCats.map((c) => {
                  const cat = categoryOf(c.category);
                  return (
                    <View key={c.category} style={styles.legendRow}>
                      <View style={[styles.dot, { backgroundColor: cat.color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>{cat.label}</Text>
                      <Text style={styles.legendValue}>{formatCurrency(c.spent)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Belum ada pengeluaran bulan ini.</Text>
          )}
        </Card>

        {/* Spending by person */}
        {byWho.length > 0 ? (
          <>
            <SectionTitle>Per Orang</SectionTitle>
            <Card style={{ marginBottom: spacing.xl }}>
              {byWho.map((w, i) => {
                const person = whoOf(w.who);
                const frac = spent > 0 ? w.spent / spent : 0;
                return (
                  <View key={w.who} style={[styles.whoRow, i === 0 && { marginTop: 0 }]}>
                    <View style={[styles.whoDot, { backgroundColor: person.color }]}>
                      <Text style={styles.whoInitial}>{person.label.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.whoHead}>
                        <Text style={styles.whoLabel}>{person.label}</Text>
                        <Text style={styles.whoValue}>{formatCurrency(w.spent)}</Text>
                      </View>
                      <ProgressBar pct={frac} color={person.color} height={6} />
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}

        {/* Budgets at a glance */}
        <SectionTitle>Anggaran</SectionTitle>
        <Card>
          {byCat.slice(0, 5).map((c, i) => {
            const cat = categoryOf(c.category);
            return (
              <View
                key={c.category}
                style={[styles.budgetRow, i === 0 && { marginTop: 0 }]}
              >
                <View style={styles.budgetHead}>
                  <View style={styles.budgetName}>
                    <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                    <Text style={styles.budgetLabel}>{cat.label}</Text>
                  </View>
                  <Text style={styles.budgetAmt}>
                    {formatCurrency(c.spent)}{' '}
                    <Text style={styles.budgetMuted}>/ {formatCurrency(c.budget)}</Text>
                  </Text>
                </View>
                <ProgressBar pct={c.pct} color={cat.color} />
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.action, primary ? styles.actionPrimary : styles.actionGhost]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={primary ? colors.white : colors.primary}
      />
      <Text style={[styles.actionLabel, { color: primary ? colors.white : colors.primary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  greeting: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  hero: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  summaryCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { color: '#D9EEE8', fontSize: 13, fontWeight: '600' },
  summaryValue: { color: colors.white, fontSize: 30, fontWeight: '800', marginTop: 2 },
  summaryValueSm: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  budgetCaption: { color: '#D9EEE8', fontSize: 12, marginTop: 6 },
  cashflowRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cashflowCard: { flex: 1, padding: spacing.md },
  cashflowTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cashflowLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  cashflowValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  ccCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  ccIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ccLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  ccDue: { fontSize: 12, color: colors.textMuted, marginTop: 1, fontWeight: '600' },
  ccAmount: { fontSize: 16, fontWeight: '800', color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.xl },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.md,
    gap: 8,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  actionLabel: { fontSize: 15, fontWeight: '700' },
  weekTotal: { fontSize: 24, fontWeight: '800', color: colors.text },
  weekCaption: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  whoDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  whoInitial: { color: colors.white, fontWeight: '800', fontSize: 15 },
  whoHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  whoLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  whoValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  legend: { flex: 1, gap: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  legendValue: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  emptyText: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  budgetRow: { marginTop: spacing.lg },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  budgetLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  budgetAmt: { fontSize: 13, fontWeight: '700', color: colors.text },
  budgetMuted: { color: colors.textMuted, fontWeight: '500' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
