import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkTheme } from "./themeCheck.js";

/**
 * A server-rendered theme calls the platform from the server. If those calls
 * do not carry the visitor's address, every visitor looks like one machine and
 * every store rendered there shares one rate limit — on 2026-10-16 one crawler
 * reading one sitemap made 53 pages answer 500 that way.
 */

const made: string[] = [];
function theme(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "kurumera-visitor-"));
  made.push(dir);
  writeFileSync(join(dir, "theme.config.ts"), `export default { name: "t", version: "1.0.0", framework: "nextjs" };\n`);
  writeFileSync(join(dir, "package.json"), `{"name":"t","dependencies":{"@kurumera/storefront":"^0.9.0"}}\n`);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}
const flagged = (dir: string) =>
  checkTheme(dir).findings.filter((f) => f.rule === "visitor-not-forwarded").map((f) => f.file).sort();

afterEach(() => {
  for (const d of made.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

const OLD_GETSTORE = `import { headers } from "next/headers";
import { createKurumeraClient } from "@kurumera/storefront";
export async function getStore() {
  const h = await headers();
  return createKurumeraClient({ tenant: h.get("x-kurumera-tenant") || "", apiUrl: process.env.KURUMERA_API_URL });
}`;

const NEW_GETSTORE = `import { headers } from "next/headers";
import { createKurumeraClient } from "@kurumera/storefront";
export async function getStore() {
  const h = await headers();
  return createKurumeraClient({
    tenant: h.get("x-kurumera-tenant") || "",
    forwardHeaders: { "x-forwarded-for": h.get("x-forwarded-for"), "cf-connecting-ip": h.get("cf-connecting-ip") },
  });
}`;

describe("theme check: forwarding the visitor", () => {
  it("flags a getStore() that does not forward the visitor", () => {
    expect(flagged(theme({ "lib/kurumera.ts": OLD_GETSTORE }))).toEqual(["lib/kurumera.ts"]);
  });

  it("is satisfied by the current template", () => {
    expect(flagged(theme({ "lib/kurumera.ts": NEW_GETSTORE }))).toEqual([]);
  });

  it("flags a server-side fetch to the platform that drops the visitor", () => {
    const dir = theme({
      "lib/kurumera.ts": NEW_GETSTORE,
      "lib/root-files.ts": `import { headers } from "next/headers";
const base = process.env.KURUMERA_API_URL;
export async function platformFile(file: string) {
  const h = await headers();
  return fetch(\`\${base}/storefront/\${file}\`, { headers: { "X-Tenant-ID": h.get("x-kurumera-tenant") || "" }, cache: "no-store" });
}`,
    });
    expect(flagged(dir)).toEqual(["lib/root-files.ts"]);
  });

  it("accepts a server-side fetch that spreads visitorHeaders()", () => {
    const dir = theme({
      "lib/kurumera.ts": NEW_GETSTORE,
      "lib/root-files.ts": `import { headers } from "next/headers";
import { visitorHeaders } from "@/lib/kurumera";
const base = process.env.KURUMERA_API_URL;
export async function platformFile(file: string) {
  return fetch(\`\${base}/storefront/\${file}\`, { headers: { ...(await visitorHeaders()) }, cache: "no-store" });
}`,
    });
    expect(flagged(dir)).toEqual([]);
  });

  it("does not flag browser code — the browser already carries the visitor", () => {
    // A form posting from a client component. It reads no next/headers, so it
    // cannot be server code, and asking it to forward anything would be wrong.
    const dir = theme({
      "lib/kurumera.ts": NEW_GETSTORE,
      "components/Form.tsx": `"use client";
const KURUMERA_PUBLIC_API_BASE = "https://admin.kurumera.com/api/v1";
export async function send(b: unknown) {
  return fetch(\`\${KURUMERA_PUBLIC_API_BASE}/storefront/contact/\`, { method: "POST", body: JSON.stringify(b) });
}`,
    });
    expect(flagged(dir)).toEqual([]);
  });

  it("leaves a demo-only client alone when it already forwards", () => {
    const dir = theme({
      "lib/kurumera.ts": `${NEW_GETSTORE}
export const demo = () => createKurumeraClient({ tenant: "demo", fetch: () => Promise.resolve(new Response("{}")) });`,
    });
    expect(flagged(dir)).toEqual([]);
  });
});
