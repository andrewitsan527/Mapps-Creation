import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAvailability } from "@/server/domain/stock";
import { formatQty } from "@/lib/utils";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

type SearchParams = Promise<{
  fabricTypeId?: string;
  shadeId?: string;
  colorFamilyId?: string;
}>;

type StockLotRow = {
  id: string;
  lotNumber: string;
  marka: string | null;
  origin: string;
  qualityGrade: string;
  width: { toString(): string } | null;
  gsm: { toString(): string } | null;
  rollCount: number;
  onHand: { toString(): string };
  reserved: { toString(): string };
  fabricType: { name: string };
  shade: { name: string; colorFamily: { name: string } };
  finishType: { name: string } | null;
  millMarka: { code: string } | null;
  mill: { name: string } | null;
  weaver: { name: string } | null;
  salesReturnAsNew: { markaPhotoUrl: string | null } | null;
  rolls: { rollNo: string; lengthM: { toString(): string } }[];
};

export default async function StockPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const [fabrics, families, shades, availability, lots] = await Promise.all([
    prisma.fabricType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.colorFamily.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.shade.findMany({
      where: {
        active: true,
        ...(params.colorFamilyId
          ? { colorFamilyId: params.colorFamilyId }
          : {}),
      },
      include: { colorFamily: true },
      orderBy: { name: "asc" },
    }),
    getAvailability(prisma, {
      fabricTypeId: params.fabricTypeId,
      shadeId: params.shadeId,
      colorFamilyId: params.colorFamilyId,
    }),
    prisma.lot.findMany({
      where: {
        active: true,
        ...(params.fabricTypeId ? { fabricTypeId: params.fabricTypeId } : {}),
        ...(params.shadeId ? { shadeId: params.shadeId } : {}),
        ...(params.colorFamilyId
          ? { shade: { colorFamilyId: params.colorFamilyId } }
          : {}),
      },
      include: {
        fabricType: true,
        shade: { include: { colorFamily: true } },
        finishType: true,
        millMarka: { select: { code: true } },
        mill: { select: { name: true } },
        weaver: { select: { name: true } },
        salesReturnAsNew: { select: { markaPhotoUrl: true } },
        rolls: { orderBy: { sortOrder: "asc" }, take: 12 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }) as unknown as Promise<StockLotRow[]>,
  ]);

  return (
    <div>
      <PageHeader
        title="Live stock"
        description="Live availability and lot enquiry."
      />

      <Panel className="mb-1.5" title="Stock enquiry" compact>
        <form className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fabric type">
            <select
              className={inputClass}
              name="fabricTypeId"
              defaultValue={params.fabricTypeId ?? ""}
            >
              <option value="">All</option>
              {fabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Color family">
            <select
              className={inputClass}
              name="colorFamilyId"
              defaultValue={params.colorFamilyId ?? ""}
            >
              <option value="">All</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shade">
            <select
              className={inputClass}
              name="shadeId"
              defaultValue={params.shadeId ?? ""}
            >
              <option value="">All</option>
              {shades.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.colorFamily.name} / {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button className={`${buttonClass} w-full`} type="submit">
              Check
            </button>
          </div>
        </form>
      </Panel>

      <div className="grid gap-1.5 xl:grid-cols-2">
        <Panel title="Availability" compact>
          {availability.length === 0 ? (
            <EmptyState text="No stock matches. Pass QC to inward lots." />
          ) : (
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Fabric</th>
                    <th>Shade</th>
                    <th>GSM</th>
                    <th>Available</th>
                    <th>Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.map((row) => (
                    <tr
                      key={`${row.fabricTypeId}-${row.shadeId}-${row.gsm}-${row.width}`}
                    >
                      <td>{row.fabricTypeName}</td>
                      <td>
                        {row.colorFamilyName} / {row.shadeName}
                      </td>
                      <td>{row.gsm ?? "—"}</td>
                      <td className="font-semibold text-(--accent-strong)">
                        {formatQty(row.available)} {row.unit}
                      </td>
                      <td>
                        {formatQty(row.reserved)} {row.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Lots / rolls" compact>
          {lots.length === 0 ? (
            <EmptyState text="No lots yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Lot</th>
                    <th>Fabric / color</th>
                    <th>Finish</th>
                    <th>Grade</th>
                    <th>W/GSM</th>
                    <th>Rolls</th>
                    <th>On hand</th>
                    <th>Mill / weaver</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => {
                    const isReturn =
                      lot.origin === "SALES_RETURN" ||
                      lot.lotNumber.startsWith("MCSR-");
                    return (
                      <tr key={lot.id}>
                        <td>
                          <Link
                            href={`/stock/${lot.id}`}
                            className="font-semibold text-(--accent) hover:underline"
                          >
                            {lot.lotNumber}
                          </Link>
                          {lot.millMarka || lot.marka ? (
                            <div className="text-[10px] text-(--muted)">
                              Mk {lot.millMarka?.code ?? lot.marka}
                              {lot.salesReturnAsNew?.markaPhotoUrl ? (
                                <>
                                  {" · "}
                                  <a
                                    href={lot.salesReturnAsNew.markaPhotoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-(--accent) hover:underline"
                                  >
                                    proof
                                  </a>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div>{lot.fabricType.name}</div>
                          <div className="text-[10px] text-(--muted)">
                            {lot.shade.colorFamily.name} / {lot.shade.name}
                          </div>
                        </td>
                        <td>{lot.finishType?.name ?? "—"}</td>
                        <td>
                          {isReturn ? "GR·" : ""}
                          {lot.qualityGrade}
                        </td>
                        <td className="tabular-nums">
                          {lot.width?.toString() ?? "—"} /{" "}
                          {lot.gsm?.toString() ?? "—"}
                        </td>
                        <td>
                          <div className="tabular-nums">{lot.rollCount}</div>
                          {lot.rolls.length > 0 ? (
                            <div className="max-w-36 truncate text-[10px] text-(--muted)">
                              {lot.rolls
                                .map((r) => `${r.rollNo}:${r.lengthM}m`)
                                .join(", ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="tabular-nums">
                          {formatQty(lot.onHand)}
                          <span className="text-(--muted)">
                            {" "}
                            / res {formatQty(lot.reserved)}
                          </span>
                        </td>
                        <td className="text-[11px]">
                          {lot.mill?.name ?? "—"}
                          <div className="text-[10px] text-(--muted)">
                            {lot.weaver?.name ?? "—"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
