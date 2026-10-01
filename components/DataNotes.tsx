import { ExternalLink, Info } from "lucide-react";
import { formatCheckedAt } from "@/lib/client/format";
import type { IsoDate } from "@/lib/schedule/dates";
import type { Week, WeekWarning } from "@/lib/schedule/types";

type Props = { week: Week | undefined; view: "me" | "team"; sheetUrl: string; checkedAt: string; today: IsoDate };

/** Where the data comes from, and anything we had to guess while reading this week. */
export function DataNotes({ week, view, sheetUrl, checkedAt, today }: Props) {
  // Row-level details help whoever maintains the sheet (team view). In "my week" they are noise:
  // a person's own approximated times are already marked inline. Uncertain dates concern everyone.
  const warnings = (week?.warnings ?? []).filter((w) => view === "team" || w.type === "dates-inferred");
  return (
    <footer className="notes">
      {warnings.length ? (
        <ul className="notes__warnings">
          {warnings.map((warning, i) => (
            <li key={i}>
              <Info aria-hidden="true" className="icon" />
              <span>{describe(warning, week!)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="notes__source">
        Από το φύλλο Google «Πρόγραμμα Τσιμισκή» · έλεγχος {formatCheckedAt(checkedAt, today)} ·{" "}
        <a className="notes__link" href={sheetUrl} target="_blank" rel="noreferrer">
          Άνοιγμα φύλλου
          <ExternalLink aria-hidden="true" className="icon icon--inline" />
          <span className="visually-hidden"> (ανοίγει σε νέα καρτέλα)</span>
        </a>
      </p>
    </footer>
  );
}

function describe(warning: WeekWarning, week: Week): string {
  switch (warning.type) {
    case "duplicate":
      return `Η εβδομάδα υπάρχει δύο φορές στο φύλλο (γραμμές ${warning.otherRow} και ${week.headerRow}). Δείχνουμε τη νεότερη.`;
    case "dates-inferred":
      return "Οι ημερομηνίες αυτής της εβδομάδας δεν διαβάζονται στο φύλλο. Υπολογίστηκαν από τη σειρά των εβδομάδων.";
    case "times-inferred":
      return warning.rows.length === 1
        ? `Στη γραμμή ${warning.rows[0]} του φύλλου λείπει η ώρα. Δείχνουμε την ώρα της γραμμής από πάνω (σημάδι ≈).`
        : `Στις γραμμές ${warning.rows.join(", ")} του φύλλου λείπει η ώρα. Δείχνουμε την ώρα της γραμμής από πάνω (σημάδι ≈).`;
  }
}
