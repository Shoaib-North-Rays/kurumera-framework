import { readConfig, writeConfig, type CliConfig } from "./config.js";

const DEFAULT_API_URL = "https://admin.kurumera.com/api/v1";

function apiUrlFor(cfg: CliConfig): string {
  return process.env.KURUMERA_API_URL || cfg.apiUrl || DEFAULT_API_URL;
}

/**
 * Resolve the bearer token for an authenticated theme-kit request
 * (push/publish/rollback/preview/logs).
 *
 * Precedence:
 *  1. `KURUMERA_CLI_TOKEN` env var — used IN-MEMORY ONLY, never written back
 *     to config.json. This is the intended shape for CI/automation: the
 *     secret lives in the CI platform's own secret store, not on disk. No
 *     refresh is attempted for it (there's no paired refresh token) — issue
 *     it with a long/no expiry from the dashboard's "CI tokens" pane if the
 *     pipeline needs to outlive one hour.
 *  2. `cfg.auth` (structured — device-flow or manual session saved by
 *     `kurumera login`) — auto-refreshed via `/api/v1/cli/device/token/`
 *     (grant_type=refresh_token) when it's expiring soon and a refresh
 *     token is available; the rotated pair is written back to config.json.
 *  3. `cfg.authToken` (legacy loopback-flow field) — untouched, so a session
 *     saved before this feature shipped keeps working with no re-login.
 */
export async function resolveAuthToken(): Promise<string | undefined> {
  const envToken = process.env.KURUMERA_CLI_TOKEN;
  if (envToken) return envToken;

  const cfg = readConfig();
  if (cfg.auth?.accessToken) {
    const expiringSoon = cfg.auth.expiresAt !== undefined && Date.now() > cfg.auth.expiresAt - 30_000;
    if (!expiringSoon || !cfg.auth.refreshToken) return cfg.auth.accessToken;

    try {
      const res = await fetch(`${apiUrlFor(cfg)}/cli/device/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "refresh_token", refresh_token: cfg.auth.refreshToken }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        access_token?: string; refresh_token?: string; expires_in?: number; scope?: string;
      };
      if (res.ok && body.access_token) {
        cfg.auth = {
          type: cfg.auth.type,
          accessToken: body.access_token,
          refreshToken: body.refresh_token || cfg.auth.refreshToken,
          expiresAt: Date.now() + Math.max(1, Number(body.expires_in) || 3600) * 1000,
          scopes: String(body.scope || "").split(" ").filter(Boolean),
        };
        writeConfig(cfg);
        return cfg.auth.accessToken;
      }
    } catch {
      /* network hiccup — fall through and use the (possibly stale) access
         token; the server gives a clear "token_expired" 401 if it's bad. */
    }
    return cfg.auth.accessToken;
  }

  return cfg.authToken;
}
