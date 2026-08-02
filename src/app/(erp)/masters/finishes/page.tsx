import { prisma } from "@/lib/db";
import { createFinishType } from "@/server/actions/masters";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  Section,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { Factory, PlusCircle } from "lucide-react";

export default async function FinishesPage() {
  const finishes = await prisma.finishType.findMany({
    select: { id: true, name: true, active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-3">
      <PageHeader
        title="Finish types"
        eyebrow="Masters"
        icon={Factory}
        description="Finish options offered on program cards and carried through to the lot identity."
      />

      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <Section title="Add finish" icon={PlusCircle} tone="accent">
          <Panel compact>
            <form action={createFinishType} className="space-y-1.5">
              <Field label="Finish name">
                <input
                  className={inputClass}
                  name="name"
                  placeholder="Peach, Soft, Bio-wash…"
                  required
                />
              </Field>
              <button className={buttonClass + " w-full"} type="submit">
                Save
              </button>
            </form>
          </Panel>
        </Section>

        <Section
          title="Finish library"
          icon={Factory}
          description={`${finishes.length} option(s)`}
        >
          <Panel compact>
            {finishes.length === 0 ? (
              <EmptyState icon={Factory} text="No finishes yet." />
            ) : (
              <div className="flex flex-wrap gap-1">
                {finishes.map((f) => (
                  <span
                    key={f.id}
                    className={`rounded-md border px-2 py-1 text-[12px] font-medium ${
                      f.active
                        ? "border-(--line) bg-(--panel-alt) text-(--ink)"
                        : "border-dashed border-(--line) text-(--faint)"
                    }`}
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </Section>
      </div>
    </div>
  );
}
