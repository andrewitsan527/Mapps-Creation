import { partyOptionLabel, type PartyOption } from "@/lib/parties";
import { inputClass } from "@/components/ui";

/** Native select filled from party master options. */
export function PartySelect({
  name,
  options,
  required,
  defaultValue = "",
  placeholder = "Select…",
  showType = false,
  allowEmpty = true,
}: {
  name: string;
  options: PartyOption[];
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  showType?: boolean;
  allowEmpty?: boolean;
}) {
  return (
    <select
      className={inputClass}
      name={name}
      required={required}
      defaultValue={defaultValue}
    >
      {allowEmpty ? <option value="">{placeholder}</option> : null}
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {partyOptionLabel(p, showType)}
        </option>
      ))}
    </select>
  );
}
