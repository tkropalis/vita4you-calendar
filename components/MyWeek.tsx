"use client";

import { CalendarPlus, CalendarSync, ChevronRight } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cx, dayNumber } from "@/lib/client/format";
import type { IsoDate } from "@/lib/schedule/dates";
import type { Person } from "@/lib/schedule/types";
import {
  DAY_NAMES,
  DAY_SHORT,
  PERIOD_LABEL,
  formatDayMonth,
  formatHours,
  initials,
  type DayEntry,
  type PersonDay,
  type WeekSummary,
} from "@/lib/schedule/view";
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
  onGoToCurrentWeek: () => void;
  onRefresh: () => void;
};

const DUTY_TAGS = ["Εφημερία", "Ολονυχτία"];

export function MyWeek(props: Props) {
  const { staff, onSelectPerson, person, week, today, days, summary, weekStatus, changed, onGoToCurrentWeek, onRefresh } =
    props;
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
                <span className="pick-list__avatar" aria-hidden="true">
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
            <button type="button" className="button button--primary" onClick={onRefresh}>
              Ανανέωση
            </button>
          ) : null}
          <button type="button" className="button" onClick={onGoToCurrentWeek}>
            Τρέχουσα εβδομάδα
          </button>
        </div>
      </div>
    );
  }

  const absent = days.every((d) => d.entries.length === 0);

  return (
    <div className="myweek">
      <div className="myweek__summary">
        {absent ? (
          <p className="notice">
            Δεν εμφανίζεσαι στο πρόγραμμα αυτής της εβδομάδας. Αν περιμένεις βάρδιες, έλεγξε το φύλλο ή ρώτα τον
            υπεύθυνο του προγράμματος.
          </p>
        ) : (
          <Summary days={days} summary={summary} today={today} />
        )}
      </div>

      <table className="days myweek__table">
        <caption className="visually-hidden">
          Πρόγραμμα για {person.name}, εβδομάδα από {formatDayMonth(week, "long")}
        </caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">Ημέρα</th>
            <th scope="col">Βάρδια</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <DayRow
              key={day.date}
              day={day}
              today={today}
              changed={changed.has(`${week}:${day.index}`)}
            />
          ))}
        </tbody>
      </table>

      {!absent ? <CalendarActions personId={person.id} week={week} /> : null}
    </div>
  );
}

