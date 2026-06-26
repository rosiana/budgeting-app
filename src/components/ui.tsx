import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fill, radius, spacing } from '../theme';
import { IconSet } from '../types';

/** Subtle tiled brown grid behind a screen's content. */
export function GridBg() {
  return (
    <Image
      source={require('../../assets/grid-tile.png')}
      resizeMode="repeat"
      style={fill}
    />
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
    marginTop: spacing.lg,
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
