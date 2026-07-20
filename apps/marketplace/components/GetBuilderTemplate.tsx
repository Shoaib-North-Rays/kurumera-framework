import { Bolt, Expand } from "@/components/Icons";
import { builderPreviewUrl } from "@/lib/registry";

/**
 * PDP "get" section for a builder template. Unlike code themes (install/clone via
 * CLI), a visual design is added to a store's builder and edited drag-and-drop.
 * Phase 1: browsable + live-previewable; the one-click "Add to my site" lands in
 * Phase 2.
 */
export function GetBuilderTemplate({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="pdp__actions">
      <div className="builder-note">
        <Bolt />
        <p><b>Editable visual template.</b> Add it to your site and customize it in the Kurumera builder — no code needed. One-click &ldquo;Add to my site&rdquo; arrives with the buyer flow.</p>
      </div>
      <a className="btn btn--primary btn--lg btn--block" href={builderPreviewUrl(slug)} target="_blank" rel="noreferrer"><Expand /> Live preview</a>
      <a className="btn btn--secondary btn--lg btn--block" href="https://builder.kurumera.com" target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>Explore the builder</a>
    </div>
  );
}
