"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Shield } from "@/components/Icons";
import { BUILDER_ORIGIN, getTemplate } from "@/lib/registry";

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <div className="code__bar">
        <span>{label}</span>
        <button onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? "copied" : "copy"}</button>
      </div>
      <pre><code>{value}</code></pre>
    </div>
  );
}

interface License { theme: string; name: string; key: string }

/** What the buyer actually bought decides what they need next.
 *
 *  A `builder` design is pages + a theme installed into their store and edited
 *  in the visual builder — there is no repository to clone and no CLI in that
 *  workflow at all. A `code` theme is Next.js source: clone it, edit it in an
 *  editor, push it. Showing the CLI block to a builder buyer (which is what we
 *  did for every purchase) hands them instructions for a workflow their
 *  purchase does not have. */
type Kind = "builder" | "code" | "unknown";

export function PurchaseComplete() {
  const sid = useSearchParams().get("session_id") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [data, setData] = useState<License | null>(null);
  const [kind, setKind] = useState<Kind>("unknown");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sid) { setState("error"); setErr("No checkout session was provided."); return; }
    (async () => {
      try {
        const r = await fetch(`/api/market/license?session_id=${encodeURIComponent(sid)}`);
        const d = await r.json();
        if (!r.ok || !d.ok) { setState("error"); setErr(d?.error || "We couldn't verify your purchase."); return; }
        setData(d as License); setState("ok");
        // The licence response does not carry the listing type, so read it from
        // the catalogue. Deliberately AFTER the success state: a slow or failed
        // lookup must never hold up (or break) the page confirming a payment —
        // it only decides which follow-up we offer, and "unknown" falls back to
        // the CLI block, which is the safe default for the older `code` themes.
        try {
          const t = await getTemplate(String((d as License).theme || ""));
          setKind(t?.type === "builder" ? "builder" : t ? "code" : "unknown");
        } catch { /* keep "unknown" */ }
      } catch { setState("error"); setErr("Network error verifying your purchase."); }
    })();
  }, [sid]);

  if (state === "loading") return <div className="purchase"><p className="muted">Verifying your purchase…</p></div>;

  if (state === "error" || !data) {
    return (
      <div className="purchase">
        <h1>Purchase couldn&rsquo;t be verified</h1>
        <p className="muted">{err}</p>
        <p className="muted">If you were charged, email <a href="mailto:support@kurumera.com">support@kurumera.com</a> and we&rsquo;ll sort it out.</p>
        <div className="purchase__actions"><Link className="btn btn--secondary" href="/templates">Back to templates</Link></div>
      </div>
    );
  }

  return (
    <div className="purchase">
      <div className="purchase__badge"><Check width={24} height={24} /></div>
      <h1>You now own &ldquo;{data.name}&rdquo;</h1>
      {kind === "builder" ? (
        <>
          <p className="muted">
            Add it to your site and start editing — everything is customisable in the builder.
          </p>
          {/* The licence travels IN the link, so the buyer never has to paste
              back a key we just issued them. `mode=new-theme` installs into a
              NEW draft design rather than the one the store is serving:
              trying a template you just bought must not disturb a live site. */}
          <div className="purchase__actions">
            <a
              className="btn btn--primary btn--lg"
              href={`${BUILDER_ORIGIN}/install/${encodeURIComponent(data.theme)}?license=${encodeURIComponent(data.key)}&mode=new-theme`}
            >
              Open in Editor
            </a>
            <Link className="btn btn--secondary btn--lg" href={`/templates/${data.theme}`}>View template</Link>
          </div>
          {/* Still shown — it is what re-installs the design on another store or
              after a reset — but demoted well below the action they want now. */}
          <p className="muted" style={{ marginTop: "2.5rem", fontSize: "0.875rem" }}>Your license key, for installing again later:</p>
          <CopyBox label="license key" value={data.key} />
          <p className="purchase__note"><Shield /> Keep this key somewhere safe — it&rsquo;s tied to your purchase.</p>
        </>
      ) : (
        <>
          <p className="muted">Save your license key — you&rsquo;ll need it to install or re-install the template.</p>
          <CopyBox label="license key" value={data.key} />
          <CopyBox label="install into a store (go live)" value={`kurumera marketplace install ${data.theme} --store <your-store> --license ${data.key}`} />
          <CopyBox label="clone the source (customize the code)" value={`kurumera marketplace clone ${data.theme} --license ${data.key}`} />
          <p className="purchase__guide">
            To customize: <b>clone</b> → <code>npm install</code> → edit → <code>kurumera theme push</code> → <code>marketplace publish</code>.{" "}
            <a href="https://themekit.kurumera.com/guide" target="_blank" rel="noreferrer">Full theme guide →</a>
          </p>
          <p className="purchase__note"><Shield /> Keep this key somewhere safe — it&rsquo;s tied to your purchase.</p>
          <div className="purchase__actions">
            <Link className="btn btn--primary" href={`/templates/${data.theme}`}>View template</Link>
            <Link className="btn btn--secondary" href="/templates">Browse more</Link>
          </div>
        </>
      )}
    </div>
  );
}
