/** Water tracking. Mirrors `WaterStore.swift` (`WaterSettings`, `WaterUnit`, `WaterEntry`). */

export const waterSettings = {
  enabledKey: 'waterTrackingEnabled',
  dailyGoalKey: 'waterDailyGoalMl',
  unitKey: 'waterUnit',
  reminderEnabledKey: 'waterReminderEnabled',
  reminderHourKey: 'waterReminderHour',
  reminderMinuteKey: 'waterReminderMinute',
  entriesKey: 'waterEntries',
  defaultDailyGoalMl: 2_000,
  dailyGoalOptions: [1_500, 2_000, 2_500, 3_000, 3_500, 4_000] as readonly number[],
  /** Quick-add presets from the Home "+" menu (1 / 2 / 3 glasses). */
  quickAddMilliliters: [250, 500, 750] as readonly number[],
} as const;

export type WaterUnit = 'ml' | 'floz';

export const DEFAULT_WATER_UNIT: WaterUnit = 'ml';
export const MILLILITERS_PER_FLUID_OUNCE = 29.5735295625;

export function waterUnitTitle(unit: WaterUnit): string {
  return unit === 'ml' ? 'Milliliters' : 'Fluid Ounces';
}

export function waterUnitSymbol(unit: WaterUnit): string {
  return unit === 'ml' ? 'ml' : 'fl oz';
}

export function waterDisplayAmount(unit: WaterUnit, milliliters: number): number {
  return unit === 'ml' ? milliliters : milliliters / MILLILITERS_PER_FLUID_OUNCE;
}

export function waterDisplayValue(unit: WaterUnit, milliliters: number): string {
  if (unit === 'ml') return milliliters.toLocaleString();
  const ounces = waterDisplayAmount(unit, milliliters);
  if (Math.abs(Math.round(ounces) - ounces) < 0.05) return Math.round(ounces).toLocaleString();
  return ounces.toFixed(1);
}

export function formatWater(unit: WaterUnit, milliliters: number): string {
  return `${waterDisplayValue(unit, milliliters)} ${waterUnitSymbol(unit)}`;
}

export function millilitersFromDisplayedValue(unit: WaterUnit, value: number): number {
  const converted = unit === 'ml' ? value : value * MILLILITERS_PER_FLUID_OUNCE;
  return Math.max(1, Math.round(converted));
}

export interface WaterEntry {
  id: string;
  /** ISO-8601 */
  date: string;
  milliliters: number;
}
