import { ean13Modules, isGuardModule } from "@/lib/barcode";

/** EAN-13 drawn from data: bars are merged runs, so the SVG stays small. */
export function Barcode({ code, className }: { code: string; className?: string }) {
  const modules = ean13Modules(code);
  const bars: { x: number; w: number; guard: boolean }[] = [];
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== "1") continue;
    const last = bars.at(-1);
    if (last && last.x + last.w === i && last.guard === isGuardModule(i)) last.w++;
    else bars.push({ x: i, w: 1, guard: isGuardModule(i) });
  }
  return (
    <svg
      className={className}
      viewBox="0 0 103 40"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Κωδικός εβδομάδας ${code}`}
    >
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x + 8} y={0} width={bar.w} height={bar.guard ? 40 : 34} fill="currentColor" />
      ))}
    </svg>
  );
}
