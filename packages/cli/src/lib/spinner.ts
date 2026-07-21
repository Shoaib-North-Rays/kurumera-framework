/**
 * A colourful animated progress line for long waits (build / go-live). A rainbow
 * braille spinner + a shimmering gradient bar + rotating stage messages + elapsed
 * time. Degrades to a single static line when stdout isn't a TTY (CI / pipes), so
 * logs stay clean.
 */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// A smooth rainbow ramp of xterm-256 colours to cycle through.
const RAINBOW = [39, 45, 51, 50, 48, 46, 82, 118, 154, 190, 226, 220, 214, 208, 202, 196, 199, 201, 165, 129, 93, 57];
const BAR_W = 22;

const col = (n: number, s: string) => `\x1b[38;5;${n}m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

export interface Spinner {
  /** Stop the animation, clear the line, and (optionally) print a final line. */
  stop(final?: string): void;
}

export function startSpinner(messages: string[]): Spinner {
  const label = messages[0] || "Working";
  if (!process.stdout.isTTY) {
    process.stdout.write(`${label}…`);
    return { stop: (final) => process.stdout.write(`\n${final ? final + "\n" : ""}`) };
  }

  const start = Date.now();
  let i = 0;
  process.stdout.write("\x1b[?25l"); // hide cursor

  const timer = setInterval(() => {
    const spin = col(RAINBOW[i % RAINBOW.length], FRAMES[i % FRAMES.length]);
    const msg = messages[Math.floor(i / 22) % messages.length]; // rotate stage ~every 1.8s
    const head = i % (BAR_W + 8); // moving shimmer position
    let bar = "";
    for (let x = 0; x < BAR_W; x++) {
      bar += Math.abs(x - (head - 4)) <= 3
        ? col(RAINBOW[(i + x * 2) % RAINBOW.length], "▰") // bright moving band
        : dim("▱");
    }
    const secs = ((Date.now() - start) / 1000).toFixed(0);
    process.stdout.write(`\r ${spin} ${col(51, msg.padEnd(22))} ${bar} ${dim(secs + "s")}  `);
    i++;
  }, 80);

  return {
    stop: (final) => {
      clearInterval(timer);
      process.stdout.write("\r\x1b[K\x1b[?25h"); // clear line + show cursor
      if (final) process.stdout.write(final + "\n");
    },
  };
}
