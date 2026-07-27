import { existsSync } from "node:fs";

export interface EnvironmentInfo {
  /** True when the CLI and a human's browser are likely on different
   *  machines — the existing loopback `kurumera login` can't work here. */
  isRemote: boolean;
  reasons: string[];
}

/**
 * Best-effort detection of a "remote" environment (SSH box, container, CI
 * runner, cloud AI-agent workspace) where a browser on the developer's own
 * machine cannot reach `http://127.0.0.1:<port>` on THIS machine.
 *
 * Deliberately conservative in the other direction too: when uncertain,
 * `login.ts` defaults to the device flow anyway (it works everywhere, just
 * with one extra step versus the loopback flow's zero-click redirect) —
 * this function only needs to be a good *hint*, not a perfect oracle.
 * Explicit `--device` / `--browser` flags always override it.
 */
export function detectRemoteEnvironment(): EnvironmentInfo {
  const reasons: string[] = [];

  if (!process.stdout.isTTY || !process.stdin.isTTY) reasons.push("no interactive TTY");
  if (truthyEnv(process.env.CI)) reasons.push("CI environment");
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY || process.env.SSH_CLIENT) reasons.push("SSH session");
  if (process.env.CODESPACES) reasons.push("GitHub Codespaces");
  if (process.env.GITPOD_WORKSPACE_ID) reasons.push("Gitpod workspace");
  if (process.env.GITHUB_ACTIONS) reasons.push("GitHub Actions");
  if (process.env.REMOTE_CONTAINERS) reasons.push("VS Code dev container");
  if (isDockerContainer()) reasons.push("Docker container");

  return { isRemote: reasons.length > 0, reasons };
}

function truthyEnv(v: string | undefined): boolean {
  return !!v && v !== "0" && v.toLowerCase() !== "false";
}

function isDockerContainer(): boolean {
  try {
    return existsSync("/.dockerenv");
  } catch {
    return false;
  }
}
