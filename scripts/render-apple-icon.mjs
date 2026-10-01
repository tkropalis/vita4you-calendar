// Renders app/icon.svg to app/apple-icon.png (180×180) with headless Chromium.
// Usage: node scripts/render-apple-icon.mjs [chromiumExecutablePath]
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const svg = await readFile("app/icon.svg", "utf8");
const browser = await chromium.launch(process.argv[2] ? { executablePath: process.argv[2] } : {});
const page = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
// iOS rounds the corners itself, so the touch icon is a full square.
const square = svg.replace(/<rect width="512" height="512" rx="114"/, '<rect width="512" height="512"');
await page.setContent(
  `<html><body style="margin:0">${square.replace("<svg ", '<svg width="180" height="180" ')}</body></html>`,
);
await page.screenshot({ path: "app/apple-icon.png", omitBackground: false });
await browser.close();
console.log("Wrote app/apple-icon.png");
