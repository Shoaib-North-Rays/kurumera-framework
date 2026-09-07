"use client";

/**
 * Renders a merchant-defined form and submits it.
 *
 * Nothing here knows what the form contains. The fields arrive as data from
 * the store's own definition, so a merchant who adds a "Preferred contact
 * time" dropdown in the admin has it on their storefront immediately — no
 * theme edit, no push, no deploy. That is the whole point: hardcoding name /
 * email / message would mean the merchant has to hire someone to change their
 * own contact form.
 *
 * The server half (ContactForm.tsx) fetches the schema; this half is the
 * interaction.
 */
import { useState } from "react";
import {
  createKurumeraClient, formFieldErrors,
  type FormFieldDef, type FormValue,
} from "@kurumera/storefront";
import { tenantSlug } from "@/lib/cart-client";

/** Honeypot. Real shoppers never see it; bots fill everything they find. */
const HONEYPOT = "website";

function initialValues(fields: FormFieldDef[]): Record<string, FormValue> {
  const v: Record<string, FormValue> = {};
  for (const f of fields) v[f.key] = f.type === "checkbox" ? false : "";
  return v;
}

export function ContactFormClient({
  slug,
  fields,
  successMessage,
}: {
  slug: string;
  fields: FormFieldDef[];
  successMessage: string;
}) {
  const [values, setValues] = useState<Record<string, FormValue>>(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [trap, setTrap] = useState("");

  const set = (key: string, value: FormValue) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      await createKurumeraClient({ tenant: tenantSlug() }).forms.submit(
        slug,
        { ...values, [HONEYPOT]: trap },
        { sourceUrl: window.location.pathname },
      );
      setDone(true);
    } catch (err) {
      // Field errors belong against their fields; anything else — network,
      // throttled, form switched off — is one message at the top, because it
      // is not any single answer's fault.
      const fieldErrors = formFieldErrors(err);
      if (fieldErrors) setErrors(fieldErrors);
      else setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="form-success" role="status">
        {/* The merchant's own wording, not ours. */}
        <p>{successMessage}</p>
      </div>
    );
  }

  return (
    <form className="kf" onSubmit={onSubmit} noValidate>
      {formError ? (
        <p className="kf__error kf__error--form" role="alert">{formError}</p>
      ) : null}

      {fields.map((f) => {
        const id = `kf-${slug}-${f.key}`;
        const err = errors[f.key];
        const describedBy = [f.help ? `${id}-help` : null, err ? `${id}-err` : null]
          .filter(Boolean)
          .join(" ");
        const common = {
          id,
          name: f.key,
          required: f.required,
          "aria-invalid": err ? true : undefined,
          "aria-describedby": describedBy || undefined,
        };

        return (
          <div className="kf__field" key={f.key}>
            {/* A checkbox reads label-after-control; everything else before. */}
            {f.type !== "checkbox" ? (
              <label className="kf__label" htmlFor={id}>
                {f.label}
                {f.required ? <span aria-hidden="true"> *</span> : null}
              </label>
            ) : null}

            {f.type === "textarea" ? (
              <textarea
                {...common}
                rows={5}
                placeholder={f.placeholder}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : f.type === "select" ? (
              <select
                {...common}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              >
                {/* An empty first option so a required select cannot be
                    satisfied by whatever happened to be listed first. */}
                <option value="">{f.placeholder || "Choose…"}</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : f.type === "radio" ? (
              <div className="kf__radios" role="radiogroup" aria-labelledby={`${id}-label`}>
                {(f.options ?? []).map((o) => (
                  <label className="kf__radio" key={o}>
                    <input
                      type="radio"
                      name={f.key}
                      value={o}
                      checked={values[f.key] === o}
                      onChange={() => set(f.key, o)}
                      required={f.required}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            ) : f.type === "checkbox" ? (
              <label className="kf__checkbox" htmlFor={id}>
                <input
                  {...common}
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) => set(f.key, e.target.checked)}
                />
                <span>
                  {f.label}
                  {f.required ? <span aria-hidden="true"> *</span> : null}
                </span>
              </label>
            ) : (
              <input
                {...common}
                // The merchant's type drives the keyboard and the browser's own
                // validation: `phone` is `tel`, `number` is numeric, and so on.
                type={f.type === "phone" ? "tel" : f.type}
                placeholder={f.placeholder}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}

            {f.help ? <p className="kf__help" id={`${id}-help`}>{f.help}</p> : null}
            {err ? <p className="kf__error" id={`${id}-err`}>{err}</p> : null}
          </div>
        );
      })}

      {/* Honeypot: off-screen rather than display:none, which some bots skip.
          Never announced, never tab-reachable. A filled value is silently
          accepted by the backend and discarded — the bot sees success. */}
      <div className="kf__trap" aria-hidden="true">
        <label htmlFor={`kf-${slug}-${HONEYPOT}`}>Leave this field empty</label>
        <input
          id={`kf-${slug}-${HONEYPOT}`}
          name={HONEYPOT}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
