/**
 * Kurumera theme push/build/host service — per-store, versioned (hardening phase).
 *
 * Runs on the builder box (container kurumera-push, docker.sock mounted). Fixes the
 * single-slot correctness gap: every store gets its OWN versioned build artifacts
 * and its OWN containers, so one store's theme never affects another.
 *
 * Per store <s>:
 *   ROOT/<s>/versions/<vId>/         a built ThemeVersion (source + node_modules + .next)
 *   container kurumera-preview-<s>   serves the LATEST pushed version (store+version-scoped preview)
 *   container kurumera-store-<s>     serves the LIVE published version
 * state.json: { stores: { <s>: { build:{id,status,error}, versions:[vId…], live:vId|null, history:[vId…] } } }
 *
 * Routing:
 *   POST /_push/push       (X-Kurumera-Store: s, body=gzip)  → build version → (re)run kurumera-preview-<s>
 *   GET  /_push/status?store=s                               → that store's build status
 *   POST /_push/publish    {store}    → live = latest version, run kurumera-store-<s>
 *   POST /_push/rollback   {store}    → live = previous version (or unpublish if none)
 *   POST /_push/unpublish  {store}    → live = null, stop kurumera-store-<s> (revert to builder)
 *   GET  /_push/published             → { stores:[s…] } (live code-theme stores — the builder polls this)
 *   *  (anything else)                → PREVIEW proxy: ?store / kurumera_store cookie → kurumera-preview-<s>
 *
 * MVP limits (documented): light auth (Bearer presence); runs third-party build
 * output unsandboxed — fine internal, not hardened for untrusted public themes.
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, renameSync, rmSync, existsSync } from "node:fs";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 9200);
const ROOT = "/home/ubuntu/theme-pushes";
const STATE = join(ROOT, "state.json");

// Control plane: mirror every state change into the Django backend (source of
// truth). Best-effort — a backend hiccup must never break a build or publish.
const CONTROL_URL = (process.env.KURUMERA_CONTROL_URL || "https://admin.kurumera.com/api/v1/themes/control").replace(/\/+$/, "");
const SERVICE_KEY = process.env.KURUMERA_SERVICE_KEY || "";
// Ownership authz lives next to the control API (…/themes/authz). The backend,
// not this service, decides whether a developer may mutate a store.
const AUTHZ_URL = CONTROL_URL.replace(/\/control$/, "/authz");
// This host's identity in the multi-host registry. Each host heartbeats the
// control plane and stamps the stores it runs, so the platform knows which hosts
// are alive and (later) can fail a dead host's stores over to a live one.
const HOST_NAME = process.env.KURUMERA_HOST_NAME || "host-1";
const MARKET = join(ROOT, "_market");            // shared theme registry (published built artifacts)
const MARKET_STATE = join(ROOT, "market.json");  // { themes: { <slug>: { name, description, author, latest, versions:[{version,id,published,installs}] } } }
const API_URL = "https://admin.kurumera.com/api/v1";
const NET = "website-builder_web";

mkdirSync(ROOT, { recursive: true });
mkdirSync(MARKET, { recursive: true });

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
const storeDir = (s) => join(ROOT, slug(s));
const versionDir = (s, v) => join(storeDir(s), "versions", v);
const previewName = (s) => `kurumera-preview-${slug(s)}`;
const liveName = (s) => `kurumera-store-${slug(s)}`;
// A published marketplace theme's immutable built artifact.
const marketDir = (theme, version) => join(MARKET, slug(theme), String(version).replace(/[^a-zA-Z0-9._-]/g, ""));
// A marketplace theme's own preview container (renders the theme against a demo
// store so shoppers can see it live before installing).
const marketName = (theme) => `kurumera-market-${slug(theme)}`;
const DEMO_STORE = slug(process.env.KURUMERA_DEMO_STORE || "luxe-commerece");

// Atomic JSON write: serialize to a temp file, then rename(2) over the target.
// rename is atomic on the same filesystem, so a crash or overlapping write can
// never leave a half-written (corrupt) state/market/license file — the failure
// mode that would otherwise silently turn every paid theme free or wipe licenses.
function writeJson(file, obj) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj));
  renameSync(tmp, file);
}

// Best-effort per-client rate limiting (defense-in-depth for the unauthenticated
// license-check surface). Client IP via X-Forwarded-For, which Caddy/Cloudflare set.
const _rate = new Map();
function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  return (xff ? String(xff).split(",")[0].trim() : req.socket?.remoteAddress) || "unknown";
}
function rateLimited(key, max = 40, windowMs = 60_000) {
  const now = Date.now();
  if (_rate.size > 10_000) _rate.clear();   // crude cap so the map can't grow unbounded
  let r = _rate.get(key);
  if (!r || now > r.resetAt) { r = { count: 0, resetAt: now + windowMs }; _rate.set(key, r); }
  return ++r.count > max;
}

function getState() {
  try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return { stores: {} }; }
}
function setState(st) { writeJson(STATE, st); }
function store(st, s) { return (st.stores[slug(s)] ||= { build: { status: "idle" }, versions: [], live: null, history: [] }); }

// ── Sandbox ──────────────────────────────────────────────────────────────────
// Theme code is UNTRUSTED — it runs at build time (npm install postinstall +
// next build) and at runtime (SSR on every request). Every container that runs
// theme code does so unprivileged, with all Linux capabilities dropped, no
// privilege escalation, capped memory/cpu/pids, and a read-only root fs (only the
// /app mount + a tmpfs are writable). Builds additionally run on an ISOLATED
// network with no route to internal services (backend, push-service, other
// stores) and a hard timeout, so hostile build code can't pivot or hang the box.
const SANDBOX_UID = "1000:1000";                    // node:20-alpine's `node` user
const HARDEN = ["--user", SANDBOX_UID, "--cap-drop", "ALL", "--security-opt", "no-new-privileges"];
const BUILD_NET = process.env.KURUMERA_BUILD_NET || "kurumera-build";  // isolated: internet egress, no internal lateral
const BUILD_LIMITS = ["--memory", "2g", "--memory-swap", "2g", "--cpus", "2", "--pids-limit", "1024"];
const RUN_LIMITS = ["--memory", "1g", "--memory-swap", "1g", "--cpus", "1", "--pids-limit", "256"];
const BUILD_TIMEOUT_MS = 10 * 60 * 1000;

function sh(cmd, args, opts = {}) {
  const { timeoutMs = 0, killContainer = "" } = opts;
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", timer = null;
    if (timeoutMs > 0) timer = setTimeout(() => {
      out += `\n[killed: exceeded ${Math.round(timeoutMs / 1000)}s timeout]`;
      if (killContainer) spawn("docker", ["rm", "-f", killContainer]);   // stop the runaway build
      p.kill("SIGKILL");
    }, timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => { if (timer) clearTimeout(timer); resolve({ code, out }); });
    p.on("error", (e) => { if (timer) clearTimeout(timer); resolve({ code: 1, out: String(e) }); });
  });
}
function runContainer(name, dir) {
  return sh("docker", [
    "run", "-d", "--name", name, "--restart", "unless-stopped", "--network", NET,
    ...HARDEN, ...RUN_LIMITS,
    "--read-only", "--tmpfs", "/tmp:size=256m",
    "-v", `${dir}:/app`, "-w", "/app", "-e", "HOME=/app",
    "-e", `KURUMERA_API_URL=${API_URL}`, "-e", "KURUMERA_ROOT_DOMAIN=kurumera.com",
    "node:20-alpine", "sh", "-c", "node_modules/.bin/next start -p 3000",
  ]);
}

// Read theme identity (name/version) from the extracted source's theme.config,
// so the DB records the real theme@semver — not the internal build id.
function readManifest(dir) {
  const f = ["theme.config.ts", "theme.config.js"].map((n) => join(dir, n)).find((p) => existsSync(p));
  if (!f) return {};
  let src = "";
  try { src = readFileSync(f, "utf8"); } catch { return {}; }
  const pick = (k) => { const m = src.match(new RegExp(`\\b${k}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`)); return m ? m[1] : ""; };
  return { name: pick("name"), version: pick("version"), description: pick("description") };
}

// Marketplace listing metadata from an artifact's theme.config (typed
// `marketplace: {…}` block, or comment lines the regex still reads).
function readMarketMeta(dir) {
  const f = ["theme.config.ts", "theme.config.js"].map((n) => join(dir, n)).find((p) => existsSync(p));
  if (!f) return {};
  let src = ""; try { src = readFileSync(f, "utf8"); } catch { return {}; }
  const str = (k) => { const m = src.match(new RegExp(`\\b${k}\\s*:\\s*["'\`]([^"'\`]+)`)); return m ? m[1] : undefined; };
  const num = (k) => { const m = src.match(new RegExp(`\\b${k}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`)); return m ? Number(m[1]) : undefined; };
  const arr = (k) => { const m = src.match(new RegExp(`\\b${k}\\s*:\\s*\\[([^\\]]*)\\]`)); return m ? m[1].split(",").map((x) => x.replace(/["'\`\s]/g, "")).filter(Boolean) : undefined; };
  return {
    description: str("description"), author: str("author"),
    price: num("price"), currency: str("currency"),
    category: str("category"), demoStore: str("demoStore"), tags: arr("tags"),
  };
}

// ── Purchases / licenses ─────────────────────────────────────────────────────
// A paid theme needs a license key (issued after a completed Stripe payment) to
// install or clone. Free themes (no price) are unrestricted.
const LICENSE_STATE = join(ROOT, "licenses.json");
// Stripe secret: env var, else a root-only file on the data mount (so the key
// isn't baked into the container run command — a plain restart activates it).
const STRIPE_SECRET = process.env.KURUMERA_STRIPE_SECRET || (() => {
  try { return readFileSync(join(ROOT, ".stripe-secret"), "utf8").trim(); } catch { return ""; }
})();
const MARKET_PUBLIC_URL = (process.env.KURUMERA_MARKET_URL || "https://themekit.kurumera.com").replace(/\/+$/, "");
// The public marketplace web app — Stripe success/cancel land here (branded), and
// the app renders the license from /market/license?session_id=.
const MARKET_APP_URL = (process.env.KURUMERA_MARKET_APP_URL || "https://marketplace.kurumera.com").replace(/\/+$/, "");
// Stripe webhook signing secret (whsec_…). When set, /market/webhook becomes the
// source of truth for issuance (survives a closed tab) + refund/dispute revocation.
// Absent ⇒ the webhook endpoint is disabled (returns 400), so it's safe to ship inert.
const STRIPE_WEBHOOK_SECRET = process.env.KURUMERA_STRIPE_WEBHOOK_SECRET || (() => {
  try { return readFileSync(join(ROOT, ".stripe-webhook-secret"), "utf8").trim(); } catch { return ""; }
})();
// Fail SAFE: a corrupt/unreadable licenses.json must not silently erase every
// buyer's entitlement, so fall back to the last good copy when the file exists.
let _licenseCache = null;
function getLicenses() {
  try { _licenseCache = JSON.parse(readFileSync(LICENSE_STATE, "utf8")); return _licenseCache; }
  catch (e) {
    if (existsSync(LICENSE_STATE) && _licenseCache) { console.error(`licenses.json unreadable, using cache: ${e?.message}`); return _licenseCache; }
    return { keys: {} };
  }
}
function setLicenses(l) { _licenseCache = l; writeJson(LICENSE_STATE, l); }
function themePrice(theme) { const e = getMarket().themes[slug(theme)]; return e && Number(e.price) > 0 ? { price: Number(e.price), currency: e.currency || "USD" } : null; }
function issueLicense(theme, email, session, pi) {
  const l = getLicenses();
  // Cryptographically-random, non-guessable suffix (was Math.random — a weak PRNG
  // whose output is recoverable and enumerable via the /owns oracle).
  const rand = randomBytes(16).toString("base64url").replace(/[-_]/g, "").toUpperCase().slice(0, 14);
  const key = `KURU-${slug(theme).toUpperCase().replace(/-/g, "").slice(0, 6)}-${rand}`;
  // `pi` (Stripe payment_intent) lets a later refund/dispute webhook find + revoke.
  l.keys[key] = { theme: slug(theme), email: email || "", session: session || "", pi: pi || "", created: Date.now() };
  setLicenses(l);
  return key;
}
function licenseValid(key, theme) {
  if (!key) return false;
  const rec = getLicenses().keys[String(key).trim()];
  return !!rec && rec.theme === slug(theme) && !rec.revoked;
}
/** Revoke every license matching a predicate (e.g. by Stripe session or payment_intent). */
function revokeLicenses(match, reason) {
  const l = getLicenses();
  let n = 0;
  for (const r of Object.values(l.keys)) {
    if (!r.revoked && match(r)) { r.revoked = Date.now(); r.revokedReason = reason || "revoked"; n++; }
  }
  if (n) setLicenses(l);
  return n;
}
/** Idempotent issuance for a paid Stripe session — reuse an existing key if any. */
function licenseForSession(theme, email, session, pi) {
  const prior = Object.entries(getLicenses().keys).find(([, r]) => r.session === session);
  return prior ? prior[0] : issueLicense(theme, email, session, pi);
}
/** Free themes are always owned; paid themes need a valid license. */
function ownsTheme(theme, license) { return !themePrice(theme) || licenseValid(license, theme); }

