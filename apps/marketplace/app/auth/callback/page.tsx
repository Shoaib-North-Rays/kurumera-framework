"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession, consumeState, consumeNext } from "@/lib/session";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = h.get("token") || "";
    const refresh = h.get("refresh") || "";
    const tenant = h.get("tenant") || "";
    const state = h.get("state") || "";

    if (!token) { setError("Sign-in didn't return a session. Please try again."); return; }
    if (!consumeState(state)) { setError("Security check failed (state mismatch). Please sign in again."); return; }

    saveSession(token, refresh, tenant);
    const next = consumeNext();
    // Strip the token fragment from the URL before navigating on.
    try { history.replaceState(null, "", window.location.pathname); } catch { /* */ }
    router.replace(next);
  }, [router]);

  return (
    <div className="wrap" style={{ padding: "90px 0", textAlign: "center" }}>
      {error ? (
        <>
          <h1 style={{ fontSize: 26 }}>Sign-in problem</h1>
          <p className="muted" style={{ margin: "10px 0 22px" }}>{error}</p>
          <a className="btn btn--primary" href="/creator">Try again</a>
        </>
      ) : (
        <p className="muted">Signing you in…</p>
      )}
    </div>
  );
}
