/**
 * A merchant-defined form, fetched at request time.
 *
 * Drop it anywhere and give it the form's key:
 *
 *   <ContactForm formKey="contact" />
 *
 * The merchant builds the form in the admin (Content → Forms, or via MCP) and
 * this renders whatever they built. Add a field there and it appears here on
 * the next page load — no theme edit, no push.
 *
 * Server Component on purpose: the schema is fetched with the store's own
 * credential, so nothing about how the theme authenticates reaches the browser,
 * and the fields are in the HTML rather than appearing after a client fetch.
 */
import { contactFields } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { ContactFormClient } from "./ContactFormClient";

/**
 * Is this the store's contact form, or some other form the theme asked for?
 *
 * Only the contact form has a platform-wide fallback to fall back TO. A missing
 * "job-application" form still renders nothing, because there is no built-in
 * equivalent and inventing one would put a form on the page that goes somewhere
 * the merchant never agreed to.
 */
function isContactKey(key: string): boolean {
  return key === "contact" || key === "contact-us" || key === "contact_us";
}

export async function ContactForm({
  formKey,
  title,
}: {
  /** The form's slug, as set in the admin. */
  formKey: string;
  /** Optional heading. Omit to use the merchant's own name for the form. */
  title?: string;
}) {
  const kurumera = await getStore();

  let definition;
  try {
    definition = await kurumera.forms.getDefinition(formKey);
  } catch {
    /*
     * No form with this key — the merchant never built one, or switched it off.
     * The backend answers 404 to both, deliberately, since "exists but
     * disabled" is not a public fact.
     *
     * This used to `return null`, and that was the bug. Building a form is
     * something almost no merchant does: of the live stores checked, every one
     * had contact settings and only a hand-made test store had a definition.
     * So the common case — a merchant who just wants people to be able to reach
     * them — got a contact page with NO FORM ON IT, and nothing anywhere said
     * why.
     *
     * Fall back to the contact form every store has: name, email and message,
     * plus whichever of Subject / Phone / Company / Job title the merchant
     * switched on in the admin, sent to the platform's own contact endpoint and
     * landing in their admin inbox. A store gets a working contact page out of
     * the box, and a merchant who does build a form still overrides it.
     */
    if (!isContactKey(formKey)) return null;

    const { rules } = await kurumera.contact.getConfig();
    return (
      <section className="section kf-section">
        <h2 className="section__title">{title ?? "Contact us"}</h2>
        <ContactFormClient
          slug="contact"
          mode="contact"
          fields={contactFields(rules)}
          successMessage="Thanks — your message has been received. We'll be in touch."
        />
      </section>
    );
  }

  if (!definition.fields?.length) return null;

  return (
    <section className="section kf-section">
      <h2 className="section__title">{title ?? definition.name}</h2>
      <ContactFormClient
        slug={definition.slug}
        fields={definition.fields}
        successMessage={definition.success_message}
      />
    </section>
  );
}
