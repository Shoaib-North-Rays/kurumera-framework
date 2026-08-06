"use client";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { createKurumeraClient, type EditableMediaUpload } from "@kurumera/storefront";
import { EditableStore } from "./store.js";
import { createSaveQueue, type SaveQueue } from "./save-queue.js";
import type { EditMode } from "./types.js";

export interface EditableProviderProps {
  mode: EditMode;
  editToken: string | null;
  tenant: string;
  apiUrl?: string;
  fields: Record<string, { value: unknown; type?: string }>;
  children: ReactNode;
}

export interface EditableContextValue {
  mode: EditMode;
  store: EditableStore;
  /** null when not in edit mode — nothing should be saving. */
  saveQueue: SaveQueue | null;
  uploadMedia: (file: Blob, filename?: string, opts?: { contentType?: "IMAGE" | "VIDEO" }) => Promise<EditableMediaUpload>;
}

const EditableContext = createContext<EditableContextValue | null>(null);

/**
 * Mounted ONCE, at the theme's root layout, seeded from the same
 * request-scoped `resolveEditableContent()` fetch every `Editable*` Server
 * Component also reads independently (see server/resolve.ts) — this is the
 * client-tier half of that two-tier data flow (Server Components can't
 * `useContext`, so they read the server tier directly instead).
 */
export function EditableProvider({ mode, editToken, tenant, apiUrl, fields, children }: EditableProviderProps) {
  const storeRef = useRef<EditableStore | null>(null);
  if (!storeRef.current) storeRef.current = new EditableStore(fields);

  const value = useMemo<EditableContextValue>(() => {
    const store = storeRef.current!;
    if (mode !== "edit" || !editToken) {
      return {
        mode,
        store,
        saveQueue: null,
        uploadMedia: async () => {
          throw new Error("Not in edit mode — media upload is unavailable.");
        },
      };
    }
    const client = createKurumeraClient({ tenant, apiUrl, editSessionToken: editToken });
    const saveQueue = createSaveQueue({
      store,
      save: async (fieldKey, val, type) => {
        await client.content.setDraft(fieldKey, val, { type });
      },
    });
    return {
      mode,
      store,
      saveQueue,
      uploadMedia: (file: Blob, filename?: string, opts?: { contentType?: "IMAGE" | "VIDEO" }) =>
        client.content.uploadMedia(file, filename, opts),
    };
    // storeRef.current is stable for the component's lifetime — intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editToken, tenant, apiUrl]);

  return <EditableContext.Provider value={value}>{children}</EditableContext.Provider>;
}

const FALLBACK_STORE = new EditableStore({});

/** Used outside an `<EditableProvider>` (e.g. the package isn't wired into
 * this theme yet) — degrades to a safe, permanently-"off" context rather
 * than crashing the page. */
const FALLBACK_CONTEXT: EditableContextValue = {
  mode: "off",
  store: FALLBACK_STORE,
  saveQueue: null,
  uploadMedia: async () => {
    throw new Error("EditableProvider is not mounted in this theme.");
  },
};

export function useEditableContext(): EditableContextValue {
  return useContext(EditableContext) ?? FALLBACK_CONTEXT;
}
