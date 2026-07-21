import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, StatCard } from "@/components/ui";
import { statusBadge } from "@/lib/format";
import { formatQty } from "@/lib/utils";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  ScrollText,
} from "lucide-react";

export default async function DashboardPage() {
  const now = new Date();
  const [
    lotCount,
    weaverPriority,
    millRfOpen,
    millRfOverdue,
    provisionalBills,
    openPrograms,
    openGrey,
    overdueApprox,
    qcByInspector,
  ] = await Promise.all([
    prisma.lot.count({ where: { active: true } }),
    prisma.lot.findMany({
      where: {
        defectType: "WEAVER",
        OR: [{ returnPriority: "HIGH" }, { qualityGrade: "REJECT" }],
      },
      include: {
        fabricType: { select: { name: true } },
        shade: { select: { name: true } },
        weaver: { select: { name: true } },
        mill: { select: { name: true } },
      },
      orderBy: [{ returnPriority: "desc" }, { updatedAt: "desc" }],
      take: 12,
    }),
    prisma.millReturn.count({ where: { status: "OPEN" } }),
    prisma.millReturn.count({
      where: { status: "OPEN", dueAt: { lt: now } },
    }),
    prisma.saleBill.count({
      where: { type: "PROVISIONAL", status: "ISSUED" },
    }),
    prisma.millProgram.count({
      where: { status: { in: ["DRAFT", "SENT_TO_MILL", "IN_PROCESS"] } },
    }),
    prisma.greyPurchaseOrder.count({ where: { status: "OPEN" } }),
    prisma.saleBill.count({
      where: {
        type: "SALE",
        status: "ISSUED",
        creditStartsAt: { not: null },
        dueDate: { lt: now },
      },
    }),
    prisma.qualityCheck.groupBy({
      by: ["inspectorId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const openRfs = await prisma.millReturn.findMany({
    where: { status: "OPEN" },
    include: {
      lot: { select: { lotNumber: true, origin: true } },
      mill: { select: { name: true } },
    },
    orderBy: { dueAt: "asc" },
    take: 8,
  });

  const inspectorIds = qcByInspector
    .map((q) => q.inspectorId)
    .filter((id): id is string => Boolean(id));
  const inspectors = inspectorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: inspectorIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(inspectors.map((u) => [u.id, u.name]));

  const shortcuts = [
    { href: "/grey", title: "Grey PO" },
    { href: "/programs", title: "Programs" },
    { href: "/qc", title: "QC" },
    { href: "/returns", title: "Goods return" },
    { href: "/stock", title: "Stock" },
    { href: "/sales", title: "Sales" },
    { href: "/dispatch", title: "Delivery" },
    { href: "/payments", title: "Payments" },
    { href: "/reports", title: "Reports" },
  ];

  return (
    <div>
      <PageHeader title="Operations desk" icon={LayoutDashboard} />

      {weaverPriority.length > 0 ? (
        <Panel
          title="Weaver defect — priority"
          icon={AlertTriangle}
          className="mb-1.5"
          compact
        >
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Fabric / shade</th>
                  <th>Weaver</th>
                  <th>Qty</th>
                  <th>Pri</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {weaverPriority.map((lot) => (
                  <tr key={lot.id}>
                    <td className="font-semibold">{lot.lotNumber}</td>
                    <td>
                      {lot.fabricType.name} / {lot.shade.name}
                    </td>
                    <td>{lot.weaver?.name ?? "—"}</td>
                    <td className="tabular-nums">
                      {formatQty(lot.quantity)} {lot.unit}
                    </td>
                    <td>
                      <span
                        className={statusBadge(lot.returnPriority ?? "HIGH")}
                      >
                        {lot.returnPriority ?? "HIGH"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/stock/${lot.id}`}
                        className="text-(--accent) hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Grey POs" value={openGrey} icon={Package} />
        <StatCard label="Programs" value={openPrograms} icon={ScrollText} />
        <StatCard label="Lots" value={lotCount} icon={Boxes} />
        <StatCard label="Provisional" value={provisionalBills} />
        <StatCard label="Weaver HIGH" value={weaverPriority.length} />
        <StatCard
          label="Mill RF open"
          value={millRfOpen}
          hint={millRfOverdue ? `${millRfOverdue} overdue` : "1-day SLA"}
          icon={ClipboardCheck}
        />
        <StatCard label="Past due" value={overdueApprox} />
      </div>

      {openRfs.length > 0 ? (
        <Panel title="Mill RF — send by SLA" className="mb-1.5" compact>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>RF</th>
                  <th>Lot</th>
                  <th>Mill</th>
                  <th>Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openRfs.map((rf) => {
                  const overdue = rf.dueAt < now;
                  return (
                    <tr key={rf.id}>
                      <td className="font-semibold">{rf.rfNo}</td>
                      <td>{rf.lot.lotNumber}</td>
                      <td>{rf.mill.name}</td>
                      <td
                        className={
                          overdue
                            ? "font-semibold text-red-700"
                            : "tabular-nums text-[11px]"
                        }
                      >
                        {rf.dueAt.toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {overdue ? " · overdue" : ""}
                      </td>
                      <td>
                        <Link
                          href="/returns"
                          className="text-(--accent) hover:underline"
                        >
                          Send
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-1.5 lg:grid-cols-[1fr_220px]">
        <Panel title="Quick links" compact>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded border border-(--line) px-2 py-1.5 text-[12px] font-medium transition hover:border-(--accent) hover:bg-(--accent-soft)"
              >
                {s.title}
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="QC track" compact>
          {qcByInspector.length === 0 ? (
            <p className="text-[11px] text-(--muted)">No QC yet.</p>
          ) : (
            <ul className="space-y-0.5 text-[12px]">
              {qcByInspector.map((row) => (
                <li
                  key={row.inspectorId ?? "none"}
                  className="flex justify-between border-b border-(--line) py-0.5"
                >
                  <span className="truncate">
                    {row.inspectorId
                      ? (nameById.get(row.inspectorId) ?? "User")
                      : "Unassigned"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {row._count.id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
