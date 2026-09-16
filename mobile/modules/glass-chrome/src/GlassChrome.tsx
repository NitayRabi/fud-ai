import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

export interface GlassChromeProps extends ViewProps {
  /** Hex tint applied to the glass (iOS 26+ only). */
  tint?: string;
  /** Liquid Glass reacts to touch when true (iOS 26+ only). */
  interactive?: boolean;
  cornerRadius?: number;
  /** Background used on Android and wherever the native module is unavailable (Expo Go). */
  fallbackColor?: string;
  style?: StyleProp<ViewStyle>;
}

type NativeProps = Pick<GlassChromeProps, 'tint' | 'interactive' | 'cornerRadius' | 'style' | 'children'>;

interface GlassChromeNativeModule {
  isLiquidGlassAvailable: boolean;
}

function loadNative(): { View: React.ComponentType<NativeProps>; module: GlassChromeNativeModule } | undefined {
  if (Platform.OS !== 'ios') return undefined;
  try {
    return {
      View: requireNativeViewManager<NativeProps>('GlassChrome'),
      module: requireNativeModule<GlassChromeNativeModule>('GlassChrome'),
    };
  } catch {
    // Expo Go and prebuilt binaries without the local module fall back to a plain View.
    return undefined;
  }
}

const native = loadNative();

/** True only on iOS 26+ with the native module linked. Android is always false by design. */
export const isLiquidGlassAvailable: boolean = native?.module.isLiquidGlassAvailable ?? false;

/**
 * Glass container. On iOS with the native module this is real UIKit glass; everywhere else it is
 * the same layout with a solid `fallbackColor`, so screens never branch on platform themselves.
 */
export function GlassChrome({ tint, interactive = false, cornerRadius = 0, fallbackColor, style, children, ...rest }: GlassChromeProps) {
  if (native) {
    return (
      <native.View tint={tint} interactive={interactive} cornerRadius={cornerRadius} style={style} {...rest}>
        {children}
      </native.View>
    );
  }
  return (
    <View
      style={[{ backgroundColor: fallbackColor, borderRadius: cornerRadius, overflow: 'hidden' }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}
