import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Card, GridBg, PrimaryButton, SectionTitle } from '../components/ui';
import { useBudget } from '../store/BudgetContext';
import {
  creditCardStatus,
  pendingReimbursements,
  reimbursementOutstanding,
  sourceBalances,
  totalBalance,
} from '../store/selectors';
import { pullFromSheet, pushToSheet } from '../sync/sheets';
import { colors, fill, radius, sourceOf, SOURCES, spacing, whoOf } from '../theme';
import { SourceId } from '../types';
import { formatCurrency, formatDateShort } from '../utils/format';

export default function BalancesScreen() {
  const insets = useSafeAreaInsets();
  const {
    transactions,
    openingBalances,
    creditCard,
    setOpeningBalance,
    setCreditCard,
    updateTransaction,
    syncData,
    syncConfig,
    setSyncConfig,
    replaceData,
  } = useBudget();

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
  const cc = useMemo(() => creditCardStatus(transactions, creditCard), [transactions, creditCard]);

  const [editing, setEditing] = useState<SourceId | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const openEditor = (s: SourceId) => {
    setEditing(s);
    setDraftValue(String(openingBalances[s] ?? 0));
  };
  const saveEditor = () => {
    if (editing) {
      const n = parseFloat(draftValue.replace(/[^0-9.]/g, ''));
      setOpeningBalance(editing, Number.isFinite(n) ? n : 0);
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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // Pick up the persisted config once it loads from storage.
  useEffect(() => {
    setUrl(syncConfig.url);
    setToken(syncConfig.token);
  }, [syncConfig.url, syncConfig.token]);

  const onPush = async () => {
    setBusy(true);
    setStatus('Mengirim ke Google Sheet…');
    setSyncConfig({ url, token });
    try {
      const { count } = await pushToSheet({ url, token }, syncData);
      const at = Date.now();
      setSyncConfig({ lastSyncedAt: at });
      setStatus(`Tersinkron — ${count} transaksi terkirim.`);
    } catch (e: any) {
      setStatus(`Gagal: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const onPull = () => {
    Alert.alert(
      'Tarik dari Sheet',
      'Ini akan mengganti seluruh data di HP ini dengan data dari Google Sheet. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tarik & ganti',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setStatus('Menarik dari Google Sheet…');
            setSyncConfig({ url, token });
            try {
              const data = await pullFromSheet({ url, token });
              replaceData(data);
              setStatus(`Berhasil — ${data.transactions.length} transaksi dimuat.`);
            } catch (e: any) {
              setStatus(`Gagal: ${e.message ?? e}`);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <GridBg />
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
        <View style={styles.ownerToggle}>
          {(['all', 'rosi', 'rizal'] as const).map((o) => (
            <TouchableOpacity
              key={o}
              onPress={() => setOwnerFilter(o)}
              style={[styles.ownerBtn, ownerFilter === o && styles.ownerActive]}
            >
              <Text style={[styles.ownerText, ownerFilter === o && styles.ownerTextActive]}>
                {o === 'all' ? 'Semua' : o === 'rosi' ? '👩 Rosi' : '👨 Rizal'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total balance */}
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total saldo{ownerFilter !== 'all' ? ` · ${ownerFilter === 'rosi' ? 'Rosi' : 'Rizal'}` : ''}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          <Text style={styles.totalCaption}>di {shownBalances.length} sumber dana</Text>
        </Card>

        {/* Credit card bill */}
        <Card style={styles.ccCard}>
          <View style={styles.ccHead}>
            <View style={styles.ccTitleRow}>
              <Ionicons name="card" size={18} color={colors.primary} />
              <Text style={styles.ccTitle}>Tagihan Kartu Kredit</Text>
            </View>
            <Text style={styles.ccPaySrc}>bayar dari {sourceOf(creditCard.paymentSource).label}</Text>
          </View>
          <Text style={styles.ccOutstanding}>{formatCurrency(cc.outstanding)}</Text>
          {cc.outstanding > 0 ? (
            <Text style={styles.ccDue}>
              {formatCurrency(cc.dueNext)} jatuh tempo {formatDateShort(cc.nextDue)}
            </Text>
          ) : (
            <Text style={styles.ccDue}>Tidak ada tagihan berjalan 🎉</Text>
          )}
        </Card>

        {/* Pending reimbursements */}
        {pending.length > 0 ? (
          <Card style={styles.reimCard}>
            <View style={styles.ccHead}>
              <View style={styles.ccTitleRow}>
                <Ionicons name="repeat" size={18} color={colors.accent} />
                <Text style={styles.ccTitle}>Menunggu Reimburse</Text>
              </View>
              <Text style={styles.reimTotal}>{formatCurrency(pendingTotal)}</Text>
            </View>
            {pending.map((t) => (
              <View key={t.id} style={styles.reimRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reimMerchant} numberOfLines={1}>{t.merchant}</Text>
                  <Text style={styles.reimMeta}>{formatCurrency(t.amount)} · {formatDateShort(t.date)}</Text>
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
        <Card style={{ marginBottom: spacing.xl }}>
          {shownBalances.map((b, i) => {
            const src = sourceOf(b.source);
            return (
              <TouchableOpacity
                key={b.source}
                activeOpacity={0.7}
                onPress={() => openEditor(b.source)}
                style={[styles.srcRow, i === 0 && { marginTop: 0 }]}
              >
                <View style={[styles.srcIcon, { backgroundColor: src.color + '22' }]}>
                  <Ionicons name={src.icon as any} size={18} color={src.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.srcLabel}>{whoOf(src.owner).emoji} {src.label}</Text>
                  <Text style={styles.srcOpening}>Saldo awal {formatCurrency(openingBalances[b.source] ?? 0)}</Text>
                </View>
                <Text style={[styles.srcBalance, b.balance < 0 && { color: colors.danger }]}>
                  {formatCurrency(b.balance)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Credit card settings */}
        <SectionTitle>Pengaturan Kartu Kredit</SectionTitle>
        <Card>
          <Text style={styles.settingLabel}>Dibayar dari</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {SOURCES.map((s) => {
              const active = creditCard.paymentSource === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.8}
                  onPress={() => setCreditCard({ paymentSource: s.id })}
                  style={[styles.payChip, { borderColor: active ? s.color : colors.border, backgroundColor: active ? s.color + '18' : colors.card }]}
                >
                  <Ionicons name={s.icon as any} size={14} color={s.color} />
                  <Text style={[styles.payChipText, active && { color: s.color }]}>{whoOf(s.owner).emoji} {s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

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
        <View style={{ height: spacing.xl }} />
        <SectionTitle>Sinkronisasi Google Sheet</SectionTitle>
        <Card style={{ marginTop: 0 }}>
          <Text style={styles.settingHint}>
            Tempel URL Web App (Apps Script) dan token rahasiamu. Data kamu yang
            jadi acuan — tombol Sinkronkan mengirim semuanya ke Sheet.
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

          {status ? (
            <View style={styles.syncStatus}>
              {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              <Text style={styles.syncStatusText}>{status}</Text>
            </View>
          ) : syncConfig.lastSyncedAt ? (
            <Text style={styles.syncMeta}>
              Terakhir sinkron {formatDateShort(new Date(syncConfig.lastSyncedAt).toISOString().slice(0, 10))}
            </Text>
          ) : null}

          <View style={{ height: spacing.md }} />
          <PrimaryButton
            label="Sinkronkan ke Sheet"
            icon="cloud-upload"
            onPress={onPush}
            disabled={busy || !url}
          />
          <TouchableOpacity onPress={onPull} disabled={busy || !url} style={styles.pullBtn}>
            <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
            <Text style={styles.pullText}>Tarik dari Sheet (ganti data lokal)</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Opening balance editor */}
      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setEditing(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Text style={styles.sheetTitle}>Saldo awal {editing ? sourceOf(editing).label : ''}</Text>
            <Text style={styles.sheetSub}>Saldo pembuka dipakai untuk menghitung saldo berjalan.</Text>
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
  ownerToggle: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  ownerBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  ownerActive: { backgroundColor: colors.card },
  ownerText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  ownerTextActive: { color: colors.primary },
  totalCard: { backgroundColor: colors.primary, borderColor: colors.primary, marginBottom: spacing.md },
  totalLabel: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
  totalValue: { color: colors.white, fontSize: 32, fontWeight: '800', marginTop: 2 },
  totalCaption: { color: colors.onPrimary, fontSize: 12, marginTop: 4 },
  ccCard: { marginBottom: spacing.xl },
  ccHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ccTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ccTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  ccPaySrc: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  ccOutstanding: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  ccDue: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  reimCard: { marginBottom: spacing.xl },
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
  srcBalance: { fontSize: 15, fontWeight: '800', color: colors.text },
  settingLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
  payChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  payChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
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
