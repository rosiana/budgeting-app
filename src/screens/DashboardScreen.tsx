import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BalanceLineChart, CategoryDonut, MonthPoint } from '../components/charts';
import { BottomActions, CatIcon, Card, GridBg, PrivacyEye, ProgressBar, SectionTitle } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import {
  creditCardStatus,
  monthlyBalances,
  sourceBalances,
  spendByCategory,
  spendByWho,
  totalBalance,
  totalIncome,
  totalSpent,
  txForMonth,
} from '../store/selectors';
import {
  ANGGARAN_CATEGORIES,
  budgetStatusColor,
  categoryOf,
  colors,
  DEVICE_PERSON,
  radius,
  spacing,
  whoOf,
} from '../theme';
import {
  currentMonthKey,
  formatCurrency,
  formatDateShort,
  formatMonth,
  maybeMask,
} from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { transactions, budgets, disabledBudgets, creditCard, openingBalances, privacyMode, setPrivacyMode } = useBudget();
  const money = (n: number) => maybeMask(formatCurrency(n), privacyMode);

  const totalSaldo = useMemo(
    () => totalBalance(sourceBalances(transactions, openingBalances, creditCard)),
    [transactions, openingBalances, creditCard]
  );
  const userName = whoOf(DEVICE_PERSON).label;

  const mKey = currentMonthKey();
  const monthTx = useMemo(() => txForMonth(transactions, mKey), [transactions, mKey]);
  const byCatAll = useMemo(() => spendByCategory(monthTx, budgets, creditCard), [monthTx, budgets]);
  // Anggaran totals/warnings only count pickable categories the user hasn't
  // switched off — system-internal categories and disabled ones are excluded.
  const byCat = useMemo(
    () =>
      byCatAll.filter(
        (c) => ANGGARAN_CATEGORIES.includes(c.category) && !disabledBudgets.includes(c.category)
      ),
    [byCatAll, disabledBudgets]
  );
  const spent = byCat.reduce((s, c) => s + c.spent, 0);
  const totalBudget = byCat.reduce((s, c) => s + c.budget, 0);
  const byWho = useMemo(() => spendByWho(monthTx, creditCard), [monthTx, creditCard]);
  const income = useMemo(() => totalIncome(monthTx), [monthTx]);
  const cc = useMemo(() => creditCardStatus(transactions, creditCard), [transactions, creditCard]);
  const remaining = totalBudget - spent;
  // Donut breakdown uses ALL real spending (every spent category, not just
  // budgeted ones) so the % math is meaningful.
  const topCats = byCatAll.filter((c) => c.spent > 0).slice(0, 5);
  // Anggaran preview: top 5 categories by how full the budget is.
  const budgetList = useMemo(
    () => [...byCat].sort((a, b) => b.pct - a.pct).slice(0, 5),
    [byCat]
  );
  const budgetPct = totalBudget > 0 ? spent / totalBudget : 0;
  const filledCats = byCat.filter((c) => c.budget > 0 && c.spent > c.budget);

  // Grafik Saldo: real 12-month total-balance series computed from transactions.
  const balanceSeries = useMemo<MonthPoint[]>(() => {
    const short = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return monthlyBalances(transactions, openingBalances, creditCard, 12).map((m) => {
      const [, mm] = m.key.split('-').map(Number);
      return { key: m.key, label: short[mm - 1], value: m.total };
    });
  }, [transactions, openingBalances, creditCard]);
  const [selMonth, setSelMonth] = useState<string | null>(null);
  const activeKey = selMonth ?? mKey;
  const activePoint =
    balanceSeries.find((p) => p.key === activeKey) ?? balanceSeries[balanceSeries.length - 1];

  return (
    <View style={styles.root}>
      <GridBg />
      <PrivacyEye topOffset={insets.top} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: 110,
          paddingHorizontal: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>🐒 MoMoney · {formatMonth(mKey)}</Text>
            <Text style={styles.hero}>Halo, {userName} 👋</Text>
          </View>
        </View>

        {/* Balance summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Pengeluaran bulan ini</Text>
              <Text style={styles.summaryValue}>{money(spent)}</Text>
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
                {money(Math.abs(remaining))}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar
              pct={budgetPct}
              color={budgetStatusColor(budgetPct)}
              track={colors.primaryDark}
              height={10}
            />
            <Text style={styles.budgetCaption}>
              {Math.round(budgetPct * 100)}% dari anggaran {money(totalBudget)}
            </Text>
            {filledCats.length > 0 ? (
              <View style={styles.budgetWarn}>
                <Ionicons name="alert-circle" size={14} color={colors.warning} />
                <Text style={styles.budgetWarnText}>
                  {filledCats.length} kategori melebihi anggaran
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* Cashflow: income + total balance */}
        <View style={styles.cashflowRow}>
          <Card style={styles.cashflowCard}>
            <View style={styles.cashflowTop}>
              <Ionicons name="arrow-down-circle" size={16} color={colors.success} />
              <Text style={styles.cashflowLabel}>Pemasukan</Text>
            </View>
            <Text style={[styles.cashflowValue, { color: colors.success }]}>{money(income)}</Text>
          </Card>
          <Card style={styles.cashflowCard}>
            <View style={styles.cashflowTop}>
              <Ionicons name="wallet" size={16} color={colors.primary} />
              <Text style={styles.cashflowLabel}>Total Saldo</Text>
            </View>
            <Text style={[styles.cashflowValue, { color: colors.primary }]}>
              {money(totalSaldo)}
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
                Jatuh tempo {formatDateShort(cc.nextDue)}
              </Text>
            </View>
            <Text style={styles.ccAmount}>{money(cc.outstanding)}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Balance trend over the year */}
        <SectionTitle>Grafik Saldo</SectionTitle>
        <Card>
          <Text style={styles.weekTotal}>{money(activePoint.value)}</Text>
          <Text style={styles.weekCaption}>
            total saldo {formatMonth(activeKey)} · ketuk titik bulan
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <BalanceLineChart
              data={balanceSeries}
              selectedKey={activeKey}
              onSelect={(k) => setSelMonth(k)}
            />
          </View>
        </Card>

        {/* Category breakdown */}
        <SectionTitle>Per Kategori</SectionTitle>
        <Card>
          {spent > 0 ? (
            <View style={styles.breakdown}>
              <CategoryDonut data={byCat} total={spent} centerLabel="Total" centerText={money(spent)} />
              <View style={styles.legend}>
                {topCats.map((c) => {
                  const cat = categoryOf(c.category);
                  return (
                    <View key={c.category} style={styles.legendRow}>
                      <View style={[styles.dot, { backgroundColor: cat.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legendLabel} numberOfLines={1}>{cat.label}</Text>
                        <Text style={styles.legendValue}>{money(c.spent)}</Text>
                      </View>
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
            <View style={styles.whoGrid}>
              {byWho.map((w) => {
                const person = whoOf(w.who);
                return (
                  <View key={w.who} style={styles.whoCard}>
                    {person.avatar ? (
                      <View style={[styles.whoAvatar, { backgroundColor: person.avatarBg ?? person.color + '22' }]}>
                        <Image source={person.avatar} style={styles.whoAvatarImg} />
                      </View>
                    ) : (
                      <View style={[styles.whoAvatar, { backgroundColor: person.color + '22' }]}>
                        <Text style={styles.whoEmoji}>{person.emoji}</Text>
                      </View>
                    )}
                    <Text style={styles.whoName} numberOfLines={1}>{person.label}</Text>
                    <Text style={styles.whoSpent} numberOfLines={1}>{money(w.spent)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Budgets at a glance */}
        <SectionTitle>Anggaran</SectionTitle>
        <Card>
          {budgetList.map((c, i) => {
            const cat = categoryOf(c.category);
            return (
              <View
                key={c.category}
                style={[styles.budgetRow, i === 0 && { marginTop: 0 }]}
              >
                <View style={styles.budgetHead}>
                  <View style={styles.budgetName}>
                    <CatIcon name={cat.icon} set={cat.iconSet} size={16} color={cat.color} />
                    <Text style={styles.budgetLabel}>{cat.label}</Text>
                  </View>
                  <Text style={styles.budgetAmt}>
                    {money(c.spent)}{' '}
                    <Text style={styles.budgetMuted}>/ {money(c.budget)}</Text>
                  </Text>
                </View>
                <ProgressBar pct={c.pct} color={budgetStatusColor(c.pct)} />
              </View>
            );
          })}
        </Card>
      </ScrollView>

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
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  hero: { fontSize: 28, fontWeight: '800', color: colors.text },
  eyeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
  summaryValue: { color: colors.white, fontSize: 30, fontWeight: '800', marginTop: 2 },
  summaryValueSm: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  budgetCaption: { color: colors.onPrimary, fontSize: 12, marginTop: 6 },
  budgetWarn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  budgetWarnText: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  cashflowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  whoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  whoCard: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  whoAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  whoAvatarImg: { width: 50, height: 50, resizeMode: 'contain' },
  whoEmoji: { fontSize: 26 },
  whoName: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  whoSpent: { fontSize: 15, color: colors.text, fontWeight: '800' },
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
  weekTotal: { fontSize: 24, fontWeight: '800', color: colors.text },
  weekCaption: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  legend: { flex: 1, gap: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8, marginTop: 4 },
  legendLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  legendValue: { fontSize: 15, color: colors.text, fontWeight: '800', marginTop: 1 },
  emptyText: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  budgetRow: { marginTop: spacing.lg },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  budgetLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  budgetAmt: { fontSize: 13, fontWeight: '700', color: colors.text },
  budgetMuted: { color: colors.textMuted, fontWeight: '500' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
