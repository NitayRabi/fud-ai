import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon, type SFSymbolName } from '../../components/Icon';
import { PickerSheet } from '../../components/PickerSheet';
import { AppText, Badge, Card, Divider, LinkButton, PrimaryButton, Row, Screen, SecondaryButton } from '../../components/primitives';
import { hostedPlanDisplayName } from '../../domain/ai/hosted';
import { aiSetupContinueLabel, validateAISetup, type AISetupSubstep } from '../../domain/ai/onboardingValidation';
import {
  aiProviders,
  apiKeyPlaceholder,
  apiKeyShapeHint,
  defaultModel,
  visionProviders,
  type AIProviderDefinition,
  type AIProviderId,
  type MobilePlatform,
} from '../../domain/ai/providers';
import { apiKeySecretName, customBaseURLKey } from '../../domain/ai/settings';
import { loadOfferings, refreshCustomerInfo, setPreferences, usePurchases } from '../../state/appStores';
import { asyncKeyValueStore, secureSecretStore } from '../../state/persistence';
import { useTheme } from '../../theme';

const platform: MobilePlatform = Platform.OS === 'ios' ? 'ios' : 'android';

interface AISetupScreenProps {
  onContinue: () => void;
  /** Present the hosted paywall. The paywall itself is not yet ported. */
  onShowPaywall?: () => void;
}

/**
 * Onboarding step 11 — "Set Up Your AI" (`OnboardingView.swift` AI provider step).
 *
 * Fixes #373: the key field placeholder is an instruction ("Paste Gemini API key"), never a
 * key-shaped prefix, and when the CTA is disabled a helper line says exactly what is missing.
 */
