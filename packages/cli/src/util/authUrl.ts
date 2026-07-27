/**
 * Base URL for the CLI's remote-safe auth endpoints (device authorize/token/
 * revoke) — deliberately SEPARATE from the commerce/API base URL
 * (KURUMERA_API_URL, admin.kurumera.com, used by `theme dev` and friends for
 * real storefront data).
 *
 * Hosted/sandboxed AI-agent environments (ChatGPT, Codex, cloud AI
 * workspaces) are frequently only allowed to reach the public origin the
 * user connected them to (kurumera.com) — not an arbitrary subdomain like
 * admin.kurumera.com, even though both are ours. kurumera.com proxies
 * `/api/v1/cli/*` straight through to the real backend (see
 * theplantsmall-admin-frontend's next.config.ts rewrites, the same pattern
 * already used for /mcp), so defaulting HERE to the public origin — and
 * never silently falling back to KURUMERA_API_URL/admin.kurumera.com — is
 * what makes device login work from inside those sandboxes.
 */
const DEFAULT_AUTH_URL = "https://kurumera.com/api/v1";

export function resolveAuthUrl(explicit?: string, cfgApiUrl?: string): string {
  return explicit || process.env.KURUMERA_AUTH_URL || cfgApiUrl || DEFAULT_AUTH_URL;
}
