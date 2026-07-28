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

const startDeviceAuthorizationMock = vi.fn();
const exchangeDeviceCodeMock = vi.fn();
vi.mock("../util/deviceAuth.js", () => ({
  startDeviceAuthorization: (apiUrl: string, scopes?: string[]) => startDeviceAuthorizationMock(apiUrl, scopes),
  exchangeDeviceCode: (tokenEndpoint: string, deviceCode: string, codeVerifier: string) =>
    exchangeDeviceCodeMock(tokenEndpoint, deviceCode, codeVerifier),
}));

const readPendingDeviceAuthMock = vi.fn();
const writePendingDeviceAuthMock = vi.fn();
const clearPendingDeviceAuthMock = vi.fn();
vi.mock("../util/pendingDeviceAuth.js", () => ({
  readPendingDeviceAuth: () => readPendingDeviceAuthMock(),
  writePendingDeviceAuth: (p: unknown) => writePendingDeviceAuthMock(p),
  clearPendingDeviceAuth: () => clearPendingDeviceAuthMock(),
  isPendingExpired: (p: { expiresAt: number }) => Date.now() >= p.expiresAt,
}));

import { login } from "./login.js";

const SAMPLE_START = {
  deviceCode: "cldc_secretdevicecode",
  userCode: "ABCD-EFGH",
  verificationUri: "https://kurumera.com/device",
  verificationUriComplete: "https://kurumera.com/device?user_code=ABCD-EFGH",
  codeVerifier: "secretverifier",
  expiresIn: 600,
  interval: 5,
};

const VALID_PENDING = {
  deviceCode: "cldc_secretdevicecode",
  codeVerifier: "secretverifier",
  tokenEndpoint: "https://kurumera.com/api/v1/cli/device/token/",
  verificationUri: "https://kurumera.com/device",
  expiresAt: Date.now() + 600_000,
  interval: 5,
  createdAt: Date.now(),
};

function resetAll(): void {
  vi.restoreAllMocks();
  readConfigMock.mockReset().mockReturnValue({});
  writeConfigMock.mockReset();
  detectRemoteEnvironmentMock.mockReset().mockReturnValue({ isRemote: false, reasons: [] });
  startDeviceAuthorizationMock.mockReset();
  exchangeDeviceCodeMock.mockReset();
  readPendingDeviceAuthMock.mockReset().mockReturnValue(undefined);
  writePendingDeviceAuthMock.mockReset();
  clearPendingDeviceAuthMock.mockReset();
}

// ── --start: #1, #2, #5, #17, #21, #22 ──────────────────────────────────────
describe("login --device --start", () => {
  afterEach(resetAll);

  it("starts authorization, persists pending state, and exits WITHOUT polling", async () => {
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--start"]);

    expect(code).toBe(0);
    expect(startDeviceAuthorizationMock).toHaveBeenCalledTimes(1);
    expect(exchangeDeviceCodeMock).not.toHaveBeenCalled();
    expect(writePendingDeviceAuthMock).toHaveBeenCalledTimes(1);

    const pending = writePendingDeviceAuthMock.mock.calls[0][0] as Record<string, unknown>;
    for (const key of ["deviceCode", "codeVerifier", "tokenEndpoint", "verificationUri", "expiresAt", "interval", "createdAt"]) {
      expect(pending).toHaveProperty(key);
    }
    expect(pending.deviceCode).toBe(SAMPLE_START.deviceCode);
    expect(pending.codeVerifier).toBe(SAMPLE_START.codeVerifier);
  });

  it("uses the public kurumera.com origin by default, ignoring any saved config.apiUrl", async () => {
    readConfigMock.mockReturnValue({ apiUrl: "https://admin.kurumera.com/api/v1" });
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await login(["--device", "--start"]);

    expect(startDeviceAuthorizationMock).toHaveBeenCalledWith("https://kurumera.com/api/v1", undefined);
  });

  it("respects --auth-url", async () => {
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await login(["--device", "--start", "--auth-url", "https://staging.example.com/api/v1"]);
    expect(startDeviceAuthorizationMock).toHaveBeenCalledWith("https://staging.example.com/api/v1", undefined);
  });

  it("never prints the device code or PKCE verifier — only the human-facing user code", async () => {
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); });

    await login(["--device", "--start"]);

    const joined = logs.join("\n");
    expect(joined).not.toContain(SAMPLE_START.deviceCode);
    expect(joined).not.toContain(SAMPLE_START.codeVerifier);
    expect(joined).toContain(SAMPLE_START.userCode);
  });

  it("safely replaces an existing pending authorization (expired or not), with no error", async () => {
    readPendingDeviceAuthMock.mockReturnValue({ ...VALID_PENDING, expiresAt: Date.now() - 1000 });
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--start"]);
    expect(code).toBe(0);
    expect(writePendingDeviceAuthMock).toHaveBeenCalledTimes(1);
  });

  it("reports a clear error and does not write pending state when authorize fails", async () => {
    startDeviceAuthorizationMock.mockRejectedValue(new Error("Could not start device authorization (400)."));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await login(["--device", "--start"]);
    expect(code).toBe(1);
    expect(writePendingDeviceAuthMock).not.toHaveBeenCalled();
  });
});

