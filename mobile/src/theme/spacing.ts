/** Spacing and radii used by the SwiftUI layouts (padding 16/24, card radius 16, CTA height 54). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
} as const;

export const radii = {
  card: 16,
  cardLarge: 20,
  control: 12,
  pill: 999,
} as const;

export const sizes = {
  primaryButtonHeight: 54,
  secondaryButtonHeight: 48,
  addButton: 60,
  /** Calorie dome geometry shared with iOS (`CalorieGauge`: 240 / 14) and Android. */
  calorieGaugeDiameter: 240,
  calorieGaugeLineWidth: 14,
  macroBarWidth: 16,
  macroBarHeight: 64,
  weekDayTile: 36,
} as const;
