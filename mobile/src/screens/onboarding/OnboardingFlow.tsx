/**
 * Full onboarding. Mirrors `OnboardingView.swift` steps 0–13: welcome, gender, birthday,
 * height & weight, body fat, activity, goal, desired weight, goal speed, notifications,
 * health, AI setup (`AISetupScreen`, #373), building plan and plan ready. The header shows the
 * back chevron + progress bar on steps 1–12. Wheels become stepper fields so both platforms
 * render the same control.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Switch, View } from 'react-native';

import { Icon, type SFSymbolName } from '../../components/Icon';
import { PickerSheet } from '../../components/PickerSheet';
import { AppText, Card, Divider, Row, Screen } from '../../components/primitives';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StepperField } from '../../components/StepperField';
import type { AISetupSubstep } from '../../domain/ai/onboardingValidation';
import {
  bodyFatPercentLimits,
  calculationMethodsSummary,
  customTargetsForPlan,
  defaultOnboardingDraft,
  editPlanCalories,
  editPlanCarbs,
  editPlanFat,
  editPlanProtein,
  estimatedDays,
  goalSpeedDescription,
  goalSpeedTitle,
  heightLimits,
  MINIMUM_RECOMMENDED_CALORIES,
  nextOnboardingStep,
  onboardingProgress,
  planFromProfile,
  planLimits,
  previousOnboardingStep,
  profileFromDraft,
  seedTargetWeight,
  setDraftMetric,
  showsOnboardingHeader,
  targetWeightProblem,
  weeklyChangeKg,
  weightLimits,
  type GoalSpeed,
  type NutritionPlan,
  type OnboardingDraft,
  type OnboardingStep,
} from '../../domain/onboarding/onboarding';
import {
  activityLevelDisplayName,
  activityLevelSubtitle,
  activityLevels,
  genderDisplayName,
  genders,
  weightGoalDisplayName,
  weightGoals,
  type ActivityLevel,
  type Gender,
  type WeightGoal,
} from '../../domain/profile/userProfile';
import { requestNotificationAuthorization, scheduleMealReminders } from '../../services/notifications';
import { bodyStore, newId, profileStore, setPreferences } from '../../state/appStores';
import { useTheme } from '../../theme';
import { AISetupScreen } from './AISetupScreen';
import { ContinueButton, FeatureRow, SelectionCard, StepHeader } from './OnboardingPieces';

interface OnboardingFlowProps {
  onShowPaywall: () => void;
  onComplete: () => void;
}

export function OnboardingFlow({ onShowPaywall, onComplete }: OnboardingFlowProps) {
  const theme = useTheme();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [draft, setDraft] = useState<OnboardingDraft>(() => defaultOnboardingDraft());
  const [aiSubstep, setAiSubstep] = useState<AISetupSubstep>('choice');
  const [aiResetToken, setAiResetToken] = useState(0);
  const [plan, setPlan] = useState<NutritionPlan | undefined>(undefined);
  const [planEdited, setPlanEdited] = useState(false);

  const profile = useMemo(() => profileFromDraft(draft), [draft]);
  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const next = useCallback(() => setStep((s) => nextOnboardingStep(s)), []);

  const back = () => {
    if (step === 'aiSetup' && aiSubstep !== 'choice') {
      setAiResetToken((t) => t + 1);
      return;
    }
    setStep((s) => previousOnboardingStep(s));
  };

  const finish = () => {
    const finalPlan = plan ?? planFromProfile(profile);
    // `{}` when the plan is still the raw formula; pinned when the user edited it *or* the
    // formula had to be clamped into `planLimits`, so Home shows exactly what Plan Ready did.
    const customTargets = customTargetsForPlan(profile, finalPlan);
    const finalProfile = { ...profile, ...customTargets };
    profileStore.dispatch({ type: 'hydrate', profile: finalProfile });
    // Onboarding seeds the first weigh-in from the real profile, never a 70 kg default.
    bodyStore.dispatch({ type: 'weight/seedIfEmpty', entry: { id: newId(), date: new Date().toISOString(), weightKg: finalProfile.weightKg } });
    if (draft.knowsBodyFat) {
      bodyStore.dispatch({ type: 'bodyFat/add', entry: { id: newId(), date: new Date().toISOString(), bodyFatFraction: draft.bodyFatPercent / 100 } });
    }
    setPreferences({
      heightUnit: draft.isMetric ? 'cm' : 'ftin',
      weightUnit: draft.isMetric ? 'kg' : 'lbs',
      notificationsEnabled: draft.notificationsEnabled,
      healthKitEnabled: draft.healthEnabled,
      onboardingPlanEdited: planEdited,
      hasCompletedOnboarding: true,
    });
    onComplete();
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      {showsOnboardingHeader(step) ? (
        <Row style={{ gap: 16, paddingHorizontal: theme.spacing.xl, paddingTop: 12, paddingBottom: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={12}>
            <Icon name="chevron.left" size={20} color={theme.colors.label} />
          </Pressable>
          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.label, width: `${Math.round(onboardingProgress(step) * 100)}%` }} />
          </View>
        </Row>
      ) : null}

      {step === 'welcome' ? <WelcomeStep onNext={next} /> : null}
      {step === 'gender' ? <GenderStep value={draft.gender} onChange={(gender) => update({ gender })} onNext={next} /> : null}
      {step === 'birthday' ? <BirthdayStep value={draft.birthday} onChange={(birthday) => update({ birthday })} onNext={next} /> : null}
      {step === 'heightWeight' ? <HeightWeightStep draft={draft} onChange={setDraft} onNext={next} /> : null}
      {step === 'bodyFat' ? <BodyFatStep draft={draft} onChange={update} onNext={next} /> : null}
      {step === 'activity' ? <ActivityStep value={draft.activityLevel} onChange={(activityLevel) => update({ activityLevel })} onNext={next} /> : null}
      {step === 'goal' ? (
        <GoalStep
          value={draft.goal}
          onChange={(goal) => update({ goal })}
          onNext={() => {
            setDraft((d) => seedTargetWeight(d));
            next();
          }}
        />
      ) : null}
      {step === 'desiredWeight' ? <DesiredWeightStep draft={draft} onChange={update} onNext={next} /> : null}
      {step === 'goalSpeed' ? <GoalSpeedStep draft={draft} onChange={(goalSpeed) => update({ goalSpeed })} onNext={next} /> : null}
      {step === 'notifications' ? (
        <NotificationsStep
          onDecision={(enabled) => {
            update({ notificationsEnabled: enabled });
            next();
          }}
        />
      ) : null}
      {step === 'health' ? (
        <HealthStep
          onContinue={() => {
            update({ healthEnabled: false });
            next();
          }}
        />
      ) : null}
      {step === 'aiSetup' ? <AISetupScreen embedded onContinue={next} onShowPaywall={onShowPaywall} onSubstepChange={setAiSubstep} resetToChoiceToken={aiResetToken} /> : null}
      {step === 'buildingPlan' ? (
        <BuildingPlanStep
          profile={profile}
          onReady={(p) => {
            setPlan(p);
            setPlanEdited(false);
            next();
          }}
        />
      ) : null}
      {step === 'planReady' && plan ? (
        <PlanReadyStep
          plan={plan}
          profile={profile}
          onChange={(p) => {
            setPlan(p);
            setPlanEdited(true);
          }}
          onFinish={finish}
        />
      ) : null}
    </Screen>
  );
}

// MARK: - 0 Welcome

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: theme.spacing.xl }}>
        <Image source={require('../../../assets/onboarding-logo.png')} style={{ width: 120, height: 120, borderRadius: 28 }} accessibilityIgnoresInvertColors />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <AppText style={{ fontSize: 32, lineHeight: 38, fontWeight: '700' }}>Eat Smart,</AppText>
          <AppText tone="accent" style={{ fontSize: 32, lineHeight: 38, fontWeight: '700' }}>
            Live Better
          </AppText>
        </View>
        <AppText variant="callout" tone="secondary" align="center">
          Just snap, track, and thrive.{'\n'}Your nutrition, simplified.
        </AppText>
        <View style={{ gap: 12, paddingTop: 8 }}>
          <FeatureRow icon="camera" text="Snap a photo — AI logs it" />
          <FeatureRow icon="bubble.left.and.bubble.right.fill" text="Coach that knows your data" />
          <FeatureRow icon="dumbbell.fill" text="870+ exercise library" />
          <FeatureRow icon="applewatch" text="Widgets & Apple Watch (native apps)" />
        </View>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
        <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <LinearGradient colors={theme.colors.accentGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}>
            <AppText variant="headline" tone="onAccent">
              Get Started
            </AppText>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// MARK: - 1 Gender

const genderIcons: Record<Gender, SFSymbolName> = { male: 'figure.stand', female: 'figure.stand.dress', other: 'figure.wave' };

function GenderStep({ value, onChange, onNext }: { value: Gender; onChange: (g: Gender) => void; onNext: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <StepHeader title="What's your gender?" subtitle="This helps us calculate your metabolism" />
      <View style={{ flex: 1, justifyContent: 'center', gap: 12, paddingHorizontal: theme.spacing.xl }}>
        {genders.map((g) => (
          <SelectionCard key={g} icon={genderIcons[g]} title={genderDisplayName(g)} isSelected={value === g} onPress={() => onChange(g)} />
        ))}
      </View>
      <ContinueButton onPress={onNext} />
    </View>
  );
}

// MARK: - 2 Birthday

const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }));

function BirthdayStep({ value, onChange, onNext }: { value: string; onChange: (iso: string) => void; onNext: () => void }) {
  const theme = useTheme();
  const date = new Date(value);
  const [picker, setPicker] = useState<'month' | 'day' | 'year' | null>(null);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(thisYear - i));
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  const set = (year: number, month: number, day: number) => {
    const clampedDay = Math.min(day, new Date(year, month + 1, 0).getDate());
    const candidate = new Date(year, month, clampedDay, 12);
    onChange((candidate > new Date() ? new Date() : candidate).toISOString());
  };

  const field = (label: string, valueText: string, key: 'month' | 'day' | 'year') => (
    <Pressable accessibilityRole="button" onPress={() => setPicker(key)} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: theme.radii.control, backgroundColor: theme.colors.appCard }}>
      <AppText variant="caption" tone="secondary" weight="500">
        {label}
      </AppText>
      <AppText variant="title3">{valueText}</AppText>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <StepHeader title="When's your birthday?" subtitle="Used to calculate your daily needs" />
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xl }}>
        <Row style={{ gap: 8 }}>
          {field('Month', monthNames[date.getMonth()] ?? '', 'month')}
          {field('Day', String(date.getDate()), 'day')}
          {field('Year', String(date.getFullYear()), 'year')}
        </Row>
      </View>
      <ContinueButton onPress={onNext} />
      <PickerSheet<string>
        visible={picker === 'month'}
        title="Month"
        options={monthNames.map((m, i) => ({ value: String(i), label: m }))}
        selected={String(date.getMonth())}
        onSelect={(m) => set(date.getFullYear(), Number(m), date.getDate())}
        onDismiss={() => setPicker(null)}
      />
      <PickerSheet<string> visible={picker === 'day'} title="Day" options={days.map((d) => ({ value: d, label: d }))} selected={String(date.getDate())} onSelect={(d) => set(date.getFullYear(), date.getMonth(), Number(d))} onDismiss={() => setPicker(null)} />
      <PickerSheet<string> visible={picker === 'year'} title="Year" options={years.map((y) => ({ value: y, label: y }))} selected={String(date.getFullYear())} onSelect={(y) => set(Number(y), date.getMonth(), date.getDate())} onDismiss={() => setPicker(null)} />
    </View>
  );
}

// MARK: - 3 Height & Weight

function HeightWeightStep({ draft, onChange, onNext }: { draft: OnboardingDraft; onChange: (d: OnboardingDraft) => void; onNext: () => void }) {
  const theme = useTheme();
  const [text, setText] = useState(() => ({
    cm: String(draft.heightCm),
    ft: String(draft.heightFeet),
    in: String(draft.heightInches),
    kg: draft.weightKg.toFixed(1),
    lbs: draft.weightLbs.toFixed(1),
  }));
  const commit = (patch: Partial<typeof text>) => {
    const merged = { ...text, ...patch };
    setText(merged);
    const num = (v: string, fallback: number) => {
      const n = Number.parseFloat(v.replace(',', '.'));
      return Number.isFinite(n) ? n : fallback;
    };
    onChange({
      ...draft,
      heightCm: Math.round(num(merged.cm, draft.heightCm)),
      heightFeet: Math.round(num(merged.ft, draft.heightFeet)),
      heightInches: Math.round(num(merged.in, draft.heightInches)),
      weightKg: num(merged.kg, draft.weightKg),
      weightLbs: num(merged.lbs, draft.weightLbs),
    });
  };
  const switchUnits = (metric: boolean) => {
    const converted = setDraftMetric(draft, metric);
    onChange(converted);
    setText({ cm: String(converted.heightCm), ft: String(converted.heightFeet), in: String(converted.heightInches), kg: converted.weightKg.toFixed(1), lbs: converted.weightLbs.toFixed(1) });
  };
  const valid = draft.isMetric
    ? draft.heightCm >= heightLimits.cm.min && draft.heightCm <= heightLimits.cm.max && draft.weightKg >= weightLimits.kg.min && draft.weightKg <= weightLimits.kg.max
    : draft.heightFeet >= heightLimits.feet.min && draft.heightFeet <= heightLimits.feet.max && draft.weightLbs >= weightLimits.lbs.min && draft.weightLbs <= weightLimits.lbs.max;

  return (
    <View style={{ flex: 1 }}>
      <StepHeader title="Height & Weight" subtitle="We'll keep this private" />
      <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg }}>
        <SegmentedControl<'imperial' | 'metric'>
          segments={[
            { value: 'imperial', label: 'Imperial' },
            { value: 'metric', label: 'Metric' },
          ]}
          selected={draft.isMetric ? 'metric' : 'imperial'}
          onSelect={(v) => switchUnits(v === 'metric')}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 28, paddingVertical: 24 }}>
        {draft.isMetric ? (
          <StepperField label="Height" value={text.cm} onChange={(cm) => commit({ cm })} step={1} unit="cm" fractionDigits={0} integerOnly min={heightLimits.cm.min} max={heightLimits.cm.max} accessibilityLabel="Height in centimeters" />
        ) : (
          <Row style={{ justifyContent: 'center', gap: 24 }}>
            <StepperField compact label="Feet" value={text.ft} onChange={(ft) => commit({ ft })} step={1} unit="ft" fractionDigits={0} integerOnly min={heightLimits.feet.min} max={heightLimits.feet.max} accessibilityLabel="Height in feet" />
            <StepperField compact label="Inches" value={text.in} onChange={(inch) => commit({ in: inch })} step={1} unit="in" fractionDigits={0} integerOnly min={heightLimits.inches.min} max={heightLimits.inches.max} accessibilityLabel="Height in inches" />
          </Row>
        )}
        {draft.isMetric ? (
          <StepperField label="Weight" value={text.kg} onChange={(kg) => commit({ kg })} step={0.1} unit="kg" min={weightLimits.kg.min} max={weightLimits.kg.max} accessibilityLabel="Weight in kilograms" />
        ) : (
          <StepperField label="Weight" value={text.lbs} onChange={(lbs) => commit({ lbs })} step={0.1} unit="lbs" min={weightLimits.lbs.min} max={weightLimits.lbs.max} accessibilityLabel="Weight in pounds" />
        )}
      </ScrollView>
      <ContinueButton onPress={onNext} disabled={!valid} />
    </View>
  );
}

// MARK: - 4 Body fat

function BodyFatStep({ draft, onChange, onNext }: { draft: OnboardingDraft; onChange: (patch: Partial<OnboardingDraft>) => void; onNext: () => void }) {
  const theme = useTheme();
  const [current, setCurrent] = useState(String(draft.bodyFatPercent));
  const [goal, setGoal] = useState(String(draft.goalBodyFatPercent ?? draft.bodyFatPercent));
  const parse = (v: string, fallback: number) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, bodyFatPercentLimits.min), bodyFatPercentLimits.max) : fallback;
  };
  return (
    <View style={{ flex: 1 }}>
      <StepHeader title={'Do you know your\nbody fat %?'} subtitle="Helps us calculate your metabolism more accurately" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, gap: 16, paddingHorizontal: theme.spacing.xl, paddingVertical: 24 }}>
        <SelectionCard icon="checkmark.circle" title="Yes" isSelected={draft.knowsBodyFat} onPress={() => onChange({ knowsBodyFat: true })} />
        <SelectionCard icon="xmark.circle" title="No" isSelected={!draft.knowsBodyFat} onPress={() => onChange({ knowsBodyFat: false })} />
        {draft.knowsBodyFat ? (
          <View style={{ gap: 16, paddingTop: 8 }}>
            <AppText variant="subheadlineSemibold" tone="secondary">
              Current
            </AppText>
            <StepperField
              value={current}
              onChange={(v) => {
                setCurrent(v);
                onChange({ bodyFatPercent: parse(v, draft.bodyFatPercent) });
              }}
              step={1}
              unit="%"
              fractionDigits={0}
              integerOnly
              min={bodyFatPercentLimits.min}
              max={bodyFatPercentLimits.max}
              accessibilityLabel="Body fat percentage"
            />
            <AppText variant="caption" tone="secondary" align="center">
              Common ranges: Men 10–25%, Women 18–35%
            </AppText>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText variant="subheadlineSemibold" tone="secondary">
                Goal (optional)
              </AppText>
              <Switch
                value={draft.goalBodyFatPercent !== undefined}
                onValueChange={(on) => onChange({ goalBodyFatPercent: on ? draft.bodyFatPercent : undefined })}
                trackColor={{ true: theme.colors.accent, false: theme.colors.fill }}
                thumbColor="#FFFFFF"
              />
            </Row>
            {draft.goalBodyFatPercent !== undefined ? (
              <StepperField
                value={goal}
                onChange={(v) => {
                  setGoal(v);
                  onChange({ goalBodyFatPercent: parse(v, draft.goalBodyFatPercent ?? draft.bodyFatPercent) });
                }}
                step={1}
                unit="%"
                fractionDigits={0}
                integerOnly
                min={bodyFatPercentLimits.min}
                max={bodyFatPercentLimits.max}
                accessibilityLabel="Goal body fat percentage"
              />
            ) : (
              <AppText variant="caption" tone="tertiary">
                You can set this later in Settings.
              </AppText>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 24 }}>
            <Icon name="function" size={28} color={theme.colors.secondaryLabel} />
            <AppText variant="callout" tone="secondary" align="center">
              No worries! We'll use a standard formula{'\n'}based on your height, weight, and age.
            </AppText>
          </View>
        )}
      </ScrollView>
      <ContinueButton onPress={onNext} />
    </View>
  );
}

// MARK: - 5 Activity

const activityIcons: Record<ActivityLevel, SFSymbolName> = {
  sedentary: 'figure.stand',
  light: 'figure.walk',
  moderate: 'figure.run',
  active: 'figure.highintensity.intervaltraining',
  veryActive: 'figure.strengthtraining.traditional',
  extraActive: 'figure.martial.arts',
};

function ActivityStep({ value, onChange, onNext }: { value: ActivityLevel; onChange: (a: ActivityLevel) => void; onNext: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <StepHeader title="How active are you?" subtitle="Choose based on your average week, including work and exercise." />
      <ScrollView contentContainerStyle={{ gap: 12, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.lg }}>
        {activityLevels.map((level) => (
          <SelectionCard key={level} icon={activityIcons[level]} title={activityLevelDisplayName(level)} subtitle={activityLevelSubtitle(level)} isSelected={value === level} onPress={() => onChange(level)} />
        ))}
      </ScrollView>
      <ContinueButton onPress={onNext} />
    </View>
  );
}

// MARK: - 6 Goal

const goalIcons: Record<WeightGoal, SFSymbolName> = { lose: 'arrow.down.right', maintain: 'equal', gain: 'arrow.up.right' };

function GoalStep({ value, onChange, onNext }: { value: WeightGoal; onChange: (g: WeightGoal) => void; onNext: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <StepHeader title="What's your goal?" subtitle="You can change this anytime" />
      <View style={{ flex: 1, justifyContent: 'center', gap: 12, paddingHorizontal: theme.spacing.xl }}>
        {weightGoals.map((g) => (
          <SelectionCard key={g} icon={goalIcons[g]} title={weightGoalDisplayName(g)} isSelected={value === g} onPress={() => onChange(g)} />
        ))}
      </View>
      <ContinueButton onPress={onNext} />
    </View>
  );
}

// MARK: - 7 Desired weight

function DesiredWeightStep({ draft, onChange, onNext }: { draft: OnboardingDraft; onChange: (patch: Partial<OnboardingDraft>) => void; onNext: () => void }) {
  const metric = draft.isMetric;
  const unit = metric ? 'kg' : 'lbs';
  const [text, setText] = useState((metric ? draft.targetWeightKg : draft.targetWeightLbs).toFixed(1));
  const limits = metric ? weightLimits.kg : weightLimits.lbs;
  const parsed = Number.parseFloat(text.replace(',', '.'));
  // Bounds *and* direction: a loss target must sit below the current weight, a gain target above it.
  const problem = targetWeightProblem(draft, parsed);
  const current = (metric ? draft.weightKg : draft.weightLbs).toFixed(1);
  const problemText =
    problem === 'notBelowCurrent'
      ? `To lose weight, pick a target below your current ${current} ${unit}.`
      : problem === 'notAboveCurrent'
        ? `To gain weight, pick a target above your current ${current} ${unit}.`
        : problem === 'outOfRange'
          ? `Enter a weight between ${limits.min} and ${limits.max} ${unit}.`
          : undefined;
  return (
    <View style={{ flex: 1 }}>
      <StepHeader title={"What's your\ndesired weight?"} subtitle={weightGoalDisplayName(draft.goal)} />
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <StepperField
          value={text}
          onChange={(v) => {
            setText(v);
            const n = Number.parseFloat(v.replace(',', '.'));
            if (Number.isFinite(n)) onChange(metric ? { targetWeightKg: n } : { targetWeightLbs: n });
          }}
          step={0.1}
          unit={unit}
          min={limits.min}
          max={limits.max}
          accessibilityLabel="Desired weight"
        />
        {problemText ? (
          <AppText variant="footnote" tone="destructive" align="center" style={{ paddingHorizontal: 32 }} accessibilityLiveRegion="polite">
            {problemText}
          </AppText>
        ) : null}
      </View>
      <ContinueButton onPress={onNext} disabled={problem !== undefined} />
    </View>
  );
}

// MARK: - 8 Goal speed

function GoalSpeedStep({ draft, onChange, onNext }: { draft: OnboardingDraft; onChange: (speed: GoalSpeed) => void; onNext: () => void }) {
  const theme = useTheme();
  const maintain = draft.goal === 'maintain';
  const weekly = weeklyChangeKg(draft.goalSpeed);
  const display = draft.isMetric ? `${weekly.toFixed(2)} kg` : `${(weekly * 2.20462).toFixed(1)} lbs`;
  const speeds: { speed: GoalSpeed; icon: SFSymbolName }[] = [
    { speed: 0, icon: 'tortoise.fill' },
    { speed: 1, icon: 'hare.fill' },
    { speed: 2, icon: 'bolt.fill' },
  ];
  return (
    <View style={{ flex: 1 }}>
      <StepHeader
        title={maintain ? 'Your pace' : 'How fast do you want\nto reach your goal?'}
        subtitle={maintain ? "We'll set a balanced plan" : `${draft.goal === 'lose' ? 'Weight loss' : 'Weight gain'} speed per week`}
      />
      <View style={{ flex: 1, justifyContent: 'center', gap: 24, paddingHorizontal: theme.spacing.xl }}>
        {maintain ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Icon name="checkmark.seal.fill" size={48} color={theme.colors.accent} />
            <AppText variant="title3">Balanced pace set</AppText>
            <AppText variant="callout" tone="secondary" align="center">
              We'll keep your calories steady{'\n'}to maintain your current weight.
            </AppText>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <AppText style={{ fontSize: 40, lineHeight: 46, fontWeight: '700' }}>{display}</AppText>
              <AppText variant="callout" tone="secondary">
                per week
              </AppText>
            </View>
            <Row>
              {speeds.map(({ speed, icon }) => {
                const selected = draft.goalSpeed === speed;
                return (
                  <Pressable key={speed} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(speed)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <Icon name={icon} size={24} color={selected ? theme.colors.accent : theme.colors.tertiaryLabel} />
                    <AppText variant="caption" weight="500" tone={selected ? 'accent' : 'secondary'}>
                      {goalSpeedTitle(speed)}
                    </AppText>
                  </Pressable>
                );
              })}
            </Row>
            <SegmentedControl<'0' | '1' | '2'>
              segments={[
                { value: '0', label: 'Slow' },
                { value: '1', label: 'Recommended' },
                { value: '2', label: 'Fast' },
              ]}
              selected={String(draft.goalSpeed) as '0' | '1' | '2'}
              onSelect={(v) => onChange(Number(v) as GoalSpeed)}
              style={{ marginHorizontal: 16 }}
            />
            <Card style={{ gap: 6, borderRadius: 14 }}>
              <Row style={{ flexWrap: 'wrap' }}>
                <AppText variant="subheadline" weight="500">
                  You'll reach your goal in{' '}
                </AppText>
                <AppText variant="subheadlineSemibold" tone="accent" weight="700">
                  {estimatedDays(draft)} days
                </AppText>
              </Row>
              <AppText variant="caption" tone="secondary">
                {goalSpeedDescription(draft.goalSpeed)}
              </AppText>
            </Card>
          </>
        )}
      </View>
      <ContinueButton onPress={onNext} />
    </View>
  );
}

// MARK: - 9 Notifications

function NotificationsStep({ onDecision }: { onDecision: (enabled: boolean) => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const allow = async () => {
    if (busy) return;
    setBusy(true);
    // "Enabled" means the reminders are actually on the OS schedule, not just that permission
    // was granted; `scheduleMealReminders` rolls back on failure, so nothing is left half-set.
    let enabled = await requestNotificationAuthorization();
    if (enabled) {
      try {
        await scheduleMealReminders();
      } catch (error) {
        console.warn('[fudai] scheduling meal reminders failed', error);
        enabled = false;
        Alert.alert('Reminders unavailable', 'Meal reminders could not be scheduled right now. You can turn them on later in Settings → Notifications.');
      }
    }
    setBusy(false);
    onDecision(enabled);
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: theme.spacing.xl }}>
        <Icon name="bell.badge.fill" size={56} color={theme.colors.accent} />
        <AppText variant="title" weight="700" align="center">
          Be reminded to{'\n'}log meals
        </AppText>
        <AppText variant="callout" tone="secondary" align="center">
          Get gentle reminders at meal times{'\n'}so you never forget to track.
        </AppText>
        <Card style={{ alignSelf: 'stretch', gap: 12 }}>
          <AppText variant="subheadline" weight="500" align="center">
            Fud AI would like to send you Notifications
          </AppText>
          <Divider />
          <Row>
            <Pressable accessibilityRole="button" onPress={() => onDecision(false)} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
              <AppText variant="subheadline" tone="secondary" weight="500">
                Don't Allow
              </AppText>
            </Pressable>
            <View style={{ width: 1, height: 30, backgroundColor: theme.colors.separator }} />
            <Pressable accessibilityRole="button" onPress={() => void allow()} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
              {busy ? <ActivityIndicator color={theme.colors.accent} /> : <AppText variant="subheadlineSemibold">Allow</AppText>}
            </Pressable>
          </Row>
        </Card>
      </View>
      <Pressable accessibilityRole="button" onPress={() => onDecision(false)} style={{ alignSelf: 'center', paddingBottom: theme.spacing.xxl }}>
        <AppText variant="body" tone="secondary" weight="500">
          Skip
        </AppText>
      </Pressable>
    </View>
  );
}

// MARK: - 10 Health

function HealthStep({ onContinue }: { onContinue: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: theme.spacing.xl }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: theme.colors.fill, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="heart.fill" size={48} color="#FF2D55" />
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <AppText variant="title" weight="700" align="center">
            Connect to{'\n'}Health
          </AppText>
          <AppText variant="callout" tone="secondary" align="center">
            Keep your nutrition, steps, and body{'\n'}measurements in sync automatically.
          </AppText>
        </View>
        <View style={{ gap: 12, paddingHorizontal: 16 }}>
          <FeatureRow icon="fork.knife" text="Nutrition Data" tint="secondary" />
          <FeatureRow icon="scalemass.fill" text="Weight Sync" tint="secondary" />
          <FeatureRow icon="figure.stand" text="Body Measurements" tint="secondary" />
          <FeatureRow icon="figure.walk" text="Daily Steps" tint="secondary" />
          <FeatureRow icon="applewatch" text="Watch Workouts" tint="secondary" />
        </View>
        <Card style={{ alignSelf: 'stretch' }}>
          <AppText variant="footnote" tone="secondary" align="center">
            Apple Health and Health Connect sync run in the native iOS and Android apps. The shared app keeps the switch in Settings → Health & Data so it can be turned on when the bridge lands.
          </AppText>
        </Card>
      </View>
      <ContinueButton onPress={onContinue} />
    </View>
  );
}

// MARK: - 12 Building plan

function BuildingPlanStep({ profile, onReady }: { profile: ReturnType<typeof profileFromDraft>; onReady: (plan: NutritionPlan) => void }) {
  const theme = useTheme();
  useEffect(() => {
    // The native step runs an AI refinement with the formula as fallback; the shared app
    // lands on the formula plan and lets the user adjust it (Recalculate Goals later).
    const timer = setTimeout(() => onReady(planFromProfile(profile)), 1400);
    return () => clearTimeout(timer);
  }, [profile, onReady]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: theme.spacing.xl }}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <AppText variant="title2" weight="700">
        Building your plan…
      </AppText>
      <AppText variant="callout" tone="secondary" align="center">
        Calculating your calorie and macro targets from your profile.
      </AppText>
    </View>
  );
}

// MARK: - 13 Plan ready

type EditableField = 'calories' | 'protein' | 'carbs' | 'fat';

function PlanReadyStep({ plan, profile, onChange, onFinish }: { plan: NutritionPlan; profile: ReturnType<typeof profileFromDraft>; onChange: (plan: NutritionPlan) => void; onFinish: () => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [text, setText] = useState('');
  const beginEdit = (field: EditableField) => {
    if (editing === field) {
      setEditing(null);
      return;
    }
    setEditing(field);
    setText(String(plan[field]));
  };
  const apply = (field: EditableField, value: string) => {
    setText(value);
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    switch (field) {
      case 'calories':
        onChange(editPlanCalories(plan, n));
        return;
      case 'protein':
        onChange(editPlanProtein(plan, n));
        return;
      case 'carbs':
        onChange(editPlanCarbs(plan, n));
        return;
      case 'fat':
        onChange(editPlanFat(plan, n));
    }
  };
  const editor = (field: EditableField, unit: string, step: number, min: number, max: number) =>
    editing === field ? (
      <StepperField value={text} onChange={(v) => apply(field, v)} step={step} unit={unit} fractionDigits={0} integerOnly min={min} max={max} accessibilityLabel={field} />
    ) : null;

  const macroCard = (label: string, field: Exclude<EditableField, 'calories'>) => (
    <Pressable key={field} accessibilityRole="button" onPress={() => beginEdit(field)} style={{ flex: 1 }}>
      <LinearGradient colors={theme.colors.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, opacity: editing && editing !== field ? 0.7 : 1 }}>
        <AppText variant="title3" tone="onAccent" weight="700">
          {plan[field]}g
        </AppText>
        <Row style={{ gap: 4 }}>
          <AppText variant="caption" tone="onAccent" weight="500">
            {label}
          </AppText>
          <Icon name="pencil.circle.fill" size={11} color="rgba(255,255,255,0.8)" />
        </Row>
      </LinearGradient>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <StepHeader title="Your Plan" subtitle="Tap any value to adjust" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20, paddingTop: 16, paddingBottom: 24 }}>
        <AppText variant="footnote" tone="secondary" align="center" style={{ paddingHorizontal: 32 }}>
          Your plan auto-adjusts weekly as you log — turn off Adaptive Goals in Settings to keep it fixed.
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => beginEdit('calories')} style={{ alignItems: 'center', gap: 4 }}>
          <AppText tone="accent" style={{ fontSize: 64, lineHeight: 72, fontWeight: '700' }}>
            {plan.calories}
          </AppText>
          <Row style={{ gap: 4 }}>
            <AppText variant="callout" tone="secondary" weight="500">
              daily calories
            </AppText>
            <Icon name="pencil.circle.fill" size={14} color={theme.colors.tertiaryLabel} />
          </Row>
        </Pressable>
        {editor('calories', 'cal', planLimits.calories.step, planLimits.calories.min, planLimits.calories.max)}
        <Row style={{ gap: 12, paddingHorizontal: theme.spacing.xl }}>
          {macroCard('Protein', 'protein')}
          {macroCard('Carbs', 'carbs')}
          {macroCard('Fat', 'fat')}
        </Row>
        {editor('protein', 'g', 1, planLimits.protein.min, planLimits.protein.max)}
        {editor('carbs', 'g', 1, planLimits.carbs.min, planLimits.carbs.max)}
        {editor('fat', 'g', 1, planLimits.fat.min, planLimits.fat.max)}
        {plan.calories < MINIMUM_RECOMMENDED_CALORIES ? (
          <Row style={{ gap: 10, marginHorizontal: theme.spacing.xl, padding: 14, borderRadius: theme.radii.control, backgroundColor: 'rgba(255,149,0,0.1)', alignItems: 'flex-start' }}>
            <Icon name="exclamationmark.triangle.fill" size={18} color="#FF9500" />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="subheadlineSemibold">Please consult with a doctor</AppText>
              <AppText variant="caption" tone="secondary">
                The minimum recommendation is 1,200 calories per day.
              </AppText>
            </View>
          </Row>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('How is this calculated?', calculationMethodsSummary(profile))} style={{ alignSelf: 'center', paddingTop: 8 }}>
          <Row style={{ gap: 6 }}>
            <Icon name="book.fill" size={11} color={theme.colors.accent} />
            <AppText variant="footnoteSemibold" tone="accent">
              How is this calculated?
            </AppText>
            <Icon name="chevron.right" size={10} color={theme.colors.accent} />
          </Row>
        </Pressable>
      </ScrollView>
      <View style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
        <Pressable accessibilityRole="button" onPress={onFinish} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <LinearGradient colors={theme.colors.accentGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ height: theme.sizes.primaryButtonHeight, borderRadius: theme.radii.card, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="bodySemibold" tone="onAccent">
              Start Tracking
            </AppText>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}