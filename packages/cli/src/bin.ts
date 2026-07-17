#!/usr/bin/env node
/**
 * `kurumera` CLI entry point.
 *
 * Implemented (P1): login (save storefront token), theme init, theme dev.
 * Planned  (P2+):   stores list, theme check/push/preview/publish, browser login.
 */
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { themeInit } from "./commands/init.js";
import { themeDev } from "./commands/dev.js";
import { themeCheck } from "./commands/check.js";
import { themePush } from "./commands/push.js";
import { themePreview } from "./commands/preview.js";
import { themePublish, themeRollback } from "./commands/publish.js";
import { themeLogs } from "./commands/logs.js";
import { marketplace } from "./commands/marketplace.js";

const PLANNED: Record<string, string> = {
  "stores list": "List the stores you can develop for.",
};

function help(): void {
  console.log("kurumera — Next.js theme framework CLI\n");
  console.log("Usage: kurumera <command> [options]\n");
  console.log("Available now:");
  console.log("  login                                Sign in via the browser");
  console.log("  logout [--store <slug>]              Clear saved credentials (sign out)");
  console.log("  theme init <name>                    Scaffold the base Next.js theme");
  console.log("  theme dev --store <slug>             Run the theme against live store data");
  console.log("  theme check                          Validate the route contract + safety rules");
  console.log("  theme push                           Upload the theme; the platform builds it");
  console.log("  theme preview --store <slug>         Open the built preview against a live store");
  console.log("  theme publish --store <slug>         Make it the store's live theme (--off to unpublish)");
  console.log("  theme rollback --store <slug>        Restore the store's previous live version");
  console.log("  theme logs --store <slug>            Show the latest build log");
  console.log("\nMarketplace:");
  console.log("  marketplace publish --store <slug>   Publish this theme's build to the registry");
  console.log("  marketplace list                     Browse published themes");
  console.log("  marketplace info <theme>             Show a theme's versions");
  console.log("  marketplace install <theme>[@ver] --store <slug>");
  console.log("                                       Install a registry theme into a store (live)");
  console.log("\nComing next:");
  for (const [name, desc] of Object.entries(PLANNED)) {
    console.log(`  ${name.padEnd(36)} ${desc}`);
  }
}

const argv = process.argv.slice(2);

if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
  help();
  process.exit(0);
}

const [a, b, ...rest] = argv;

async function dispatch(): Promise<number> {
  if (a === "login") return login(argv.slice(1));
  if (a === "logout") return logout(argv.slice(1));
  if (a === "theme" && b === "init") return themeInit(rest[0]);
  if (a === "theme" && b === "check") return themeCheck();
  if (a === "theme" && b === "push") return themePush(rest);
  if (a === "theme" && b === "preview") return themePreview(rest);
  if (a === "theme" && b === "publish") return themePublish(rest);
  if (a === "theme" && b === "rollback") return themeRollback(rest);
  if (a === "theme" && b === "logs") return themeLogs(rest);
  if (a === "marketplace" || a === "market") return marketplace(argv.slice(1));
  // themeDev spawns `next dev`; on success it returns 0 and the child keeps the
  // process alive, so we must NOT exit(0) after it — only on its error code.
  if (a === "theme" && b === "dev") return themeDev(rest);

  const cmd = argv.join(" ");
  const planned = PLANNED[cmd] ?? PLANNED[`${a} ${b}`];
  if (planned) console.error(`\`kurumera ${cmd}\` arrives in P2 — ${planned}`);
  else {
    console.error(`Unknown command: kurumera ${cmd}`);
    console.error("Run `kurumera --help`.");
  }
  return 1;
}

// Set exitCode and let the event loop drain instead of process.exit(): forcing
// exit while undici's fetch socket is mid-close triggers a libuv assertion on
// Windows (src\win\async.c). themeDev returns 0 and keeps the child alive, so a
// 0 code must never exit here anyway.
dispatch()
  .then((code) => { if (code && code !== 0) process.exitCode = code; })
  .catch((e) => { console.error((e as Error)?.message || e); process.exitCode = 1; });
