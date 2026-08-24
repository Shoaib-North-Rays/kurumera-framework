"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, Chevron } from "@/components/Icons";
import { getSession, signOut, startSignIn, type Session } from "@/lib/session";

/**
 * The header's account control — one 40px icon in place of the "Sign in" text
 * button and the "Start Building" CTA that used to sit beside it.
 *
 * WHY THE CTA WENT: it read "Start Building" and linked to /templates. Not the
 * builder — the catalogue. A primary button that does not do what it says is
 * worse than no button, and the hero already carries the real entry points.
 *
 * SIGNED OUT it starts the existing Kurumera SSO (lib/session.ts — the same
 * redirect flow the CLI uses, no token pasting). SIGNED IN it opens a menu to
 * the three places a session is actually for. There is no new auth here: this
 * is a different surface onto the token that was already implemented.
 *
 * Renders NOTHING until the session has been read from localStorage. A server
 * component cannot know whether you are signed in, so painting either state
 * first guarantees a wrong flash for half of all visitors; a 40px hole for one
 * frame is the smaller lie.
 */
export function AccountMenu() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSession(getSession());
    setReady(true);
  }, []);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  /* Dismiss on outside click and on Escape. One document listener, added only
     while the menu is open — a header must not carry a live global listener
     for a control most visitors never touch. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(true); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!ready) return <span className="acct__placeholder" aria-hidden />;

  if (!session) {
    return (
      <button
        type="button"
        className="icon-btn acct__trigger"
        aria-label="Sign in to Kurumera"
        onClick={() => startSignIn("/creator")}
      >
        <User />
      </button>
    );
  }

  const store = session.tenant;
  return (
    <div className="acct" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="icon-btn acct__trigger acct__trigger--in"
        aria-label={store ? `Account — signed in to ${store}` : "Account"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <User />
        {/* The dot is the entire signed-in affordance. A avatar would need a
            photo the platform does not have, and initials from a store slug
            read as a bug when the slug is an email local-part. */}
        <span className="acct__dot" aria-hidden />
        <Chevron />
      </button>

      {open && (
        <div className="acct__menu" role="menu">
          {store && (
            <span className="acct__store">
              Signed in{" "}
              <b>{store}</b>
            </span>
          )}
          <Link className="acct__item" role="menuitem" href="/creator" onClick={() => close()}>
            Creator dashboard
          </Link>
          <Link className="acct__item" role="menuitem" href="/purchases" onClick={() => close()}>
            My purchases
          </Link>
          <Link className="acct__item" role="menuitem" href="/saved" onClick={() => close()}>
            Saved templates
          </Link>
          <button
            type="button"
            className="acct__item acct__item--quiet"
            role="menuitem"
            onClick={() => { signOut(); setSession(null); close(true); }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
