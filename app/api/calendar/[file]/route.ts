import type { NextRequest } from "next/server";
import { buildCalendar } from "@/lib/ics";
import { addDays, mondayOf, todayInAthens } from "@/lib/schedule/dates";
import { getSchedule } from "@/lib/schedule/source";
import { currentMonday, personWeek } from "@/lib/schedule/view";

export const dynamic = "force-dynamic";

/** Weeks of history kept in a calendar subscription. */
const FEED_WEEKS_BACK = 4;

/**
 * GET /api/calendar/<person>.ics?week=YYYY-MM-DD → one week as an .ics file.
 * GET /api/calendar/<person>.ics                 → subscription feed (recent and upcoming weeks).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const personId = decodeURIComponent(file).replace(/\.ics$/i, "");
  const weekParam = request.nextUrl.searchParams.get("week");

  let snapshot;
  try {
    ({ snapshot } = await getSchedule());
  } catch {
    return new Response("Το φύλλο δεν είναι διαθέσιμο αυτή τη στιγμή.", { status: 502 });
  }

  const person = snapshot.people.find((p) => p.id === personId);
  if (!person) return new Response("Δεν βρέθηκε αυτό το όνομα.", { status: 404 });

  const names = new Map(snapshot.people.map((p) => [p.id, p.name]));
  let mondays: string[];
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    mondays = [mondayOf(weekParam)];
  } else {
    const from = addDays(currentMonday(todayInAthens()), -7 * FEED_WEEKS_BACK);
    mondays = snapshot.weeks.map((w) => w.monday).filter((m) => m >= from);
  }

  const weeks = mondays.map((monday) => ({
    monday,
    days: personWeek(
      snapshot.weeks.find((w) => w.monday === monday),
      monday,
      person.id,
      names,
    ),
  }));

  const body = buildCalendar({ personId: person.id, personName: person.name, weeks });
  const filename = weekParam ? `programma-${person.id}-${mondays[0]}.ics` : `programma-${person.id}.ics`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