// ── Stripe (platform account — collects theme purchases) ─────────────────────
// Minimal REST calls (form-encoded), no SDK. Activated by KURUMERA_STRIPE_SECRET
// (sk_test_… works with Stripe test cards). Absent ⇒ purchasing is disabled.

// Currencies a creator may price in — validated so a bogus code can't be saved
// and then silently break every buyer's checkout later.
const CURRENCIES = new Set(["USD", "EUR", "GBP", "PKR", "INR", "AED", "SAR", "AUD", "CAD", "SGD", "JPY", "KRW"]);
// Stripe zero-decimal currencies take the amount as-is (no ×100). Charging JPY 100
// as 10000 would be a 100× overcharge.
const STRIPE_ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "BIF", "DJF", "GNF", "KMF", "MGA", "PYG", "RWF", "UGX", "VUV", "XAF", "XOF", "XPF"]);
function stripeAmount(price, currency) {
  return STRIPE_ZERO_DECIMAL.has(String(currency).toUpperCase()) ? Math.round(price) : Math.round(price * 100);
}

function stripeForm(obj, prefix = "") {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object") parts.push(stripeForm(v, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}
async function stripe(path, method, body) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_SECRET}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? stripeForm(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `stripe ${r.status}`);
  return d;
}
// Verify a Stripe webhook signature (t=…,v1=… → HMAC-SHA256 of `${t}.${rawBody}`).
function verifyStripeSig(rawBody, sigHeader) {
  if (!STRIPE_WEBHOOK_SECRET || !sigHeader) return false;
  const parts = Object.fromEntries(String(sigHeader).split(",").map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${rawBody}`).digest("hex");
  try {
    const a = Buffer.from(parts.v1), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}
async function createCheckout(theme, email) {
  const p = themePrice(theme);
  if (!p) return { ok: false, error: "this theme is free — no purchase needed" };
  if (!STRIPE_SECRET) return { ok: false, error: "purchasing isn't enabled yet (the platform owner must connect Stripe)" };
  const e = getMarket().themes[slug(theme)];
  const session = await stripe("/checkout/sessions", "POST", {
    mode: "payment",
    success_url: `${MARKET_APP_URL}/purchase/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${MARKET_APP_URL}/purchase/cancel?theme=${encodeURIComponent(slug(theme))}`,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": (p.currency || "USD").toLowerCase(),
    "line_items[0][price_data][unit_amount]": stripeAmount(p.price, p.currency || "USD"),
    "line_items[0][price_data][product_data][name]": `${e.name || theme} theme`,
    "metadata[theme]": slug(theme),
    ...(email ? { customer_email: email } : {}),
  });
  return { ok: true, url: session.url, id: session.id };
}
function licenseHtml(theme, key) {
  return `<!doctype html><meta charset=utf-8><title>Purchase complete</title>`
    + `<body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px;color:#16211E">`
    + `<h1 style="font-size:1.5rem">✓ You now own “${theme}”</h1>`
    + `<p style="color:#586964">Keep this license key — you'll need it to install or clone the theme.</p>`
    + `<pre style="background:#0E1512;color:#37D3BE;padding:14px 16px;border-radius:8px;overflow:auto">${key}</pre>`
    + `<h3 style="margin-top:24px">Install it</h3>`
    + `<pre style="background:#0E1512;color:#D7E0DC;padding:14px 16px;border-radius:8px;overflow:auto">kurumera marketplace install ${theme} --store &lt;your-store&gt; --license ${key}</pre>`
    + `<p><a href="/marketplace">← Back to the marketplace</a></p></body>`;
}

// Fire-and-forget POST to the control plane. Never throws.
async function control(path, body) {
  if (!SERVICE_KEY) return; // fail closed: no key ⇒ don't attempt (backend rejects anyway)
  try {
    const res = await fetch(`${CONTROL_URL}/${path}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kurumera-Service": SERVICE_KEY },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`control ${path} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (e) { console.error(`control ${path} failed: ${e?.message || e}`); }
}

// Ask the backend whether the developer behind `authHeader` may mutate `store`.
// FAILS CLOSED: any auth failure, unknown store, or backend outage → not allowed.
// Returns { ok, actor?, status?, error? }. `actor` is the developer's email, used
// to attribute the resulting history event.
async function verifyOwnership(authHeader, store) {
  const bearer = authHeader || "";
  if (!bearer.startsWith("Bearer ") || bearer.length < 12) {
    return { ok: false, status: 401, error: "sign in first (kurumera login)" };
  }
  if (!store) return { ok: false, status: 400, error: "no store — pass --store or run `kurumera login`" };
  try {
    const res = await fetch(`${AUTHZ_URL}/?store=${encodeURIComponent(store)}`, { headers: { Authorization: bearer } });
    const d = await res.json().catch(() => ({}));
    if (res.status === 200 && d.authorized) return { ok: true, actor: d.actor };
    if (res.status === 200) return { ok: false, status: 403, error: d.detail || "not authorized for this store" };
    if (res.status === 401) return { ok: false, status: 401, error: "invalid or expired session — run `kurumera login`" };
    if (res.status === 403) return { ok: false, status: 403, error: d.detail || "you do not have access to this store" };
    if (res.status === 404) return { ok: false, status: 404, error: d.detail || `no store "${store}"` };
    return { ok: false, status: 502, error: `ownership check failed (${res.status})` };
  } catch {
    return { ok: false, status: 503, error: "ownership check unavailable — try again shortly" };
  }
}

// Authorize a store mutation from EITHER the trusted backend control plane
// (X-Kurumera-Service key — it already authenticated the merchant and passes the
// acting email in the body) OR a developer CLI (dev JWT, verified for ownership).
async function authorizeMutation(req, store, bodyActor) {
  if (SERVICE_KEY && req.headers["x-kurumera-service"] === SERVICE_KEY) {
    return { ok: true, actor: bodyActor || undefined };
  }
  return verifyOwnership(req.headers["authorization"], store);
}

const building = new Set();

async function buildVersion(s, buffer, actor) {
  s = slug(s);
  building.add(s);
  const v = "v" + Date.now();
  try {
    const st = getState();
    store(st, s).build = { status: "building", id: v };
    setState(st);

    const dir = versionDir(s, v);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const tgz = join(storeDir(s), `${v}.tgz`);
    writeFileSync(tgz, buffer);
    const x = await sh("tar", ["-xzf", tgz, "-C", dir]);
    rmSync(tgz, { force: true });
    if (x.code !== 0) return fail(s, v, "unpack failed");

    // Hand the tree to the sandbox uid so the unprivileged build can write it.
    await sh("chown", ["-R", SANDBOX_UID, dir]);
    const buildName = `kurumera-build-${s}`;
    await sh("docker", ["rm", "-f", buildName]);   // clear any stale build container
    const b = await sh("docker", [
      "run", "--rm", "--name", buildName, "--network", BUILD_NET,
      ...HARDEN, ...BUILD_LIMITS,
      "--read-only", "--tmpfs", "/tmp:size=1g",
      "-e", "HOME=/app", "-e", "npm_config_cache=/app/.npm",
      "-v", `${dir}:/app`, "-w", "/app", "node:20-alpine",
      "sh", "-c", "npm install --no-audit --no-fund && npx next build",
    ], { timeoutMs: BUILD_TIMEOUT_MS, killContainer: buildName });
    try { writeFileSync(join(storeDir(s), "build.log"), b.out); } catch { /* best-effort */ }
    if (b.code !== 0) return fail(s, v, "build failed", b.out.slice(-800));

    // (re)start this store's preview container on the new version
    await sh("docker", ["rm", "-f", previewName(s)]);
    const r = await runContainer(previewName(s), dir);
    if (r.code !== 0) return fail(s, v, "preview host failed", r.out.slice(-800));

    const man = readManifest(dir);
    const themeSlug = slug(man.name || s);
    const semver = man.version || v;

    const st2 = getState();
    const rec = store(st2, s);
    rec.versions.push(v);
    rec.build = { status: "ready", id: v, preview_url: "https://themekit.kurumera.com" };
    (rec.meta ||= {})[v] = { theme: themeSlug, name: man.name || s, version: semver };
    setState(st2);
    pruneVersions(s);   // reclaim disk from superseded builds

    // Mirror into the control plane: record the version + point preview at it.
    await control("version", { theme_slug: themeSlug, theme_name: man.name || s, version: semver, build_status: "success", theme_config: man });
    await control("preview", { store: s, theme_slug: themeSlug, version: semver, actor_email: actor });
  } finally {
    building.delete(s);
  }
}
function fail(s, v, error, log) {
  const st = getState();
  store(st, s).build = { status: "failed", id: v, error, log };
  setState(st);
}

// Bound disk use: after a successful build/install, delete version dirs the store
// no longer needs. Keep the live version, the last few builds (preview + recent
// history), and the rollback target — everything else is safe to remove.
function pruneVersions(s) {
  s = slug(s);
  const st = getState();
  const rec = store(st, s);
  const keep = new Set();
  if (rec.live) keep.add(rec.live);              // mounted by the live container
  rec.versions.slice(-3).forEach((v) => keep.add(v)); // recent builds (latest = preview)
  rec.history.slice(-2).forEach((v) => keep.add(v));  // one-step rollback target
  for (const v of rec.versions) {
    if (!keep.has(v)) { try { rmSync(versionDir(s, v), { recursive: true, force: true }); } catch { /* */ } }
  }
  rec.versions = rec.versions.filter((v) => keep.has(v));
  setState(getMerge(st, s, rec));
}

// Promote store <s> to a live version; run its live container on that version.
async function goLive(s, v) {
  s = slug(s);
  const dir = versionDir(s, v);
  await sh("chown", ["-R", SANDBOX_UID, dir]);   // sandboxed runtime must own its tree (e.g. market-copied artifacts)
  await sh("docker", ["rm", "-f", liveName(s)]);
  const r = await runContainer(liveName(s), dir);
  return r.code === 0;
}

async function publishStore(s, actor) {
  s = slug(s);
  const st = getState();
  const rec = store(st, s);
  const latest = rec.versions[rec.versions.length - 1];
  if (!latest) return { ok: false, error: "push a build first" };
  if (!(await goLive(s, latest))) return { ok: false, error: "host failed" };
  rec.live = latest;
  rec.history.push(latest);
  setState(getMerge(st, s, rec));
  const m = (rec.meta || {})[latest];
  if (m) await control("publish", { store: s, theme_slug: m.theme, version: m.version, actor_email: actor });
  return { ok: true, version: latest };
}

async function rollbackStore(s, actor) {
  s = slug(s);
  const st = getState();
  const rec = store(st, s);
  if (rec.history.length >= 2) {
    rec.history.pop();                                  // drop current
    const prev = rec.history[rec.history.length - 1];   // restore previous
    if (!(await goLive(s, prev))) return { ok: false, error: "host failed" };
    rec.live = prev;
    setState(getMerge(st, s, rec));
    await control("rollback", { store: s, actor_email: actor });  // backend restores its prior live pointer
    return { ok: true, version: prev, reverted: "previous version" };
  }
  // no previous version → fall back to the visual builder
  await unpublishStore(s, actor);
  return { ok: true, reverted: "visual builder" };
}

async function unpublishStore(s, actor) {
  s = slug(s);
  const st = getState();
  const rec = store(st, s);
  rec.live = null;
  rec.history = [];
  setState(getMerge(st, s, rec));
  await sh("docker", ["rm", "-f", liveName(s)]);
  await control("unpublish", { store: s, actor_email: actor });
  return { ok: true };
}
function getMerge(st, s, rec) { st.stores[slug(s)] = rec; return st; }

// ── Reconciliation ───────────────────────────────────────────────────────────
// The DB is the durable source of truth; this loop keeps runtime + DB converged:
//   1. self-heal — if a store should be live but its container isn't running,
//      bring it back up (survives crashes/reboots);
//   2. converge — re-assert each store's real live/preview to the control plane,
//      which idempotently repairs any drift a failed write-through left behind.
async function containerRunning(name) {
  const r = await sh("docker", ["inspect", "-f", "{{.State.Running}}", name]);
  return r.code === 0 && r.out.trim() === "true";
}

let reconciling = false;
async function reconcile() {
  if (reconciling) return { skipped: "already running" };
  reconciling = true;
  const report = { stores: 0, healed: [] };
  try {
    const st = getState();
    for (const s of Object.keys(st.stores)) {
      const rec = st.stores[s];
      report.stores++;
      // 1. self-heal the live container
      if (rec.live && !(await containerRunning(liveName(s)))) {
        const ok = await goLive(s, rec.live);
        report.healed.push({ store: s, restarted: ok });
      }
      // 2. converge the DB with the runtime's real state
      const liveMeta = rec.live ? (rec.meta || {})[rec.live] : null;
      const latest = rec.versions[rec.versions.length - 1];
      const prevMeta = latest ? (rec.meta || {})[latest] : null;
      await control("reconcile", {
        store: s,
        host: HOST_NAME,
        mode: rec.live ? "code" : "builder",
        live: liveMeta ? { theme: liveMeta.theme, theme_name: liveMeta.name, version: liveMeta.version } : null,
        preview: prevMeta ? { theme: prevMeta.theme, theme_name: prevMeta.name, version: prevMeta.version } : null,
      });
    }
  } finally {
    reconciling = false;
  }
  return report;
}

// ── Scale-to-zero ────────────────────────────────────────────────────────────
// A per-store `next start` container costs ~100–200MB, but most stores are idle
// most of the time. So we STOP a store's container after it goes idle and START
// it again on the next request (a ~1–3s cold start), letting one box hold far
// more stores than it could keep hot. Containers are stopped (not removed) so the
// wake is a fast `docker start`, and their restart policy is honoured on reboot.
const IDLE_MS = Number(process.env.KURUMERA_IDLE_MS || 30 * 60 * 1000);   // reap after 30m idle
const WAKE_READY_MS = Number(process.env.KURUMERA_WAKE_READY_MS || 20 * 1000);

// Last-access is kept in memory (hot path — no disk write per request). A boot
// grace period means containers running at startup aren't reaped until they've
// actually been idle for IDLE_MS since boot.
const BOOT_TIME = Date.now();
const access = new Map();   // "<slug>:live" | "<slug>:preview" -> last access ms
function touch(s, kind = "live") { access.set(`${slug(s)}:${kind}`, Date.now()); }
async function containerExists(name) {
  const r = await sh("docker", ["inspect", "-f", "{{.State.Status}}", name]);
  return r.code === 0 ? r.out.trim() : null;   // "running" | "exited" | null(absent)
}
// Poll the container on its REAL serving path (GET /?store=<slug> with the store
// Host) until it returns a non-5xx — i.e. it genuinely resolves the store and
// serves, not just "the port is open". A bare HEAD / has no store and always
// 500s ("No store resolved"), which would falsely look ready on cold start.
function waitReady(name, slug, ms = WAKE_READY_MS) {
  const deadline = Date.now() + ms;
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.request(
        { hostname: name, port: 3000, path: `/?store=${encodeURIComponent(slug)}`, method: "GET", timeout: 3000,
          headers: { host: `${slug}.kurumera.com` } },
        (r) => {
          r.resume();
          if (r.statusCode && r.statusCode < 500) return resolve(true);      // serving for real
          return Date.now() < deadline ? setTimeout(tick, 400) : resolve(false);
        },
      );
      req.on("error", () => (Date.now() < deadline ? setTimeout(tick, 400) : resolve(false)));
      req.on("timeout", () => { req.destroy(); Date.now() < deadline ? setTimeout(tick, 400) : resolve(false); });
      req.end();
    };
    tick();
  });
}
// Ensure a store's live container is running; start (or recreate) it if not.
async function wakeStore(s) {
  s = slug(s);
  const rec = store(getState(), s);
  if (!rec.live) return { status: "no-live" };
  touch(s, "live");
  const name = liveName(s);
  const status = await containerExists(name);
  if (status === "running") return { status: "warm" };
  if (status === "exited" || status === "created") {
    const r = await sh("docker", ["start", name]);
    if (r.code !== 0) await goLive(s, rec.live);       // start failed → recreate
  } else {
    await goLive(s, rec.live);                          // absent → recreate
  }
  const ready = await waitReady(name, s);
  return { status: ready ? "woken" : "starting" };
}
// Same, for a store's preview container (dev-facing, reaped just like live).
async function wakePreview(s) {
  s = slug(s);
  touch(s, "preview");
  const name = previewName(s);
  const status = await containerExists(name);
  if (status === "running") return true;
  if (status === "exited" || status === "created") {
    await sh("docker", ["start", name]);
    return waitReady(name, s);
  }
  return false;   // absent (never built) — nothing to wake
}
// Ensure a marketplace theme's preview container is running — run its latest
// registry artifact on demand (scale-to-zero, reaped like store previews).
function marketDemo(theme) { const e = getMarket().themes[slug(theme)]; return (e && slug(e.demoStore)) || DEMO_STORE; }
async function wakeMarketPreview(theme) {
  theme = slug(theme);
  const e = getMarket().themes[theme];
  if (!e || !e.latest) return false;
  const demo = marketDemo(theme);
  touch(theme, "market");
  const name = marketName(theme);
  const status = await containerExists(name);
  if (status === "running") return true;
  if (status === "exited" || status === "created") {
    await sh("docker", ["start", name]);
    return waitReady(name, demo);
  }
  const dir = marketDir(theme, e.latest);
  if (!existsSync(dir)) return false;
  const r = await runContainer(name, dir);
  if (r.code !== 0) return false;
  return waitReady(name, demo);
}
// Stop containers idle longer than IDLE_MS (scale to zero). Live and preview are
// tracked independently so a hot preview doesn't keep the live container up.
let reaping = false;
async function reap() {
  if (reaping) return;
  reaping = true;
  const stopped = [];
  try {
    const st = getState();
    const now = Date.now();
    for (const s of Object.keys(st.stores)) {
      for (const [kind, name] of [["live", liveName(s)], ["preview", previewName(s)]]) {
        const last = access.get(`${s}:${kind}`) || BOOT_TIME;   // grace: unaccessed-since-boot ⇒ measured from boot
        if (now - last > IDLE_MS && (await containerExists(name)) === "running") {
          await sh("docker", ["stop", "-t", "5", name]);
          stopped.push(name);
        }
      }
    }
    // Marketplace preview containers scale to zero the same way.
    for (const theme of Object.keys(getMarket().themes)) {
      const name = marketName(theme);
      const last = access.get(`${theme}:market`) || BOOT_TIME;
      if (now - last > IDLE_MS && (await containerExists(name)) === "running") {
        await sh("docker", ["stop", "-t", "5", name]);
        stopped.push(name);
      }
    }
  } finally {
    reaping = false;
  }
  if (stopped.length) console.log("reaped (scaled to zero):", JSON.stringify(stopped));
  return stopped;
}

