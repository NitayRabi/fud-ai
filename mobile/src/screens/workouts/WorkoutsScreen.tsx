/**
 * Workouts tab. Mirrors `WorkoutsView.swift`: a persisted Log / Library mode
 * (`WorkoutTabMode`, default Log), the strength log for today (`WorkoutLogView` reduced to
 * exercises with weight / reps / RPE sets, add from the library, Finish with a burn estimate,
 * and recent sessions) and the exercise library browser. Same layout and AppColors on both
 * platforms.
 */

import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { AppText, Card, Divider, PrimaryButton, Row, Screen, SecondaryButton } from '../../components/primitives';
import { SegmentedControl } from '../../components/SegmentedControl';
import { latestWeight } from '../../domain/body/bodyState';
import { dayKey } from '../../domain/dates';
import type { ExerciseLibraryItem } from '../../domain/workouts/exerciseLibrary';
import {
  completedSessions,
  durationMinutes,
  finishDraft,
  performedSetCount,
  repCount,
  rpeScaleTitle,
  rpeScales,
  type DraftExercise,
  type DraftSet,
  type RPEScale,
  type WorkoutSession,
} from '../../domain/workouts/workoutSessions';
import type { WeightUnit } from '../../domain/prefs/preferences';
import { newId, setPreferences, useBody, usePreferences, useProfile, useWorkouts, workoutsStore } from '../../state/appStores';
import { useTheme } from '../../theme';
import { ExerciseLibrary } from './ExerciseLibrary';

type Mode = 'log' | 'library';

export function WorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? insets.bottom;
  const [mode, setMode] = useState<Mode>('log');
  const [picking, setPicking] = useState(false);
  const profile = useProfile((p) => p);
  const today = dayKey(new Date());

  const pickExercise = (item: ExerciseLibraryItem) => {
    const exercise: DraftExercise = {
      id: newId(),
      itemID: item.id,
      name: item.name,
      targetMuscles: item.primaryMuscles,
      equipment: item.equipment,
      category: item.category,
      sets: [{ id: newId(), weight: '', reps: '', rpe: '' }],
    };
    workoutsStore.dispatch({ type: 'draft/addExercise', dayKey: today, exercise, startedAt: new Date().toISOString() });
    setPicking(false);
    setMode('log');
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 10 }}>
        <Row style={{ justifyContent: 'center', minHeight: 32 }}>
          <AppText variant="headline">{picking ? 'Add Exercise' : 'Workouts'}</AppText>
          {picking ? (
            <Pressable accessibilityRole="button" onPress={() => setPicking(false)} style={{ position: 'absolute', right: 0 }}>
              <AppText variant="bodySemibold" tone="accent">
                Done
              </AppText>
            </Pressable>
          ) : null}
        </Row>
        {!picking ? (
          <SegmentedControl<Mode>
            segments={[
              { value: 'log', label: 'Log' },
              { value: 'library', label: 'Library' },
            ]}
            selected={mode}
            onSelect={setMode}
            accessibilityLabel="Workouts mode"
          />
        ) : null}
      </View>
      {picking || mode === 'library' ? (
        <ExerciseLibrary sex={profile.gender === 'female' ? 'female' : 'male'} onPick={pickExercise} bottomInset={tabBarHeight} />
      ) : (
        <WorkoutLog dayKey={today} onAddExercise={() => setPicking(true)} bottomInset={tabBarHeight} />
      )}
    </Screen>
  );
}

// MARK: - Log

