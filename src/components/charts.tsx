import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { CategorySpend, DayPoint } from '../store/selectors';
import { categoryOf, colors, fill } from '../theme';
import { formatCompact } from '../utils/format';

/** Weekly bar chart of daily spend — tap a bar to select that day. */
export function WeeklyBars({
  data,
  height = 140,
  selectedIso,
  onBarPress,
}: {
  data: DayPoint[];
  height?: number;
  selectedIso?: string | null;
  onBarPress?: (iso: string) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerH = height - 22;
  return (
    <View style={{ flexDirection: 'row', height, alignItems: 'flex-end' }}>
      {data.map((d) => {
        const h = d.value > 0 ? Math.max(4, (d.value / max) * innerH) : 2;
        const selected = d.iso === selectedIso;
        const barColor = d.value > 0
          ? selected ? colors.primaryDark : colors.primary
          : colors.border;
        return (
          <TouchableOpacity
            key={d.iso}
            activeOpacity={onBarPress ? 0.6 : 1}
            onPress={onBarPress ? () => onBarPress(d.iso) : undefined}
            style={styles.barCol}
          >
            <View style={{ width: 24, height: h, borderRadius: 6, backgroundColor: barColor }} />
            <Text style={[styles.barLabel, selected && styles.barLabelOn]}>{d.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Donut chart of spending by category, with total in the center. */
export function CategoryDonut({
  data,
  total,
  size = 170,
}: {
  data: CategorySpend[];
  total: number;
  size?: number;
}) {
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const slices = data.filter((d) => d.spent > 0);
  const sum = slices.reduce((s, d) => s + d.spent, 0) || 1;

  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          <Circle cx={cx} cy={cy} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
          {slices.map((d) => {
            const frac = d.spent / sum;
            const len = frac * circ;
            const el = (
              <Circle
                key={d.category}
                cx={cx}
                cy={cy}
                r={r}
                stroke={categoryOf(d.category).color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </G>
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutLabel}>Spent</Text>
        <Text style={styles.donutValue}>{formatCompact(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutCenter: {
    ...fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  donutValue: { fontSize: 22, color: colors.text, fontWeight: '800' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barLabel: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  barLabelOn: { color: colors.text, fontWeight: '800' },
});
