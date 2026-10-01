// Downloads the live rota as tests/fixtures/live-snapshot.xlsx for the local regression test.
// The file contains staff names and is git-ignored. Usage: npm run snapshot
import { writeFile } from "node:fs/promises";

const sheetId = process.env.SHEET_ID || "1nHy_toJCbpsnTEE1aVXvF4YqZnhcmB5ay-rMPvTQs2c";
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
const response = await fetch(url, { redirect: "follow" });
if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
const bytes = new Uint8Array(await response.arrayBuffer());
await writeFile("tests/fixtures/live-snapshot.xlsx", bytes);
console.log(`Saved ${bytes.length} bytes to tests/fixtures/live-snapshot.xlsx`);
