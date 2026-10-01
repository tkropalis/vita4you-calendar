import { ChevronDown } from "lucide-react";
import type { Person } from "@/lib/schedule/types";

type Props = {
  people: Person[];
  value: string | null;
  onChange: (id: string) => void;
};

/** The name as an underlined field on the notice; the native select sits on top for the picker. */
export function PersonPicker({ people, value, onChange }: Props) {
  const selected = people.find((p) => p.id === value);
  return (
    <div className="picker">
      <label htmlFor="person" className="visually-hidden">
        Το όνομά σου
      </label>
      <div className={selected ? "picker__field" : "picker__field picker__field--empty"}>
        <span className="picker__name" aria-hidden="true">
          {selected ? selected.name : "Διάλεξε όνομα"}
        </span>
        <span className="picker__change" aria-hidden="true">
          {selected ? "Αλλαγή" : "Λίστα"}
          <ChevronDown className="icon" />
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
      </div>
    </div>
  );
}
