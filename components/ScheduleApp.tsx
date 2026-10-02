"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PERSON_COOKIE, type ClientSnapshot } from "@/lib/client/snapshot";
import { dayNumber, formatCheckedAt } from "@/lib/client/format";
import { addDays, todayInAthens, type IsoDate } from "@/lib/schedule/dates";
import {
  currentMonday,
  currentStaff,
  DAY_SHORT,
  daySignature,
  findWeek,
  formatWeekRange,
  personWeek,
  summarize,
} from "@/lib/schedule/view";
import { AppBar } from "./AppBar";
import { DataNotes } from "./DataNotes";
import { MyWeek } from "./MyWeek";
import { PersonPicker } from "./PersonPicker";
import { TeamWeek } from "./TeamWeek";
import { Toast, type ToastMessage } from "./Toast";
import { ViewSwitch } from "./ViewSwitch";
import { WeekNav } from "./WeekNav";

export type View = "me" | "team";

type Props = {
  initialSnapshot: ClientSnapshot;
  initialStaleReason: string | null;
  today: IsoDate;
  initialPersonId: string | null;
  initialWeek: IsoDate;
  initialView: View;
};

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Background re-check when the app comes back to the foreground after this long. */
const AUTO_CHECK_MS = 10 * 60 * 1000;

