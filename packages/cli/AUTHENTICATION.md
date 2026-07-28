# Kurumera CLI — Authentication

The `kurumera` CLI has two ways to sign in. Both end up saving a session to
`~/.kurumera/config.json`; every other command (`theme push`, `theme
publish`, `theme preview`, `theme logs`, `theme rollback`) reads whichever
credential is available and just works.

**If `~/.kurumera` isn't writable in your environment** (some sandboxed
AI-agent runtimes report a `HOME` — e.g. `/root` — that doesn't exist or
isn't writable, causing an `ENOENT`/`EACCES` error), set
`KURUMERA_CONFIG_DIR` to a directory you know is writable and every command
in this doc uses it instead:

```bash
export KURUMERA_CONFIG_DIR=/tmp/kurumera-config
kurumera login --device --start
```

| Flow | When | Command |
|---|---|---|
| **Browser (loopback)** | The CLI and the browser you sign in with are the **same machine** — a normal local dev laptop. | `kurumera login` (auto), or `kurumera login --browser` |
| **Device** | The CLI and the approving browser are on **different machines** — SSH, a container, CI, or an AI coding agent running in its own sandboxed environment. | `kurumera login` (auto), or `kurumera login --device` |

`kurumera login` with no flags auto-detects which one you need (see
[Auto-detection](#auto-detection) below) — you don't usually have to pick.

## Browser (loopback) login

This is the original flow, unchanged. The CLI starts a one-shot local HTTP
server, opens your browser to the Kurumera dashboard, you sign in, and the
dashboard hands the session straight back to that local server. It only
works when your browser can reach `http://127.0.0.1:<port>` on the machine
running the CLI — i.e. they're the same machine.

```bash
kurumera login
# Opens your browser to kurumera.com/cli-auth?port=...
# → sign in → "Authorize" → back to your terminal, done.
```

## Device login (remote-safe)

For everything else: SSH sessions, Docker containers, GitHub Codespaces,
CI runners, or an AI coding agent (ChatGPT, Claude Code, Codex, Cursor,
etc.) working in its own environment. The CLI prints a short code and a
URL; you (or whoever has access to the store) open that URL on **any**
device — your phone, your own laptop, whatever has a browser — and approve
it there.

### Resumable (`--start` / `--complete`) — the default for hosted agents

Some hosted agent environments pause, restrict, or lose network access on
the process that's running the CLI in between tool calls — a single
long-running "poll until approved" process doesn't survive that. The
resumable flow splits login into two short-lived steps that can run in
**completely separate processes**, possibly minutes or hours apart:

```bash
kurumera login --device --start
```

```text
Open this URL in any browser:

  https://kurumera.com/device?user_code=HFC7-K2MP

Code: HFC7-K2MP

Authorization started successfully.

After approving access, run:

  kurumera login --device --complete
```

This exits immediately — no polling, nothing held open. It saves the
pending authorization to `~/.kurumera/pending-device-auth.json` (0600,
atomic write) so a **later, unrelated process** can pick it up. Open the
link, sign in, pick the store, click **Authorize** — then, whenever the
agent resumes (a fresh tool call, a new terminal, doesn't matter):

```bash
kurumera login --device --complete
```

```text
✓ Device authorization completed
✓ CLI session saved securely
✓ Scopes: stores:read, themes:read, themes:push, themes:preview, themes:publish

Next:

  kurumera theme push --store <slug>
```

If you run `--complete` before approving, it tells you so and leaves the
pending state in place — just run it again after approving:

```text
Authorization is still pending.

Approve the request in your browser, then run:

  kurumera login --device --complete
```

Plain `kurumera login --device` (no `--start`/`--complete`/`--wait`) does
the sensible thing automatically: completes an existing still-valid pending
authorization if one exists, otherwise starts a new one. Environment
auto-detection (see below) uses this same resumable behavior by default.

### Single-process (`--wait`) — the original flow

If a long-running foreground process is genuinely fine in your environment,
`--wait` starts and polls in one shot, same as before:

```bash
kurumera login --device --wait

# To sign in, open this link (on this machine or any other device):
#
#   https://kurumera.com/device?user_code=HFC7-K2MP
#
# Or go to https://kurumera.com/device and enter this code: HFC7-K2MP
#
# Waiting for you to authorize this device…
```

### Network note for hosted AI-agent sandboxes

Device-flow auth calls always go to the **public** `kurumera.com` origin —
never `admin.kurumera.com`, and never the saved commerce `--api-url` —
specifically so this works inside sandboxed agent environments (ChatGPT,
Codex, cloud AI workspaces) that only allow network egress to the domain
you actually connected them to. `kurumera.com` proxies `/api/v1/cli/*`
straight through to the real backend (the same same-origin-proxy pattern
already used for `/mcp`), so there's nothing to configure — it just works.
If you're pointed at a self-hosted or staging backend, override it with
`--auth-url` or `KURUMERA_AUTH_URL` (never `--api-url` — that flag is for
the commerce/storefront base URL, a separate concern):

```bash
kurumera login --device --start --auth-url https://staging.example.com/api/v1
# or
export KURUMERA_AUTH_URL=https://staging.example.com/api/v1
kurumera login --device --start
```

The device code expires after 10 minutes. If it does, `--complete` tells
you and clears the pending state — start again with `--start`.

### Auto-detection

With no flags, `kurumera login` looks for signs that the browser you'd use
to approve a loopback login probably isn't on this machine:

- no interactive TTY (piped input/output, common for AI agent tool calls)
- `CI=true` (or any CI env var — GitHub Actions, etc.)
- an active SSH session (`SSH_CONNECTION` / `SSH_TTY` / `SSH_CLIENT`)
- GitHub Codespaces / Gitpod / a VS Code dev container
- running inside a Docker container

If any of those are true, it uses the device flow. Otherwise it uses the
loopback flow — the exact same one-click experience as before. `--device`
and `--browser` always override the auto-detection.

## For AI agents (ChatGPT, Claude, Codex, etc.)

If you're an AI agent with shell access operating on a user's behalf,
follow this exact recipe. It's written to survive the thing that breaks a
naive approach: **your process may not stay alive or networked between
tool calls**, so never poll in a loop — use the resumable flow.

### First, know which kind of "doesn't persist" you're dealing with

These are two different problems with two different fixes — don't confuse
them:

- **Your process/tool-calls aren't continuous, but the workspace itself
  survives** (the common case — a normal ChatGPT/Claude/Codex session).
  `~/.kurumera` (or `$KURUMERA_CONFIG_DIR`) is still on disk between turns.
  **Use the device flow below as-is** — `--start` in one tool call,
  `--complete` in a later one, works fine.
- **The whole workspace/container gets destroyed and rebuilt between runs**
  (a fresh sandbox every session, no mounted volume). In this case
  **nothing saved to disk survives, no matter which flow you use** — a
  device-flow session, `KURUMERA_CONFIG_DIR` pointed at scratch space, none
  of it lasts past the rebuild. You have exactly two real options:
  1. Get whoever operates your sandbox to mount a persistent volume at
     `~/.kurumera` (or set `KURUMERA_CONFIG_DIR` to a path they already
     persist) — then the device flow below works and only needs approving
     once, ever.
  2. If that's not possible, skip the device flow entirely: have the human
     issue a standing token from **Settings → CLI tokens** in the
     dashboard and inject it as `KURUMERA_CLI_TOKEN` at the START of every
     run (an environment variable your sandbox's operator sets, not
     something the CLI persists). See
     [CI/CD and automation](#cicd-and-automation-no-interactive-login).

If you're not sure which case you're in, try the device flow first — if
`kurumera stores list` reports "Not signed in" on a run where you're
confident a previous run already completed `--complete` successfully,
that's the signal you're in the second case.

1. **Check whether you're already signed in** with a harmless authenticated
   command:
   ```bash
   kurumera stores list
   ```
   If it succeeds, skip to step 5.

2. **Start authorization** — exits immediately, no polling:
   ```bash
   npx @kurumera/cli@latest login --device --start
   ```
   This prints a URL and a short code, e.g.:
   ```text
   Open this URL in any browser:
     https://kurumera.com/device?user_code=ABCD-1234
   Code: ABCD-1234
   ```

3. **Hand the URL to the human user** and ask them to open it, sign in,
   pick the store, and click Authorize. Do not try to open a browser
   yourself and do not poll in a tight loop — just wait for the user's next
   message. It's fine if that's a completely separate turn, tool call, or
   session; the pending authorization survives on disk until it expires
   (10 minutes) or you use it.

4. **Complete it** — one attempt, safe to run from a fresh tool call at any
   point after step 2:
   ```bash
   npx @kurumera/cli@latest login --device --complete
   ```
   - `✓ Device authorization completed` → done, go to step 5.
   - `Authorization is still pending.` → the user hasn't approved yet. Ask
     them to, then re-run this exact command once they confirm — don't loop
     tightly on it.
   - `Authorization was denied.` or `has expired.` → go back to step 2.

5. **Proceed with the actual task** — `kurumera theme push --store <slug>`,
   `publish`, `logs`, etc. The session is now saved; no further auth steps
   are needed unless a command later fails with 401/403, in which case
   repeat from step 2.

For a non-interactive pipeline instead of a human-approval flow, use a
standing token from **Settings → CLI tokens** in the dashboard and set
`KURUMERA_CLI_TOKEN` instead of any of the above (see
[CI/CD and automation](#cicd-and-automation-no-interactive-login) below).

## Scopes

A device-flow session is granted specific scopes — what it can actually do,
not just "logged in or not":

| Scope | Grants |
|---|---|
| `stores:read` | List the stores you have access to |
| `themes:read` | View theme status and publish history |
| `themes:push` | Upload new theme versions (`theme push`) |
| `themes:preview` | Open theme previews (`theme preview`) |
| `themes:publish` | Publish / unpublish (`theme publish`, `theme publish --off`) |
| `themes:rollback` | Roll back to a previous version (`theme rollback`) |
| `themes:logs` | View build logs (`theme logs`) |
| `marketplace:read` | Browse the marketplace |
| `marketplace:publish` | Publish a listing |
| `marketplace:install` | Install a marketplace theme into a store |

These are enforced **on the server**, not just by the CLI — a session with
only `themes:push` genuinely cannot publish, even if the CLI itself were
compromised or bypassed. When you approve a device on `/device`, you can see
exactly what it's asking for before you click Authorize.

## CI/CD and automation (no interactive login)

For a pipeline, a Docker build step, or a long-running/always-on AI agent
that shouldn't have to do an interactive device-flow approval every run,
issue a standing token from the dashboard instead:

**Settings → CLI tokens → Create CLI token.** Pick a name, the scopes it
actually needs (least privilege — a deploy step usually only needs
`themes:push` + `themes:publish`), and an expiry. Copy the token — it's
shown once.

Set it as an environment variable; the CLI checks this **before** anything
saved by `kurumera login`, and — importantly — **never writes it to disk**:

```bash
export KURUMERA_CLI_TOKEN=kcli_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
kurumera theme push --store your-store
kurumera theme publish --store your-store
```

### GitHub Actions example

```yaml
- name: Push and publish theme
  env:
    KURUMERA_CLI_TOKEN: ${{ secrets.KURUMERA_CLI_TOKEN }}
  run: |
    npx @kurumera/cli theme push --store your-store
    npx @kurumera/cli theme publish --store your-store
```

Store the token in your CI platform's own secret manager (GitHub Actions
secrets, GitLab CI/CD variables, etc.) — never commit it to a repo.

## Revoking access

- **From the CLI, on the machine that's signed in:** `kurumera logout`.
  This clears the local session AND best-effort revokes it on the server
  (so a copy of the old token elsewhere stops working too). Local sign-out
  always happens even if the network call fails or times out.
- **From the dashboard (works for ANY session, including ones you've lost
  access to):** Settings → CLI tokens → **Revoke**. Takes effect
  immediately — a live token in the middle of a request gets rejected on
  its very next call.

## Troubleshooting

**"This device code has expired."**
Device codes are valid for 10 minutes. Run `kurumera login --device` again.

**"Authorization was denied."**
Someone clicked **Deny** on `/device` instead of Authorize (or you did).
Run the login command again if this wasn't intentional.

**A command says "Not signed in" even though I ran `kurumera login`.**
Check whether `KURUMERA_CLI_TOKEN` is set in your shell — it always takes
priority over a saved login, and an expired/wrong value there will shadow a
perfectly good saved session. `unset KURUMERA_CLI_TOKEN` to fall back to
your saved login.

**`theme publish` (or `rollback`/`push`) fails with a 403 mentioning a
scope, even though I'm signed in.**
Your session doesn't have that scope. If it's a device-flow login, sign out
and back in, and make sure the scope you need is granted on `/device` before
clicking Authorize. If it's a `KURUMERA_CLI_TOKEN` from Settings → CLI
tokens, edit/recreate the token with the scope added.

**I don't have a browser on the machine running the CLI at all (pure
headless/AI-agent sandbox).**
That's exactly what the device flow is for — the approving browser doesn't
need to be anywhere near the CLI. Copy the printed URL (or just the code)
out of the terminal/agent output and open it anywhere else.

**`ENOENT: no such file or directory, mkdir '/root/.kurumera'`** (or any
other error creating `~/.kurumera`).
The environment's reported home directory doesn't exist or isn't writable —
seen in some sandboxed AI-agent runtimes. Set `KURUMERA_CONFIG_DIR` to a
directory you know is writable and retry:
```bash
export KURUMERA_CONFIG_DIR=/tmp/kurumera-config
kurumera login --device --start
```
