import { afterEach, describe, expect, it, vi } from "vitest";

const mkdirSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();
const renameSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const existsSyncMock = vi.fn((_path: string) => false);

vi.mock("node:fs", () => ({
  mkdirSync: (path: string, opts?: unknown) => mkdirSyncMock(path, opts),
  writeFileSync: (path: string, data: string, opts?: unknown) => writeFileSyncMock(path, data, opts),
  renameSync: (from: string, to: string) => renameSyncMock(from, to),
  unlinkSync: (path: string) => unlinkSyncMock(path),
  readFileSync: (path: string, enc?: string) => readFileSyncMock(path, enc),
  existsSync: (path: string) => existsSyncMock(path),
}));

const readConfigMock = vi.fn(() => ({}) as Record<string, unknown>);
const writeConfigMock = vi.fn();
vi.mock("./config.js", () => ({
  readConfig: () => readConfigMock(),
  writeConfig: (cfg: unknown) => writeConfigMock(cfg),
}));

vi.mock("./authUrl.js", () => ({
  resolveAuthUrl: () => "https://kurumera.com/api/v1",
}));

import { requestScopeAmend, tryCompletePendingAmend } from "./scopeAmend.js";

function resetAll(): void {
  vi.restoreAllMocks();
  mkdirSyncMock.mockReset();
  writeFileSyncMock.mockReset();
  renameSyncMock.mockReset();
  unlinkSyncMock.mockReset();
  readFileSyncMock.mockReset();
  existsSyncMock.mockReset().mockReturnValue(false);
  readConfigMock.mockReset().mockReturnValue({});
  writeConfigMock.mockReset();
}

describe("requestScopeAmend", () => {
  afterEach(resetAll);

  it("prints the verification URL/code, persists pending state, and never prints the bearer token", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { logs.push(a.join(" ")); });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: "cldc_amendcode", user_code: "WXYZ-1234",
        verification_uri: "https://kurumera.com/device",
        verification_uri_complete: "https://kurumera.com/device?user_code=WXYZ-1234",
        expires_in: 600, interval: 5,
      }),
    }) as unknown as typeof fetch;

    await requestScopeAmend("themes:publish", "kcli_supersecrettoken");

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    expect(renameSyncMock).toHaveBeenCalledTimes(1);
    const written = writeFileSyncMock.mock.calls[0][1] as string;
    expect(written).toContain("cldc_amendcode");
    expect(written).toContain("themes:publish");

    const output = logs.join("\n");
    expect(output).toContain("WXYZ-1234");
    expect(output).toContain("themes:publish");
    expect(output).not.toContain("kcli_supersecrettoken");
  });

  it("sends the request against the calling session's own bearer token", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ device_code: "cldc_x", user_code: "AAAA-BBBB", verification_uri: "https://kurumera.com/device", expires_in: 600, interval: 5 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await requestScopeAmend("themes:rollback", "kcli_thetoken");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://kurumera.com/api/v1/cli/device/amend/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer kcli_thetoken" }),
      }),
    );
    const bodyArg = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(bodyArg).toEqual({ scopes: ["themes:rollback"] });
  });

  it("reports a clean error and never throws when the request itself fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(requestScopeAmend("themes:publish", "kcli_x")).resolves.toBeUndefined();
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });
});

describe("tryCompletePendingAmend", () => {
  afterEach(resetAll);

  it("returns false when there is no pending amendment", async () => {
    readFileSyncMock.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    await expect(tryCompletePendingAmend()).resolves.toBe(false);
  });

  it("returns false (does not error) while the amendment is still pending approval", async () => {
    readFileSyncMock.mockReturnValue(JSON.stringify({
      deviceCode: "cldc_x", tokenEndpoint: "https://kurumera.com/api/v1/cli/device/token/",
      verificationUri: "https://kurumera.com/device", requestedScope: "themes:publish",
      expiresAt: Date.now() + 600_000, interval: 5,
    }));
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "authorization_pending" }) }) as unknown as typeof fetch;

    await expect(tryCompletePendingAmend()).resolves.toBe(false);
    expect(unlinkSyncMock).not.toHaveBeenCalled(); // pending state preserved for the next attempt
  });

  it("merges the newly granted scope into local config and clears pending state on success", async () => {
    readFileSyncMock.mockReturnValue(JSON.stringify({
      deviceCode: "cldc_x", tokenEndpoint: "https://kurumera.com/api/v1/cli/device/token/",
      verificationUri: "https://kurumera.com/device", requestedScope: "themes:publish",
      expiresAt: Date.now() + 600_000, interval: 5,
    }));
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_x", scopes: ["themes:push"] } });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ amended: true, scopes: ["themes:push", "themes:publish"], authorized_stores: ["hfc"] }),
    }) as unknown as typeof fetch;
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(tryCompletePendingAmend()).resolves.toBe(true);

    expect(writeConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ scopes: expect.arrayContaining(["themes:push", "themes:publish"]) }) }),
    );
    expect(unlinkSyncMock).toHaveBeenCalledTimes(1);
  });

  it("clears an expired pending amendment instead of exchanging it", async () => {
    readFileSyncMock.mockReturnValue(JSON.stringify({
      deviceCode: "cldc_x", tokenEndpoint: "https://kurumera.com/api/v1/cli/device/token/",
      verificationUri: "https://kurumera.com/device", requestedScope: "themes:publish",
      expiresAt: Date.now() - 1000, interval: 5,
    }));
    global.fetch = vi.fn() as unknown as typeof fetch;

    await expect(tryCompletePendingAmend()).resolves.toBe(false);
    expect(unlinkSyncMock).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
