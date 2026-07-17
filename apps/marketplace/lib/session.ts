/**
 * Web SSO against Kurumera. "Sign in" redirects to kurumera.com/cli-auth with a
 * web redirect_uri; the auth page returns the session in the URL fragment, which
 * /auth/callback stores here. Same session the CLI uses — no token pasting.
 * Client-only (uses window/localStorage).
 */
export const AUTH_ORIGIN = process.env.KURUMERA_AUTH_ORIGIN || "https://kurumera.com";

const TK = "kurumera_session_token";
const RK = "kurumera_session_refresh";
const NK = "kurumera_session_tenant";
const STATE = "kurumera_oauth_state";
const NEXT = "kurumera_after_login";

export interface Session { token: string; tenant: string; }

export function getSession(): Session | null {
  try {
    const token = localStorage.getItem(TK) || "";
    return token ? { token, tenant: localStorage.getItem(NK) || "" } : null;
  } catch { return null; }
}
export function saveSession(token: string, refresh: string, tenant: string) {
  try {
    localStorage.setItem(TK, token);
    if (refresh) localStorage.setItem(RK, refresh);
    if (tenant) localStorage.setItem(NK, tenant);
  } catch { /* private mode */ }
}
export function signOut() {
  try { [TK, RK, NK].forEach((k) => localStorage.removeItem(k)); } catch { /* */ }
}

/** Kick off the redirect SSO. `next` = where to land after sign-in. */
export function startSignIn(next = "/creator") {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem(STATE, state); sessionStorage.setItem(NEXT, next); } catch { /* */ }
  const redirect = `${window.location.origin}/auth/callback`;
  window.location.href = `${AUTH_ORIGIN}/cli-auth?redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
}
export function consumeState(returned: string): boolean {
  try { const s = sessionStorage.getItem(STATE); sessionStorage.removeItem(STATE); return !!s && s === returned; } catch { return false; }
}
export function consumeNext(): string {
  try { const n = sessionStorage.getItem(NEXT) || "/creator"; sessionStorage.removeItem(NEXT); return n; } catch { return "/creator"; }
}
