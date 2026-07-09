#!/usr/bin/env node
/**
 * `kurumera` CLI entry point.
 *
 * Implemented (P1): login (save storefront token), theme init, theme dev.
 * Planned  (P2+):   stores list, theme check/push/preview/publish, browser login.
 */
import { login } from "./commands/login.js";
import { themeInit } from "./commands/init.js";
import { themeDev } from "./commands/dev.js";
import { themeCheck } from "./commands/check.js";
import { themePush } from "./commands/push.js";
import { themePreview } from "./commands/preview.js";

const PLANNED: Record<string, string> = {
  "stores list": "List the stores you can develop for.",
  "theme publish": "Publish a successful build to the selected store.",
};

function help(): void {
  console.log("kurumera — Next.js theme framework CLI\n");
  console.log("Usage: kurumera <command> [options]\n");
  console.log("Available now:");
  console.log("  login                                Sign in via the browser");
  console.log("  theme init <name>                    Scaffold the base Next.js theme");
  console.log("  theme dev --store <slug>             Run the theme against live store data");
  console.log("  theme check                          Validate the route contract + safety rules");
  console.log("  theme push                           Upload the theme; the platform builds it");
  console.log("  theme preview --store <slug>         Open the built preview against a live store");
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
  if (a === "theme" && b === "init") return themeInit(rest[0]);
  if (a === "theme" && b === "check") return themeCheck();
  if (a === "theme" && b === "push") return themePush(rest);
  if (a === "theme" && b === "preview") return themePreview(rest);
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

dispatch().then((code) => {
  if (code !== 0) process.exit(code);
});