export function AISetupScreen({ onContinue, onShowPaywall }: AISetupScreenProps) {
  const theme = useTheme();
  const purchases = usePurchases((s) => s);

  const [substep, setSubstep] = useState<AISetupSubstep>('choice');
  const [provider, setProvider] = useState<AIProviderDefinition>(aiProviders.gemini);
  const [model, setModel] = useState(defaultModel(aiProviders.gemini));
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [picker, setPicker] = useState<'provider' | 'model' | null>(null);

  useEffect(() => {
    void refreshCustomerInfo();
    void loadOfferings();
  }, []);

  // Provider switch: restore any key/URL previously saved for it, reset the model to its default.
  useEffect(() => {
    let cancelled = false;
    setModel(defaultModel(provider));
    void (async () => {
      const [savedKey, savedURL] = await Promise.all([
        provider.requiresAPIKey ? secureSecretStore.get(apiKeySecretName(provider)) : Promise.resolve(null),
        asyncKeyValueStore.get(customBaseURLKey(provider)),
      ]);
      if (cancelled) return;
      setApiKey(savedKey ?? '');
      setBaseURL(savedURL ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const validation = validateAISetup({
    substep,
    hasAcceptedTerms,
    hasHostedEntitlement: purchases.hasHostedEntitlement,
    provider,
    model,
    apiKey,
    baseURL,
  });

  const subtitle = {
    choice: 'Choose how you want to power AI in Fud AI. The app stays free either way.',
    byok: 'Add your own AI provider key — Gemini, OpenAI, Groq, and more are supported.',
    hosted: 'Subscribe to Plus or Pro for hosted AI — no API key needed. Switch to BYOK anytime in Settings.',
  }[substep];

  const providerOptions = useMemo(
    () => visionProviders(platform).map((p) => ({ value: p.id, label: p.displayName })),
    [],
  );

  const persistAndContinue = async () => {
    if (substep === 'hosted' && !purchases.hasHostedEntitlement) {
      onShowPaywall?.();
      return;
    }
    if (substep === 'byok') {
      const trimmedKey = apiKey.trim();
      if (provider.requiresAPIKey && trimmedKey) await secureSecretStore.set(apiKeySecretName(provider), trimmedKey);
      const trimmedURL = baseURL.trim();
      if (trimmedURL) await asyncKeyValueStore.set(customBaseURLKey(provider), trimmedURL);
      else await asyncKeyValueStore.remove(customBaseURLKey(provider));
    }
    setPreferences({
      aiAccessMode: substep === 'hosted' ? 'hosted' : 'byok',
      aiConsentGiven: true,
      acceptedTermsAndPrivacy: true,
      selectedAIProvider: provider.rawValue,
      selectedAIModel: model.trim(),
    });
    onContinue();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingTop: theme.spacing.xl, paddingBottom: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ alignItems: 'center', gap: 18 }}>
          <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: theme.colors.fill, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" size={42} color={theme.colors.accent} />
          </View>
          <View style={{ gap: 8, paddingHorizontal: theme.spacing.xl }}>
            <AppText variant="title" align="center" weight="700">
              Set Up Your AI
            </AppText>
            <AppText variant="callout" tone="secondary" align="center" style={{ paddingHorizontal: theme.spacing.xl }}>
              {subtitle}
            </AppText>
          </View>
        </View>

        <View style={{ paddingHorizontal: theme.spacing.xl, gap: 18 }}>
          {substep === 'choice' ? (
            <View style={{ gap: 12 }}>
              <ChoiceCard
                icon="key.fill"
                title="Bring Your Own Key"
                subtitle="Free forever — unlimited on your key. Gemini, OpenAI, Groq & more."
                badge="Recommended"
                highlight
                onPress={() => setSubstep('byok')}
              />
              <ChoiceCard
                icon="bolt.horizontal.circle.fill"
                title="Hosted AI"
                subtitle="Plus (30/day) or Pro (60/day) — subscribe in-app, optional credit packs."
                badge="Convenient"
                onPress={() => {
                  setSubstep('hosted');
                  if (!purchases.hasHostedEntitlement) onShowPaywall?.();
                }}
              />
            </View>
          ) : null}

          {substep === 'byok' ? (
            <Card style={{ gap: 14 }}>
              <ConfigRow icon="cpu" label="Provider">
                <ValueButton value={provider.displayName} onPress={() => setPicker('provider')} />
              </ConfigRow>
              <Divider />
              <ConfigRow icon="brain" label="Model">
                {provider.supportsCustomModelName ? (
                  <Row style={{ flex: 1, gap: 8, justifyContent: 'flex-end' }}>
                    <TextInput
                      value={model}
                      onChangeText={setModel}
                      placeholder="e.g. gpt-4o-mini"
                      placeholderTextColor={theme.colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[theme.text.body, { flex: 1, textAlign: 'right', color: theme.colors.label }]}
                    />
                    {provider.models.length > 0 ? (
                      <Pressable accessibilityLabel="Choose a preset model" onPress={() => setPicker('model')}>
                        <Icon name="list.bullet.circle" size={22} color={theme.colors.accent} />
                      </Pressable>
                    ) : null}
                  </Row>
                ) : (
                  <ValueButton value={model} onPress={() => setPicker('model')} />
                )}
              </ConfigRow>

              {provider.requiresAPIKey ? (
                <>
                  <Divider />
                  <ConfigRow icon="key.fill" label="API Key">
                    <Row style={{ flex: 1, gap: 8, justifyContent: 'flex-end' }}>
                      <TextInput
                        value={apiKey}
                        onChangeText={setApiKey}
                        placeholder={apiKeyPlaceholder(provider)}
                        placeholderTextColor={theme.colors.placeholder}
                        secureTextEntry={!showKey}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="password"
                        accessibilityLabel="API key"
                        style={[theme.text.body, { flex: 1, textAlign: 'right', color: theme.colors.label }]}
                      />
                      <Pressable accessibilityLabel={showKey ? 'Hide key' : 'Show key'} onPress={() => setShowKey((v) => !v)}>
                        <Icon name={showKey ? 'eye.fill' : 'eye.slash.fill'} size={16} color={theme.colors.secondaryLabel} />
                      </Pressable>
                    </Row>
                  </ConfigRow>
                  {apiKeyShapeHint(provider) ? (
                    <AppText variant="caption" tone="tertiary" align="right">
                      {apiKeyShapeHint(provider)}
                    </AppText>
                  ) : null}
                </>
              ) : null}

              {provider.id === 'ollama' || provider.requiresCustomEndpoint ? (
                <>
                  <Divider />
                  <ConfigRow icon="link" label={provider.requiresCustomEndpoint ? 'Base URL' : 'Server URL'}>
                    <TextInput
                      value={baseURL}
                      onChangeText={setBaseURL}
                      placeholder={provider.requiresCustomEndpoint ? 'https://your-endpoint.com/v1' : provider.baseURL}
                      placeholderTextColor={theme.colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      style={[theme.text.body, { flex: 1, textAlign: 'right', color: theme.colors.label }]}
                    />
                  </ConfigRow>
                </>
              ) : null}
            </Card>
          ) : null}

          {substep === 'hosted' ? (
            <Card style={{ gap: 14 }}>
              {purchases.hasHostedEntitlement ? (
                <Row style={{ gap: 8 }}>
                  <Icon name="checkmark.seal.fill" size={18} color={theme.colors.accent} />
                  <AppText variant="subheadlineSemibold">Active plan: {hostedPlanDisplayName(purchases.activePlan)}</AppText>
                </Row>
              ) : (
                <AppText variant="subheadline" tone="secondary">
                  Subscribe to Plus or Pro to use hosted AI without bringing your own key.
                </AppText>
              )}
              <SecondaryButton title="View Plans" onPress={() => onShowPaywall?.()} />
              <LinkButton title="Use BYOK instead" onPress={() => setSubstep('byok')} />
            </Card>
          ) : null}

          {substep !== 'choice' ? (
            <>
              <Card style={{ gap: 12 }}>
                <NoticeRow
                  icon="photo.fill"
                  title="AI analysis"
                  text={
                    substep === 'hosted'
                      ? "Food photos, voice transcripts, and typed meals are processed through Fud AI's hosted service."
                      : 'Food photos, voice transcripts, and typed meals are sent directly to your selected AI provider.'
                  }
                />
                <NoticeRow
                  icon="lock.shield.fill"
                  title="Local data"
                  text={
                    substep === 'hosted'
                      ? 'Your food log, weight history, and body-fat history stay on this device. Hosted AI does not store your BYOK keys.'
                      : 'Your food log, weight history, body-fat history, and BYOK API keys stay on this device.'
                  }
                />
              </Card>

              <Card style={{ gap: 12 }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: hasAcceptedTerms }}
                  onPress={() => setHasAcceptedTerms((v) => !v)}
                >
                  <Row style={{ alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={hasAcceptedTerms ? 'checkmark.square.fill' : 'square'} size={22} color={hasAcceptedTerms ? theme.colors.accent : theme.colors.secondaryLabel} />
                    </View>
                    <AppText variant="footnote" weight="500" style={{ flex: 1 }}>
                      I accept the Terms of Service and Privacy Policy, including AI provider data sharing described above.
                    </AppText>
                  </Row>
                </Pressable>
                <Row style={{ gap: 6 }}>
                  <LinkButton title="Privacy Policy" variant="footnoteSemibold" onPress={() => void Linking.openURL('https://fud-ai.app/privacy.html')} />
                  <AppText variant="footnote" tone="secondary">
                    and
                  </AppText>
                  <LinkButton title="Terms of Service" variant="footnoteSemibold" onPress={() => void Linking.openURL('https://fud-ai.app/terms.html')} />
                </Row>
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>

      {substep !== 'choice' ? (
        <View style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl, gap: 10 }}>
          <PrimaryButton
            title={aiSetupContinueLabel({ substep, hasHostedEntitlement: purchases.hasHostedEntitlement })}
            disabled={!validation.canContinue}
            onPress={() => void persistAndContinue()}
          />
          {validation.helperText ? (
            <AppText variant="footnote" tone="secondary" align="center" accessibilityLiveRegion="polite">
              {validation.helperText}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <PickerSheet<AIProviderId>
        visible={picker === 'provider'}
        title="Provider"
        options={providerOptions}
        selected={provider.id}
        onSelect={(id) => setProvider(aiProviders[id])}
        onDismiss={() => setPicker(null)}
      />
      <PickerSheet<string>
        visible={picker === 'model'}
        title="Model"
        options={provider.models.map((m) => ({ value: m, label: m }))}
        selected={model}
        onSelect={setModel}
        onDismiss={() => setPicker(null)}
      />
    </Screen>
  );
}

// MARK: - Pieces

function ChoiceCard({ icon, title, subtitle, badge, highlight = false, onPress }: { icon: SFSymbolName; title: string; subtitle: string; badge: string; highlight?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card highlight={highlight}>
        <Row style={{ alignItems: 'flex-start', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: theme.accentAlpha(highlight ? 0.12 : 0.08), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={22} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <AppText variant="headline">{title}</AppText>
              <Badge label={badge} />
            </Row>
            <AppText variant="subheadline" tone="secondary">
              {subtitle}
            </AppText>
          </View>
          <Icon name="chevron.right" size={14} color={theme.colors.tertiaryLabel} style={{ marginTop: 4 }} />
        </Row>
      </Card>
    </Pressable>
  );
}

function ConfigRow({ icon, label, children }: { icon: SFSymbolName; label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Row style={{ gap: 12, minHeight: 28 }}>
      <Icon name={icon} size={18} color={theme.colors.accent} />
      <AppText variant="body">{label}</AppText>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>{children}</View>
    </Row>
  );
}

function ValueButton({ value, onPress }: { value: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexShrink: 1 })}>
      <Row style={{ gap: 4 }}>
        <AppText variant="body" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {value}
        </AppText>
        <Icon name="chevron.right" size={12} color={theme.colors.tertiaryLabel} style={{ transform: [{ rotate: '90deg' }] }} />
      </Row>
    </Pressable>
  );
}

function NoticeRow({ icon, title, text }: { icon: SFSymbolName; title: string; text: string }) {
  const theme = useTheme();
  return (
    <Row style={{ alignItems: 'flex-start', gap: 12 }}>
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="subheadlineSemibold">{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {text}
        </AppText>
      </View>
    </Row>
  );
}
