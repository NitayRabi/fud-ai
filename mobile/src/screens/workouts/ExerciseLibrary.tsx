/**
 * Exercise library browser and detail. Mirrors `ExerciseLibraryBrowserView`,
 * `ExerciseLibraryRow` and `ExerciseLibraryDetailView` in `WorkoutsView.swift` (the Delts
 * port), styled with the same AppColors tokens `WorkoutsTheme.swift` bridges to. Thumbnails
 * and the animated visual load from the workout-vector CDN like the store builds.
 */

import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, TextInput, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Icon, type SFSymbolName } from '../../components/Icon';
import { AppText, Card, Divider, PrimaryButton, Row } from '../../components/primitives';
import {
  emptyExerciseFilter,
  exerciseCatalog,
  exerciseFilterOptions,
  exerciseInstructions,
  exerciseLibrarySorts,
  exerciseLibrarySortTitle,
  filterExercises,
  frameURL,
  hasActiveFilters,
  metadataSummary,
  primaryMusclesTitle,
  representativeFrameURL,
  secondaryMusclesTitle,
  type ExerciseFilter,
  type ExerciseLibraryItem,
  type ExerciseLibrarySort,
  type FrameSex,
} from '../../domain/workouts/exerciseLibrary';
import { useTheme } from '../../theme';

type FilterKey = 'levels' | 'equipment' | 'primaryMuscles' | 'categories';

const filterTitles: Record<FilterKey, string> = { levels: 'Level', equipment: 'Equipment', primaryMuscles: 'Primary', categories: 'Category' };

interface ExerciseLibraryProps {
  sex: FrameSex;
  /** Present when the library is opened from the log to pick an exercise. */
  onPick?: (item: ExerciseLibraryItem) => void;
  bottomInset: number;
}

export function ExerciseLibrary({ sex, onPick, bottomInset }: ExerciseLibraryProps) {
  const theme = useTheme();
  const catalog = useMemo(() => exerciseCatalog(), []);
  const options = useMemo(() => exerciseFilterOptions(catalog), [catalog]);
  const [filter, setFilter] = useState<ExerciseFilter>(emptyExerciseFilter);
  const [searchDraft, setSearchDraft] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey | 'sort' | null>(null);
  const [detail, setDetail] = useState<ExerciseLibraryItem | undefined>(undefined);

  // Debounce like `WorkoutSearchDebounce` so typing never re-filters 877 rows per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setFilter((f) => (f.searchText === searchDraft ? f : { ...f, searchText: searchDraft })), 180);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const items = useMemo(() => filterExercises(catalog, filter), [catalog, filter]);

  const toggle = (key: FilterKey, value: string) =>
    setFilter((f) => {
      const current = f[key];
      return { ...f, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] };
    });

  const reset = () => {
    setSearchDraft('');
    setFilter(emptyExerciseFilter);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
        <Row style={{ gap: 8, paddingHorizontal: 12, minHeight: 44, borderRadius: theme.radii.control, backgroundColor: theme.colors.appCard, borderWidth: 0.5, borderColor: theme.colors.separator }}>
          <Icon name="magnifyingglass" size={16} color={theme.colors.secondaryLabel} />
          <TextInput
            value={searchDraft}
            onChangeText={setSearchDraft}
            placeholder="Search exercises"
            placeholderTextColor={theme.colors.placeholder}
            autoCorrect={false}
            accessibilityLabel="Search exercises"
            style={[theme.text.body, { flex: 1, color: theme.colors.label, paddingVertical: 8 }]}
          />
          {searchDraft ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setSearchDraft('')}>
              <Icon name="xmark.circle" size={18} color={theme.colors.tertiaryLabel} />
            </Pressable>
          ) : null}
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(Object.keys(filterTitles) as FilterKey[]).map((key) => {
            const count = filter[key].length;
            return <FilterChip key={key} title={count > 0 ? `${filterTitles[key]} · ${count}` : filterTitles[key]} active={count > 0} onPress={() => setActiveFilter(key)} />;
          })}
        </ScrollView>
        <Row style={{ justifyContent: 'space-between', paddingBottom: 4 }}>
          <View>
            <AppText variant="headline">
              {items.length.toLocaleString()} {items.length === 1 ? 'exercise' : 'exercises'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              Sorted by {exerciseLibrarySortTitle(filter.sort)}
            </AppText>
          </View>
          <Row style={{ gap: 12 }}>
            {hasActiveFilters(filter) ? (
              <Pressable accessibilityRole="button" onPress={reset}>
                <AppText variant="footnoteSemibold" tone="accent">
                  Reset
                </AppText>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Sort" onPress={() => setActiveFilter('sort')}>
              <Row style={{ gap: 4 }}>
                <Icon name="arrow.up.arrow.down" size={13} color={theme.colors.accent} />
                <AppText variant="footnoteSemibold" tone="accent">
                  Sort
                </AppText>
              </Row>
            </Pressable>
          </Row>
        </Row>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        initialNumToRender={12}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 32 }}
        ItemSeparatorComponent={() => <Divider />}
        ListEmptyComponent={
          <View style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 }}>
            <Icon name="line.3.horizontal.decrease.circle" size={36} color={theme.colors.secondaryLabel} />
            <AppText variant="headline">No exercises match</AppText>
            <AppText variant="subheadline" tone="secondary" align="center">
              Try a different muscle, equipment, or search.
            </AppText>
          </View>
        }
        renderItem={({ item }) => <ExerciseRow item={item} sex={sex} onPress={() => setDetail(item)} />}
      />

      {(Object.keys(filterTitles) as FilterKey[]).map((key) => (
        <MultiSelectSheet
          key={key}
          visible={activeFilter === key}
          title={filterTitles[key]}
          options={options[key]}
          selected={filter[key]}
          onToggle={(value) => toggle(key, value)}
          onClear={() => setFilter((f) => ({ ...f, [key]: [] }))}
          onDismiss={() => setActiveFilter(null)}
        />
      ))}
      <BottomSheet visible={activeFilter === 'sort'} title="Sort" onDismiss={() => setActiveFilter(null)}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {exerciseLibrarySorts.map((sort: ExerciseLibrarySort, index) => (
            <View key={sort}>
              {index > 0 ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filter.sort === sort }}
                onPress={() => {
                  setFilter((f) => ({ ...f, sort }));
                  setActiveFilter(null);
                }}
              >
                <Row style={{ minHeight: 48, paddingHorizontal: theme.spacing.lg, justifyContent: 'space-between' }}>
                  <AppText variant="body" weight={filter.sort === sort ? '600' : '400'}>
                    {exerciseLibrarySortTitle(sort)}
                  </AppText>
                  {filter.sort === sort ? <Icon name="checkmark.circle.fill" size={20} color={theme.colors.accent} /> : null}
                </Row>
              </Pressable>
            </View>
          ))}
        </Card>
      </BottomSheet>

      <ExerciseDetailSheet
        item={detail}
        sex={sex}
        onDismiss={() => setDetail(undefined)}
        onPick={
          onPick
            ? (item) => {
                setDetail(undefined);
                onPick(item);
              }
            : undefined
        }
      />
    </View>
  );
}

