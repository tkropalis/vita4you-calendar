"use client";

import { useRef } from "react";
import type { View } from "./ScheduleApp";

const TABS: { id: View; label: string }[] = [
  { id: "me", label: "Η εβδομάδα μου" },
  { id: "team", label: "Ομάδα" },
];

export function ViewSwitch({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    onChange(TABS[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div className="segmented" role="tablist" aria-label="Προβολή">
      {TABS.map((tab, index) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            className="segmented__option"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
