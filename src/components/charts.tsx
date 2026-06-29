import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from './typography';
import Svg, {
  Circle,
  G,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { CategorySpend, DayPoint } from '../store/selectors';
import { categoryOf, colors, fill } from '../theme';
import { formatCompact } from '../utils/format';

export interface MonthPoint {
  key: string;
  label: string;
  value: number;
}

/** Line chart of total balance per month — tap a node to select that month. */
export function BalanceLineChart({
  data,
  selectedKey,
  onSelect,
  height = 170,
}: {
  data: MonthPoint[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  height?: number;
}) {
  const W = 340;
  const padX = 16;
  const padTop = 16;
  const labelH = 20;
  const innerH = height - labelH - padTop;
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = (W - padX * 2) / Math.max(1, data.length - 1);

  const pts = data.map((d, i) => ({
    ...d,
    x: padX + i * stepX,
    y: padTop + (1 - (d.value - min) / span) * (innerH - 8) + 4,
  }));
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
      {/* Each segment is colored red when the balance dropped, green otherwise. */}
      {pts.slice(1).map((p, i) => {
        const prev = pts[i];
        const up = p.value >= prev.value;
        return (
          <Line
            key={`seg-${p.key}`}
            x1={prev.x}
            y1={prev.y}
            x2={p.x}
            y2={p.y}
            stroke={up ? colors.success : colors.danger}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
      })}
      {pts.map((p) => {
        const active = p.key === selectedKey;
        return (
          <G key={p.key} onPress={() => onSelect?.(p.key)}>
            {active ? (
              <Line x1={p.x} y1={padTop} x2={p.x} y2={innerH + padTop} stroke={colors.border} strokeWidth={1} />
            ) : null}
            <Circle
              cx={p.x}
              cy={p.y}
              r={active ? 6 : 4}
              fill={active ? colors.primary : colors.card}
              stroke={colors.primary}
              strokeWidth={2}
            />
            {/* larger transparent hit target */}
            <Circle cx={p.x} cy={p.y} r={16} fill="transparent" />
            <SvgText x={p.x} y={height - 5} fontSize={9} fill={active ? colors.primary : colors.textMuted} textAnchor="middle">
              {p.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

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

/** Donut chart of spending by category, with total in the center. The center
 *  label can take a pre-formatted string so the parent decides whether to
 *  mask it (privacy mode) or how to format it. */
export function CategoryDonut({
  data,
  total,
  centerLabel = 'Spent',
  centerText,
  size = 170,
}: {
  data: CategorySpend[];
  total: number;
  centerLabel?: string;
  centerText?: string;
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
        <Text style={styles.donutLabel}>{centerLabel}</Text>
        <Text
          style={styles.donutValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        >
          {centerText ?? formatCompact(total)}
        </Text>
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