export function ScheduleApp(props: Props) {
  const [snapshot, setSnapshot] = useState(props.initialSnapshot);
  const [staleReason, setStaleReason] = useState(props.initialStaleReason);
  const [today, setToday] = useState(props.today);
  const [personId, setPersonId] = useState(props.initialPersonId);
  const [week, setWeek] = useState(props.initialWeek);
  const [view, setView] = useState<View>(props.initialView);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(props.initialSnapshot.fetchedAt);
  const [changed, setChanged] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const names = useMemo(() => new Map(snapshot.people.map((p) => [p.id, p.name])), [snapshot]);
  const staff = useMemo(() => {
    const list = currentStaff(snapshot.people, today);
    const selected = snapshot.people.find((p) => p.id === personId);
    return selected && !list.includes(selected) ? [...list, selected] : list;
  }, [snapshot, today, personId]);

  const thisMonday = currentMonday(today);
  const firstWeek = snapshot.weeks[0]?.monday ?? thisMonday;
  const lastPublished = snapshot.weeks.at(-1)?.monday ?? thisMonday;
  const lastWeek = addDays(lastPublished > thisMonday ? lastPublished : thisMonday, 7);
  const weekData = findWeek(snapshot, week);
  const person = snapshot.people.find((p) => p.id === personId) ?? null;
  const days = useMemo(
    () => (personId ? personWeek(weekData, week, personId, names) : null),
    [weekData, week, personId, names],
  );
  const summary = useMemo(() => (days ? summarize(days) : null), [days]);

  // Keep the address bar shareable: ?p=<person>&w=<week>&v=team
  useEffect(() => {
    const params = new URLSearchParams();
    if (personId) params.set("p", personId);
    if (week !== thisMonday) params.set("w", week);
    if (view === "team") params.set("v", "team");
    const query = params.toString();
    if ((query ? `?${query}` : "") !== window.location.search) {
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    }
  }, [personId, week, view, thisMonday]);

  const selectPerson = useCallback((id: string) => {
    setPersonId(id);
    setChanged(new Set());
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${PERSON_COOKIE}=${encodeURIComponent(id)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  }, []);

  const goToWeek = useCallback(
    (monday: IsoDate) => {
      if (monday < firstWeek || monday > lastWeek) return;
      setWeek(monday);
    },
    [firstWeek, lastWeek],
  );

  // The refresh callback reads the latest week and navigator without being re-created.
  const weekRef = useRef(week);
  const goToWeekRef = useRef(goToWeek);
  useEffect(() => {
    weekRef.current = week;
    goToWeekRef.current = goToWeek;
  }, [week, goToWeek]);

  const refresh = useCallback(
    async (options: { silent?: boolean } = {}) => {
      setChecking(true);
      try {
        const response = await fetch("/api/schedule?fresh=1", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { snapshot: ClientSnapshot; staleReason: string | null };
        const before = snapshotRef.current;
        const after = data.snapshot;
        setStaleReason(data.staleReason);
        setCheckedAt(data.staleReason ? before.fetchedAt : after.fetchedAt);

        if (data.staleReason) {
          if (!options.silent) {
            setToast({ tone: "error", text: "Το φύλλο δεν απαντά. Βλέπεις το πρόγραμμα του τελευταίου ελέγχου." });
          }
          return;
        }

        if (after.version === before.version) {
          if (!options.silent) setToast({ tone: "neutral", text: "Καμία αλλαγή. Το πρόγραμμα είναι ενημερωμένο." });
          setSnapshot(after);
          return;
        }

        const diff = personId ? changedDays(before, after, personId) : new Set<string>();
        setSnapshot(after);
        setChanged((prev) => new Set([...prev, ...diff]));
        setToast(changeMessage(diff, before, after, weekRef.current, (m) => goToWeekRef.current(m)));
      } catch {
        if (!options.silent) setToast({ tone: "error", text: "Δεν ήταν δυνατός ο έλεγχος. Δοκίμασε ξανά σε λίγο." });
      } finally {
        setChecking(false);
      }
    },
    [personId],
  );

  // Coming back to the app after a while: move "today" forward and quietly re-check the sheet.
  const checkedAtRef = useRef(checkedAt);
  useEffect(() => {
    checkedAtRef.current = checkedAt;
  }, [checkedAt]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setToday(todayInAthens());
      if (Date.now() - Date.parse(checkedAtRef.current) > AUTO_CHECK_MS) void refresh({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // ← → switch weeks on a keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [role=tablist], .team-matrix")) return;
      if (event.key === "ArrowLeft") goToWeek(addDays(week, -7));
      if (event.key === "ArrowRight") goToWeek(addDays(week, 7));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToWeek, week]);

  const dismissToast = useCallback(() => setToast(null), []);

  const changedWeeks = [...changed].map((key) => key.split(":")[0]!);
  const changedBefore = changedWeeks.some((monday) => monday < week);
  const changedAfter = changedWeeks.some((monday) => monday > week);

  const weekStatus = weekData ? "published" : week > lastPublished ? "upcoming" : "missing";

  return (
    <div className="app">
      <AppBar checking={checking} checkedAt={checkedAt} today={today} onRefresh={() => void refresh()} />

      {!online ? (
        <p className="banner banner--offline" role="status">
          Εκτός σύνδεσης. Βλέπεις το πρόγραμμα του τελευταίου ελέγχου ({formatCheckedAt(checkedAt, today)}).
        </p>
      ) : null}

      {staleReason ? (
        <p className="banner" role="alert">
          Δεν ήταν δυνατή η σύνδεση με το φύλλο Google. Βλέπεις το πρόγραμμα όπως ήταν στον τελευταίο επιτυχημένο
          έλεγχο.
        </p>
      ) : null}

      <div className="layout">
        <aside className="layout__side">
          <PersonPicker people={staff} value={personId} onChange={selectPerson} />
          <ViewSwitch value={view} onChange={setView} />
        </aside>

        <main className="layout__main" id="main">
          <WeekNav
            week={week}
            today={today}
            canPrev={week > firstWeek}
            canNext={week < lastWeek}
            changedBefore={changedBefore}
            changedAfter={changedAfter}
            alignToTable={view === "me" && Boolean(days) && weekStatus === "published"}
            onChange={goToWeek}
          />

          <div
            role="tabpanel"
            id="panel-me"
            aria-labelledby="tab-me"
            hidden={view !== "me"}
            className="panel"
          >
            <MyWeek
              key={week}
              staff={staff}
              onSelectPerson={selectPerson}
              person={person}
              week={week}
              today={today}
              days={days}
              summary={summary}
              weekStatus={weekStatus}
              changed={changed}
              checkedAt={checkedAt}
              weeks={snapshot.weeks}
              weekData={weekData}
              names={names}
              isCurrentWeek={week === thisMonday}
              onGoToCurrentWeek={() => goToWeek(thisMonday)}
              onRefresh={() => void refresh()}
            />
          </div>

          <div
            role="tabpanel"
            id="panel-team"
            aria-labelledby="tab-team"
            hidden={view !== "team"}
            className="panel"
          >
            <TeamWeek
              key={week}
              week={weekData}
              monday={week}
              today={today}
              people={snapshot.people}
              selectedId={personId}
              weekStatus={weekStatus}
            />
          </div>

          <DataNotes
            week={weekData}
            view={view}
            sheetUrl={snapshot.sheetUrl}
            checkedAt={checkedAt}
            today={today}
          />
        </main>
      </div>

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}

/**
 * One sentence for a refresh that found a new version of the sheet: which of the
 * person's days changed here, and the nearest other week with changes (with a
 * button that names and opens it).
 */
function changeMessage(
  diff: Set<string>,
  before: ClientSnapshot,
  after: ClientSnapshot,
  visibleWeek: IsoDate,
  goToWeek: (monday: IsoDate) => void,
): ToastMessage {
  if (diff.size === 0) {
    return { tone: "neutral", text: "Το φύλλο ενημερώθηκε. Οι βάρδιές σου δεν άλλαξαν." };
  }
  const visibleDays: number[] = [];
  const perWeek = new Map<IsoDate, number>();
  for (const key of diff) {
    const [monday, day] = key.split(":") as [IsoDate, string];
    if (monday === visibleWeek) visibleDays.push(Number(day));
    else perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
  }
  visibleDays.sort((a, b) => a - b);
  const other = [...perWeek.keys()].sort()[0];
  const otherRange = other ? formatWeekRange(other) : "";
  const published = other ? !findWeek(before, other) && Boolean(findWeek(after, other)) : false;
  const changed = (n: number) => (n === 1 ? "Άλλαξε 1 μέρα σου" : `Άλλαξαν ${n} μέρες σου`);
  const dayNames = visibleDays
    .map((d) => `${DAY_SHORT[d]} ${dayNumber(addDays(visibleWeek, d))}`)
    .join(", ");

  let text: string;
  if (visibleDays.length && other) {
    text = published
      ? `${changed(visibleDays.length)}: ${dayNames}. Αναρτήθηκε και η εβδομάδα ${otherRange}.`
      : `${changed(visibleDays.length + perWeek.get(other)!)}: ${dayNames} και ${perWeek.get(other)} στις ${otherRange}.`;
  } else if (visibleDays.length) {
    text = `${changed(visibleDays.length)}: ${dayNames}.`;
  } else {
    text = published
      ? `Αναρτήθηκε το πρόγραμμα για ${otherRange}.`
      : `${changed(perWeek.get(other!)!)} στις ${otherRange}.`;
  }

  return {
    tone: "neutral",
    text,
    action: other ? { label: `Δες ${otherRange}`, onClick: () => goToWeek(other) } : undefined,
  };
}

/** Keys ("<monday>:<day>") of the person's days whose content differs between two snapshots. */
function changedDays(before: ClientSnapshot, after: ClientSnapshot, personId: string): Set<string> {
  const result = new Set<string>();
  const mondays = new Set([...before.weeks, ...after.weeks].map((w) => w.monday));
  const namesBefore = new Map(before.people.map((p) => [p.id, p.name]));
  const namesAfter = new Map(after.people.map((p) => [p.id, p.name]));
  for (const monday of mondays) {
    const a = personWeek(findWeek(before, monday), monday, personId, namesBefore);
    const b = personWeek(findWeek(after, monday), monday, personId, namesAfter);
    a.forEach((day, i) => {
      if (daySignature(day) !== daySignature(b[i]!)) result.add(`${monday}:${i}`);
    });
  }
  return result;
}
