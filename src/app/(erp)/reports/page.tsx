import { prisma } from "@/lib/db";
import { formatQty } from "@/lib/utils";
import { PageHeader, Panel, StatCard, EmptyState } from "@/components/ui";

export default async function ReportsPage() {
  const [qcTotal, qcPass, qcFail, millDefects, weaverHigh, programs, lots, sales] =
    await Promise.all([
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
          shade: { select: { name: true, colorFamily: { select: { name: true } } } },
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

  return (
    <div>
      <PageHeader
        title="Reports"
        description="QC pass rate, defect mix, program status, and live stock by shade."
      />
      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="QC total" value={qcTotal} />
        <StatCard label="Pass rate" value={`${passRate}%`} />
        <StatCard label="QC fail" value={qcFail} />
        <StatCard label="Mill defect" value={millDefects} />
        <StatCard label="Weaver HIGH" value={weaverHigh} />
        <StatCard
          label="Sale bills"
          value={sales._count.id}
          hint={`₹${formatQty(sales._sum.total ?? 0)}`}
        />
      </div>

      <div className="grid gap-1.5 lg:grid-cols-2">
        <Panel title="Program status" compact>
          {programs.length === 0 ? (
            <EmptyState text="No programs." />
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.status}>
                    <td>{p.status}</td>
                    <td className="font-semibold tabular-nums">{p._count.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Stock by fabric / shade (top 25)" compact>
          {stockRows.length === 0 ? (
            <EmptyState text="No active stock." />
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Fabric / shade</th>
                    <th>Avail</th>
                    <th>Reserved</th>
                    <th>On hand</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="font-semibold text-(--accent-strong)">
                        {formatQty(r.available)}
                      </td>
                      <td>{formatQty(r.reserved)}</td>
                      <td>{formatQty(r.onHand)}</td>
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
