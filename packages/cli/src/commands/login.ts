import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readConfig, writeConfig, CONFIG_PATH } from "../util/config.js";
import { flag } from "../util/fs.js";
import { detectRemoteEnvironment } from "../util/environment.js";
import { startDeviceAuthorization, exchangeDeviceCode } from "../util/deviceAuth.js";
import { resolveAuthUrl } from "../util/authUrl.js";
import { readPendingDeviceAuth, writePendingDeviceAuth, clearPendingDeviceAuth, isPendingExpired } from "../util/pendingDeviceAuth.js";
import { isKeychainAvailable, saveToKeychain } from "../util/keychain.js";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `kurumera login` — sign in.
 *
 *   kurumera login                    Auto-detect: loopback browser flow on a
 *                                      normal dev machine, resumable device
 *                                      flow when the environment looks remote/
 *                                      headless (SSH, CI, container, no TTY,
 *                                      hosted AI agent — see util/environment.ts).
 *   kurumera login --browser          Force the local-loopback flow (UNCHANGED,
 *                                      original behavior — CLI and browser MUST
 *                                      share a network, e.g. localhost). This
 *                                      is exactly what a local developer's
 *                                      terminal has always used; nothing about
 *                                      it changed in this file.
 *   kurumera login --device           Remote-safe device flow. With no
 *                                      further flag this resumes an existing
 *                                      still-valid pending authorization
 *                                      (--complete) or starts a new one
 *                                      (--start) — see the three explicit
 *                                      sub-modes below.
 *   kurumera login --device --start    Begin a device authorization, print the
 *                                      URL + code, save it to
 *                                      ~/.kurumera/pending-device-auth.json,
 *                                      and EXIT IMMEDIATELY — no polling. Safe
 *                                      for hosted agent sandboxes that don't
 *                                      keep a process alive/networked between
 *                                      tool calls.
 *   kurumera login --device --complete Make ONE attempt to exchange a
 *                                      previously-started pending
 *                                      authorization for a session — safe to
 *                                      run from a completely different
 *                                      process, possibly much later.
 *   kurumera login --device --wait     The original single-process flow: start,
 *                                      print/open the link, then poll THIS
 *                                      process until approved/denied/expired.
 *                                      Preserved for environments where a
 *                                      long-running foreground process is
 *                                      genuinely fine.
 *   kurumera login --auth-url <url>    Override the public device-auth origin
 *                                      (default https://kurumera.com/api/v1).
 *                                      Never inherits the commerce --api-url/
 *                                      saved config apiUrl — see util/authUrl.ts.
 *   kurumera login --token ksf_…       Explicit storefront-token override (unchanged).
 *
 * The device flow is purely ADDITIVE — see util/deviceAuth.ts,
 * util/pendingDeviceAuth.ts, util/resolveAuthToken.ts. `loginBrowser` and
 * `saveManual` below are UNCHANGED from before this feature existed.
 */
export async function login(args: string[]): Promise<number> {
  const manual = flag(args, "--token");
  if (manual) return saveManual(manual, flag(args, "--store"), flag(args, "--api-url"));

  if (args.includes("--device")) {
    if (args.includes("--start")) return loginDeviceStart(args);
    if (args.includes("--complete")) return loginDeviceComplete();
    if (args.includes("--wait")) return loginDeviceWait(args);
    return loginDeviceAuto(args);
  }
  if (!args.includes("--browser") && detectRemoteEnvironment().isRemote) return loginDeviceAuto(args);
  return loginBrowser(args);
}

/**
 * No explicit start/complete/wait flag: resume an existing, still-valid
 * pending authorization if one exists, otherwise start a new one. This is
 * what bare `--device` AND remote-environment auto-detection both use — the
 * resumable flow is the default remote-safe path now (see `--wait` for the
 * old single-process loop).
 */
async function loginDeviceAuto(args: string[]): Promise<number> {
  const pending = readPendingDeviceAuth();
  if (pending && !isPendingExpired(pending)) return loginDeviceComplete();
  return loginDeviceStart(args);
}

function deviceScopesFrom(args: string[]): string[] | undefined {
  const scopesFlag = flag(args, "--scopes");
  return scopesFlag ? scopesFlag.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
}

/** Auth calls resolve to the public kurumera.com origin by default — NEVER
 *  the saved commerce `cfg.apiUrl` (admin.kurumera.com) — so this works from
 *  hosted AI-agent sandboxes that only allow egress to the domain the user
 *  actually connected them to. `--auth-url` / `KURUMERA_AUTH_URL` override;
 *  see util/authUrl.ts. `--api-url` is deliberately NOT read here — that flag
 *  is for the commerce/storefront base URL, a different concern. */
function deviceAuthUrlFrom(args: string[]): string {
  return resolveAuthUrl(flag(args, "--auth-url"));
}

function saveDeviceSession(result: { accessToken: string; refreshToken?: string; expiresAt: number; scopes: string[] }): void {
  const cfg = readConfig();
  cfg.auth = {
    type: "device",
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
    scopes: result.scopes,
  };
  writeConfig(cfg);
}

/**
 * `kurumera login --device --start` — begins a device authorization, saves
 * it to ~/.kurumera/pending-device-auth.json, and exits immediately. No
 * polling, no held-open connection — safe for hosted agent environments that
 * terminate or restrict network access between tool calls. Complete it later
 * (possibly from a completely different process) with `--complete`.
 */
async function loginDeviceStart(args: string[]): Promise<number> {
  const apiUrl = deviceAuthUrlFrom(args);
  const scopes = deviceScopesFrom(args);

  let start;
  try {
    start = await startDeviceAuthorization(apiUrl, scopes);
  } catch (e) {
    console.error(`Could not start device authorization: ${(e as Error).message}`);
    return 1;
  }

  // Safely REPLACES any prior pending authorization (expired or not) —
  // starting again is always safe; writePendingDeviceAuth's write is atomic.
  writePendingDeviceAuth({
    deviceCode: start.deviceCode,
    codeVerifier: start.codeVerifier,
    tokenEndpoint: `${apiUrl.replace(/\/+$/, "")}/cli/device/token/`,
    verificationUri: start.verificationUri,
    expiresAt: Date.now() + start.expiresIn * 1000,
    interval: start.interval,
    createdAt: Date.now(),
  });

  console.log("Open this URL in any browser:\n");
  console.log(`  ${start.verificationUriComplete || start.verificationUri}\n`);
  console.log(`Code: ${start.userCode}\n`);
  console.log("Authorization started successfully.\n");
  console.log("After approving access, run:\n");
  console.log("  kurumera login --device --complete");
  return 0;
}

/**
 * `kurumera login --device --complete` — one attempt to exchange a
 * previously-started, still-pending device authorization for a session.
 * Safe to call from a brand-new process: everything it needs (device code,
 * PKCE verifier, token endpoint) was already persisted by `--start`.
 */
async function loginDeviceComplete(): Promise<number> {
  const pending = readPendingDeviceAuth();
  if (!pending) {
    console.log("No pending device authorization was found.\n");
    console.log("Start one with:\n");
    console.log("  kurumera login --device --start");
    return 1;
  }
  if (isPendingExpired(pending)) {
    clearPendingDeviceAuth();
    console.log("This device authorization has expired.\n");
    console.log("Start again with:\n");
    console.log("  kurumera login --device --start");
    return 1;
  }

  let result;
  try {
    result = await exchangeDeviceCode(pending.tokenEndpoint, pending.deviceCode, pending.codeVerifier);
  } catch (e) {
    // A transport failure, not a protocol rejection — the code itself is
    // still valid and unconsumed, only this attempt to reach the server
    // failed. Keep the pending state so a retry can succeed.
    console.error(`Could not reach the authorization server: ${(e as Error).message}`);
    console.error("Try again with: kurumera login --device --complete");
    return 1;
  }

  if (!result.ok) {
    const { error, errorDescription } = result.error;
    if (error === "authorization_pending") {
      console.log("Authorization is still pending.\n");
      console.log("Approve the request in your browser, then run:\n");
      console.log("  kurumera login --device --complete");
      return 1;
    }
    if (error === "slow_down") {
      console.log("The authorization server requested a slower retry.\n");
      console.log("Wait 5 seconds, then run:\n");
      console.log("  kurumera login --device --complete");
      return 1;
    }
    if (error === "access_denied") {
      clearPendingDeviceAuth();
      console.log("Authorization was denied. Start a new login with:\n");
      console.log("  kurumera login --device --start");
      return 1;
    }
    if (error === "expired_token") {
      clearPendingDeviceAuth();
      console.log("This device authorization has expired.\n");
      console.log("Start again with:\n");
      console.log("  kurumera login --device --start");
      return 1;
    }
    // invalid_grant (PKCE mismatch, a consumed/unknown device_code) or
    // anything else unrecoverable — this pending state can never succeed.
    clearPendingDeviceAuth();
    console.error(`Device authorization failed: ${errorDescription || error}`);
    return 1;
  }

  saveDeviceSession(result.result);
  clearPendingDeviceAuth();

  console.log("✓ Device authorization completed");
  console.log("✓ CLI session saved securely");
  console.log(`✓ Scopes: ${result.result.scopes.join(", ") || "(default)"}\n`);
  console.log(`Saved to: ${CONFIG_PATH}`);
  console.log(
    "If this environment's whole workspace gets destroyed and rebuilt between\n" +
    "runs (not just between tool calls) — a fresh container with no volume for\n" +
    "the path above — this saved session won't survive that either, and you'll\n" +
    "be back here re-authorizing every time. Two ways to make it durable:\n" +
    "  1. Mount a persistent volume at that path (or point KURUMERA_CONFIG_DIR\n" +
    "     at one you control), so this file survives a rebuild, or\n" +
    "  2. For a fully stateless agent, skip the device flow entirely and use a\n" +
    "     standing token instead: Settings → CLI tokens in the dashboard, then\n" +
    "     set KURUMERA_CLI_TOKEN — it's injected fresh each run, nothing to persist.\n",
  );
  console.log("Next:\n");
  console.log("  kurumera theme push --store <slug>");
  return 0;
}

/**
 * `kurumera login --device --wait` — the original single-process device
 * flow: start, print/open the link, then poll THIS SAME process until the
 * human approves it (or it's denied/expires). Preserved for environments
 * where a long-running foreground process is genuinely fine; prefer
 * `--start`/`--complete` in a hosted agent sandbox that may not keep this
 * process alive (or networked) between tool calls.
 */
async function loginDeviceWait(args: string[]): Promise<number> {
  const apiUrl = deviceAuthUrlFrom(args);
  const scopes = deviceScopesFrom(args);

  const onSigint = () => {
    console.log("\nCancelled.");
    process.exit(130);
  };
  process.once("SIGINT", onSigint);

  try {
    const start = await startDeviceAuthorization(apiUrl, scopes);

    console.log("To sign in, open this link (on this machine or any other device):\n");
    console.log(`  ${start.verificationUriComplete || start.verificationUri}\n`);
    console.log(`Or go to ${start.verificationUri} and enter this code: ${start.userCode}\n`);
    if (start.verificationUriComplete) openBrowser(start.verificationUriComplete);
    console.log("Waiting for you to authorize this device…");

    const tokenEndpoint = `${apiUrl.replace(/\/+$/, "")}/cli/device/token/`;
    let interval = start.interval;
    const deadline = Date.now() + start.expiresIn * 1000;

    while (Date.now() < deadline) {
      await sleep(interval * 1000);
      const result = await exchangeDeviceCode(tokenEndpoint, start.deviceCode, start.codeVerifier);

      if (result.ok) {
        saveDeviceSession(result.result);
        console.log("\n✓ Logged in (device flow).");
        console.log(`  Saved to ${CONFIG_PATH}`);
        console.log(`  Scopes: ${result.result.scopes.join(", ") || "(default)"}`);
        console.log("  Next: kurumera theme push --store <slug>");
        return 0;
      }
      if (result.error.error === "authorization_pending") continue;
      if (result.error.error === "slow_down") { interval += 5; continue; }
      console.error(`\nLogin failed: ${result.error.errorDescription || result.error.error}`);
      return 1;
    }
    console.error("\nLogin failed: Timed out waiting for authorization — run `kurumera login --device --wait` again.");
    return 1;
  } catch (e) {
    console.error(`\nLogin failed: ${(e as Error).message}`);
    return 1;
  } finally {
    process.off("SIGINT", onSigint);
  }
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
  // Best-effort redundant backup to the OS keychain (local dev machine only
  // — see util/keychain.ts). ~/.kurumera/config.json above is already the
  // complete, authoritative save; this never blocks or affects it.
  if (isKeychainAvailable()) saveToKeychain(result.token);
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
