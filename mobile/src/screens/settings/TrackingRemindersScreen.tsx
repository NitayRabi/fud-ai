import { ScrollView } from 'react-native';

import { Screen } from '../../components/primitives';
import { SettingsRow, SettingsSection, SettingsToggleRow } from '../../components/SettingsRow';
import { fastingSettings, formatFastGoal } from '../../domain/fasting/fasting';
import { formatWater, waterSettings, waterUnitTitle } from '../../domain/water/water';
import { setPreferences, usePreferences } from '../../state/appStores';
import { useTheme } from '../../theme';

/** Settings → Tracking & Reminders: water and fasting toggles that drive the Home pillar/menu. */
export function TrackingRemindersScreen() {
  const theme = useTheme();
  const prefs = usePreferences((p) => p);

  const cycle = <T,>(options: readonly T[], current: T): T => {
    const index = options.indexOf(current);
    return options[(index + 1) % options.length] ?? current;
  };

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}>
        <SettingsSection header="Water" footer="Water shows as the fourth Home bar and in the diary. Previously logged water stays visible when tracking is off.">
          <SettingsToggleRow icon="drop.fill" title="Track Water" value={prefs.waterTrackingEnabled} onValueChange={(v) => setPreferences({ waterTrackingEnabled: v })} />
          <SettingsRow
            title="Daily Goal"
            value={formatWater(prefs.waterUnit, prefs.waterDailyGoalMl)}
            onPress={() => setPreferences({ waterDailyGoalMl: cycle(waterSettings.dailyGoalOptions, prefs.waterDailyGoalMl) })}
            chevron={false}
          />
          <SettingsRow title="Unit" value={waterUnitTitle(prefs.waterUnit)} onPress={() => setPreferences({ waterUnit: prefs.waterUnit === 'ml' ? 'floz' : 'ml' })} chevron={false} />
        </SettingsSection>

        <SettingsSection header="Fasting" footer="Start and end fasts from the Home “+” menu. Food logging pauses while a fast is active.">
          <SettingsToggleRow icon="timer" title="Track Fasting" value={prefs.fastingTrackingEnabled} onValueChange={(v) => setPreferences({ fastingTrackingEnabled: v })} />
          <SettingsRow
            title="Default Goal"
            value={formatFastGoal(prefs.fastingDefaultGoalMinutes)}
            onPress={() =>
              setPreferences({
                fastingDefaultGoalMinutes: cycle(fastingSettings.commonGoalHours.map((h) => h * 60), prefs.fastingDefaultGoalMinutes),
              })
            }
            chevron={false}
          />
        </SettingsSection>
      </ScrollView>
    </Screen>
  );
}
