/**
 * Kurumera theme push/build/host service (P2 MVP).
 *
 * Runs on the builder box (systemd, host — needs docker). Accepts a pushed theme
 * tarball from `kurumera theme push`, builds it in an isolated node container,
 * and swaps the shared preview container (`kurumera-theme`, served at
 * themekit.kurumera.com) to serve it. `kurumera theme preview` polls /status.
 *
 * MVP limits (documented, not hidden): ONE preview slot (latest push wins),
 * light auth (Bearer presence), and it runs third-party build output — fine for
 * internal devs, NOT yet hardened for untrusted public themes.
 *
 *   POST /_push/push     body = gzip tarball, header X-Kurumera-Store
 *   GET  /_push/status   → { status: building|ready|failed, preview_url, error, id }
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 9200);
const ROOT = "/home/ubuntu/theme-pushes";
const CURRENT = join(ROOT, "current");
const STATUS = join(ROOT, "status.json");
const PUBLISHED = join(ROOT, "published.json");
const PREVIEW_URL = "https://themekit.kurumera.com";
const API_URL = "https://admin.kurumera.com/api/v1";
const NET = "website-builder_web";

mkdirSync(ROOT, { recursive: true });

function setStatus(s) {
  writeFileSync(STATUS, JSON.stringify(s));
}
function getStatus() {
  try { return JSON.parse(readFileSync(STATUS, "utf8")); } catch { return { status: "idle" }; }
}
function getPublished() {
  try { return JSON.parse(readFileSync(PUBLISHED, "utf8")); } catch { return { stores: [] }; }
}
function setPublished(p) {
  writeFileSync(PUBLISHED, JSON.stringify(p));
}
function sh(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
    p.on("error", (e) => resolve({ code: 1, out: String(e) }));
  });
}

let building = false;

async function build(id) {
  building = true;
  try {
    setStatus({ status: "building", id });
    // 1) install + next build in an isolated node container.
    const b = await sh("docker", [
      "run", "--rm", "-v", `${CURRENT}:/app`, "-w", "/app", "node:20-alpine",
      "sh", "-c", "npm install --no-audit --no-fund && npx next build",
    ]);
    if (b.code !== 0) {
      setStatus({ status: "failed", id, error: "build failed", log: b.out.slice(-800) });
      return;
    }
    // 2) swap the shared preview container to serve this build.
    await sh("docker", ["rm", "-f", "kurumera-theme"]);
    const r = await sh("docker", [
      "run", "-d", "--name", "kurumera-theme", "--restart", "unless-stopped",
      "--network", NET, "-v", `${CURRENT}:/app`, "-w", "/app",
      "-e", `KURUMERA_API_URL=${API_URL}`, "-e", "KURUMERA_ROOT_DOMAIN=kurumera.com",
      "node:20-alpine", "sh", "-c", "npx next start -p 3000",
    ]);
    if (r.code !== 0) {
      setStatus({ status: "failed", id, error: "host failed", log: r.out.slice(-800) });
      return;
    }
    setStatus({ status: "ready", id, preview_url: PREVIEW_URL });
  } finally {
    building = false;
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || "";
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

  if (req.method === "GET" && url.endsWith("/status")) {
    return json(200, getStatus());
  }

  // Which stores currently serve the code theme (the builder polls this to route
  // <slug>.kurumera.com to the code-theme container instead of the visual builder).
  if (req.method === "GET" && url.endsWith("/published")) {
    return json(200, getPublished());
  }

  // Publish / roll back a store to/from the code theme.
  if (req.method === "POST" && (url.endsWith("/publish") || url.endsWith("/unpublish"))) {
    const auth = req.headers["authorization"] || "";
    if (!auth.startsWith("Bearer ") || auth.length < 12) return json(401, { error: "sign in first (kurumera login)" });
    const off = url.endsWith("/unpublish");
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let store = "";
      try { store = (JSON.parse(Buffer.concat(chunks).toString() || "{}").store || "").trim(); } catch { /* */ }
      if (!store) return json(400, { error: "store is required" });
      const cur = new Set(getPublished().stores);
      if (off) cur.delete(store); else cur.add(store);
      setPublished({ stores: [...cur] });
      json(200, { store, live: !off, stores: [...cur] });
    });
    return;
  }

  if (req.method === "POST" && url.endsWith("/push")) {
    const auth = req.headers["authorization"] || "";
    if (!auth.startsWith("Bearer ") || auth.length < 12) return json(401, { error: "sign in first (kurumera login)" });
    if (building) return json(409, { error: "a build is already in progress — try again shortly" });

    const chunks = [];
    let size = 0;
    req.on("data", (c) => { chunks.push(c); size += c.length; if (size > 50 * 1024 * 1024) req.destroy(); });
    req.on("end", async () => {
      const id = "v" + Date.now();
      try {
        rmSync(CURRENT, { recursive: true, force: true });
        mkdirSync(CURRENT, { recursive: true });
        const tgz = join(ROOT, `${id}.tgz`);
        writeFileSync(tgz, Buffer.concat(chunks));
        const x = await sh("tar", ["-xzf", tgz, "-C", CURRENT]);
        rmSync(tgz, { force: true });
        if (x.code !== 0) return json(400, { error: "could not unpack the theme bundle" });
      } catch (e) {
        return json(500, { error: "failed to store bundle: " + e.message });
      }
      json(200, { id, status: "building" });
      build(id); // async, updates status.json
    });
    return;
  }

  json(404, { error: "not found" });
});

server.listen(PORT, "0.0.0.0", () => console.log(`kurumera push-service on :${PORT}`));
