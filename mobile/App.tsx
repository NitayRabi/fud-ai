import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { AISetupScreen } from './src/screens/onboarding/AISetupScreen';
import { HostedPaywallSheet } from './src/screens/paywall/HostedPaywallSheet';
import { hydrateAndPersistStores, setPreferences, usePreferences } from './src/state/appStores';
import { appThemeColor, ThemeProvider, useTheme } from './src/theme';

/**
 * Root: hydrate stores, then gate on onboarding exactly like `calorietrackerApp.swift`
 * (`hasCompletedOnboarding`). Only the AI setup step of onboarding is ported so far.
 */
export default function App() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;
    hydrateAndPersistStores()
      .then((cleanup) => {
        if (disposed) cleanup();
        else dispose = cleanup;
      })
      .catch((error: unknown) => {
        // Storage failures are already reported per store; whatever happened, the app must
        // start with defaults rather than sit on the spinner.
        console.error('[fudai] hydration failed; starting with defaults', error);
      })
      .finally(() => {
        if (!disposed) setHydrated(true);
      });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  const appearanceMode = usePreferences((p) => p.appearanceMode);
  const accentId = usePreferences((p) => appThemeColor(p.appThemeColor));

  return (
    <SafeAreaProvider>
      <ThemeProvider accentId={accentId} appearanceMode={appearanceMode}>
        <Root hydrated={hydrated} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Root({ hydrated }: { hydrated: boolean }) {
  const theme = useTheme();
  const hasCompletedOnboarding = usePreferences((p) => p.hasCompletedOnboarding);
  const [paywallVisible, setPaywallVisible] = useState(false);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {!hydrated ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.appBackground }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : hasCompletedOnboarding ? (
        <RootNavigator />
      ) : (
        <>
          <AISetupScreen onContinue={() => setPreferences({ hasCompletedOnboarding: true })} onShowPaywall={() => setPaywallVisible(true)} />
          <HostedPaywallSheet visible={paywallVisible} onDismiss={() => setPaywallVisible(false)} />
        </>
      )}
    </>
  );
}
