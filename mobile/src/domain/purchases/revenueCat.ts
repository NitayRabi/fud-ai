/**
 * RevenueCat integration seam. Mirrors `RevenueCatManager.swift`: entitlements → `HostedPlan`,
 * offerings, purchase/restore, and the app user id the hosted proxy expects in
 * `X-Fud-User-Id`.
 *
 * The concrete adapter over `react-native-purchases` is not wired yet; `noopPurchases` keeps
 * the app runnable in Expo Go and unit-testable. Credits are never granted on device — the
 * Worker reconciles credit packs from RevenueCat `non_subscriptions`.
 */

import { hostedAIConstants, type HostedPlan } from '../ai/hosted';

export interface EntitlementInfo {
  identifier: string;
  isActive: boolean;
}

export interface CustomerInfoLike {
  originalAppUserId: string;
  entitlements: Record<string, EntitlementInfo>;
}

export interface PackageLike {
  identifier: string;
  productIdentifier: string;
  priceString: string;
}

export interface OfferingsLike {
  current?: { availablePackages: PackageLike[] };
}

export interface PurchasesAdapter {
  configure(): Promise<void>;
  getCustomerInfo(): Promise<CustomerInfoLike>;
  getOfferings(): Promise<OfferingsLike>;
  purchasePackage(pkg: PackageLike): Promise<CustomerInfoLike>;
  restorePurchases(): Promise<CustomerInfoLike>;
  /** Fires whenever RevenueCat pushes updated customer info; returns an unsubscribe. */
  onCustomerInfoUpdated(listener: (info: CustomerInfoLike) => void): () => void;
}

export function planFromCustomerInfo(info: CustomerInfoLike | undefined): HostedPlan {
  if (!info) return 'none';
  if (info.entitlements[hostedAIConstants.proEntitlementID]?.isActive) return 'pro';
  if (info.entitlements[hostedAIConstants.plusEntitlementID]?.isActive) return 'plus';
  return 'none';
}

export interface PurchasesState {
  activePlan: HostedPlan;
  hasHostedEntitlement: boolean;
  isLoadingOfferings: boolean;
  offerings?: OfferingsLike;
  appUserId?: string;
  lastError?: string;
}

export const initialPurchasesState: PurchasesState = {
  activePlan: 'none',
  hasHostedEntitlement: false,
  isLoadingOfferings: false,
};

export function applyCustomerInfo(state: PurchasesState, info: CustomerInfoLike): PurchasesState {
  const activePlan = planFromCustomerInfo(info);
  return { ...state, activePlan, hasHostedEntitlement: activePlan !== 'none', appUserId: info.originalAppUserId, lastError: undefined };
}

const anonymousInfo: CustomerInfoLike = { originalAppUserId: '$RCAnonymousID:stub', entitlements: {} };

/** No-store stub: nothing is purchasable, no entitlement is ever active. */
export const noopPurchases: PurchasesAdapter = {
  async configure() {},
  async getCustomerInfo() {
    return anonymousInfo;
  },
  async getOfferings() {
    return {};
  },
  async purchasePackage() {
    throw new Error('Purchases are not configured in this build.');
  },
  async restorePurchases() {
    return anonymousInfo;
  },
  onCustomerInfoUpdated() {
    return () => {};
  },
};
