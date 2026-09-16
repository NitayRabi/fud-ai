import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/Icon';
import { CalorieGauge } from '../../components/home/CalorieGauge';
import { FastingRow, FoodRow, WaterLogRow } from '../../components/home/DiaryRows';
import { MacroVerticalBar } from '../../components/home/MacroVerticalBar';
import { WeekEnergyStrip } from '../../components/home/WeekEnergyStrip';
import { AppText, Card, Divider, LinkButton, Row, Screen } from '../../components/primitives';
import { addDays, dayKey, isSameDay, startOfDay } from '../../domain/dates';
import {
  activeFast,
  caloriesOn,
  completedFastsOn,
  foodEntriesOn,
  isFavorite,
  waterEntriesOn,
  waterTotalOn,
} from '../../domain/diary/diaryState';
import { displayedHomeNutrients, homeNutrientGoal, homeNutrients } from '../../domain/diary/homeNutrients';
import { homeDiaryMealGroups, type FoodLogSortOrder } from '../../domain/diary/mealGroups';
import { makeFoodEntry, mealTypeDisplayName, type FoodEntry } from '../../domain/food/food';
import { parseHomeTopNutrients } from '../../domain/prefs/preferences';
import { dailyTargets } from '../../domain/profile/userProfile';
import { waterDisplayAmount, waterUnitSymbol } from '../../domain/water/water';
import { aiErrorMessage } from '../../domain/ai/errors';
import { foodEntryInputFromAnalysis, type FoodAnalysis, type FoodAnalysisKind } from '../../domain/food/analysis';
import { favoriteEntries, recentEntries } from '../../domain/diary/diaryState';
import { analyzeFood } from '../../services/aiClient';
import { deleteFoodImage, storeFoodImage } from '../../services/foodImageStore';
import { ImagePermissionError, pickImage, type ImageSource } from '../../services/imagePicker';
import { diaryStore, newId, setPreferences, useDiary, usePreferences, useProfile } from '../../state/appStores';
import { useTheme } from '../../theme';
import { AnalyzingOverlay, FoodResultSheet, SavedMealsSheet, TextFoodInputSheet, type FoodResultSave } from './FoodAISheets';
import { AddMenuSheet, FastingStartSheet, ManualEntrySheet, WaterCustomSheet, type AddMenuAction } from './HomeSheets';

type Sheet = 'add' | 'waterCustom' | 'fastingStart' | 'manualEntry' | 'describeMeal' | 'voiceMeal' | 'savedMeals' | 'review' | null;

interface PendingAnalysis {
  kind: FoodAnalysisKind;
  imageUri?: string;
}

interface ReviewState {
  kind: FoodAnalysisKind;
  analysis: FoodAnalysis;
  imageUri?: string;
  /** The analyzed JPEG, kept until Save so the diary entry can keep its photo on disk. */
  imageBase64?: string;
}

/**
 * Home: week strip, calorie dome, nutrient bars, unified diary and the "+" menu. Every number
 * on screen is derived from one `DiaryState` read, so a water or fasting change re-renders the
 * pillar and the diary in the same pass (#369).
 */
