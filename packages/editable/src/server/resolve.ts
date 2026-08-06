import { cache } from "react";
import { headers } from "next/headers";
import { createKurumeraClient } from "@kurumera/storefront";
import type { EditableResolution, EditMode } from "../types.js";

/**
 * Per-request, cache()-deduped resolution of "what should this page render:
 * live, edit, or preview" — every `Editable*` Server Component AND the root
 * layout's `<EditableProvider>` call this independently; React dedupes to
 * ONE `content.getAll()` network call per request (same pattern as
 * `getStoreConfig()` in base-theme/lib/kurumera.ts).
 *
 * Reads the SAME `x-kurumera-tenant`/`x-kurumera-domain` headers
 * middleware.ts already sets for tenant resolution, plus two new ones this
 * package's middleware snippet adds: `x-kurumera-edit-token` and
 * `x-kurumera-edit-mode`. Self-contained — does not depend on (or need) a
 * theme-specific `lib/kurumera.ts` helper.
 *
 * Never throws: a missing tenant, an invalid/expired edit token, or a
 * failed fetch all resolve to `{ mode: "off", fields: {} }` — the same
 * plain rendering a real shopper gets. This is deliberate defense in depth;
 * the backend already degrades a bad edit-session token to `editable:
 * false` on its own (see api/v1/storefront/editable_content_views.py).
 */
export const resolveEditableContent = cache(async (): Promise<EditableResolution> => {
  const h = await headers();

  const tenant = h.get("x-kurumera-tenant") || process.env.KURUMERA_TENANT || "";
  const domain = h.get("x-kurumera-domain") || "";
  const editToken = h.get("x-kurumera-edit-token") || "";
  const modeParam = (h.get("x-kurumera-edit-mode") || "").toLowerCase();
  const apiUrl = process.env.KURUMERA_API_URL;

  const empty: EditableResolution = { mode: "off", tenant, editToken: null, apiUrl, fields: {} };
  if (!tenant && !domain) return empty;

  try {
    const client = createKurumeraClient({
      tenant: tenant || undefined,
      domain: domain || undefined,
      apiUrl,
      editSessionToken: editToken || undefined,
    });
    const res = await client.content.getAll();
    const mode: EditMode = !res.editable ? "off" : modeParam === "preview" ? "preview" : "edit";
    return { mode, tenant, editToken: editToken || null, apiUrl, fields: res.fields };
  } catch {
    return empty;
  }
});
