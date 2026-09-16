import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { isSameDay, startOfWeek, weekDates } from '../../domain/dates';
import { useTheme } from '../../theme';
import { AppText } from '../primitives';

interface WeekEnergyStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  weekStartsOnMonday: boolean;
}

/**
 * Seven day tiles for the week containing `selectedDate` (`WeekEnergyStrip.swift`). The
 * selected day is a gradient disc; today gets a hairline accent ring. Week paging follows the
 * selected date, which the Home swipe gesture moves.
 */
export function WeekEnergyStrip({ selectedDate, onSelectDate, weekStartsOnMonday }: WeekEnergyStripProps) {
  const theme = useTheme();
  const today = useMemo(() => new Date(), []);
  const dates = useMemo(() => weekDates(startOfWeek(selectedDate, weekStartsOnMonday)), [selectedDate, weekStartsOnMonday]);

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: theme.spacing.lg }}>
      {dates.map((date) => {
        const isSelected = isSameDay(date, selectedDate);
        const isToday = isSameDay(date, today);
        const isFuture = date > today && !isToday;
        return (
          <Pressable
            key={date.toISOString()}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectDate(date);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 6, opacity: isFuture ? 0.6 : 1 }}
          >
            <AppText variant="caption2" weight="500" style={{ color: isSelected ? theme.colors.accent : theme.colors.tertiaryLabel }}>
              {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </AppText>
            <View
              style={{
                width: theme.sizes.weekDayTile,
                height: theme.sizes.weekDayTile,
                borderRadius: theme.sizes.weekDayTile / 2,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: isToday && !isSelected ? 1.5 : 0,
                borderColor: theme.accentAlpha(0.35),
              }}
            >
              {isSelected ? (
                <LinearGradient
                  colors={theme.colors.accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
              ) : null}
              <AppText
                variant="bodySemibold"
                style={{ color: isSelected ? theme.colors.onAccent : isToday ? theme.colors.accent : theme.colors.label }}
              >
                {date.getDate()}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
