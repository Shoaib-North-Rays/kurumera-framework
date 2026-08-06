import type { EditableStore } from "./store.js";

/** Default debounce for continuous edits (typing). Shorter than the visual
 * builder's 1500ms (website-builder/src/builder/hooks/useAutosave.ts) since
 * a single field's payload is tiny — editing two fields in quick succession
 * shouldn't feel laggy. */
export const DEFAULT_DEBOUNCE_MS = 1000;

const RETRY_BACKOFF_MS = [2000, 5000, 10000];

export interface SaveQueueDeps {
  store: EditableStore;
  save: (fieldKey: string, value: unknown, type?: string) => Promise<void>;
  debounceMs?: number;
}

export interface SaveQueue {
  /** Debounced — call on every keystroke/change. */
  setValue(key: string, value: unknown, type?: string): void;
  /** Immediate — for discrete actions (repeater add/remove/reorder), which
   * shouldn't wait out a debounce window like continuous typing does. */
  saveNow(key: string, value: unknown, type?: string): void;
  /** Manually re-attempt a failed save. */
  retry(key: string, type?: string): void;
}

/**
 * Per-field-key debounced autosave. Never clears a field's dirty value on
 * failure (same principle as the visual builder's autosave) — a failed save
 * auto-retries with backoff and leaves the merchant's edit visible either
 * way; `retry()` is also exposed for a manual retry affordance.
 */
export function createSaveQueue({ store, save, debounceMs = DEFAULT_DEBOUNCE_MS }: SaveQueueDeps): SaveQueue {
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Set<string>();

  function clearDebounce(key: string): void {
    const t = debounceTimers.get(key);
    if (t) {
      clearTimeout(t);
      debounceTimers.delete(key);
    }
  }

  function clearRetry(key: string): void {
    const t = retryTimers.get(key);
    if (t) {
      clearTimeout(t);
      retryTimers.delete(key);
    }
  }

  async function flush(key: string, type: string | undefined, attempt: number): Promise<void> {
    if (inFlight.has(key)) return; // a save is already in flight; its own resolve() re-checks the latest value
    inFlight.add(key);
    const valueAtStart = store.get(key, undefined).value;
    store.setStatus(key, "saving");
    try {
      await save(key, valueAtStart, type);
      inFlight.delete(key);
      const current = store.get(key, undefined).value;
      if (current !== valueAtStart) {
        // more edits landed while this save was in flight — save the latest immediately
        void flush(key, type, 0);
      } else {
        store.setStatus(key, "saved");
      }
    } catch (err) {
      inFlight.delete(key);
      const message = err instanceof Error ? err.message : "Save failed.";
      store.setStatus(key, "error", message);
      const backoff = RETRY_BACKOFF_MS[attempt];
      if (backoff !== undefined) {
        const t = setTimeout(() => void flush(key, type, attempt + 1), backoff);
        retryTimers.set(key, t);
      }
    }
  }

  function schedule(key: string, type: string | undefined, delay: number): void {
    clearDebounce(key);
    const t = setTimeout(() => void flush(key, type, 0), delay);
    debounceTimers.set(key, t);
  }

  return {
    setValue(key, value, type) {
      store.setValue(key, value);
      clearRetry(key);
      schedule(key, type, debounceMs);
    },
    saveNow(key, value, type) {
      store.setValue(key, value);
      clearRetry(key);
      clearDebounce(key);
      void flush(key, type, 0);
    },
    retry(key, type) {
      clearRetry(key);
      void flush(key, type, 0);
    },
  };
}