function Summary({ days, summary, today }: { days: PersonDay[]; summary: WeekSummary; today: IsoDate }) {
  const dayLabel = (index: number) => `${DAY_NAMES[index]} ${formatDayMonth(days[index]!.date)}`;
  const sundayDuty = summary.sunday.flatMap((e) => e.tags.filter((t) => DUTY_TAGS.includes(t)));
  const todayDay = days.find((d) => d.date === today);

  return (
    <dl className="summary">
      {todayDay ? <TodayItem day={todayDay} /> : null}

      <div className="summary__item">
        <dt>Ρεπό</dt>
        <dd>
          {summary.offDays.length ? (
            <span className="summary__value summary__value--off">
              {summary.offDays.map(dayLabel).join(" και ")}
            </span>
          ) : (
            <span className="summary__value summary__value--muted">Κανένα αυτή την εβδομάδα</span>
          )}
        </dd>
      </div>

      <div className="summary__item">
        <dt>Κυριακή</dt>
        <dd>
          {summary.sunday.length ? (
            <span className="summary__value summary__inline">
              <span>Δουλεύεις</span>
              {summary.sunday.map((entry, i) => (
                <ShiftChip key={i} entry={entry} />
              ))}
              {sundayDuty.length ? <span className="tag">{sundayDuty[0]}</span> : null}
            </span>
          ) : (
            <span className="summary__value">Δεν δουλεύεις</span>
          )}
        </dd>
      </div>

      <div className="summary__item">
        <dt>Ώρες</dt>
        <dd>
          <span className="summary__value">
            {summary.totalIncomplete ? "τουλάχιστον " : ""}
            {formatHours(summary.totalMinutes)}
          </span>
          <span className="summary__aside">
            {summary.shiftCount === 1 ? "1 βάρδια" : `${summary.shiftCount} βάρδιες`}
          </span>
        </dd>
      </div>

      {summary.leaveDays.length ? (
        <div className="summary__item">
          <dt>Άδεια</dt>
          <dd>
            <span className="summary__value">{summary.leaveDays.map((i) => DAY_SHORT[i]).join(", ")}</span>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/** The first answer on the page: what today holds. */
function TodayItem({ day }: { day: PersonDay }) {
  const shifts = day.entries.filter((e) => e.kind === "shift");
  const coworkers = [...new Set(shifts.flatMap((e) => e.coworkers))];
  return (
    <div className="summary__item summary__item--today">
      <dt>Σήμερα</dt>
      <dd>
        {day.entries.length ? (
          <span className="summary__stack">
            <span className="summary__inline">
              {day.entries.map((entry, i) => (
                <ShiftChip key={i} entry={entry} />
              ))}
            </span>
            {coworkers.length ? <span className="summary__aside">με {coworkers.join(", ")}</span> : null}
          </span>
        ) : (
          <span className="summary__value summary__value--muted">Χωρίς βάρδια</span>
        )}
      </dd>
    </div>
  );
}

function DayRow({ day, today, changed }: { day: PersonDay; today: IsoDate; changed: boolean }) {
  const isToday = day.date === today;
  const isPast = day.date < today;
  return (
    <tr
      className={cx("day", isToday && "day--today", isPast && "day--past", `day--${day.status}`)}
      aria-current={isToday ? "date" : undefined}
    >
      <th scope="row" className="day__date">
        <span className="day__dow" aria-hidden="true">
          {DAY_SHORT[day.index]}
        </span>
        <span className="day__num" aria-hidden="true">
          {dayNumber(day.date)}
        </span>
        <span className="visually-hidden">
          {DAY_NAMES[day.index]} {formatDayMonth(day.date, "long")}
          {isToday ? " (σήμερα)" : ""}
        </span>
      </th>
      <td className="day__body">
        {changed ? <span className="badge">Άλλαξε</span> : null}
        {day.entries.length === 0 ? (
          <span className="day__empty">Χωρίς βάρδια</span>
        ) : (
          day.entries.map((entry, i) => <Entry key={i} entry={entry} />)
        )}
      </td>
    </tr>
  );
}

function Entry({ entry }: { entry: DayEntry }) {
  const duty = entry.tags.find((t) => DUTY_TAGS.includes(t));
  const otherTags = entry.tags.filter((t) => t !== duty && t !== entry.label);

  if (entry.kind !== "shift") {
    return (
      <div className="entry">
        <div className="entry__line">
          <ShiftChip entry={entry} />
          {entry.kind === "note" && entry.label ? <span className="entry__meta">{entry.label}</span> : null}
          {otherTags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const label = duty ?? PERIOD_LABEL[entry.period ?? "morning"];
  return (
    <div className="entry">
      <div className="entry__line">
        <ShiftChip entry={entry} />
        <span className="entry__meta">
          {label}
          {entry.minutes !== null ? ` · ${formatHours(entry.minutes)}` : ""}
        </span>
        {otherTags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      <p className="entry__with">
        {entry.coworkers.length ? (
          <>
            <span className="entry__with-label">Με </span>
            {entry.coworkers.join(", ")}
          </>
        ) : (
          <span className="entry__with-label">Κανείς άλλος σε αυτή τη βάρδια</span>
        )}
      </p>
      {entry.timeSource === "inherited" ? (
        <p className="entry__hint">Η ώρα δεν γράφεται στο φύλλο· δείχνουμε την ώρα της γραμμής από πάνω.</p>
      ) : null}
      {entry.timeSource === "override" ? (
        <p className="entry__hint">Ειδικό ωράριο, γραμμένο δίπλα στο όνομα.</p>
      ) : null}
    </div>
  );
}

function CalendarActions({ personId, week }: { personId: string; week: IsoDate }) {
  const path = `/api/calendar/${encodeURIComponent(personId)}.ics`;
  // webcal:// needs the absolute host, which only the browser knows.
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => null,
  );
  const feedUrl = host ? `webcal://${host}${path}` : path;

  return (
    <div className="cal-actions myweek__actions">
      <a className="button button--primary" href={`${path}?week=${week}`}>
        <CalendarPlus aria-hidden="true" className="icon" />
        <span>Προσθήκη στο ημερολόγιο</span>
      </a>
      <a className="button" href={feedUrl}>
        <CalendarSync aria-hidden="true" className="icon" />
        <span>Συνδρομή που ενημερώνεται</span>
      </a>
      <p className="cal-actions__hint">
        Η «Προσθήκη» περνά αυτή την εβδομάδα στο κινητό σου. Η «Συνδρομή» κρατά το ημερολόγιο ενημερωμένο μόνη της
        (iPhone, Mac, Outlook).
      </p>
    </div>
  );
}
