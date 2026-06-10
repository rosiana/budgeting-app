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
import { Card, PrimaryButton, ProgressBar } from '../components/ui';
import { useBudget } from '../store/BudgetContext';
import { spendByCategory, totalSpent, txForMonth } from '../store/selectors';
import { categoryOf, colors, fill, radius, spacing } from '../theme';
import { CategoryId } from '../types';
import { currentMonthKey, formatCurrency, formatMonth } from '../utils/format';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, budgets, setBudget } = useBudget();
  const [editing, setEditing] = useState<CategoryId | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const mKey = currentMonthKey();
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
        <Text style={styles.title}>Budgets</Text>
        <Text style={styles.subtitle}>{formatMonth(mKey)}</Text>

        <Card style={styles.summary}>
          <View style={styles.summaryRow}>
            <SummaryStat label="Budget" value={formatCurrency(totalBudget)} />
            <SummaryStat label="Spent" value={formatCurrency(spent)} />
            <SummaryStat
              label="Left"
              value={formatCurrency(Math.max(0, totalBudget - spent))}
              color={totalBudget - spent >= 0 ? colors.success : colors.danger}
            />
          </View>
          {overCount > 0 ? (
            <View style={styles.warn}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.warnText}>
                {overCount} {overCount === 1 ? 'category is' : 'categories are'} over budget
              </Text>
            </View>
          ) : null}
        </Card>

        <Text style={styles.hint}>Tap a category to adjust its monthly limit.</Text>

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
                  <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                  <Text style={styles.catLabel}>{cat.label}</Text>
                </View>
                <Ionicons name="pencil" size={15} color={colors.textMuted} />
              </View>
              <View style={{ marginVertical: 8 }}>
                <ProgressBar pct={c.pct} color={cat.color} height={10} />
              </View>
              <View style={styles.catFoot}>
                <Text style={[styles.catSpent, over && { color: colors.danger }]}>
                  {formatCurrency(c.spent)} spent
                </Text>
                <Text style={styles.catBudget}>
                  {c.budget > 0
                    ? `${formatCurrency(Math.max(0, c.budget - c.spent))} left of ${formatCurrency(c.budget)}`
                    : 'No limit set'}
                </Text>
              </View>
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
              {editing ? categoryOf(editing).label : ''} budget
            </Text>
            <Text style={styles.sheetSub}>Set your monthly limit for this category.</Text>
            <View style={styles.inputRow}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                value={draftValue}
                onChangeText={setDraftValue}
                keyboardType="decimal-pad"
                placeholder="0"
                autoFocus
                style={styles.input}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <PrimaryButton label="Save limit" onPress={saveEditor} />
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
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  catFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  catSpent: { fontSize: 13, fontWeight: '700', color: colors.text },
  catBudget: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
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
