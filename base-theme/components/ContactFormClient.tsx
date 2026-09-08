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
  type ContactSubmission, type FormFieldDef, type FormValue,
} from "@kurumera/storefront";
import { tenantSlug } from "@/lib/cart-client";

/** Honeypot. Real shoppers never see it; bots fill everything they find. */
const HONEYPOT = "website";

function initialValues(fields: FormFieldDef[]): Record<string, FormValue> {
  const v: Record<string, FormValue> = {};
  for (const f of fields) {
    v[f.key] = f.type === "checkbox" ? false : f.type === "multiselect" ? [] : "";
  }
  return v;
}

/**
 * What a field offers to choose from.
 *
 * `choices` is the normalised shape the definition endpoint returns for every
 * kind of choice — the merchant's typed options (where value equals label) and
 * `membership`, whose choices are the store's real plans, so the value is a
 * plan id and the label is the plan's name. Falling back to `options` keeps a
 * theme working against a backend that has not been updated yet.
 */
function choicesOf(f: FormFieldDef): { value: string; label: string }[] {
  if (f.choices?.length) return f.choices;
  return (f.options ?? []).map((o) => ({ value: o, label: o }));
}

export function ContactFormClient({
  slug,
  fields,
  successMessage,
  mode = "form",
}: {
  slug: string;
  fields: FormFieldDef[];
  successMessage: string;
  /**
   * Where the answers go.
   *
   * `"form"` — a form the merchant BUILT, submitted to its own definition.
   * `"contact"` — the store's built-in contact form, submitted to the
   * platform's contact endpoint. Most stores have never built a form, so this
   * is the one the majority of storefronts actually use; before it existed
   * their contact page rendered nothing at all.
   *
   * Only the destination differs. Both render identically, from the same
   * field shape, so there is one form component rather than two.
   */
  mode?: "form" | "contact";
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
      const kurumera = createKurumeraClient({ tenant: tenantSlug() });
      if (mode === "contact") {
        /*
         * The built-in contact form. The keys here are the endpoint's own
         * input names, and `message` in particular is NOT interchangeable with
         * `body` however much the stored column suggests it — sending `body`
         * is rejected outright, so every enquiry would fail.
         */
        await kurumera.contact.submit({
          ...(values as unknown as ContactSubmission),
          [HONEYPOT]: trap,
        });
      } else {
        await kurumera.forms.submit(
          slug,
          { ...values, [HONEYPOT]: trap },
          { sourceUrl: window.location.pathname },
        );
      }
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
        /*
         * A membership field on a store with no active plans has nothing to
         * choose from. An empty dropdown would be a required question the
         * shopper cannot answer, so the field waits until the merchant has a
         * plan. Every other choice type is the merchant's own wording and is
         * always renderable.
         */
        if (f.type === "membership" && choicesOf(f).length === 0) return null;

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
            ) : f.type === "select" || f.type === "membership" ? (
              <select
                {...common}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              >
                {/* An empty first option so a required select cannot be
                    satisfied by whatever happened to be listed first. */}
                <option value="">{f.placeholder || "Choose…"}</option>
                {choicesOf(f).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            ) : f.type === "radio" ? (
              <div className="kf__radios" role="radiogroup" aria-labelledby={`${id}-label`}>
                {choicesOf(f).map((c) => (
                  <label className="kf__radio" key={c.value}>
                    <input
                      type="radio"
                      name={f.key}
                      value={c.value}
                      checked={values[f.key] === c.value}
                      onChange={() => set(f.key, c.value)}
                      required={f.required}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            ) : f.type === "multiselect" ? (
              /* Several answers to one question. A checkbox group rather than a
                 multi-select listbox: few people know a listbox takes
                 ctrl-click, and it is worse again on touch. */
              <div className="kf__radios" role="group" aria-describedby={describedBy || undefined}>
                {choicesOf(f).map((c) => {
                  const chosen = Array.isArray(values[f.key]) ? (values[f.key] as string[]) : [];
                  return (
                    <label className="kf__radio" key={c.value}>
                      <input
                        type="checkbox"
                        name={f.key}
                        value={c.value}
                        checked={chosen.includes(c.value)}
                        onChange={(e) =>
                          set(
                            f.key,
                            e.target.checked
                              ? [...chosen, c.value]
                              : chosen.filter((v) => v !== c.value),
                          )
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : f.type === "coupon" ? (
              /* Codes are stored and matched upper-cased, so the input shows
                 what will actually be submitted rather than quietly changing it
                 on send. Whether it is VALID is the server's call — the same
                 check checkout makes — so nothing is guessed here. */
              <input
                {...common}
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder={f.placeholder || "Enter your code"}
                value={String(values[f.key] ?? "")}
                onChange={(e) => set(f.key, e.target.value.toUpperCase())}
              />
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
                type={f.type === "phone" ? "tel" : f.type === "url" ? "url" : f.type}
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
