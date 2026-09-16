import { describe, expect, it } from 'vitest';

import { hostedAIConstants } from '../src/domain/ai/hosted';
import { applyCustomerInfo, initialPurchasesState, planFromCustomerInfo } from '../src/domain/purchases/revenueCat';
import { revenueCatAdapter, toCustomerInfoLike, type PurchasesSDK, type SDKCustomerInfo, type SDKCustomerInfoListener, type SDKPackage } from '../src/domain/purchases/revenueCatAdapter';

const anonymous: SDKCustomerInfo = { originalAppUserId: '$RCAnonymousID:abc', entitlements: { all: {} } };
const pro: SDKCustomerInfo = { originalAppUserId: 'user-1', entitlements: { all: { [hostedAIConstants.proEntitlementID]: { isActive: true }, [hostedAIConstants.plusEntitlementID]: { isActive: false } } } };

const plusMonthly: SDKPackage = { identifier: '$rc_monthly', product: { identifier: hostedAIConstants.plusMonthlyProductID, priceString: '$4.99' } };

function fakeSDK(overrides: Partial<PurchasesSDK> = {}) {
  const calls: string[] = [];
  const listeners = new Set<SDKCustomerInfoListener>();
  const sdk: PurchasesSDK & { calls: string[]; emit: (info: SDKCustomerInfo) => void } = {
    calls,
    emit: (info) => listeners.forEach((l) => l(info)),
    configure: (config) => {
      calls.push(`configure:${config.apiKey}`);
    },
    getCustomerInfo: async () => {
      calls.push('getCustomerInfo');
      return anonymous;
    },
    getOfferings: async () => {
      calls.push('getOfferings');
      return { current: { availablePackages: [plusMonthly] } };
    },
    purchasePackage: async (pkg) => {
      calls.push(`purchase:${pkg.identifier}`);
      return { customerInfo: pro };
    },
    restorePurchases: async () => {
      calls.push('restore');
      return pro;
    },
    addCustomerInfoUpdateListener: (listener) => {
      listeners.add(listener);
    },
    removeCustomerInfoUpdateListener: (listener) => listeners.delete(listener),
    ...overrides,
  };
  return sdk;
}

describe('revenueCatAdapter', () => {
  it('configures once, maps offerings, and purchases the remembered SDK package', async () => {
    const sdk = fakeSDK();
    const adapter = revenueCatAdapter(sdk, 'appl_test');
    const offerings = await adapter.getOfferings();
    expect(offerings.current?.availablePackages).toEqual([{ identifier: '$rc_monthly', productIdentifier: hostedAIConstants.plusMonthlyProductID, priceString: '$4.99' }]);
    const info = await adapter.purchasePackage(offerings.current!.availablePackages[0]!);
    expect(planFromCustomerInfo(info)).toBe('pro');
    expect(applyCustomerInfo(initialPurchasesState, info)).toMatchObject({ activePlan: 'pro', hasHostedEntitlement: true, appUserId: 'user-1' });
    expect(sdk.calls.filter((c) => c.startsWith('configure'))).toEqual(['configure:appl_test']);
    expect(sdk.calls).toContain('purchase:$rc_monthly');
  });

  it('treats a cancelled store sheet as no change rather than an error', async () => {
    const sdk = fakeSDK({
      purchasePackage: async () => {
        throw Object.assign(new Error('cancelled'), { userCancelled: true });
      },
    });
    const adapter = revenueCatAdapter(sdk, 'k');
    await adapter.getOfferings();
    const info = await adapter.purchasePackage({ identifier: '$rc_monthly', productIdentifier: hostedAIConstants.plusMonthlyProductID, priceString: '$4.99' });
    expect(planFromCustomerInfo(info)).toBe('none');
  });

  it('re-fetches offerings for an unknown package and fails clearly when it is gone', async () => {
    const sdk = fakeSDK();
    const adapter = revenueCatAdapter(sdk, 'k');
    await expect(adapter.purchasePackage({ identifier: 'missing', productIdentifier: 'x', priceString: '' })).rejects.toThrowError(/no longer available/);
    expect(sdk.calls).toContain('getOfferings');
  });

  it('forwards customer-info updates until unsubscribed and maps entitlements', () => {
    const sdk = fakeSDK();
    const adapter = revenueCatAdapter(sdk, 'k');
    const seen: string[] = [];
    const unsubscribe = adapter.onCustomerInfoUpdated((info) => seen.push(planFromCustomerInfo(info)));
    sdk.emit(pro);
    unsubscribe();
    sdk.emit(anonymous);
    expect(seen).toEqual(['pro']);
    expect(toCustomerInfoLike(pro).entitlements[hostedAIConstants.plusEntitlementID]).toEqual({ identifier: 'plus', isActive: false });
  });
});
