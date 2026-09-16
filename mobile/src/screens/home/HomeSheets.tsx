import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { fastingSettings, formatFastGoal } from '../../domain/fasting/fasting';
import { mealTypeDisplayName, mealTypes, type MealType, type NewFoodEntryInput } from '../../domain/food/food';
import { formatWater, millilitersFromDisplayedValue, waterDisplayValue, waterSettings, waterUnitSymbol, type WaterUnit } from '../../domain/water/water';
import { useTheme } from '../../theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Icon, type SFSymbolName } from '../../components/Icon';
import { AppText, Card, Divider, PrimaryButton, Row } from '../../components/primitives';

// MARK: - Add menu

export type AddMenuAction =
  | { kind: 'startFast' }
  | { kind: 'endFast' }
  | { kind: 'cancelFast' }
  | { kind: 'water'; milliliters: number }
  | { kind: 'waterCustom' }
  | { kind: 'food'; method: 'camera' | 'label' | 'text' | 'voice' | 'barcode' | 'manual' | 'saved' };

interface AddMenuSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onAction: (action: AddMenuAction) => void;
  fastingTrackingEnabled: boolean;
  waterTrackingEnabled: boolean;
  hasActiveFast: boolean;
  waterUnit: WaterUnit;
}

function MenuRow({ icon, title, subtitle, onPress, destructive }: { icon: SFSymbolName; title: string; subtitle?: string; onPress: () => void; destructive?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.fill : 'transparent' })}>
      <Row style={{ gap: 12, paddingHorizontal: theme.spacing.lg, minHeight: 48, paddingVertical: 8 }}>
        <View style={{ width: 24, alignItems: 'center' }}>
          <Icon name={icon} size={20} color={destructive ? theme.colors.destructive : theme.colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="500" tone={destructive ? 'destructive' : 'primary'}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </Row>
    </Pressable>
  );
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <Divider style={{ marginLeft: theme.spacing.lg + 36 }} /> : null}
          {row}
        </React.Fragment>
      ))}
    </Card>
  );
}

/** The Home "+" menu, mirroring the iOS `Menu` sections: fasting, water, then food methods. */
export function AddMenuSheet({ visible, onDismiss, onAction, fastingTrackingEnabled, waterTrackingEnabled, hasActiveFast, waterUnit }: AddMenuSheetProps) {
  const act = (action: AddMenuAction) => {
    onDismiss();
    onAction(action);
  };
  const glasses = (n: number) => `${n} ${n === 1 ? 'Glass' : 'Glasses'} (~${formatWater(waterUnit, n * 250)})`;
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="Add">
      {fastingTrackingEnabled ? (
        <MenuGroup>
          {hasActiveFast ? (
            <MenuRow icon="stop.fill" title="End Fast" onPress={() => act({ kind: 'endFast' })} />
          ) : (
            <MenuRow icon="timer" title="Start Fast" onPress={() => act({ kind: 'startFast' })} />
          )}
          {hasActiveFast ? <MenuRow icon="trash" title="Cancel Fast" destructive onPress={() => act({ kind: 'cancelFast' })} /> : null}
        </MenuGroup>
      ) : null}
      {waterTrackingEnabled ? (
        <MenuGroup>
          {[...waterSettings.quickAddMilliliters].reverse().map((ml) => (
            <MenuRow key={ml} icon="drop.fill" title={glasses(ml / 250)} onPress={() => act({ kind: 'water', milliliters: ml })} />
          ))}
          <MenuRow icon="slider.horizontal.3" title="Custom" onPress={() => act({ kind: 'waterCustom' })} />
        </MenuGroup>
      ) : null}
      {!hasActiveFast ? (
        <MenuGroup>
          <MenuRow icon="camera" title="Scan Food" subtitle="Photo of your meal" onPress={() => act({ kind: 'food', method: 'camera' })} />
          <MenuRow icon="doc.text.viewfinder" title="Scan Label" subtitle="Nutrition facts" onPress={() => act({ kind: 'food', method: 'label' })} />
          <MenuRow icon="barcode" title="Scan Barcode" onPress={() => act({ kind: 'food', method: 'barcode' })} />
          <MenuRow icon="text.bubble" title="Describe Meal" onPress={() => act({ kind: 'food', method: 'text' })} />
          <MenuRow icon="mic" title="Voice" onPress={() => act({ kind: 'food', method: 'voice' })} />
          <MenuRow icon="clock.arrow.circlepath" title="Saved Meals" onPress={() => act({ kind: 'food', method: 'saved' })} />
          <MenuRow icon="square.and.pencil" title="Manual Entry" onPress={() => act({ kind: 'food', method: 'manual' })} />
        </MenuGroup>
      ) : (
        <AppText variant="footnote" tone="secondary" align="center">
          End or cancel your fast to log food.
        </AppText>
      )}
    </BottomSheet>
  );
}

