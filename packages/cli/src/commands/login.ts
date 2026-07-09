import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readConfig, writeConfig, CONFIG_PATH } from "../util/config.js";
import { flag } from "../util/fs.js";

/** The Kurumera dashboard that hosts the authorize page (kurumera.com). */
const DASHBOARD = (process.env.KURUMERA_DASHBOARD || "https://kurumera.com").replace(/\/+$/, "");

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
 * `kurumera login` — browser authorize flow (device/loopback).
 *
 * Opens the Kurumera dashboard, where the developer signs in and authorizes this
 * machine; the dashboard redirects back to a one-shot loopback server with the
 * session, which we save to ~/.kurumera/config.json. No token pasting.
 *
 * `--token ksf_…` still works as an explicit, scriptable override.
 */
export async function login(args: string[]): Promise<number> {
  const manual = flag(args, "--token");
  if (manual) return saveManual(manual, flag(args, "--store"), flag(args, "--api-url"));

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
