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
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
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

function getState() {
  try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return { stores: {} }; }
}
function setState(st) { writeFileSync(STATE, JSON.stringify(st)); }
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

// ── Marketplace ────────────────────────────────────────────────────────────
// A developer publishes a store's latest BUILT version into a shared registry;
// any store can install it (copied into that store's own version history, then
// made live — so installs stay per-store isolated and roll back independently).
function getMarket() {
  try { return JSON.parse(readFileSync(MARKET_STATE, "utf8")); } catch { return { themes: {} }; }
}
function setMarket(m) { writeFileSync(MARKET_STATE, JSON.stringify(m)); }

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
  if (entry.versions.some((v) => v.version === version)) {
    return { ok: false, error: `${theme}@${version} is already published — bump the version in theme.config` };
  }

  const c = await copyDir(versionDir(s, latest), dest);
  if (c.code !== 0) return { ok: false, error: "failed to stage artifact", log: c.out.slice(-400) };

  entry.name = meta.name || entry.name;
  if (meta.description) entry.description = meta.description;
  if (meta.author) entry.author = meta.author;
  entry.versions.push({ version, id: latest, published: Date.now(), installs: 0 });
  entry.latest = version;
  setMarket(m);
  return { ok: true, theme, version };
}

// Install <theme>@<version> into store <s>: copy the registry artifact into a new
// per-store version, then make it live. Returns the new store version id.
async function installFromMarket(s, theme, version, actor) {
  s = slug(s); theme = slug(theme);
  const m = getMarket();
  const entry = m.themes[theme];
  if (!entry) return { ok: false, error: `no marketplace theme "${theme}"` };
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

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://x");
  const p = u.pathname;
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  const readBody = () => new Promise((resolve) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => resolve(Buffer.concat(c))); });

  // ── API ──────────────────────────────────────────────────────────────────
  if (p.endsWith("/_push/published")) return json(200, { stores: livePublishedStores() });
  if (p.endsWith("/_push/status")) return json(200, store(getState(), u.searchParams.get("store") || "").build);
  if (p.endsWith("/_push/logs")) {
    let log = "";
    try { log = readFileSync(join(storeDir(u.searchParams.get("store") || ""), "build.log"), "utf8"); } catch { /* none */ }
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(log || "No build logs yet — run `kurumera theme push`.");
  }

  // ── Marketplace ────────────────────────────────────────────────────────────
  if (p.endsWith("/_push/market") && req.method === "GET") return json(200, { themes: marketListing() });
  if (p.endsWith("/_push/market/info")) {
    const t = slug(u.searchParams.get("theme") || "");
    const e = getMarket().themes[t];
    return e ? json(200, { slug: t, ...e }) : json(404, { error: `no marketplace theme "${t}"` });
  }
  if (p.endsWith("/_push/market/publish") && req.method === "POST") {
    readBody().then(async (buf) => {
      let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
      const s = slug(body.store);
      const az = await verifyOwnership(req.headers["authorization"], s);   // must own the source store
      if (!az.ok) return json(az.status || 403, { error: az.error });
      const r = await publishToMarket(s, body);
      json(r.ok === false ? 400 : 200, r);
    });
    return;
  }
  if (p.endsWith("/_push/market/install") && req.method === "POST") {
    readBody().then(async (buf) => {
      let body = {}; try { body = JSON.parse(buf.toString() || "{}"); } catch { /* */ }
      if (!body.theme) return json(400, { error: "theme is required" });
      const s = slug(body.store);
      const az = await verifyOwnership(req.headers["authorization"], s);   // must own the target store
      if (!az.ok) return json(az.status || 403, { error: az.error });
      const r = await installFromMarket(s, body.theme, body.version, az.actor);
      json(r.ok === false ? 400 : 200, { ...r, stores: livePublishedStores() });
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
        let s = ""; try { s = slug(JSON.parse(buf.toString() || "{}").store); } catch { /* */ }
        const az = await verifyOwnership(req.headers["authorization"], s);
        if (!az.ok) return json(az.status || 403, { error: az.error });
        const r = await fn(s, az.actor);
        json(r.ok === false ? 400 : 200, { store: s, ...r, stores: livePublishedStores() });
      });
      return;
    }
  }

  // ── PREVIEW proxy (store+version scoped) ───────────────────────────────────
  const s = slug(u.searchParams.get("store") || cookieStore(req));
  if (!s) { res.writeHead(400, { "Content-Type": "text/html" }); return res.end("<h1>Add ?store=&lt;slug&gt;</h1>"); }
  const preq = http.request(
    { hostname: previewName(s), port: 3000, path: req.url, method: req.method, headers: { ...req.headers, host: `${s}.kurumera.com` } },
    (pr) => { res.writeHead(pr.statusCode || 502, pr.headers); pr.pipe(res); },
  );
  preq.on("error", () => { res.writeHead(502, { "Content-Type": "text/html" }); res.end(`<h1>No preview for "${s}" yet — run \`kurumera theme push\`.</h1>`); });
  req.pipe(preq);
});

server.listen(PORT, "0.0.0.0", () => console.log(`kurumera push-service (per-store) on :${PORT}`));
