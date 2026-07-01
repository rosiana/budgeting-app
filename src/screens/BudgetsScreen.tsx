import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatIcon, Card, GridBg, MonthNav, PrimaryButton, PrivacyEye, ProgressBar } from '../components/ui';
import { useBudget } from '../store/BudgetContext';
import { spendByCategory, totalSpent, txForMonth } from '../store/selectors';
import {
  ANGGARAN_CATEGORIES,
  budgetStatusColor,
  categoryOf,
  colors,
  fill,
  radius,
  spacing,
} from '../theme';
import { CategoryId } from '../types';
import { currentMonthKey, formatCompact, formatCurrency, formatMonth, shiftMonth } from '../utils/format';
import { useMoney } from '../utils/money';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, budgets, disabledBudgets, creditCard, setBudget, toggleBudget } = useBudget();
  const money = useMoney();
  const [editing, setEditing] = useState<CategoryId | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const [month, setMonth] = useState(currentMonthKey());
  const mKey = month;
  const monthTx = useMemo(() => txForMonth(transactions, mKey), [transactions, mKey]);
  const isDisabled = (c: CategoryId) => disabledBudgets.includes(c);

  // Every pickable category appears in the list (so the user can toggle each).
  // System-internal categories never appear here.
  const byCatAll = useMemo(
    () =>
      spendByCategory(monthTx, budgets, creditCard).filter((c) =>
        ANGGARAN_CATEGORIES.includes(c.category)
      ),
    [monthTx, budgets, creditCard]
  );
  // Totals/warnings only count enabled categories.
  const byCat = byCatAll.filter((c) => !isDisabled(c.category));
  const spent = byCat.reduce((s, c) => s + c.spent, 0);
  const totalBudget = byCat.reduce((s, c) => s + c.budget, 0);
  const overCount = byCat.filter((c) => c.budget > 0 && c.spent > c.budget).length;

  const openEditor = (cat: CategoryId) => {
    setEditing(cat);
    setDraftValue(String(budgets[cat] ?? 0));
  };

  const saveEditor = () => {
    if (editing) {
      const n = parseFloat(draftValue.replace(/[^0-9.]/g, ''));
      setBudget(editing, Number.isFinite(n) ? n : 0);
    }
    setEditing(null);
  };

  return (
    <View style={styles.root}>
      <GridBg />
      <PrivacyEye topOffset={insets.top} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Anggaran</Text>
        <View style={{ marginTop: spacing.md }}>
          <MonthNav
            label={formatMonth(mKey)}
            onPrev={() => setMonth((m) => shiftMonth(m, -1))}
            onNext={() => setMonth((m) => shiftMonth(m, 1))}
            canNext={mKey < currentMonthKey()}
          />
        </View>

        <Card style={styles.summary}>
          <View style={styles.summaryRow}>
            <SummaryStat label="Anggaran" value={money(totalBudget)} />
            <SummaryStat label="Terpakai" value={money(spent)} />
            <SummaryStat
              label="Sisa"
              value={money(Math.max(0, totalBudget - spent))}
              color={totalBudget - spent >= 0 ? colors.success : colors.danger}
            />
          </View>
          {overCount > 0 ? (
            <View style={styles.warn}>
              <Ionicons name="alert-circle" size={14} color={colors.warning} />
              <Text style={styles.warnText}>
                {overCount} kategori melebihi anggaran
              </Text>
            </View>
          ) : null}
        </Card>

        <Text style={styles.hint}>
          Ketuk kategori untuk mengubah batas bulanannya. Matikan kategori yang
          tidak ingin dianggarkan.
        </Text>

        {byCatAll.map((c) => {
          const cat = categoryOf(c.category);
          const disabled = isDisabled(c.category);
          const over = c.budget > 0 && c.spent > c.budget;
          return (
            <TouchableOpacity
              key={c.category}
              activeOpacity={disabled ? 1 : 0.7}
              onPress={() => !disabled && openEditor(c.category)}
              style={[styles.catCard, disabled && styles.catCardOff]}
            >
              <View style={styles.catHead}>
                <View style={styles.catName}>
                  <CatIcon name={cat.icon} set={cat.iconSet} size={18} color={cat.color} />
                  <Text style={styles.catLabel} numberOfLines={1}>{cat.label}</Text>
                </View>
                <View style={styles.catRight}>
                  {!disabled ? (
                    <Text style={styles.catAmt}>
                      {money(c.spent)}
                      <Text style={styles.catAmtMuted}> / {money(c.budget)}</Text>
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => toggleBudget(c.category)}
                    hitSlop={8}
                    style={[styles.toggleTrack, !disabled && styles.toggleTrackOn]}
                  >
                    <View style={[styles.toggleThumb, !disabled && styles.toggleThumbOn]} />
                  </TouchableOpacity>
                </View>
              </View>
              {!disabled ? (
                <>
                  <View style={{ marginVertical: 8 }}>
                    <ProgressBar pct={c.pct} color={budgetStatusColor(c.pct)} height={10} />
                  </View>
                  <Text
                    style={[
                      styles.catStatus,
                      { color: c.budget === 0 ? colors.textMuted : budgetStatusColor(c.pct) },
                    ]}
                  >
                    {c.budget === 0
                      ? 'Belum ada batas'
                      : over
                      ? `Lewat ${money(c.spent - c.budget)}`
                      : `Sisa ${money(c.budget - c.spent)}`}
                  </Text>
                </>
              ) : (
                <Text style={styles.catDisabledHint}>Dimatikan dari anggaran</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setEditing(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              Anggaran {editing ? categoryOf(editing).label : ''}
            </Text>
            <Text style={styles.sheetSub}>Atur batas pengeluaran bulanan untuk kategori ini.</Text>
            <View style={styles.inputRow}>
              <Text style={styles.currency}>Rp</Text>
              <TextInput
                value={draftValue}
                onChangeText={setDraftValue}
                keyboardType="number-pad"
                placeholder="0"
                autoFocus
                style={styles.input}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <PrimaryButton label="Simpan Batas" onPress={saveEditor} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SummaryStat({
  label,
  value,
  color = colors.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg },
  summary: { marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row' },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  warnText: { color: colors.warning, fontWeight: '700', fontSize: 12 },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  catCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  catCardOff: { opacity: 0.55 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  catName: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  catLabel: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catAmt: { fontSize: 14, fontWeight: '800', color: colors.text },
  catAmtMuted: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  catStatus: { fontSize: 13, fontWeight: '700' },
  catDisabledHint: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 4 },
  toggleTrack: {
    width: 36, height: 22, borderRadius: 11,
    backgroundColor: colors.border, padding: 2, justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: colors.primary },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.card },
  toggleThumbOn: { alignSelf: 'flex-end' },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: 14, color: colors.textMuted, marginTop: -6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currency: { fontSize: 24, fontWeight: '800', color: colors.textMuted },
  input: { flex: 1, fontSize: 28, fontWeight: '800', color: colors.text, paddingVertical: spacing.md, marginLeft: 6 },
});
