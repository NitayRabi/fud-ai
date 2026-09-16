import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, Card, Row, Screen } from '../../components/primitives';
import { SettingsRow, SettingsSection } from '../../components/SettingsRow';
import { aiModeDisplayName, dailyLimit, hostedPlanDisplayName, type AIMode } from '../../domain/ai/hosted';
import { apiKeySecretName, resolveVisionSelection } from '../../domain/ai/settings';
import { refreshCustomerInfo, setPreferences, usePreferences, usePurchases } from '../../state/appStores';
import { secureSecretStore } from '../../state/persistence';
import { useTheme } from '../../theme';

const platform = Platform.OS === 'ios' ? 'ios' : 'android';

/**
 * Settings → AI Access. Mode switch (BYOK / Hosted), current provider + model, key status, and
 * the hosted plan. Provider editing lives in "AI Providers & Fallbacks" (not yet ported).
 */
export function AIAccessScreen() {
  const theme = useTheme();
  const prefs = usePreferences((p) => p);
  const purchases = usePurchases((p) => p);
  const selection = resolveVisionSelection(platform, prefs.selectedAIProvider, prefs.selectedAIModel);
  const [hasKey, setHasKey] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void refreshCustomerInfo();
    void secureSecretStore.get(apiKeySecretName(selection.provider)).then((key) => {
      if (!cancelled) setHasKey(!!key);
    });
    return () => {
      cancelled = true;
    };
  }, [selection.provider]);

  const setMode = (mode: AIMode) => {
    if (mode === 'hosted' && !purchases.hasHostedEntitlement) {
      Alert.alert('Hosted AI', 'Subscribe to Plus or Pro to use Hosted AI. The paywall is being ported to the shared app.');
      return;
    }
    setPreferences({ aiAccessMode: mode });
  };

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}>
        <View style={{ gap: 6 }}>
          <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: theme.spacing.lg, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Mode
          </AppText>
          <Card padded={false} style={{ flexDirection: 'row', padding: 4 }}>
            {(['byok', 'hosted'] as const).map((mode) => {
              const selected = prefs.aiAccessMode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setMode(mode)}
                  style={{ flex: 1, height: 40, borderRadius: theme.radii.control, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? theme.colors.accent : 'transparent' }}
                >
                  <AppText variant="subheadlineSemibold" tone={selected ? 'onAccent' : 'primary'}>
                    {aiModeDisplayName(mode)}
                  </AppText>
                </Pressable>
              );
            })}
          </Card>
          <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: theme.spacing.lg }}>
            BYOK is free forever on your own key. Hosted runs the AI for you on a Plus or Pro plan.
          </AppText>
        </View>

        <SettingsSection header="Bring Your Own Key">
          <SettingsRow icon="cpu" title="Provider" value={selection.provider.displayName} chevron={false} />
          <SettingsRow icon="brain" title="Model" value={selection.model} chevron={false} />
          <SettingsRow
            icon="key.fill"
            title="API Key"
            value={!selection.provider.requiresAPIKey ? 'Not needed' : hasKey === undefined ? '…' : hasKey ? 'Saved on device' : 'Missing'}
            chevron={false}
          />
          <SettingsRow
            icon="sparkles"
            title="AI Providers & Fallbacks"
            subtitle="Change provider, model, fallbacks"
            onPress={() => Alert.alert('AI Providers & Fallbacks', 'This screen is being ported to the shared app.')}
          />
        </SettingsSection>

        <SettingsSection header="Hosted AI" footer="Hosted usage is metered by the Fud AI service; credits are never granted on device.">
          <SettingsRow icon="checkmark.seal.fill" title="Plan" value={hostedPlanDisplayName(purchases.activePlan)} chevron={false} />
          <SettingsRow icon="bolt.horizontal.circle.fill" title="Daily actions" value={purchases.hasHostedEntitlement ? `${dailyLimit(purchases.activePlan)} / day` : '—'} chevron={false} />
          <SettingsRow icon="arrow.triangle.2.circlepath.circle.fill" title="Restore Purchases" onPress={() => void refreshCustomerInfo()} chevron={false} />
        </SettingsSection>

        {purchases.lastError ? (
          <Row style={{ paddingHorizontal: theme.spacing.lg }}>
            <AppText variant="footnote" tone="destructive">
              {purchases.lastError}
            </AppText>
          </Row>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
