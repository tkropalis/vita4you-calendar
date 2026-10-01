import { NextResponse, type NextRequest } from "next/server";
import { toClientSnapshot } from "@/lib/client/snapshot";
import { todayInAthens } from "@/lib/schedule/dates";
import { getSchedule } from "@/lib/schedule/source";

export const dynamic = "force-dynamic";

/** GET /api/schedule[?fresh=1]: the parsed rota. `fresh` re-reads Google Sheets, skipping the cache. */
export async function GET(request: NextRequest) {
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  try {
    const { snapshot, staleReason } = await getSchedule({ fresh });
    return NextResponse.json(
      { snapshot: toClientSnapshot(snapshot, todayInAthens()), staleReason: staleReason ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/schedule]", error);
    return NextResponse.json(
      { error: "Δεν ήταν δυνατή η ανάγνωση του φύλλου." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
