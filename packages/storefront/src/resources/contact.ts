/**
 * The store's own contact form — the one every store has without setting
 * anything up.
 *
 * This exists because of a gap that made the CLI themes' contact page blank on
 * most real stores. `forms` renders a FormDefinition the merchant BUILT; a
 * merchant who never built one has no definition, the endpoint answers 404, and
 * a theme that only knows about `forms` renders nothing at all. That is what
 * shipped: of the live stores checked, every one had contact settings and only
 * a hand-made test store had a definition. Three storefronts out of four had a
 * contact page with no form on it.
 *
 * Meanwhile the platform has always had a contact endpoint — throttled,
 * honeypot-protected, writing a ContactMessage the merchant reads in the admin
 * — plus four fields they can switch on in the admin (Subject, Phone, Company,
 * Designation, each Hidden / Optional / Required). Nothing in the themes read
 * either. This resource is both halves.
 *
 * So: a merchant's own FormDefinition wins where one exists, and this is what
 * every other store gets. `contactFields()` returns the merchant's settings in
 * the same `FormFieldDef` shape a definition uses, so a theme renders one code
 * path either way.
 */
import type { Http } from "../http.js";
import type { FormFieldDef } from "./forms.js";

/** Hidden / Optional / Required, exactly as the merchant set it in the admin. */
export type ContactFieldRule = "HIDDEN" | "OPTIONAL" | "REQUIRED";

/** The four fields the merchant controls. Name, email and message always show. */
export interface ContactFormRules {
  subject: ContactFieldRule;
  phone: ContactFieldRule;
  company: ContactFieldRule;
  designation: ContactFieldRule;
}

/** The merchant's own published contact details, for rendering beside the form. */
export interface ContactDetails {
  email: string;
  phone: string;
  whatsappNumber: string;
  companyName: string;
  address: string;
}

export interface ContactConfig {
  rules: ContactFormRules;
  details: ContactDetails;
}

/**
 * What renders when tenant-config cannot be read.
 *
 * Matches the platform's own defaults rather than being maximally permissive:
 * these are the settings a store has before the merchant touches anything, so
 * an outage renders the form the merchant would recognise.
 */
export const DEFAULT_CONTACT_CONFIG: ContactConfig = {
  rules: { subject: "OPTIONAL", phone: "HIDDEN", company: "HIDDEN", designation: "HIDDEN" },
  details: { email: "", phone: "", whatsappNumber: "", companyName: "", address: "" },
};

function rule(v: unknown, fallback: ContactFieldRule): ContactFieldRule {
  return v === "HIDDEN" || v === "OPTIONAL" || v === "REQUIRED" ? v : fallback;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The merchant's four configurable fields, in the order they read on a form. */
const EXTRAS: { key: keyof ContactFormRules; label: string; type: FormFieldDef["type"] }[] = [
  { key: "subject", label: "Subject", type: "text" },
  { key: "phone", label: "Phone", type: "phone" },
  { key: "company", label: "Company", type: "text" },
  { key: "designation", label: "Job title", type: "text" },
];

/**
 * The merchant's contact settings as fields to render.
 *
 * Deliberately the same `FormFieldDef` shape a built form uses, so a theme
 * renders a merchant's custom form and the built-in one through one component
 * instead of maintaining two. `message` is a textarea and last, because that is
 * the enquiry and everything above it is context for it.
 */
export function contactFields(rules: ContactFormRules): FormFieldDef[] {
  return [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    ...EXTRAS.filter((x) => rules[x.key] !== "HIDDEN").map((x) => ({
      key: x.key,
      label: x.label,
      type: x.type,
      required: rules[x.key] === "REQUIRED",
    })),
    { key: "message", label: "Message", type: "textarea" as const, required: true },
  ];
}

export interface ContactSubmission {
  name: string;
  email: string;
  /**
   * The enquiry itself. Sent as `message` — the API's input name — which the
   * backend maps onto ContactMessage.body. `body` is REJECTED with
   * "message: This field is required", so the two are not interchangeable
   * however much the model column suggests they are.
   */
  message: string;
  subject?: string;
  phone?: string;
  company?: string;
  designation?: string;
  /** Honeypot. Any value and the backend accepts and silently discards. */
  website?: string;
  [k: string]: unknown;
}

export interface ContactSubmitResult {
  detail: string;
}

export function contactResource(http: Http) {
  return {
    /**
     * GET /storefront/tenant-config/ — the contact half, parsed.
     *
     * Never throws. A contact form that cannot read its configuration should
     * still render and still send: the enquiry matters more than which optional
     * boxes are on it.
     */
    getConfig: async (): Promise<ContactConfig> => {
      try {
        const c = await http.get<{
          contact?: Record<string, unknown>;
          contact_form?: Record<string, unknown>;
        }>("/storefront/tenant-config/");
        const cf = c.contact_form ?? {};
        const ct = c.contact ?? {};
        const d = DEFAULT_CONTACT_CONFIG;
        return {
          rules: {
            subject: rule(cf.subject, d.rules.subject),
            phone: rule(cf.phone, d.rules.phone),
            company: rule(cf.company, d.rules.company),
            designation: rule(cf.designation, d.rules.designation),
          },
          details: {
            email: str(ct.email),
            phone: str(ct.phone),
            whatsappNumber: str(ct.whatsapp_number),
            companyName: str(ct.company_name),
            address: str(ct.address),
          },
        };
      } catch {
        return DEFAULT_CONTACT_CONFIG;
      }
    },

    /**
     * POST /storefront/contact/ — public, throttled, honeypot-protected.
     *
     * Throws on failure like every other SDK call, so a caller can tell a
     * validation error from a throttle from an outage. The one outcome this
     * must never produce is a silent success: a dropped enquiry is invisible to
     * the shopper AND to the merchant, so neither ever learns to follow up.
     */
    submit: (input: ContactSubmission) =>
      http.post<ContactSubmitResult>("/storefront/contact/", input as Record<string, unknown>),
  };
}
