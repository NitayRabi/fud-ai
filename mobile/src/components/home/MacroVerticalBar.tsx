import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { useTheme } from '../../theme';
import { AppText } from '../primitives';

interface MacroVerticalBarProps {
  label: string;
  current: number;
  goal: number;
  unit: string;
}

/** `MacroValueFormatter.string` — whole numbers without decimals, otherwise one decimal. */
export function formatMacroValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1);
}

/**
 * A single nutrient as a rounded tube filling bottom-up toward its goal (`MacroVerticalBar.swift`).
 * Value above, name + remaining beneath.
 */
export function MacroVerticalBar({ label, current, goal, unit }: MacroVerticalBarProps) {
  const theme = useTheme();
  const { macroBarWidth: barWidth, macroBarHeight: barHeight } = theme.sizes;
  const progress = goal > 0 ? Math.min(current / goal, 1) : 0;

  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(shown, { toValue: progress, damping: 16, stiffness: 100, useNativeDriver: false }).start();
  }, [progress, shown]);

  const fillHeight = shown.interpolate({ inputRange: [0, 1], outputRange: [barWidth, barHeight] });

  const difference = goal - current;
  const isOver = goal > 0 && difference < 0;
  const statusText =
    goal <= 0
      ? 'No goal'
      : Math.abs(difference) < 0.0001
        ? 'Goal reached'
        : `${formatMacroValue(Math.abs(difference))}${unit} ${difference > 0 ? 'left' : 'over'}`;

  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }} accessibilityLabel={`${label} ${formatMacroValue(current)} of ${formatMacroValue(goal)} ${unit}`}>
      <AppText variant="title3" tone="accent" numberOfLines={1} adjustsFontSizeToFit weight="700">
        {formatMacroValue(current)}
      </AppText>
      <View
        style={{
          width: barWidth,
          height: barHeight,
          borderRadius: barWidth / 2,
          backgroundColor: theme.accentAlpha(0.12),
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <Animated.View style={{ height: fillHeight, borderRadius: barWidth / 2, overflow: 'hidden' }}>
          <LinearGradient colors={[theme.colors.accentGradient[1], theme.colors.accentGradient[0]]} style={{ flex: 1 }} />
        </Animated.View>
      </View>
      <View style={{ alignItems: 'center', gap: 1 }}>
        <AppText variant="captionSemibold" numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </AppText>
        <AppText variant="caption2" weight="500" numberOfLines={1} adjustsFontSizeToFit tone={isOver ? 'accent' : 'secondary'}>
          {statusText}
        </AppText>
      </View>
    </View>
  );
}
