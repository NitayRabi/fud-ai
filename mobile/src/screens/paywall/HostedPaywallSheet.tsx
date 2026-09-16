import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { BottomSheet } from '../../components/BottomSheet';
import { Icon } from '../../components/Icon';
import { AppText, Card, LinkButton, PrimaryButton, Row, SecondaryButton } from '../../components/primitives';
import { hostedAIConstants, hostedPlanDisplayName, subscriptionProductIDs, type HostedPlan } from '../../domain/ai/hosted';
import type { PackageLike } from '../../domain/purchases/revenueCat';
import { loadOfferings, purchasePackage, purchasesStore, restorePurchases, usePurchases } from '../../state/appStores';
import { useTheme } from '../../theme';

interface HostedPaywallSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Called (before dismiss) once a purchase or restore leaves a Plus/Pro entitlement active. */
  onEntitled?: () => void;
}

function planForProduct(productIdentifier: string): HostedPlan {
  if (productIdentifier === hostedAIConstants.proMonthlyProductID || productIdentifier === hostedAIConstants.proYearlyProductID) return 'pro';
  if (productIdentifier === hostedAIConstants.plusMonthlyProductID || productIdentifier === hostedAIConstants.plusYearlyProductID) return 'plus';
  return 'none';
}

function periodLabel(productIdentifier: string): string {
  return productIdentifier.endsWith('.yearly') ? 'Yearly' : 'Monthly';
}

/**
 * Hosted AI plans (`HostedAIPaywallView` in `HostedAISettingsView.swift`), reduced to the plan
 * list, Restore Purchases and the unavailable-plans state. Until a store adapter is installed
 * with `setPurchasesAdapter`, offerings are empty and the sheet explains that plans are
 * unavailable instead of silently doing nothing.
 */
export function HostedPaywallSheet({ visible, onDismiss, onEntitled }: HostedPaywallSheetProps) {
  const theme = useTheme();
  const purchases = usePurchases((s) => s);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  useEffect(() => {
    if (visible) void loadOfferings();
  }, [visible]);

  const packages = (purchases.offerings?.current?.availablePackages ?? []).filter((pkg) => subscriptionProductIDs.includes(pkg.productIdentifier));

  const finish = (entitled: boolean, restore: boolean) => {
    if (entitled) {
      onEntitled?.();
      onDismiss();
    } else if (restore) {
      Alert.alert('Restore Purchases', purchasesStore.getState().lastError ?? 'No active Plus or Pro subscription was found for this account.');
    }
  };

  const buy = async (pkg: PackageLike) => {
    if (busy) return;
    setBusy('purchase');
    try {
      finish(await purchasePackage(pkg), false);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy('restore');
    try {
      finish(await restorePurchases(), true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} title="Hosted AI">
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 4 }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.fill, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={28} color={theme.colors.accent} />
        </View>
        <AppText variant="subheadline" tone="secondary" align="center">
          Fud AI runs the models. No API keys, no setup.
        </AppText>
      </View>

      {purchases.hasHostedEntitlement ? (
        <Card>
          <Row style={{ gap: 8 }}>
            <Icon name="checkmark.seal.fill" size={18} color={theme.colors.accent} />
            <AppText variant="subheadlineSemibold">Active plan: {hostedPlanDisplayName(purchases.activePlan)}</AppText>
          </Row>
        </Card>
      ) : packages.length > 0 ? (
        <View style={{ gap: 8 }}>
          {packages.map((pkg) => {
            const plan = planForProduct(pkg.productIdentifier);
            return (
              <Card key={pkg.identifier} style={{ gap: 10 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <AppText variant="headline">{hostedPlanDisplayName(plan)}</AppText>
                    <AppText variant="caption" tone="secondary">
                      {periodLabel(pkg.productIdentifier)} · {plan === 'pro' ? hostedAIConstants.proDailyLimit : hostedAIConstants.plusDailyLimit} actions / day
                    </AppText>
                  </View>
                  <AppText variant="bodySemibold">{pkg.priceString}</AppText>
                </Row>
                <PrimaryButton title={busy === 'purchase' ? 'Purchasing…' : `Subscribe to ${hostedPlanDisplayName(plan)}`} disabled={busy !== null} onPress={() => void buy(pkg)} />
              </Card>
            );
          })}
        </View>
      ) : (
        <Card style={{ alignItems: 'center', gap: 8 }}>
          {purchases.isLoadingOfferings ? (
            <>
              <ActivityIndicator color={theme.colors.accent} />
              <AppText variant="subheadline" tone="secondary">
                Loading plans…
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="subheadlineSemibold" align="center">
                Plans are unavailable right now.
              </AppText>
              <AppText variant="caption" tone="secondary" align="center">
                {purchases.lastError ?? 'In-app purchases are not configured in this build. Check your connection and try again, or use your own key.'}
              </AppText>
              <SecondaryButton title="Try Again" style={{ alignSelf: 'stretch' }} onPress={() => void loadOfferings()} />
            </>
          )}
        </Card>
      )}

      <LinkButton title={busy === 'restore' ? 'Restoring…' : 'Restore Purchases'} disabled={busy !== null} onPress={() => void restore()} />
      <AppText variant="caption2" tone="tertiary" align="center">
        Hosted usage is metered by the Fud AI service; credits are never granted on device.
      </AppText>
    </BottomSheet>
  );
}
