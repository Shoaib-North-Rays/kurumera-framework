"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The error boundary for everything under the root layout.
 *
 * There was none. Any throw in a Server Component took the page to a blank
 * document with the header and footer gone and no way back — on a site that
 * takes card payments. This keeps the chrome, says what happened without
 * pretending to know why, and offers a route out.
 *
 * It also LOGS. The app had no console output of any kind, so a render failure
 * left no trace anywhere: not in the container logs, not in an error tracker,
 * nowhere. Until real error tracking is wired up, stderr in the container log is
 * the difference between knowing and guessing.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[marketplace] render error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="wrap" style={{ padding: "clamp(4rem, 12vw, 9rem) 0", textAlign: "center" }}>
      <p style={{ fontSize: "var(--t-meta)", fontWeight: 700, letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--green-dark)" }}>
        Something went wrong
      </p>
      <h1 style={{ marginTop: "var(--s-4)", fontSize: "var(--t-h1)", lineHeight: "var(--lh-heading)", letterSpacing: "var(--ls-heading)", fontWeight: 800 }}>
        That page didn&rsquo;t load.
      </h1>
      <p style={{ margin: "var(--s-5) auto 0", maxWidth: "48ch", color: "var(--muted)", lineHeight: "var(--lh-body)" }}>
        This is our end, not yours. Nothing you were doing has been lost — if you
        were partway through a purchase, it has not been charged.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", justifyContent: "center", marginTop: "var(--s-6)" }}>
        <button className="btn btn--primary" onClick={reset} type="button">Try again</button>
        <Link className="btn btn--secondary" href="/templates">Browse templates</Link>
      </div>

      {/* The digest is the only handle support has on a specific failure — it
          maps to the server-side stack Next keeps out of the browser. */}
      {error.digest && (
        <p style={{ marginTop: "var(--s-6)", fontSize: "var(--t-meta)", color: "var(--faint)" }}>
          If you contact <a href="mailto:info@kurumera.com" style={{ color: "var(--green-dark)" }}>info@kurumera.com</a>,
          quote reference <code>{error.digest}</code>.
        </p>
      )}
    </div>
  );
}
