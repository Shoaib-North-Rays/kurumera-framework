import { afterEach, describe, expect, it, vi } from "vitest";

const readConfigMock = vi.fn();
const writeConfigMock = vi.fn();
vi.mock("./config.js", () => ({
  readConfig: () => readConfigMock(),
  writeConfig: (cfg: unknown) => writeConfigMock(cfg),
}));

import { resolveAuthToken } from "./resolveAuthToken.js";

describe("resolveAuthToken", () => {
  afterEach(() => {
    delete process.env.KURUMERA_CLI_TOKEN;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    readConfigMock.mockReset();
    writeConfigMock.mockReset();
  });

  it("prefers KURUMERA_CLI_TOKEN over any saved config", async () => {
    process.env.KURUMERA_CLI_TOKEN = "kcli_from_env";
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_saved", scopes: [] } });

    const token = await resolveAuthToken();

    expect(token).toBe("kcli_from_env");
  });

  it("never persists the env token — config is not even read", async () => {
    process.env.KURUMERA_CLI_TOKEN = "kcli_from_env";

    await resolveAuthToken();

    expect(writeConfigMock).not.toHaveBeenCalled();
    expect(readConfigMock).not.toHaveBeenCalled();
  });

  it("uses the structured auth.accessToken as-is when it isn't expiring soon", async () => {
    readConfigMock.mockReturnValue({
      auth: { type: "device", accessToken: "kcli_valid", expiresAt: Date.now() + 60 * 60 * 1000, scopes: [] },
    });

    const token = await resolveAuthToken();

    expect(token).toBe("kcli_valid");
    expect(writeConfigMock).not.toHaveBeenCalled();
  });

  it("falls back to the legacy authToken when no structured auth session exists", async () => {
    readConfigMock.mockReturnValue({ authToken: "legacy_token" });

    const token = await resolveAuthToken();

    expect(token).toBe("legacy_token");
  });

  it("auto-refreshes an expiring access token and persists the rotated pair", async () => {
    readConfigMock.mockReturnValue({
      auth: {
        type: "device", accessToken: "kcli_old", refreshToken: "kclr_old",
        expiresAt: Date.now() - 1000, scopes: ["themes:read"],
      },
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: "kcli_new", refresh_token: "kclr_new", expires_in: 3600, scope: "themes:read",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await resolveAuthToken();

    expect(token).toBe("kcli_new");
    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    const saved = writeConfigMock.mock.calls[0][0];
    expect(saved.auth.accessToken).toBe("kcli_new");
    expect(saved.auth.refreshToken).toBe("kclr_new");
  });

  it("a manual (no refresh token) session with an expired access token is returned as-is (no refresh attempt)", async () => {
    readConfigMock.mockReturnValue({
      auth: { type: "manual", accessToken: "kcli_manual_expired", expiresAt: Date.now() - 1000, scopes: ["themes:read"] },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const token = await resolveAuthToken();

    expect(token).toBe("kcli_manual_expired");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the stale access token when the refresh call fails (server 401s clearly on next use)", async () => {
    readConfigMock.mockReturnValue({
      auth: { type: "device", accessToken: "kcli_stale", refreshToken: "kclr_x", expiresAt: Date.now() - 1000, scopes: [] },
    });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    const token = await resolveAuthToken();

    expect(token).toBe("kcli_stale");
    expect(writeConfigMock).not.toHaveBeenCalled();
  });
});
