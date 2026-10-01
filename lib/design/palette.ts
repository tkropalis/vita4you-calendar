/**
 * Colours for the exported week image, which is always the light (printed) notice.
 * Canvas cannot read the page's CSS variables reliably; keep these in sync with :root in app/globals.css.
 */

type Oklch = readonly [l: number, c: number, h: number];

export const PALETTE = {
  paper: [0.992, 0.002, 140],
  ink: [0.17, 0.008, 260],
  ink2: [0.38, 0.008, 260],
  rule: [0.17, 0.008, 260],
  hairline: [0.8, 0.004, 260],
  green: [0.53, 0.16, 148],
} as const satisfies Record<string, Oklch>;

export type PaletteKey = keyof typeof PALETTE;

export function hex(key: PaletteKey): string {
  const [L, C, h] = PALETTE[key];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    rgb
      .map((x) => {
        const v = Math.max(0, Math.min(1, x));
        const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(encoded * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}
