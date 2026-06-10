import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { PrimaryButton } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import {
  CATEGORIES,
  categoryOf,
  colors,
  fill,
  radius,
  SOURCES,
  spacing,
  WHO,
} from '../theme';
import { CategoryId, LineItem, SourceId, WhoId } from '../types';
import { formatCurrency, todayISO } from '../utils/format';
import { uid } from '../utils/id';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddTransaction'>;
type Rt = RouteProp<RootStackParamList, 'AddTransaction'>;

interface EditableItem {
  id: string;
  description: string;
  amount: string;
  category: CategoryId;
}

/** Default "who" depends on the platform: Rizal's Android vs Rosi's iOS. */
const DEFAULT_WHO: WhoId = Platform.OS === 'ios' ? 'rosi' : 'rizal';

function toAmount(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

export default function AddTransactionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const { addTransaction, updateTransaction, deleteTransaction } = useBudget();

  const draft = route.params?.draft;
  const isEdit = !!draft?.id;

  const [merchant, setMerchant] = useState(draft?.merchant ?? '');
  const [amount, setAmount] = useState(draft?.amount != null ? String(Math.round(draft.amount)) : '');
  const [date, setDate] = useState(draft?.date ?? todayISO());
  const [category, setCategory] = useState<CategoryId>(draft?.category ?? 'lainnya');
  const [who, setWho] = useState<WhoId>(draft?.who ?? DEFAULT_WHO);
  const [source, setSource] = useState<SourceId>(draft?.source ?? 'bca');
  const [note, setNote] = useState(draft?.note ?? '');
  const [items, setItems] = useState<EditableItem[]>(
    (draft?.items ?? []).map((it) => ({
      id: uid(),
      description: it.description,
      amount: String(Math.round(it.amount)),
      category: it.category,
    }))
  );
  // Index of the item whose category picker is open (null = closed).
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const amountValue = useMemo(() => toAmount(amount), [amount]);
  const itemsSum = useMemo(
    () => items.reduce((s, it) => s + (toAmount(it.amount) || 0), 0),
    [items]
  );
  const canSave = merchant.trim().length > 0 && amountValue > 0;

  const updateItem = (idx: number, patch: Partial<EditableItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () =>
    setItems((prev) => [...prev, { id: uid(), description: '', amount: '', category }]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const onSave = () => {
    if (!canSave) return;
    const cleanedItems: LineItem[] = items
      .filter((it) => it.description.trim() && toAmount(it.amount) > 0)
      .map((it) => ({
        description: it.description.trim(),
        amount: Math.round(toAmount(it.amount)),
        category: it.category,
      }));
    const base = {
      merchant: merchant.trim(),
      amount: Math.round(amountValue),
      date,
      category,
      who,
      source,
      note: note.trim() || undefined,
      items: cleanedItems.length ? cleanedItems : undefined,
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
        <Text style={styles.headerTitle}>{isEdit ? 'Ubah Transaksi' : 'Transaksi Baru'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {draft?.scanned ? (
          <View style={styles.scanBanner}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={styles.scanBannerText}>Hasil scan struk — periksa dan ubah jika perlu.</Text>
          </View>
        ) : null}

        {/* Amount */}
        <Text style={styles.label}>Jumlah</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>Rp</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={styles.amountInput}
          />
        </View>

        {/* Merchant */}
        <Text style={styles.label}>Toko / Keterangan</Text>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder="mis. Superindo"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        {/* Date */}
        <Text style={styles.label}>Tanggal</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCapitalize="none"
        />

        {/* Who */}
        <Text style={styles.label}>Untuk Siapa</Text>
        <View style={styles.chipWrap}>
          {WHO.map((w) => {
            const active = who === w.id;
            return (
              <TouchableOpacity
                key={w.id}
                activeOpacity={0.8}
                onPress={() => setWho(w.id)}
                style={[styles.chip, { borderColor: active ? w.color : colors.border, backgroundColor: active ? w.color + '18' : colors.card }]}
              >
                <View style={[styles.chipDot, { backgroundColor: w.color }]} />
                <Text style={[styles.chipText, active && { color: w.color }]}>{w.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Source */}
        <Text style={styles.label}>Sumber Dana</Text>
        <View style={styles.chipWrap}>
          {SOURCES.map((s) => {
            const active = source === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.8}
                onPress={() => setSource(s.id)}
                style={[styles.chip, { borderColor: active ? s.color : colors.border, backgroundColor: active ? s.color + '18' : colors.card }]}
              >
                <Ionicons name={s.icon as any} size={14} color={s.color} />
                <Text style={[styles.chipText, active && { color: s.color }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category */}
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.8}
                onPress={() => setCategory(c.id)}
                style={[styles.chip, { borderColor: active ? c.color : colors.border, backgroundColor: active ? c.color + '18' : colors.card }]}
              >
                <Ionicons name={c.icon as any} size={14} color={c.color} />
                <Text style={[styles.chipText, active && { color: c.color }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Per-item breakdown with per-item categories */}
        <View style={styles.itemsHeader}>
          <Text style={[styles.label, { marginTop: 0 }]}>Rincian Item</Text>
          <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addItemText}>Tambah item</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.itemsHint}>
          Tiap item bisa punya kategori sendiri. Berguna saat satu struk berisi
          beberapa kategori.
        </Text>

        {items.map((it, idx) => {
          const cat = categoryOf(it.category);
          return (
            <View key={it.id} style={styles.itemCard}>
              <View style={styles.itemTopRow}>
                <TextInput
                  value={it.description}
                  onChangeText={(t) => updateItem(idx, { description: t })}
                  placeholder="Nama item"
                  placeholderTextColor={colors.textMuted}
                  style={styles.itemDescInput}
                />
                <TouchableOpacity onPress={() => removeItem(idx)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.itemBottomRow}>
                <View style={styles.itemAmountBox}>
                  <Text style={styles.itemRp}>Rp</Text>
                  <TextInput
                    value={it.amount}
                    onChangeText={(t) => updateItem(idx, { amount: t })}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.itemAmountInput}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setPickerFor(idx)}
                  style={[styles.itemCatBtn, { borderColor: cat.color }]}
                >
                  <Ionicons name={cat.icon as any} size={13} color={cat.color} />
                  <Text style={[styles.itemCatText, { color: cat.color }]} numberOfLines={1}>
                    {cat.label}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={cat.color} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {items.length > 0 ? (
          <Text style={styles.itemsSum}>
            Total item: {formatCurrency(itemsSum)}
            {amountValue > 0 && Math.abs(itemsSum - amountValue) > 0.5
              ? `  •  beda ${formatCurrency(Math.abs(amountValue - itemsSum))} dari jumlah`
              : ''}
          </Text>
        ) : null}

        {/* Note */}
        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Tambah catatan"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          multiline
        />

        <View style={{ height: spacing.lg }} />
        <PrimaryButton
          label={isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          icon="checkmark"
          onPress={onSave}
          disabled={!canSave}
        />

        {isEdit ? (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Hapus transaksi</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Per-item category picker */}
      <Modal visible={pickerFor !== null} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <View style={styles.modalWrap}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPickerFor(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>Pilih kategori item</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (pickerFor !== null) updateItem(pickerFor, { category: c.id });
                    setPickerFor(null);
                  }}
                  style={[styles.chip, { borderColor: c.color, backgroundColor: c.color + '12' }]}
                >
                  <Ionicons name={c.icon as any} size={14} color={c.color} />
                  <Text style={[styles.chipText, { color: c.color }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
  currency: { fontSize: 26, fontWeight: '800', color: colors.textMuted },
  amountInput: { flex: 1, fontSize: 30, fontWeight: '800', color: colors.text, paddingVertical: spacing.md, marginLeft: 6 },
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipDot: { width: 9, height: 9, borderRadius: 5 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addItemText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  itemsHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemDescInput: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600', paddingVertical: 2 },
  itemBottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    flex: 1,
  },
  itemRp: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  itemAmountInput: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, paddingVertical: 8, marginLeft: 4 },
  itemCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 160,
  },
  itemCatText: { fontSize: 13, fontWeight: '700' },
  itemsSum: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg, padding: spacing.md },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
});
