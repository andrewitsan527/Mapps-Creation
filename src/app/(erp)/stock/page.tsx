import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAvailability } from "@/server/domain/stock";
import { formatQty } from "@/lib/utils";
import {
  EmptyState,
  Metric,
  MetricStrip,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonTinyClass,
} from "@/components/ui";
import { Boxes, Layers } from "lucide-react";

export default async function StockPage() {
  const [availability, lots] = await Promise.all([
    getAvailability(prisma, {}),
    prisma.lot.findMany({
      where: { active: true },
      include: {
        salesReturnAsNew: { select: { markaPhotoUrl: true } },
        rolls: { orderBy: { sortOrder: "asc" }, take: 12 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
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
                <table className="erp-table erp-register">
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
                      <tr key={`${row.gsm}-${row.width}-${row.unit}`}>
                        <td className="font-medium">—</td>
                        <td className="text-(--muted)">—</td>
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
                <table className="erp-table erp-register">
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
                          <td className="erp-stack">
                            <Link
                              href={`/stock/${lot.id}`}
                              className="font-semibold text-(--accent) hover:underline"
                            >
                              {lot.lotNumber}
                            </Link>
                            {lot.marka ? (
                              <div className="text-[10px] text-(--faint)">
                                Mk {lot.marka}
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
                          <td className="erp-stack">
                            <div className="erp-clip">—</div>
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
                          <td className="erp-stack">
                            <div className="tabular-nums">{lot.rollCount}</div>
                            {lot.rolls.length > 0 ? (
                              <div className="max-w-36 truncate text-[10px] text-(--faint)">
                                {lot.rolls
                                  .map((r) => `${r.rollNo}:${r.lengthM}m`)
                                  .join(", ")}
                              </div>
                            ) : null}
                          </td>
                          <td className="num erp-stack">
                            <span className="font-semibold">
                              {formatQty(lot.onHand)}
                            </span>
                            <div className="text-[10px] font-normal text-(--faint)">
                              res {formatQty(lot.reserved)}
                            </div>
                          </td>
                          <td className="erp-stack text-[11px]">
                            —
                            <div className="text-[10px] text-(--faint)">—</div>
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
