import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAvailability } from "@/server/domain/stock";
import { formatQty } from "@/lib/utils";
import {
  EmptyState,
  Field,
  Metric,
  MetricStrip,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import { Boxes, Layers, Search } from "lucide-react";

function schemeLabel(row: {
  quality?: { name: string } | null;
  code?: { name: string } | null;
  colour?: { name: string } | null;
  qualityName?: string | null;
  codeName?: string | null;
  colourName?: string | null;
}) {
  const q = row.quality?.name ?? row.qualityName;
  const c = row.code?.name ?? row.codeName;
  const col = row.colour?.name ?? row.colourName;
  if (q && c && col) return `${q} / ${c} / ${col}`;
  return "Incomplete identity";
}

type SearchParams = Promise<{
  fabricTypeId?: string;
  qualityId?: string;
  codeId?: string;
  colourId?: string;
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
  quality: { name: string } | null;
  code: { name: string } | null;
  colour: { name: string } | null;
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
  const filtered = Boolean(
    params.fabricTypeId ||
      params.qualityId ||
      params.codeId ||
      params.colourId,
  );

  const [fabrics, qualities, codes, colours, availability, lots] =
    await Promise.all([
    prisma.fabricType.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.quality.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.code.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.colour.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getAvailability(prisma, {
      fabricTypeId: params.fabricTypeId,
      qualityId: params.qualityId,
      codeId: params.codeId,
      colourId: params.colourId,
    }),
    prisma.lot.findMany({
      where: {
        active: true,
        ...(params.fabricTypeId ? { fabricTypeId: params.fabricTypeId } : {}),
        ...(params.qualityId ? { qualityId: params.qualityId } : {}),
        ...(params.codeId ? { codeId: params.codeId } : {}),
        ...(params.colourId ? { colourId: params.colourId } : {}),
      },
      include: {
        fabricType: { select: { name: true } },
        quality: { select: { name: true } },
        code: { select: { name: true } },
        colour: { select: { name: true } },
        finishType: { select: { name: true } },
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

  const totalAvailable = availability.reduce(
    (sum, row) => sum + Number(row.available),
    0,
  );
  const totalReserved = availability.reduce(
    (sum, row) => sum + Number(row.reserved),
    0,
  );
  const grLots = lots.filter(
    (lot) =>
      lot.origin === "SALES_RETURN" || lot.lotNumber.startsWith("MCSR-"),
  ).length;

  return (
    <div className="tx-page tx-page-stock">
      <div className="tx-stage space-y-3">
      <div className="tx-chrome">
      <PageHeader
        title="Live stock"
        eyebrow="Inventory"
        icon={Boxes}
        description="QC-passed lots by fabric plus Quality / Code / Colour. Reserved qty is already committed to a provisional or issued bill."
        actions={
          <Link href="/sales" className={buttonTinyClass}>
            Reserve or bill
          </Link>
        }
      />
      </div>

      <MetricStrip className="tx-metrics divide-x-0 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Available"
          value={formatQty(totalAvailable)}
          tone="accent"
          hint="Free to sell"
        />
        <Metric
          label="Reserved"
          value={formatQty(totalReserved)}
          tone={totalReserved > 0 ? "info" : "neutral"}
          hint="Committed to bills"
        />
        <Metric label="Active lots" value={lots.length} hint="In this view" />
        <Metric
          label="Resale (GR)"
          value={grLots}
          tone={grLots ? "warn" : "neutral"}
          hint="Return stock"
        />
        <Metric
          label="Combinations"
          value={availability.length}
          hint="Fabric × identity"
        />
      </MetricStrip>

      <Panel title="Stock enquiry" icon={Search} compact>
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
          <Field label="Quality">
            <select
              className={inputClass}
              name="qualityId"
              defaultValue={params.qualityId ?? ""}
            >
              <option value="">All</option>
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Code">
            <select
              className={inputClass}
              name="codeId"
              defaultValue={params.codeId ?? ""}
            >
              <option value="">All</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Colour">
            <select
              className={inputClass}
              name="colourId"
              defaultValue={params.colourId ?? ""}
            >
              <option value="">All</option>
              {colours.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end gap-1.5">
            <button className={buttonClass} type="submit">
              <Search className="h-3 w-3" />
              Check
            </button>
            {filtered ? (
              <Link href="/stock" className={buttonTinyClass}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </Panel>

      <Section
        title="What we hold"
        icon={Layers}
        description="Rolled up by specification, then lot by lot"
      >
        <div className="grid gap-1.5 xl:grid-cols-2">
          <Panel
            title="Availability by spec"
            icon={Layers}
            tone="accent"
            subtitle={`${availability.length} combinations`}
            flush
          >
            {availability.length === 0 ? (
              <div className="p-2.5">
                <EmptyState
                  icon={Layers}
                  text="No stock matches this enquiry. Pass a QC to inward lots."
                  action={
                    <Link href="/qc" className={buttonTinyClass}>
                      QC desk
                    </Link>
                  }
                />
              </div>
            ) : (
              <TableWrap maxHeight={420}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Fabric</th>
                      <th>Identity</th>
                      <th>GSM</th>
                      <th className="num">Available</th>
                      <th className="num">Reserved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availability.map((row) => (
                      <tr
                        key={`${row.identity}-${row.fabricTypeId}-${row.qualityId}-${row.codeId}-${row.colourId}-${row.gsm}-${row.width}-${row.unit}`}
                      >
                        <td className="font-medium">{row.fabricTypeName}</td>
                        <td className="text-(--muted)">
                          {schemeLabel(row)}
                        </td>
                        <td className="text-(--muted)">{row.gsm ?? "—"}</td>
                        <td className="num font-semibold text-(--accent-strong)">
                          {formatQty(row.available)} {row.unit}
                        </td>
                        <td className="num text-(--muted)">
                          {formatQty(row.reserved)} {row.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>

          <Panel
            title="Lots & rolls"
            icon={Boxes}
            subtitle={`${lots.length} lots`}
            flush
          >
            {lots.length === 0 ? (
              <div className="p-2.5">
                <EmptyState icon={Boxes} text="No lots in this view." />
              </div>
            ) : (
              <TableWrap maxHeight={420}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Fabric / color</th>
                      <th>Grade</th>
                      <th>W/GSM</th>
                      <th>Rolls</th>
                      <th className="num">On hand</th>
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
                              <div className="text-[10px] text-(--faint)">
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
                              {schemeLabel(lot)}
                              {lot.finishType ? ` · ${lot.finishType.name}` : ""}
                            </div>
                          </td>
                          <td>
                            {isReturn ? (
                              <span className="badge badge-warn">
                                GR·{lot.qualityGrade}
                              </span>
                            ) : (
                              <span className="badge badge-ok">
                                {lot.qualityGrade}
                              </span>
                            )}
                          </td>
                          <td className="text-[11px] tabular-nums text-(--muted)">
                            {lot.width?.toString() ?? "—"} /{" "}
                            {lot.gsm?.toString() ?? "—"}
                          </td>
                          <td>
                            <div className="tabular-nums">{lot.rollCount}</div>
                            {lot.rolls.length > 0 ? (
                              <div className="max-w-36 truncate text-[10px] text-(--faint)">
                                {lot.rolls
                                  .map((r) => `${r.rollNo}:${r.lengthM}m`)
                                  .join(", ")}
                              </div>
                            ) : null}
                          </td>
                          <td className="num">
                            <span className="font-semibold">
                              {formatQty(lot.onHand)}
                            </span>
                            <div className="text-[10px] font-normal text-(--faint)">
                              res {formatQty(lot.reserved)}
                            </div>
                          </td>
                          <td className="text-[11px]">
                            {lot.mill?.name ?? "—"}
                            <div className="text-[10px] text-(--faint)">
                              {lot.weaver?.name ?? "—"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>

        <div className="tx-next">
        <NextStep
          steps={[
            {
              label: "Reserve or bill this stock",
              href: "/sales",
              hint: "Provisional order or sale bill",
            },
            {
              label: "Inspect incoming lots",
              href: "/qc",
              hint: "Only passed lots land here",
            },
            {
              label: "Resale return stock",
              href: "/returns",
              hint: "MCSR inventory",
              count: grLots || undefined,
            },
          ]}
        />
        </div>
      </Section>
      </div>
    </div>
  );
}
