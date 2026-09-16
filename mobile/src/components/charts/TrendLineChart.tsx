import { useMemo, useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { trendAxis, trendDomain, type TrendPoint } from '../../domain/progress/progress';
import { useTheme } from '../../theme';
import { AppText } from '../primitives';

interface TrendLineChartProps {
  points: readonly TrendPoint[];
  /** Horizontal dashed rule, e.g. the goal weight (same units as `points`). */
  goal?: number;
  height?: number;
  formatValue: (value: number) => string;
  /** Domain when there are no points at all. */
  fallbackDomain?: [number, number];
  /** Fired when the user scrubs to a point; undefined when the scrub ends. */
  onInspect?: (point: TrendPoint | undefined) => void;
}

const Y_LABEL_WIDTH = 44;
const X_LABEL_HEIGHT = 18;
const PADDING_TOP = 8;

function formatAxisDate(time: number, showsYear: boolean): string {
  const date = new Date(time);
  return showsYear
    ? date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Catmull-Rom → cubic Bézier path, matching the `.catmullRom` interpolation on iOS. */
function smoothPath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return '';
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`;
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const x0 = xs[i - 1] ?? xs[i]!;
    const y0 = ys[i - 1] ?? ys[i]!;
    const x1 = xs[i]!;
    const y1 = ys[i]!;
    const x2 = xs[i + 1]!;
    const y2 = ys[i + 1]!;
    const x3 = xs[i + 2] ?? x2;
    const y3 = ys[i + 2] ?? y2;
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
  }
  return d;
}

/**
 * Line + area trend chart (`WeightChartSection` / `BodyFatChartSection` Swift Charts). One
 * SVG for both platforms: accent line with gradient area, dots while ≤31 points, dashed goal
 * rule, trailing y-axis, span-derived x-axis strides, and drag-to-inspect.
 */
export function TrendLineChart({ points, goal, height = 190, formatValue, fallbackDomain = [0, 200], onInspect }: TrendLineChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [inspected, setInspected] = useState<TrendPoint | undefined>(undefined);

  const plotWidth = Math.max(0, width - Y_LABEL_WIDTH);
  const plotHeight = height - X_LABEL_HEIGHT - PADDING_TOP;
  const [minY, maxY] = trendDomain(
    points.map((p) => p.value),
    goal,
    fallbackDomain,
  );
  const first = points[0];
  const last = points[points.length - 1];
  const minX = first?.time ?? 0;
  const maxX = last && last.time > minX ? last.time : minX + 86_400_000;
  const axis = trendAxis(points);

  const x = (time: number) => (plotWidth * (time - minX)) / (maxX - minX);
  const y = (value: number) => PADDING_TOP + plotHeight - ((value - minY) / (maxY - minY || 1)) * plotHeight;

  const { linePath, areaPath, xs, ys } = useMemo(() => {
    const px = points.map((p) => x(p.time));
    const py = points.map((p) => y(p.value));
    const line = smoothPath(px, py);
    const baseline = PADDING_TOP + plotHeight;
    const area = px.length > 0 ? `${line} L ${px[px.length - 1]} ${baseline} L ${px[0]} ${baseline} Z` : '';
    return { linePath: line, areaPath: area, xs: px, ys: py };
    // Geometry only changes with these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, plotWidth, plotHeight, minY, maxY, minX, maxX]);

  const yTicks = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => minY + ((maxY - minY) * i) / count);
  }, [minY, maxY]);

  const xTicks = useMemo(() => {
    if (!first) return [] as number[];
    const stride = axis.strideDays * 86_400_000;
    const ticks: number[] = [];
    for (let t = minX; t <= maxX; t += stride) ticks.push(t);
    // Keep labels from colliding on narrow plots.
    const maxLabels = Math.max(2, Math.floor(plotWidth / 64));
    const step = Math.max(1, Math.ceil(ticks.length / maxLabels));
    return ticks.filter((_, i) => i % step === 0);
  }, [first, axis.strideDays, minX, maxX, plotWidth]);

  const inspectAt = (event: GestureResponderEvent) => {
    if (points.length === 0 || plotWidth <= 0) return;
    const locationX = event.nativeEvent.locationX;
    const time = minX + ((maxX - minX) * Math.min(Math.max(locationX, 0), plotWidth)) / plotWidth;
    let nearest = points[0]!;
    for (const point of points) if (Math.abs(point.time - time) < Math.abs(nearest.time - time)) nearest = point;
    if (nearest !== inspected) {
      setInspected(nearest);
      onInspect?.(nearest);
    }
  };
  const endInspect = () => {
    setInspected(undefined);
    onInspect?.(undefined);
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const showDots = points.length <= 31;
  const gridColor = theme.scheme === 'dark' ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.11)';

  return (
    <View onLayout={onLayout} style={{ height, width: '100%' }}>
      {width > 0 ? (
        <>
          <Svg
            width={width}
            height={height}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={inspectAt}
            onResponderMove={inspectAt}
            onResponderRelease={endInspect}
            onResponderTerminate={endInspect}
          >
            <Defs>
              <SvgLinearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.accent} stopOpacity={0.12} />
                <Stop offset="1" stopColor={theme.colors.accent} stopOpacity={0.01} />
              </SvgLinearGradient>
            </Defs>
            <Rect x={0} y={PADDING_TOP} width={plotWidth} height={plotHeight} rx={10} fill={theme.accentAlpha(0.025)} />
            {yTicks.map((tick) => (
              <Line key={`y-${tick}`} x1={0} x2={plotWidth} y1={y(tick)} y2={y(tick)} stroke={gridColor} strokeWidth={0.6} />
            ))}
            {yTicks.map((tick) => (
              <SvgText key={`yl-${tick}`} x={plotWidth + 6} y={y(tick) + 4} fontSize={10} fill={theme.colors.secondaryLabel}>
                {formatValue(tick)}
              </SvgText>
            ))}
            {xTicks.map((tick) => (
              <Line key={`x-${tick}`} x1={x(tick)} x2={x(tick)} y1={PADDING_TOP} y2={PADDING_TOP + plotHeight} stroke={gridColor} strokeWidth={0.6} strokeDasharray="3 4" />
            ))}
            {xTicks.map((tick) => (
              <SvgText key={`xl-${tick}`} x={x(tick)} y={height - 4} fontSize={10} fill={theme.colors.secondaryLabel} textAnchor="middle">
                {formatAxisDate(tick, axis.showsYear)}
              </SvgText>
            ))}
            {areaPath ? <Path d={areaPath} fill="url(#trendArea)" /> : null}
            {linePath ? <Path d={linePath} stroke={theme.colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
            {showDots ? xs.map((px, i) => <Circle key={`dot-${i}`} cx={px} cy={ys[i]!} r={3.1} fill={theme.colors.accent} />) : null}
            {goal !== undefined ? (
              <Line x1={0} x2={plotWidth} y1={y(goal)} y2={y(goal)} stroke="rgba(52,199,89,0.7)" strokeWidth={1.5} strokeDasharray="6 4" />
            ) : null}
            {inspected ? (
              <>
                <Line x1={x(inspected.time)} x2={x(inspected.time)} y1={PADDING_TOP} y2={PADDING_TOP + plotHeight} stroke={theme.accentAlpha(0.6)} strokeWidth={1.25} strokeDasharray="3 3" />
                <Circle cx={x(inspected.time)} cy={y(inspected.value)} r={5.4} fill={theme.colors.label} />
                <Circle cx={x(inspected.time)} cy={y(inspected.value)} r={3.6} fill={theme.colors.accent} />
              </>
            ) : null}
          </Svg>
          {inspected ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: PADDING_TOP + 6,
                left: Math.min(Math.max(x(inspected.time) - 56, 0), Math.max(plotWidth - 112, 0)),
                width: 112,
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: theme.colors.appCard,
                borderWidth: 0.75,
                borderColor: theme.accentAlpha(0.22),
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              }}
            >
              <AppText variant="caption2" tone="secondary" weight="500">
                {new Date(inspected.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </AppText>
              <AppText variant="subheadlineSemibold" weight="700">
                {formatValue(inspected.value)}
              </AppText>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
