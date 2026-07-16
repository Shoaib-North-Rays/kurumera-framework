"use client";

import { useState } from "react";
import { MailIcon, CheckIcon } from "@/components/Icon";

/** Email capture. Wire to your newsletter endpoint in onSubmit; optimistic UI here. */
export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="newsletter__done"><CheckIcon /> Thanks — you&apos;re subscribed.</p>
    );
  }

  return (
    <form
      className="newsletter"
      onSubmit={(e) => { e.preventDefault(); if (email) setDone(true); }}
    >
      <span className="newsletter__icon"><MailIcon /></span>
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address" aria-label="Email address"
      />
      <button className="btn btn--primary" type="submit">Subscribe</button>
    </form>
  );
}