// ── Marketplace ────────────────────────────────────────────────────────────
// A developer publishes a store's latest BUILT version into a shared registry;
// any store can install it (copied into that store's own version history, then
// made live — so installs stay per-store isolated and roll back independently).
// Fail SAFE, not open: if the file exists but momentarily won't parse, return the
// last good in-memory copy rather than an empty market (which would make every
// paid theme read as free/ownable). Only a truly missing file yields empty.
let _marketCache = null;
function getMarket() {
  try { _marketCache = JSON.parse(readFileSync(MARKET_STATE, "utf8")); return _marketCache; }
  catch (e) {
    if (existsSync(MARKET_STATE) && _marketCache) { console.error(`market.json unreadable, using cache: ${e?.message}`); return _marketCache; }
    return { themes: {} };
  }
}
function setMarket(m) { _marketCache = m; writeJson(MARKET_STATE, m); }

function copyDir(src, dest) {
  return sh("sh", ["-c", `rm -rf '${dest}' && mkdir -p '${dest}' && cp -a '${src}/.' '${dest}/'`]);
}

// Publish store <s>'s latest ready build to the registry as <theme>@<version> (immutable).
async function publishToMarket(s, meta) {
  s = slug(s);
  const theme = slug(meta.name || s);
  const version = String(meta.version || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!theme) return { ok: false, error: "theme name required (set `name` in theme.config)" };
  if (!version) return { ok: false, error: "version required (set `version` in theme.config)" };

  const st = getState();
  const rec = store(st, s);
  const latest = rec.versions[rec.versions.length - 1];
  if (!latest) return { ok: false, error: "no build to publish — run `kurumera theme push` first" };
  if (rec.build.status !== "ready") return { ok: false, error: `latest build is "${rec.build.status}", not ready` };

  const dest = marketDir(theme, version);
  const m = getMarket();
  const entry = (m.themes[theme] ||= { name: meta.name || theme, description: "", author: "", latest: null, versions: [] });
  // Ownership lock: once a slug belongs to a store, only THAT store may publish new
  // versions to it. Without this, any store owner could publish `name: "Apotheca"`,
  // reassign sourceStore to themselves, and repoint `latest` at their own artifact
  // — a listing-takeover / supply-chain vector.
  if (entry.sourceStore && slug(entry.sourceStore) !== s) {
    return { ok: false, status: 409, error: `the theme name "${theme}" is already taken by another creator — choose a different \`name\` in theme.config` };
  }
  if (entry.versions.some((v) => v.version === version)) {
    return { ok: false, error: `${theme}@${version} is already published — bump the version in theme.config` };
  }

  const c = await copyDir(versionDir(s, latest), dest);
  if (c.code !== 0) return { ok: false, error: "failed to stage artifact", log: c.out.slice(-400) };

  const md = readMarketMeta(versionDir(s, latest));   // richer listing meta from the artifact's theme.config
  entry.sourceStore = s;   // who owns this listing → gates creator-dashboard edits
  entry.name = meta.name || entry.name;
  if (meta.description || md.description) entry.description = meta.description || md.description;
  if (meta.author || md.author) entry.author = meta.author || md.author;
  if (md.price != null) entry.price = md.price;
  if (md.currency) entry.currency = md.currency;
  if (md.tags && md.tags.length) entry.tags = md.tags;
  if (md.category) entry.category = md.category;
  if (md.demoStore) entry.demoStore = md.demoStore;
  entry.versions.push({ version, id: latest, published: Date.now(), installs: 0 });
  entry.latest = version;
  setMarket(m);
  return { ok: true, theme, version };
}