function FilterChip({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        minHeight: 36,
        justifyContent: 'center',
        borderRadius: theme.radii.pill,
        backgroundColor: active ? theme.colors.accent : theme.colors.appCard,
        borderWidth: 0.5,
        borderColor: active ? theme.colors.accent : theme.colors.separator,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Row style={{ gap: 4 }}>
        <AppText variant="footnoteSemibold" tone={active ? 'onAccent' : 'primary'}>
          {title}
        </AppText>
        <Icon name="chevron.down" size={11} color={active ? theme.colors.onAccent : theme.colors.secondaryLabel} />
      </Row>
    </Pressable>
  );
}

function LibraryTag({ title, icon }: { title: string; icon: SFSymbolName }) {
  const theme = useTheme();
  return (
    <Row style={{ gap: 4 }}>
      <Icon name={icon} size={11} color={theme.colors.secondaryLabel} />
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {title}
      </AppText>
    </Row>
  );
}

function ExerciseThumbnail({ item, sex, size }: { item: ExerciseLibraryItem; sex: FrameSex; size: number }) {
  const theme = useTheme();
  const uri = representativeFrameURL(item, sex);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ width: size, height: size, borderRadius: 18, overflow: 'hidden', backgroundColor: theme.colors.fill, borderWidth: 0.5, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}>
      {uri && !failed ? (
        <Image source={{ uri }} resizeMode="contain" style={{ width: size, height: size }} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="figure.strengthtraining.traditional" size={size * 0.4} color={theme.colors.secondaryLabel} />
      )}
    </View>
  );
}

