"use client";

import { startSignIn } from "@/lib/session";

export function SignInButton({ className = "signin", label = "Sign in", next = "/creator" }: { className?: string; label?: string; next?: string }) {
  return (
    <button type="button" className={className} onClick={() => startSignIn(next)}>
      {label}
    </button>
  );
}
