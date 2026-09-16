import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Mask, Path, Stop } from 'react-native-svg';

import { useTheme } from '../../theme';
import { Icon } from '../Icon';
import { AppText } from '../primitives';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface CalorieGaugeProps {
  eaten: number;
  goal: number;
  /** Secondary display-only burn/deficit line when Health energy is available. */
  burnLine?: string;
}

/**
 * Semicircle speedometer gauge for total calories (`CalorieGauge.swift`): a dashed accent arc
 * (9 → 12 → 3 o'clock) with the count, "CALORIES" label and remaining read-out in the dome.
 * Geometry is the shared 240 / 14 used by iOS and Android.
 */
export function CalorieGauge({ eaten, goal, burnLine }: CalorieGaugeProps) {
  const theme = useTheme();
  const diameter = theme.sizes.calorieGaugeDiameter;
  const lineWidth = theme.sizes.calorieGaugeLineWidth;
  const center = diameter / 2;
  const radius = center - lineWidth / 2;
  const arcLength = Math.PI * radius;
  const arcPath = `M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`;
  const progress = goal > 0 ? Math.min(eaten / goal, 1) : 0;

  // Fill from zero on first appearance, then spring to each new value.
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(shown, { toValue: progress, damping: 18, stiffness: 90, useNativeDriver: false }).start();
  }, [progress, shown]);
  const sweepOffset = Animated.multiply(Animated.subtract(1, shown), arcLength);

  const statusText =
    goal <= 0
      ? 'No goal'
      : eaten < goal
        ? `${(goal - eaten).toLocaleString()} left`
        : eaten > goal
          ? `${(eaten - goal).toLocaleString()} over`
          : 'Goal reached';

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Calories ${eaten.toLocaleString()} of ${goal.toLocaleString()}`}
      style={{ width: diameter, height: diameter * 0.58, overflow: 'hidden', alignSelf: 'center' }}
    >
      <Svg width={diameter} height={diameter} style={{ position: 'absolute', top: 0 }}>
        <Defs>
          <SvgLinearGradient id="calorieArc" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.colors.accentGradient[0]} />
            <Stop offset="1" stopColor={theme.colors.accentGradient[1]} />
          </SvgLinearGradient>
          {/* Solid arc revealing [0, progress] of the dashed gradient underneath. */}
          <Mask id="sweep">
            <AnimatedPath
              d={arcPath}
              stroke="#FFFFFF"
              strokeWidth={lineWidth + 2}
              fill="none"
              strokeDasharray={[arcLength, arcLength]}
              strokeDashoffset={sweepOffset}
            />
          </Mask>
        </Defs>
        <Path d={arcPath} stroke={theme.accentAlpha(0.12)} strokeWidth={lineWidth} strokeDasharray={[4, 6]} fill="none" />
        <Path d={arcPath} stroke="url(#calorieArc)" strokeWidth={lineWidth} strokeDasharray={[4, 6]} fill="none" mask="url(#sweep)" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: center - diameter * 0.14 - 46,
          alignItems: 'center',
          gap: 2,
        }}
      >
        <AppText variant="captionSemibold" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Calories
        </AppText>
        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: 50, lineHeight: 56, fontWeight: '700', color: theme.colors.accent }}
        >
          {eaten.toLocaleString()}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="flame.fill" size={11} color={theme.colors.accent} />
          <AppText variant="footnoteSemibold" tone="accent">
            {statusText}
          </AppText>
        </View>
        {burnLine ? (
          <AppText variant="caption2" tone="tertiary" weight="500">
            {burnLine}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
