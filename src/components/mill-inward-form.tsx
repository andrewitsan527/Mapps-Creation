import { createMillInward } from "@/server/actions/inward";
import { Field, FieldGroup, buttonClass, inputClass } from "@/components/ui";

export type InwardProgramOption = {
  id: string;
  programNo: string;
  millName: string;
  unit: string;
  remaining: number | null;
};

export function MillInwardForm({ programs }: { programs: InwardProgramOption[] }) {
  return (
    <form action={createMillInward} className="space-y-2.5">
      <FieldGroup label="Receipt">
        <Field label="Mill program">
          <select className={inputClass} name="programId" required>
            <option value="">Select…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.programNo} · {p.millName}
                {p.remaining != null
                  ? ` · remaining ${p.remaining} ${p.unit}`
                  : ` · ${p.unit}`}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Inward date">
            <input
              className={inputClass}
              name="inwardDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Received quantity" hint="Uses the program unit">
            <input
              className={inputClass}
              name="quantity"
              type="number"
              step="any"
              min="0"
              required
            />
          </Field>
        </div>
        <Field label="Remarks">
          <input className={inputClass} name="remarks" placeholder="Optional" />
        </Field>
      </FieldGroup>
      <button className={buttonClass + " w-full"} type="submit">
        Record mill inward
      </button>
    </form>
  );
}
