import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { Text, TextInput } from './typography';
import { useBudget } from '../store/BudgetContext';
import { colors, fill, radius, spacing } from '../theme';
import { IconSet } from '../types';

/**
 * Pill-shaped segmented tabs used across the app (Saldo owner toggle, Transaksi
 * mode tabs, Add-Transfer person picker, etc.) so every group has identical
 * height and typography.
 */
export interface SegmentOption {
  id: string;
  label: string;
  /** Optional Ionicons name shown left of the label when this tab is active. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Tint for the active icon (text always uses the primary color). */
  activeIconColor?: string;
}

export function SegmentTabs({
  options,
  value,
  onChange,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.segmentRoot}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.segmentBtn, active && styles.segmentActive]}
            activeOpacity={0.8}
          >
            {active && o.icon ? (
              <Ionicons
                name={o.icon}
                size={14}
                color={o.activeIconColor ?? colors.primary}
                style={{ marginRight: 4 }}
              />
            ) : null}
            <Text
              style={[styles.segmentText, active && styles.segmentActiveText]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Floating eye toggle that masks/unmasks every amount across the app. Drop it
 * into each screen so the visibility control is reachable from anywhere.
 *
 * Lives in the top-right of the screen, just below the status bar safe area.
 */
export function PrivacyEye({ topOffset = 0 }: { topOffset?: number }) {
  const { privacyMode, setPrivacyMode } = useBudget();
  return (
    <TouchableOpacity
      onPress={() => setPrivacyMode(!privacyMode)}
      hitSlop={10}
      style={[styles.privacyEye, { top: topOffset + spacing.md }]}
    >
      <Ionicons
        name={privacyMode ? 'eye-off' : 'eye'}
        size={20}
        color={colors.primary}
      />
    </TouchableOpacity>
  );
}

/**
 * Subtle tiled brown grid behind a screen's content. Rendered as an SVG
 * pattern so the spacing is consistent across iOS and Android (an
 * `ImageBackground` repeat-tile renders at different densities on each
 * platform and looked much tighter on Android).
 */
export function GridBg() {
  const C = '#7A5538';
  const OPACITY = 0.09;
  const S = 56; // tile size in logical points
  return (
    <View style={fill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="momoneyGrid" x="0" y="0" width={S} height={S} patternUnits="userSpaceOnUse">
            <Path d={`M0 0.75 H${S} M0.75 0 V${S}`} stroke={C} strokeWidth={1.2} opacity={OPACITY} />
            <Circle cx={S / 2} cy={S / 2} r={1.4} fill={C} opacity={OPACITY} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#momoneyGrid)" />
      </Svg>
    </View>
  );
}

/** Renders a category icon from the right font (Ionicons or MaterialCommunity). */
export function CatIcon({
  name,
  set = 'ion',
  size,
  color,
}: {
  name: string;
  set?: IconSet;
  size: number;
  color: string;
}) {
  if (set === 'mci') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Pill({
  label,
  icon,
  color = colors.primary,
  active = false,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.pill,
        { borderColor: active ? color : colors.border, backgroundColor: active ? color : colors.card },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={active ? colors.white : color}
          style={{ marginRight: 5 }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.pillText, { color: active ? colors.white : colors.text }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  style,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, disabled && { opacity: 0.5 }, style]}
    >
      {icon ? (
        <Ionicons name={icon} size={18} color={colors.white} style={{ marginRight: 8 }} />
      ) : null}
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ProgressBar({
  pct,
  color,
  track = colors.border,
  height = 8,
}: {
  pct: number; // 0..1+
  color: string;
  track?: string;
  height?: number;
}) {
  const over = pct > 1;
  const width = `${Math.min(pct, 1) * 100}%` as const;
  return (
    <View style={[styles.track, { backgroundColor: track, height, borderRadius: height }]}>
      <View
        style={{
          width,
          height,
          borderRadius: height,
          backgroundColor: over ? colors.danger : color,
        }}
      />
    </View>
  );
}

export function IconCircle({
  icon,
  iconSet = 'ion',
  color,
  size = 40,
}: {
  icon: string;
  iconSet?: IconSet;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CatIcon name={icon} set={iconSet} size={size * 0.5} color={color} />
    </View>
  );
}

export function Empty({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

/** Fixed bottom action bar: prominent Scan Struk + a Tambah button. */
export function BottomActions({
  onScan,
  onAdd,
  insetsBottom = 0,
}: {
  onScan: () => void;
  onAdd: () => void;
  insetsBottom?: number;
}) {
  return (
    <View style={[styles.fixedActions, { paddingBottom: insetsBottom > 0 ? 0 : spacing.sm }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onScan} style={styles.scanBtn}>
        <Ionicons name="scan" size={22} color={colors.white} />
        <Text style={styles.scanBtnText}>Scan Struk</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.85} onPress={onAdd} style={styles.addBtn}>
        <Ionicons name="add" size={26} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

/** ‹ Month Year › navigator. */
export function MonthNav({
  label,
  onPrev,
  onNext,
  canNext = true,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canNext?: boolean;
}) {
  return (
    <View style={styles.monthNav}>
      <TouchableOpacity onPress={onPrev} style={styles.monthArrow} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
      </TouchableOpacity>
      <Text style={styles.monthLabel}>{label}</Text>
      <TouchableOpacity
        onPress={canNext ? onNext : undefined}
        style={styles.monthArrow}
        hitSlop={8}
      >
        <Ionicons name="chevron-forward" size={20} color={canNext ? colors.primary : colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fixedActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  scanBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  addBtn: {
    width: 56,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  monthArrow: { padding: 4 },
  monthLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  segmentRoot: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
    height: 40,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
  },
  segmentActive: { backgroundColor: colors.card },
  segmentText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentActiveText: { color: colors.primary },
  privacyEye: {
    position: 'absolute',
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Single source of truth for the gap between a section title and the
    // content above it. Cards/grids above titles should NOT add their own
    // marginBottom or the gap will compound.
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  pillText: { fontSize: 14, fontWeight: '600' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.md,
  },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  track: { width: '100%', overflow: 'hidden' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
