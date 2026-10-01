import { RefreshCw } from "lucide-react";
import { formatClock, formatCheckedAt } from "@/lib/client/format";
import type { IsoDate } from "@/lib/schedule/dates";

type Props = {
  checking: boolean;
  checkedAt: string;
  today: IsoDate;
  onRefresh: () => void;
};

export function AppBar({ checking, checkedAt, today, onRefresh }: Props) {
  const full = formatCheckedAt(checkedAt, today);
  const short = full.startsWith("σήμερα") ? formatClock(checkedAt) : full;
  return (
    <header className="appbar">
      <div className="appbar__brand">
        <span className="cross" aria-hidden="true" />
        <div className="appbar__titles">
        <h1 className="appbar__title">Πρόγραμμα</h1>
          <p className="appbar__subtitle">Vita4you Τσιμισκή</p>
        </div>
      </div>
      <button
        type="button"
        className="refresh"
        onClick={onRefresh}
        disabled={checking}
        aria-describedby="refresh-hint"
      >
        <RefreshCw aria-hidden="true" className={checking ? "icon icon--spin" : "icon"} />
        <span className="refresh__text">
          <span className="refresh__label">{checking ? "Έλεγχος…" : "Ανανέωση"}</span>
          <span className="refresh__fresh">
            <span className="visually-hidden">Τελευταίος έλεγχος </span>
            <span aria-hidden="true">έλεγχος </span>
            {short}
          </span>
        </span>
      </button>
      <span id="refresh-hint" className="visually-hidden">
        Ελέγχει αν άλλαξε το φύλλο του προγράμματος
      </span>
    </header>
  );
}
