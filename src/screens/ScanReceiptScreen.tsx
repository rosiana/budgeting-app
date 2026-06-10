import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WhoId } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/ui';
import { guessCategory } from '../ocr/parseReceipt';
import { recognizeReceipt } from '../ocr/recognize';
import { RootStackParamList } from '../navigation/types';
import { colors, fill, radius, spacing } from '../theme';
import { todayISO } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ScanReceipt'>;

const DEFAULT_WHO: WhoId = Platform.OS === 'ios' ? 'rosi' : 'rizal';

export default function ScanReceiptScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const process = async (uri: string) => {
    setBusy(true);
    setStatus('Membaca struk…');
    try {
      const parsed = await recognizeReceipt(uri);
      const category = guessCategory(
        `${parsed.merchant ?? ''} ${parsed.rawText}`
      );
      navigation.replace('AddTransaction', {
        draft: {
          merchant: parsed.merchant,
          amount: parsed.total,
          date: parsed.date ?? todayISO(),
          category,
          who: DEFAULT_WHO,
          source: 'bca',
          items: parsed.items,
          scanned: true,
        },
      });
    } catch (e) {
      console.warn('OCR failed', e);
      setStatus('Gagal membaca struk. Coba lagi atau isi manual.');
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setStatus('Mengambil foto…');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) await process(photo.uri);
      else setBusy(false);
    } catch (e) {
      console.warn('capture failed', e);
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      await process(res.assets[0].uri);
    }
  };

  // --- Permission gate -----------------------------------------------------
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <Ionicons name="camera-outline" size={56} color={colors.primary} />
        <Text style={styles.permTitle}>Butuh akses kamera</Text>
        <Text style={styles.permText}>
          Izinkan akses kamera untuk scan struk. Semua diproses di HP-mu — foto
          tidak pernah dikirim ke mana pun.
        </Text>
        <View style={{ height: spacing.lg }} />
        <PrimaryButton label="Izinkan kamera" icon="camera" onPress={requestPermission} />
        <TouchableOpacity onPress={pickFromLibrary} style={{ marginTop: spacing.lg }}>
          <Text style={styles.linkText}>Atau pilih dari galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          <Text style={styles.muted}>Batal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Camera --------------------------------------------------------------
  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Framing guide */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>Posisikan struk di dalam bingkai</Text>
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan Struk</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Busy overlay */}
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.white} size="large" />
          <Text style={styles.busyText}>{status}</Text>
        </View>
      ) : null}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        {status && !busy ? <Text style={styles.errorText}>{status}</Text> : null}
        <View style={styles.controlRow}>
          <TouchableOpacity onPress={pickFromLibrary} style={styles.sideBtn} disabled={busy}>
            <Ionicons name="images-outline" size={26} color={colors.white} />
            <Text style={styles.sideLabel}>Galeri</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={capture} style={styles.shutter} disabled={busy}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.replace('AddTransaction')}
            style={styles.sideBtn}
            disabled={busy}
          >
            <Ionicons name="create-outline" size={26} color={colors.white} />
            <Text style={styles.sideLabel}>Manual</Text>
          </TouchableOpacity>
          {/* "Manual" keeps the English-friendly word commonly used in ID UIs */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  permTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.lg },
  permText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.textMuted, fontWeight: '600' },
  overlay: { ...fill, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '78%',
    height: '52%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.lg,
    borderStyle: 'dashed',
  },
  hint: { color: colors.white, marginTop: spacing.lg, fontSize: 14, fontWeight: '600' },
  topBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  busy: { ...fill, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  busyText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.lg },
  errorText: { color: '#FFD9D6', textAlign: 'center', marginBottom: spacing.md, paddingHorizontal: spacing.xl, fontWeight: '600' },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  sideBtn: { alignItems: 'center', gap: 4, width: 64 },
  sideLabel: { color: colors.white, fontSize: 12, fontWeight: '600' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
});
