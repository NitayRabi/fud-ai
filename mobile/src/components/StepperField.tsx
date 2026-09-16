import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import { Icon } from './Icon';
import { AppText, Row } from './primitives';

interface StepperFieldProps {
  value: string;
  onChange: (value: string) => void;
  step: number;
  unit: string;
  accessibilityLabel: string;
  /** Digits shown after nudging with the buttons (0 for whole numbers). */
  fractionDigits?: number;
  min?: number;
  max?: number;
  integerOnly?: boolean;
  /** Smaller variant for side-by-side fields (feet / inches). */
  compact?: boolean;
  label?: string;
}

/**
 * Stands in for the SwiftUI wheel pickers with an editable number and ± nudges, so the
 * control is identical on both platforms. Typing is free-form; the buttons clamp to bounds.
 */
export function StepperField({ value, onChange, step, unit, accessibilityLabel, fractionDigits = 1, min, max, integerOnly = false, compact = false, label }: StepperFieldProps) {
  const theme = useTheme();
  const parsed = Number.parseFloat(value.replace(',', '.'));
  const nudge = (direction: 1 | -1) => {
    const base = Number.isFinite(parsed) ? parsed : (min ?? 0);
    let next = Math.round((base + direction * step) * 10) / 10;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next.toFixed(fractionDigits));
  };
  const size = compact ? 36 : 44;
  const button = (kind: 'plus' | 'minus') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kind === 'plus' ? `Increase ${accessibilityLabel}` : `Decrease ${accessibilityLabel}`}
      onPress={() => nudge(kind === 'plus' ? 1 : -1)}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentAlpha(pressed ? 0.2 : 0.12) })}
    >
      <Icon name={kind} size={compact ? 16 : 20} color={theme.colors.accent} />
    </Pressable>
  );
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      {label ? (
        <AppText variant="caption" tone="secondary" weight="500">
          {label}
        </AppText>
      ) : null}
      <Row style={{ gap: compact ? 8 : 12, justifyContent: 'center' }}>
        {button('minus')}
        <Row style={{ alignItems: 'flex-end', gap: 4, minWidth: compact ? 72 : 120, justifyContent: 'center' }}>
          <TextInput
            value={value}
            onChangeText={(v) => onChange(integerOnly ? v.replace(/[^0-9]/g, '') : v.replace(/[^0-9.,]/g, ''))}
            keyboardType={integerOnly ? 'number-pad' : 'decimal-pad'}
            accessibilityLabel={accessibilityLabel}
            selectTextOnFocus
            style={[compact ? theme.text.title2 : theme.text.largeTitle, { color: theme.colors.label, minWidth: compact ? 44 : 80, textAlign: 'center', paddingVertical: 0 }]}
          />
          <AppText variant={compact ? 'callout' : 'title3'} tone="secondary" style={{ paddingBottom: compact ? 3 : 6 }}>
            {unit}
          </AppText>
        </Row>
        {button('plus')}
      </Row>
    </View>
  );
}
