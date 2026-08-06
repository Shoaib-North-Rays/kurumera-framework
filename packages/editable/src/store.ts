import type { FieldRecord, FieldStatus } from "./types.js";

type Listener = () => void;

/**
 * Per-field-key external store (feeds `useSyncExternalStore`), NOT one big
 * object in `useState` — editing one field must never re-render every other
 * `Editable*` instance on the page. Records are replaced (never mutated) on
 * every write so `Object.is` snapshot comparisons in React correctly detect
 * a change.
 */
export class EditableStore {
  private records = new Map<string, FieldRecord>();
  private listeners = new Map<string, Set<Listener>>();

  constructor(initial: Record<string, { value: unknown; type?: string }>) {
    for (const [key, f] of Object.entries(initial)) {
      this.records.set(key, { value: f.value, status: "idle", error: null });
    }
  }

  /** Lazily seeds (and caches) a record for a field the initial batch fetch
   * didn't know about yet (never edited). Returns a STABLE reference when
   * nothing has changed, as `useSyncExternalStore` requires. */
  get(key: string, fallback: unknown): FieldRecord {
    let record = this.records.get(key);
    if (!record) {
      record = { value: fallback, status: "idle", error: null };
      this.records.set(key, record);
    }
    return record;
  }

  subscribe(key: string, listener: Listener): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach((cb) => cb());
  }

  setValue(key: string, value: unknown): void {
    this.records.set(key, { value, status: "dirty", error: null });
    this.notify(key);
  }

  setStatus(key: string, status: FieldStatus, error: string | null = null): void {
    const prev = this.records.get(key);
    if (!prev) return;
    this.records.set(key, { ...prev, status, error });
    this.notify(key);
  }
}
