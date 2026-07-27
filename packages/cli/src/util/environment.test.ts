import { afterEach, describe, expect, it, vi } from "vitest";
import { detectRemoteEnvironment } from "./environment.js";

const ENV_KEYS = [
  "CI", "SSH_CONNECTION", "SSH_TTY", "SSH_CLIENT", "CODESPACES",
  "GITPOD_WORKSPACE_ID", "GITHUB_ACTIONS", "REMOTE_CONTAINERS",
] as const;

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

function withTty(isTTY: boolean, fn: () => void): void {
  // process.stdout.isTTY isn't always defined with a getter (depends on how
  // the process is spawned), so vi.spyOn(..., "get") can't reliably attach —
  // redefine the property directly instead, and restore the original after.
  const outOrig = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  const inOrig = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", { value: isTTY, configurable: true });
  Object.defineProperty(process.stdin, "isTTY", { value: isTTY, configurable: true });
  try {
    fn();
  } finally {
    if (outOrig) Object.defineProperty(process.stdout, "isTTY", outOrig);
    if (inOrig) Object.defineProperty(process.stdin, "isTTY", inOrig);
  }
}

describe("detectRemoteEnvironment", () => {
  afterEach(() => {
    clearEnv();
    vi.restoreAllMocks();
  });

  it("reports NOT remote on a normal interactive local dev machine", () => {
    clearEnv();
    withTty(true, () => {
      const result = detectRemoteEnvironment();
      expect(result.isRemote).toBe(false);
      expect(result.reasons).toEqual([]);
    });
  });

  it("reports remote when there is no interactive TTY", () => {
    withTty(false, () => {
      const result = detectRemoteEnvironment();
      expect(result.isRemote).toBe(true);
      expect(result.reasons).toContain("no interactive TTY");
    });
  });

  it("reports remote under CI=true", () => {
    withTty(true, () => {
      process.env.CI = "true";
      const result = detectRemoteEnvironment();
      expect(result.isRemote).toBe(true);
      expect(result.reasons).toContain("CI environment");
    });
  });

  it("does not treat CI=false as remote", () => {
    withTty(true, () => {
      process.env.CI = "false";
      const result = detectRemoteEnvironment();
      expect(result.reasons).not.toContain("CI environment");
    });
  });

  it("reports remote under an SSH session", () => {
    withTty(true, () => {
      process.env.SSH_CONNECTION = "10.0.0.1 22 10.0.0.2 22";
      const result = detectRemoteEnvironment();
      expect(result.isRemote).toBe(true);
      expect(result.reasons).toContain("SSH session");
    });
  });

  it("reports remote in GitHub Actions", () => {
    withTty(true, () => {
      process.env.GITHUB_ACTIONS = "true";
      const result = detectRemoteEnvironment();
      expect(result.isRemote).toBe(true);
      expect(result.reasons).toContain("GitHub Actions");
    });
  });

  it("reports remote in a GitHub Codespace", () => {
    withTty(true, () => {
      process.env.CODESPACES = "true";
      const result = detectRemoteEnvironment();
      expect(result.isRemote).toBe(true);
      expect(result.reasons).toContain("GitHub Codespaces");
    });
  });
});
