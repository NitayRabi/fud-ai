/**
 * Settings → Notifications. Mirrors the notifications section of `ProfileComponents.swift`:
 * the master meal-reminder switch backed by `notificationsEnabled`, requesting permission and
 * (re)scheduling the same three daily reminders as `NotificationManager.swift`.
 */

import { useState } from 'react';
import { Alert, Linking, ScrollView } from 'react-native';

import { SettingsRow, SettingsSection, SettingsToggleRow } from '../../components/SettingsRow';
import { cancelMealReminders, defaultMealReminders, requestNotificationAuthorization, scheduleMealReminders } from '../../services/notifications';
import { setPreferences, usePreferences } from '../../state/appStores';
import { useTheme } from '../../theme';

function formatTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function NotificationsScreen() {
  const theme = useTheme();
  const enabled = usePreferences((p) => p.notificationsEnabled);
  const [busy, setBusy] = useState(false);

  const toggle = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (value) {
        const granted = await requestNotificationAuthorization();
        if (!granted) {
          Alert.alert('Notifications are off', 'Allow notifications for Fud AI in system settings to get meal reminders.', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ]);
          setPreferences({ notificationsEnabled: false });
          return;
        }
        await scheduleMealReminders();
        setPreferences({ notificationsEnabled: true });
      } else {
        await cancelMealReminders();
        setPreferences({ notificationsEnabled: false });
      }
    } catch (error) {
      Alert.alert('Reminders', error instanceof Error ? error.message : 'Could not update meal reminders.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, backgroundColor: theme.colors.appBackground }}>
      <SettingsSection header="Meal Reminders" footer="Gentle local reminders at meal times. Nothing is sent to a server.">
        <SettingsToggleRow icon="bell" title="Meal Reminders" value={enabled} onValueChange={(v) => void toggle(v)} />
      </SettingsSection>
      {enabled ? (
        <SettingsSection header="Schedule" footer="Custom times, water and fasting reminders are being ported from the native apps.">
          {defaultMealReminders.map((reminder) => (
            <SettingsRow key={reminder.id} title={reminder.title} value={formatTime(reminder.hour, reminder.minute)} chevron={false} />
          ))}
        </SettingsSection>
      ) : null}
    </ScrollView>
  );
}