function ExerciseRow({ item, sex, onPress }: { item: ExerciseLibraryItem; sex: FrameSex; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Row style={{ gap: 16, paddingVertical: 15, alignItems: 'center' }}>
        <ExerciseThumbnail item={item} sex={sex} size={104} />
        <View style={{ flex: 1, gap: 9 }}>
          <AppText variant="headline" numberOfLines={2}>
            {item.name}
          </AppText>
          <View style={{ gap: 5 }}>
            <LibraryTag title={primaryMusclesTitle(item)} icon="target" />
            <LibraryTag title={`${item.equipment} - ${item.level}`} icon="dumbbell.fill" />
          </View>
          <Row style={{ gap: 4 }}>
            <Icon name="externaldrive" size={11} color={theme.colors.accentGradient[1]} />
            <AppText variant="captionSemibold" numberOfLines={1} style={{ color: theme.colors.accentGradient[1] }}>
              {metadataSummary(item)}
            </AppText>
          </Row>
        </View>
        <Icon name="chevron.right" size={13} color={theme.colors.tertiaryLabel} />
      </Row>
    </Pressable>
  );
}

interface MultiSelectSheetProps {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  onDismiss: () => void;
}

function MultiSelectSheet({ visible, title, options, selected, onToggle, onClear, onDismiss }: MultiSelectSheetProps) {
  const theme = useTheme();
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onDismiss={onDismiss}
      trailing={
        selected.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={onClear}>
            <AppText variant="subheadlineSemibold" tone="accent">
              Clear
            </AppText>
          </Pressable>
        ) : undefined
      }
    >
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {options.map((option, index) => {
          const isSelected = selected.includes(option);
          return (
            <View key={option}>
              {index > 0 ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} onPress={() => onToggle(option)} style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.fill : 'transparent' })}>
                <Row style={{ minHeight: 46, paddingHorizontal: theme.spacing.lg, justifyContent: 'space-between' }}>
                  <AppText variant="body" weight={isSelected ? '600' : '400'}>
                    {option}
                  </AppText>
                  <Icon name={isSelected ? 'checkmark.circle.fill' : 'circle'} size={20} color={isSelected ? theme.colors.accent : theme.colors.tertiaryLabel} />
                </Row>
              </Pressable>
            </View>
          );
        })}
      </Card>
    </BottomSheet>
  );
}

// MARK: - Detail

function AnimatedExerciseVisual({ item, sex }: { item: ExerciseLibraryItem; sex: FrameSex }) {
  const theme = useTheme();
  const [frame, setFrame] = useState(item.representativeFrameIndex);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (item.frameCount <= 1) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % item.frameCount), 650);
    return () => clearInterval(timer);
  }, [item.frameCount]);
  const uri = frameURL(item, sex, frame);
  return (
    <View style={{ height: 220, borderRadius: theme.radii.cardLarge, overflow: 'hidden', backgroundColor: theme.colors.fill, alignItems: 'center', justifyContent: 'center' }}>
      {uri && !failed ? (
        <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 220 }} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Icon name="figure.strengthtraining.traditional" size={48} color={theme.colors.secondaryLabel} />
          <AppText variant="caption" tone="secondary">
            {item.frameCount === 0 ? 'No animation for this exercise yet' : 'Animation unavailable offline'}
          </AppText>
        </View>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', gap: 12, paddingVertical: 8 }}>
      <AppText variant="subheadline" tone="secondary">
        {label}
      </AppText>
      <AppText variant="subheadlineSemibold" style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </Row>
  );
}

export function ExerciseDetailSheet({ item, sex, onDismiss, onPick }: { item: ExerciseLibraryItem | undefined; sex: FrameSex; onDismiss: () => void; onPick?: (item: ExerciseLibraryItem) => void }) {
  const theme = useTheme();
  if (!item) return null;
  const steps = exerciseInstructions(item.id);
  return (
    <BottomSheet visible title={item.name} onDismiss={onDismiss}>
      <AnimatedExerciseVisual item={item} sex={sex} />
      <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: 4 }}>
        <DetailRow label="Primary" value={primaryMusclesTitle(item)} />
        <Divider />
        <DetailRow label="Secondary" value={secondaryMusclesTitle(item)} />
        <Divider />
        <DetailRow label="Equipment" value={item.equipment} />
        <Divider />
        <DetailRow label="Level" value={item.level} />
        <Divider />
        <DetailRow label="Type" value={metadataSummary(item)} />
      </Card>
      {steps.length > 0 ? (
        <Card style={{ gap: 10 }}>
          <AppText variant="headline">Instructions</AppText>
          {steps.map((step, index) => (
            <Row key={index} style={{ alignItems: 'flex-start', gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.accentAlpha(0.12), alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="caption2Semibold" tone="accent">
                  {index + 1}
                </AppText>
              </View>
              <AppText variant="subheadline" style={{ flex: 1 }}>
                {step}
              </AppText>
            </Row>
          ))}
        </Card>
      ) : null}
      {onPick ? <PrimaryButton title="Add to Workout" onPress={() => onPick(item)} /> : null}
    </BottomSheet>
  );
}
