import { afterEach, describe, expect, it, vi } from "vitest";

const readConfigMock = vi.fn(() => ({}) as Record<string, unknown>);
const writeConfigMock = vi.fn();
vi.mock("../util/config.js", () => ({
  readConfig: () => readConfigMock(),
  writeConfig: (cfg: unknown) => writeConfigMock(cfg),
  CONFIG_PATH: "/fake/.kurumera/config.json",
}));

const detectRemoteEnvironmentMock = vi.fn();
vi.mock("../util/environment.js", () => ({
  detectRemoteEnvironment: () => detectRemoteEnvironmentMock(),
}));

const deviceLoginMock = vi.fn();
vi.mock("../util/deviceAuth.js", () => ({
  deviceLogin: (apiUrl: string, scopes?: string[]) => deviceLoginMock(apiUrl, scopes),
}));

import { login } from "./login.js";

describe("login — device-flow dispatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    readConfigMock.mockReset().mockReturnValue({});
    writeConfigMock.mockReset();
    detectRemoteEnvironmentMock.mockReset();
    deviceLoginMock.mockReset();
  });

  it("--device forces the device flow even when the environment looks local", async () => {
    detectRemoteEnvironmentMock.mockReturnValue({ isRemote: false, reasons: [] });
    deviceLoginMock.mockResolvedValue({
      accessToken: "kcli_x", refreshToken: "kclr_x",
      expiresAt: Date.now() + 3600_000, scopes: ["themes:read"],
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device"]);

    expect(code).toBe(0);
    expect(deviceLoginMock).toHaveBeenCalled();
    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    const saved = writeConfigMock.mock.calls[0][0];
    expect(saved.auth.type).toBe("device");
    expect(saved.auth.accessToken).toBe("kcli_x");
  });

  it("auto-detects a remote environment and uses the device flow with no flags", async () => {
    detectRemoteEnvironmentMock.mockReturnValue({ isRemote: true, reasons: ["no interactive TTY"] });
    deviceLoginMock.mockResolvedValue({ accessToken: "kcli_y", scopes: [] });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login([]);

    expect(code).toBe(0);
    expect(deviceLoginMock).toHaveBeenCalled();
  });

  it("a device-login failure exits 1 and writes nothing to config", async () => {
    detectRemoteEnvironmentMock.mockReturnValue({ isRemote: false, reasons: [] });
    deviceLoginMock.mockRejectedValue(new Error("Authorization was denied."));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device"]);

    expect(code).toBe(1);
    expect(writeConfigMock).not.toHaveBeenCalled();
  });

  it("--token still takes the explicit storefront-token path, bypassing device flow entirely", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await login(["--token", "ksf_abc123"]);

    expect(code).toBe(0);
    expect(deviceLoginMock).not.toHaveBeenCalled();
    expect(detectRemoteEnvironmentMock).not.toHaveBeenCalled();
  });

  it("Ctrl+C during the device-flow wait prints a message, exits, and writes no partial config", async () => {
    detectRemoteEnvironmentMock.mockReturnValue({ isRemote: false, reasons: [] });
    let rejectDeviceLogin!: (e: Error) => void;
    deviceLoginMock.mockReturnValue(new Promise((_resolve, reject) => { rejectDeviceLogin = reject; }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const pending = login(["--device"]);
    // Let loginDevice's synchronous setup (including its SIGINT registration) run.
    await new Promise((r) => setImmediate(r));

    process.emit("SIGINT");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cancelled"));
    expect(exitSpy).toHaveBeenCalledWith(130);
    expect(writeConfigMock).not.toHaveBeenCalled();

    // Unstick the still-pending call so it doesn't leak into the next test.
    rejectDeviceLogin(new Error("test cleanup"));
    await pending.catch(() => {});
  });
});
