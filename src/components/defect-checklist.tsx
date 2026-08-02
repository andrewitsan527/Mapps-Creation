import { cn } from "@/lib/utils";

const defects = [
  {
    name: "checklistMill",
    label: "Mill",
    hint: "Opens RF + WhatsApps the mill",
  },
  {
    name: "checklistWeaver",
    label: "Weaver",
    hint: "Escalates to dashboard HIGH",
  },
  { name: "checklistDying", label: "Dyeing", hint: "Shade / finish issue" },
  { name: "checklistMinor", label: "Minor", hint: "Cosmetic, sellable" },
];

/**
 * The four defect categories used by both program QC and goods-return QC.
 * Field names match `submitQc` / `submitGoodsReturnQc`.
 */
export function DefectChecklist({
  columns = 2,
  className,
}: {
  columns?: 2 | 4;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="band-label">Defect type — tick all that apply</p>
      <div
        className={cn(
          "grid gap-1",
          columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2",
        )}
      >
        {defects.map((defect) => (
          <label
            key={defect.name}
            className="flex cursor-pointer items-start gap-1.5 rounded-md border border-(--line) bg-(--panel-alt) px-1.5 py-1 transition hover:border-(--accent) hover:bg-(--accent-soft)"
          >
            <input
              type="checkbox"
              name={defect.name}
              value="true"
              className="mt-0.5 accent-(--accent)"
            />
            <span className="min-w-0">
              <span className="block text-[11.5px] leading-tight font-semibold text-(--ink)">
                {defect.label}
              </span>
              <span className="block truncate text-[10px] text-(--muted)">
                {defect.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
