/**
 * Accent palette and surface colors shared by every screen.
 *
 * Mirrors `ios/calorietracker/Views/Theme.swift` (`AppThemeColor` / `AppColors`) and the
 * `appBackground` / `appCard` color sets in `Assets.xcassets`. Android renders these exact
 * values too: there is no separate Material palette.
 */

export const APP_THEME_COLOR_STORAGE_KEY = 'appThemeColor';

export const appThemeColorIds = [
  'fudPink',
  'red',
  'orange',
  'green',
  'mint',
  'teal',
  'blue',
  'purple',
  'yellow',
  'coral',
  'roseGold',
  'mochaBrown',
  'indigo',
  'lavender',
  'skyCyan',
  'graphite',
  'babyPink',
  'lime',
] as const;

export type AppThemeColorId = (typeof appThemeColorIds)[number];

export const DEFAULT_APP_THEME_COLOR: AppThemeColorId = 'fudPink';

interface AccentDefinition {
  displayName: string;
  /** Gradient start (also the flat accent color). */
  start: string;
  /** Gradient end. */
  end: string;
}

export const appThemeColors: Record<AppThemeColorId, AccentDefinition> = {
  fudPink: { displayName: 'Fud Pink', start: '#FF375F', end: '#FF6B8A' },
  red: { displayName: 'Red', start: '#FF3B30', end: '#FF6961' },
  orange: { displayName: 'Orange', start: '#FF9500', end: '#FFB340' },
  green: { displayName: 'Green', start: '#34C759', end: '#62D46F' },
  mint: { displayName: 'Mint', start: '#00C7BE', end: '#66D4CF' },
  teal: { displayName: 'Teal', start: '#30B0C7', end: '#64D2FF' },
  blue: { displayName: 'Blue', start: '#0A84FF', end: '#5EAEFF' },
  purple: { displayName: 'Purple', start: '#AF52DE', end: '#BF5AF2' },
  yellow: { displayName: 'Yellow', start: '#FFCC00', end: '#FFD60A' },
  coral: { displayName: 'Coral', start: '#FF7F50', end: '#FFA382' },
  roseGold: { displayName: 'Rose Gold', start: '#C9807C', end: '#E8B4B0' },
  mochaBrown: { displayName: 'Mocha Brown', start: '#A2845E', end: '#C9A57E' },
  indigo: { displayName: 'Indigo', start: '#5856D6', end: '#7D7AFF' },
  lavender: { displayName: 'Lavender', start: '#B57EDC', end: '#D0A9F5' },
  skyCyan: { displayName: 'Sky Cyan', start: '#32ADE6', end: '#70CFFF' },
  graphite: { displayName: 'Graphite', start: '#8E8E93', end: '#B8B8BE' },
  babyPink: { displayName: 'Baby Pink', start: '#FF8FAB', end: '#FFB3C6' },
  lime: { displayName: 'Lime', start: '#A0D911', end: '#C3E956' },
};

export function isAppThemeColorId(value: unknown): value is AppThemeColorId {
  return typeof value === 'string' && (appThemeColorIds as readonly string[]).includes(value);
}

export function appThemeColor(rawValue: string | null | undefined): AppThemeColorId {
  return isAppThemeColorId(rawValue) ? rawValue : DEFAULT_APP_THEME_COLOR;
}

export type ColorSchemeName = 'light' | 'dark';

/**
 * Surface colors. Light mode is the warm cream from the iOS asset catalog
 * (`appBackground` 0.957/0.922/0.878, `appCard` 0.992/0.973/0.941); dark mode is
 * system black with the iOS secondary-system-background card.
 */
export const surfaceColors: Record<
  ColorSchemeName,
  {
    appBackground: string;
    appCard: string;
    label: string;
    secondaryLabel: string;
    tertiaryLabel: string;
    separator: string;
    fill: string;
    placeholder: string;
    destructive: string;
  }
> = {
  light: {
    appBackground: '#F4EBE0',
    appCard: '#FDF8F0',
    label: '#000000',
    secondaryLabel: 'rgba(60, 60, 67, 0.60)',
    tertiaryLabel: 'rgba(60, 60, 67, 0.30)',
    separator: 'rgba(60, 60, 67, 0.29)',
    fill: 'rgba(120, 120, 128, 0.20)',
    placeholder: 'rgba(60, 60, 67, 0.30)',
    destructive: '#FF3B30',
  },
  dark: {
    appBackground: '#000000',
    appCard: '#1C1C1E',
    label: '#FFFFFF',
    secondaryLabel: 'rgba(235, 235, 245, 0.60)',
    tertiaryLabel: 'rgba(235, 235, 245, 0.30)',
    separator: 'rgba(84, 84, 88, 0.60)',
    fill: 'rgba(120, 120, 128, 0.36)',
    placeholder: 'rgba(235, 235, 245, 0.30)',
    destructive: '#FF453A',
  },
};

/** `Color.opacity(x)` equivalent for hex accents. */
export function withOpacity(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, '$1$1') : normalized, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, opacity))})`;
}
