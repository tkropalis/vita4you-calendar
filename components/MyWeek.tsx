"use client";

import { CalendarPlus, CalendarSync, ChevronRight, ImageDown } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { weekCode } from "@/lib/barcode";
import { renderWeekImage, shareOrDownload, weekImageFilename } from "@/lib/client/exportImage";
import { cx, dayNumber } from "@/lib/client/format";
import { isoWeek, type IsoDate } from "@/lib/schedule/dates";
import type { Person } from "@/lib/schedule/types";
import {
  DAY_NAMES,
  DAY_SHORT,
  PERIOD_LABEL,
  formatDayMonth,
  formatHours,
  initials,
  joinNames,
  type DayEntry,
  type PersonDay,
  type WeekSummary,
} from "@/lib/schedule/view";
import { Barcode } from "./Barcode";
import { ShiftChip } from "./ShiftChip";

type Props = {
  staff: Person[];
  onSelectPerson: (id: string) => void;
  person: Person | null;
  week: IsoDate;
  today: IsoDate;
  days: PersonDay[] | null;
  summary: WeekSummary | null;
  weekStatus: "published" | "upcoming" | "missing";
  changed: Set<string>;
  checkedAt: string;
  onGoToCurrentWeek: () => void;
  onRefresh: () => void;
};

const DUTY_TAGS = ["Εφημερία", "Ολονυχτία"];