// MARK: - Water custom amount

interface WaterCustomSheetProps {
  visible: boolean;
  unit: WaterUnit;
  onDismiss: () => void;
  onAdd: (milliliters: number) => void;
}

export function WaterCustomSheet({ visible, unit, onDismiss, onAdd }: WaterCustomSheetProps) {
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const parsed = Number.parseFloat(amount.replace(',', '.'));
  const milliliters = Number.isFinite(parsed) && parsed > 0 ? millilitersFromDisplayedValue(unit, parsed) : undefined;
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="How much water?">
      <Card>
        <Row style={{ gap: 8 }}>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
            keyboardType={unit === 'ml' ? 'number-pad' : 'decimal-pad'}
            placeholder="Custom amount"
            placeholderTextColor={theme.colors.placeholder}
            style={[theme.text.title2, { flex: 1, color: theme.colors.label, paddingVertical: 4 }]}
            autoFocus
          />
          <AppText variant="headline" tone="secondary">
            {waterUnitSymbol(unit)}
          </AppText>
        </Row>
      </Card>
      <PrimaryButton
        title={milliliters ? `Add ${formatWater(unit, milliliters)}` : 'Add Water'}
        disabled={!milliliters}
        onPress={() => {
          if (!milliliters) return;
          onAdd(milliliters);
          setAmount('');
        }}
      />
    </BottomSheet>
  );
}

// MARK: - Fasting start

interface FastingStartSheetProps {
  visible: boolean;
  defaultGoalMinutes: number;
  onDismiss: () => void;
  onStart: (goalMinutes: number) => void;
}

