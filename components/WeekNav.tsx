import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, type IsoDate } from "@/lib/schedule/dates";
import { currentMonday, formatWeekRange, relativeWeekLabel } from "@/lib/schedule/view";

type Props = {
  week: IsoDate;
  today: IsoDate;
  canPrev: boolean;
  canNext: boolean;
  onChange: (monday: IsoDate) => void;
};

export function WeekNav({ week, today, canPrev, canNext, onChange }: Props) {
  const isCurrent = week === currentMonday(today);
  return (
    <nav className="weeknav" aria-label="Εβδομάδα">
      <button
        type="button"
        className="button button--icon"
        onClick={() => onChange(addDays(week, -7))}
        disabled={!canPrev}
        aria-label="Προηγούμενη εβδομάδα"
      >
        <ChevronLeft aria-hidden="true" className="icon" />
      </button>

      <div className="weeknav__label">
        <p className="weeknav__relative">
          <span>{relativeWeekLabel(week, today)}</span>
          {!isCurrent ? (
            <button type="button" className="link-button" onClick={() => onChange(currentMonday(today))}>
              Σήμερα
            </button>
          ) : null}
        </p>
        <h2 className="weeknav__range" aria-live="polite">
          {formatWeekRange(week)}
        </h2>
      </div>

      <button
        type="button"
        className="button button--icon"
        onClick={() => onChange(addDays(week, 7))}
        disabled={!canNext}
        aria-label="Επόμενη εβδομάδα"
      >
        <ChevronRight aria-hidden="true" className="icon" />
      </button>
    </nav>
  );
}
