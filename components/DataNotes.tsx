import { ExternalLink, Info } from "lucide-react";
import { formatCheckedAt } from "@/lib/client/format";
import type { IsoDate } from "@/lib/schedule/dates";
import type { Week, WeekWarning } from "@/lib/schedule/types";

type Props = { week: Week | undefined; sheetUrl: string; checkedAt: string; today: IsoDate };

/** Where the data comes from, and anything we had to guess while reading this week. */
export function DataNotes({ week, sheetUrl, checkedAt, today }: Props) {
  const warnings = week?.warnings ?? [];
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
