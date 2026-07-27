# Kurumera CLI — Authentication

The `kurumera` CLI has two ways to sign in. Both end up saving a session to
`~/.kurumera/config.json`; every other command (`theme push`, `theme
publish`, `theme preview`, `theme logs`, `theme rollback`) reads whichever
credential is available and just works.

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
CI runners, or an AI coding agent (Claude Code, Codex, Cursor, etc.) working
in its own environment. The CLI prints a short code and a URL; you (or
whoever has access to the store) open that URL on **any** device — your
phone, your own laptop, whatever has a browser — and approve it there.

```bash
kurumera login --device

# To sign in, open this link (on this machine or any other device):
#
#   https://kurumera.com/device?user_code=HFC7-K2MP
#
# Or go to https://kurumera.com/device and enter this code: HFC7-K2MP
#
# Waiting for you to authorize this device…
```

Open the link (or go to `kurumera.com/device` and type the code), sign in
if you aren't already, pick the store, and click **Authorize**. The CLI
picks this up within a few seconds and finishes on its own — no need to
switch back to the terminal to press anything.

The code expires after 10 minutes. If it does, just run the command again.

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
