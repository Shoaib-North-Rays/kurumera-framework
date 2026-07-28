import { afterEach, describe, expect, it, vi } from "vitest";

const readConfigMock = vi.fn(() => ({}) as Record<string, unknown>);
vi.mock("../util/config.js", () => ({
  readConfig: () => readConfigMock(),
}));

const resolveAuthTokenMock = vi.fn();
vi.mock("../util/resolveAuthToken.js", () => ({
  resolveAuthToken: () => resolveAuthTokenMock(),
}));

vi.mock("../util/authUrl.js", () => ({
  resolveAuthUrl: () => "https://kurumera.com/api/v1",
}));

import { storesList, storesAdd } from "./stores.js";

function resetAll(): void {
  vi.restoreAllMocks();
  readConfigMock.mockReset().mockReturnValue({});
  resolveAuthTokenMock.mockReset();
}

describe("storesList — Bug fix: reflect a device-flow session's real authorization", () => {
  afterEach(resetAll);

  it("queries the server and lists the session's authorized stores when a device session is active", async () => {
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_x", scopes: ["themes:push"] } });
    resolveAuthTokenMock.mockResolvedValue("kcli_x");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "abc", name: "Device login", authorized_stores: ["hfc", "other-store"] }),
    }) as unknown as typeof fetch;
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { logs.push(a.join(" ")); });

    const code = await storesList();

    expect(code).toBe(0);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://kurumera.com/api/v1/cli/session/me/",
      expect.objectContaining({ headers: { Authorization: "Bearer kcli_x" } }),
    );
    const out = logs.join("\n");
    expect(out).toContain("hfc");
    expect(out).toContain("other-store");
  });

  it("never claims 'No stores yet' for a device session just because local config fields are empty", async () => {
    // This is the exact regression: a device-flow login never populates
    // cfg.defaultStore/cfg.stores, so the OLD implementation (pure local
    // echo) always printed "No stores yet" here even with a valid,
    // server-authorized session.
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_x", scopes: [] } });
    resolveAuthTokenMock.mockResolvedValue("kcli_x");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ id: "abc", authorized_stores: ["hfc"] }),
    }) as unknown as typeof fetch;
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { logs.push(a.join(" ")); });

    await storesList();
    expect(logs.join("\n")).not.toContain("No stores yet");
  });

  it("falls back to the legacy local echo for a loopback-flow session (no cfg.auth)", async () => {
    readConfigMock.mockReturnValue({ defaultStore: "hfc" });
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { logs.push(a.join(" ")); });

    const code = await storesList();

    expect(code).toBe(0);
    expect(logs.join("\n")).toContain("hfc");
  });
});

describe("storesAdd", () => {
  afterEach(resetAll);

  it("requires a device/manual connection", async () => {
    readConfigMock.mockReturnValue({});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await storesAdd("other-store");
    expect(code).toBe(1);
  });

  it("resolves the calling session's own id before requesting a new store", async () => {
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_x", scopes: ["themes:push"] } });
    resolveAuthTokenMock.mockResolvedValue("kcli_x");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "session-uuid-1", authorized_stores: ["hfc"] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ device_code: "cldc_x", user_code: "AAAA-BBBB", verification_uri: "https://kurumera.com/device" }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await storesAdd("other-store");

    expect(code).toBe(0);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://kurumera.com/api/v1/cli/sessions/session-uuid-1/stores/request/", expect.anything());
  });

  it("short-circuits with success when the store is already authorized", async () => {
    readConfigMock.mockReturnValue({ auth: { type: "device", accessToken: "kcli_x", scopes: ["themes:push"] } });
    resolveAuthTokenMock.mockResolvedValue("kcli_x");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ id: "session-uuid-1", authorized_stores: ["hfc"] }),
    }) as unknown as typeof fetch;
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { logs.push(a.join(" ")); });

    const code = await storesAdd("hfc");
    expect(code).toBe(0);
    expect(logs.join("\n")).toContain("Already authorized");
  });
});
