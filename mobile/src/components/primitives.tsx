import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, type TextStyleName } from '../theme';

// MARK: - Screen

interface ScreenProps extends ViewProps {
  /** Which safe-area edges to inset. Tab screens leave `bottom` to the tab bar. */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function Screen({ style, edges = ['top', 'left', 'right'], ...rest }: ScreenProps) {
  const theme = useTheme();
  return <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: theme.colors.appBackground }, style]} {...rest} />;
}

// MARK: - Text

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'destructive';

interface AppTextProps extends TextProps {
  variant?: TextStyleName;
  tone?: Tone;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', tone = 'primary', weight, align, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const color = {
    primary: theme.colors.label,
    secondary: theme.colors.secondaryLabel,
    tertiary: theme.colors.tertiaryLabel,
    accent: theme.colors.accent,
    onAccent: theme.colors.onAccent,
    destructive: theme.colors.destructive,
  }[tone];
  return (
    <Text
      style={[theme.text[variant], { color }, weight ? { fontWeight: weight } : null, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

/** Text filled with the accent gradient (`foregroundStyle(LinearGradient(...))`). */
export function GradientText({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  // Masked gradient text needs react-native-masked-view; the flat accent keeps the same read.
  const theme = useTheme();
  return <Text style={[{ color: theme.colors.accent }, style]}>{children}</Text>;
}

// MARK: - Card

interface CardProps extends ViewProps {
  padded?: boolean;
  highlight?: boolean;
}

/** `AppColors.appCard` rounded 16, optional accent hairline like the onboarding choice cards. */
export function Card({ style, padded = true, highlight = false, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.appCard,
          borderRadius: theme.radii.card,
          borderWidth: highlight ? 1.5 : StyleSheet.hairlineWidth,
          borderColor: highlight ? theme.accentAlpha(0.35) : theme.scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
        padded ? { padding: theme.spacing.lg } : null,
        style,
      ]}
      {...rest}
    />
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.separator }, style]} />;
}

// MARK: - Buttons

interface PrimaryButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  style?: StyleProp<ViewStyle>;
}

/** Full-width gradient CTA: height 54, radius 16, white semibold label, 0.45 opacity when disabled. */
export function PrimaryButton({ title, disabled, style, ...rest }: PrimaryButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}
      {...rest}
    >
      <LinearGradient
        colors={theme.colors.accentGradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          height: theme.sizes.primaryButtonHeight,
          borderRadius: theme.radii.card,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: theme.colors.accent,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <AppText variant="bodySemibold" tone="onAccent">
          {title}
        </AppText>
      </LinearGradient>
    </Pressable>
  );
}

interface SecondaryButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  style?: StyleProp<ViewStyle>;
}

/** Tinted secondary action (`accent.opacity(0.12)` background, height 48, radius 12). */
export function SecondaryButton({ title, style, ...rest }: SecondaryButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height: theme.sizes.secondaryButtonHeight,
          borderRadius: theme.radii.control,
          backgroundColor: theme.accentAlpha(pressed ? 0.2 : 0.12),
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      {...rest}
    >
      <AppText variant="bodySemibold" tone="accent">
        {title}
      </AppText>
    </Pressable>
  );
}

interface LinkButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: TextStyleName;
  style?: StyleProp<ViewStyle>;
}

export function LinkButton({ title, variant = 'subheadlineSemibold', style, ...rest }: LinkButtonProps) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, style]} {...rest}>
      <AppText variant={variant} tone="accent" align="center">
        {title}
      </AppText>
    </Pressable>
  );
}

// MARK: - Badge

export function Badge({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.accentAlpha(0.12),
      }}
    >
      <AppText variant="caption2Semibold" tone="accent" weight="700">
        {label}
      </AppText>
    </View>
  );
}

// MARK: - Layout helpers

export function Row({ style, ...rest }: ViewProps) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]} {...rest} />;
}

export function Spacer({ size = 0 }: { size?: number }) {
  return <View style={size ? { width: size, height: size } : { flex: 1 }} />;
}
