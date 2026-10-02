// Renders app/icon.svg to the PNG icons home screens need:
// app/apple-icon.png (180), public/icon-192.png and public/icon-512.png.
// Usage: node scripts/render-icons.mjs [chromiumExecutablePath]
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const svg = await readFile("app/icon.svg", "utf8");
const browser = await chromium.launch(process.argv[2] ? { executablePath: process.argv[2] } : {});
for (const [size, out] of [[180, "app/apple-icon.png"], [192, "public/icon-192.png"], [512, "public/icon-512.png"]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out });
  await page.close();
  console.log(`Wrote ${out}`);
}
await browser.close();
