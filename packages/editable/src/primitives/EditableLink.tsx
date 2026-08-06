import { resolveEditableContent } from "../server/resolve.js";
import { LinkFieldClient, type LinkFieldValue } from "./LinkFieldClient.js";

export interface EditableLinkProps {
  /** Field stores `{ label, href }` — same shape as EditableButton, kept as
   * a distinct export since "inline text link" and "styled CTA button" are
   * conceptually different reaches for a theme dev, and are likely to
   * diverge further (e.g. a future "open in new tab" toggle only makes
   * sense here). */
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

export async function EditableLink({ field, defaultLabel, defaultHref, className }: EditableLinkProps) {
  const { mode, fields } = await resolveEditableContent();
  const { label, href } = resolveValue(fields[field]?.value, defaultLabel, defaultHref);

  if (mode !== "edit") {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }
  return <LinkFieldClient field={field} defaultValue={{ label: defaultLabel, href: defaultHref }} fieldType="link" className={className} />;
}
