import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('expo-secure-store', () => ({}));

import { addWeighIn, bodyStore, deleteWeighIn, profileStore } from '../src/state/appStores';

describe('weigh-ins keep the profile weight aligned (WeightStore.syncProfileWeightToLatest)', () => {
  it('moves profile.weightKg to the newest entry on add and delete, and leaves it alone once empty', () => {
    profileStore.dispatch({ type: 'update', patch: { weightKg: 80 } });
    bodyStore.dispatch({ type: 'clearAll' });

    addWeighIn({ id: 'w1', date: '2026-09-10T08:00:00.000Z', weightKg: 79.2 });
    expect(profileStore.getState().weightKg).toBe(79.2);

    // An older back-dated entry is not the newest, so the profile keeps the latest weight.
    addWeighIn({ id: 'w0', date: '2026-09-01T08:00:00.000Z', weightKg: 82 });
    expect(profileStore.getState().weightKg).toBe(79.2);

    addWeighIn({ id: 'w2', date: '2026-09-16T08:00:00.000Z', weightKg: 78.6 });
    expect(profileStore.getState().weightKg).toBe(78.6);

    deleteWeighIn('w2');
    expect(profileStore.getState().weightKg).toBe(79.2);

    // Invalid weights are rejected by the reducer and never reach the profile.
    addWeighIn({ id: 'bad', date: '2026-09-17T08:00:00.000Z', weightKg: 5 });
    expect(bodyStore.getState().weightEntries.map((e) => e.id)).toEqual(['w0', 'w1']);
    expect(profileStore.getState().weightKg).toBe(79.2);

    deleteWeighIn('w1');
    expect(profileStore.getState().weightKg).toBe(82);
    deleteWeighIn('w0');
    expect(bodyStore.getState().weightEntries).toEqual([]);
    expect(profileStore.getState().weightKg).toBe(82);
  });
});
