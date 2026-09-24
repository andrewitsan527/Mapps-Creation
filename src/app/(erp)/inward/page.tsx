import Link from "next/link";
import { prisma } from "@/lib/db";
import { MillInwardForm } from "@/components/mill-inward-form";
import { MillReturnCompleteForm } from "@/components/mill-return-complete-form";
import { programQtySummary } from "@/server/domain/mill-inward";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";
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
import { ClipboardCheck, Inbox, ScrollText } from "lucide-react";

function QcMark({ qc }: { qc: string }) {
  const kind =
    qc === "PASS" ? "pass" : qc === "FAIL" ? "fail" : qc === "Pending QC" ? "pending" : "closed";
  return <span className={`inward-status inward-status-${kind}`}>{qc}</span>;
}

function inwardQcLabel(row: {
  lot: { id: string } | null;
  qualityChecks: { passed: boolean }[];
}) {
  const qc = row.qualityChecks[0];
  if (qc) return qc.passed ? "PASS" : "FAIL";
  if (row.lot) return "PASS";
  return "Pending QC";
}

export default async function MillInwardPage() {
  const programs = await prisma.millProgram.findMany({
    where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
    select: {
      id: true,
      programNo: true,
      status: true,
      shortageQty: true,
      mill: { select: { name: true } },
      weaver: { select: { name: true } },
      greyOrder: {
        select: {
          poNumber: true,
          quantity: true,
          unit: true,
          dyeingRate: true,
          agent: { select: { name: true } },
        },
      },
      inwards: {
        select: {
          id: true,
          inwardNo: true,
          inwardDate: true,
          quantity: true,
          unit: true,
          lot: { select: { id: true } },
          qualityChecks: {
            select: { passed: true },
            orderBy: { checkedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { inwardDate: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });

  const rows = programs.map((p) => {
    const qty = programQtySummary(p);
    return {
      id: p.id,
      programNo: p.programNo,
      status: p.status,
      millName: p.mill.name,
      weaverName: p.weaver?.name ?? null,
      greyPoNo: p.greyOrder?.poNumber ?? null,
      agentName: p.greyOrder?.agent?.name ?? null,
      dyeingRate: p.greyOrder?.dyeingRate ?? null,
      qty,
      difference:
        p.status === "CLOSED" && qty.planned != null
          ? p.shortageQty != null
            ? Number(p.shortageQty.toString())
            : Math.max(0, qty.planned - qty.received)
          : null,
      inwards: p.inwards.map((row) => ({
        id: row.id,
        inwardNo: row.inwardNo,
        inwardDate: row.inwardDate,
        quantity: Number(row.quantity.toString()),
        unit: row.unit,
        qc: inwardQcLabel(row),
      })),
    };
  });

  const active = rows.filter(
    (p) =>
      p.status !== "CLOSED" &&
      p.qty.remaining != null &&
      p.qty.remaining > 0,
  );
  const closed = rows.filter((p) => p.status === "CLOSED");
  const pendingQc = active.reduce(
    (n, p) => n + p.inwards.filter((row) => row.qc === "Pending QC").length,
    0,
  );

  const inwardable = active.map((p) => ({
    id: p.id,
    programNo: p.programNo,
    millName: p.millName,
    unit: p.qty.unit,
    remaining: p.qty.remaining,
  }));

  const inwardableSource = active.map((p) => ({
    programNo: p.programNo,
    greyPoNo: p.greyPoNo,
    millName: p.millName,
    weaverName: p.weaverName,
    agentName: p.agentName,
    planned: p.qty.planned,
    unit: p.qty.unit,
    dyeingRate: p.dyeingRate,
  }));

  return (
    <div className="inward-page tx-page space-y-3">
      <div className="tx-stage space-y-3">
      <div className="inward-chrome tx-chrome">
      <PageHeader
        title="Mill Inward"
        eyebrow="Produce"
        icon={Inbox}
        description="Record what came back from the mill. One program can have many inwards. QC and lots happen after this step."
        actions={
          <>
            <Link href="/programs" className={buttonTinyClass}>
              <ScrollText className="h-3 w-3" />
              Programs
            </Link>
            <Link href="/qc" className={buttonTinyClass}>
              <ClipboardCheck className="h-3 w-3" />
              QC desk
            </Link>
          </>
        }
      />
      </div>

      <MetricStrip className="inward-metrics tx-metrics divide-x-0 grid-cols-2 sm:grid-cols-3">
        <Metric
          label="Open programs"
          value={active.length}
          hint="Can still receive"
        />
        <Metric
          label="Pending QC"
          value={pendingQc}
          tone={pendingQc ? "warn" : "neutral"}
          hint="Inwards not inspected"
        />
        <Metric label="Closed" value={closed.length} hint="History kept" />
      </MetricStrip>

      <Section
        className="inward-section"
        title="Open programs"
        icon={Inbox}
        tone="accent"
        description="Record each physical return. Remaining is not shortage until Mill Return Completed."
      >
        <div className="grid gap-1.5 xl:grid-cols-[minmax(0,20rem)_1fr]">
          <Panel className="inward-panel" title="Record mill inward" subtitle="New receipt" compact>
            {inwardable.length === 0 ? (
              <EmptyState
                icon={Inbox}
                text="No open program with remaining quantity."
                action={
                  <Link href="/programs" className={buttonTinyClass}>
                    Go to programs
                  </Link>
                }
              />
            ) : (
              <>
                <div className="mb-2.5 space-y-2">
                  <p className="inward-source-title">Grey Purchase Source</p>
                  {inwardableSource.map((src) => (
                    <dl key={src.programNo} className="inward-source">
                      <div>
                        <dt>Grey PO No.</dt>
                        <dd>{src.greyPoNo ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Mill Program No.</dt>
                        <dd>{src.programNo}</dd>
                      </div>
                      <div>
                        <dt>Mill</dt>
                        <dd>{src.millName}</dd>
                      </div>
                      <div>
                        <dt>Weaver</dt>
                        <dd>{src.weaverName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Agent</dt>
                        <dd>{src.agentName ?? "Direct"}</dd>
                      </div>
                      <div>
                        <dt>Planned qty</dt>
                        <dd>
                          {src.planned != null
                            ? `${formatQty(src.planned)} ${src.unit}`
                            : "—"}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt>Dyeing rate</dt>
                        <dd>
                          {src.dyeingRate != null
                            ? `${formatMoney(src.dyeingRate)}/${src.unit}`
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  ))}
                </div>
                <MillInwardForm programs={inwardable} />
              </>
            )}
          </Panel>

          <Panel className="inward-panel" title="Active receipts" compact flush>
            {active.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No open mill programs awaiting further inward." />
              </div>
            ) : (
              <TableWrap>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Program</th>
                      <th>Qty</th>
                      <th>Inwards</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <p className="inward-prog">{p.programNo}</p>
                          <p className="inward-support">
                            {p.millName}
                            {p.weaverName ? ` · ${p.weaverName}` : ""}
                          </p>
                        </td>
                        <td className="tabular-nums">
                          <div className="inward-qty">
                            Planned {formatQty(p.qty.planned ?? 0)} {p.qty.unit}
                          </div>
                          <div className="inward-qty-sub">
                            Received {formatQty(p.qty.received)} · left{" "}
                            {formatQty(p.qty.remaining ?? 0)}
                          </div>
                        </td>
                        <td>
                          {p.inwards.length === 0 ? (
                            <span className="inward-empty">None yet</span>
                          ) : (
                            <table className="erp-table">
                              <thead>
                                <tr>
                                  <th>Inward</th>
                                  <th>Date</th>
                                  <th>Qty</th>
                                  <th>QC</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.inwards.map((row) => (
                                  <tr key={row.id}>
                                    <td className="font-medium">
                                      {row.inwardNo}
                                    </td>
                                    <td>{formatDate(row.inwardDate)}</td>
                                    <td className="tabular-nums">
                                      {formatQty(row.quantity)} {row.unit}
                                    </td>
                                    <td>
                                      <QcMark qc={row.qc} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                        <td>
                          {p.qty.planned != null &&
                          p.qty.remaining != null &&
                          p.qty.remaining > 0 ? (
                            <div className="inward-complete">
                            <MillReturnCompleteForm
                              programId={p.id}
                              programNo={p.programNo}
                              planned={p.qty.planned}
                              received={p.qty.received}
                              remaining={p.qty.remaining}
                              unit={p.qty.unit}
                            />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>
      </Section>

      <Section
        className="inward-section"
        title="Closed / completed"
        description="Inward history stays visible after Mill Return Completed."
      >
        <Panel className="inward-panel inward-panel-history" flush>
          {closed.length === 0 ? (
            <div className="p-2.5">
              <EmptyState text="No closed programs yet." />
            </div>
          ) : (
            <TableWrap>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Qty</th>
                    <th>Inwards</th>
                  </tr>
                </thead>
                <tbody>
                  {closed.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <p className="inward-prog">{p.programNo}</p>
                        <p className="inward-support">
                          {p.millName}
                          {p.weaverName ? ` · ${p.weaverName}` : ""}
                        </p>
                        <p className="inward-status inward-status-closed">
                          CLOSED
                        </p>
                      </td>
                      <td className="tabular-nums">
                        <div className="inward-qty">
                          Planned {formatQty(p.qty.planned ?? 0)} {p.qty.unit}
                        </div>
                        <div className="inward-qty-sub">
                          Received {formatQty(p.qty.received)} · difference{" "}
                          {formatQty(p.difference ?? 0)}
                        </div>
                      </td>
                      <td>
                        {p.inwards.length === 0 ? (
                          <span className="inward-empty">No inwards</span>
                        ) : (
                          <table className="erp-table">
                            <thead>
                              <tr>
                                <th>Inward</th>
                                <th>Date</th>
                                <th>Qty</th>
                                <th>QC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.inwards.map((row) => (
                                <tr key={row.id}>
                                  <td className="font-medium">
                                    {row.inwardNo}
                                  </td>
                                  <td>{formatDate(row.inwardDate)}</td>
                                  <td className="tabular-nums">
                                    {formatQty(row.quantity)} {row.unit}
                                  </td>
                                  <td>
                                    <QcMark qc={row.qc} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
      </Section>

      <div className="inward-next">
      <NextStep
        steps={[
          {
            label: "Inspect on QC desk",
            href: "/qc",
            hint: "PASS creates lot + stock",
            count: pendingQc || undefined,
          },
        ]}
      />
      </div>
      </div>
    </div>
  );
}
