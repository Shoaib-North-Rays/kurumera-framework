import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.fn((_path: string) => false);
const mkdirSyncMock = vi.fn((_path: string, _opts?: unknown) => undefined);
vi.mock("node:fs", () => ({
  existsSync: (path: string) => existsSyncMock(path),
  mkdirSync: (path: string, opts?: unknown) => mkdirSyncMock(path, opts),
}));

const homedirMock = vi.fn(() => "/home/testuser");
vi.mock("node:os", () => ({
  homedir: () => homedirMock(),
}));

import { resolveConfigDir, ensureConfigDir } from "./configDir.js";

describe("resolveConfigDir", () => {
  afterEach(() => {
    delete process.env.KURUMERA_CONFIG_DIR;
  });

  it("defaults to ~/.kurumera", () => {
    expect(resolveConfigDir()).toBe(join("/home/testuser", ".kurumera"));
  });

  it("respects KURUMERA_CONFIG_DIR when set — the fix for environments where homedir() isn't writable", () => {
    process.env.KURUMERA_CONFIG_DIR = "/tmp/kurumera-config";
    expect(resolveConfigDir()).toBe("/tmp/kurumera-config");
  });
});

describe("ensureConfigDir", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    existsSyncMock.mockReset().mockReturnValue(false);
    mkdirSyncMock.mockReset().mockReturnValue(undefined);
  });

  it("creates the directory with 0700 when it does not exist", () => {
    ensureConfigDir("/home/testuser/.kurumera");
    expect(mkdirSyncMock).toHaveBeenCalledWith("/home/testuser/.kurumera", { recursive: true, mode: 0o700 });
  });

  it("is a no-op when the directory already exists", () => {
    existsSyncMock.mockReturnValue(true);
    ensureConfigDir("/home/testuser/.kurumera");
    expect(mkdirSyncMock).not.toHaveBeenCalled();
  });

  // ── the actual bug report: HOME resolves to an unwritable /root in some
  // sandboxed agent environments — mkdir fails with a raw ENOENT/EACCES that
  // gives no hint how to fix it. ensureConfigDir must turn that into an
  // actionable error naming the escape hatch. ─────────────────────────────
  it("wraps a failed mkdir in an actionable error naming KURUMERA_CONFIG_DIR", () => {
    mkdirSyncMock.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT: no such file or directory, mkdir '/root/.kurumera'"), { code: "ENOENT" });
    });

    expect(() => ensureConfigDir("/root/.kurumera")).toThrow(/KURUMERA_CONFIG_DIR/);
    expect(() => ensureConfigDir("/root/.kurumera")).toThrow(/\/root\/\.kurumera/);
  });
});
