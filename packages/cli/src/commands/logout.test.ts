import { afterEach, describe, expect, it, vi } from "vitest";

const readConfigMock = vi.fn();
const writeConfigMock = vi.fn();
vi.mock("../util/config.js", () => ({
  readConfig: () => readConfigMock(),
  writeConfig: (cfg: unknown) => writeConfigMock(cfg),
  CONFIG_PATH: "/fake/.kurumera/config.json",
}));

const readPendingDeviceAuthMock = vi.fn();
const clearPendingDeviceAuthMock = vi.fn();
vi.mock("../util/pendingDeviceAuth.js", () => ({
  readPendingDeviceAuth: () => readPendingDeviceAuthMock(),
  clearPendingDeviceAuth: () => clearPendingDeviceAuthMock(),
}));

import { logout } from "./logout.js";

describe("logout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    readConfigMock.mockReset();
    writeConfigMock.mockReset();
    readPendingDeviceAuthMock.mockReset().mockReturnValue(undefined);
    clearPendingDeviceAuthMock.mockReset();
  });

  it("best-effort revokes the server-side session when a device/manual session is saved", async () => {
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_x", scopes: [] } });
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ revoked: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await logout([]);

    expect(code).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/cli/device/revoke/");
    expect(JSON.parse(String(init?.body))).toEqual({ token: "kcli_x" });
    expect(writeConfigMock).toHaveBeenCalled();
  });

  it("still clears local credentials when the revoke call fails — never blocks local logout", async () => {
    readConfigMock.mockReturnValue({
      auth: { type: "device", accessToken: "kcli_x", scopes: [] },
      authToken: "legacy",
    });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await logout([]);

    expect(code).toBe(0);
    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    const saved = writeConfigMock.mock.calls[0][0];
    expect(saved.auth).toBeUndefined();
    expect(saved.authToken).toBeUndefined();
  });

  it("does not call the server when only removing one store's storefront token", async () => {
    readConfigMock.mockReturnValue({
      stores: { "my-store": "ksf_abc" },
      auth: { type: "device", accessToken: "kcli_x", scopes: [] },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await logout(["--store", "my-store"]);

    expect(code).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports already-signed-out with nothing saved, and touches neither network nor disk", async () => {
    readConfigMock.mockReturnValue({});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await logout([]);

    expect(code).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeConfigMock).not.toHaveBeenCalled();
  });

  // ── #25: logout removes completed credentials AND pending device-auth state ──
  it("clears a pending device authorization on a full logout", async () => {
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_x", scopes: [] } });
    readPendingDeviceAuthMock.mockReturnValue({
      deviceCode: "cldc_x", codeVerifier: "v", tokenEndpoint: "https://kurumera.com/api/v1/cli/device/token/",
      verificationUri: "https://kurumera.com/device", expiresAt: Date.now() + 600_000, interval: 5, createdAt: Date.now(),
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ revoked: true }), { status: 200 })));
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await logout([]);
    expect(code).toBe(0);
    expect(clearPendingDeviceAuthMock).toHaveBeenCalledTimes(1);
  });

  it("leaves a pending device authorization alone for a --store-scoped logout", async () => {
    readConfigMock.mockReturnValue({ stores: { "my-store": "ksf_abc" } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await logout(["--store", "my-store"]);
    expect(code).toBe(0);
    expect(clearPendingDeviceAuthMock).not.toHaveBeenCalled();
  });
});
