import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatIcon, Card, GridBg, MonthNav, PrimaryButton, PrivacyEye, ProgressBar, SegmentTabs } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useBudget } from '../store/BudgetContext';
import { spendByCategory, totalSpent, txForMonth } from '../store/selectors';
import {
  ANGGARAN_CATEGORIES,
  budgetStatusColor,
  categoryOf,
  CATEGORY_MAP,
  colors,
  fill,
  INCOME_CATEGORY_MAP,
  PICKABLE_CATEGORIES,
  PICKABLE_INCOME_CATEGORIES,
  radius,
  sourceOf,
  sourcesForPerson,
  spacing,
  WHO,
  whoOf,
} from '../theme';
import { CategoryId, IncomeCategoryId, RecurringTx, SourceId, TxType, WhoId } from '../types';
import { currentMonthKey, formatCompact, formatCurrency, formatMonth, shiftMonth, toISODate } from '../utils/format';
import { uid } from '../utils/id';
import { formatAmountInput, parseAmountInput, useMoney } from '../utils/money';
import { currentPeriodKey, isUnpaidThisPeriod, nextActivePeriodDate } from '../utils/recurring';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'anggaran' | 'rutin';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {
    transactions,
    budgets,
    disabledBudgets,
    creditCard,
    recurring,
    setBudget,
    toggleBudget,
    upsertRecurring,
    deleteRecurring,
  } = useBudget();
  const money = useMoney();
  const [tab, setTab] = useState<Tab>('anggaran');
  const [editing, setEditing] = useState<CategoryId | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [recEditing, setRecEditing] = useState<RecurringTx | null>(null);

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
  // Rendered list: active categories first, sorted by pct desc (closest to
  // limit at the top — mirrors the Dashboard's Anggaran preview). Inactive
  // categories fall to the bottom of the list, in their natural order.
  const shownList = useMemo(() => {
    const active = byCatAll.filter((c) => !isDisabled(c.category));
    active.sort((a, b) => {
      // Categories with no budget set (pct=0 but user hasn't chosen a
      // limit) fall to the end of the active block — otherwise a 0/0 row
      // reads misleadingly as "most under budget".
      const aHas = a.budget > 0 ? 1 : 0;
      const bHas = b.budget > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return b.pct - a.pct;
    });
    const inactive = byCatAll.filter((c) => isDisabled(c.category));
    return [...active, ...inactive];
  }, [byCatAll, disabledBudgets]);
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
        <Text style={styles.title}>Perencanaan</Text>
        <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
          <SegmentTabs
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { id: 'anggaran', label: 'Anggaran', icon: 'wallet' },
              { id: 'rutin', label: 'Transaksi Rutin', icon: 'refresh' },
            ]}
          />
        </View>

        {tab === 'anggaran' ? <>
        <View style={{ marginBottom: spacing.md }}>
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

        {shownList.map((c) => {
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
        </> : (
          <RecurringList
            recurring={recurring}
            money={money}
            onEdit={(r) => setRecEditing(r)}
            onAdd={() => setRecEditing(newRecurring())}
            onPay={(r) => payRecurring(r, navigation)}
            onToggleEnabled={(r) => upsertRecurring({ ...r, enabled: !r.enabled })}
          />
        )}
      </ScrollView>

      {/* Add/edit Transaksi Rutin */}
      <RecurringEditor
        rec={recEditing}
        onClose={() => setRecEditing(null)}
        onSave={(r) => {
          // Strip fields that don't belong to the picked type so the
          // stored shape stays lean and the Bayar branch reads cleanly.
          const cleaned: RecurringTx =
            r.txType === 'transfer'
              ? { ...r, category: 'transfer_out', incomeCategory: undefined, amount: undefined, source: undefined, creditCard: undefined, reimbursable: undefined }
              : { ...r, fromSource: undefined, toSource: undefined, transferAmount: undefined, transferFee: undefined };
          upsertRecurring(cleaned);
          setRecEditing(null);
        }}
        onDelete={(r) => {
          Alert.alert('Hapus Transaksi Rutin', `Hapus "${r.name}"?`, [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Hapus',
              style: 'destructive',
              onPress: () => {
                deleteRecurring(r.id);
                setRecEditing(null);
              },
            },
          ]);
        }}
      />

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

/** Blank RecurringTx used when opening the editor in "add" mode. */
function newRecurring(): RecurringTx {
  const today = new Date();
  return {
    id: uid(),
    enabled: true,
    name: '',
    txType: 'expense',
    category: 'lainnya',
    pic: 'both',
    dayOfMonth: today.getDate(),
    intervalMonths: 1,
    anchorMonth: today.getMonth() + 1,
    updatedAt: Date.now(),
  };
}

/** Bayar: pre-fill the Add Transaction form from a rec tx, then let the
 *  form handle the save. `recurringId` is forwarded so onSave marks it paid. */
function payRecurring(r: RecurringTx, nav: Nav) {
  // Transfer rec txs open the form on the Transfer tab with the group's
  // legs pre-filled — same shape used by "edit transfer" from Transaksi.
  if (r.txType === 'transfer') {
    const amountOut = (r.transferAmount ?? 0) + (r.transferFee ?? 0);
    const amountIn = r.transferAmount ?? 0;
    nav.navigate('AddTransaction', {
      draft: {
        type: 'transfer',
        date: toISODate(new Date()),
        transfer: {
          group: uid(),
          fromSource: r.fromSource ?? 'bca',
          toSource: r.toSource ?? 'seabank',
          amountOut,
          amountIn,
        },
        recurringId: r.id,
      },
    });
    return;
  }
  nav.navigate('AddTransaction', {
    draft: {
      type: r.txType,
      merchant: r.name,
      amount: r.amount,
      date: toISODate(new Date()),
      category: r.category,
      incomeCategory: r.incomeCategory,
      who: r.who,
      source: r.source,
      creditCard: r.creditCard,
      reimbursable: r.reimbursable,
      recurringId: r.id,
    },
  });
}

function RecurringList({
  recurring,
  money,
  onEdit,
  onAdd,
  onPay,
  onToggleEnabled,
}: {
  recurring: RecurringTx[];
  money: (n: number) => string;
  onEdit: (r: RecurringTx) => void;
  onAdd: () => void;
  onPay: (r: RecurringTx) => void;
  onToggleEnabled: (r: RecurringTx) => void;
}) {
  const today = new Date();
  const list = [...recurring].sort((a, b) => {
    const aUnpaid = isUnpaidThisPeriod(a, today) ? 0 : 1;
    const bUnpaid = isUnpaidThisPeriod(b, today) ? 0 : 1;
    if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
    return a.dayOfMonth - b.dayOfMonth;
  });
  return (
    <View>
      <Text style={styles.hint}>
        Pengingat bulanan untuk setiap transaksi rutin. Aktifkan bel untuk
        dapat notifikasi jam 09:00 di tanggal yang kamu tentukan.
      </Text>
      <TouchableOpacity onPress={onAdd} style={[styles.addRecBtn, { marginBottom: spacing.md }]} activeOpacity={0.85}>
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={styles.addRecText}>Tambah Transaksi Rutin</Text>
      </TouchableOpacity>
      {list.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            Belum ada transaksi rutin. Tap tombol di atas untuk menambah
            (mis. KPR, Netflix, SPP Nonik).
          </Text>
        </Card>
      ) : (
        list.map((r) => {
          const cat = r.txType === 'transfer'
            ? { icon: 'swap-horizontal', color: colors.primary }
            : r.txType === 'income'
              ? INCOME_CATEGORY_MAP[r.incomeCategory ?? 'lainnya_in']
              : CATEGORY_MAP[r.category];
          const picLabel = r.pic === 'both' ? 'Rosi + Rizal' : r.pic === 'rosi' ? 'Rosi' : 'Rizal';
          const unpaid = isUnpaidThisPeriod(r, today);
          const nextDate = nextActivePeriodDate(r, today);
          const intervalLabel = r.intervalMonths === 3 ? 'per 3 bulan' : 'per bulan';
          return (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.85}
              onPress={() => onEdit(r)}
              style={styles.recCard}
            >
              <View style={styles.recHead}>
                <View style={{ flex: 1 }}>
                  <View style={styles.recTitleRow}>
                    <CatIcon
                      name={cat.icon as any}
                      set={('iconSet' in cat && cat.iconSet) as any}
                      size={16}
                      color={cat.color}
                    />
                    <Text style={styles.recName} numberOfLines={1}>{r.name || 'Tanpa nama'}</Text>
                  </View>
                  <Text style={styles.recMeta}>
                    Tanggal {r.dayOfMonth} {intervalLabel} · PIC {picLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onToggleEnabled(r)}
                  hitSlop={8}
                  style={styles.bellBtn}
                >
                  <Ionicons
                    name={r.enabled ? 'notifications' : 'notifications-off-outline'}
                    size={18}
                    color={r.enabled ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.recActions}>
                <Text style={[styles.recStatus, unpaid ? { color: colors.warning } : { color: colors.success }]}>
                  {unpaid ? 'Belum dibayar bulan ini' : `Sudah dibayar · berikutnya ${formatMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`)}`}
                </Text>
                <TouchableOpacity
                  onPress={() => onPay(r)}
                  style={styles.payBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                  <Text style={styles.payText}>Bayar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

function RecurringEditor({
  rec,
  onClose,
  onSave,
  onDelete,
}: {
  rec: RecurringTx | null;
  onClose: () => void;
  onSave: (r: RecurringTx) => void;
  onDelete: (r: RecurringTx) => void;
}) {
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const [draft, setDraft] = useState<RecurringTx | null>(rec);
  React.useEffect(() => setDraft(rec), [rec?.id]);
  if (!draft) return null;
  const isIncome = draft.txType === 'income';
  const isTransfer = draft.txType === 'transfer';
  const isNew = !rec?.name; // heuristic: newRecurring() has empty name
  const setField = <K extends keyof RecurringTx>(k: K, v: RecurringTx[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  // Sources available for this PIC (drives both the plain "Sumber Dana"
  // picker and Transfer's From/To selection).
  const picSources = draft.pic === 'both'
    ? [...sourcesForPerson('rosi'), ...sourcesForPerson('rizal')]
    : sourcesForPerson(draft.pic);

  const isValid =
    draft.name.trim().length > 0 &&
    draft.dayOfMonth >= 1 && draft.dayOfMonth <= 31 &&
    (!isTransfer ||
      (!!draft.fromSource && !!draft.toSource && draft.fromSource !== draft.toSource &&
       !!draft.transferAmount && draft.transferAmount > 0));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.recSheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          {/* Modal header — close X on the left, centered title, matches the
           *  Add Transaction modal so the two screens read as a set. */}
          <View style={styles.recModalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.recModalTitle}>
              {isNew ? 'Tambah Transaksi Rutin' : 'Ubah Transaksi Rutin'}
            </Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Nama</Text>
            <TextInput
              value={draft.name}
              onChangeText={(t) => setField('name', t)}
              placeholder="mis. KPR, Netflix, SPP Nonik"
              placeholderTextColor={colors.textMuted}
              style={styles.recInput}
            />

            <Text style={styles.label}>Tipe</Text>
            <SegmentTabs
              value={draft.txType}
              onChange={(v) => {
                const t = v as TxType;
                // Seed transfer defaults on switch so the form is valid
                // without extra taps. Toggle to expense/income clears the
                // transfer-only fields at save time.
                setField('txType', t);
                if (t === 'transfer' && !draft.fromSource) {
                  setField('fromSource', picSources[0]?.id);
                  setField('toSource', picSources.find((s) => s.id !== picSources[0]?.id)?.id);
                }
              }}
              options={[
                { id: 'expense', label: 'Keluar', icon: 'arrow-up-circle', activeIconColor: colors.danger },
                { id: 'income', label: 'Masuk', icon: 'arrow-down-circle', activeIconColor: colors.success },
                { id: 'transfer', label: 'Transfer', icon: 'swap-horizontal', activeIconColor: colors.primary },
              ]}
            />

            <Text style={styles.label}>PIC (yang bayar & terima notifikasi)</Text>
            <View style={styles.chipWrap}>
              {(['both', 'rosi', 'rizal'] as const).map((p) => {
                const active = draft.pic === p;
                // No emoji in the label — emoji glyphs render taller than
                // plain text and push the chip height above the other
                // rows. Use the same chipDot pattern as Untuk Siapa so all
                // chips land at the same height.
                const label = p === 'both' ? 'Rosi + Rizal' : p === 'rosi' ? 'Rosi' : 'Rizal';
                const color = p === 'both' ? colors.primary : p === 'rosi' ? WHO[0].color : WHO[1].color;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setField('pic', p)}
                    style={[styles.chip, { borderColor: active ? color : colors.border, backgroundColor: active ? color + '18' : colors.card }]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: color }]} />
                    <Text style={[styles.chipText, active && { color }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isTransfer ? (
              <>
                <Text style={styles.label}>Dari</Text>
                <View style={styles.chipWrap}>
                  {picSources.map((s) => {
                    const active = draft.fromSource === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setField('fromSource', s.id)}
                        style={[styles.chip, { borderColor: active ? s.color : colors.border, backgroundColor: active ? s.color + '18' : colors.card }]}
                      >
                        <Ionicons name={s.icon as any} size={14} color={s.color} />
                        <Text style={[styles.chipText, active && { color: s.color }]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Ke</Text>
                <View style={styles.chipWrap}>
                  {picSources.filter((s) => s.id !== draft.fromSource).map((s) => {
                    const active = draft.toSource === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setField('toSource', s.id)}
                        style={[styles.chip, { borderColor: active ? s.color : colors.border, backgroundColor: active ? s.color + '18' : colors.card }]}
                      >
                        <Ionicons name={s.icon as any} size={14} color={s.color} />
                        <Text style={[styles.chipText, active && { color: s.color }]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Jumlah Transfer</Text>
                <TextInput
                  value={draft.transferAmount ? formatAmountInput(String(Math.round(draft.transferAmount))) : ''}
                  onChangeText={(t) => {
                    const n = parseAmountInput(formatAmountInput(t));
                    setField('transferAmount', n > 0 ? n : undefined);
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={styles.recInput}
                />

                <Text style={styles.label}>Biaya / Pajak Transaksi (opsional)</Text>
                <TextInput
                  value={draft.transferFee ? formatAmountInput(String(Math.round(draft.transferFee))) : ''}
                  onChangeText={(t) => {
                    const n = parseAmountInput(formatAmountInput(t));
                    setField('transferFee', n > 0 ? n : undefined);
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={styles.recInput}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Kategori</Text>
                <View style={styles.chipWrap}>
                  {isIncome
                    ? PICKABLE_INCOME_CATEGORIES.map((id) => {
                        const c = INCOME_CATEGORY_MAP[id];
                        const active = draft.incomeCategory === id;
                        return (
                          <TouchableOpacity
                            key={id}
                            onPress={() => setField('incomeCategory', id)}
                            style={[styles.chip, { borderColor: active ? c.color : colors.border, backgroundColor: active ? c.color + '18' : colors.card }]}
                          >
                            <Ionicons name={c.icon as any} size={14} color={c.color} />
                            <Text style={[styles.chipText, active && { color: c.color }]}>{c.label}</Text>
                          </TouchableOpacity>
                        );
                      })
                    : PICKABLE_CATEGORIES.map((id) => {
                        const c = CATEGORY_MAP[id];
                        const active = draft.category === id;
                        return (
                          <TouchableOpacity
                            key={id}
                            onPress={() => setField('category', id)}
                            style={[styles.chip, { borderColor: active ? c.color : colors.border, backgroundColor: active ? c.color + '18' : colors.card }]}
                          >
                            <CatIcon name={c.icon} set={c.iconSet} size={14} color={c.color} />
                            <Text style={[styles.chipText, active && { color: c.color }]}>{c.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                </View>

                <Text style={styles.label}>Jumlah (opsional)</Text>
                <TextInput
                  value={draft.amount ? formatAmountInput(String(Math.round(draft.amount))) : ''}
                  onChangeText={(t) => {
                    const n = parseAmountInput(formatAmountInput(t));
                    setField('amount', n > 0 ? n : undefined);
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={styles.recInput}
                />

                <Text style={styles.label}>Untuk Siapa (opsional)</Text>
                <View style={styles.chipWrap}>
                  {WHO.map((w) => {
                    const active = draft.who === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        onPress={() => setField('who', active ? undefined : w.id)}
                        style={[styles.chip, { borderColor: active ? w.color : colors.border, backgroundColor: active ? w.color + '18' : colors.card }]}
                      >
                        <View style={[styles.chipDot, { backgroundColor: w.color }]} />
                        <Text style={[styles.chipText, active && { color: w.color }]}>{w.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Sumber Dana (opsional)</Text>
                <View style={styles.chipWrap}>
                  {picSources.map((s) => {
                    const active = draft.source === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setField('source', active ? undefined : s.id)}
                        style={[styles.chip, { borderColor: active ? s.color : colors.border, backgroundColor: active ? s.color + '18' : colors.card }]}
                      >
                        <Ionicons name={s.icon as any} size={14} color={s.color} />
                        <Text style={[styles.chipText, active && { color: s.color }]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.label}>Frekuensi</Text>
            <SegmentTabs
              value={String(draft.intervalMonths)}
              onChange={(v) => setField('intervalMonths', (v === '3' ? 3 : 1) as 1 | 3)}
              options={[
                { id: '1', label: 'Bulanan' },
                { id: '3', label: 'Per 3 Bulan' },
              ]}
            />

            <Text style={styles.label}>Tanggal (1–31)</Text>
            <TextInput
              value={String(draft.dayOfMonth)}
              onChangeText={(t) => {
                const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                setField('dayOfMonth', Math.min(31, Math.max(1, isNaN(n) ? 1 : n)));
              }}
              keyboardType="number-pad"
              style={styles.recInput}
            />

            {draft.intervalMonths === 3 ? (
              <>
                <Text style={styles.label}>Anchor bulan (untuk siklus 3-bulanan)</Text>
                <View style={styles.chipWrap}>
                  {[1, 2, 3].map((m) => {
                    const active = (draft.anchorMonth ?? 1) === m;
                    const monthName = ['Jan/Apr/Jul/Okt', 'Feb/Mei/Agu/Nov', 'Mar/Jun/Sep/Des'][m - 1];
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setField('anchorMonth', m)}
                        style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.card }]}
                      >
                        <Text style={[styles.chipText, active && { color: colors.primary }]}>{monthName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <TouchableOpacity
              onPress={() => setField('enabled', !draft.enabled)}
              style={[styles.enabledRow, draft.enabled && styles.enabledRowOn]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={draft.enabled ? 'notifications' : 'notifications-off-outline'}
                size={18}
                color={draft.enabled ? colors.primary : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.enabledTitle, draft.enabled && { color: colors.primary }]}>
                  Notifikasi tanggal jatuh tempo
                </Text>
                <Text style={styles.enabledSub}>
                  Kirim ke {draft.pic === 'both' ? 'Rosi + Rizal' : draft.pic === 'rosi' ? 'Rosi' : 'Rizal'} jam 09:00, "Transaksi Rutin: {draft.name || '<nama>'}"
                </Text>
              </View>
              <View style={[styles.switchTrack, draft.enabled && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, draft.enabled && styles.switchThumbOn]} />
              </View>
            </TouchableOpacity>

            <View style={{ height: spacing.md }} />
            <PrimaryButton
              label={isNew ? 'Simpan' : 'Simpan Perubahan'}
              icon="checkmark"
              onPress={() => isValid && onSave(draft)}
              disabled={!isValid}
            />
            {!isNew ? (
              <TouchableOpacity onPress={() => onDelete(draft)} style={styles.recDeleteBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.recDeleteText}>Hapus Transaksi Rutin</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 20, textAlign: 'center' },
  recCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  recCardUnpaid: { borderColor: colors.warning, backgroundColor: colors.warning + '11' },
  recHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  recTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recName: { fontSize: 15, fontWeight: '800', color: colors.text, flexShrink: 1 },
  recMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  recStatus: { fontSize: 12, fontWeight: '700', flex: 1 },
  recActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bellBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  payText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  addRecBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  addRecText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  recSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    maxHeight: '90%',
  },
  recModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  recModalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6, marginTop: spacing.lg },
  recInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
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
  enabledRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg,
  },
  enabledRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  enabledTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  enabledSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  switchTrack: {
    width: 46, height: 28, borderRadius: 14,
    backgroundColor: colors.border, padding: 3, justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: colors.primary },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  switchThumbOn: { alignSelf: 'flex-end' },
  recDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing.md,
  },
  recDeleteText: { fontSize: 14, fontWeight: '700', color: colors.danger },
});
