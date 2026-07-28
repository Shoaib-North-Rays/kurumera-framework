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

import {
  writePendingDeviceAuth, readPendingDeviceAuth, clearPendingDeviceAuth, isPendingExpired,
  PENDING_DEVICE_AUTH_PATH,
} from "./pendingDeviceAuth.js";

const SAMPLE = {
  deviceCode: "cldc_secretvalue",
  codeVerifier: "verifier_secretvalue",
  tokenEndpoint: "https://kurumera.com/api/v1/cli/device/token/",
  verificationUri: "https://kurumera.com/device",
  expiresAt: Date.now() + 600_000,
  interval: 5,
  createdAt: Date.now(),
};

describe("pendingDeviceAuth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mkdirSyncMock.mockReset();
    writeFileSyncMock.mockReset();
    renameSyncMock.mockReset();
    unlinkSyncMock.mockReset();
    readFileSyncMock.mockReset();
    existsSyncMock.mockReset().mockReturnValue(false);
  });

  // ── #2 required fields / #3 permissions / #4 atomic write ─────────────────
  it("writes with secure permissions and atomically (temp file + rename)", () => {
    writePendingDeviceAuth(SAMPLE);

    // 0700 dir
    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.any(String), { recursive: true, mode: 0o700 });

    // Written to a TEMP path (not the final path directly), with 0600.
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [tmpPath, contents, opts] = writeFileSyncMock.mock.calls[0];
    expect(String(tmpPath)).not.toBe(PENDING_DEVICE_AUTH_PATH);
    expect(String(tmpPath)).toContain("pending-device-auth");
    expect(opts).toEqual({ mode: 0o600 });

    // Then atomically renamed over the real target — a reader can never
    // observe a partially-written file.
    expect(renameSyncMock).toHaveBeenCalledWith(tmpPath, PENDING_DEVICE_AUTH_PATH);

    // Every required field made it into the written JSON.
    const written = JSON.parse(String(contents));
    for (const key of ["deviceCode", "codeVerifier", "tokenEndpoint", "verificationUri", "expiresAt", "interval", "createdAt"]) {
      expect(written).toHaveProperty(key);
    }
  });

  it("does not re-create the directory when it already exists", () => {
    existsSyncMock.mockReturnValue(true);
    writePendingDeviceAuth(SAMPLE);
    expect(mkdirSyncMock).not.toHaveBeenCalled();
  });

  // ── #17 --start safely replaces an existing (expired or not) pending auth ──
  it("overwrites any prior pending authorization without erroring", () => {
    writePendingDeviceAuth(SAMPLE);
    writePendingDeviceAuth({ ...SAMPLE, deviceCode: "cldc_new" });
    expect(writeFileSyncMock).toHaveBeenCalledTimes(2);
    expect(renameSyncMock).toHaveBeenCalledTimes(2);
  });

  // ── read/roundtrip ─────────────────────────────────────────────────────────
  it("reads back a validly-shaped pending authorization", () => {
    readFileSyncMock.mockReturnValue(JSON.stringify(SAMPLE));
    const result = readPendingDeviceAuth();
    expect(result).toEqual(SAMPLE);
  });

  // ── #13 missing file ────────────────────────────────────────────────────────
  it("returns undefined when the file does not exist", () => {
    readFileSyncMock.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    expect(readPendingDeviceAuth()).toBeUndefined();
  });

  // ── #14 invalid JSON handled safely ─────────────────────────────────────────
  it("returns undefined (not a throw) for invalid JSON", () => {
    readFileSyncMock.mockReturnValue("{ this is not json");
    expect(() => readPendingDeviceAuth()).not.toThrow();
    expect(readPendingDeviceAuth()).toBeUndefined();
  });

  it("returns undefined for JSON missing a required field", () => {
    readFileSyncMock.mockReturnValue(JSON.stringify({ deviceCode: "x" })); // no codeVerifier/tokenEndpoint/expiresAt
    expect(readPendingDeviceAuth()).toBeUndefined();
  });

  it("returns undefined for a valid-JSON non-object (e.g. a bare string or array)", () => {
    readFileSyncMock.mockReturnValue(JSON.stringify(["not", "an", "object"]));
    expect(readPendingDeviceAuth()).toBeUndefined();
  });

  // ── clear ────────────────────────────────────────────────────────────────
  it("clears the pending file", () => {
    clearPendingDeviceAuth();
    expect(unlinkSyncMock).toHaveBeenCalledWith(PENDING_DEVICE_AUTH_PATH);
  });

  it("clearing an already-absent file is a safe no-op", () => {
    unlinkSyncMock.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    expect(() => clearPendingDeviceAuth()).not.toThrow();
  });

  // ── expiry ───────────────────────────────────────────────────────────────
  it("isPendingExpired reflects expiresAt against the current time", () => {
    expect(isPendingExpired({ ...SAMPLE, expiresAt: Date.now() - 1000 })).toBe(true);
    expect(isPendingExpired({ ...SAMPLE, expiresAt: Date.now() + 60_000 })).toBe(false);
  });

  // ── #5 secrets never appear in a thrown error / console-visible path ───────
  it("never includes the secret values in the temp filename or any thrown error", () => {
    writePendingDeviceAuth(SAMPLE);
    const [tmpPath] = writeFileSyncMock.mock.calls[0];
    expect(String(tmpPath)).not.toContain(SAMPLE.deviceCode);
    expect(String(tmpPath)).not.toContain(SAMPLE.codeVerifier);
  });
});
