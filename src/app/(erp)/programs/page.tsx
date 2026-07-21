import { prisma } from "@/lib/db";
import { createProgram, sendProgramWhatsApp } from "@/server/actions/programs";
import { listPartyOptions, type PartyOption } from "@/lib/parties";
import { statusBadge } from "@/lib/format";
import { PartySelect } from "@/components/party-select";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  buttonGhostClass,
  inputClass,
} from "@/components/ui";

type IdName = { id: string; name: string };
type ShadeOption = {
  id: string;
  name: string;
  code: string;
  hex: string | null;
  colorFamily: { name: string };
};
type GreyOption = { id: string; poNumber: string };
type ProgramRow = {
  id: string;
  programNo: string;
  status: string;
  gsm: { toString(): string } | null;
  width: { toString(): string } | null;
  mill: IdName;
  fabricType: IdName;
  shade: ShadeOption;
  finishType: IdName | null;
};

export default async function ProgramsPage() {
  const [mills, weavers, fabrics, shades, finishes, greys, programs] =
    (await Promise.all([
      listPartyOptions("MILL"),
      listPartyOptions("WEAVER"),
      prisma.fabricType.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.shade.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          code: true,
          hex: true,
          colorFamily: { select: { name: true } },
        },
        orderBy: [{ colorFamily: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.finishType.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.greyPurchaseOrder.findMany({
        where: { status: "OPEN" },
        select: { id: true, poNumber: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.millProgram.findMany({
        select: {
          id: true,
          programNo: true,
          status: true,
          gsm: true,
          width: true,
          mill: { select: { id: true, name: true } },
          fabricType: { select: { id: true, name: true } },
          shade: {
            select: {
              id: true,
              name: true,
              code: true,
              hex: true,
              colorFamily: { select: { name: true } },
            },
          },
          finishType: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ])) as [
      PartyOption[],
      PartyOption[],
      IdName[],
      ShadeOption[],
      IdName[],
      GreyOption[],
      ProgramRow[],
    ];

  return (
    <div>
      <PageHeader
        title="Mill program cards"
        description="Program cards — send to mill on WhatsApp."
      />
      <div className="grid gap-1.5 xl:grid-cols-[300px_1fr]">
        <Panel title="Create program" compact>
          <form action={createProgram} className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Mill">
              <PartySelect name="millId" options={mills} required />
            </Field>
            <Field label="Weaver (optional)">
              <PartySelect
                name="weaverId"
                options={weavers}
                placeholder="—"
              />
            </Field>
            <Field label="Grey PO (optional)">
              <select className={inputClass} name="greyOrderId">
                <option value="">—</option>
                {greys.map((g: GreyOption) => (
                  <option key={g.id} value={g.id}>
                    {g.poNumber}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fabric type">
              <select className={inputClass} name="fabricTypeId" required>
                <option value="">Select…</option>
                {fabrics.map((f: IdName) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shade / color scheme" className="sm:col-span-2 xl:col-span-1">
              <select className={inputClass} name="shadeId" required>
                <option value="">Select shade…</option>
                {shades.map((s: ShadeOption) => (
                  <option key={s.id} value={s.id}>
                    {s.colorFamily.name} · {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Finish">
              <select className={inputClass} name="finishTypeId">
                <option value="">—</option>
                {finishes.map((f: IdName) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Width">
              <input className={inputClass} name="width" type="number" step="any" />
            </Field>
            <Field label="GSM">
              <input className={inputClass} name="gsm" type="number" step="any" />
            </Field>
            <Field label="Feel / fall" className="sm:col-span-2 xl:col-span-1">
              <input className={inputClass} name="feelFallNotes" />
            </Field>
            <Field label="Extra mods" className="sm:col-span-2 xl:col-span-1">
              <input className={inputClass} name="extraMods" />
            </Field>
            <Field label="Remarks" className="sm:col-span-2 xl:col-span-1">
              <textarea className={inputClass} name="remarks" rows={2} />
            </Field>
            <div className="sm:col-span-2 xl:col-span-1">
              <button className={buttonClass} type="submit">
                Save program card
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Program list" compact>
          {programs.length === 0 ? (
            <EmptyState text="No programs yet. Add shades under Masters → Colors if the shade list is empty." />
          ) : (
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Shade</th>
                    <th>Spec</th>
                    <th>Mill</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p: ProgramRow) => (
                    <tr key={p.id}>
                      <td>
                        <p className="font-semibold">{p.programNo}</p>
                        <p className="text-[11px] text-(--muted)">
                          {p.fabricType.name}
                        </p>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-(--line)"
                            style={{ background: p.shade.hex || "#999" }}
                          />
                          {p.shade.colorFamily.name}/{p.shade.name}
                        </span>
                      </td>
                      <td>
                        {p.gsm ? `${p.gsm} GSM` : "—"} ·{" "}
                        {p.width ? `${p.width}"` : "—"}
                      </td>
                      <td>{p.mill.name}</td>
                      <td>
                        <span className={statusBadge(p.status)}>{p.status}</span>
                      </td>
                      <td>
                        {p.status === "DRAFT" || p.status === "SENT_TO_MILL" ? (
                          <form action={sendProgramWhatsApp}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className={buttonGhostClass} type="submit">
                              WhatsApp mill
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
