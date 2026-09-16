/**
 * `PurchasesAdapter` over the `react-native-purchases` SDK surface, typed structurally so it
 * unit-tests against a fake. Mirrors `RevenueCatManager.swift`: entitlements → plan, offerings,
 * purchase (a cancelled sheet is not an error), restore, and customer-info updates.
 */

import type { CustomerInfoLike, OfferingsLike, PackageLike, PurchasesAdapter } from './revenueCat';

export interface SDKEntitlement {
  isActive: boolean;
}

export interface SDKCustomerInfo {
  originalAppUserId: string;
  entitlements: { all: Record<string, SDKEntitlement> };
}

export interface SDKPackage {
  identifier: string;
  product: { identifier: string; priceString: string };
}

export interface SDKOfferings {
  current: { availablePackages: SDKPackage[] } | null;
}

export type SDKCustomerInfoListener = (info: SDKCustomerInfo) => void;

/** The subset of the `Purchases` static class the adapter needs. */
export interface PurchasesSDK {
  configure(configuration: { apiKey: string }): void;
  getCustomerInfo(): Promise<SDKCustomerInfo>;
  getOfferings(): Promise<SDKOfferings>;
  purchasePackage(pkg: SDKPackage): Promise<{ customerInfo: SDKCustomerInfo }>;
  restorePurchases(): Promise<SDKCustomerInfo>;
  addCustomerInfoUpdateListener(listener: SDKCustomerInfoListener): void;
  removeCustomerInfoUpdateListener(listener: SDKCustomerInfoListener): boolean;
}

export function toCustomerInfoLike(info: SDKCustomerInfo): CustomerInfoLike {
  const entitlements: CustomerInfoLike['entitlements'] = {};
  for (const [identifier, entitlement] of Object.entries(info.entitlements.all)) {
    entitlements[identifier] = { identifier, isActive: entitlement.isActive };
  }
  return { originalAppUserId: info.originalAppUserId, entitlements };
}

export function toPackageLike(pkg: SDKPackage): PackageLike {
  return { identifier: pkg.identifier, productIdentifier: pkg.product.identifier, priceString: pkg.product.priceString };
}

interface PurchaseFailure {
  userCancelled?: boolean;
  message?: string;
}

export function revenueCatAdapter(Purchases: PurchasesSDK, apiKey: string): PurchasesAdapter {
  const packagesByIdentifier = new Map<string, SDKPackage>();
  let configured = false;

  const ensureConfigured = () => {
    if (configured) return;
    Purchases.configure({ apiKey });
    configured = true;
  };

  const rememberPackages = (offerings: SDKOfferings): OfferingsLike => {
    packagesByIdentifier.clear();
    const current = offerings.current;
    if (!current) return {};
    for (const pkg of current.availablePackages) packagesByIdentifier.set(pkg.identifier, pkg);
    return { current: { availablePackages: current.availablePackages.map(toPackageLike) } };
  };

  return {
    async configure() {
      ensureConfigured();
    },
    async getCustomerInfo() {
      ensureConfigured();
      return toCustomerInfoLike(await Purchases.getCustomerInfo());
    },
    async getOfferings() {
      ensureConfigured();
      return rememberPackages(await Purchases.getOfferings());
    },
    async purchasePackage(pkg) {
      ensureConfigured();
      let sdkPackage = packagesByIdentifier.get(pkg.identifier);
      if (!sdkPackage) {
        rememberPackages(await Purchases.getOfferings());
        sdkPackage = packagesByIdentifier.get(pkg.identifier);
      }
      if (!sdkPackage) throw new Error('That plan is no longer available. Refresh the plans and try again.');
      try {
        const result = await Purchases.purchasePackage(sdkPackage);
        return toCustomerInfoLike(result.customerInfo);
      } catch (error) {
        const failure = error as PurchaseFailure;
        // A dismissed store sheet is not a failure: report the unchanged customer info.
        if (failure.userCancelled) return toCustomerInfoLike(await Purchases.getCustomerInfo());
        throw error instanceof Error ? error : new Error(failure.message ?? 'Purchase failed.');
      }
    },
    async restorePurchases() {
      ensureConfigured();
      return toCustomerInfoLike(await Purchases.restorePurchases());
    },
    onCustomerInfoUpdated(listener) {
      ensureConfigured();
      const forward: SDKCustomerInfoListener = (info) => listener(toCustomerInfoLike(info));
      Purchases.addCustomerInfoUpdateListener(forward);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(forward);
      };
    },
  };
}
