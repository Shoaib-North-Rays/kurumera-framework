import type { Http } from "../http.js";
import type { EditableContentResponse, EditableMediaUpload } from "../types.js";

const enc = encodeURIComponent;

export function contentResource(http: Http) {
  return {
    /** GET /storefront/editable-content/ — every editable field for this
     * store's theme. `editable` is false (and `fields` is live-only) unless
     * the client was built with a valid `editSessionToken`. */
    getAll: () => http.get<EditableContentResponse>("/storefront/editable-content/"),

    /** PATCH /storefront/editable-content/<fieldKey>/ — upsert one field's
     * draft value. Requires `editSessionToken` on the client, else the
     * platform returns a 401 (KurumeraError). */
    setDraft: (fieldKey: string, value: unknown, opts?: { type?: string }) =>
      http.patch(`/storefront/editable-content/${enc(fieldKey)}/`, {
        value,
        ...(opts?.type ? { type: opts.type } : {}),
      }),

    /** POST /storefront/editable-content/media/ — upload an image (for
     * EditableImage/EditableBackgroundImage) or a video (for EditableVideo).
     * Requires `editSessionToken`. Video has no server-side magic-byte
     * validation (mirrors the admin media pipeline) — the browser-reported
     * MIME (`file.type`) is what the backend checks, sent automatically. */
    uploadMedia: (file: Blob, filename?: string, opts?: { contentType?: "IMAGE" | "VIDEO" }) => {
      const form = new FormData();
      form.append("file", file, filename);
      if (opts?.contentType) form.append("content_type", opts.contentType);
      if (opts?.contentType === "VIDEO") form.append("mime_type", file.type);
      return http.postForm<EditableMediaUpload>("/storefront/editable-content/media/", form);
    },
  };
}
