import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient as SvgLinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { dateFromDayKey } from '../../domain/dates';
import { dayAxis } from '../../domain/progress/progress';
import { useTheme } from '../../theme';

export interface BarDatum {
  /** The day key (`yyyy-MM-dd`) the bar belongs to; also its calendar position. */
  id: string;
  value: number;
}

interface BarChartProps {
  data: readonly BarDatum[];
  /** Dashed accent rule, e.g. the calorie goal. */
  goal?: number;
  height?: number;
  formatValue?: (value: number) => string;
  formatDay?: (day: string) => string;
}

const Y_LABEL_WIDTH = 44;
const X_LABEL_HEIGHT = 18;
const PADDING_TOP = 8;

const defaultFormatDay = (day: string) => dateFromDayKey(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * `CalorieChartSection` / `WorkoutBurnChartSection` — gradient bars per day with a dashed goal
 * line and trailing y-axis. Bars are placed on a calendar axis (`dayAxis`), like the native
 * `BarMark(x: .value("Date", date, unit: .day))`, so days without a record leave a gap instead
 * of pulling distant dates together.
 */
export function BarChart({ data, goal, height = 190, formatValue = (v) => v.toLocaleString(), formatDay = defaultFormatDay }: BarChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(0, width - Y_LABEL_WIDTH);
  const plotHeight = height - X_LABEL_HEIGHT - PADDING_TOP;

  const maxValue = Math.max(1, ...data.map((d) => d.value), goal ?? 0) * 1.08;
  const y = (value: number) => PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;
  const axis = useMemo(() => dayAxis(data.map((d) => d.id)), [data]);
  const slot = plotWidth / axis.dayCount;
  const x = (day: string) => slot * axis.offset(day) + slot / 2;
  const barWidth = Math.max(2, Math.min(28, slot * 0.62));

  const yTicks = useMemo(() => Array.from({ length: 5 }, (_, i) => (maxValue * i) / 4), [maxValue]);
  const gridColor = theme.scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={{ height, width: '100%' }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <SvgLinearGradient id="barFill" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={theme.colors.accentGradient[0]} />
              <Stop offset="1" stopColor={theme.colors.accentGradient[1]} />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={PADDING_TOP} width={plotWidth} height={plotHeight} rx={10} fill={theme.accentAlpha(0.025)} />
          {yTicks.map((tick) => (
            <Line key={`y-${tick}`} x1={0} x2={plotWidth} y1={y(tick)} y2={y(tick)} stroke={gridColor} strokeWidth={0.6} />
          ))}
          {yTicks.map((tick) => (
            <SvgText key={`yl-${tick}`} x={plotWidth + 6} y={y(tick) + 4} fontSize={10} fill={theme.colors.secondaryLabel}>
              {formatValue(Math.round(tick))}
            </SvgText>
          ))}
          {data.map((datum) => {
            const cx = x(datum.id);
            const top = y(datum.value);
            return <Rect key={datum.id} x={cx - barWidth / 2} y={top} width={barWidth} height={Math.max(0, PADDING_TOP + plotHeight - top)} rx={4} fill="url(#barFill)" />;
          })}
          {axis.ticks.map((day) => (
            <SvgText key={`xl-${day}`} x={x(day)} y={height - 4} fontSize={10} fill={theme.colors.secondaryLabel} textAnchor="middle">
              {formatDay(day)}
            </SvgText>
          ))}
          {goal !== undefined && goal > 0 ? (
            <Line x1={0} x2={plotWidth} y1={y(goal)} y2={y(goal)} stroke={theme.accentAlpha(0.6)} strokeWidth={1.5} strokeDasharray="6 4" />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
