/**
 * Seams for the platform companions that are still native-only: Apple Health / Health
 * Connect (`HealthKitManager.swift`), the watchOS app (`WatchSnapshotSync.swift`) and home /
 * lock-screen widgets (`WidgetSnapshotWriter.swift`). The shared app ships the interfaces,
 * the status model Settings renders, and honest "not available in this build" defaults —
 * never a fake companion that silently drops data.
 */

import type { MobilePlatform } from '../ai/providers';

export type CompanionId = 'health' | 'watch' | 'widgets' | 'siri';

export type CompanionAvailability = 'nativeOnly' | 'available' | 'connected';

export interface CompanionStatus {
  id: CompanionId;
  title: string;
  availability: CompanionAvailability;
  /** One-line explanation shown under the row. */
  detail: string;
}

export function healthServiceName(platform: MobilePlatform): string {
  return platform === 'ios' ? 'Apple Health' : 'Health Connect';
}

/** What Settings → Health & Data lists for this platform and build. */
export function companionStatuses(platform: MobilePlatform, connected: Partial<Record<CompanionId, boolean>> = {}): CompanionStatus[] {
  const health = healthServiceName(platform);
  const statuses: CompanionStatus[] = [
    {
      id: 'health',
      title: health,
      availability: connected.health ? 'connected' : 'nativeOnly',
      detail: `Nutrition, weight and body-measurement sync with ${health} runs in the native ${platform === 'ios' ? 'iOS' : 'Android'} app. The shared app keeps your preference and will connect once the bridge module lands.`,
    },
    {
      id: 'widgets',
      title: platform === 'ios' ? 'Home & Lock Screen Widgets' : 'Home Screen Widgets',
      availability: 'nativeOnly',
      detail: 'Widget extensions read a snapshot the native app writes; they ship with the native builds only.',
    },
  ];
  if (platform === 'ios') {
    statuses.push(
      {
        id: 'watch',
        title: 'Apple Watch',
        availability: 'nativeOnly',
        detail: 'The watchOS companion (calorie ring, water, fasting) pairs with the native iOS app. No shared-app watch target exists yet, so nothing here pretends to sync.',
      },
      {
        id: 'siri',
        title: 'Siri & Shortcuts',
        availability: 'nativeOnly',
        detail: 'App Intents for logging food and water by voice ship with the native iOS app.',
      },
    );
  }
  return statuses;
}

export function companionAvailabilityLabel(availability: CompanionAvailability): string {
  switch (availability) {
    case 'nativeOnly':
      return 'Native app only';
    case 'available':
      return 'Available';
    case 'connected':
      return 'Connected';
  }
}

// MARK: - Health sync seam (`HealthKitManager`)

export interface HealthSample {
  /** ISO-8601. */
  date: string;
  value: number;
}

export interface HealthSync {
  readonly isAvailable: boolean;
  requestAuthorization(): Promise<boolean>;
  writeWeight(kg: number, date: Date): Promise<void>;
  writeBodyFat(fraction: number, date: Date): Promise<void>;
  writeNutrition(day: Date, totals: { calories: number; protein: number; carbs: number; fat: number }): Promise<void>;
  readSteps(day: Date): Promise<number | undefined>;
}

export class HealthUnavailableError extends Error {
  constructor(platform: MobilePlatform) {
    super(`${healthServiceName(platform)} sync is not available in this build.`);
    this.name = 'HealthUnavailableError';
  }
}

/** Default until a Health bridge module exists: authorization is refused, writes are no-ops. */
export function unavailableHealthSync(platform: MobilePlatform): HealthSync {
  return {
    isAvailable: false,
    async requestAuthorization() {
      return false;
    },
    async writeWeight() {
      throw new HealthUnavailableError(platform);
    },
    async writeBodyFat() {
      throw new HealthUnavailableError(platform);
    },
    async writeNutrition() {
      throw new HealthUnavailableError(platform);
    },
    async readSteps() {
      return undefined;
    },
  };
}

// MARK: - Watch / widget snapshot seam (`WidgetSnapshot`, `WatchSnapshotSync`)

/** The subset of Home state the native widgets and watch app render. */
export interface CompanionSnapshot {
  /** `yyyy-MM-dd` local day. */
  day: string;
  caloriesEaten: number;
  calorieGoal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMilliliters: number;
  waterGoalMilliliters: number;
  /** ISO-8601 when a fast is running. */
  fastStartedAt?: string;
  fastGoalMinutes?: number;
  accentId: string;
}

export interface CompanionSnapshotWriter {
  readonly isAvailable: boolean;
  write(snapshot: CompanionSnapshot): Promise<void>;
}

export const noopSnapshotWriter: CompanionSnapshotWriter = {
  isAvailable: false,
  async write() {},
};
