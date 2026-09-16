import type { TextStyle } from 'react-native';

/**
 * iOS Dynamic Type text styles at their default (Large) point sizes. The SwiftUI app uses
 * `.design(.rounded)` throughout; a rounded system face is not exposed to React Native, so
 * every screen renders the platform system font with the same sizes and weights on both
 * platforms. Swapping in a bundled rounded font later is a one-line change here.
 */
export const fontFamily: string | undefined = undefined;

type Weight = NonNullable<TextStyle['fontWeight']>;

function style(fontSize: number, lineHeight: number, fontWeight: Weight = '400'): TextStyle {
  return { fontFamily, fontSize, lineHeight, fontWeight };
}

export const textStyles = {
  largeTitle: style(34, 41, '700'),
  title: style(28, 34, '700'),
  title2: style(22, 28, '700'),
  title3: style(20, 25, '600'),
  headline: style(17, 22, '600'),
  body: style(17, 22),
  bodySemibold: style(17, 22, '600'),
  callout: style(16, 21),
  subheadline: style(15, 20),
  subheadlineSemibold: style(15, 20, '600'),
  footnote: style(13, 18),
  footnoteSemibold: style(13, 18, '600'),
  caption: style(12, 16),
  captionSemibold: style(12, 16, '600'),
  caption2: style(11, 13),
  caption2Semibold: style(11, 13, '600'),
} as const satisfies Record<string, TextStyle>;

export type TextStyleName = keyof typeof textStyles;
