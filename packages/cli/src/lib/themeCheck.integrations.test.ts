import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkTheme } from "./themeCheck.js";

/**
 * A theme connects its own services — a chat widget's backend, an email
 * provider, a payment API — with server code and keys in its .env files.
 * `theme check` used to refuse all of it (app/api, "use server", stripe,
 * nodemailer) and warned that any env var outside KURUMERA_* would be
 * undefined, which was never true: the platform builds and runs a store with
 * the .env files the theme pushes.
 */

const made: string[] = [];
function theme(files: Record<string, string>, deps: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "kurumera-integrations-"));
  made.push(dir);
  writeFileSync(join(dir, "theme.config.ts"), `export default { name: "t", version: "1.0.0", framework: "nextjs" };\n`);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "t", dependencies: { "@kurumera/storefront": "^0.9.0", ...deps } }));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}
/** Errors other than the six page templates these minimal fixtures leave out. */
const blocking = (dir: string) =>
  checkTheme(dir).findings.filter((f) => f.severity === "error" && f.rule !== "route-contract").map((f) => f.rule);
const rules = (dir: string) => checkTheme(dir).findings.map((f) => f.rule);
const byRule = (dir: string, rule: string) => checkTheme(dir).findings.filter((f) => f.rule === rule);

afterEach(() => {
  for (const d of made.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

const CHAT_ROUTE = `export async function POST(req: Request) {
  const r = await fetch("https://api.example-chat.com/v1/reply", {
    method: "POST",
    headers: { Authorization: \`Bearer \${process.env.CHAT_API_KEY}\` },
    body: await req.text(),
  });
  return new Response(r.body, { status: r.status });
}`;

describe("theme check: a theme's own integrations", () => {
  it("allows a route handler that uses a key from .env.production", () => {
    const dir = theme({ "app/api/chat/route.ts": CHAT_ROUTE, ".env.production": "CHAT_API_KEY=sk_live_x\n" });
    expect(blocking(dir)).toEqual([]);
    expect(rules(dir)).not.toContain("env-access");
  });

  it("allows a server action", () => {
    const dir = theme({ "app/contact/actions.ts": `"use server";\nexport async function send() { return process.env.MAIL_KEY; }`, ".env": "MAIL_KEY=x\n" });
    expect(blocking(dir)).toEqual([]);
  });

  it("allows integration SDKs, still refuses a database driver", () => {
    expect(blocking(theme({}, { stripe: "^16.0.0", nodemailer: "^6.9.0", jsonwebtoken: "^9.0.0" }))).toEqual([]);
    expect(byRule(theme({}, { pg: "^8.0.0" }), "forbidden-dependency")).toHaveLength(1);
  });

  it("warns when a key the code reads is in no deployed .env file", () => {
    const dir = theme({ "app/api/chat/route.ts": CHAT_ROUTE, ".env.development": "CHAT_API_KEY=dev\n" });
    const found = byRule(dir, "env-access");
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("CHAT_API_KEY");
  });

  it("accepts any of the files Next.js loads in production", () => {
    for (const f of [".env", ".env.production", ".env.local", ".env.production.local"]) {
      expect(rules(theme({ "app/api/chat/route.ts": CHAT_ROUTE, [f]: "export CHAT_API_KEY = x\n" }))).not.toContain("env-access");
    }
  });

  it("never flags the platform's own variables", () => {
    const dir = theme({ "lib/x.ts": "export const a = process.env.KURUMERA_API_URL + process.env.NODE_ENV;" });
    expect(rules(dir)).not.toContain("env-access");
  });

  it("warns that a server-only variable is undefined in a client component", () => {
    const dir = theme({
      "components/Chat.tsx": `"use client";\nexport function Chat() { return <div data-id={process.env.CHAT_SITE_ID} />; }`,
      ".env": "CHAT_SITE_ID=abc\n",
    });
    expect(byRule(dir, "env-in-browser")).toHaveLength(1);
    expect(byRule(dir, "env-access")).toHaveLength(0);
  });

  it("is quiet about a NEXT_PUBLIC_ variable in a client component when it is set", () => {
    const dir = theme({
      "components/Chat.tsx": `"use client";\nexport function Chat() { return <div data-id={process.env.NEXT_PUBLIC_CRISP_ID} />; }`,
      ".env.production": "NEXT_PUBLIC_CRISP_ID=abc\n",
    });
    expect(rules(dir).filter((r) => r.startsWith("env"))).toEqual([]);
  });

  it("warns about a secret-looking NEXT_PUBLIC_ variable", () => {
    const dir = theme({ ".env": "NEXT_PUBLIC_STRIPE_SECRET_KEY=sk\nNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk\n" });
    const found = byRule(dir, "public-secret");
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("NEXT_PUBLIC_STRIPE_SECRET_KEY");
  });
});
