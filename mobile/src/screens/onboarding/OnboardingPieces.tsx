/**
 * Shared onboarding building blocks from `OnboardingView.swift`: `stepHeader`,
 * `selectionCard`, `continueButton` (label-colored capsule), feature rows.
 */

import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type SFSymbolName } from '../../components/Icon';
import { AppText, Row } from '../../components/primitives';
import { useTheme } from '../../theme';

export function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl }}>
      <AppText variant="title" weight="700">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="callout" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

interface SelectionCardProps {
  icon: SFSymbolName;
  title: string;
  subtitle?: string;
  isSelected: boolean;
  onPress: () => void;
}

/** `selectionCard` — appCard row with a 2pt label-colored border when selected. */
export function SelectionCard({ icon, title, subtitle, isSelected, onPress }: SelectionCardProps) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: isSelected }} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Row
        style={{
          gap: 16,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.card,
          backgroundColor: theme.colors.appCard,
          borderWidth: 2,
          borderColor: isSelected ? theme.colors.label : 'transparent',
        }}
      >
        <View style={{ width: 40, alignItems: 'center' }}>
          <Icon name={icon} size={22} color={isSelected ? theme.colors.label : theme.colors.secondaryLabel} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodySemibold">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Icon name={isSelected ? 'checkmark.circle.fill' : 'circle'} size={22} color={isSelected ? theme.colors.label : theme.colors.tertiaryLabel} />
      </Row>
    </Pressable>
  );
}

interface ContinueButtonProps {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** `continueButton` — 54pt capsule filled with the label color, background-colored text. */
export function ContinueButton({ title = 'Continue', onPress, disabled = false, style }: ContinueButtonProps) {
  const theme = useTheme();
  return (
    <View style={[{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          height: theme.sizes.primaryButtonHeight,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.label,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        })}
      >
        <AppText variant="bodySemibold" style={{ color: theme.colors.appBackground }}>
          {title}
        </AppText>
      </Pressable>
    </View>
  );
}

export function FeatureRow({ icon, text, tint }: { icon: SFSymbolName; text: string; tint?: 'accent' | 'secondary' }) {
  const theme = useTheme();
  return (
    <Row style={{ gap: 12 }}>
      <View style={{ width: 26, alignItems: 'center' }}>
        <Icon name={icon} size={16} color={tint === 'secondary' ? theme.colors.secondaryLabel : theme.colors.accent} />
      </View>
      <AppText variant="subheadline">{text}</AppText>
    </Row>
  );
}
