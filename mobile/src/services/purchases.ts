/**
 * Installs the RevenueCat adapter (`src/domain/purchases/revenueCatAdapter.ts`) behind the
 * `PurchasesAdapter` seam at launch, like `RevenueCatManager.configure()`.
 *
 * The public SDK key is read from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
 * `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (see `.env.example`); nothing is committed. Without a
 * key, or in Expo Go where the native module is absent, the app keeps the no-op adapter and the
 * paywall shows its "plans unavailable" state instead of failing.
 */

import { Platform } from 'react-native';

import { revenueCatAdapter, type PurchasesSDK } from '../domain/purchases/revenueCatAdapter';
import { purchasesStore, refreshCustomerInfo, setPurchasesAdapter } from '../state/appStores';

export const PURCHASES_UNAVAILABLE_MESSAGE = 'In-app purchases are not configured in this build. Check your connection and try again, or use your own key.';

export function revenueCatAPIKey(): string | undefined {
  const key = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

function loadPurchasesSDK(): PurchasesSDK | undefined {
  try {
    // Resolved lazily so a build without the native module (Expo Go) still boots.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native-purchases') as { default?: PurchasesSDK };
    return module.default;
  } catch {
    return undefined;
  }
}

/** Returns whether a real store is wired; otherwise `lastError` carries the unavailable copy. */
export async function installPurchasesAdapter(): Promise<boolean> {
  const apiKey = revenueCatAPIKey();
  const sdk = apiKey ? loadPurchasesSDK() : undefined;
  if (!apiKey || !sdk) {
    purchasesStore.dispatch({ type: 'error', message: PURCHASES_UNAVAILABLE_MESSAGE });
    return false;
  }
  const adapter = revenueCatAdapter(sdk, apiKey);
  try {
    await adapter.configure();
  } catch (error) {
    purchasesStore.dispatch({ type: 'error', message: error instanceof Error ? error.message : PURCHASES_UNAVAILABLE_MESSAGE });
    return false;
  }
  setPurchasesAdapter(adapter);
  adapter.onCustomerInfoUpdated((info) => purchasesStore.dispatch({ type: 'customerInfo', info }));
  void refreshCustomerInfo();
  return true;
}
