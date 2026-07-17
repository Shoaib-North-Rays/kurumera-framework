/**
 * Capture static screenshot thumbnails for every published marketplace theme.
 * Run inside the Playwright docker image with the shots dir mounted, e.g.:
 *
 *   docker run --rm --network website-builder_web \
 *     -e SHOTS_DIR=/shots \
 *     -v /home/ubuntu/theme-pushes/_shots:/shots \
 *     -v /home/ubuntu/kurumera-framework/ops/capture-screenshots.mjs:/capture.mjs \
 *     -e NODE_PATH=<global-node-modules> \
 *     mcr.microsoft.com/playwright:v1.49.0-jammy node /capture.mjs
 *
 * Reads the live registry, renders each theme's ?market=<slug> preview at a
 * desktop width, and writes <slug>.jpg. The push-service serves these at
 * /_push/market/shot?theme=<slug>; cards prefer them over the live iframe.
 * Re-run after publishing new themes to refresh thumbnails.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = (process.env.KURUMERA_MARKET_URL || "https://themekit.kurumera.com").replace(/\/+$/, "");
const OUT = process.env.SHOTS_DIR || "/shots";
const W = 1280, H = 900;

const res = await fetch(`${ORIGIN}/_push/market`);
const { themes = [] } = await res.json();
console.log(`capturing ${themes.length} theme(s) → ${OUT}`);

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
for (const t of themes) {
  const s = t.slug;
  const page = await ctx.newPage();
  try {
    await page.goto(`${ORIGIN}/?market=${encodeURIComponent(s)}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000); // let fonts/images settle
    const buf = await page.screenshot({ type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: W, height: H } });
    writeFileSync(join(OUT, `${s}.jpg`), buf);
    console.log(`  ✓ ${s} (${Math.round(buf.length / 1024)}kb)`);
  } catch (e) {
    console.error(`  ✗ ${s}: ${e.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log("done");
