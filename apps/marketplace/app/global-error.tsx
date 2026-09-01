"use client";

import { useEffect } from "react";

/**
 * Last resort: a failure in the ROOT LAYOUT itself.
 *
 * `error.tsx` sits inside the layout, so it cannot catch a throw from the
 * layout — fonts, providers, the boot script. When that happens Next looks for
 * this file, and if it is absent the visitor gets a bare browser error document.
 *
 * It therefore renders its own <html> and <body>, and cannot use anything from
 * the app: no globals.css (that is imported by the layout that just failed), no
 * shared components, no design tokens. Every style here is inline on purpose —
 * this file has to work when nothing else does.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[marketplace] ROOT LAYOUT error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", background: "#F8FAFC", color: "#111827" }}>
        <main style={{ maxWidth: "34rem", margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
          <div style={{ display: "inline-grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "#16A34A", color: "#fff", fontWeight: 800, fontSize: 20 }}>
            K
          </div>
          <h1 style={{ marginTop: "1.5rem", fontSize: "1.75rem", lineHeight: 1.2, fontWeight: 800 }}>
            Kurumera is temporarily unavailable
          </h1>
          <p style={{ marginTop: "0.85rem", color: "#64748B", lineHeight: 1.6 }}>
            Something failed while loading the site. If you were partway through a
            purchase, it has not been charged.
          </p>
          <div style={{ marginTop: "1.75rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              type="button"
              style={{ padding: "0.75rem 1.25rem", borderRadius: 10, border: 0, background: "#16A34A", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Try again
            </button>
            <a
              href="mailto:info@kurumera.com"
              style={{ padding: "0.75rem 1.25rem", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", color: "#111827", fontWeight: 700, textDecoration: "none" }}
            >
              Contact support
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.8125rem", color: "#94A3B8" }}>
              Reference <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