function WorkoutLog({ dayKey: today, onAddExercise, bottomInset }: { dayKey: string; onAddExercise: () => void; bottomInset: number }) {
  const theme = useTheme();
  const workouts = useWorkouts((s) => s);
  const body = useBody((s) => s);
  const profile = useProfile((p) => p);
  const prefs = usePreferences((p) => p);
  const draft = workouts.drafts[today];
  const sessions = useMemo(() => completedSessions(workouts), [workouts]);
  const preferences = { ...workouts.preferences, weightUnit: prefs.weightUnit };
  const performed = draft?.exercises.flatMap((e) => e.sets).filter((s) => s.reps.trim().length > 0).length ?? 0;

  const finish = () => {
    if (!draft || performed === 0) return;
    const session = finishDraft(draft, newId, new Date(), preferences, latestWeight(body)?.weightKg ?? profile.weightKg);
    workoutsStore.dispatch({ type: 'session/finish', dayKey: today, session });
    Alert.alert('Workout saved', session.caloriesBurned ? `${performedSetCount(session)} sets · ${repCount(session)} reps · ~${session.caloriesBurned} kcal estimated` : `${performedSetCount(session)} sets · ${repCount(session)} reps`);
  };

  const discard = () =>
    Alert.alert('Discard workout?', 'This removes every exercise you added today.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => workoutsStore.dispatch({ type: 'draft/discard', dayKey: today }) },
    ]);

  const cycleScale = () => {
    const index = rpeScales.indexOf(workouts.preferences.rpeScale);
    const next: RPEScale = rpeScales[(index + 1) % rpeScales.length] ?? 'strength';
    workoutsStore.dispatch({ type: 'preferences/update', patch: { rpeScale: next } });
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: bottomInset + 32 }} scrollIndicatorInsets={{ bottom: bottomInset }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <AppText variant="title2">Today</AppText>
          <AppText variant="subheadline" tone="secondary">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </AppText>
        </View>
        <Row style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Weight unit" onPress={() => setPreferences({ weightUnit: prefs.weightUnit === 'kg' ? 'lbs' : 'kg' })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.accentAlpha(0.12) }}>
            <AppText variant="footnoteSemibold" tone="accent">
              {prefs.weightUnit}
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="RPE scale" onPress={cycleScale} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.accentAlpha(0.12) }}>
            <AppText variant="footnoteSemibold" tone="accent">
              {rpeScaleTitle(workouts.preferences.rpeScale)}
            </AppText>
          </Pressable>
        </Row>
      </Row>

      {!draft || draft.exercises.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.accentAlpha(0.12), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="figure.strengthtraining.traditional" size={32} color={theme.colors.accent} />
          </View>
          <AppText variant="headline">Start today's workout</AppText>
          <AppText variant="subheadline" tone="secondary" align="center">
            Add exercises from the library, log weight, reps and RPE per set, then finish to save it to your diary.
          </AppText>
          <PrimaryButton title="Add Exercise" style={{ alignSelf: 'stretch' }} onPress={onAddExercise} />
        </Card>
      ) : (
        <>
          {draft.exercises.map((exercise) => (
            <DraftExerciseCard key={exercise.id} dayKey={today} exercise={exercise} weightUnit={prefs.weightUnit} rpeScale={workouts.preferences.rpeScale} />
          ))}
          <SecondaryButton title="Add Exercise" onPress={onAddExercise} />
          <PrimaryButton title={performed > 0 ? `Finish Workout · ${performed} ${performed === 1 ? 'set' : 'sets'}` : 'Finish Workout'} disabled={performed === 0} onPress={finish} />
          <Pressable accessibilityRole="button" onPress={discard} style={{ alignSelf: 'center' }}>
            <AppText variant="footnoteSemibold" tone="destructive">
              Discard
            </AppText>
          </Pressable>
        </>
      )}

      {sessions.length > 0 ? (
        <View style={{ gap: 6 }}>
          <AppText variant="footnote" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 4 }}>
            History
          </AppText>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {sessions.slice(0, 20).map((session, index) => (
              <View key={session.id}>
                {index > 0 ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
                <SessionRow session={session} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const theme = useTheme();
  const remove = () =>
    Alert.alert('Delete workout?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => workoutsStore.dispatch({ type: 'session/delete', id: session.id }) },
    ]);
  return (
    <Pressable accessibilityRole="button" onLongPress={remove} onPress={() => Alert.alert(session.exercises.map((e) => `${e.name} · ${e.sets.length} sets`).join('\n') || 'Workout', undefined, [{ text: 'Delete', style: 'destructive', onPress: remove }, { text: 'Close', style: 'cancel' }])}>
      <Row style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 12, gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="body" weight="500">
            {new Date(session.diaryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {session.exercises.map((e) => e.name).join(', ')}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {performedSetCount(session)} sets · {repCount(session)} reps · {durationMinutes(session)} min
          </AppText>
        </View>
        {session.caloriesBurned ? (
          <AppText variant="subheadlineSemibold" tone="accent">
            ~{session.caloriesBurned} kcal
          </AppText>
        ) : null}
      </Row>
    </Pressable>
  );
}

function DraftExerciseCard({ dayKey: today, exercise, weightUnit, rpeScale }: { dayKey: string; exercise: DraftExercise; weightUnit: WeightUnit; rpeScale: RPEScale }) {
  const theme = useTheme();
  const update = (set: DraftSet) => workoutsStore.dispatch({ type: 'draft/updateSet', dayKey: today, exerciseId: exercise.id, set });
  const rpeHint = rpeScale === 'borg' ? '6–20' : rpeScale === 'cr10' ? '0–10' : '1–10';
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="headline" numberOfLines={2}>
            {exercise.name}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {[...exercise.targetMuscles, exercise.equipment].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove exercise"
          onPress={() => workoutsStore.dispatch({ type: 'draft/removeExercise', dayKey: today, exerciseId: exercise.id })}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="trash" size={18} color={theme.colors.destructive} />
        </Pressable>
      </Row>
      <Row style={{ gap: 8, paddingHorizontal: 4 }}>
        <AppText variant="caption2Semibold" tone="secondary" style={{ width: 32 }}>
          SET
        </AppText>
        <AppText variant="caption2Semibold" tone="secondary" style={{ flex: 1, textAlign: 'center' }}>
          {weightUnit.toUpperCase()}
        </AppText>
        <AppText variant="caption2Semibold" tone="secondary" style={{ flex: 1, textAlign: 'center' }}>
          REPS
        </AppText>
        <AppText variant="caption2Semibold" tone="secondary" style={{ flex: 1, textAlign: 'center' }}>
          RPE {rpeHint}
        </AppText>
        <View style={{ width: 28 }} />
      </Row>
      {exercise.sets.map((set, index) => (
        <Row key={set.id} style={{ gap: 8, paddingHorizontal: 4 }}>
          <AppText variant="subheadlineSemibold" style={{ width: 32 }}>
            {index + 1}
          </AppText>
          <SetField value={set.weight} placeholder="—" onChange={(weight) => update({ ...set, weight })} />
          <SetField value={set.reps} placeholder="0" onChange={(reps) => update({ ...set, reps: reps.replace(/[^0-9]/g, '') })} />
          <SetField value={set.rpe} placeholder="—" onChange={(rpe) => update({ ...set, rpe })} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove set"
            onPress={() => workoutsStore.dispatch({ type: 'draft/removeSet', dayKey: today, exerciseId: exercise.id, setId: set.id })}
            style={{ width: 28, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="minus" size={16} color={theme.colors.secondaryLabel} />
          </Pressable>
        </Row>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const last = exercise.sets[exercise.sets.length - 1];
          workoutsStore.dispatch({ type: 'draft/addSet', dayKey: today, exerciseId: exercise.id, set: { id: newId(), weight: last?.weight ?? '', reps: '', rpe: last?.rpe ?? '' } });
        }}
        style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
      >
        <Row style={{ gap: 6 }}>
          <Icon name="plus.circle.fill" size={16} color={theme.colors.accent} />
          <AppText variant="subheadlineSemibold" tone="accent">
            Add Set
          </AppText>
        </Row>
      </Pressable>
    </Card>
  );
}

function SetField({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(/[^0-9.,]/g, ''))}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={theme.colors.placeholder}
      selectTextOnFocus
      style={[theme.text.body, { flex: 1, height: 36, textAlign: 'center', color: theme.colors.label, borderRadius: 8, backgroundColor: theme.colors.fill, paddingVertical: 0 }]}
    />
  );
}
