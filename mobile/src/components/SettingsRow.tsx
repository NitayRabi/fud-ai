import React from 'react';
import { Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Icon, type SFSymbolName } from './Icon';
import { AppText, Card, Divider, Row } from './primitives';

interface SettingsRowProps {
  icon?: SFSymbolName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  /** Renders a trailing chevron (`NavigationLink`). Defaults to true when `onPress` is set. */
  chevron?: boolean;
  trailing?: React.ReactNode;
  destructive?: boolean;
  testID?: string;
}

/** `Label` + `NavigationLink` row on `appCard`, matching the grouped list look of Settings. */
export function SettingsRow({ icon, title, subtitle, value, onPress, chevron, trailing, destructive, testID }: SettingsRowProps) {
  const theme = useTheme();
  const showChevron = chevron ?? !!onPress;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.fill : 'transparent' })}
    >
      <Row style={{ minHeight: 48, paddingHorizontal: theme.spacing.lg, paddingVertical: 10, gap: 12 }}>
        {icon ? (
          <View style={{ width: 24, alignItems: 'center' }}>
            <Icon name={icon} size={20} color={destructive ? theme.colors.destructive : theme.colors.accent} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="body" weight="500" tone={destructive ? 'destructive' : 'primary'}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {value ? (
          <AppText variant="body" tone="secondary" numberOfLines={1} style={{ maxWidth: '45%' }}>
            {value}
          </AppText>
        ) : null}
        {trailing}
        {showChevron ? <Icon name="chevron.right" size={14} color={theme.colors.tertiaryLabel} /> : null}
      </Row>
    </Pressable>
  );
}

interface SettingsToggleRowProps {
  icon?: SFSymbolName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function SettingsToggleRow({ icon, title, subtitle, value, onValueChange }: SettingsToggleRowProps) {
  const theme = useTheme();
  return (
    <SettingsRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      chevron={false}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: theme.colors.accent, false: theme.colors.fill }}
          thumbColor="#FFFFFF"
        />
      }
    />
  );
}

interface SettingsSectionProps {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Grouped `Section` — header above, rows on a card separated by hairlines, footer below. */
export function SettingsSection({ header, footer, children, style }: SettingsSectionProps) {
  const theme = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ gap: 6 }, style]}>
      {header ? (
        <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: theme.spacing.lg, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {header}
        </AppText>
      ) : null}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <Divider style={{ marginLeft: theme.spacing.lg + 36 }} /> : null}
            {row}
          </React.Fragment>
        ))}
      </Card>
      {footer ? (
        <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: theme.spacing.lg }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}
