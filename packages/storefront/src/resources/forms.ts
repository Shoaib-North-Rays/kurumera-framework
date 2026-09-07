/**
 * Merchant-defined forms.
 *
 * A merchant builds a form in the admin (or via MCP) — which fields, in what
 * order, with what rules — and the backend stores that schema against the
 * store. This resource is how a theme renders it.
 *
 * The point is that the theme does NOT know the fields. It asks for them at
 * request time and renders whatever comes back, so a merchant adding a
 * "Preferred contact time" dropdown at 2pm has it on their storefront at 2pm,
 * with no code change, no push and no deploy. A theme that hardcodes name /
 * email / message is a theme the merchant has to hire someone to edit.
 */
import type { Http } from "../http.js";
import { KurumeraError } from "../http.js";

const enc = encodeURIComponent;

/** One field in a merchant's form, as the admin defined it. */
export interface FormFieldDef {
  /** Submit under this key. Unique within the form. */
  key: string;
  /** What to show the shopper. */
  label: string;
  type:
    | "text" | "email" | "phone" | "number" | "textarea"
    | "select" | "checkbox" | "radio" | "date"
    | "url"
    /** Answer is a list of strings. */
    | "multiselect"
    /** Checked against the store's real discount codes. */
    | "coupon"
    /** Choices are the store's real active plans; the answer is a plan id. */
    | "membership";
  required: boolean;
  placeholder?: string;
  /** Hint text shown under the input. */
  help?: string;
  /** Present for `select`, `radio` and `multiselect`; the merchant's own words. */
  options?: string[];
  /**
   * Render from this, not `options`.
   *
   * Both kinds of choice arrive normalised here — the merchant's typed options
   * (where value equals label) and `membership`, whose choices are the store's
   * real plans resolved at request time, so the value is a plan id and the
   * label is the plan's name. One shape to render instead of special-casing.
   *
   * A `membership` field on a store with no active plans has an empty array;
   * there is nothing answerable, so don't render it.
   */
  choices?: { value: string; label: string }[];
}

export interface FormDefinition {
  slug: string;
  name: string;
  fields: FormFieldDef[];
  /** What to show after a successful submission — the merchant's own wording. */
  success_message: string;
  /** Absolute API path the answers POST to. Informational; `submit()` handles it. */
  submit_to: string;
}

export interface FormSubmitResult {
  detail: string;
}

/**
 * A submitted value. `checkbox` sends a boolean, `multiselect` an array of the
 * chosen values, everything else a string.
 */
export type FormValue = string | number | boolean | string[] | null;

/**
 * Per-field validation messages from a rejected submission, keyed by field.
 *
 * Field errors are an ordinary outcome of a form, not an exceptional one — but
 * the SDK's convention is that a non-2xx throws, so this is the accessor that
 * turns the thrown error back into something a form can render inline. Returns
 * null for any other failure (network, throttle, form switched off), which the
 * caller should surface as a single message rather than against a field.
 */
export function formFieldErrors(err: unknown): Record<string, string> | null {
  if (!(err instanceof KurumeraError) || err.code !== "invalid_fields") return null;
  const body = err.body as { error?: { fields?: Record<string, unknown> } } | null;
  const fields = body?.error?.fields;
  if (!fields || typeof fields !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = String(v);
  return out;
}

export function formsResource(http: Http) {
  return {
    /**
     * GET /storefront/content/forms/<slug>/definition/ — the field schema to
     * render. Throws KurumeraError 404 when the form does not exist OR has
     * been switched off; the backend deliberately does not distinguish the
     * two, since "exists but disabled" is not a public fact.
     */
    getDefinition: (slug: string) =>
      http.get<FormDefinition>(`/storefront/content/forms/${enc(slug)}/definition/`),

    /**
     * POST /storefront/content/forms/<slug>/ — submit the answers.
     *
     * `name` and `email`, if the merchant's schema includes them, are promoted
     * to columns on the submission so the admin's inbox can show a sender
     * without unpacking JSON. Everything else is kept in the payload.
     *
     * Pass `sourceUrl` (a site path or absolute URL) to record which page the
     * form was submitted from — worth doing when the same form appears in more
     * than one place. It is stored as metadata, not treated as an answer.
     *
     * On validation failure this throws; use `formFieldErrors()` to render the
     * messages against their fields.
     */
    submit: (slug: string, values: Record<string, FormValue>, opts?: { sourceUrl?: string }) =>
      http.post<FormSubmitResult>(`/storefront/content/forms/${enc(slug)}/`, {
        ...values,
        ...(opts?.sourceUrl ? { source_url: opts.sourceUrl } : {}),
      }),
  };
}
