import { prisma } from "@/lib/db";
import { createFabricType } from "@/server/actions/masters";
import {
  EmptyState,
  Field,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { PlusCircle, Shirt } from "lucide-react";

type FabricRow = {
  id: string;
  name: string;
  code: string | null;
  defaultUnit: string;
  active: boolean;
  _count: { lots: number; programs: number };
};

export default async function FabricsPage() {
  const fabrics = (await prisma.fabricType.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      defaultUnit: true,
      active: true,
      _count: { select: { lots: true, programs: true } },
    },
    orderBy: { name: "asc" },
  })) as FabricRow[];

  const inUse = fabrics.filter(
    (f) => f._count.lots > 0 || f._count.programs > 0,
  ).length;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Fabric types"
        eyebrow="Masters"
        icon={Shirt}
        description="The fabric vocabulary used by program cards, lots and stock enquiry."
      />

      <MetricStrip className="grid-cols-3">
        <Metric label="Fabric types" value={fabrics.length} />
        <Metric
          label="Active"
          value={fabrics.filter((f) => f.active).length}
          tone="accent"
        />
        <Metric label="In use" value={inUse} hint="On lots or programs" />
      </MetricStrip>

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <Section title="Add fabric type" icon={PlusCircle} tone="accent">
          <Panel compact>
            <form action={createFabricType} className="space-y-1.5">
              <Field label="Name">
                <input
                  className={inputClass}
                  name="name"
                  placeholder="Cotton, PC, Lycra…"
                  required
                />
              </Field>
              <Field label="Code">
                <input className={inputClass} name="code" />
              </Field>
              <Field label="Default unit">
                <select
                  className={inputClass}
                  name="defaultUnit"
                  defaultValue="m"
                >
                  <option value="m">Meters</option>
                  <option value="kg">Kg</option>
                </select>
              </Field>
              <button className={buttonClass + " w-full"} type="submit">
                Save
              </button>
            </form>
          </Panel>
        </Section>

        <Section title="Fabric library" icon={Shirt}>
          <Panel flush>
            {fabrics.length === 0 ? (
              <div className="p-2.5">
                <EmptyState
                  icon={Shirt}
                  text="No fabric types yet. Add cotton, PC, lycra, and so on."
                />
              </div>
            ) : (
              <TableWrap maxHeight={520}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Unit</th>
                      <th className="num">Programs</th>
                      <th className="num">Lots</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fabrics.map((f) => (
                      <tr key={f.id} className={f.active ? "" : "opacity-55"}>
                        <td className="font-semibold">{f.name}</td>
                        <td className="text-(--muted)">{f.code ?? "—"}</td>
                        <td className="text-(--muted)">{f.defaultUnit}</td>
                        <td className="num">{f._count.programs}</td>
                        <td className="num">{f._count.lots}</td>
                        <td>
                          <span
                            className={
                              f.active ? "badge badge-ok" : "badge badge-muted"
                            }
                          >
                            {f.active ? "Active" : "Off"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </Section>
      </div>
    </div>
  );
}
