import { ContactForm } from "@/components/ContactForm";

/**
 * contact template
 *
 * The fields are not defined here. The merchant builds the form in the admin
 * under the key "contact", and <ContactForm> renders whatever they built — so
 * adding a field is something the merchant does themselves, not a theme change.
 *
 * If no form with this key exists yet, the section renders nothing and the page
 * is simply the heading. Create one in the admin and it appears.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return <ContactForm formKey="contact" title="Get in touch" />;
}
