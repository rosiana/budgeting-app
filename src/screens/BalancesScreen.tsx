import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, GridBg, PrimaryButton, PrivacyEye, SectionTitle, SegmentTabs } from '../components/ui';
import { useBudget } from '../store/BudgetContext';
import {
  creditCardStatus,
  pendingReimbursements,
  reimbursementOutstanding,
  sourceBalances,
  totalBalance,
} from '../store/selectors';
import { colors, DEVICE_PERSON, fill, INVESTMENT_SOURCES, radius, sourceOf, SOURCES, spacing, whoOf } from '../theme';
import { SourceId } from '../types';
import { formatCurrency, formatDateShort, todayISO } from '../utils/format';
import { formatAmountInput, parseAmountInput, useMoney } from '../utils/money';

export default function BalancesScreen() {
  const insets = useSafeAreaInsets();
  const {
    transactions,
    openingBalances,
    creditCard,
    addTransaction,
    setCreditCard,
    updateTransaction,
    syncConfig,
    setSyncConfig,
    syncStatus,
    syncError,
    syncNow,
  } = useBudget();
  const money = useMoney();

  const pending = useMemo(() => pendingReimbursements(transactions), [transactions]);
  const pendingTotal = useMemo(() => reimbursementOutstanding(transactions), [transactions]);

  const balances = useMemo(
    () => sourceBalances(transactions, openingBalances, creditCard),
    [transactions, openingBalances, creditCard]
  );
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'rosi' | 'rizal'>('all');
  const shownBalances = useMemo(
    () =>
      ownerFilter === 'all'
        ? balances
        : balances.filter((b) => sourceOf(b.source).owner === ownerFilter),
    [balances, ownerFilter]
  );
  const total = totalBalance(shownBalances);

  // Display rows: per-account, but in "Semua" the shared-label wallets
  // (ShopeePay/GoPay/Tunai) are merged into one row summing Rosi + Rizal.
  const displayRows = useMemo(() => {
    type Row = {
      key: string;
      label: string;
      icon: string;
      color: string;
      balance: number;
      opening: number;
      sources: SourceId[];
    };
    if (ownerFilter !== 'all') {
      return shownBalances.map((b): Row => {
        const s = sourceOf(b.source);
        return {
          key: b.source,
          label: s.label,
          icon: s.icon,
          color: s.color,
          balance: b.balance,
          opening: openingBalances[b.source] ?? 0,
          sources: [b.source],
        };
      });
    }
    const map = new Map<string, Row>();
    for (const b of shownBalances) {
      const s = sourceOf(b.source);
      const ex = map.get(s.label);
      const opening = openingBalances[b.source] ?? 0;
      if (ex) {
        ex.balance += b.balance;
        ex.opening += opening;
        ex.sources.push(b.source);
      } else {
        map.set(s.label, {
          key: s.label,
          label: s.label,
          icon: s.icon,
          color: s.color,
          balance: b.balance,
          opening,
          sources: [b.source],
        });
      }
    }
    return [...map.values()];
  }, [shownBalances, ownerFilter, openingBalances]);

  const cc = useMemo(() => creditCardStatus(transactions, creditCard), [transactions, creditCard]);

  const [editing, setEditing] = useState<SourceId | null>(null);
  const [draftValue, setDraftValue] = useState('');

  // Current running balance for a single source, used to compute the delta.
  const balanceOf = (s: SourceId): number =>
    balances.find((b) => b.source === s)?.balance ?? 0;

  const openEditor = (s: SourceId) => {
    setEditing(s);
    setDraftValue(formatAmountInput(String(Math.round(balanceOf(s)))));
  };
  const saveEditor = () => {
    if (editing) {
      const target = parseAmountInput(draftValue);
      const current = balanceOf(editing);
      const delta = target - current;
      if (Math.abs(delta) >= 1) {
        // Adjustment is recorded as a transaction so the sync model stays clean.
        // For investment accounts (Bibit/Ajaib/Tring), route up to Untung
        // Investasi and down to Rugi Investasi instead of generic Penyesuaian.
        const isUp = delta > 0;
        const isInvestment = INVESTMENT_SOURCES.includes(editing);
        const label = sourceOf(editing).label;
        addTransaction({
          type: isUp ? 'income' : 'expense',
          date: todayISO(),
          merchant: isInvestment
            ? `${isUp ? 'Untung' : 'Rugi'} Investasi ${label}`
            : `Penyesuaian ${label}`,
          amount: Math.abs(Math.round(delta)),
          category: isUp
            ? 'lainnya'
            : isInvestment
              ? 'rugi_investasi'
              : 'penyesuaian_saldo',
          incomeCategory: isUp
            ? isInvestment
              ? 'investasi'
              : 'penyesuaian_saldo_in'
            : undefined,
          who: DEVICE_PERSON,
          source: editing,
        });
      }
    }
    setEditing(null);
  };

  const stepDay = (key: 'statementDay' | 'dueDay', delta: number) => {
    const next = Math.min(28, Math.max(1, creditCard[key] + delta));
    setCreditCard({ [key]: next });
  };

  // --- Google Sheet sync ---
  const [url, setUrl] = useState(syncConfig.url);
  const [token, setToken] = useState(syncConfig.token);

  // Pick up the persisted config once it loads from storage.
  useEffect(() => {
    setUrl(syncConfig.url);
    setToken(syncConfig.token);
  }, [syncConfig.url, syncConfig.token]);

  const saveAndSync = async () => {
    setSyncConfig({ url: url.trim(), token: token.trim() });
    // Wait a tick so the new config is in state before syncing.
    setTimeout(() => syncNow(), 50);
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
        <Text style={styles.title}>Saldo</Text>

        {/* Owner filter */}
        <View style={{ marginBottom: spacing.lg }}>
          <SegmentTabs
            value={ownerFilter}
            onChange={(v) => setOwnerFilter(v as 'all' | 'rosi' | 'rizal')}
            options={[
              { id: 'all', label: '🌳 Bersama' },
              { id: 'rosi', label: '🎀 Rosi' },
              { id: 'rizal', label: '🕶️ Rizal' },
            ]}
          />
        </View>

        {/* Total balance */}
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>
            {ownerFilter === 'all'
              ? 'Total saldo bersama'
              : `Total saldo ${ownerFilter === 'rosi' ? 'Rosi' : 'Rizal'}`}
          </Text>
          <Text style={styles.totalValue}>{money(total)}</Text>
          <Text style={styles.totalCaption}>di {shownBalances.length} sumber dana</Text>
        </Card>

        {/* Pending reimbursements */}
        {pending.length > 0 ? (
          <Card style={styles.reimCard}>
            <View style={styles.ccHead}>
              <View style={styles.ccTitleRow}>
                <Ionicons name="repeat" size={18} color={colors.accent} />
                <Text style={styles.ccTitle}>Menunggu Reimburse</Text>
              </View>
              <Text style={styles.reimTotal}>{money(pendingTotal)}</Text>
            </View>
            {pending.map((t) => (
              <View key={t.id} style={styles.reimRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reimMerchant} numberOfLines={1}>{t.merchant}</Text>
                  <Text style={styles.reimMeta}>{money(t.amount)} · {formatDateShort(t.date)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => updateTransaction({ ...t, reimbursed: true })}
                  style={styles.reimBtn}
                >
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                  <Text style={styles.reimBtnText}>Lunas</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Per-source balances */}
        <SectionTitle>Per Sumber Dana</SectionTitle>
        <Text style={styles.tipText}>Ketuk rekening untuk menyesuaikan saldo.</Text>
        <Card>
          {displayRows.map((row, i) => {
            const single = row.sources.length === 1;
            return (
              <TouchableOpacity
                key={row.key}
                activeOpacity={single ? 0.7 : 1}
                onPress={() => single && openEditor(row.sources[0])}
                style={[styles.srcRow, i === 0 && { marginTop: 0 }]}
              >
                <View style={[styles.srcIcon, { backgroundColor: row.color + '22' }]}>
                  <Ionicons name={row.icon as any} size={18} color={row.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.srcLabel}>{row.label}</Text>
                  {!single ? (
                    <Text style={styles.srcOpening}>Rosi + Rizal</Text>
                  ) : null}
                </View>
                <Text style={[styles.srcBalance, row.balance < 0 && { color: colors.danger }]}>
                  {money(row.balance)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Credit card — current bill + settings, combined */}
        <SectionTitle>Kartu Kredit</SectionTitle>
        <Card>
          {/* Current outstanding bill, at the top of the same card. */}
          <View style={styles.kkBillRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kkBillLabel}>Tagihan berjalan</Text>
              <Text style={styles.kkBillAmount}>{money(cc.outstanding)}</Text>
              <Text style={styles.kkBillSub}>
                {cc.outstanding > 0
                  ? `Jatuh tempo ${formatDateShort(cc.nextDue)}`
                  : 'Tidak ada tagihan berjalan 🎉'}
              </Text>
            </View>
          </View>

          <View style={styles.paySrcRow}>
            <Ionicons name="card" size={16} color={colors.primary} />
            <Text style={styles.paySrcText}>Dibayar dari BCA</Text>
          </View>

          <DayStepper
            label="Tanggal cetak (cutoff)"
            value={creditCard.statementDay}
            onMinus={() => stepDay('statementDay', -1)}
            onPlus={() => stepDay('statementDay', 1)}
          />
          <DayStepper
            label="Tanggal jatuh tempo"
            value={creditCard.dueDay}
            onMinus={() => stepDay('dueDay', -1)}
            onPlus={() => stepDay('dueDay', 1)}
          />
          <Text style={styles.settingHint}>
            Belanja kartu kredit memotong saldo {sourceOf(creditCard.paymentSource).label} saat
            jatuh tempo, bukan saat dicatat.
          </Text>
        </Card>

        {/* Google Sheet sync */}
        <SectionTitle>Sinkronisasi Google Sheet</SectionTitle>
        <Card style={{ marginTop: 0 }}>
          <Text style={styles.settingHint}>
            Setelah URL + token diisi, MoMoney akan **otomatis** sinkron
            (gabungan dua arah) setiap kali ada perubahan di HP manapun.
          </Text>

          <Text style={styles.syncLabel}>URL Web App</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://script.google.com/macros/s/…/exec"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.syncInput}
          />

          <Text style={styles.syncLabel}>Token rahasia</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="token yang sama dengan di Code.gs"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.syncInput}
          />

          <View style={styles.syncStatus}>
            {syncStatus === 'syncing' ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.syncStatusText}>Menyinkronkan…</Text>
              </>
            ) : syncStatus === 'error' ? (
              <>
                <Ionicons name="warning" size={16} color={colors.danger} />
                <Text style={[styles.syncStatusText, { color: colors.danger }]} numberOfLines={2}>
                  Gagal sinkron: {syncError}
                </Text>
              </>
            ) : syncStatus === 'synced' || syncConfig.lastSyncedAt ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.syncStatusText}>
                  Tersinkron{syncConfig.lastSyncedAt
                    ? ` · ${formatDateShort(new Date(syncConfig.lastSyncedAt).toISOString().slice(0, 10))}`
                    : ''}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
                <Text style={styles.syncStatusText}>Belum tersinkron</Text>
              </>
            )}
          </View>

          <View style={{ height: spacing.md }} />
          <PrimaryButton
            label="Simpan & sinkron sekarang"
            icon="sync"
            onPress={saveAndSync}
            disabled={syncStatus === 'syncing' || !url}
          />
        </Card>

      </ScrollView>

      {/* Balance adjustment editor */}
      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setEditing(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Text style={styles.sheetTitle}>Sesuaikan Saldo {editing ? sourceOf(editing).label : ''}</Text>
            <Text style={styles.sheetSub}>
              Selisihnya dicatat sebagai transaksi "Penyesuaian Saldo" (pemasukan
              atau pengeluaran).
            </Text>
            <View style={styles.inputRow}>
              <Text style={styles.currency}>Rp</Text>
              <TextInput
                value={draftValue}
                onChangeText={(t) => setDraftValue(formatAmountInput(t))}
                keyboardType="number-pad"
                placeholder="0"
                autoFocus
                style={styles.input}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <PrimaryButton label="Simpan" onPress={saveEditor} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DayStepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity onPress={onMinus} style={styles.stepBtn}>
          <Ionicons name="remove" size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity onPress={onPlus} style={styles.stepBtn}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  _unusedOwnerToggle: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  ownerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  ownerActive: { backgroundColor: colors.card },
  ownerText: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: colors.textMuted },
  ownerTextActive: { color: colors.primary },
  totalCard: { backgroundColor: colors.primary, borderColor: colors.primary, marginBottom: spacing.md },
  totalLabel: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
  totalValue: { color: colors.white, fontSize: 32, fontWeight: '800', marginTop: 2 },
  totalCaption: { color: colors.onPrimary, fontSize: 12, marginTop: 4 },
  ccCard: {},
  ccHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ccTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ccTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  ccPaySrc: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  ccOutstanding: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  ccDue: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  reimCard: {},
  reimTotal: { fontSize: 16, fontWeight: '800', color: colors.accent },
  reimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reimMerchant: { fontSize: 14, fontWeight: '700', color: colors.text },
  reimMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1, fontWeight: '600' },
  reimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  reimBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  srcIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  srcLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  srcOpening: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  tipText: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md, marginTop: -spacing.sm },
  srcBalance: { fontSize: 15, fontWeight: '800', color: colors.text },
  settingLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  kkBillRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  kkBillLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  kkBillAmount: { fontSize: 22, color: colors.text, fontWeight: '800', marginTop: 2 },
  kkBillSub: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  paySrcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  paySrcText: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  dangerHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: spacing.md },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  resetBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  stepperLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 16, fontWeight: '800', color: colors.text, minWidth: 24, textAlign: 'center' },
  settingHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, lineHeight: 17 },
  syncLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: spacing.md, marginBottom: 6 },
  syncInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
  },
  syncStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  syncStatusText: { flex: 1, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  syncMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, fontWeight: '600' },
  pullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md, padding: spacing.sm },
  pullText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
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
  input: { flex: 1, fontSize: 26, fontWeight: '800', color: colors.text, paddingVertical: spacing.md, marginLeft: 6 },
});
