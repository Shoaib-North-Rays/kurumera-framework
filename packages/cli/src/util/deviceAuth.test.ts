import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startDeviceAuthorization, exchangeDeviceCode } from "./deviceAuth.js";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const API_URL = "https://kurumera.com/api/v1";
const TOKEN_ENDPOINT = `${API_URL}/cli/device/token/`;

describe("startDeviceAuthorization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends a PKCE S256 challenge and returns the verifier alongside it — one request, no polling", async () => {
    let capturedBody: Record<string, unknown> = {};
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse(201, {
        device_code: "cldc_abc", user_code: "ABCD-EFGH",
        verification_uri: "https://kurumera.com/device",
        verification_uri_complete: "https://kurumera.com/device?user_code=ABCD-EFGH",
        expires_in: 600, interval: 5,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const start = await startDeviceAuthorization(API_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1); // exactly one request — no poll loop in here
    expect(capturedBody.code_challenge_method).toBe("S256");
    const expectedChallenge = b64url(createHash("sha256").update(start.codeVerifier).digest());
    expect(expectedChallenge).toBe(capturedBody.code_challenge);

    expect(start.deviceCode).toBe("cldc_abc");
    expect(start.userCode).toBe("ABCD-EFGH");
    expect(start.interval).toBe(5);
    expect(start.expiresIn).toBe(600);
  });

  it("includes requested scopes when provided", async () => {
    let capturedBody: Record<string, unknown> = {};
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse(201, {
        device_code: "cldc_abc", user_code: "ABCD-EFGH",
        verification_uri: "x", verification_uri_complete: "x", expires_in: 600, interval: 5,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await startDeviceAuthorization(API_URL, ["themes:push", "themes:read"]);
    expect(capturedBody.scopes).toEqual(["themes:push", "themes:read"]);
  });

  it("throws with the server's error_description on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, {
      error: "invalid_request", error_description: "A PKCE code_challenge with method S256 is required.",
    })));
    await expect(startDeviceAuthorization(API_URL)).rejects.toThrow(/PKCE code_challenge/);
  });
});

describe("exchangeDeviceCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns ok:true with the session on a successful exchange", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, {
      access_token: "kcli_x", refresh_token: "kclr_x", expires_in: 3600, scope: "themes:push themes:read",
    })));
    const result = await exchangeDeviceCode(TOKEN_ENDPOINT, "cldc_abc", "verifier");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.accessToken).toBe("kcli_x");
      expect(result.result.refreshToken).toBe("kclr_x");
      expect(result.result.scopes).toEqual(["themes:push", "themes:read"]);
    }
  });

  // ── #9 authorization_pending, #10 slow_down, #11 access_denied, #12 expiry,
  // #15/#16 invalid_grant (PKCE mismatch / consumed code) — exchangeDeviceCode
  // never throws for these; it returns a typed error the caller interprets. ──
  it.each([
    ["authorization_pending", 400],
    ["slow_down", 429],
    ["access_denied", 400],
    ["expired_token", 400],
    ["invalid_grant", 400],
  ])("surfaces %s as a typed, non-throwing error result", async (error, status) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, { error, error_description: `desc for ${error}` })));
    const result = await exchangeDeviceCode(TOKEN_ENDPOINT, "cldc_abc", "verifier");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe(error);
      expect(result.error.httpStatus).toBe(status);
    }
  });

  // ── #24 never logs/exposes secrets ──────────────────────────────────────
  it("never logs the device code, verifier, or issued tokens", async () => {
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(" ")); });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, {
      access_token: "kcli_supersecret", refresh_token: "kclr_supersecret", expires_in: 3600, scope: "themes:read",
    })));

    await exchangeDeviceCode(TOKEN_ENDPOINT, "cldc_secretdevicecode", "secretverifier");

    expect(logs.join("\n")).toBe(""); // this layer prints nothing at all
    logSpy.mockRestore();
  });
});