// Install <theme>@<version> into store <s>: copy the registry artifact into a new
// per-store version, then make it live. Returns the new store version id.
async function installFromMarket(s, theme, version, actor, license) {
  s = slug(s); theme = slug(theme);
  const m = getMarket();
  const entry = m.themes[theme];
  if (!entry) return { ok: false, error: `no marketplace theme "${theme}"` };
  if (!ownsTheme(theme, license)) {
    return { ok: false, status: 402, error: `"${entry.name || theme}" is a paid theme — buy it, then install with --license <key>` };
  }
  const ver = version && version !== "latest" ? String(version) : entry.latest;
  const found = entry.versions.find((v) => v.version === ver);
  if (!found) return { ok: false, error: `${theme}@${ver} not found` };

  const src = marketDir(theme, ver);
  const newV = "v" + Date.now();
  const dest = versionDir(s, newV);
  const c = await copyDir(src, dest);
  if (c.code !== 0) return { ok: false, error: "failed to copy artifact", log: c.out.slice(-400) };

  const st = getState();
  const rec = store(st, s);
  rec.versions.push(newV);
  rec.build = { status: "ready", id: newV, source: `${theme}@${ver}` };
  (rec.meta ||= {})[newV] = { theme, name: entry.name || theme, version: ver };
  setState(getMerge(st, s, rec));

  if (!(await goLive(s, newV))) return { ok: false, error: "host failed" };
  const st2 = getState();
  const rec2 = store(st2, s);
  rec2.live = newV;
  rec2.history.push(newV);
  setState(getMerge(st2, s, rec2));

  found.installs = (found.installs || 0) + 1;
  setMarket(m);
  pruneVersions(s);   // reclaim disk from superseded store versions
  // Ensure the version record exists in the DB, then mark it live as an install.
  await control("version", { theme_slug: theme, theme_name: entry.name || theme, version: ver, build_status: "success" });
  await control("install", { store: s, theme_slug: theme, version: ver, actor_email: actor });
  return { ok: true, store: s, theme, version: ver, storeVersion: newV };
}

