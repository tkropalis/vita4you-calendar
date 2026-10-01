import { addDays, type IsoDate } from "./schedule/dates";
import { PERIOD_LABEL, type PersonDay } from "./schedule/view";

const LOCATION = "Vita4you Τσιμισκή";

const ATHENS_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Athens",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0300",
  "TZNAME:EEST",
  "DTSTART:19700329T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0200",
  "TZNAME:EET",
  "DTSTART:19701025T040000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export type CalendarWeek = { monday: IsoDate; days: PersonDay[] };

/** Builds an iCalendar file with one event per shift and all-day events for days off and leave. */
export function buildCalendar(options: {
  personId: string;
  personName: string;
  weeks: CalendarWeek[];
  now?: Date;
}): string {
  const stamp = formatUtc(options.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vita4you Tsimiski//Programma//EL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`Πρόγραμμα · ${options.personName}`)}`,
    "X-WR-TIMEZONE:Europe/Athens",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...ATHENS_VTIMEZONE,
  ];

  for (const week of options.weeks) {
    for (const day of week.days) {
      day.entries.forEach((entry, n) => {
        const uid = `${options.personId}-${day.date}-${n}@vita4you-tsimiski`;
        const event = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`];

        if (entry.kind === "shift" && entry.start && entry.end) {
          const endDate = entry.end <= entry.start ? addDays(day.date, 1) : day.date;
          const special = entry.tags.find((t) => t === "Εφημερία" || t === "Ολονυχτία");
          const title = special ?? `Βάρδια ${PERIOD_LABEL[entry.period ?? "morning"].toLowerCase()}`;
          const details = [
            entry.coworkers.length ? `Με: ${entry.coworkers.join(", ")}` : "",
            ...entry.tags.filter((t) => t !== special),
          ].filter(Boolean);
          event.push(
            `DTSTART;TZID=Europe/Athens:${formatLocal(day.date, entry.start)}`,
            `DTEND;TZID=Europe/Athens:${formatLocal(endDate, entry.end)}`,
            `SUMMARY:${escapeText(`${title} ${entry.start}–${entry.end}`)}`,
            `LOCATION:${escapeText(LOCATION)}`,
          );
          if (details.length) event.push(`DESCRIPTION:${escapeText(details.join("\n"))}`);
        } else if (entry.kind === "off" || entry.kind === "leave") {
          event.push(
            `DTSTART;VALUE=DATE:${compact(day.date)}`,
            `DTEND;VALUE=DATE:${compact(addDays(day.date, 1))}`,
            `SUMMARY:${escapeText(entry.kind === "off" ? "Ρεπό" : (entry.label ?? "Άδεια"))}`,
            "TRANSP:TRANSPARENT",
          );
        } else {
          return;
        }
        event.push("END:VEVENT");
        lines.push(...event);
      });
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function compact(iso: IsoDate): string {
  return iso.replace(/-/g, "");
}

function formatLocal(date: IsoDate, time: string): string {
  return `${compact(date)}T${time.replace(":", "")}00`;
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  const limit = () => (parts.length === 0 ? 75 : 74);
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (size + bytes > limit()) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