export function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Tab bar is absolutely positioned over the screen; its height already includes the bottom inset.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? insets.bottom;
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [sheet, setSheet] = useState<Sheet>(null);
  // Bumped every time a draft sheet opens so it remounts with empty fields (no stale drafts).
  const [sheetEpoch, setSheetEpoch] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [pending, setPending] = useState<PendingAnalysis | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const analysisAbort = useRef<AbortController | null>(null);

  const diary = useDiary((state) => state);
  const profile = useProfile((state) => state);
  const prefs = usePreferences((state) => state);

  const isToday = isSameDay(selectedDate, now);
  const active = activeFast(diary);

  // Keep `now` honest: refresh on foreground, at the next local midnight, and once a minute
  // while a fast is running (live elapsed read-out). Without this, an app left open or resumed
  // overnight would still call yesterday "Today's Diary" while logging into the new day.
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const current = new Date();
      const untilMidnight = startOfDay(addDays(current, 1)).getTime() - current.getTime() + 1_000;
      timer = setTimeout(
        () => {
          refresh();
          schedule();
        },
        active ? Math.min(60_000, untilMidnight) : untilMidnight,
      );
    };
    schedule();
    return () => {
      subscription.remove();
      if (timer) clearTimeout(timer);
    };
  }, [active]);

  // When the day rolls over while "today" is selected, follow it; an explicitly chosen past day stays.
  const today = dayKey(now);
  const previousToday = useRef(today);
  useEffect(() => {
    if (previousToday.current === today) return;
    const wasToday = previousToday.current;
    previousToday.current = today;
    setSelectedDate((selected) => (dayKey(selected) === wasToday ? new Date() : selected));
  }, [today]);

  const targets = useMemo(() => dailyTargets(profile), [profile]);
  const dayFood = useMemo(() => foodEntriesOn(diary, selectedDate), [diary, selectedDate]);
  const dayWater = useMemo(() => waterEntriesOn(diary, selectedDate), [diary, selectedDate]);
  const dayFasts = useMemo(
    () => [...completedFastsOn(diary, selectedDate), ...(isToday && active ? [active] : [])],
    [diary, selectedDate, isToday, active],
  );
  const groups = useMemo(
    () => homeDiaryMealGroups({ foodEntries: dayFood, waterEntries: dayWater, fastingSessions: dayFasts, order: prefs.foodLogSortOrder, now }),
    [dayFood, dayWater, dayFasts, prefs.foodLogSortOrder, now],
  );

  const openSheet = (next: Exclude<Sheet, null>) => {
    if (next !== 'add') setSheetEpoch((epoch) => epoch + 1);
    setSheet(next);
  };

  const nutrients = displayedHomeNutrients(parseHomeTopNutrients(prefs.homeTopNutrients), prefs.waterTrackingEnabled);
  const waterGoalDisplay = waterDisplayAmount(prefs.waterUnit, prefs.waterDailyGoalMl);
  const waterTotalDisplay = waterDisplayAmount(prefs.waterUnit, waterTotalOn(diary, selectedDate));

  /** Today logs at the current time; another day keeps that day's date with the current time. */
  const logDate = useCallback(() => {
    if (isToday) return new Date();
    const d = new Date(selectedDate);
    const current = new Date();
    d.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), 0);
    return d;
  }, [isToday, selectedDate]);

  const endFast = () => diaryStore.dispatch({ type: 'fasting/end', endedAt: new Date().toISOString() });
  const cancelFast = () =>
    Alert.alert('Cancel Fast?', 'This removes the active fast from your diary.', [
      { text: 'Keep Fasting', style: 'cancel' },
      { text: 'Cancel Fast', style: 'destructive', onPress: () => diaryStore.dispatch({ type: 'fasting/cancelActive' }) },
    ]);

  // MARK: - AI food logging

  /** Runs one analysis; the overlay's Cancel aborts the request and the transport enforces a timeout. */
  const runAnalysis = useCallback(
    async (kind: FoodAnalysisKind, input: { text?: string; imageBase64?: string; imageUri?: string }) => {
      analysisAbort.current?.abort();
      const controller = new AbortController();
      analysisAbort.current = controller;
      setPending({ kind, ...(input.imageUri ? { imageUri: input.imageUri } : {}) });
      try {
        const analysis = await analyzeFood(
          {
            kind,
            ...(input.text ? { text: input.text } : {}),
            ...(input.imageBase64 ? { imagesBase64: [input.imageBase64] } : {}),
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setReview({ kind, analysis, ...(input.imageUri ? { imageUri: input.imageUri } : {}), ...(input.imageBase64 ? { imageBase64: input.imageBase64 } : {}) });
        setSheet('review');
      } catch (error) {
        if (controller.signal.aborted) return;
        Alert.alert('Analysis failed', aiErrorMessage(error));
      } finally {
        if (analysisAbort.current === controller) {
          analysisAbort.current = null;
          setPending(null);
        }
      }
    },
    [],
  );

  const cancelAnalysis = () => {
    analysisAbort.current?.abort();
    analysisAbort.current = null;
    setPending(null);
  };

  useEffect(() => () => analysisAbort.current?.abort(), []);

  const captureAndAnalyze = async (kind: 'photo' | 'nutritionLabel', source: ImageSource) => {
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      void runAnalysis(kind, { imageBase64: picked.base64, imageUri: picked.uri });
    } catch (error) {
      Alert.alert(kind === 'photo' ? 'Scan Food' : 'Scan Label', error instanceof ImagePermissionError ? error.message : 'Could not load that photo.');
    }
  };

  const chooseImageSource = (kind: 'photo' | 'nutritionLabel') =>
    Alert.alert(kind === 'photo' ? 'Scan Food' : 'Scan Nutrition Label', undefined, [
      { text: 'Take Photo', onPress: () => void captureAndAnalyze(kind, 'camera') },
      { text: 'Choose from Library', onPress: () => void captureAndAnalyze(kind, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const saveReview = (result: FoodResultSave) => {
    if (!review) return;
    const id = newId();
    // Photo and label scans keep their picture like the native diary: the JPEG goes to disk
    // under the entry id and only the filename is persisted with the entry.
    const imageFilename = review.imageBase64 ? storeFoodImage(review.imageBase64, id) : undefined;
    const input = foodEntryInputFromAnalysis(result.analysis, review.kind, logDate().toISOString(), {
      ...(result.mealType ? { mealType: result.mealType } : {}),
      ...(result.customNote !== undefined ? { customNote: result.customNote } : {}),
      ...(imageFilename ? { imageFilename } : {}),
    });
    diaryStore.dispatch({ type: 'food/add', entry: makeFoodEntry(input, id) });
    setReview(null);
    setSheet(null);
  };

  const deleteFoodEntry = (entry: FoodEntry) => {
    diaryStore.dispatch({ type: 'food/delete', id: entry.id });
    deleteFoodImage(entry.imageFilename);
  };

  const relogEntry = (entry: FoodEntry) => {
    const { id: _id, timestamp: _timestamp, imageFilename: _image, additionalImageFilenames: _images, ...rest } = entry;
    diaryStore.dispatch({ type: 'food/add', entry: makeFoodEntry({ ...rest, timestamp: logDate().toISOString() }, newId()) });
    setSheet(null);
  };

  const handleAddMenu = (action: AddMenuAction) => {
    switch (action.kind) {
      case 'startFast':
        openSheet('fastingStart');
        return;
      case 'endFast':
        endFast();
        return;
      case 'cancelFast':
        cancelFast();
        return;
      case 'water':
        diaryStore.dispatch({ type: 'water/add', entry: { id: newId(), date: logDate().toISOString(), milliliters: action.milliliters } });
        return;
      case 'waterCustom':
        openSheet('waterCustom');
        return;
      case 'food':
        switch (action.method) {
          case 'manual':
            openSheet('manualEntry');
            return;
          case 'camera':
            chooseImageSource('photo');
            return;
          case 'label':
            chooseImageSource('nutritionLabel');
            return;
          case 'text':
            openSheet('describeMeal');
            return;
          case 'voice':
            openSheet('voiceMeal');
            return;
          case 'saved':
            openSheet('savedMeals');
            return;
          case 'barcode':
            Alert.alert('Scan Barcode', 'Barcode lookup (Open Food Facts) stays in the native apps for now. Use Scan Food or Describe Meal.');
        }
    }
  };

  const toggleSortOrder = () => {
    const next: FoodLogSortOrder = prefs.foodLogSortOrder === 'standard' ? 'latestMealsFirst' : 'standard';
    setPreferences({ foodLogSortOrder: next });
  };

  return (
    <Screen>
      {/* iOS: `.contentMargins(.bottom, 96)` is measured from the tab bar's safe area, so add the bar. */}
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 96, gap: theme.spacing.lg }} scrollIndicatorInsets={{ bottom: tabBarHeight }}>
        <View style={{ paddingTop: theme.spacing.sm }}>
          <WeekEnergyStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} weekStartsOnMonday={prefs.weekStartsOnMonday} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <CalorieGauge eaten={caloriesOn(diary, selectedDate)} goal={targets.calories} />
          <Row style={{ alignItems: 'flex-start', paddingHorizontal: theme.spacing.lg, gap: 4 }}>
            {nutrients.map((id) => (
              <MacroVerticalBar
                key={id}
                label={homeNutrients[id].displayName}
                current={homeNutrients[id].total(dayFood)}
                goal={homeNutrientGoal(id, targets)}
                unit={homeNutrients[id].unit}
              />
            ))}
            {prefs.waterTrackingEnabled ? (
              <MacroVerticalBar label="Water" current={waterTotalDisplay} goal={waterGoalDisplay} unit={waterUnitSymbol(prefs.waterUnit)} />
            ) : null}
          </Row>
          <LinkButton
            title="View More  ›"
            variant="subheadline"
            style={{ alignSelf: 'center', opacity: 0.6 }}
            onPress={() => Alert.alert('Nutrition detail', 'The full nutrient breakdown is being ported to the shared app.')}
          />
        </View>

        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg }}>
          {groups.length === 0 ? (
            <View style={{ gap: 6 }}>
              <SectionHeader title={isToday ? "Today's Diary" : 'Diary'} />
              <Card>
                <AppText tone="secondary">No diary entries</AppText>
              </Card>
            </View>
          ) : (
            groups.map((group, index) => (
              <View key={group.id} style={{ gap: 6 }}>
                <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
                  <Row style={{ gap: 8 }}>
                    <SectionHeader title={mealTypeDisplayName(group.meal)} />
                    {index === 0 ? (
                      <Pressable accessibilityRole="button" onPress={toggleSortOrder} style={{ paddingLeft: 8 }}>
                        <Row style={{ gap: 6 }}>
                          <Icon name="arrow.up.arrow.down" size={11} color={theme.colors.accent} />
                          <AppText variant="subheadlineSemibold" tone="accent">
                            Sort
                          </AppText>
                        </Row>
                      </Pressable>
                    ) : null}
                  </Row>
                  {group.foodEntries.length > 0 ? (
                    <View style={{ alignItems: 'flex-end', gap: 1 }}>
                      <AppText variant="subheadlineSemibold" tone="accent">
                        {group.totals.calories.toLocaleString()} kcal
                      </AppText>
                      <AppText variant="caption2" tone="secondary" weight="500">
                        {Math.round(group.totals.protein)}P · {Math.round(group.totals.carbs)}C · {Math.round(group.totals.fat)}F
                      </AppText>
                    </View>
                  ) : null}
                </Row>
                <Card padded={false} style={{ overflow: 'hidden' }}>
                  {group.items.map((item, i) => (
                    <View key={item.id}>
                      {i > 0 ? <Divider style={{ marginLeft: theme.spacing.lg + 68 }} /> : null}
                      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 8 }}>
                        {item.kind === 'food' ? (
                          <FoodRow
                            entry={item.entry}
                            isFavorite={isFavorite(diary, item.entry)}
                            onPress={() =>
                              Alert.alert(item.entry.name, undefined, [
                                {
                                  text: isFavorite(diary, item.entry) ? 'Unfavorite' : 'Favorite',
                                  onPress: () => diaryStore.dispatch({ type: 'food/toggleFavorite', entry: item.entry }),
                                },
                                { text: 'Delete', style: 'destructive', onPress: () => deleteFoodEntry(item.entry) },
                                { text: 'Cancel', style: 'cancel' },
                              ])
                            }
                          />
                        ) : item.kind === 'water' ? (
                          <Pressable
                            onLongPress={() =>
                              Alert.alert('Delete water entry?', undefined, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => diaryStore.dispatch({ type: 'water/delete', id: item.entry.id }) },
                              ])
                            }
                          >
                            <WaterLogRow entry={item.entry} unit={prefs.waterUnit} />
                          </Pressable>
                        ) : (
                          <FastingRow
                            session={item.session}
                            now={now}
                            onPress={() =>
                              item.session.endedAt === undefined
                                ? Alert.alert('Fasting', undefined, [
                                    { text: 'End Fast', onPress: endFast },
                                    { text: 'Cancel Fast', style: 'destructive', onPress: cancelFast },
                                    { text: 'Close', style: 'cancel' },
                                  ])
                                : Alert.alert('Delete fast?', undefined, [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Delete', style: 'destructive', onPress: () => diaryStore.dispatch({ type: 'fasting/delete', id: item.session.id }) },
                                  ])
                            }
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </Card>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating "+" (60pt accent circle, bottom trailing). iOS pads 24 inside the safe area, i.e. above the tab bar. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        testID="home.add"
        onPress={() => openSheet('add')}
        style={({ pressed }) => ({
          position: 'absolute',
          right: theme.spacing.xl,
          bottom: tabBarHeight + theme.spacing.xl,
          width: theme.sizes.addButton,
          height: theme.sizes.addButton,
          borderRadius: theme.sizes.addButton / 2,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: theme.colors.accent,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Icon name="plus" size={30} color={theme.colors.onAccent} />
      </Pressable>

      <AddMenuSheet
        visible={sheet === 'add'}
        onDismiss={() => setSheet(null)}
        onAction={handleAddMenu}
        fastingTrackingEnabled={prefs.fastingTrackingEnabled}
        waterTrackingEnabled={prefs.waterTrackingEnabled}
        hasActiveFast={active !== undefined}
        waterUnit={prefs.waterUnit}
      />
      <WaterCustomSheet
        key={`water-${sheetEpoch}`}
        visible={sheet === 'waterCustom'}
        unit={prefs.waterUnit}
        onDismiss={() => setSheet(null)}
        onAdd={(milliliters) => {
          diaryStore.dispatch({ type: 'water/add', entry: { id: newId(), date: logDate().toISOString(), milliliters } });
          setSheet(null);
        }}
      />
      <FastingStartSheet
        key={`fasting-${sheetEpoch}`}
        visible={sheet === 'fastingStart'}
        defaultGoalMinutes={prefs.fastingDefaultGoalMinutes}
        onDismiss={() => setSheet(null)}
        onStart={(goalMinutes) => {
          diaryStore.dispatch({ type: 'fasting/start', session: { id: newId(), startedAt: new Date().toISOString(), goalMinutes } });
          setSheet(null);
        }}
      />
      <ManualEntrySheet
        key={`manual-${sheetEpoch}`}
        visible={sheet === 'manualEntry'}
        logDate={logDate()}
        onDismiss={() => setSheet(null)}
        onSave={(input) => {
          diaryStore.dispatch({ type: 'food/add', entry: makeFoodEntry(input, newId()) });
          setSheet(null);
        }}
      />
      <TextFoodInputSheet
        key={`text-${sheetEpoch}`}
        visible={sheet === 'describeMeal' || sheet === 'voiceMeal'}
        voice={sheet === 'voiceMeal'}
        onDismiss={() => setSheet(null)}
        onSubmit={(description) => {
          const kind: FoodAnalysisKind = sheet === 'voiceMeal' ? 'voice' : 'text';
          setSheet(null);
          void runAnalysis(kind, { text: description });
        }}
      />
      <SavedMealsSheet
        visible={sheet === 'savedMeals'}
        favorites={favoriteEntries(diary)}
        recents={recentEntries(diary)}
        onDismiss={() => setSheet(null)}
        onRelog={relogEntry}
      />
      <AnalyzingOverlay
        visible={pending !== null}
        imageUri={pending?.imageUri}
        message={pending?.kind === 'text' || pending?.kind === 'voice' ? 'Looking up nutrition...' : 'Analyzing your food...'}
        onCancel={cancelAnalysis}
      />
      <FoodResultSheet
        visible={sheet === 'review' && review !== null}
        analysis={review?.analysis}
        imageUri={review?.imageUri}
        onDismiss={() => {
          setReview(null);
          setSheet(null);
        }}
        onSave={saveReview}
      />
    </Screen>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <AppText variant="footnote" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {title}
    </AppText>
  );
}