// ── --complete: #6, #7, #8, #9, #10, #11, #12, #13, #15, #16, #24 ──────────
describe("login --device --complete", () => {
  afterEach(resetAll);

  it("exchanges an approved authorization and saves the session in the EXISTING config format", async () => {
    readPendingDeviceAuthMock.mockReturnValue(VALID_PENDING);
    exchangeDeviceCodeMock.mockResolvedValue({
      ok: true,
      result: { accessToken: "kcli_x", refreshToken: "kclr_x", expiresAt: 1999999999000, scopes: ["themes:push", "themes:read"] },
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--complete"]);

    expect(code).toBe(0);
    expect(exchangeDeviceCodeMock).toHaveBeenCalledWith(VALID_PENDING.tokenEndpoint, VALID_PENDING.deviceCode, VALID_PENDING.codeVerifier);
    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    const saved = writeConfigMock.mock.calls[0][0] as { auth: Record<string, unknown> };
    expect(saved.auth).toEqual({
      type: "device", accessToken: "kcli_x", refreshToken: "kclr_x",
      expiresAt: 1999999999000, scopes: ["themes:push", "themes:read"],
    });
    expect(clearPendingDeviceAuthMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the pending state for authorization_pending", async () => {
    readPendingDeviceAuthMock.mockReturnValue(VALID_PENDING);
    exchangeDeviceCodeMock.mockResolvedValue({ ok: false, error: { error: "authorization_pending", httpStatus: 400 } });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--complete"]);
    expect(code).toBe(1);
    expect(clearPendingDeviceAuthMock).not.toHaveBeenCalled();
  });

  it("keeps the pending state for slow_down", async () => {
    readPendingDeviceAuthMock.mockReturnValue(VALID_PENDING);
    exchangeDeviceCodeMock.mockResolvedValue({ ok: false, error: { error: "slow_down", httpStatus: 429 } });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--complete"]);
    expect(code).toBe(1);
    expect(clearPendingDeviceAuthMock).not.toHaveBeenCalled();
  });

  it("clears the pending state on access_denied", async () => {
    readPendingDeviceAuthMock.mockReturnValue(VALID_PENDING);
    exchangeDeviceCodeMock.mockResolvedValue({ ok: false, error: { error: "access_denied", httpStatus: 400 } });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--complete"]);
    expect(code).toBe(1);
    expect(clearPendingDeviceAuthMock).toHaveBeenCalledTimes(1);
  });

  it("clears the pending state when it has already expired, without touching the network", async () => {
    readPendingDeviceAuthMock.mockReturnValue({ ...VALID_PENDING, expiresAt: Date.now() - 1000 });
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--complete"]);
    expect(code).toBe(1);
    expect(exchangeDeviceCodeMock).not.toHaveBeenCalled();
    expect(clearPendingDeviceAuthMock).toHaveBeenCalledTimes(1);
  });

  it("clears the pending state on an unrecoverable invalid_grant (PKCE mismatch or a consumed device code)", async () => {
    readPendingDeviceAuthMock.mockReturnValue(VALID_PENDING);
    exchangeDeviceCodeMock.mockResolvedValue({
      ok: false, error: { error: "invalid_grant", errorDescription: "PKCE verification failed.", httpStatus: 400 },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login(["--device", "--complete"]);
    expect(code).toBe(1);
    expect(clearPendingDeviceAuthMock).toHaveBeenCalledTimes(1);
  });

  it("reports an actionable message when no pending state exists", async () => {
    readPendingDeviceAuthMock.mockReturnValue(undefined);
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); });

    const code = await login(["--device", "--complete"]);
    expect(code).toBe(1);
    expect(exchangeDeviceCodeMock).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("No pending device authorization");
  });

  it("never prints the access or refresh token", async () => {
    readPendingDeviceAuthMock.mockReturnValue(VALID_PENDING);
    exchangeDeviceCodeMock.mockResolvedValue({
      ok: true,
      result: { accessToken: "kcli_supersecret", refreshToken: "kclr_supersecret", expiresAt: Date.now() + 3600_000, scopes: ["themes:read"] },
    });
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); });

    await login(["--device", "--complete"]);
    const joined = logs.join("\n");
    expect(joined).not.toContain("kcli_supersecret");
    expect(joined).not.toContain("kclr_supersecret");
  });
});

