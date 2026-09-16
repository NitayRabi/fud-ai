import { describe, expect, it } from 'vitest';

import {
  emptyExerciseFilter,
  exerciseCatalog,
  exerciseFilterOptions,
  exerciseInstructions,
  filterExercises,
  frameURL,
  hasActiveFilters,
  metadataSummary,
  metadataTitle,
  representativeFrameURL,
} from '../src/domain/workouts/exerciseLibrary';
import {
  dailyBurn,
  estimateBurn,
  finishDraft,
  initialWorkoutsState,
  isReliableBurn,
  liftHistory,
  totalBurn,
  workoutsReducer,
  type CompletedExercise,
  type WorkoutDraft,
} from '../src/domain/workouts/workoutSessions';

describe('exercise catalog', () => {
  const catalog = exerciseCatalog();

  it('bundles the FreeExerciseDB corpus with Title Case metadata and CDN frame names', () => {
    expect(catalog.length).toBeGreaterThan(850);
    const situp = catalog.find((i) => i.id === '3_4_Sit-Up');
    expect(situp).toMatchObject({ name: '3/4 Sit-Up', level: 'Beginner', equipment: 'Body Only', category: 'Strength', primaryMuscles: ['Abdominals'] });
    expect(metadataSummary(situp!)).toBe('Strength - Pull - Compound');
    expect(representativeFrameURL(situp!, 'male')).toBe('https://assets.fud-ai.app/workout-vectors/v2/3_4_Sit-Up_male_v2_2.png');
    expect(frameURL(situp!, 'female', 9)).toBeUndefined();
    expect(exerciseInstructions('3_4_Sit-Up').length).toBeGreaterThan(3);
    expect(exerciseInstructions('nope')).toEqual([]);
    expect(catalog.map((i) => i.name)).toEqual([...catalog.map((i) => i.name)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  });

  it('title-cases metadata like ExerciseLibraryItem.metadataTitle', () => {
    expect(metadataTitle('e-z curl bar')).toBe('E-Z Curl Bar');
    expect(metadataTitle('  ')).toBe('Unspecified');
    expect(metadataTitle(null)).toBe('Unspecified');
  });

  it('filters by tokens and option sets, then sorts', () => {
    const options = exerciseFilterOptions(catalog);
    expect(options.levels).toEqual(['Beginner', 'Intermediate', 'Expert']);
    expect(options.equipment).toContain('Dumbbell');
    expect(options.primaryMuscles).toContain('Chest');

    const chestDumbbell = filterExercises(catalog, { ...emptyExerciseFilter, searchText: 'press', equipment: ['Dumbbell'], primaryMuscles: ['Chest'] });
    expect(chestDumbbell.length).toBeGreaterThan(0);
    expect(chestDumbbell.every((i) => i.equipment === 'Dumbbell' && i.primaryMuscles.includes('Chest') && i.searchableText.includes('press'))).toBe(true);

    const byLevel = filterExercises(catalog.slice(0, 40), { ...emptyExerciseFilter, sort: 'level' });
    const levels = byLevel.map((i) => i.level);
    const order = ['Beginner', 'Intermediate', 'Expert'];
    expect(levels.map((l) => order.indexOf(l))).toEqual([...levels.map((l) => order.indexOf(l))].sort((a, b) => a - b));
    expect(hasActiveFilters(emptyExerciseFilter)).toBe(false);
    expect(hasActiveFilters({ ...emptyExerciseFilter, sort: 'level' })).toBe(true);
  });
});

describe('workout sessions', () => {
  const day = '2026-09-16';
  const now = new Date(2026, 8, 16, 18, 30);
  let n = 0;
  const id = () => `id-${(n += 1)}`;

  const draft: WorkoutDraft = {
    dayKey: day,
    startedAt: new Date(2026, 8, 16, 17, 40).toISOString(),
    exercises: [
      {
        id: 'ex1',
        itemID: 'Barbell_Bench_Press_-_Medium_Grip',
        name: 'Barbell Bench Press',
        targetMuscles: ['Chest'],
        equipment: 'Barbell',
        category: 'Strength',
        sets: [
          { id: 's1', weight: '185', reps: '8', rpe: '7' },
          { id: 's2', weight: '185', reps: '8', rpe: '8' },
          { id: 's3', weight: '', reps: '', rpe: '' },
        ],
      },
      { id: 'ex2', itemID: 'Plank', name: 'Plank', targetMuscles: ['Abdominals'], equipment: 'Body Only', category: 'Strength', sets: [{ id: 's4', weight: '', reps: '', rpe: '' }] },
    ],
  };

  it('builds a session from a draft, dropping unperformed sets and exercises, with a burn estimate', () => {
    const session = finishDraft(draft, id, now, { split: 'fullBody', rpeScale: 'strength', weightUnit: 'lbs' }, 80);
    expect(session.diaryDateKey).toBe(day);
    expect(session.durationSeconds).toBe(50 * 60);
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0]?.sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(session.exercises[0]?.sets[0]?.weightUnit).toBe('lbs');
    expect(isReliableBurn(session.caloriesBurned)).toBe(true);
    expect(session.caloriesBurned).toBeGreaterThan(20);
    expect(session.caloriesBurned).toBeLessThan(200);
  });

  it('estimates nothing without performed sets and scales with effort', () => {
    const exercises: CompletedExercise[] = [
      { id: 'e', itemID: 'x', name: 'X', targetMuscles: [], equipment: '', sets: [{ id: 'a', setNumber: 1, weight: '100', weightUnit: 'kg', reps: '5', rpe: '9', rpeScale: 'strength' }] },
    ];
    const hard = estimateBurn(exercises, 80, 'strength')!;
    const easy = estimateBurn([{ ...exercises[0]!, sets: [{ ...exercises[0]!.sets[0]!, rpe: '2', weight: '20' }] }], 80, 'strength')!;
    expect(hard.calories).toBeGreaterThan(easy.calories);
    expect(hard.performedSetCount).toBe(1);
    expect(hard.repCount).toBe(5);
    expect(estimateBurn([{ ...exercises[0]!, sets: [{ ...exercises[0]!.sets[0]!, reps: '' }] }], 80, 'strength')).toBeUndefined();
  });

  it('reduces drafts and sessions, and aggregates burn and lift history', () => {
    let state = workoutsReducer(initialWorkoutsState, { type: 'draft/addExercise', dayKey: day, exercise: draft.exercises[0]!, startedAt: draft.startedAt });
    state = workoutsReducer(state, { type: 'draft/updateSet', dayKey: day, exerciseId: 'ex1', set: { id: 's3', weight: '190', reps: '6', rpe: '9' } });
    expect(state.drafts[day]?.exercises[0]?.sets[2]?.reps).toBe('6');
    state = workoutsReducer(state, { type: 'draft/removeSet', dayKey: day, exerciseId: 'ex1', setId: 's1' });
    expect(state.drafts[day]?.exercises[0]?.sets).toHaveLength(2);

    const session = finishDraft(state.drafts[day]!, id, now, { split: 'fullBody', rpeScale: 'strength', weightUnit: 'lbs' }, 80);
    state = workoutsReducer(state, { type: 'session/finish', dayKey: day, session });
    expect(state.drafts[day]).toBeUndefined();
    expect(state.sessions).toHaveLength(1);
    expect(workoutsReducer(state, { type: 'session/finish', dayKey: day, session })).toBe(state);

    const older = { ...session, id: 'older', diaryDateKey: '2026-09-14', completedAt: new Date(2026, 8, 14, 18).toISOString(), caloriesBurned: 150 };
    const dupe = { ...session, id: 'dupe', completedAt: new Date(2026, 8, 16, 19).toISOString(), caloriesBurned: 999 };
    const unreliable = { ...session, id: 'unreliable', exercises: [], completedAt: new Date(2026, 8, 16, 20).toISOString(), caloriesBurned: 0 };
    state = workoutsReducer(state, { type: 'hydrate', state: { sessions: [...state.sessions, older, dupe, unreliable] } });
    // Two workouts on one day add up (and match the card total); a 0 kcal record is not reliable.
    expect(dailyBurn(state.sessions)).toEqual([
      { day: '2026-09-14', calories: 150 },
      { day: day, calories: 999 + session.caloriesBurned! },
    ]);
    expect(totalBurn(state.sessions)).toBe(150 + 999 + session.caloriesBurned!);

    const history = liftHistory(state.sessions, 'Barbell_Bench_Press_-_Medium_Grip');
    expect(history[0]?.day).toBe(day);
    expect(history[0]?.bestWeightKg).toBeCloseTo(190 / 2.2046, 1);
    // Two records on the same day (the original and the hydrated duplicate) both count.
    expect(history[0]?.totalReps).toBe(28);
    expect(history[1]).toMatchObject({ day: '2026-09-14', totalReps: 14 });

    state = workoutsReducer(state, { type: 'session/delete', id: 'dupe' });
    expect(state.sessions.some((s) => s.id === 'dupe')).toBe(false);
  });
});
