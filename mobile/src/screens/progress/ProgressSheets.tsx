/**
 * Progress sheets: `LogWeightSheet`, `LogBodyFatSheet`, `AllWeightHistoryView` and
 * `AllBodyFatHistoryView` from `ProgressComponents.swift`. The wheel pickers become a
 * stepper + numeric field so the sheet is identical on both platforms.
 */

import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { AppText, Card, Divider, PrimaryButton, Row } from '../../components/primitives';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StepperField } from '../../components/StepperField';
import {
  bodyFatLimits,
  displayWeight,
  formatBodyFat,
  formatWeight,
  isValidBodyFatFraction,
  isValidWeightKg,
  weightKgFromDisplay,
  weightLimitsKg,
  type BodyFatEntry,
  type WeightEntry,
} from '../../domain/body/bodyState';
import type { WeightUnit } from '../../domain/prefs/preferences';
import { useTheme } from '../../theme';

// MARK: - Log weight

interface LogWeightSheetProps {
  visible: boolean;
  currentWeightKg: number;
  unit: WeightUnit;
  onChangeUnit: (unit: WeightUnit) => void;
  onDismiss: () => void;
  onSave: (weightKg: number) => void;
}

export function LogWeightSheet({ visible, currentWeightKg, unit, onChangeUnit, onDismiss, onSave }: LogWeightSheetProps) {
  const useMetric = unit === 'kg';
  const [value, setValue] = useState(() => displayWeight(currentWeightKg, useMetric).toFixed(1));
  const parsed = Number.parseFloat(value.replace(',', '.'));
  const kg = Number.isFinite(parsed) ? weightKgFromDisplay(parsed, useMetric) : Number.NaN;
  const valid = isValidWeightKg(kg);

  const switchUnit = (next: WeightUnit) => {
    if (next === unit) return;
    // Convert the value being edited so toggling mid-edit keeps it, clamped to the wheel bounds.
    const currentKg = Number.isFinite(parsed) ? weightKgFromDisplay(parsed, useMetric) : currentWeightKg;
    const clamped = Math.min(weightLimitsKg.max, Math.max(weightLimitsKg.min, currentKg));
    setValue(displayWeight(clamped, next === 'kg').toFixed(1));
    onChangeUnit(next);
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="Log Weight">
      <SegmentedControl<WeightUnit> segments={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]} selected={unit} onSelect={switchUnit} />
      <View style={{ paddingVertical: 12 }}>
        <StepperField value={value} onChange={setValue} step={0.1} unit={useMetric ? 'kg' : 'lbs'} accessibilityLabel="Weight" />
      </View>
      {!valid && value.length > 0 ? (
        <AppText variant="footnote" tone="destructive" align="center">
          Enter a weight between {formatWeight(weightLimitsKg.min, useMetric, 0)} and {formatWeight(weightLimitsKg.max, useMetric, 0)}.
        </AppText>
      ) : null}
      <PrimaryButton title="Save" disabled={!valid} onPress={() => onSave(kg)} />
    </BottomSheet>
  );
}

// MARK: - Log body fat

interface LogBodyFatSheetProps {
  visible: boolean;
  currentFraction: number;
  onDismiss: () => void;
  onSave: (fraction: number) => void;
}

export function LogBodyFatSheet({ visible, currentFraction, onDismiss, onSave }: LogBodyFatSheetProps) {
  const [value, setValue] = useState(() => (currentFraction * 100).toFixed(1));
  const parsed = Number.parseFloat(value.replace(',', '.'));
  const fraction = Number.isFinite(parsed) ? parsed / 100 : Number.NaN;
  const valid = isValidBodyFatFraction(fraction);
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="Log Body Fat">
      <View style={{ paddingVertical: 12 }}>
        <StepperField value={value} onChange={setValue} step={0.1} unit="%" accessibilityLabel="Body fat percentage" />
      </View>
      <AppText variant="caption" tone="secondary" align="center">
        Common ranges: Men 10–25%, Women 18–35%
      </AppText>
      {!valid && value.length > 0 ? (
        <AppText variant="footnote" tone="destructive" align="center">
          Enter a value between {bodyFatLimits.min * 100}% and {bodyFatLimits.max * 100}%.
        </AppText>
      ) : null}
      <PrimaryButton title="Save" disabled={!valid} onPress={() => onSave(fraction)} />
    </BottomSheet>
  );
}

// MARK: - History lists

interface HistorySheetProps<T extends { id: string; date: string }> {
  visible: boolean;
  title: string;
  entries: readonly T[];
  format: (entry: T) => string;
  onDismiss: () => void;
  onDelete: (entry: T) => void;
}

function HistorySheet<T extends { id: string; date: string }>({ visible, title, entries, format, onDismiss, onDelete }: HistorySheetProps<T>) {
  const theme = useTheme();
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const confirmDelete = (entry: T) =>
    Alert.alert('Delete entry?', format(entry), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry) },
    ]);
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title={title}>
      <AppText variant="footnote" tone="secondary">
        {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'} · tap to delete
      </AppText>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {sorted.map((entry, index) => (
          <View key={entry.id}>
            {index > 0 ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
            <Pressable accessibilityRole="button" onPress={() => confirmDelete(entry)} style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.fill : 'transparent' })}>
              <Row style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, justifyContent: 'space-between' }}>
                <AppText variant="body">{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</AppText>
                <AppText variant="bodySemibold" tone="accent">
                  {format(entry)}
                </AppText>
              </Row>
            </Pressable>
          </View>
        ))}
      </Card>
    </BottomSheet>
  );
}

export function WeightHistorySheet(props: Omit<HistorySheetProps<WeightEntry>, 'title' | 'format'> & { useMetric: boolean }) {
  const { useMetric, ...rest } = props;
  return <HistorySheet<WeightEntry> title="Weight History" format={(e) => formatWeight(e.weightKg, useMetric)} {...rest} />;
}

export function BodyFatHistorySheet(props: Omit<HistorySheetProps<BodyFatEntry>, 'title' | 'format'>) {
  return <HistorySheet<BodyFatEntry> title="Body Fat History" format={(e) => formatBodyFat(e.bodyFatFraction)} {...props} />;
}