// ── bare --device: resume-or-start, and remote auto-detection — #20 ────────
describe("login --device (no sub-flag: resume-or-start)", () => {
  afterEach(resetAll);

  it("completes an existing valid pending authorization instead of starting a new one", async () => {
    readPendingDeviceAuthMock.mockReturnValue(VALID_PENDING);
    exchangeDeviceCodeMock.mockResolvedValue({ ok: true, result: { accessToken: "kcli_x", expiresAt: Date.now() + 3600_000, scopes: [] } });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await login(["--device"]);
    expect(exchangeDeviceCodeMock).toHaveBeenCalledTimes(1);
    expect(startDeviceAuthorizationMock).not.toHaveBeenCalled();
  });

  it("starts a new authorization when no pending state exists", async () => {
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await login(["--device"]);
    expect(startDeviceAuthorizationMock).toHaveBeenCalledTimes(1);
    expect(exchangeDeviceCodeMock).not.toHaveBeenCalled();
  });

  it("starts a new authorization when the existing pending state has expired", async () => {
    readPendingDeviceAuthMock.mockReturnValue({ ...VALID_PENDING, expiresAt: Date.now() - 1000 });
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await login(["--device"]);
    expect(startDeviceAuthorizationMock).toHaveBeenCalledTimes(1);
  });
});

describe("login — remote-environment auto-detection selects the resumable device flow", () => {
  afterEach(resetAll);

  it("uses the device flow (not the loopback flow) when the environment looks remote", async () => {
    detectRemoteEnvironmentMock.mockReturnValue({ isRemote: true, reasons: ["no interactive TTY"] });
    startDeviceAuthorizationMock.mockResolvedValue(SAMPLE_START);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await login([]);
    expect(code).toBe(0);
    expect(startDeviceAuthorizationMock).toHaveBeenCalledTimes(1);
  });
});

// ── --wait preserves the original single-process behavior — #18 ────────────
describe("login --device --wait", () => {
  afterEach(resetAll);

  it("polls this same process until approved, then saves the session", async () => {
    startDeviceAuthorizationMock.mockResolvedValue({ ...SAMPLE_START, interval: 1, expiresIn: 30 });
    exchangeDeviceCodeMock
      .mockResolvedValueOnce({ ok: false, error: { error: "authorization_pending", httpStatus: 400 } })
      .mockResolvedValueOnce({ ok: true, result: { accessToken: "kcli_ok", expiresAt: Date.now() + 3600_000, scopes: ["themes:read"] } });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers();

    const promise = login(["--device", "--wait"]);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const code = await promise;

    vi.useRealTimers();
    expect(code).toBe(0);
    expect(exchangeDeviceCodeMock).toHaveBeenCalledTimes(2);
    expect(writeConfigMock).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+C during the wait exits cleanly with no config write from this process", async () => {
    startDeviceAuthorizationMock.mockReturnValue(new Promise(() => { /* never resolves */ }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const pending = login(["--device", "--wait"]);
    await new Promise((r) => setImmediate(r));
    process.emit("SIGINT");

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cancelled"));
    expect(exitSpy).toHaveBeenCalledWith(130);
    expect(writeConfigMock).not.toHaveBeenCalled();

    exitSpy.mockRestore();
    void pending.catch(() => { /* leave it be — the mock never resolves */ });
  });
});

// ── --token / --browser dispatch is unaffected by any of the above ─────────
describe("login --token bypasses device flow entirely (unaffected by this feature)", () => {
  afterEach(resetAll);

  it("--token still takes the explicit storefront-token path", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await login(["--token", "ksf_abc123"]);
    expect(code).toBe(0);
    expect(startDeviceAuthorizationMock).not.toHaveBeenCalled();
    expect(exchangeDeviceCodeMock).not.toHaveBeenCalled();
    expect(detectRemoteEnvironmentMock).not.toHaveBeenCalled();
  });
});
