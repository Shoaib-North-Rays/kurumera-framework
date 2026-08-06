"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useEditableContext } from "./context.js";
import type { FieldStatus } from "./types.js";

export interface UseEditableFieldOptions {
  type?: string;
  /** Immediate save (repeater add/remove/reorder) instead of the debounced
   * default — use for discrete actions, not continuous typing. */
  immediate?: boolean;
}

export interface UseEditableFieldResult<T> {
  value: T;
  setValue: (next: T) => void;
  editMode: boolean;
  status: FieldStatus;
  error: string | null;
  retry: () => void;
}

/**
 * The shared engine every Editable* primitive's client leaf is built on —
 * also the public escape hatch for a theme dev's OWN component that needs
 * an editable value but isn't covered by one of the built-in primitives.
 *
 * Outside edit mode (or outside an `<EditableProvider>` entirely) this is a
 * cheap context+snapshot read with no timers/listeners ever armed — it
 * doesn't make an already-client component more expensive than it chose to
 * be, but it also can't give a Server Component the same "ship zero JS"
 * guarantee the primitives get from never including their client leaf in
 * the bundle at all — that guarantee only applies to the primitives.
 */
export function useEditableField<T = unknown>(
  field: string,
  defaultValue: T,
  options?: UseEditableFieldOptions,
): UseEditableFieldResult<T> {
  const { mode, store, saveQueue } = useEditableContext();

  const subscribe = useCallback((cb: () => void) => store.subscribe(field, cb), [store, field]);
  const getSnapshot = useCallback(() => store.get(field, defaultValue), [store, field, defaultValue]);
  const record = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: T) => {
      if (mode !== "edit" || !saveQueue) return;
      if (options?.immediate) saveQueue.saveNow(field, next, options?.type);
      else saveQueue.setValue(field, next, options?.type);
    },
    [mode, saveQueue, field, options?.type, options?.immediate],
  );

  const retry = useCallback(() => saveQueue?.retry(field, options?.type), [saveQueue, field, options?.type]);

  return {
    value: (record.value as T) ?? defaultValue,
    setValue,
    editMode: mode === "edit",
    status: record.status,
    error: record.error,
    retry,
  };
}
