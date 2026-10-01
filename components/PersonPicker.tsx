import { ChevronsUpDown } from "lucide-react";
import { initials } from "@/lib/schedule/view";
import type { Person } from "@/lib/schedule/types";

type Props = {
  people: Person[];
  value: string | null;
  onChange: (id: string) => void;
};

export function PersonPicker({ people, value, onChange }: Props) {
  const selected = people.find((p) => p.id === value);
  return (
    <div className="picker">
      <label htmlFor="person" className={selected ? "visually-hidden" : "picker__label"}>
        Το όνομά σου
      </label>
      <div className={selected ? "picker__field" : "picker__field picker__field--empty"}>
        <span className="picker__avatar" aria-hidden="true">
          {selected ? initials(selected.name) : "?"}
        </span>
        <select
          id="person"
          className="picker__select"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          {!selected ? (
            <option value="" disabled>
              Διάλεξε όνομα…
            </option>
          ) : null}
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown aria-hidden="true" className="icon picker__chevron" />
      </div>
    </div>
  );
}
