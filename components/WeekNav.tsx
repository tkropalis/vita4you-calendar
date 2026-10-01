import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, type IsoDate } from "@/lib/schedule/dates";
import { currentMonday, formatWeekRangeNumeric, relativeWeekLabel } from "@/lib/schedule/view";

type Props = {
  week: IsoDate;
  today: IsoDate;
  canPrev: boolean;
  canNext: boolean;
  /** A refresh found changes for the selected person in an earlier / later week. */
  changedBefore: boolean;
  changedAfter: boolean;
  /** In "my week" on wide screens the nav centres over the day list, not the whole column. */
  alignToTable: boolean;
  onChange: (monday: IsoDate) => void;
};

export function WeekNav({ week, today, canPrev, canNext, changedBefore, changedAfter, alignToTable, onChange }: Props) {
  const isCurrent = week === currentMonday(today);
  return (
    <nav className={alignToTable ? "weeknav weeknav--table" : "weeknav"} aria-label="Εβδομάδα">
      <button
        type="button"
        className="button button--icon weeknav__step"
        onClick={() => onChange(addDays(week, -7))}
        disabled={!canPrev}
        aria-label={changedBefore ? "Προηγούμενη εβδομάδα (έχει αλλαγές)" : "Προηγούμενη εβδομάδα"}
      >
        <ChevronLeft aria-hidden="true" className="icon" />
        {changedBefore ? <span className="weeknav__dot" aria-hidden="true" /> : null}
      </button>

      <div className="weeknav__label">
        <h2 className="weeknav__range" aria-live="polite">
          {formatWeekRangeNumeric(week)}
        </h2>
        <p className="weeknav__relative">
          <span>{relativeWeekLabel(week, today)}</span>
          {!isCurrent ? (
            <button type="button" className="link-button" onClick={() => onChange(currentMonday(today))}>
              Σήμερα
            </button>
          ) : null}
        </p>
      </div>

      <button
        type="button"
        className="button button--icon weeknav__step"
        onClick={() => onChange(addDays(week, 7))}
        disabled={!canNext}
        aria-label={changedAfter ? "Επόμενη εβδομάδα (έχει αλλαγές)" : "Επόμενη εβδομάδα"}
      >
        <ChevronRight aria-hidden="true" className="icon" />
        {changedAfter ? <span className="weeknav__dot" aria-hidden="true" /> : null}
      </button>
    </nav>
  );
}
