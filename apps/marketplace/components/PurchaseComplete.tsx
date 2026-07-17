"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Shield } from "@/components/Icons";

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

export function PurchaseComplete() {
  const sid = useSearchParams().get("session_id") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [data, setData] = useState<License | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sid) { setState("error"); setErr("No checkout session was provided."); return; }
    (async () => {
      try {
        const r = await fetch(`/api/market/license?session_id=${encodeURIComponent(sid)}`);
        const d = await r.json();
        if (!r.ok || !d.ok) { setState("error"); setErr(d?.error || "We couldn't verify your purchase."); return; }
        setData(d as License); setState("ok");
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
      <p className="muted">Save your license key — you&rsquo;ll need it to install or re-install the template.</p>
      <CopyBox label="license key" value={data.key} />
      <CopyBox label="install into a store" value={`kurumera marketplace install ${data.theme} --store <your-store> --license ${data.key}`} />
      <p className="purchase__note"><Shield /> Keep this key somewhere safe — it&rsquo;s tied to your purchase.</p>
      <div className="purchase__actions">
        <Link className="btn btn--primary" href={`/templates/${data.theme}`}>View template</Link>
        <Link className="btn btn--secondary" href="/templates">Browse more</Link>
      </div>
    </div>
  );
}
