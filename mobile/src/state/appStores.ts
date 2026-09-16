/**
 * App-wide stores and their persistence. Screens only ever read through `useStoreSelector` and
 * write through `dispatch`, never by mutating state.
 */

import { randomUUID } from 'expo-crypto';
import { useSyncExternalStore } from 'react';

import { diaryReducer, initialDiaryState, type DiaryAction, type DiaryState } from '../domain/diary/diaryState';
import { defaultPreferences, mergePreferences, type Preferences } from '../domain/prefs/preferences';
import { defaultUserProfile, type UserProfile } from '../domain/profile/userProfile';
import {
  applyCustomerInfo,
  initialPurchasesState,
  noopPurchases,
  type PurchasesAdapter,
  type PurchasesState,
} from '../domain/purchases/revenueCat';
import { createStore, type Store } from './createStore';
import { asyncKeyValueStore, readJSON, writeJSON, type KeyValueStore } from './persistence';

export const storageKeys = {
  diary: 'fudai.diary.v1',
  preferences: 'fudai.preferences.v1',
  profile: 'fudai.profile.v1',
} as const;

export function newId(): string {
  return randomUUID();
}

// MARK: - Diary (food + water + fasting)

export const diaryStore: Store<DiaryState, DiaryAction> = createStore(diaryReducer, initialDiaryState);

// MARK: - Preferences

export type PreferencesAction = { type: 'set'; patch: Partial<Preferences> } | { type: 'hydrate'; preferences: Preferences };

function preferencesReducer(state: Preferences, action: PreferencesAction): Preferences {
  switch (action.type) {
    case 'set': {
      const next = { ...state, ...action.patch };
      return (Object.keys(action.patch) as (keyof Preferences)[]).every((k) => next[k] === state[k]) ? state : next;
    }
    case 'hydrate':
      return action.preferences;
  }
}

export const preferencesStore: Store<Preferences, PreferencesAction> = createStore(preferencesReducer, defaultPreferences);

export function setPreferences(patch: Partial<Preferences>): void {
  preferencesStore.dispatch({ type: 'set', patch });
}

// MARK: - Profile

export type ProfileAction = { type: 'update'; patch: Partial<UserProfile> } | { type: 'hydrate'; profile: UserProfile };

function profileReducer(state: UserProfile, action: ProfileAction): UserProfile {
  switch (action.type) {
    case 'update':
      return { ...state, ...action.patch };
    case 'hydrate':
      return action.profile;
  }
}

export const profileStore: Store<UserProfile, ProfileAction> = createStore(profileReducer, defaultUserProfile);

// MARK: - Purchases (RevenueCat)

export type PurchasesAction =
  | { type: 'customerInfo'; info: Parameters<typeof applyCustomerInfo>[1] }
  | { type: 'offeringsLoading'; loading: boolean }
  | { type: 'offerings'; offerings: PurchasesState['offerings'] }
  | { type: 'error'; message: string };

function purchasesReducer(state: PurchasesState, action: PurchasesAction): PurchasesState {
  switch (action.type) {
    case 'customerInfo':
      return applyCustomerInfo(state, action.info);
    case 'offeringsLoading':
      return { ...state, isLoadingOfferings: action.loading };
    case 'offerings':
      return { ...state, offerings: action.offerings };
    case 'error':
      return { ...state, lastError: action.message };
  }
}

export const purchasesStore: Store<PurchasesState, PurchasesAction> = createStore(purchasesReducer, initialPurchasesState);

let purchasesAdapter: PurchasesAdapter = noopPurchases;

export function setPurchasesAdapter(adapter: PurchasesAdapter): void {
  purchasesAdapter = adapter;
}

export async function refreshCustomerInfo(): Promise<boolean> {
  try {
    const info = await purchasesAdapter.getCustomerInfo();
    purchasesStore.dispatch({ type: 'customerInfo', info });
    return true;
  } catch (error) {
    purchasesStore.dispatch({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function loadOfferings(): Promise<void> {
  purchasesStore.dispatch({ type: 'offeringsLoading', loading: true });
  try {
    purchasesStore.dispatch({ type: 'offerings', offerings: await purchasesAdapter.getOfferings() });
  } catch (error) {
    purchasesStore.dispatch({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    purchasesStore.dispatch({ type: 'offeringsLoading', loading: false });
  }
}

// MARK: - React binding

export function useStoreSelector<S, A, T>(store: Store<S, A>, selector: (state: S) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function useDiary<T>(selector: (state: DiaryState) => T): T {
  return useStoreSelector(diaryStore, selector);
}

export function usePreferences<T>(selector: (state: Preferences) => T): T {
  return useStoreSelector(preferencesStore, selector);
}

export function useProfile<T>(selector: (state: UserProfile) => T): T {
  return useStoreSelector(profileStore, selector);
}

export function usePurchases<T>(selector: (state: PurchasesState) => T): T {
  return useStoreSelector(purchasesStore, selector);
}

// MARK: - Hydration & persistence

interface PersistedDiary {
  foodEntries: DiaryState['foodEntries'];
  waterEntries: DiaryState['waterEntries'];
  fastingSessions: DiaryState['fastingSessions'];
  favoriteKeys: DiaryState['favoriteKeys'];
}

/**
 * Load persisted state, then persist every subsequent change. Writes are coalesced per store
 * with a short debounce so rapid taps (three glasses of water) become one write.
 */
export async function hydrateAndPersistStores(kv: KeyValueStore = asyncKeyValueStore): Promise<() => void> {
  const [diary, preferences, profile] = await Promise.all([
    readJSON<PersistedDiary>(kv, storageKeys.diary),
    readJSON<Partial<Preferences>>(kv, storageKeys.preferences),
    readJSON<UserProfile>(kv, storageKeys.profile),
  ]);

  if (diary) diaryStore.dispatch({ type: 'hydrate', state: diary });
  preferencesStore.dispatch({ type: 'hydrate', preferences: mergePreferences(preferences) });
  if (profile) profileStore.dispatch({ type: 'hydrate', profile: { ...defaultUserProfile, ...profile } });

  const unsubscribes = [
    persistOnChange(diaryStore, kv, storageKeys.diary, (state): PersistedDiary => ({
      foodEntries: state.foodEntries,
      waterEntries: state.waterEntries,
      fastingSessions: state.fastingSessions,
      favoriteKeys: state.favoriteKeys,
    })),
    persistOnChange(preferencesStore, kv, storageKeys.preferences, (state) => state),
    persistOnChange(profileStore, kv, storageKeys.profile, (state) => state),
  ];

  return () => unsubscribes.forEach((fn) => fn());
}

function persistOnChange<S, A>(
  store: Store<S, A>,
  kv: KeyValueStore,
  key: string,
  project: (state: S) => unknown,
  debounceMs = 150,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = store.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void writeJSON(kv, key, project(state));
    }, debounceMs);
  });
  return () => {
    if (timer) {
      clearTimeout(timer);
      void writeJSON(kv, key, project(store.getState()));
    }
    unsubscribe();
  };
}
