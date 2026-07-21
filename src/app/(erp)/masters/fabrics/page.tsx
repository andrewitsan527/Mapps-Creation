import { prisma } from "@/lib/db";
import { createFabricType } from "@/server/actions/masters";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

type FabricRow = {
  id: string;
  name: string;
  code: string | null;
  defaultUnit: string;
};

export default async function FabricsPage() {
  const fabrics = (await prisma.fabricType.findMany({
    select: { id: true, name: true, code: true, defaultUnit: true },
    orderBy: { name: "asc" },
  })) as FabricRow[];

  return (
    <div>
      <PageHeader
        title="Fabric types"
        description="Fabric types for programs and stock."
      />
      <div className="grid gap-1.5 lg:grid-cols-[320px_1fr]">
        <Panel title="Add fabric type" compact>
          <form action={createFabricType} className="space-y-1.5">
            <Field label="Name">
              <input className={inputClass} name="name" required />
            </Field>
            <Field label="Code">
              <input className={inputClass} name="code" />
            </Field>
            <Field label="Default unit">
              <select className={inputClass} name="defaultUnit" defaultValue="m">
                <option value="m">Meters</option>
                <option value="kg">Kg</option>
              </select>
            </Field>
            <button className={buttonClass} type="submit">
              Save
            </button>
          </form>
        </Panel>
        <Panel title="Fabric list" compact>
          {fabrics.length === 0 ? (
            <EmptyState text="No fabric types yet. Add cotton, PC, lycra, etc." />
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {fabrics.map((f: FabricRow) => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>{f.code ?? "—"}</td>
                    <td>{f.defaultUnit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