export function MyWeek(props: Props) {
  const { staff, onSelectPerson, person, week, today, days, summary, weekStatus, changed } = props;

  if (!person || !days || !summary) {
    return (
      <div className="empty empty--pick">
        <h3 className="empty__title">Ποιο είναι το όνομά σου;</h3>
        <p className="empty__text">
          Θα δεις τις βάρδιές σου, το ρεπό σου και αν δουλεύεις Κυριακή. Η επιλογή μένει σε αυτή τη συσκευή.
        </p>
        <ul className="pick-list">
          {staff.map((p) => (
            <li key={p.id}>
              <button type="button" className="pick-list__item" onClick={() => onSelectPerson(p.id)}>
                <span className="pick-list__initials" aria-hidden="true">
                  {initials(p.name)}
                </span>
                <span className="pick-list__name">{p.name}</span>
                <ChevronRight aria-hidden="true" className="icon pick-list__chevron" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (weekStatus !== "published") {
    return (
      <div className="empty">
        <h3 className="empty__title">
          {weekStatus === "upcoming" ? "Δεν έχει αναρτηθεί ακόμα" : "Η εβδομάδα λείπει από το φύλλο"}
        </h3>
        <p className="empty__text">
          {weekStatus === "upcoming"
            ? "Το πρόγραμμα αυτής της εβδομάδας δεν υπάρχει ακόμα στο φύλλο. Πάτα «Ανανέωση» για να δεις αν ανέβηκε."
            : "Το φύλλο δεν έχει πρόγραμμα για αυτή την εβδομάδα."}
        </p>
        <div className="empty__actions">
          {weekStatus === "upcoming" ? (
            <button type="button" className="button button--primary" onClick={props.onRefresh}>
              Ανανέωση
            </button>
          ) : null}
          <button type="button" className="button" onClick={props.onGoToCurrentWeek}>
            Τρέχουσα εβδομάδα
          </button>
        </div>
      </div>
    );
  }

  const absent = days.every((d) => d.entries.length === 0);
  const todayDay = days.find((d) => d.date === today);
  const { week: weekNumber, year } = isoWeek(week);

  return (
    <div className="myweek">
      <section className="box myweek__box" aria-labelledby="box-name">
        <header className="box__head">
          <h3 id="box-name" className="box__name">
            {person.name}
          </h3>
          <p className="box__desc">
            Εβδομάδα {weekNumber} · {summary.shiftCount === 1 ? "1 βάρδια" : `${summary.shiftCount} βάρδιες`}
          </p>
        </header>

        {todayDay ? <TodayBand day={todayDay} /> : null}

        {absent ? (
          <p className="box__notice">
            Δεν εμφανίζεσαι στο πρόγραμμα αυτής της εβδομάδας. Αν περιμένεις βάρδιες, έλεγξε το φύλλο ή ρώτα τον
            υπεύθυνο του προγράμματος.
          </p>
        ) : (
          <Facts days={days} summary={summary} />
        )}

        <div className="strip">
          <div className="strip__code">
            <Barcode code={weekCode(person.id, year, weekNumber)} className="strip__bars" />
            <span className="strip__digits" aria-hidden="true">
              {formatCode(weekCode(person.id, year, weekNumber))}
            </span>
          </div>
          <div className="strip__info">
            <span className="strip__name">{person.name}</span>
            <span>
              Εβδ. {weekNumber}/{year}
            </span>
            <span>
              {summary.totalIncomplete ? "≥ " : ""}
              {formatHours(summary.totalMinutes)}
            </span>
          </div>
        </div>
      </section>

      <table className="dosage myweek__table">
        <caption className="visually-hidden">
          Πρόγραμμα για {person.name}, εβδομάδα από {formatDayMonth(week, "long")}
        </caption>
        <thead>
          <tr>
            <th scope="col">Ημέρα</th>
            <th scope="col">Βάρδια</th>
            <th scope="col" className="dosage__hours">
              Ώρες
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <DayRow key={day.date} day={day} today={today} changed={changed.has(`${week}:${day.index}`)} />
          ))}
        </tbody>
      </table>

      {!absent ? (
        <Actions
          person={person}
          week={week}
          today={today}
          days={days}
          summary={summary}
          checkedAt={props.checkedAt}
        />
      ) : null}
    </div>
  );
}

function formatCode(code: string): string {
  return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
}

/** Today's dose, on the band colour of today's shift. */
function TodayBand({ day }: { day: PersonDay }) {
  const shifts = day.entries.filter((e) => e.kind === "shift");
  const first = day.entries[0];
  const tone = !first ? "none" : first.kind === "shift" ? (first.period ?? "morning") : first.kind;
  const coworkers = [...new Set(shifts.flatMap((e) => e.coworkers))];
  const duty = shifts.flatMap((e) => e.tags).find((t) => DUTY_TAGS.includes(t));

  let dose = "Χωρίς βάρδια";
  if (shifts.length) dose = shifts.map((e) => `${e.start}–${e.end}`).join(" · ");
  else if (first?.kind === "off") dose = "Ρεπό";
  else if (first?.kind === "leave") dose = first.label ?? "Άδεια";

  return (
    <div className={`today today--${tone}`}>
      <p className="today__label">
        Σήμερα · {DAY_NAMES[day.index]} {dayNumber(day.date)}
        {duty ? ` · ${duty}` : ""}
      </p>
      <p className="today__dose">{dose}</p>
      {coworkers.length ? <p className="today__with">με {joinNames(coworkers)}</p> : null}
    </div>
  );
}

function Facts({ days, summary }: { days: PersonDay[]; summary: WeekSummary }) {
  const dayLabel = (index: number) => `${DAY_NAMES[index]} ${formatDayMonth(days[index]!.date)}`;
  const sundayDuty = summary.sunday.flatMap((e) => e.tags.filter((t) => DUTY_TAGS.includes(t)));
  return (
    <dl className="facts">
      <div className="facts__row">
        <dt>Ρεπό</dt>
        <dd className={summary.offDays.length ? "facts__off" : "facts__muted"}>
          {summary.offDays.length ? summary.offDays.map(dayLabel).join(" και ") : "Κανένα αυτή την εβδομάδα"}
        </dd>
      </div>
      <div className="facts__row">
        <dt>Κυριακή</dt>
        <dd>
          {summary.sunday.length
            ? `Δουλεύεις ${summary.sunday.map((e) => `${e.start}–${e.end}`).join(", ")}${sundayDuty[0] ? ` · ${sundayDuty[0]}` : ""}`
            : "Δεν δουλεύεις"}
        </dd>
      </div>
      <div className="facts__row">
        <dt>Σύνολο</dt>
        <dd>
          {summary.totalIncomplete ? "τουλάχιστον " : ""}
          {formatHours(summary.totalMinutes)}
        </dd>
      </div>
      {summary.leaveDays.length ? (
        <div className="facts__row">
          <dt>Άδεια</dt>
          <dd>{summary.leaveDays.map((i) => DAY_SHORT[i]).join(", ")}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function DayRow({ day, today, changed }: { day: PersonDay; today: IsoDate; changed: boolean }) {
  const isToday = day.date === today;
  const isPast = day.date < today;
  const minutes = day.entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  return (
    <tr
      className={cx("dose-row", isToday && "dose-row--today", isPast && "dose-row--past")}
      aria-current={isToday ? "date" : undefined}
    >
      <th scope="row" className="dose-row__day">
        <span className="dose-row__dow" aria-hidden="true">
          {DAY_SHORT[day.index]}
        </span>
        <span className="dose-row__num" aria-hidden="true">
          {dayNumber(day.date)}
        </span>
        <span className="visually-hidden">
          {DAY_NAMES[day.index]} {formatDayMonth(day.date, "long")}
          {isToday ? " (σήμερα)" : ""}
        </span>
      </th>
      <td className="dose-row__body">
        {changed ? <span className="overstamp">Άλλαξε</span> : null}
        {day.entries.length === 0 ? (
          <span className="dose-row__empty">Χωρίς βάρδια</span>
        ) : (
          day.entries.map((entry, i) => <Entry key={i} entry={entry} />)
        )}
      </td>
      <td className="dose-row__hours">{minutes ? formatHours(minutes).replace(" ώρες", "").replace(" ώρα", "") : "—"}</td>
    </tr>
  );
}

function Entry({ entry }: { entry: DayEntry }) {
  const duty = entry.tags.find((t) => DUTY_TAGS.includes(t));
  const otherTags = entry.tags.filter((t) => t !== duty && t !== entry.label);

  return (
    <div className="entry">
      <div className="entry__line">
        <ShiftChip entry={entry} />
        {entry.kind === "shift" ? <span className="entry__kind">{duty ?? PERIOD_LABEL[entry.period ?? "morning"]}</span> : null}
        {entry.kind === "note" && entry.label ? <span className="entry__kind">{entry.label}</span> : null}
        {otherTags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      {entry.kind === "shift" ? (
        <p className="entry__with">
          {entry.coworkers.length ? `με ${joinNames(entry.coworkers)}` : "κανείς άλλος στη βάρδια"}
        </p>
      ) : null}
      {entry.timeSource === "inherited" ? (
        <p className="entry__hint">Η ώρα δεν γράφεται στο φύλλο· δείχνουμε την ώρα της γραμμής από πάνω.</p>
      ) : null}
      {entry.timeSource === "override" ? <p className="entry__hint">Ειδικό ωράριο, γραμμένο δίπλα στο όνομα.</p> : null}
    </div>
  );
}

type ActionsProps = {
  person: Person;
  week: IsoDate;
  today: IsoDate;
  days: PersonDay[];
  summary: WeekSummary;
  checkedAt: string;
};

function Actions({ person, week, today, days, summary, checkedAt }: ActionsProps) {
  const path = `/api/calendar/${encodeURIComponent(person.id)}.ics`;
  // webcal:// needs the absolute host, which only the browser knows.
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => null,
  );
  const feedUrl = host ? `webcal://${host}${path}` : path;

  // Render the image ahead of the tap, so the share sheet opens inside the user's gesture (iOS requires it).
  const imageRef = useRef<Promise<Blob> | null>(null);
  useEffect(() => {
    imageRef.current = renderWeekImage({ personId: person.id, personName: person.name, monday: week, today, days, summary, checkedAt });
    imageRef.current.catch(() => undefined);
  }, [person, week, today, days, summary, checkedAt]);

  const [status, setStatus] = useState<"idle" | "busy" | "saved" | "failed">("idle");
  const saveImage = async () => {
    setStatus("busy");
    try {
      const blob = await (imageRef.current ??
        renderWeekImage({ personId: person.id, personName: person.name, monday: week, today, days, summary, checkedAt }));
      const result = await shareOrDownload(blob, weekImageFilename(person.id, week), `Πρόγραμμα · ${person.name}`);
      setStatus(result === "downloaded" ? "saved" : "idle");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="actions myweek__actions">
      <button type="button" className="button button--primary" onClick={() => void saveImage()} disabled={status === "busy"}>
        <ImageDown aria-hidden="true" className="icon" />
        <span>{status === "busy" ? "Ετοιμάζεται…" : "Εικόνα της εβδομάδας"}</span>
      </button>
      <a className="button" href={`${path}?week=${week}`}>
        <CalendarPlus aria-hidden="true" className="icon" />
        <span>Στο ημερολόγιο</span>
      </a>
      <a className="button" href={feedUrl}>
        <CalendarSync aria-hidden="true" className="icon" />
        <span>Συνδρομή ημερολογίου</span>
      </a>
      <p className="actions__hint" aria-live="polite">
        {status === "saved"
          ? "Η εικόνα αποθηκεύτηκε στις λήψεις."
          : status === "failed"
            ? "Η εικόνα δεν δημιουργήθηκε. Δοκίμασε ξανά."
            : "Η εικόνα είναι σε μέγεθος κινητού, για αποθήκευση ή αποστολή. Η «Συνδρομή» κρατά το ημερολόγιο του κινητού ενημερωμένο μόνη της."}
      </p>
    </div>
  );
}
