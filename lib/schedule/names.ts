/**
 * Name normalization for hand-typed rota cells.
 *
 * The same person shows up as "Ζόγκου Ε.", "Zόγκου Ε." (Latin Z), "Ζόγκου Ε. ",
 * or "Γκουκουτούδη Δ." vs "Γκουγκουτούδη Δ.". We reduce each spelling to a
 * comparison key, cluster keys that are one typo apart, and pick the cleanest
 * spelling as the display name.
 */

// Latin letters that look identical to Greek capitals/lowercase and slip in from mixed keyboards.
const LATIN_TO_GREEK: Record<string, string> = {
  A: "Α", B: "Β", E: "Ε", Z: "Ζ", H: "Η", I: "Ι", K: "Κ", M: "Μ", N: "Ν", O: "Ο",
  P: "Ρ", T: "Τ", Y: "Υ", X: "Χ", a: "α", o: "ο", v: "ν", u: "υ", i: "ι", k: "κ",
};

const GREEK_RE = /[Ͱ-Ͽἀ-῿]/;
const LATIN_RE = /[A-Za-z]/;
const COMBINING_RE = /[̀-ͯ]/g;

export function hasGreek(text: string): boolean {
  return GREEK_RE.test(text);
}

/** Replace Latin look-alikes with Greek letters when the text is otherwise Greek. */
export function fixMixedScript(text: string): string {
  if (!hasGreek(text) || !LATIN_RE.test(text)) return text;
  return text.replace(/[A-Za-z]/g, (ch) => LATIN_TO_GREEK[ch] ?? ch);
}

/** Lowercase, accent-free, final-sigma-free form used for comparisons. */
export function foldGreek(text: string): string {
  return fixMixedScript(text)
    .normalize("NFD")
    .replace(COMBINING_RE, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ParsedName = {
  /** Cleaned display text, e.g. "Μέτα Κ." */
  text: string;
  surnameKey: string;
  initialKey: string | null;
};

/** Parse a cell's name text (already stripped of any time override). */
export function parseName(raw: string): ParsedName | null {
  const text = fixMixedScript(raw).replace(/\s+/g, " ").trim();
  if (!text || /\d/.test(text)) return null;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3) return null;

  const tokens = foldGreek(text)
    .replace(/[.,]/g, " ")
    .split(" ")
    .filter(Boolean);
  const surnameKey = tokens[0];
  if (!surnameKey) return null;
  const initialKey = tokens[1]?.[0] ?? null;
  return { text: tidyDisplay(text), surnameKey, initialKey };
}

/** "Μέτα Κ" → "Μέτα Κ.", "ΚΑΦΕΣΤΙΔΗΣ" stays as typed (display choice happens later). */
function tidyDisplay(text: string): string {
  return text.replace(/\s([\p{Lu}])$/u, " $1.").replace(/\s*\.\s*$/, ".").replace(/\s+\./g, ".");
}

/** Damerau–Levenshtein distance with an early exit above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        dist[i - 1]![j]! + 1,
        dist[i]![j - 1]! + 1,
        dist[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, dist[i - 2]![j - 2]! + 1);
      }
      dist[i]![j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
  }
  return dist[rows - 1]![cols - 1]!;
}

export function surnamesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  // Short surnames only tolerate a stray final sigma ("Σέβα" / "Σεβας").
  if (shorter === 4) return a === `${b}σ` || b === `${a}σ`;
  if (shorter < 4) return false;
  return editDistance(a, b, 1) <= 1;
}

export type NameCluster = {
  id: string;
  name: string;
  /** Every raw cell text seen for this person. */
  variants: Map<string, number>;
};

/**
 * Group raw name occurrences into people.
 * `occurrences` maps each cleaned display text to how often it appears.
 */
export function clusterNames(occurrences: Map<string, number>): {
  clusters: NameCluster[];
  lookup: Map<string, string>;
} {
  type Group = { surnameKey: string; entries: { parsed: ParsedName; count: number }[] };
  const groups: Group[] = [];

  // Most frequent spellings first so they anchor their cluster.
  const sorted = [...occurrences.entries()].sort((a, b) => b[1] - a[1]);
  for (const [text, count] of sorted) {
    const parsed = parseName(text);
    if (!parsed) continue;
    const group = groups.find((g) => surnamesMatch(g.surnameKey, parsed.surnameKey));
    if (group) group.entries.push({ parsed, count });
    else groups.push({ surnameKey: parsed.surnameKey, entries: [{ parsed, count }] });
  }

  const clusters: NameCluster[] = [];
  const lookup = new Map<string, string>();
  const usedIds = new Set<string>();

  for (const group of groups) {
    // Same surname, different initials with real weight → different people.
    const byInitial = new Map<string, { parsed: ParsedName; count: number }[]>();
    for (const entry of group.entries) {
      const key = entry.parsed.initialKey ?? "";
      byInitial.set(key, [...(byInitial.get(key) ?? []), entry]);
    }
    const initials = [...byInitial.keys()].filter((k) => k !== "");
    const people: { parsed: ParsedName; count: number }[][] = [];
    if (initials.length <= 1) {
      people.push(group.entries);
    } else {
      for (const initial of initials) people.push(byInitial.get(initial) ?? []);
      // Bare surnames join the most frequent initial.
      const bare = byInitial.get("") ?? [];
      if (bare.length) {
        const largest = people.reduce((best, p) => (total(p) > total(best) ? p : best));
        largest.push(...bare);
      }
    }

    for (const entries of people) {
      const name = chooseDisplayName(entries);
      const id = uniqueId(slugify(name), usedIds);
      const variants = new Map<string, number>();
      for (const entry of entries) {
        variants.set(entry.parsed.text, entry.count);
        lookup.set(entry.parsed.text, id);
      }
      clusters.push({ id, name, variants });
    }
  }

  return { clusters, lookup };
}

function total(entries: { count: number }[]): number {
  return entries.reduce((sum, e) => sum + e.count, 0);
}

function chooseDisplayName(entries: { parsed: ParsedName; count: number }[]): string {
  let pool = entries.map((e) => ({ text: e.parsed.text, count: e.count, initial: e.parsed.initialKey }));

  // 1. Never display a spelling with Latin look-alikes or in all caps when a clean one exists.
  const clean = pool.filter((e) => !LATIN_RE.test(e.text) && e.text !== e.text.toUpperCase());
  if (clean.length) pool = clean;

  // 2. Prefer spellings that carry the initial ("Κολύρα Κ." over "Κολύρα") if used more than once.
  const withInitial = pool.filter((e) => e.initial && e.count >= 2);
  if (withInitial.length) pool = withInitial;

  // 3. Prefer properly accented spellings (accent on a lowercase vowel) unless they are rare typos.
  const max = Math.max(...pool.map((e) => e.count));
  const accented = pool.filter((e) => /[άέήίόύώΐΰ]/.test(e.text) && e.count >= max * 0.2);
  if (accented.length) pool = accented;

  pool.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "el"));
  return pool[0]?.text ?? entries[0]?.parsed.text ?? "";
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base || "person";
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

const GREEKLISH: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l",
  μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", τ: "t", υ: "y", φ: "f", χ: "ch",
  ψ: "ps", ω: "o",
};

/** URL-safe Greeklish slug: "Χαμζαλάρι Γ." → "chamzalari-g". */
export function slugify(text: string): string {
  return foldGreek(text)
    .replace(/ου/g, "ou")
    .replace(/[α-ω]/g, (ch) => GREEKLISH[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
