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
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 9200);
const ROOT = "/home/ubuntu/theme-pushes";
const STATE = join(ROOT, "state.json");
const API_URL = "https://admin.kurumera.com/api/v1";
const NET = "website-builder_web";

mkdirSync(ROOT, { recursive: true });

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
const storeDir = (s) => join(ROOT, slug(s));
const versionDir = (s, v) => join(storeDir(s), "versions", v);
const previewName = (s) => `kurumera-preview-${slug(s)}`;
const liveName = (s) => `kurumera-store-${slug(s)}`;

function getState() {
  try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return { stores: {} }; }
}
function setState(st) { writeFileSync(STATE, JSON.stringify(st)); }
function store(st, s) { return (st.stores[slug(s)] ||= { build: { status: "idle" }, versions: [], live: null, history: [] }); }

function sh(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
    p.on("error", (e) => resolve({ code: 1, out: String(e) }));
  });
}
function runContainer(name, dir) {
  return sh("docker", [
    "run", "-d", "--name", name, "--restart", "unless-stopped", "--network", NET,
    "-v", `${dir}:/app`, "-w", "/app",
    "-e", `KURUMERA_API_URL=${API_URL}`, "-e", "KURUMERA_ROOT_DOMAIN=kurumera.com",
    "node:20-alpine", "sh", "-c", "npx next start -p 3000",
  ]);
}

const building = new Set();

async function buildVersion(s, buffer) {
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

    const b = await sh("docker", ["run", "--rm", "-v", `${dir}:/app`, "-w", "/app", "node:20-alpine",
      "sh", "-c", "npm install --no-audit --no-fund && npx next build"]);
    try { writeFileSync(join(storeDir(s), "build.log"), b.out); } catch { /* best-effort */ }
    if (b.code !== 0) return fail(s, v, "build failed", b.out.slice(-800));

    // (re)start this store's preview container on the new version
    await sh("docker", ["rm", "-f", previewName(s)]);
    const r = await runContainer(previewName(s), dir);
    if (r.code !== 0) return fail(s, v, "preview host failed", r.out.slice(-800));

    const st2 = getState();
    const rec = store(st2, s);
    rec.versions.push(v);
    rec.build = { status: "ready", id: v, preview_url: "https://themekit.kurumera.com" };
    setState(st2);
  } finally {
    building.delete(s);
  }
}
function fail(s, v, error, log) {
  const st = getState();
  store(st, s).build = { status: "failed", id: v, error, log };
  setState(st);
}

// Promote store <s> to a live version; run its live container on that version.
async function goLive(s, v) {
  s = slug(s);
  const dir = versionDir(s, v);
  await sh("docker", ["rm", "-f", liveName(s)]);
  const r = await runContainer(liveName(s), dir);
  return r.code === 0;
}

async function publishStore(s) {
  s = slug(s);
  const st = getState();
  const rec = store(st, s);
  const latest = rec.versions[rec.versions.length - 1];
  if (!latest) return { ok: false, error: "push a build first" };
  if (!(await goLive(s, latest))) return { ok: false, error: "host failed" };
  rec.live = latest;
  rec.history.push(latest);
  setState(getMerge(st, s, rec));
  return { ok: true, version: latest };
}

async function rollbackStore(s) {
  s = slug(s);
  const st = getState();
  const rec = store(st, s);
  if (rec.history.length >= 2) {
    rec.history.pop();                                  // drop current
    const prev = rec.history[rec.history.length - 1];   // restore previous
    if (!(await goLive(s, prev))) return { ok: false, error: "host failed" };
    rec.live = prev;
    setState(getMerge(st, s, rec));
    return { ok: true, version: prev, reverted: "previous version" };
  }
  // no previous version → fall back to the visual builder
  await unpublishStore(s);
  return { ok: true, reverted: "visual builder" };
}

async function unpublishStore(s) {
  s = slug(s);
  const st = getState();
  const rec = store(st, s);
  rec.live = null;
  rec.history = [];
  setState(getMerge(st, s, rec));
  await sh("docker", ["rm", "-f", liveName(s)]);
  return { ok: true };
}
function getMerge(st, s, rec) { st.stores[slug(s)] = rec; return st; }

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
  const authed = () => { const a = req.headers["authorization"] || ""; return a.startsWith("Bearer ") && a.length >= 12; };

  // ── API ──────────────────────────────────────────────────────────────────
  if (p.endsWith("/_push/published")) return json(200, { stores: livePublishedStores() });
  if (p.endsWith("/_push/status")) return json(200, store(getState(), u.searchParams.get("store") || "").build);
  if (p.endsWith("/_push/logs")) {
    let log = "";
    try { log = readFileSync(join(storeDir(u.searchParams.get("store") || ""), "build.log"), "utf8"); } catch { /* none */ }
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(log || "No build logs yet — run `kurumera theme push`.");
  }

  if (p.endsWith("/_push/push") && req.method === "POST") {
    if (!authed()) return json(401, { error: "sign in first (kurumera login)" });
    const s = slug(req.headers["x-kurumera-store"] || "");
    if (!s) return json(400, { error: "no store — pass --store or run `kurumera login`" });
    if (building.has(s)) return json(409, { error: "a build is already in progress for this store" });
    readBody().then((buf) => { json(200, { id: "queued", status: "building" }); buildVersion(s, buf); });
    return;
  }

  for (const [suffix, fn] of [["/_push/publish", publishStore], ["/_push/rollback", rollbackStore], ["/_push/unpublish", unpublishStore]]) {
    if (p.endsWith(suffix) && req.method === "POST") {
      if (!authed()) return json(401, { error: "sign in first (kurumera login)" });
      readBody().then(async (buf) => {
        let s = ""; try { s = slug(JSON.parse(buf.toString() || "{}").store); } catch { /* */ }
        if (!s) return json(400, { error: "store is required" });
        const r = await fn(s);
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
