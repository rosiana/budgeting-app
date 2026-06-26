import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import { CatIcon, PrimaryButton } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import {
  CATEGORIES,
  categoryOf,
  colors,
  DEVICE_PERSON,
  fill,
  INCOME_CATEGORIES,
  radius,
  sourceOf,
  sourcesForPerson,
  spacing,
  WHO,
} from '../theme';
import {
  CategoryId,
  IncomeCategoryId,
  LineItem,
  SourceId,
  TxType,
  WhoId,
} from '../types';
import { formatCurrency, formatDateLong, toISODate, todayISO } from '../utils/format';
import { uid } from '../utils/id';
import { persistImage } from '../utils/image';

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
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useBudget();

  const draft = route.params?.draft;
  const isEdit = !!draft?.id;
  const defaultSource = sourcesForPerson(DEVICE_PERSON)[0].id;

  const [type, setType] = useState<TxType>(draft?.type ?? 'expense');
  const [merchant, setMerchant] = useState(draft?.merchant ?? '');
  const [amount, setAmount] = useState(draft?.amount != null ? String(Math.round(draft.amount)) : '');
  const [date, setDate] = useState(draft?.date ?? todayISO());
  const [category, setCategory] = useState<CategoryId>(draft?.category ?? 'lainnya');
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategoryId>(
    draft?.incomeCategory ?? 'gaji'
  );
  const [who, setWho] = useState<WhoId>(draft?.who ?? DEFAULT_WHO);
  const [source, setSource] = useState<SourceId>(draft?.source ?? defaultSource);
  const [creditCard, setCreditCard] = useState<boolean>(draft?.creditCard ?? false);
  const [reimbursable, setReimbursable] = useState<boolean>(draft?.reimbursable ?? false);
  const [note, setNote] = useState(draft?.note ?? '');
  const [image, setImage] = useState<string | undefined>(draft?.image);
  const [showDate, setShowDate] = useState(false);
  const isIncome = type === 'income';

  // Sources this device's person can pay from (plus the current one when editing).
  const availableSources = useMemo(() => {
    const list = sourcesForPerson(DEVICE_PERSON);
    if (source && !list.some((s) => s.id === source)) return [sourceOf(source), ...list];
    return list;
  }, [source]);

  // Autosuggest transaction names from previously used merchants.
  const nameSuggestions = useMemo(() => {
    const q = merchant.trim().toLowerCase();
    if (q.length < 1) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of transactions) {
      const name = t.merchant?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (key === q || seen.has(key)) continue;
      if (key.includes(q)) {
        seen.add(key);
        out.push(name);
        if (out.length >= 5) break;
      }
    }
    return out;
  }, [merchant, transactions]);

  const pickImage = async (fromCamera: boolean) => {
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setImage(await persistImage(res.assets[0].uri));
    }
  };
  const onAttach = () =>
    Alert.alert('Lampirkan Foto', undefined, [
      { text: 'Kamera', onPress: () => pickImage(true) },
      { text: 'Galeri', onPress: () => pickImage(false) },
      { text: 'Batal', style: 'cancel' },
    ]);
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
  // Itemized mode: a basket split across categories. The amount then comes from
  // the items, and the parent category is auto-derived (no manual pick).
  const itemized = !isIncome && items.length > 0;
  const effectiveAmount = itemized ? itemsSum : amountValue;
  const validItemCount = useMemo(
    () => items.filter((it) => it.description.trim() && toAmount(it.amount) > 0).length,
    [items]
  );
  const canSave =
    merchant.trim().length > 0 &&
    (itemized ? validItemCount > 0 && itemsSum > 0 : amountValue > 0);

  const updateItem = (idx: number, patch: Partial<EditableItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () =>
    setItems((prev) => [...prev, { id: uid(), description: '', amount: '', category }]);
  // Convert a simple entry into a basket: seed the first item from what's typed.
  const startItemizing = () =>
    setItems([{ id: uid(), description: '', amount: amount || '', category }]);
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
    const useItems = !isIncome && cleanedItems.length > 0;

    // When itemized, amount = sum of items and the parent category is the one
    // with the biggest item total (used only for the list-row icon; budgets
    // still split per item).
    let finalAmount = Math.round(amountValue);
    let finalCategory = category;
    if (useItems) {
      finalAmount = cleanedItems.reduce((s, it) => s + it.amount, 0);
      const totals = {} as Record<CategoryId, number>;
      cleanedItems.forEach((it) => {
        totals[it.category] = (totals[it.category] ?? 0) + it.amount;
      });
      finalCategory = cleanedItems.reduce(
        (best, it) => (totals[it.category] > totals[best] ? it.category : best),
        cleanedItems[0].category
      );
    }

    const base = {
      type,
      merchant: merchant.trim(),
      amount: finalAmount,
      date,
      category: finalCategory,
      incomeCategory: isIncome ? incomeCategory : undefined,
      who,
      source,
      creditCard: !isIncome && creditCard ? true : undefined,
      reimbursable: !isIncome && reimbursable ? true : undefined,
      reimbursed: !isIncome && reimbursable ? draft?.reimbursed : undefined,
      note: note.trim() || undefined,
      items: useItems ? cleanedItems : undefined,
      image: image || undefined,
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

        {/* Expense / Income toggle */}
        <View style={styles.typeToggle}>
          {(['expense', 'income'] as TxType[]).map((t) => {
            const active = type === t;
            const tint = t === 'income' ? colors.success : colors.danger;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeBtn, active && { backgroundColor: colors.card }]}
              >
                <Ionicons
                  name={t === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={18}
                  color={active ? tint : colors.textMuted}
                />
                <Text style={[styles.typeText, active && { color: tint }]}>
                  {t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amount */}
        <Text style={styles.label}>Jumlah</Text>
        {itemized ? (
          <>
            <View style={[styles.amountRow, { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}>
              <Text style={styles.currency}>Rp</Text>
              <Text style={styles.amountInput}>{formatCurrency(itemsSum).replace('Rp', '')}</Text>
              <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.autoHint}>Otomatis dijumlah dari {validItemCount} item di bawah.</Text>
          </>
        ) : (
          <View style={styles.amountRow}>
            <Text style={styles.currency}>Rp</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={[styles.amountInput, { color: isIncome ? colors.success : colors.text }]}
            />
          </View>
        )}

        {/* Transaction name */}
        <Text style={styles.label}>Nama Transaksi</Text>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder={isIncome ? 'mis. Gaji Rizal' : 'mis. Belanja Indomaret'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {nameSuggestions.length > 0 ? (
          <View style={styles.suggestRow}>
            {nameSuggestions.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.suggestChip}
                onPress={() => setMerchant(name)}
              >
                <Ionicons name="time-outline" size={12} color={colors.primary} />
                <Text style={styles.suggestText} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Date */}
        <Text style={styles.label}>Tanggal</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowDate(true)}
          style={[styles.input, styles.dateField]}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.dateText}>{formatDateLong(date)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {showDate && Platform.OS === 'android' ? (
          <DateTimePicker
            value={new Date(`${date}T00:00:00`)}
            mode="date"
            display="default"
            onChange={(e, d) => {
              setShowDate(false);
              if (e.type !== 'dismissed' && d) setDate(toISODate(d));
            }}
          />
        ) : null}

        {/* iOS: modal with backdrop. Tap backdrop or pick a date to close. */}
        {Platform.OS === 'ios' ? (
          <Modal
            visible={showDate}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDate(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setShowDate(false)}
              style={styles.dateBackdrop}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.dateSheet}>
                <DateTimePicker
                  value={new Date(`${date}T00:00:00`)}
                  mode="date"
                  display="inline"
                  onChange={(_, d) => {
                    if (d) setDate(toISODate(d));
                    setShowDate(false);
                  }}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        ) : null}

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
          {availableSources.map((s) => {
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

        {/* Category — hidden when itemized (each item carries its own) */}
        {isIncome ? (
          <>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.chipWrap}>
              {INCOME_CATEGORIES.map((c) => {
                const active = incomeCategory === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.8}
                    onPress={() => setIncomeCategory(c.id)}
                    style={[styles.chip, { borderColor: active ? c.color : colors.border, backgroundColor: active ? c.color + '18' : colors.card }]}
                  >
                    <Ionicons name={c.icon as any} size={14} color={c.color} />
                    <Text style={[styles.chipText, active && { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : itemized ? (
          <>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.catNote}>
              <Ionicons name="pricetags" size={15} color={colors.primary} />
              <Text style={styles.catNoteText}>Diatur per item di bawah.</Text>
            </View>
          </>
        ) : (
          <>
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
                    <CatIcon name={c.icon} set={c.iconSet} size={14} color={c.color} />
                    <Text style={[styles.chipText, active && { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Credit-card flag (expense only) */}
        {!isIncome ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCreditCard((v) => !v)}
            style={[styles.ccRow, creditCard && styles.ccRowOn]}
          >
            <Ionicons name="card" size={18} color={creditCard ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.ccTitle, creditCard && { color: colors.primary }]}>Bayar pakai Kartu Kredit</Text>
              <Text style={styles.ccSub}>
                Tidak memotong saldo sekarang — ditagih saat jatuh tempo.
              </Text>
            </View>
            <View style={[styles.switchTrack, creditCard && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, creditCard && styles.switchThumbOn]} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Reimbursable flag (expense only) */}
        {!isIncome ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setReimbursable((v) => !v)}
            style={[styles.ccRow, reimbursable && styles.ccRowOn]}
          >
            <Ionicons name="repeat" size={18} color={reimbursable ? colors.primary : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.ccTitle, reimbursable && { color: colors.primary }]}>Bisa direimburse</Text>
              <Text style={styles.ccSub}>
                Diganti perusahaan — tidak masuk anggaran. Tandai lunas di tab Saldo.
              </Text>
            </View>
            <View style={[styles.switchTrack, reimbursable && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, reimbursable && styles.switchThumbOn]} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Per-item breakdown (expense only) */}
        {!isIncome && !itemized ? (
          <TouchableOpacity onPress={startItemizing} style={styles.splitBtn} activeOpacity={0.8}>
            <Ionicons name="git-branch-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.splitTitle}>Pecah jadi beberapa item</Text>
              <Text style={styles.splitSub}>
                Buat belanja campur — mis. Indomaret: telur, sabun, rokok. Tiap
                item punya kategorinya sendiri.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {!isIncome && itemized ? (
        <>
        <View style={styles.itemsHeader}>
          <Text style={[styles.label, { marginTop: 0 }]}>Rincian Item</Text>
          <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addItemText}>Tambah item</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.itemsHint}>
          Tiap item punya kategori sendiri. Jumlah transaksi otomatis = total item.
          Hapus semua item untuk kembali ke satu kategori.
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
                  activeOpacity={0.8}
                  style={[styles.chip, { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
                >
                  <CatIcon name={cat.icon} set={cat.iconSet} size={14} color={cat.color} />
                  <Text style={[styles.chipText, { color: cat.color }]} numberOfLines={1}>
                    {cat.label}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={cat.color} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <View style={styles.itemsTotalRow}>
          <Text style={styles.itemsTotalLabel}>Jumlah transaksi</Text>
          <Text style={styles.itemsTotalValue}>{formatCurrency(itemsSum)}</Text>
        </View>
        </>
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

        {/* Photo attachment */}
        <Text style={styles.label}>Foto (opsional)</Text>
        {image ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: image }} style={styles.imageThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.imageName}>Foto terlampir</Text>
              <TouchableOpacity onPress={onAttach}>
                <Text style={styles.imageAction}>Ganti foto</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setImage(undefined)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={onAttach} style={styles.attachBtn} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
            <Text style={styles.attachText}>Lampirkan foto</Text>
          </TouchableOpacity>
        )}

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
                  <CatIcon name={c.icon} set={c.iconSet} size={14} color={c.color} />
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
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  typeText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  ccRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  ccRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  ccTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  ccSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  switchTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: colors.primary },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  switchThumbOn: { alignSelf: 'flex-end' },
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
  autoHint: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  catNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  catNoteText: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },
  splitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  splitTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  splitSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  itemsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemsTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemsTotalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
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
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '600' },
  dateBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dateSheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '100%',
  },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  suggestText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark, flexShrink: 1 },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  attachText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  imageWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  imageThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.border },
  imageName: { fontSize: 14, fontWeight: '700', color: colors.text },
  imageAction: { fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: 2 },
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
