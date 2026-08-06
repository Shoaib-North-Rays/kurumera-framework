import { resolveEditableContent } from "../server/resolve.js";
import { LinkFieldClient, type LinkFieldValue } from "./LinkFieldClient.js";

export interface EditableButtonProps {
  /** Field stores `{ label, href }`. */
  field: string;
  defaultLabel: string;
  defaultHref: string;
  className?: string;
}

function resolveValue(raw: unknown, defaultLabel: string, defaultHref: string): LinkFieldValue {
  if (raw && typeof raw === "object") {
    const v = raw as Partial<LinkFieldValue>;
    return { label: v.label || defaultLabel, href: v.href || defaultHref };
  }
  return { label: defaultLabel, href: defaultHref };
}

/** A styled CTA — same `{label, href}` shape as the hero CTAs already
 * hand-written in the base-theme template (see app/page.tsx's
 * hero.primaryCta). Reach for `EditableLink` instead for an inline text
 * link where a "new tab" toggle (or other link-specific behavior) makes
 * more sense than button styling. */
export async function EditableButton({ field, defaultLabel, defaultHref, className }: EditableButtonProps) {
  const { mode, fields } = await resolveEditableContent();
  const { label, href } = resolveValue(fields[field]?.value, defaultLabel, defaultHref);

  if (mode !== "edit") {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }
  return <LinkFieldClient field={field} defaultValue={{ label: defaultLabel, href: defaultHref }} fieldType="button" className={className} />;
}
