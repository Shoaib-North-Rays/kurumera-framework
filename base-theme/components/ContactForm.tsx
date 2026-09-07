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
import { getStore } from "@/lib/kurumera";
import { ContactFormClient } from "./ContactFormClient";

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
     * No such form, or the merchant switched it off — the backend answers 404
     * to both, deliberately, since "exists but disabled" is not a public fact.
     *
     * Render nothing. A shopper should never meet a broken form or an error
     * about one, and a half-rendered form with no fields is worse than an
     * absent section. The merchant's own admin is where the form's existence
     * is managed, and that is where its absence is visible.
     */
    return null;
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
