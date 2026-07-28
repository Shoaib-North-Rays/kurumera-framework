import { execFileSync } from "node:child_process";

/**
 * Best-effort OS keychain / credential-manager backup for the current
 * platform — macOS Keychain (`security`), Windows Credential Manager
 * (PowerShell `CredentialManager` cmdlets, falling back to `cmdkey` for
 * read-back availability checks), Linux Secret Service (`secret-tool`).
 *
 * Deliberately NOT a `keytar`-style native-binding npm dependency: this
 * package has zero runtime dependencies by design, and the actual target
 * environment for this CLI's remote-safe auth work is an ephemeral,
 * frequently-headless AI-agent sandbox (see AUTHENTICATION.md) — those have
 * no OS keychain at all, and a native binding is a real fragility risk for
 * something that must `npx`-install cleanly there. So this module only ever
 * helps the SEPARATE "local developer machine" case (item 11's "otherwise
 * use OS keychain locally"), and only when a supported platform tool is
 * actually present.
 *
 * Current integration depth: a best-effort, redundant BACKUP of the saved
 * session, written alongside the existing 0600 `~/.kurumera/config.json`
 * (which remains authoritative and unchanged) — not yet consulted as a read
 * source by resolveAuthToken.ts. That file is already correct and simple;
 * this exists so a user who loses `~/.kurumera` (a wiped home directory, a
 * fresh container) can recover a LOCAL loopback-flow session without
 * re-authenticating, via `readFromKeychain()`, called explicitly rather than
 * silently on every resolveAuthToken() call.
 */

const SERVICE_NAME = "kurumera-cli";
const ACCOUNT_NAME = "default";

function run(cmd: string, args: string[]): string | undefined {
  try {
    return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).toString("utf8").trim();
  } catch {
    return undefined;
  }
}

function toolAvailable(cmd: string, versionArgs: string[]): boolean {
  return run(cmd, versionArgs) !== undefined;
}

export function isKeychainAvailable(): boolean {
  if (process.platform === "darwin") return toolAvailable("security", ["help"]);
  if (process.platform === "win32") return toolAvailable("powershell", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion"]);
  if (process.platform === "linux") return toolAvailable("secret-tool", ["--version"]) || toolAvailable("which", ["secret-tool"]);
  return false;
}

/** Best-effort — never throws. Returns true iff the secret was actually saved. */
export function saveToKeychain(secret: string): boolean {
  try {
    if (process.platform === "darwin") {
      run("security", ["delete-generic-password", "-s", SERVICE_NAME, "-a", ACCOUNT_NAME]);
      return run("security", ["add-generic-password", "-s", SERVICE_NAME, "-a", ACCOUNT_NAME, "-w", secret, "-U"]) !== undefined;
    }
    if (process.platform === "win32") {
      const script = `Import-Module CredentialManager -ErrorAction Stop; New-StoredCredential -Target '${SERVICE_NAME}' -UserName '${ACCOUNT_NAME}' -Password '${secret.replace(/'/g, "''")}' -Persist LocalMachine | Out-Null`;
      return run("powershell", ["-NoProfile", "-Command", script]) !== undefined;
    }
    if (process.platform === "linux") {
      execFileSync("secret-tool", ["store", "--label", SERVICE_NAME, "service", SERVICE_NAME, "account", ACCOUNT_NAME], {
        input: secret, stdio: ["pipe", "ignore", "ignore"], timeout: 3000,
      });
      return true;
    }
  } catch {
    /* best-effort — the primary ~/.kurumera save already succeeded regardless */
  }
  return false;
}

/** Best-effort — never throws. Returns the secret, or undefined if unavailable/not found. */
export function readFromKeychain(): string | undefined {
  if (process.platform === "darwin") {
    return run("security", ["find-generic-password", "-s", SERVICE_NAME, "-a", ACCOUNT_NAME, "-w"]);
  }
  if (process.platform === "win32") {
    const script = `Import-Module CredentialManager -ErrorAction Stop; (Get-StoredCredential -Target '${SERVICE_NAME}').GetNetworkCredential().Password`;
    return run("powershell", ["-NoProfile", "-Command", script]);
  }
  if (process.platform === "linux") {
    return run("secret-tool", ["lookup", "service", SERVICE_NAME, "account", ACCOUNT_NAME]);
  }
  return undefined;
}

/** Best-effort cleanup — called from `kurumera logout`. Never throws. */
export function deleteFromKeychain(): void {
  try {
    if (process.platform === "darwin") run("security", ["delete-generic-password", "-s", SERVICE_NAME, "-a", ACCOUNT_NAME]);
    else if (process.platform === "win32") run("powershell", ["-NoProfile", "-Command", `Import-Module CredentialManager -ErrorAction Stop; Remove-StoredCredential -Target '${SERVICE_NAME}'`]);
    else if (process.platform === "linux") run("secret-tool", ["clear", "service", SERVICE_NAME, "account", ACCOUNT_NAME]);
  } catch {
    /* best-effort */
  }
}
