import { cookies } from "next/headers";
import Link from "next/link";
import { ScheduleApp, type View } from "@/components/ScheduleApp";
import { PERSON_COOKIE, toClientSnapshot } from "@/lib/client/snapshot";
import { mondayOf, todayInAthens } from "@/lib/schedule/dates";
import { DEFAULT_SHEET_ID, sheetViewUrl } from "@/lib/schedule/snapshot";
import { getSchedule } from "@/lib/schedule/source";
import { currentMonday } from "@/lib/schedule/view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const today = todayInAthens();

  let result;
  try {
    result = await getSchedule();
  } catch (error) {
    console.error("[page] could not load the rota", error);
    return <LoadError />;
  }

  const snapshot = toClientSnapshot(result.snapshot, today);
  const requested = first(params.p) ?? cookieStore.get(PERSON_COOKIE)?.value;
  const personId = snapshot.people.some((p) => p.id === requested) ? requested! : null;
  const weekParam = first(params.w);
  const week = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? mondayOf(weekParam) : currentMonday(today);
  const view: View = first(params.v) === "team" ? "team" : "me";

  return (
    <ScheduleApp
      initialSnapshot={snapshot}
      initialStaleReason={result.staleReason ?? null}
      today={today}
      initialPersonId={personId}
      initialWeek={week}
      initialView={view}
    />
  );
}

function LoadError() {
  return (
    <main className="load-error">
      <h1>Το πρόγραμμα δεν φόρτωσε</h1>
      <p>
        Δεν ήταν δυνατή η ανάγνωση του φύλλου Google αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο ή άνοιξε το φύλλο
        απευθείας.
      </p>
      <div className="load-error__actions">
        <Link className="button button--primary" href="/" prefetch={false}>
          Δοκίμασε ξανά
        </Link>
        <a className="button" href={sheetViewUrl(process.env.SHEET_ID || DEFAULT_SHEET_ID)}>
          Άνοιγμα φύλλου
        </a>
      </div>
    </main>
  );
}
