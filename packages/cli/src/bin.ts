#!/usr/bin/env node
/**
 * `kurumera` CLI entry point.
 *
 * P1 scaffold: the command surface is declared so `kurumera --help` is honest
 * about what's coming; `login`, `stores list`, `theme init`, and `theme dev`
 * are implemented next. Unimplemented commands exit non-zero with a clear note
 * rather than pretending to work.
 */

const COMMANDS: Record<string, string> = {
  login: "Authenticate this machine with your Kurumera account (device-code).",
  "stores list": "List the stores you can develop for.",
  "theme init": "Scaffold the official base Next.js theme.",
  "theme dev": "Run the theme locally against real store data.",
  "theme check": "Validate schema, types, route contract, and security.",
  "theme push": "Upload the theme as a new unpublished version.",
  "theme preview": "Open the preview URL for the uploaded build.",
  "theme publish": "Publish a successful build to the selected store.",
};

function help(): void {
  console.log("kurumera — Next.js theme framework CLI\n");
  console.log("Usage: kurumera <command> [options]\n");
  console.log("Commands:");
  for (const [name, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(16)} ${desc}`);
  }
}

const argv = process.argv.slice(2);
const cmd = argv.join(" ");

if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
  help();
  process.exit(0);
}

// P1: real handlers land here (login/init/dev). Until then, be explicit.
console.error(`\`kurumera ${cmd}\` is not implemented yet (P1 in progress).`);
console.error("Run `kurumera --help` to see the planned commands.");
process.exit(1);
