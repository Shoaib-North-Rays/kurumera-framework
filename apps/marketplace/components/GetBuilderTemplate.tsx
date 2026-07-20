import { Bolt } from "@/components/Icons";

/**
 * PDP "get" section for a builder template. Unlike code themes (install/clone via
 * CLI), a visual design is added to a store's builder and edited drag-and-drop.
 * Phase 1: browsable + previewable; the one-click "Add to my site" lands in Phase 2.
 */
export function GetBuilderTemplate() {
  return (
    <div className="pdp__actions">
      <div className="builder-note">
        <Bolt />
        <p><b>Editable visual template.</b> Add it to your site and customize it in the Kurumera builder — no code needed. One-click &ldquo;Add to my site&rdquo; arrives with the buyer flow.</p>
      </div>
      <a className="btn btn--secondary btn--lg btn--block" href="https://builder.kurumera.com" target="_blank" rel="noreferrer">Explore the builder</a>
    </div>
  );
}
