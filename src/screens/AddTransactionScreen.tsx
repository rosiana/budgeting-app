import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import { CATEGORIES, categoryOf, colors, radius, spacing } from '../theme';
import { CategoryId } from '../types';
import { formatCurrency, todayISO } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddTransaction'>;
type Rt = RouteProp<RootStackParamList, 'AddTransaction'>;

export default function AddTransactionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const { addTransaction, updateTransaction, deleteTransaction } = useBudget();

  const draft = route.params?.draft;
  const isEdit = !!draft?.id;

  const [merchant, setMerchant] = useState(draft?.merchant ?? '');
  const [amount, setAmount] = useState(
    draft?.amount != null ? String(draft.amount) : ''
  );
  const [date, setDate] = useState(draft?.date ?? todayISO());
  const [category, setCategory] = useState<CategoryId>(draft?.category ?? 'other');
  const [note, setNote] = useState(draft?.note ?? '');
  const items = draft?.items ?? [];

  const amountValue = useMemo(() => {
    const n = parseFloat(amount.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }, [amount]);

  const canSave = merchant.trim().length > 0 && amountValue > 0;

  const onSave = () => {
    if (!canSave) return;
    const base = {
      merchant: merchant.trim(),
      amount: Math.round(amountValue * 100) / 100,
      date,
      category,
      note: note.trim() || undefined,
      items: items.length ? items : undefined,
      scanned: draft?.scanned,
    };
    if (isEdit && draft?.id) {
      updateTransaction({ ...base, id: draft.id, createdAt: Date.now() });
    } else {
      addTransaction(base);
    }
    navigation.popToTop();
  };

  const onDelete = () => {
    if (draft?.id) {
      deleteTransaction(draft.id);
      navigation.popToTop();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit expense' : 'New expense'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {draft?.scanned ? (
          <View style={styles.scanBanner}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={styles.scanBannerText}>Prefilled from your scanned receipt — tweak anything below.</Text>
          </View>
        ) : null}

        {/* Amount */}
        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            style={styles.amountInput}
          />
        </View>

        {/* Merchant */}
        <Text style={styles.label}>Merchant</Text>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder="e.g. Whole Foods"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCapitalize="none"
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.8}
                onPress={() => setCategory(c.id)}
                style={[
                  styles.catChip,
                  { borderColor: active ? c.color : colors.border, backgroundColor: active ? c.color + '18' : colors.card },
                ]}
              >
                <Ionicons name={c.icon as any} size={16} color={c.color} />
                <Text style={[styles.catChipText, active && { color: c.color }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Note */}
        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          multiline
        />

        {/* Scanned line items */}
        {items.length ? (
          <View style={styles.itemsCard}>
            <Text style={styles.itemsTitle}>Scanned items</Text>
            {items.map((it, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemDesc} numberOfLines={1}>{it.description}</Text>
                <Text style={styles.itemAmt}>{formatCurrency(it.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: spacing.lg }} />
        <PrimaryButton
          label={isEdit ? 'Save changes' : 'Add expense'}
          icon="checkmark"
          onPress={onSave}
          disabled={!canSave}
        />

        {isEdit ? (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Delete expense</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  scanBannerText: { flex: 1, color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6, marginTop: spacing.lg },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currency: { fontSize: 28, fontWeight: '800', color: colors.textMuted },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '800', color: colors.text, paddingVertical: spacing.md, marginLeft: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  catChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemsCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemsTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  itemDesc: { flex: 1, fontSize: 14, color: colors.text, marginRight: 8 },
  itemAmt: { fontSize: 14, fontWeight: '600', color: colors.text },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg, padding: spacing.md },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
