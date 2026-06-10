import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { CategorySpend, DayPoint } from '../store/selectors';
import { categoryOf, colors, fill } from '../theme';
import { formatCompact } from '../utils/format';

/** Simple weekly bar chart of daily spend. */
export function WeeklyBars({ data, height = 140 }: { data: DayPoint[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 26;
  const gap = 12;
  const chartW = data.length * (barW + gap);
  const labelH = 18;
  const innerH = height - labelH;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${chartW} ${height}`}>
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max(4, (d.value / max) * (innerH - 8)) : 2;
        const x = i * (barW + gap) + gap / 2;
        const y = innerH - h;
        return (
          <G key={d.iso}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={6}
              fill={d.value > 0 ? colors.primary : colors.border}
            />
            <SvgText
              x={x + barW / 2}
              y={height - 5}
              fontSize={11}
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
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
});
