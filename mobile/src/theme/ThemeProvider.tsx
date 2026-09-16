import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import {
  appThemeColors,
  DEFAULT_APP_THEME_COLOR,
  surfaceColors,
  withOpacity,
  type AppThemeColorId,
  type ColorSchemeName,
} from './colors';
import { radii, sizes, spacing } from './spacing';
import { textStyles } from './typography';
import type { AppearanceMode } from '../domain/prefs/preferences';

export interface AppTheme {
  scheme: ColorSchemeName;
  accentId: AppThemeColorId;
  colors: {
    /** `AppColors.calorie` — the flat accent. Protein/carbs/fat share it, as on iOS. */
    accent: string;
    /** `AppColors.calorieGradient` — [start, end]. */
    accentGradient: readonly [string, string];
    appBackground: string;
    appCard: string;
    label: string;
    secondaryLabel: string;
    tertiaryLabel: string;
    separator: string;
    fill: string;
    placeholder: string;
    destructive: string;
    onAccent: string;
  };
  /** `accent.opacity(x)` */
  accentAlpha: (opacity: number) => string;
  text: typeof textStyles;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
}

export function buildTheme(accentId: AppThemeColorId, scheme: ColorSchemeName): AppTheme {
  const accent = appThemeColors[accentId];
  const surfaces = surfaceColors[scheme];
  return {
    scheme,
    accentId,
    colors: {
      accent: accent.start,
      accentGradient: [accent.start, accent.end],
      ...surfaces,
      onAccent: '#FFFFFF',
    },
    accentAlpha: (opacity) => withOpacity(accent.start, opacity),
    text: textStyles,
    spacing,
    radii,
    sizes,
  };
}

const ThemeContext = createContext<AppTheme>(buildTheme(DEFAULT_APP_THEME_COLOR, 'light'));

interface ThemeProviderProps {
  accentId: AppThemeColorId;
  appearanceMode: AppearanceMode;
  children: React.ReactNode;
}

export function ThemeProvider({ accentId, appearanceMode, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme: ColorSchemeName =
    appearanceMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearanceMode;
  const theme = useMemo(() => buildTheme(accentId, scheme), [accentId, scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}
