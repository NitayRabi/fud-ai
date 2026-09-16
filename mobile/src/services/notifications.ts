/**
 * Meal reminders. Mirrors `NotificationManager.swift` (`requestAuthorization`,
 * `scheduleMealReminders`): three repeating daily local notifications with the same ids and
 * copy. Local-only; no push token is ever requested.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface MealReminder {
  id: 'meal.breakfast' | 'meal.lunch' | 'meal.dinner';
  title: string;
  body: string;
  hour: number;
  minute: number;
}

export const defaultMealReminders: readonly MealReminder[] = [
  { id: 'meal.breakfast', title: 'Breakfast Time', body: "Don't forget to log your breakfast!", hour: 8, minute: 0 },
  { id: 'meal.lunch', title: 'Lunch Time', body: 'Snap a photo to keep tracking!', hour: 12, minute: 0 },
  { id: 'meal.dinner', title: 'Dinner Time', body: 'Log your dinner to stay on track!', hour: 19, minute: 0 },
];

const MEAL_CHANNEL = 'meal-reminders';

export async function requestNotificationAuthorization(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn('[fudai] notification permission request failed', error);
    return false;
  }
}

export async function scheduleMealReminders(reminders: readonly MealReminder[] = defaultMealReminders): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MEAL_CHANNEL, { name: 'Meal reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  await cancelMealReminders();
  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
        ...(Platform.OS === 'android' ? { channelId: MEAL_CHANNEL } : {}),
      },
    });
  }
}

export async function cancelMealReminders(): Promise<void> {
  await Promise.all(defaultMealReminders.map((r) => Notifications.cancelScheduledNotificationAsync(r.id).catch(() => undefined)));
}
