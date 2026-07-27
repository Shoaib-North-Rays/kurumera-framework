import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Prevent the real browser-open side effect (spawn cmd/open/xdg-open) during tests.
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

import { deviceLogin } from "./deviceAuth.js";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const API_URL = "https://admin.kurumera.com/api/v1";

describe("deviceLogin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("proves possession of the verifier it committed to via PKCE S256", async () => {
    let capturedChallenge = "";
    let capturedVerifier = "";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (String(url).includes("/device/authorize/")) {
        capturedChallenge = body.code_challenge;
        expect(body.code_challenge_method).toBe("S256");
        return jsonResponse(200, {
          device_code: "dc1", user_code: "ABCD-EFGH",
          verification_uri: "https://kurumera.com/device",
          verification_uri_complete: "https://kurumera.com/device?user_code=ABCD-EFGH",
          expires_in: 600, interval: 5,
        });
      }
      if (String(url).includes("/device/token/")) {
        capturedVerifier = body.code_verifier;
        return jsonResponse(200, {
          access_token: "kcli_abc", refresh_token: "kclr_def", expires_in: 3600,
          scope: "themes:push themes:read",
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = deviceLogin(API_URL);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result.accessToken).toBe("kcli_abc");
    expect(result.refreshToken).toBe("kclr_def");
    expect(result.scopes).toEqual(["themes:push", "themes:read"]);
    expect(capturedVerifier).toBeTruthy();
    expect(b64url(createHash("sha256").update(capturedVerifier).digest())).toBe(capturedChallenge);
  });

  it("keeps polling on authorization_pending until the human approves", async () => {
    let polls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/device/authorize/")) {
        return jsonResponse(200, {
          device_code: "dc1", user_code: "CODE",
          verification_uri: "https://kurumera.com/device",
          verification_uri_complete: "https://kurumera.com/device?user_code=CODE",
          expires_in: 600, interval: 1,
        });
      }
      polls++;
      if (polls < 3) return jsonResponse(400, { error: "authorization_pending" });
      return jsonResponse(200, { access_token: "kcli_ok", expires_in: 3600, scope: "themes:read" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = deviceLogin(API_URL);
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.accessToken).toBe("kcli_ok");
    expect(polls).toBeGreaterThanOrEqual(3);
  });

  it("backs off on slow_down instead of failing", async () => {
    let polls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/device/authorize/")) {
        return jsonResponse(200, {
          device_code: "dc1", user_code: "CODE",
          verification_uri: "https://kurumera.com/device",
          verification_uri_complete: "https://kurumera.com/device?user_code=CODE",
          expires_in: 600, interval: 1,
        });
      }
      polls++;
      if (polls === 1) return jsonResponse(429, { error: "slow_down" });
      return jsonResponse(200, { access_token: "kcli_ok2", expires_in: 3600, scope: "" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = deviceLogin(API_URL);
    for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.accessToken).toBe("kcli_ok2");
  });

  it("rejects when the human denies the request", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/device/authorize/")) {
        return jsonResponse(200, {
          device_code: "dc1", user_code: "CODE",
          verification_uri: "https://kurumera.com/device",
          verification_uri_complete: "https://kurumera.com/device?user_code=CODE",
          expires_in: 600, interval: 1,
        });
      }
      return jsonResponse(400, { error: "access_denied", error_description: "Authorization was denied." });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = deviceLogin(API_URL);
    const expectation = expect(promise).rejects.toThrow(/denied/i);
    await vi.advanceTimersByTimeAsync(1000);
    await expectation;
  });

  it("never logs the raw access or refresh token", async () => {
    const logs: string[] = [];
    (console.log as unknown as { mockImplementation: (fn: (...a: unknown[]) => void) => void }).mockImplementation(
      (...args: unknown[]) => { logs.push(args.map(String).join(" ")); },
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/device/authorize/")) {
        return jsonResponse(200, {
          device_code: "dc1", user_code: "CODE",
          verification_uri: "https://kurumera.com/device",
          verification_uri_complete: "https://kurumera.com/device?user_code=CODE",
          expires_in: 600, interval: 1,
        });
      }
      return jsonResponse(200, {
        access_token: "kcli_supersecretvalue", refresh_token: "kclr_supersecretvalue",
        expires_in: 3600, scope: "themes:read",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = deviceLogin(API_URL);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    const joined = logs.join("\n");
    expect(joined).not.toContain("kcli_supersecretvalue");
    expect(joined).not.toContain("kclr_supersecretvalue");
  });
});
