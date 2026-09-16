/**
 * Minimal external store: a reducer, one immutable state, synchronous listeners. React reads it
 * through `useSyncExternalStore`, so every dispatch is exactly one emission — the property the
 * unified diary relies on (#369).
 */

export interface Store<S, A> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: (state: S) => void): () => void;
  /** Replace state wholesale (hydration from disk). Emits once. */
  replace(state: S): void;
}

export function createStore<S, A>(reducer: (state: S, action: A) => S, initialState: S): Store<S, A> {
  let state = initialState;
  const listeners = new Set<(state: S) => void>();

  const emit = () => {
    for (const listener of listeners) listener(state);
  };

  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      state = next;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replace(next) {
      if (next === state) return;
      state = next;
      emit();
    },
  };
}
