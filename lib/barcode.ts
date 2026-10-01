/**
 * EAN-13 for the week's authenticity strip.
 *
 * Prefix 20–29 is reserved by GS1 for in-store use, so the code never collides
 * with a real product: 20 · YY · WW · person (3 digits) · 000 · check digit.
 */

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = L.map((code) => [...code].map((bit) => (bit === "1" ? "0" : "1")).join(""));
const G = R.map((code) => [...code].reverse().join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** The 13-digit code for one person's week. */
export function weekCode(personId: string, isoYear: number, isoWeek: number): string {
  let hash = 0;
  for (const ch of personId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const person = String(hash % 1000).padStart(3, "0");
  const twelve = `20${String(isoYear % 100).padStart(2, "0")}${String(isoWeek).padStart(2, "0")}${person}000`;
  return twelve + ean13CheckDigit(twelve);
}

/** 95 modules, "1" = bar. */
export function ean13Modules(code: string): string {
  const digits = [...code].map(Number);
  const parity = PARITY[digits[0]!]!;
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === "L" ? L : G)[digits[i]!]!;
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[digits[i]!]!;
  return bits + "101";
}

/** Indexes of guard modules, drawn longer as on printed codes. */
export function isGuardModule(index: number): boolean {
  return index < 3 || (index >= 45 && index < 50) || index >= 92;
}
