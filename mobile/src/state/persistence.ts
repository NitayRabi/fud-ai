/**
 * Storage adapters. Preferences and the diary blob go to AsyncStorage (SharedPreferences /
 * NSUserDefaults-backed); API keys go to `expo-secure-store` (Keychain / Android Keystore),
 * matching the native apps' split between UserDefaults and Keychain.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const asyncKeyValueStore: KeyValueStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

export interface SecretStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}

// SecureStore keys may only contain [A-Za-z0-9._-]; provider raw values have spaces and parens.
function secureStoreKey(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_');
}

export const secureSecretStore: SecretStore = {
  get: (name) => SecureStore.getItemAsync(secureStoreKey(name)),
  set: (name, value) => SecureStore.setItemAsync(secureStoreKey(name), value),
  remove: (name) => SecureStore.deleteItemAsync(secureStoreKey(name)),
};

/** In-memory stand-ins for tests and previews. */
export function memoryKeyValueStore(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
}

export async function readJSON<T>(store: KeyValueStore, key: string): Promise<T | undefined> {
  const raw = await store.get(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A corrupt blob is left in place (never overwritten) so it can be recovered manually,
    // mirroring PersistedBlobGuard on iOS.
    return undefined;
  }
}

export async function writeJSON(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  await store.set(key, JSON.stringify(value));
}