export function FastingStartSheet({ visible, defaultGoalMinutes, onDismiss, onStart }: FastingStartSheetProps) {
  const theme = useTheme();
  const [goalMinutes, setGoalMinutes] = useState(defaultGoalMinutes);
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="Start Fast">
      <AppText variant="subheadline" tone="secondary">
        Choose a goal. You can end the fast any time from Home.
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {fastingSettings.commonGoalHours.map((hours) => {
          const minutes = hours * 60;
          const selected = minutes === goalMinutes;
          return (
            <Pressable
              key={hours}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setGoalMinutes(minutes)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: theme.radii.pill,
                backgroundColor: selected ? theme.colors.accent : theme.accentAlpha(0.12),
              }}
            >
              <AppText variant="subheadlineSemibold" tone={selected ? 'onAccent' : 'accent'}>
                {formatFastGoal(minutes)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton title={`Start ${formatFastGoal(goalMinutes)} Fast`} onPress={() => onStart(goalMinutes)} />
    </BottomSheet>
  );
}

// MARK: - Manual food entry

interface ManualEntrySheetProps {
  visible: boolean;
  logDate: Date;
  onDismiss: () => void;
  onSave: (input: NewFoodEntryInput) => void;
}

export function ManualEntrySheet({ visible, logDate, onDismiss, onSave }: ManualEntrySheetProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [meal, setMeal] = useState<MealType | undefined>(undefined);

  const number = (v: string) => {
    const n = Number.parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const canSave = name.trim().length > 0 && calories.trim().length > 0;

  const reset = () => {
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMeal(undefined);
  };

  const field = (label: string, value: string, onChange: (v: string) => void, unit?: string) => (
    <Row style={{ gap: 12, minHeight: 44 }}>
      <AppText variant="body" style={{ width: 88 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9.,]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.colors.placeholder}
        style={[theme.text.body, { flex: 1, textAlign: 'right', color: theme.colors.label }]}
      />
      {unit ? (
        <AppText variant="body" tone="secondary">
          {unit}
        </AppText>
      ) : null}
    </Row>
  );

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="Manual Entry">
      <Card style={{ gap: 4 }}>
        <Row style={{ gap: 12, minHeight: 44 }}>
          <AppText variant="body" style={{ width: 88 }}>
            Name
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Greek yogurt"
            placeholderTextColor={theme.colors.placeholder}
            style={[theme.text.body, { flex: 1, textAlign: 'right', color: theme.colors.label }]}
          />
        </Row>
        <Divider />
        {field('Calories', calories, setCalories, 'kcal')}
        <Divider />
        {field('Protein', protein, setProtein, 'g')}
        <Divider />
        {field('Carbs', carbs, setCarbs, 'g')}
        <Divider />
        {field('Fat', fat, setFat, 'g')}
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {mealTypes.map((m) => {
          const selected = m === meal;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setMeal(selected ? undefined : m)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: selected ? theme.colors.accent : theme.accentAlpha(0.12) }}
            >
              <AppText variant="footnoteSemibold" tone={selected ? 'onAccent' : 'accent'}>
                {mealTypeDisplayName(m)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton
        title="Save"
        disabled={!canSave}
        onPress={() => {
          onSave({
            name: name.trim(),
            calories: Math.round(number(calories)),
            protein: number(protein),
            carbs: number(carbs),
            fat: number(fat),
            source: 'manual',
            timestamp: logDate.toISOString(),
            ...(meal ? { mealType: meal } : {}),
          });
          reset();
        }}
      />
    </BottomSheet>
  );
}

// MARK: - Nutrition detail (Home "View More")

interface NutritionDetailSheetProps {
  visible: boolean;
  date: Date;
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  waterEnabled: boolean;
  waterMilliliters: number;
  waterGoalMilliliters: number;
  waterUnit: WaterUnit;
  /** Extra nutrient rows already formatted for display. */
  detailRows: readonly { id: string; label: string; value: string; unit: string; goal?: string }[];
  onDismiss: () => void;
}

function NutritionRow({ icon, label, value, unit, goal }: { icon: SFSymbolName; label: string; value: string; unit: string; goal?: string }) {
  const theme = useTheme();
  return (
    <Row style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, gap: 12 }}>
      <Icon name={icon} size={18} color={theme.colors.accent} />
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText variant="bodySemibold">
          {value}
          <AppText variant="caption" tone="secondary">
            {' '}
            {unit}
          </AppText>
        </AppText>
        {goal ? (
          <AppText variant="caption2" tone="secondary">
            of {goal}
          </AppText>
        ) : null}
      </View>
    </Row>
  );
}

/** Reduced `NutritionDetailView` — macros + optional nutrients for the selected day. */
export function NutritionDetailSheet({
  visible,
  date,
  calories,
  calorieGoal,
  protein,
  proteinGoal,
  carbs,
  carbsGoal,
  fat,
  fatGoal,
  waterEnabled,
  waterMilliliters,
  waterGoalMilliliters,
  waterUnit,
  detailRows,
  onDismiss,
}: NutritionDetailSheetProps) {
  const theme = useTheme();
  const dayLabel = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const waterUnitLabel = waterUnitSymbol(waterUnit);
  return (
    <BottomSheet visible={visible} title="Nutrition" onDismiss={onDismiss} detent="large" surface="background">
      <AppText variant="subheadline" tone="secondary">
        {dayLabel}
      </AppText>
      {waterEnabled ? (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <NutritionRow
            icon="drop.fill"
            label="Water"
            value={waterDisplayValue(waterUnit, waterMilliliters)}
            unit={waterUnitLabel}
            goal={`${waterDisplayValue(waterUnit, waterGoalMilliliters)} ${waterUnitLabel}`}
          />
        </Card>
      ) : null}
      <View style={{ gap: 6 }}>
        <AppText variant="footnote" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 4 }}>
          Macros
        </AppText>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <NutritionRow icon="flame.fill" label="Calories" value={calories.toLocaleString()} unit="kcal" goal={`${calorieGoal.toLocaleString()} kcal`} />
          <Divider style={{ marginLeft: theme.spacing.lg + 30 }} />
          <NutritionRow icon="p.circle.fill" label="Protein" value={String(Math.round(protein))} unit="g" goal={`${proteinGoal} g`} />
          <Divider style={{ marginLeft: theme.spacing.lg + 30 }} />
          <NutritionRow icon="c.circle.fill" label="Carbs" value={String(Math.round(carbs))} unit="g" goal={`${carbsGoal} g`} />
          <Divider style={{ marginLeft: theme.spacing.lg + 30 }} />
          <NutritionRow icon="f.circle.fill" label="Fat" value={String(Math.round(fat))} unit="g" goal={`${fatGoal} g`} />
        </Card>
      </View>
      {detailRows.length > 0 ? (
        <View style={{ gap: 6 }}>
          <AppText variant="footnote" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 4 }}>
            Detailed Nutrition
          </AppText>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {detailRows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider style={{ marginLeft: theme.spacing.lg + 30 }} /> : null}
                <NutritionRow icon="list.bullet.circle" label={row.label} value={row.value} unit={row.unit} goal={row.goal} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </BottomSheet>
  );
}
