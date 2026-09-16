/**
 * Settings → Health & Data. Mirrors the Health section of `ProfileComponents.swift`
 * (`healthData` category): the Health sync switch, companion status rows (Watch, widgets,
 * Siri) and Data Management actions. Every companion states plainly that it is native-only.
 */

import { Alert, Platform, ScrollView, View } from 'react-native';

import { AppText, Card } from '../../components/primitives';
import { SettingsRow, SettingsSection, SettingsToggleRow } from '../../components/SettingsRow';
import { companionAvailabilityLabel, companionStatuses, healthServiceName } from '../../domain/integrations/companions';
import { bodyStore, chatStore, diaryStore, setPreferences, usePreferences, workoutsStore } from '../../state/appStores';
import { useTheme } from '../../theme';

const platform = Platform.OS === 'ios' ? 'ios' : 'android';

export function HealthDataScreen() {
  const theme = useTheme();
  const prefs = usePreferences((p) => p);
  const statuses = companionStatuses(platform, { health: false });
  const health = healthServiceName(platform);

  const clearAll = () =>
    Alert.alert('Clear all data?', 'Deletes your food, water, fasting, weight, body-fat, workout and Coach history on this device. Your profile and settings stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          diaryStore.dispatch({ type: 'clearAll' });
          bodyStore.dispatch({ type: 'clearAll' });
          workoutsStore.dispatch({ type: 'clearAll' });
          chatStore.dispatch({ type: 'reset' });
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, backgroundColor: theme.colors.appBackground }}>
      <SettingsSection
        header={health}
        footer={`Turning this on records your intent. The shared app cannot read or write ${health} yet; the native app syncs nutrition, weight and measurements when this is enabled there.`}
      >
        <SettingsToggleRow icon="heart.fill" title={`Sync with ${health}`} value={prefs.healthKitEnabled} onValueChange={(v) => setPreferences({ healthKitEnabled: v })} />
      </SettingsSection>

      <SettingsSection header="Companions">
        {statuses
          .filter((s) => s.id !== 'health')
          .map((status) => (
            <View key={status.id}>
              <SettingsRow icon={status.id === 'watch' ? 'applewatch' : status.id === 'widgets' ? 'apps.iphone' : 'waveform'} title={status.title} value={companionAvailabilityLabel(status.availability)} chevron={false} />
              <AppText variant="caption" tone="secondary" style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: 10, marginTop: -4 }}>
                {status.detail}
              </AppText>
            </View>
          ))}
      </SettingsSection>

      <SettingsSection header="Data Management" footer="Export and import of the diary (DiaryExporter / DiaryImporter) and cloud backup stay in the native apps for now.">
        <SettingsRow icon="trash" title="Clear All Data" destructive onPress={clearAll} chevron={false} />
      </SettingsSection>

      <Card>
        <AppText variant="caption" tone="secondary">
          Everything you log stays on this device. Nothing here uploads data; the AI providers only receive what you send for analysis.
        </AppText>
      </Card>
    </ScrollView>
  );
}
