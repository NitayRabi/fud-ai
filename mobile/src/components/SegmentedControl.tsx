import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './primitives';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  selected: T;
  onSelect: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * `Picker(.segmented).tint(AppColors.calorie)` rendered identically on both platforms: a
 * `fill` track with the selected segment lifted on an `appCard` pill and tinted label.
 */
export function SegmentedControl<T extends string>({ segments, selected, onSelect, style, accessibilityLabel }: SegmentedControlProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[{ flexDirection: 'row', backgroundColor: theme.colors.fill, borderRadius: 9, padding: 2, minHeight: 32 }, style]}
    >
      {segments.map((segment) => {
        const isSelected = segment.value === selected;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(segment.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 7,
              paddingVertical: 5,
              paddingHorizontal: 4,
              backgroundColor: isSelected ? theme.colors.appCard : 'transparent',
              shadowColor: '#000',
              shadowOpacity: isSelected ? 0.12 : 0,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: isSelected ? 2 : 0,
            }}
          >
            <AppText variant="footnoteSemibold" tone={isSelected ? 'accent' : 'secondary'} numberOfLines={1}>
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface PillTabsProps<T extends string> {
  tabs: readonly { value: T; label: string; icon?: React.ReactNode }[];
  selected: T;
  onSelect: (value: T) => void;
}

/** `ProgressOverviewModeSelector` — capsule tabs with the accent gradient on the selection. */
export function PillTabs<T extends string>({ tabs, selected, onSelect }: PillTabsProps<T>) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 6,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.appCard,
        borderWidth: 0.75,
        borderColor: theme.accentAlpha(0.12),
      }}
    >
      {tabs.map((tab) => {
        const isSelected = tab.value === selected;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(tab.value)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: theme.radii.pill,
              backgroundColor: isSelected ? theme.colors.accent : 'transparent',
            }}
          >
            {tab.icon}
            <AppText variant="subheadlineSemibold" tone={isSelected ? 'onAccent' : 'secondary'} numberOfLines={1}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
