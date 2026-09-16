/**
 * Settings → Personal Info. Mirrors the `personalInfo` category in `ProfileComponents.swift`:
 * name, gender, birthday, height, weight and activity level, edited in place and saved to the
 * profile store (which re-derives the Home targets).
 */

import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { PickerSheet } from '../../components/PickerSheet';
import { PrimaryButton, Row, AppText } from '../../components/primitives';
import { SettingsRow, SettingsSection } from '../../components/SettingsRow';
import { StepperField } from '../../components/StepperField';
import { addWeighIn, newId, profileStore, setPreferences, usePreferences, useProfile } from '../../state/appStores';
import { displayWeight, formatWeight, isValidWeightKg, weightKgFromDisplay } from '../../domain/body/bodyState';
import { activityLevelDisplayName, activityLevels, ageYears, genderDisplayName, genders, type ActivityLevel, type Gender } from '../../domain/profile/userProfile';
import { useTheme } from '../../theme';

type Sheet = 'gender' | 'activity' | 'height' | 'weight' | 'birthYear' | null;

function formatHeight(cm: number, metric: boolean): string {
  if (metric) return `${Math.round(cm)} cm`;
  const totalInches = Math.round(cm / 2.54);
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
}

export function PersonalInfoScreen() {
  const theme = useTheme();
  const profile = useProfile((p) => p);
  const prefs = usePreferences((p) => p);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState('');
  const heightMetric = prefs.heightUnit === 'cm';
  const weightMetric = prefs.weightUnit === 'kg';
  // Same bounds the stepper advertises; typed values are validated against them on Save too.
  const heightLimits = heightMetric ? { min: 100, max: 250 } : { min: 39, max: 98 };
  const heightDraft = Number.parseInt(draft, 10);
  const heightInvalid = sheet === 'height' && (!Number.isFinite(heightDraft) || heightDraft < heightLimits.min || heightDraft > heightLimits.max);

  const update = (patch: Partial<typeof profile>) => profileStore.dispatch({ type: 'update', patch });

  const openNumeric = (which: 'height' | 'weight') => {
    setDraft(which === 'height' ? String(heightMetric ? Math.round(profile.heightCm) : Math.round(profile.heightCm / 2.54)) : displayWeight(profile.weightKg, weightMetric).toFixed(1));
    setSheet(which);
  };

  const birthYear = new Date(profile.birthday).getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - 10 - i));

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, backgroundColor: theme.colors.appBackground }}>
        <SettingsSection header="Profile">
          <SettingsRow
            icon="person.crop.circle"
            title="Name"
            chevron={false}
            trailing={
              <TextInput
                value={profile.name ?? ''}
                onChangeText={(name) => update({ name })}
                placeholder="Optional"
                placeholderTextColor={theme.colors.placeholder}
                style={[theme.text.body, { color: theme.colors.secondaryLabel, textAlign: 'right', minWidth: 120 }]}
              />
            }
          />
          <SettingsRow icon="figure.stand" title="Gender" value={genderDisplayName(profile.gender)} onPress={() => setSheet('gender')} />
          <SettingsRow icon="calendar" title="Birth Year" value={`${birthYear} · ${ageYears(profile)} yrs`} onPress={() => setSheet('birthYear')} />
        </SettingsSection>
        <SettingsSection header="Body" footer="Changing weight here also logs a weigh-in so Progress stays in sync.">
          <SettingsRow icon="figure.stand" title="Height" value={formatHeight(profile.heightCm, heightMetric)} onPress={() => openNumeric('height')} />
          <SettingsRow icon="scalemass.fill" title="Weight" value={formatWeight(profile.weightKg, weightMetric)} onPress={() => openNumeric('weight')} />
          <SettingsRow icon="figure.run" title="Activity Level" value={activityLevelDisplayName(profile.activityLevel)} onPress={() => setSheet('activity')} />
        </SettingsSection>
        <SettingsSection header="Units">
          <SettingsRow title="Height" value={heightMetric ? 'Centimeters' : 'Feet & inches'} chevron={false} onPress={() => setPreferences({ heightUnit: heightMetric ? 'ftin' : 'cm' })} />
          <SettingsRow title="Weight" value={weightMetric ? 'Kilograms' : 'Pounds'} chevron={false} onPress={() => setPreferences({ weightUnit: weightMetric ? 'lbs' : 'kg' })} />
        </SettingsSection>
      </ScrollView>

      <PickerSheet<Gender> visible={sheet === 'gender'} title="Gender" options={genders.map((g) => ({ value: g, label: genderDisplayName(g) }))} selected={profile.gender} onSelect={(gender) => update({ gender })} onDismiss={() => setSheet(null)} />
      <PickerSheet<ActivityLevel>
        visible={sheet === 'activity'}
        title="Activity Level"
        options={activityLevels.map((a) => ({ value: a, label: activityLevelDisplayName(a) }))}
        selected={profile.activityLevel}
        onSelect={(activityLevel) => update({ activityLevel })}
        onDismiss={() => setSheet(null)}
      />
      <PickerSheet<string>
        visible={sheet === 'birthYear'}
        title="Birth Year"
        options={years.map((y) => ({ value: y, label: y }))}
        selected={String(birthYear)}
        onSelect={(year) => {
          const date = new Date(profile.birthday);
          date.setFullYear(Number(year));
          update({ birthday: date.toISOString() });
        }}
        onDismiss={() => setSheet(null)}
      />

      <BottomSheet visible={sheet === 'height'} title="Height" onDismiss={() => setSheet(null)}>
        <StepperField value={draft} onChange={setDraft} step={1} unit={heightMetric ? 'cm' : 'in'} fractionDigits={0} integerOnly min={heightLimits.min} max={heightLimits.max} accessibilityLabel="Height" />
        {!heightMetric ? (
          <Row style={{ justifyContent: 'center' }}>
            <AppText variant="caption" tone="secondary">
              Total inches — {formatHeight((Number.parseInt(draft, 10) || 0) * 2.54, false)}
            </AppText>
          </Row>
        ) : null}
        {heightInvalid ? (
          <AppText variant="caption" tone="destructive" align="center">
            Enter a height between {heightLimits.min} and {heightLimits.max} {heightMetric ? 'cm' : 'in'}.
          </AppText>
        ) : null}
        <PrimaryButton
          title="Save"
          disabled={heightInvalid}
          onPress={() => {
            const n = Number.parseInt(draft, 10);
            if (!Number.isFinite(n) || n < heightLimits.min || n > heightLimits.max) return;
            update({ heightCm: heightMetric ? n : n * 2.54 });
            setSheet(null);
          }}
        />
      </BottomSheet>
      <BottomSheet visible={sheet === 'weight'} title="Weight" onDismiss={() => setSheet(null)}>
        <StepperField value={draft} onChange={setDraft} step={0.1} unit={weightMetric ? 'kg' : 'lbs'} accessibilityLabel="Weight" />
        <PrimaryButton
          title="Save"
          onPress={() => {
            const n = Number.parseFloat(draft.replace(',', '.'));
            const kg = weightKgFromDisplay(n, weightMetric);
            if (isValidWeightKg(kg)) {
              update({ weightKg: kg });
              // Saving an unchanged weight must not pollute the history with a duplicate weigh-in.
              if (Math.abs(kg - profile.weightKg) > 0.01) addWeighIn({ id: newId(), date: new Date().toISOString(), weightKg: kg });
            }
            setSheet(null);
          }}
        />
      </BottomSheet>
    </>
  );
}
