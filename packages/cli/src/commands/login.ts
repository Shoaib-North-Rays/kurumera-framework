import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readConfig, writeConfig, CONFIG_PATH } from "../util/config.js";
import { flag } from "../util/fs.js";
import { detectRemoteEnvironment } from "../util/environment.js";
import { deviceLogin } from "../util/deviceAuth.js";

/** The Kurumera dashboard that hosts the authorize page (kurumera.com). */
const DASHBOARD = (process.env.KURUMERA_DASHBOARD || "https://kurumera.com").replace(/\/+$/, "");
const DEFAULT_API_URL = "https://admin.kurumera.com/api/v1";

function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") {
      // cmd's `start` treats & as a command separator, which truncates the URL
      // at &state=… — escape each & with ^ so the whole URL reaches the browser.
      spawn("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], {
        stdio: "ignore",
        detached: true,
        windowsVerbatimArguments: true,
      }).unref();
      return;
    }
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* the URL is printed as a fallback */
  }
}

/**
 * `kurumera login` — sign in.
 *
 *   kurumera login                  Auto-detect: loopback browser flow on a
 *                                    normal dev machine, device flow when the
 *                                    environment looks remote/headless (SSH,
 *                                    CI, container, no TTY — see util/environment.ts).
 *   kurumera login --browser        Force the local-loopback flow (unchanged,
 *                                    original behavior — CLI and browser MUST
 *                                    share a network, e.g. localhost).
 *   kurumera login --device         Force the remote-safe device flow: prints
 *                                    a URL + code you (or anyone with store
 *                                    access) can open on ANY machine/browser.
 *   kurumera login --token ksf_…    Explicit storefront-token override (unchanged).
 *
 * The device flow is purely ADDITIVE — see util/deviceAuth.ts +
 * util/resolveAuthToken.ts. Nothing about the loopback path below changed.
 */
export async function login(args: string[]): Promise<number> {
  const manual = flag(args, "--token");
  if (manual) return saveManual(manual, flag(args, "--store"), flag(args, "--api-url"));

  if (args.includes("--device")) return loginDevice(args);
  if (!args.includes("--browser") && detectRemoteEnvironment().isRemote) return loginDevice(args);
  return loginBrowser(args);
}

/** Remote-safe device authorization flow — works even when the CLI and the
 *  approving browser are on completely different machines. */
async function loginDevice(args: string[]): Promise<number> {
  const apiUrl = flag(args, "--api-url") || process.env.KURUMERA_API_URL || readConfig().apiUrl || DEFAULT_API_URL;
  const scopesFlag = flag(args, "--scopes");
  const scopes = scopesFlag ? scopesFlag.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  const onSigint = () => {
    console.log("\nCancelled.");
    process.exit(130);
  };
  process.once("SIGINT", onSigint);

  let result: Awaited<ReturnType<typeof deviceLogin>>;
  try {
    result = await deviceLogin(apiUrl, scopes);
  } catch (e) {
    console.error(`\nLogin failed: ${(e as Error).message}`);
    return 1;
  } finally {
    process.off("SIGINT", onSigint);
  }

  const cfg = readConfig();
  cfg.auth = {
    type: "device",
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
    scopes: result.scopes,
  };
  if (flag(args, "--api-url")) cfg.apiUrl = apiUrl;
  writeConfig(cfg);

  console.log("\n✓ Logged in (device flow).");
  console.log(`  Saved to ${CONFIG_PATH}`);
  console.log(`  Scopes: ${result.scopes.join(", ") || "(default)"}`);
  console.log("  Next: kurumera theme push --store <slug>");
  return 0;
}

/** The original browser authorize flow (loopback) — UNCHANGED. */
async function loginBrowser(args: string[]): Promise<number> {
  const state = randomBytes(16).toString("hex");

  const result = await new Promise<{ token?: string; refresh?: string; store?: string; error?: string }>((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url || "/", "http://127.0.0.1");
      if (u.pathname !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      const done = (html: string, out: { token?: string; refresh?: string; store?: string; error?: string }) => {
        res.end(`<!doctype html><meta charset=utf-8><title>Kurumera CLI</title><body style="font-family:system-ui;text-align:center;padding:64px">${html}</body>`);
        server.close();
        resolve(out);
      };
      if ((u.searchParams.get("state") || "") !== state) {
        return done("<h1>Login failed</h1><p>Security check (state) did not match. Please run <code>kurumera login</code> again.</p>", { error: "state mismatch" });
      }
      const token = u.searchParams.get("token") || "";
      if (!token) return done("<h1>Login failed</h1><p>No session was returned.</p>", { error: "no token" });
      done(
        "<h1>✓ You're signed in</h1><p>Kurumera CLI is authorized. You can close this tab and return to your terminal.</p>",
        { token, refresh: u.searchParams.get("refresh") || undefined, store: u.searchParams.get("tenant") || undefined },
      );
    });

    server.on("error", (e) => resolve({ error: e.message }));
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const url = `${DASHBOARD}/cli-auth?port=${port}&state=${state}`;
      console.log("Opening your browser to sign in…");
      console.log(`  If it doesn't open, paste this into your browser:\n  ${url}\n`);
      openBrowser(url);
      console.log("Waiting for you to authorize…");
    });

    setTimeout(() => { try { server.close(); } catch { /* */ } resolve({ error: "timed out after 5 min" }); }, 300_000);
  });

  if (result.error || !result.token) {
    console.error(`\nLogin failed: ${result.error || "no session received"}.`);
    return 1;
  }

  const cfg = readConfig();
  cfg.authToken = result.token;
  if (result.refresh) cfg.refresh = result.refresh;
  if (result.store) cfg.defaultStore = result.store;
  const apiUrl = flag(args, "--api-url");
  if (apiUrl) cfg.apiUrl = apiUrl;
  writeConfig(cfg);
  console.log(`\n✓ Logged in${result.store ? ` — store: ${result.store}` : ""}.`);
  console.log(`  Saved to ${CONFIG_PATH}`);
  console.log(`  Next: kurumera theme dev${result.store ? ` --store ${result.store}` : " --store <slug>"}`);
  return 0;
}

/** Explicit storefront-token save (scriptable / non-interactive). */
function saveManual(token: string, store?: string, apiUrl?: string): number {
  if (!token.startsWith("ksf_")) {
    console.error("--token expects a storefront token (a `ksf_…` value).");
    return 1;
  }
  const cfg = readConfig();
  if (apiUrl) cfg.apiUrl = apiUrl;
  if (store) {
    cfg.stores = { ...cfg.stores, [store]: token };
    console.log(`✓ Saved storefront token for "${store}".`);
  } else {
    cfg.token = token;
    console.log("✓ Saved default storefront token.");
  }
  writeConfig(cfg);
  console.log(`  (${CONFIG_PATH})`);
  return 0;
}
