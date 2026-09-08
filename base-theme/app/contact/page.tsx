import { ContactForm } from "@/components/ContactForm";

/**
 * contact template
 *
 * The fields are not defined here. A merchant who builds a form in the admin
 * under the key "contact" gets exactly that form, so adding a field is
 * something they do themselves rather than a theme change.
 *
 * A merchant who never builds one — which is most of them — gets the contact
 * form every store has: name, email and message, plus whichever of Subject /
 * Phone / Company / Job title they switched on in the admin, landing in their
 * admin inbox. So this page works out of the box and there is nothing to set up
 * before people can reach the store.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return <ContactForm formKey="contact" title="Get in touch" />;
}
