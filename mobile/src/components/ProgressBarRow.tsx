import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText, Row } from './primitives';

interface ProgressBarRowProps {
  label: string;
  current: number;
  goal: number;
  unit?: string;
}

function formatMacro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** `MacroProgressRow` — label / "current / goal" and an 8pt gradient capsule track. */
export function ProgressBarRow({ label, current, goal, unit = 'g' }: ProgressBarRowProps) {
  const theme = useTheme();
  // Displayed progress stays within 0–100%; nothing logged means no bar, not a 2% sliver.
  const progress = goal > 0 ? Math.min(Math.max(current / goal, 0), 1) : 0;
  const valueText = goal > 0 ? `${formatMacro(current)}${unit} / ${goal}${unit}` : `${formatMacro(current)}${unit}`;
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="subheadline" weight="500">
          {label}
        </AppText>
        <AppText variant="subheadline" tone="secondary">
          {valueText}
        </AppText>
      </Row>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.accentAlpha(0.12), overflow: 'hidden' }}>
        <LinearGradient
          colors={theme.colors.accentGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ height: 8, borderRadius: 4, width: `${progress > 0 ? Math.max(progress * 100, 2) : 0}%` }}
        />
      </View>
    </View>
  );
}
