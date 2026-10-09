import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkTheme } from "./themeCheck.js";

/**
 * A theme that posts a form straight to the platform has to understand the
 * platform's refusals. Every case here is a real shape found in a live theme.
 *
 * The bug that prompted these: both of a storefront's custom forms read the
 * error body's TOP level, where the refusal is not, and fell back to their own
 * "please try again". A blocked sender was told to retry — which spends another
 * of their hourly tries and never works.
 */

const made: string[] = [];
function theme(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "kurumera-check-"));
  made.push(dir);
  writeFileSync(join(dir, "theme.config.ts"), `export default { name: "t", version: "1.0.0", framework: "nextjs" };\n`);
  writeFileSync(join(dir, "package.json"), `{"name":"t","dependencies":{"@kurumera/storefront":"^0.8.0"}}\n`);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}
const rules = (dir: string, rule: string) =>
  checkTheme(dir).findings.filter((f) => f.rule === rule).map((f) => f.file);

afterEach(() => {
  for (const d of made.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

const BASE = `const KURUMERA_PUBLIC_API_BASE = "https://admin.kurumera.com/api/v1";`;

describe("theme check: platform form posts", () => {
  it("flags a POST that never considers a blocked sender", () => {
    const dir = theme({
      "lib/post.ts": `${BASE}
export async function send(b: unknown) {
  const res = await fetch(\`\${KURUMERA_PUBLIC_API_BASE}/storefront/contact/\`, { method: "POST", body: JSON.stringify(b) });
  if (!res.ok) throw new Error("Could not send. Please try again.");
}`,
    });
    expect(rules(dir, "form-error-handling")).toEqual(["lib/post.ts"]);
  });

  it("accepts naming the code directly", () => {
    const dir = theme({
      "lib/post.ts": `${BASE}
export async function send(b: unknown) {
  const res = await fetch(\`\${KURUMERA_PUBLIC_API_BASE}/storefront/contact/\`, { method: "POST", body: JSON.stringify(b) });
  if (!res.ok) {
    const body = await res.json();
    if (body?.error?.code === "sender_blocked") throw new Error(body.error.message);
    throw new Error("Could not send.");
  }
}`,
    });
    expect(rules(dir, "form-error-handling")).toEqual([]);
  });

  it("accepts delegating to a helper named for it", () => {
    // The real fix put the reader in its own module, so the call site never
    // spells the code out. Demanding the literal string here would have told
    // a correctly fixed theme it was still broken.
    const dir = theme({
      "lib/form-errors.ts": `export const isSenderBlocked = (c: string) => c === "sender_blocked";`,
      "lib/post.ts": `${BASE}
import { isSenderBlocked } from "@/lib/form-errors";
export async function send(b: unknown) {
  const res = await fetch(\`\${KURUMERA_PUBLIC_API_BASE}/storefront/contact/\`, { method: "POST", body: JSON.stringify(b) });
  if (!res.ok) { const body = await res.json(); if (isSenderBlocked(body?.error?.code)) throw new Error(body.error.message); }
}`,
    });
    expect(rules(dir, "form-error-handling")).toEqual([]);
  });

  it("accepts the SDK's KurumeraError", () => {
    const dir = theme({
      "lib/post.ts": `${BASE}
import { KurumeraError } from "@kurumera/storefront";
export async function send(b: unknown) {
  const res = await fetch(\`\${KURUMERA_PUBLIC_API_BASE}/storefront/contact/\`, { method: "POST", body: JSON.stringify(b) });
  if (!res.ok) throw new KurumeraError("x");
}`,
    });
    expect(rules(dir, "form-error-handling")).toEqual([]);
  });

  it("does not flag a GET, only a POST", () => {
    const dir = theme({
      "lib/get.ts": `${BASE}
export const load = () => fetch(\`\${KURUMERA_PUBLIC_API_BASE}/storefront/products/\`);`,
    });
    expect(rules(dir, "form-error-handling")).toEqual([]);
    expect(rules(dir, "raw-platform-fetch")).toEqual(["lib/get.ts"]);
  });

  it("finds the call even when the endpoint path lives in another file", () => {
    // How it hid: the slug sat in a config module and the fetch() somewhere
    // else, so a rule keyed on the path matched neither file. The per-file
    // signal is the API base.
    const dir = theme({
      "lib/config.ts": `export const form = { submitPath: "/storefront/content/forms/book-a-visit/" };`,
      "components/Form.tsx": `${BASE}
import { form } from "@/lib/config";
export async function submit(b: unknown) {
  const res = await fetch(\`\${KURUMERA_PUBLIC_API_BASE}\${form.submitPath}\`, { method: "POST", body: JSON.stringify(b) });
  if (!res.ok) throw new Error("Please try again.");
}`,
    });
    expect(rules(dir, "form-error-handling")).toEqual(["components/Form.tsx"]);
  });

  it("leaves a theme that does not touch the platform alone", () => {
    const dir = theme({ "lib/util.ts": `export const add = (a: number, b: number) => a + b;` });
    expect(rules(dir, "form-error-handling")).toEqual([]);
    expect(rules(dir, "raw-platform-fetch")).toEqual([]);
  });

  it("has no control characters in its own source", () => {
    // A shell heredoc once wrote a literal backspace (0x08) into this file in
    // place of a regex \\b. The regex compiled, matched nothing, and the rule
    // silently never fired. Cheap to assert, expensive to find.
    const self = new URL("./themeCheck.ts", import.meta.url);
    const bytes = new Uint8Array(require("node:fs").readFileSync(self));
    const bad = [...bytes].filter((b) => b < 9 || (b >= 11 && b <= 12) || (b >= 14 && b <= 31));
    expect(bad).toEqual([]);
  });
});
