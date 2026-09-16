import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// appStores pulls in the native storage modules through persistence.ts; stub them so the
// hydration/persistence logic runs in Node against `memoryKeyValueStore`.
vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('expo-secure-store', () => ({}));

import { diaryStore, hydrateAndPersistStores, onPersistenceFailure, preferencesStore, setPreferences, storageKeys, type PersistenceFailure } from '../src/state/appStores';
import { memoryKeyValueStore, type KeyValueStore } from '../src/state/persistence';

const flush = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('hydrateAndPersistStores', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  let failures: PersistenceFailure[] = [];
  let stopListening = () => {};

  beforeEach(() => {
    failures = [];
    consoleError.mockClear();
    stopListening = onPersistenceFailure((failure) => failures.push(failure));
  });

  afterEach(() => {
    stopListening();
  });

  it('still resolves when a store cannot be read, and never overwrites that unreadable blob', async () => {
    const memory = memoryKeyValueStore({ [storageKeys.diary]: '{"foodEntries":[],"waterEntries":[],"fastingSessions":[],"favoriteKeys":[]}' });
    const kv: KeyValueStore = {
      ...memory,
      get: (key) => (key === storageKeys.diary ? Promise.reject(new Error('disk unavailable')) : memory.get(key)),
    };

    const dispose = await hydrateAndPersistStores(kv);
    expect(failures).toEqual([expect.objectContaining({ phase: 'read', key: storageKeys.diary })]);

    diaryStore.dispatch({ type: 'water/add', entry: { id: 'w1', date: new Date().toISOString(), milliliters: 250 } });
    setPreferences({ waterUnit: 'floz' });
    await flush();
    dispose();

    // Preferences (readable) are persisted; the diary blob is left exactly as it was.
    expect(JSON.parse(memory.dump()[storageKeys.preferences]!).waterUnit).toBe('floz');
    expect(memory.dump()[storageKeys.diary]).toBe('{"foodEntries":[],"waterEntries":[],"fastingSessions":[],"favoriteKeys":[]}');
  });

  it('reports a failed write once per key and retries the newest snapshot on the next change', async () => {
    const memory = memoryKeyValueStore();
    let failWrites = true;
    const kv: KeyValueStore = {
      ...memory,
      set: (key, value) => (failWrites && key === storageKeys.preferences ? Promise.reject(new Error('quota exceeded')) : memory.set(key, value)),
    };

    const dispose = await hydrateAndPersistStores(kv);
    setPreferences({ weekStartsOnMonday: !preferencesStore.getState().weekStartsOnMonday });
    await flush();
    setPreferences({ waterDailyGoalMl: 3000 });
    await flush();

    expect(failures.filter((f) => f.phase === 'write').map((f) => f.key)).toEqual([storageKeys.preferences, storageKeys.preferences]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(memory.dump()[storageKeys.preferences]).toBeUndefined();

    failWrites = false;
    setPreferences({ waterDailyGoalMl: 3500 });
    await flush();
    dispose();
    expect(JSON.parse(memory.dump()[storageKeys.preferences]!).waterDailyGoalMl).toBe(3500);
  });
});