function marketListing() {
  const m = getMarket();
  return Object.entries(m.themes).map(([themeSlug, e]) => ({
    slug: themeSlug, name: e.name, description: e.description, author: e.author,
    latest: e.latest, versions: e.versions.map((v) => v.version),
    installs: e.versions.reduce((n, v) => n + (v.installs || 0), 0),
    price: Number(e.price) > 0 ? Number(e.price) : 0,
    currency: e.currency || "USD",
    tags: e.tags || [], category: e.category || "", demoStore: e.demoStore || "",
  }));
}

function livePublishedStores() {
  const st = getState();
  return Object.entries(st.stores).filter(([, r]) => r.live).map(([s]) => s);
}
function cookieStore(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)kurumera_store=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
function cookieMarket(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)kurumera_market=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
// A theme preview's /_next/* asset requests carry no ?market, but their Referer
// is the previewing page (…/?market=<theme>) — a cookie-free stickiness signal.
function marketFromReferer(req) {
  const m = (req.headers.referer || "").match(/[?&]market=([a-z0-9-]+)/i);
  return m ? slug(m[1]) : "";
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://x");
  const p = u.pathname;
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  const readBody = () => new Promise((resolve) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => resolve(Buffer.concat(c))); });

  // ── Public developer guide (served from the mounted /ops dir) ────────────────
  if (p === "/guide" || p === "/guide/") {
    try {
      const html = readFileSync(join(import.meta.dirname, "guide.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
      return res.end(html);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("guide not found");
    }
  }

  // ── Public storefront API reference (served from the mounted /ops dir) ───────
  if (p === "/api" || p === "/api/" || p === "/api-reference" || p === "/api-reference/") {
    try {
      const html = readFileSync(join(import.meta.dirname, "api-reference.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" });
      return res.end(html);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("api reference not found");
    }
  }

  // ── Public theme marketplace (browse/preview/install — served from /ops) ─────
  if (p === "/marketplace" || p === "/marketplace/" || p === "/market" || p === "/market/") {
    try {
      const html = readFileSync(join(import.meta.dirname, "marketplace.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=120" });
      return res.end(html);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("marketplace not found");
    }
  }

  // ── API ──────────────────────────────────────────────────────────────────
  if (p.endsWith("/_push/published")) return json(200, { stores: livePublishedStores() });
  if (p.endsWith("/_push/status")) return json(200, store(getState(), u.searchParams.get("store") || "").build);
  if (p.endsWith("/_push/logs")) {
    let log = "";
    try { log = readFileSync(join(storeDir(u.searchParams.get("store") || ""), "build.log"), "utf8"); } catch { /* none */ }
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(log || "No build logs yet — run `kurumera theme push`.");
  }

  // ── Wake (hot path, called by the builder proxy before rewriting) ────────────
  // Public + fast: only starts an already-published store's container, and is a
  // near no-op when warm. Records access so the reaper leaves hot stores alone.
  if (p.endsWith("/_push/wake")) {
    wakeStore(u.searchParams.get("store") || "").then((r) => json(200, r), () => json(200, { status: "error" }));
    return;
  }

  // ── Reconcile (service key only) — heal containers + converge the DB ─────────
  if (p.endsWith("/_push/reconcile")) {
    if (!SERVICE_KEY || req.headers["x-kurumera-service"] !== SERVICE_KEY) return json(403, { error: "service key required" });
    reconcile().then((r) => json(200, r));
    return;
  }

  // ── Marketplace ────────────────────────────────────────────────────────────
  if (p.endsWith("/_push/market") && req.method === "GET") return json(200, { themes: marketListing() });
  if (p.endsWith("/_push/market/info")) {
    const t = slug(u.searchParams.get("theme") || "");
    const e = getMarket().themes[t];
    if (!e) return json(404, { error: `no marketplace theme "${t}"` });
    // Explicit public projection — never spread the raw entry (it holds the internal
    // owner store `sourceStore` and per-version build ids).
    return json(200, {
      slug: t, name: e.name, description: e.description || "", author: e.author || "",
      latest: e.latest, versions: (e.versions || []).map((v) => ({ version: v.version, installs: v.installs || 0 })),
      installs: (e.versions || []).reduce((n, v) => n + (v.installs || 0), 0),
      price: Number(e.price) > 0 ? Number(e.price) : 0, currency: e.currency || "USD",
      tags: e.tags || [], category: e.category || "", demoStore: e.demoStore || "",
    });
  }
  // Does the caller own this theme? (free ⇒ always; paid ⇒ needs a valid license)
  if (p.endsWith("/_push/market/owns")) {
    if (rateLimited(`owns:${clientIp(req)}`)) return json(429, { error: "too many requests — slow down" });
    const t = slug(u.searchParams.get("theme") || "");
    return json(200, { theme: t, paid: !!themePrice(t), owned: ownsTheme(t, u.searchParams.get("license") || "") });
  }
  // A signed-in buyer's purchases — matched to their VERIFIED account email
  // (resolved from the token via store authz; `actor` is the proven email). No
  // email-guessing, so one user can never read another's license keys.
  if (p.endsWith("/_push/market/purchases") && req.method === "GET") {
    const store = slug(u.searchParams.get("store") || "");
    verifyOwnership(req.headers["authorization"], store).then((az) => {
      if (!az.ok) return json(az.status || 403, { error: az.error });
      const email = String(az.actor || "").toLowerCase();
      if (!email) return json(200, { email: "", purchases: [] });
      const m = getMarket();
      const purchases = Object.entries(getLicenses().keys)
        .filter(([, r]) => !r.revoked && String(r.email || "").toLowerCase() === email)
        .map(([key, r]) => { const e = m.themes[r.theme]; return { theme: r.theme, name: (e && e.name) || r.theme, key, created: r.created || 0 }; })
        .sort((a, b) => b.created - a.created);
      json(200, { email, purchases });
    });
    return;
  }
  // ── Creator dashboard: list + edit a creator's own listings ──────────────────
  // A creator authenticates with their Kurumera token and manages the listings
  // published from a store they own (verified against the backend authz).
  if (p.endsWith("/_push/market/mine") && req.method === "GET") {
    const store = slug(u.searchParams.get("store") || "");
    verifyOwnership(req.headers["authorization"], store).then((az) => {
      if (!az.ok) return json(az.status || 403, { error: az.error });
      const m = getMarket();
      const mine = Object.entries(m.themes)
        .filter(([, e]) => slug(e.sourceStore) === store)
        .map(([s, e]) => ({
          slug: s, name: e.name, description: e.description || "", author: e.author || "",
          price: Number(e.price) > 0 ? Number(e.price) : 0, currency: e.currency || "USD",
          tags: e.tags || [], category: e.category || "", latest: e.latest,
          installs: (e.versions || []).reduce((n, v) => n + (v.installs || 0), 0),
        }));
      json(200, { store, themes: mine });
    });
    return;
  }
  if (p.endsWith("/_push/market/update") && req.method === "POST") {
    readBody().then(async (buf) => {
      let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
      const theme = slug(body.theme || "");
      const m = getMarket();
      const entry = m.themes[theme];
      if (!entry) return json(404, { error: `no marketplace theme "${theme}"` });
      // Authorize ONLY against the recorded owner store — never a caller-supplied
      // store, which would let a non-owner edit (e.g. set price 0) any listing that
      // is missing sourceStore. If ownership isn't recorded, force a re-publish.
      const store = slug(entry.sourceStore || "");
      if (!store) return json(400, { error: "this listing has no owner store recorded — re-publish it once to claim ownership" });
      const az = await verifyOwnership(req.headers["authorization"], store);
      if (!az.ok) return json(az.status || 403, { error: az.error });
      // Apply only the editable listing fields, validated.
      if (typeof body.description === "string") entry.description = body.description.slice(0, 400);
      if (body.price != null && Number.isFinite(Number(body.price))) entry.price = Math.min(999999, Math.max(0, Number(body.price)));
      if (typeof body.currency === "string" && CURRENCIES.has(body.currency.toUpperCase())) entry.currency = body.currency.toUpperCase();
      if (Array.isArray(body.tags)) entry.tags = body.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 12);
      if (typeof body.category === "string") entry.category = body.category.toLowerCase().trim().slice(0, 40);
      setMarket(m);
      json(200, { ok: true, theme, price: entry.price || 0, currency: entry.currency, description: entry.description, tags: entry.tags, category: entry.category });
    });
    return;
  }
  // Delist a listing from the registry (owner-only). Existing installs are unaffected.
  if (p.endsWith("/_push/market/unpublish") && req.method === "POST") {
    readBody().then(async (buf) => {
      let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
      const theme = slug(body.theme || "");
      const m = getMarket();
      const entry = m.themes[theme];
      if (!entry) return json(404, { error: `no marketplace theme "${theme}"` });
      const store = slug(entry.sourceStore || "");
      if (!store) return json(400, { error: "this listing has no owner store recorded — re-publish it once to claim ownership" });
      const az = await verifyOwnership(req.headers["authorization"], store);
      if (!az.ok) return json(az.status || 403, { error: az.error });
      delete m.themes[theme];
      setMarket(m);
      json(200, { ok: true, theme, delisted: true });
    });
    return;
  }
  // Start a purchase — returns a Stripe Checkout URL for a paid theme.
  if (p.endsWith("/_push/market/checkout") && req.method === "POST") {
    readBody().then(async (buf) => {
      let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
      if (!body.theme) return json(400, { ok: false, error: "theme is required" });
      try { json(200, await createCheckout(slug(body.theme), body.email)); }
      catch (e) { json(400, { ok: false, error: e.message || "checkout failed" }); }
    });
    return;
  }
  // Stripe webhook — the source of truth: issues a license on a completed payment
  // (survives the buyer closing the tab) and revokes on refund/dispute. Disabled
  // (400) until KURUMERA_STRIPE_WEBHOOK_SECRET is configured, so it ships inert.
  if (p.endsWith("/_push/market/webhook") && req.method === "POST") {
    readBody().then((buf) => {
      const raw = buf.toString("utf8");
      if (!verifyStripeSig(raw, req.headers["stripe-signature"])) return json(400, { error: "invalid signature" });
      let evt = {}; try { evt = JSON.parse(raw); } catch { return json(400, { error: "bad json" }); }
      try {
        const obj = evt.data && evt.data.object;
        if (evt.type === "checkout.session.completed" && obj && obj.payment_status === "paid") {
          const theme = slug((obj.metadata && obj.metadata.theme) || "");
          if (theme) licenseForSession(theme, obj.customer_email || (obj.customer_details && obj.customer_details.email) || "", obj.id, obj.payment_intent || "");
        } else if ((evt.type === "charge.refunded" || evt.type === "charge.dispute.created") && obj && obj.payment_intent) {
          const n = revokeLicenses((r) => r.pi && r.pi === obj.payment_intent, evt.type);
          if (n) console.log(`revoked ${n} license(s) for ${evt.type} pi=${obj.payment_intent}`);
        }
      } catch (e) { console.error(`webhook ${evt.type}: ${e?.message}`); }
      json(200, { received: true });   // always ack so Stripe doesn't retry-storm
    });
    return;
  }
  // Stripe success redirect — verify payment, issue a license, show it.
  if (p.endsWith("/_push/market/complete") && req.method === "GET") {
    const sid = u.searchParams.get("session_id") || "";
    (async () => {
      try {
        if (!STRIPE_SECRET || !sid) throw new Error("missing session");
        const sess = await stripe(`/checkout/sessions/${encodeURIComponent(sid)}`, "GET");
        if (sess.payment_status !== "paid") throw new Error("payment not completed");
        const theme = slug((sess.metadata && sess.metadata.theme) || "");
        const key = licenseForSession(theme, sess.customer_email || (sess.customer_details && sess.customer_details.email) || "", sid, sess.payment_intent || "");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(licenseHtml(theme, key));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto"><h2>Purchase couldn't be verified</h2><p style="color:#586964">${e.message || ""}</p><p><a href="/marketplace">Back to the marketplace</a></p></body>`);
      }
    })();
    return;
  }
  // JSON variant for the marketplace app's branded success page: verify the paid
  // session, idempotently issue the license, and return the key + install command.
  if (p.endsWith("/_push/market/license") && req.method === "GET") {
    const sid = u.searchParams.get("session_id") || "";
    (async () => {
      try {
        if (!STRIPE_SECRET || !sid) return json(400, { ok: false, error: "missing session" });
        const sess = await stripe(`/checkout/sessions/${encodeURIComponent(sid)}`, "GET");
        if (sess.payment_status !== "paid") return json(402, { ok: false, error: "payment not completed" });
        const theme = slug((sess.metadata && sess.metadata.theme) || "");
        const key = licenseForSession(theme, sess.customer_email || (sess.customer_details && sess.customer_details.email) || "", sid, sess.payment_intent || "");
        const e = getMarket().themes[theme];
        json(200, { ok: true, theme, name: (e && e.name) || theme, key, email: sess.customer_email || (sess.customer_details && sess.customer_details.email) || "" });
      } catch (e) { json(400, { ok: false, error: e.message || "could not verify purchase" }); }
    })();
    return;
  }
  // Clone-to-edit: stream a marketplace theme's SOURCE as a tarball (no runtime
  // artifacts) so a developer can `curl … | tar xz` it, edit, and re-publish.
  if (p.endsWith("/_push/market/source") && req.method === "GET") {
    const t = slug(u.searchParams.get("theme") || "");
    const e = getMarket().themes[t];
    if (!e) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end(`no marketplace theme "${t}"`); }
    if (!ownsTheme(t, u.searchParams.get("license") || "")) {
      res.writeHead(402, { "Content-Type": "text/plain" });
      return res.end(`"${e.name || t}" is a paid theme — buy it, then clone with ?license=<key>`);
    }
    const raw = u.searchParams.get("version");
    const ver = raw && raw !== "latest" ? String(raw).replace(/[^a-zA-Z0-9._-]/g, "") : e.latest;
    const dir = marketDir(t, ver);
    if (!existsSync(dir)) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end(`${t}@${ver} not found`); }
    res.writeHead(200, { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${t}-${ver}.tar.gz"` });
    const tar = spawn("tar", ["-czf", "-", "-C", dir,
      "--exclude=node_modules", "--exclude=.next", "--exclude=.git", "--exclude=dist",
      "--exclude=.turbo", "--exclude=.npm", "--exclude=.cache", "."],
      { stdio: ["ignore", "pipe", "ignore"] });
    tar.stdout.pipe(res);
    tar.on("error", () => { try { res.end(); } catch { /* */ } });
    req.on("close", () => { try { tar.kill(); } catch { /* */ } });
    return;
  }
  if (p.endsWith("/_push/market/publish") && req.method === "POST") {
    readBody().then(async (buf) => {
      let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
      const s = slug(body.store);
      const az = await verifyOwnership(req.headers["authorization"], s);   // must own the source store
      if (!az.ok) return json(az.status || 403, { error: az.error });
      const r = await publishToMarket(s, body);
      json(r.ok === false ? (r.status || 400) : 200, r);
    });
    return;
  }
  if (p.endsWith("/_push/market/install") && req.method === "POST") {
    readBody().then(async (buf) => {
      let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
      if (!body.theme) return json(400, { error: "theme is required" });
      const s = slug(body.store);
      const az = await authorizeMutation(req, s, body.actor_email);   // merchant (backend) or dev (CLI)
      if (!az.ok) return json(az.status || 403, { error: az.error });
      const r = await installFromMarket(s, body.theme, body.version, az.actor, body.license);
      json(r.ok === false ? (r.status || 400) : 200, { ...r, stores: livePublishedStores() });
    });
    return;
  }

  if (p.endsWith("/_push/push") && req.method === "POST") {
    const s = slug(req.headers["x-kurumera-store"] || "");
    verifyOwnership(req.headers["authorization"], s).then((az) => {
      if (!az.ok) return json(az.status || 403, { error: az.error });
      if (building.has(s)) return json(409, { error: "a build is already in progress for this store" });
      readBody().then((buf) => { json(200, { id: "queued", status: "building" }); buildVersion(s, buf, az.actor); });
    });
    return;
  }

  for (const [suffix, fn] of [["/_push/publish", publishStore], ["/_push/rollback", rollbackStore], ["/_push/unpublish", unpublishStore]]) {
    if (p.endsWith(suffix) && req.method === "POST") {
      readBody().then(async (buf) => {
        let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
        const s = slug(body.store);
        const az = await authorizeMutation(req, s, body.actor_email);   // merchant (backend) or dev (CLI)
        if (!az.ok) return json(az.status || 403, { error: az.error });
        const r = await fn(s, az.actor);
        json(r.ok === false ? 400 : 200, { store: s, ...r, stores: livePublishedStores() });
      });
      return;
    }
  }

  // ── Marketplace live preview: ?market=<theme> renders the theme (against a
  //    demo store) so shoppers see it live before installing. Sticky via cookie
  //    + Referer so the theme's absolute /_next/* assets hit the same container.
  //    Explicit ?store below wins and clears the market cookie. ────────────────
  const qMarket = slug(u.searchParams.get("market") || "");
  const qStore = slug(u.searchParams.get("store") || "");
  const mkt = qMarket || (!qStore && (cookieMarket(req) || marketFromReferer(req)));
  if (mkt && getMarket().themes[mkt]) {
    wakeMarketPreview(mkt).finally(() => {
      const preq = http.request(
        { hostname: marketName(mkt), port: 3000, path: req.url, method: req.method,
          headers: { ...req.headers, host: `${marketDemo(mkt)}.kurumera.com` } },
        (pr) => {
          const cookies = [].concat(pr.headers["set-cookie"] || []);
          if (qMarket) cookies.push(`kurumera_market=${encodeURIComponent(mkt)}; Path=/; SameSite=Lax`);
          const h = { ...pr.headers }; if (cookies.length) h["set-cookie"] = cookies;
          res.writeHead(pr.statusCode || 502, h);
          pr.pipe(res);
        },
      );
      // Cold start (scale-to-zero): the container is booting. Auto-refresh so an
      // embedded preview iframe heals itself once the theme is ready.
      preq.on("error", () => {
        res.writeHead(503, { "Content-Type": "text/html; charset=utf-8", "Retry-After": "2" });
        res.end(`<!doctype html><meta http-equiv="refresh" content="2"><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#586964;background:#F5F7F6"><p>Warming up the “${mkt}” preview…</p></body>`);
      });
      req.pipe(preq);
    });
    return;
  }

  // ── PREVIEW proxy (store+version scoped, wake-on-request) ──────────────────
  const s = qStore || slug(cookieStore(req));
  if (!s) { res.writeHead(400, { "Content-Type": "text/html" }); return res.end("<h1>Add ?store=&lt;slug&gt;, or browse the <a href='/marketplace'>theme marketplace</a>.</h1>"); }
  wakePreview(s).finally(() => {
    const preq = http.request(
      { hostname: previewName(s), port: 3000, path: req.url, method: req.method, headers: { ...req.headers, host: `${s}.kurumera.com` } },
      (pr) => {
        const cookies = [].concat(pr.headers["set-cookie"] || []);
        if (qStore) cookies.push("kurumera_market=; Path=/; Max-Age=0");   // leaving any market preview
        const h = { ...pr.headers }; if (cookies.length) h["set-cookie"] = cookies;
        res.writeHead(pr.statusCode || 502, h);
        pr.pipe(res);
      },
    );
    preq.on("error", () => { res.writeHead(502, { "Content-Type": "text/html" }); res.end(`<h1>No preview for "${s}" yet — run \`kurumera theme push\`.</h1>`); });
    req.pipe(preq);
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`kurumera push-service (per-store) on :${PORT}`));

// Periodic reconciliation: self-heal live containers + converge the DB. Runs a
// few seconds after boot (heal anything that died while we were down), then on an
// interval. Best-effort — never throws into the loop.
const RECONCILE_MS = Number(process.env.KURUMERA_RECONCILE_MS || 5 * 60 * 1000);
const kickReconcile = () => {
  reconcile().then(
    (r) => { if (r.healed?.length) console.log("reconcile healed:", JSON.stringify(r.healed)); },
    (e) => console.error("reconcile failed:", e?.message || e),
  );
  reap().catch((e) => console.error("reap failed:", e?.message || e));   // scale idle stores to zero
};
setTimeout(kickReconcile, 15 * 1000);
setInterval(kickReconcile, RECONCILE_MS);

// Heartbeat: tell the control plane this host is alive + how many stores it runs.
// Faster than reconcile so a dead host is detected within ~90s (3 missed beats).
const HEARTBEAT_MS = Number(process.env.KURUMERA_HEARTBEAT_MS || 30 * 1000);
const beat = () => {
  const st = getState();
  const stores_count = Object.values(st.stores).filter((r) => r.live).length;
  return control("host/heartbeat", { host: HOST_NAME, stores_count, meta: { reconcile_ms: RECONCILE_MS } });
};
setTimeout(beat, 3 * 1000);
setInterval(beat, HEARTBEAT_MS);
