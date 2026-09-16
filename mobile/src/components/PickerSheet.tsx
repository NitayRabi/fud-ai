import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { AppText, Card, Divider, Row } from './primitives';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  subtitle?: string;
}

interface PickerSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: readonly PickerOption<T>[];
  selected: T | undefined;
  onSelect: (value: T) => void;
  onDismiss: () => void;
}

/** Single-choice list used where SwiftUI shows a `.menu` picker. Identical on both platforms. */
export function PickerSheet<T extends string>({ visible, title, options, selected, onSelect, onDismiss }: PickerSheetProps<T>) {
  const theme = useTheme();
  return (
    <BottomSheet visible={visible} title={title} onDismiss={onDismiss}>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {options.map((option, index) => {
          const isSelected = option.value === selected;
          return (
            <View key={option.value}>
              {index > 0 ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onSelect(option.value);
                  onDismiss();
                }}
                style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.fill : 'transparent' })}
              >
                <Row style={{ minHeight: 48, paddingHorizontal: theme.spacing.lg, paddingVertical: 10, gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body" weight={isSelected ? '600' : '400'}>
                      {option.label}
                    </AppText>
                    {option.subtitle ? (
                      <AppText variant="caption" tone="secondary">
                        {option.subtitle}
                      </AppText>
                    ) : null}
                  </View>
                  {isSelected ? <Icon name="checkmark.circle.fill" size={20} color={theme.colors.accent} /> : null}
                </Row>
              </Pressable>
            </View>
          );
        })}
      </Card>
    </BottomSheet>
  );
}
