import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

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
  color,
  size = 40,
}: {
  icon: keyof typeof Ionicons.glyphMap;
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
      <Ionicons name={icon} size={size * 0.5} color={color} />
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

const styles = StyleSheet.create({
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
