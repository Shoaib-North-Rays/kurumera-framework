/**
 * Capture static screenshot thumbnails for every published marketplace listing.
 * Run inside the Playwright docker image with the shots dir mounted, e.g.:
 *
 *   docker run --rm --network website-builder_web \
 *     -e SHOTS_DIR=/shots \
 *     -e BUILDER_ORIGIN=https://builder.kurumera.com \
 *     -v /home/ubuntu/theme-pushes/_shots:/shots \
 *     -v /home/ubuntu/kurumera-framework/ops/capture-screenshots.mjs:/capture.mjs \
 *     mcr.microsoft.com/playwright:v1.49.0-jammy node /capture.mjs
 *
 * For each listing it renders the correct preview — code themes via
 * `<market>/?market=<slug>`, builder designs via `<builder>/market-preview/<slug>`
 * — at a desktop width and writes <slug>.jpg. The push-service serves these at
 * /_push/market/shot?theme=<slug>; cards prefer them over the live iframe.
 *
 * Set ONLY=<slug> to capture a single listing (used by the auto-capture-on-publish
 * trigger). Re-run without ONLY to refresh every thumbnail.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = (process.env.KURUMERA_MARKET_URL || "https://themekit.kurumera.com").replace(/\/+$/, "");
const BUILDER = (process.env.BUILDER_ORIGIN || "https://builder.kurumera.com").replace(/\/+$/, "");
const OUT = process.env.SHOTS_DIR || "/shots";
const ONLY = (process.env.ONLY || "").trim();
const W = 1280, H = 900;

const res = await fetch(`${ORIGIN}/_push/market`);
let { themes = [] } = await res.json();
if (ONLY) themes = themes.filter((t) => t.slug === ONLY);
console.log(`capturing ${themes.length} listing(s) → ${OUT}${ONLY ? ` (only ${ONLY})` : ""}`);

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
let failures = 0;
for (const t of themes) {
  const s = t.slug;
  const isBuilder = t.type === "builder";
  const url = isBuilder
    ? `${BUILDER}/market-preview/${encodeURIComponent(s)}`
    : `${ORIGIN}/?market=${encodeURIComponent(s)}`;
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    // Builder previews are client-rendered — wait until real content has painted.
    await page
      .waitForFunction(() => document.body && document.body.innerText.trim().length > 40, { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(2000); // let fonts/images settle
    const buf = await page.screenshot({ type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: W, height: H } });
    writeFileSync(join(OUT, `${s}.jpg`), buf);
    console.log(`  ✓ ${s} [${t.type || "code"}] (${Math.round(buf.length / 1024)}kb)`);
  } catch (e) {
    failures++;
    console.error(`  ✗ ${s}: ${e.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log(`done (${failures} failure(s))`);
process.exit(failures && themes.length === 1 ? 1 : 0);
