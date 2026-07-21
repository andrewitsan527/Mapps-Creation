import { prisma } from "@/lib/db";
import { createFinishType } from "@/server/actions/masters";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

export default async function FinishesPage() {
  const finishes = await prisma.finishType.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Finish types"
        description="Finish options for program cards."
      />
      <div className="grid gap-1.5 lg:grid-cols-[260px_1fr]">
        <Panel title="Add finish" compact>
          <form action={createFinishType} className="space-y-1.5">
            <Field label="Finish name">
              <input className={inputClass} name="name" required />
            </Field>
            <button className={buttonClass} type="submit">
              Save
            </button>
          </form>
        </Panel>
        <Panel title="Finish list" compact>
          {finishes.length === 0 ? (
            <EmptyState text="No finishes yet." />
          ) : (
            <ul className="space-y-px text-[12px]">
              {finishes.map((f) => (
                <li
                  key={f.id}
                  className="border-b border-(--line) px-1 py-1"
                >
                  {f.name}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
