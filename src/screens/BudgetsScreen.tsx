import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatIcon, Card, MonthNav, PrimaryButton, ProgressBar } from '../components/ui';
import { useBudget } from '../store/BudgetContext';
import { spendByCategory, totalSpent, txForMonth } from '../store/selectors';
import { budgetStatusColor, categoryOf, colors, fill, radius, spacing } from '../theme';
import { CategoryId } from '../types';
import { currentMonthKey, formatCompact, formatCurrency, formatMonth, shiftMonth } from '../utils/format';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, budgets, setBudget } = useBudget();
  const [editing, setEditing] = useState<CategoryId | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const [month, setMonth] = useState(currentMonthKey());
  const mKey = month;
  const monthTx = useMemo(() => txForMonth(transactions, mKey), [transactions, mKey]);
  const byCat = useMemo(() => spendByCategory(monthTx, budgets), [monthTx, budgets]);
  const spent = totalSpent(monthTx);
  const totalBudget = Object.values(budgets).reduce((s, b) => s + b, 0);
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
            <SummaryStat label="Anggaran" value={formatCompact(totalBudget)} />
            <SummaryStat label="Terpakai" value={formatCompact(spent)} />
            <SummaryStat
              label="Sisa"
              value={formatCompact(Math.max(0, totalBudget - spent))}
              color={totalBudget - spent >= 0 ? colors.success : colors.danger}
            />
          </View>
          {overCount > 0 ? (
            <View style={styles.warn}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.warnText}>
                {overCount} kategori melebihi anggaran
              </Text>
            </View>
          ) : null}
        </Card>

        <Text style={styles.hint}>Ketuk kategori untuk mengubah batas bulanannya.</Text>

        {byCat.map((c) => {
          const cat = categoryOf(c.category);
          const over = c.budget > 0 && c.spent > c.budget;
          return (
            <TouchableOpacity
              key={c.category}
              activeOpacity={0.7}
              onPress={() => openEditor(c.category)}
              style={styles.catCard}
            >
              <View style={styles.catHead}>
                <View style={styles.catName}>
                  <CatIcon name={cat.icon} set={cat.iconSet} size={18} color={cat.color} />
                  <Text style={styles.catLabel} numberOfLines={1}>{cat.label}</Text>
                </View>
                <Text style={styles.catAmt}>
                  {formatCompact(c.spent)}
                  <Text style={styles.catAmtMuted}> / {formatCompact(c.budget)}</Text>
                </Text>
              </View>
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
                  ? `Lewat ${formatCurrency(c.spent - c.budget)}`
                  : `Sisa ${formatCurrency(c.budget - c.spent)}`}
              </Text>
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
      <Text style={[styles.statValue, { color }]}>{value}</Text>
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
  statValue: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  warnText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  catCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  catName: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  catLabel: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  catAmt: { fontSize: 14, fontWeight: '800', color: colors.text },
  catAmtMuted: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  catStatus: { fontSize: 13, fontWeight: '700' },
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
