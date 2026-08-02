import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoneyShort, formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import {
  EmptyState,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonTinyClass,
} from "@/components/ui";
import { BarChart3, Boxes, ClipboardCheck, ScrollText } from "lucide-react";

export default async function ReportsPage() {
  const [
    qcTotal,
    qcPass,
    qcFail,
    millDefects,
    weaverHigh,
    programs,
    lots,
    sales,
  ] = await Promise.all([
    prisma.qualityCheck.count(),
    prisma.qualityCheck.count({ where: { passed: true } }),
    prisma.qualityCheck.count({ where: { passed: false } }),
    prisma.qualityCheck.count({ where: { defectType: "MILL" } }),
    prisma.qualityCheck.count({
      where: { defectType: "WEAVER", severity: "HIGH" },
    }),
    prisma.millProgram.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.lot.findMany({
      where: { active: true },
      select: {
        onHand: true,
        reserved: true,
        fabricType: { select: { name: true } },
        shade: {
          select: { name: true, colorFamily: { select: { name: true } } },
        },
      },
      take: 200,
    }),
    prisma.saleBill.aggregate({
      where: { type: "SALE", status: "ISSUED" },
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  const passRate =
    qcTotal === 0 ? 0 : Math.round((qcPass / qcTotal) * 1000) / 10;

  const stockByShade = new Map<
    string,
    { onHand: number; reserved: number; available: number }
  >();
  for (const lot of lots) {
    const key = `${lot.fabricType.name} / ${lot.shade.colorFamily.name}/${lot.shade.name}`;
    const onHand = Number(lot.onHand);
    const reserved = Number(lot.reserved);
    const cur = stockByShade.get(key) ?? {
      onHand: 0,
      reserved: 0,
      available: 0,
    };
    cur.onHand += onHand;
    cur.reserved += reserved;
    cur.available += onHand - reserved;
    stockByShade.set(key, cur);
  }

  const stockRows = Array.from(stockByShade.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.available - a.available)
    .slice(0, 25);
  const maxAvailable = Math.max(...stockRows.map((r) => r.available), 1);
  const maxProgram = Math.max(...programs.map((p) => p._count.id), 1);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Reports"
        eyebrow="Insight"
        icon={BarChart3}
        description="Quality performance, where programs are stuck, and how stock is distributed across fabric and shade."
        actions={
          <Link href="/dashboard" className={buttonTinyClass}>
            Control tower
          </Link>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="QC checks" value={qcTotal} />
        <Metric
          label="Pass rate"
          value={`${passRate}%`}
          tone={passRate >= 90 ? "accent" : passRate >= 75 ? "warn" : "danger"}
        />
        <Metric
          label="QC fail"
          value={qcFail}
          tone={qcFail ? "warn" : "neutral"}
        />
        <Metric
          label="Mill defect"
          value={millDefects}
          tone={millDefects ? "danger" : "neutral"}
        />
        <Metric
          label="Weaver HIGH"
          value={weaverHigh}
          tone={weaverHigh ? "danger" : "neutral"}
        />
        <Metric
          label="Sale bills"
          value={sales._count.id}
          hint={formatMoneyShort(Number(sales._sum.total ?? 0))}
        />
      </MetricStrip>

      <Section
        title="Quality"
        icon={ClipboardCheck}
        description="Pass, fail, and where the fault sits"
      >
        <Panel compact>
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-[12px] font-semibold">
              {qcPass} passed of {qcTotal} checks
            </p>
            <p className="text-[12px] font-semibold tabular-nums text-(--accent-strong)">
              {passRate}%
            </p>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-(--line-soft)">
            <div
              className="bg-(--accent)"
              style={{ width: `${qcTotal ? (qcPass / qcTotal) * 100 : 0}%` }}
            />
            <div
              className="bg-(--danger)"
              style={{ width: `${qcTotal ? (qcFail / qcTotal) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="badge badge-ok">{qcPass} pass</span>
            <span className="badge badge-danger">{qcFail} fail</span>
            <span className="badge badge-warn">{millDefects} mill defect</span>
            <span className="badge badge-info">{weaverHigh} weaver HIGH</span>
          </div>
        </Panel>
      </Section>

      <div className="grid gap-1.5 lg:grid-cols-2">
        <Panel
          title="Programs by status"
          icon={ScrollText}
          tone="info"
          flush
          action={
            <Link href="/programs" className={buttonTinyClass}>
              Open
            </Link>
          }
        >
          {programs.length === 0 ? (
            <div className="p-2.5">
              <EmptyState text="No programs." />
            </div>
          ) : (
            <TableWrap maxHeight={300}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Share</th>
                    <th className="num">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p.status}>
                      <td>
                        <span className={statusBadge(p.status)}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--line-soft)">
                          <div
                            className="h-full rounded-full bg-(--accent)"
                            style={{
                              width: `${(p._count.id / maxProgram) * 100}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="num font-semibold">{p._count.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <Panel
          title="Stock by fabric / shade"
          icon={Boxes}
          tone="accent"
          subtitle="Top 25 by available"
          flush
          action={
            <Link href="/stock" className={buttonTinyClass}>
              Open
            </Link>
          }
        >
          {stockRows.length === 0 ? (
            <div className="p-2.5">
              <EmptyState text="No active stock." />
            </div>
          ) : (
            <TableWrap maxHeight={300}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Fabric / shade</th>
                    <th>Share</th>
                    <th className="num">Avail</th>
                    <th className="num">Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((r) => (
                    <tr key={r.name}>
                      <td className="max-w-56 truncate">{r.name}</td>
                      <td className="w-20">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--line-soft)">
                          <div
                            className="h-full rounded-full bg-(--accent)"
                            style={{
                              width: `${Math.max(
                                2,
                                (r.available / maxAvailable) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="num font-semibold text-(--accent-strong)">
                        {formatQty(r.available)}
                      </td>
                      <td className="num text-(--muted)">
                        {formatQty(r.reserved)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
      </div>
    </div>
  );
}
