// gen-og.mjs — rasterize og-image.svg → og-image.png (1200×630) for social cards.
// SVG OG images are not rendered by Facebook/X/LinkedIn/Slack; a PNG is required.
// Uses Playwright with the system Chrome (channel: 'chrome'). Run: node scripts/gen-og.mjs
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgUrl = pathToFileURL(join(ROOT, 'og-image.svg')).href;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(svgUrl, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  document.documentElement.style.margin = '0';
  if (document.body) document.body.style.margin = '0';
});
await page.screenshot({ path: join(ROOT, 'og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('og-image.png written (1200x630)');
