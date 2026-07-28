/**
 * Base URL for the CLI's remote-safe auth endpoints (device authorize/token/
 * revoke) — deliberately SEPARATE from the commerce/API base URL
 * (KURUMERA_API_URL / `cfg.apiUrl`, admin.kurumera.com, used by `theme dev`
 * and friends for real storefront data).
 *
 * Hosted/sandboxed AI-agent environments (ChatGPT, Codex, cloud AI
 * workspaces) are frequently only allowed to reach the public origin the
 * user connected them to (kurumera.com) — not an arbitrary subdomain like
 * admin.kurumera.com, even though both are ours. kurumera.com proxies
 * `/api/v1/cli/*` straight through to the real backend (see
 * theplantsmall-admin-frontend's next.config.ts rewrites, the same pattern
 * already used for /mcp), so defaulting HERE to the public origin is what
 * makes device login work from inside those sandboxes.
 *
 * Deliberately does NOT fall back to `cfg.apiUrl` (the saved commerce API
 * base): a developer's commerce endpoint has nothing to do with where auth
 * requests belong, and silently inheriting it is exactly the bug that broke
 * device login from sandboxed agent environments in the first place.
 * Override with `--auth-url` or `KURUMERA_AUTH_URL` — never `--api-url`.
 */
const DEFAULT_AUTH_URL = "https://kurumera.com/api/v1";

export function resolveAuthUrl(explicit?: string): string {
  return explicit || process.env.KURUMERA_AUTH_URL || DEFAULT_AUTH_URL;
}
