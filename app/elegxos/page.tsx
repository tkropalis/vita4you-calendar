import type { Metadata } from "next";
import Link from "next/link";
import { sheetIssues, spellingIssues, type Issue, type IssueSeverity } from "@/lib/schedule/checks";
import { addDays, todayInAthens } from "@/lib/schedule/dates";
import { getSchedule } from "@/lib/schedule/source";
import { currentMonday, currentStaff, formatWeekRangeNumeric } from "@/lib/schedule/view";
import { formatCheckedAt } from "@/lib/client/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Έλεγχος φύλλου · Vita4you Τσιμισκή",
  robots: { index: false, follow: false },
};

const SEVERITY: Record<IssueSeverity, string> = { error: "Σφάλμα", warning: "Προσοχή", info: "Σημείωση" };

/** For whoever keeps the rota: everything in the sheet worth fixing, from two weeks back onwards. */
export default async function SheetCheckPage() {
  const today = todayInAthens();
  let result;
  try {
    result = await getSchedule();
  } catch {
    return (
      <main className="app health">
        <p className="banner">Το φύλλο δεν διαβάζεται αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.</p>
      </main>
    );
  }
  const { snapshot } = result;
  const from = addDays(currentMonday(today), -14);
  const issues = sheetIssues(snapshot, from);
  const spellings = spellingIssues(currentStaff(snapshot.people, today));
  const weeks = [...new Set(issues.map((i) => i.week))];
  const count = (s: IssueSeverity) =>
    issues.filter((i) => i.severity === s).length + (s === "info" ? spellings.length : 0);

  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar__brand">
          <span className="cross" aria-hidden="true" />
          <div className="appbar__titles">
            <h1 className="appbar__title">Έλεγχος φύλλου</h1>
            <p className="appbar__subtitle">Vita4you Τσιμισκή</p>
          </div>
        </div>
        <Link className="button" href="/">
          Πρόγραμμα
        </Link>
      </header>

      <main className="health">
        <p className="health__intro">
          Ό,τι αξίζει διόρθωση στο φύλλο, από {formatWeekRangeNumeric(from).split(" – ")[0]} και μετά. Έλεγχος{" "}
          {formatCheckedAt(snapshot.fetchedAt, today)}.{" "}
          <a href={snapshot.sheetUrl} target="_blank" rel="noreferrer">
            Άνοιγμα φύλλου
          </a>
        </p>
        <p className="health__totals">
          <b>{count("error")}</b> {count("error") === 1 ? "σφάλμα" : "σφάλματα"} · <b>{count("warning")}</b>{" "}
          {count("warning") === 1 ? "προειδοποίηση" : "προειδοποιήσεις"} · <b>{count("info")}</b>{" "}
          {count("info") === 1 ? "σημείωση" : "σημειώσεις"}
        </p>

        {weeks.length === 0 ? <p className="health__clear">Δεν βρέθηκε κάτι να διορθωθεί.</p> : null}

        {weeks.map((week) => (
          <section key={week} className="health__week" aria-labelledby={`w-${week}`}>
            <h2 id={`w-${week}`} className="health__week-title">
              Εβδομάδα {formatWeekRangeNumeric(week)}
            </h2>
            <ul className="health__list">
              {issues
                .filter((i) => i.week === week)
                .map((issue, n) => (
                  <IssueRow key={n} issue={issue} />
                ))}
            </ul>
          </section>
        ))}

        {spellings.length ? (
          <section className="health__week" aria-labelledby="spellings">
            <h2 id="spellings" className="health__week-title">
              Ονόματα με πολλές γραφές
            </h2>
            <p className="health__note">
              Η σελίδα τα ενώνει μόνη της, αλλά μια ενιαία γραφή στο φύλλο αποφεύγει λάθη στο μέλλον.
            </p>
            <ul className="health__list">
              {spellings.map(({ person, variants }) => (
                <li key={person.id} className="health__item health__item--plain">
                  <div>
                    <p className="health__title">{person.name}</p>
                    <p className="health__detail">{variants.join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="health__note health__disclaimer">
          Οι έλεγχοι ωραρίου (ανάπαυση 11 ωρών, πάνω από 6 μέρες στη σειρά, πάνω από 40 ώρες) είναι ενδεικτικοί, όχι
          νομικός έλεγχος.
        </p>
      </main>
    </div>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <li className="health__item">
      <span className={`health__tag health__tag--${issue.severity}`}>{SEVERITY[issue.severity]}</span>
      <div>
        <p className="health__title">{issue.title}</p>
        <p className="health__detail">
          {issue.detail}
          {issue.row && !issue.detail.includes(String(issue.row)) ? (
            <span className="health__row"> · γραμμή {issue.row}</span>
          ) : null}
        </p>
      </div>
    </li>
  );
}
