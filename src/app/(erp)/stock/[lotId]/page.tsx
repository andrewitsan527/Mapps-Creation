import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { availableQty, formatDateTime, formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { formatDec, rollsDetailText } from "@/server/domain/goods";
import {
  Breadcrumbs,
  EmptyState,
  KeyValue,
  Metric,
  MetricStrip,
  NextStep,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonGhostClass,
} from "@/components/ui";
import {
  Boxes,
  CheckCircle2,
  Circle,
  History,
  Layers,
  RotateCcw,
  Truck,
} from "lucide-react";

type TrailLot = {
  id: string;
  lotNumber: string;
  marka: string | null;
  rollNumber: string | null;
  origin: string;
  qualityGrade: string;
  width: { toString(): string } | null;
  gsm: { toString(): string } | null;
  lengthM: { toString(): string } | null;
  quantity: { toString(): string };
  weightKg: { toString(): string } | null;
  rollCount: number;
  onHand: { toString(): string };
  reserved: { toString(): string };
  fabricType: { name: string };
  shade: { name: string; colorFamily: { name: string } };
  finishType: { name: string } | null;
  millMarka: { code: string } | null;
  mill: { name: string } | null;
  weaver: { name: string } | null;
  sourceSaleBill: { id: string; billNo: string } | null;
  salesReturnAsNew: {
    id: string;
    priority: string;
    status: string;
    markaPhotoUrl: string | null;
    reason: string | null;
  } | null;
  rolls: {
    id: string;
    rollNo: string;
    lengthM: { toString(): string };
    weightKg: { toString(): string } | null;
    notes: string | null;
  }[];
  program: {
    id: string;
    programNo: string;
    mill: { name: string };
    weaver: { name: string } | null;
    finishType: { name: string } | null;
    greyOrder: { poNumber: string; supplier: { name: string } | null } | null;
  } | null;
  greyOrder: { poNumber: string; supplier: { name: string } | null } | null;
  qualityChecks: {
    passed: boolean;
    defectType: string;
    severity: string | null;
    checkedAt: Date;
    inspector: { name: string } | null;
  }[];
  billLines: {
    id: string;
    quantity: { toString(): string };
    unit: string;
    bill: { id: string; billNo: string; type: string; status: string };
  }[];
  dispatchLines: {
    id: string;
    dispatch: {
      challanNo: string;
      vehicleNo: string | null;
      saleBill: { id: string; billNo: string } | null;
      party: { name: string };
    };
  }[];
  movements: {
    id: string;
    createdAt: Date;
    type: string;
    quantity: { toString(): string };
    referenceType: string | null;
    notes: string | null;
  }[];
  unit: string;
  millReturns: {
    id: string;
    rfNo: string;
    status: string;
    dueAt: Date;
    sentAt: Date | null;
    whatsappSent: boolean;
    mill: { name: string };
  }[];
};

export default async function LotTrailPage({
  params,
}: {
  params: Promise<{ lotId: string }>;
}) {
  const { lotId } = await params;
  const lot = (await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      fabricType: true,
      shade: { include: { colorFamily: true } },
      finishType: true,
      millMarka: true,
      mill: true,
      weaver: true,
      sourceSaleBill: { select: { id: true, billNo: true } },
      salesReturnAsNew: {
        select: {
          id: true,
          priority: true,
          status: true,
          markaPhotoUrl: true,
          reason: true,
        },
      },
      rolls: { orderBy: { sortOrder: "asc" } },
      program: {
        include: {
          mill: true,
          weaver: true,
          finishType: true,
          greyOrder: { include: { supplier: true } },
        },
      },
      greyOrder: { include: { supplier: true } },
      qualityChecks: {
        include: { inspector: { select: { name: true } } },
        orderBy: { checkedAt: "desc" },
      },
      movements: { orderBy: { createdAt: "desc" }, take: 40 },
      billLines: {
        include: {
          bill: {
            select: { id: true, billNo: true, type: true, status: true },
          },
        },
        take: 20,
      },
      dispatchLines: {
        include: {
          dispatch: {
            select: {
              challanNo: true,
              vehicleNo: true,
              status: true,
              saleBill: { select: { id: true, billNo: true } },
              party: { select: { name: true } },
            },
          },
        },
        take: 20,
      },
      millReturns: {
        include: { mill: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })) as TrailLot | null;

  if (!lot) notFound();

  const greyPo = lot.program?.greyOrder ?? lot.greyOrder;
  const greySupplierName = greyPo?.supplier?.name;
  const millName = lot.mill?.name ?? lot.program?.mill.name ?? "—";
  const weaverName = lot.weaver?.name ?? lot.program?.weaver?.name ?? "—";
  const finishName =
    lot.finishType?.name ?? lot.program?.finishType?.name ?? "—";

  const avail = availableQty(lot.onHand.toString(), lot.reserved.toString());
  const isReturn = lot.origin === "SALES_RETURN";
  const latestQc = lot.qualityChecks[0];

  const journey = [
    {
      label: isReturn ? "Returned" : "Grey",
      done: isReturn ? true : Boolean(greyPo),
      detail: isReturn
        ? (lot.sourceSaleBill?.billNo ?? "goods return")
        : (greyPo?.poNumber ?? "not linked"),
    },
    {
      label: "Program",
      done: Boolean(lot.program),
      detail: lot.program?.programNo ?? (isReturn ? "n/a" : "not linked"),
    },
    {
      label: "QC",
      done: lot.qualityChecks.length > 0,
      detail: latestQc
        ? `${latestQc.passed ? "PASS" : "FAIL"} · ${latestQc.defectType}`
        : "pending",
    },
    {
      label: "Stock",
      done: Number(lot.onHand) > 0,
      detail: `${formatQty(lot.onHand)} ${lot.unit} on hand`,
    },
    {
      label: "Sold",
      done: lot.billLines.length > 0,
      detail:
        lot.billLines.length > 0
          ? `${lot.billLines.length} bill line(s)`
          : "not billed",
    },
    {
      label: "Delivered",
      done: lot.dispatchLines.length > 0,
      detail:
        lot.dispatchLines[0]?.dispatch.party.name ?? "not dispatched",
    },
  ];

  return (
    <div className="space-y-3">
      <Breadcrumbs
        items={[
          { label: "Inventory", href: "/stock" },
          { label: "Live stock", href: "/stock" },
          { label: lot.lotNumber },
        ]}
      />

      <PageHeader
        title={lot.lotNumber}
        icon={Boxes}
        description={`${lot.fabricType.name} · ${lot.shade.colorFamily.name}/${lot.shade.name} · finish ${finishName}`}
        actions={
          <>
            {isReturn ? (
              <span className="badge badge-warn">Goods return lot</span>
            ) : null}
            <Link href="/stock" className={buttonGhostClass}>
              Back to stock
            </Link>
          </>
        }
      />

      <Panel flush>
        <ol className="flex overflow-x-auto divide-x divide-(--line-soft)">
          {journey.map((step) => (
            <li key={step.label} className="min-w-[128px] flex-1 px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-(--accent)" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-(--faint)" />
                )}
                <span
                  className={`text-[10.5px] font-semibold tracking-wide uppercase ${
                    step.done ? "text-(--accent-strong)" : "text-(--muted)"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11.5px] text-(--ink)">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </Panel>

      <MetricStrip className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Available"
          value={`${formatQty(avail)} ${lot.unit}`}
          tone={avail > 0 ? "accent" : "warn"}
        />
        <Metric label="On hand" value={formatQty(lot.onHand)} />
        <Metric
          label="Reserved"
          value={formatQty(lot.reserved)}
          tone={Number(lot.reserved) > 0 ? "info" : "neutral"}
        />
        <Metric
          label="Rolls"
          value={lot.rollCount}
          hint={`${formatDec(lot.lengthM ?? lot.quantity)} m total`}
        />
        <Metric
          label="Grade"
          value={lot.qualityGrade}
          tone={lot.qualityGrade === "REJECT" ? "danger" : "accent"}
        />
      </MetricStrip>

      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Specification" icon={Layers} compact>
          <KeyValue
            items={[
              { label: "Width", value: formatDec(lot.width) },
              { label: "GSM", value: formatDec(lot.gsm) },
              { label: "Finish", value: finishName },
            ]}
          />
        </Panel>
        <Panel title="Size" icon={Boxes} compact>
          <KeyValue
            items={[
              {
                label: "Length",
                value: `${formatDec(lot.lengthM ?? lot.quantity)} m`,
              },
              { label: "Weight", value: `${formatDec(lot.weightKg)} kg` },
              { label: "Rolls", value: lot.rollCount },
            ]}
          />
        </Panel>
        <Panel title="Made by" icon={Layers} compact>
          <KeyValue
            items={[
              { label: "Mill", value: millName },
              { label: "Weaver", value: weaverName },
              {
                label: "Marka",
                value: lot.millMarka?.code ?? lot.marka ?? "—",
              },
            ]}
          />
        </Panel>
        <Panel
          title="Quality"
          icon={CheckCircle2}
          tone={latestQc?.passed === false ? "danger" : "accent"}
          compact
        >
          <KeyValue
            items={[
              {
                label: "Result",
                value: latestQc
                  ? latestQc.passed
                    ? "Passed"
                    : "Failed"
                  : "Pending",
              },
              { label: "Defect", value: latestQc?.defectType ?? "—" },
              {
                label: "Inspector",
                value: latestQc?.inspector?.name ?? "—",
              },
            ]}
          />
        </Panel>
      </div>

      <Section title="Rolls" icon={Layers}>
        <Panel compact>
          {lot.salesReturnAsNew?.markaPhotoUrl ? (
            <p className="mb-1.5 text-[11px]">
              Verified marka:{" "}
              <strong>{lot.millMarka?.code ?? lot.marka}</strong>
              {" · "}
              <a
                href={lot.salesReturnAsNew.markaPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-(--accent) hover:underline"
              >
                View QC photo
              </a>
            </p>
          ) : null}
          {lot.rolls.length === 0 ? (
            <p className="text-[11px] text-(--muted)">
              {rollsDetailText(
                lot as unknown as Parameters<typeof rollsDetailText>[0],
              )}{" "}
              · marka {lot.marka ?? "—"}
              {lot.rollNumber ? ` · roll ${lot.rollNumber}` : ""}
            </p>
          ) : (
            <TableWrap maxHeight={260}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th className="num">Length (m)</th>
                    <th className="num">Weight (kg)</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {lot.rolls.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.rollNo}</td>
                      <td className="num">{formatDec(r.lengthM)}</td>
                      <td className="num">{formatDec(r.weightKg)}</td>
                      <td className="text-(--muted)">{r.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
      </Section>

      {lot.millReturns.length > 0 ? (
        <Section title="Mill RF on this lot" icon={RotateCcw} tone="warn">
          <Panel flush>
            <TableWrap>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>RF</th>
                    <th>Mill</th>
                    <th>Status</th>
                    <th>Due / sent</th>
                    <th>WA</th>
                  </tr>
                </thead>
                <tbody>
                  {lot.millReturns.map((rf) => (
                    <tr key={rf.id}>
                      <td className="font-semibold">{rf.rfNo}</td>
                      <td className="text-(--muted)">{rf.mill.name}</td>
                      <td>
                        <span className={statusBadge(rf.status)}>
                          {rf.status}
                        </span>
                      </td>
                      <td className="text-[11px]">
                        {formatDateTime(rf.dueAt)}
                        {rf.sentAt ? (
                          <div className="text-(--muted)">
                            sent {formatDateTime(rf.sentAt)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={
                            rf.whatsappSent
                              ? "badge badge-wa"
                              : "badge badge-warn"
                          }
                        >
                          {rf.whatsappSent ? "Sent" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </Section>
      ) : null}

      <Section title="Where it came from, where it went" icon={History}>
        <div className="grid gap-1.5 xl:grid-cols-2">
          <Panel title="Origin trail" icon={History} compact>
            <dl className="grid grid-cols-[92px_1fr] gap-x-2 gap-y-1.5 text-[12px]">
              {isReturn ? (
                <>
                  <dt className="text-(--muted)">Goods return</dt>
                  <dd>
                    {lot.sourceSaleBill ? (
                      <Link
                        href={`/sales/${lot.sourceSaleBill.id}`}
                        className="font-medium text-(--accent) hover:underline"
                      >
                        {lot.sourceSaleBill.billNo}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {lot.salesReturnAsNew
                      ? ` · ${lot.salesReturnAsNew.priority} · ${lot.salesReturnAsNew.status}`
                      : ""}
                  </dd>
                </>
              ) : null}
              <dt className="text-(--muted)">Grey PO</dt>
              <dd>
                {greyPo ? (
                  <Link
                    href="/grey"
                    className="font-medium text-(--accent) hover:underline"
                  >
                    {greyPo.poNumber}
                  </Link>
                ) : (
                  "—"
                )}
                {greySupplierName ? (
                  <span className="text-(--muted)"> · {greySupplierName}</span>
                ) : null}
              </dd>
              <dt className="text-(--muted)">Program</dt>
              <dd>
                {lot.program ? (
                  <>
                    <Link
                      href="/programs"
                      className="font-medium text-(--accent) hover:underline"
                    >
                      {lot.program.programNo}
                    </Link>
                    <span className="text-(--muted)">
                      {" "}
                      · mill {lot.program.mill.name}
                      {lot.program.weaver
                        ? ` · weaver ${lot.program.weaver.name}`
                        : ""}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-(--muted)">QC</dt>
              <dd>
                {lot.qualityChecks.length === 0 ? (
                  <span className="badge badge-warn">Pending</span>
                ) : (
                  <ul className="space-y-0.5">
                    {lot.qualityChecks.map((q, i) => (
                      <li key={i}>
                        <span
                          className={
                            q.passed ? "badge badge-ok" : "badge badge-danger"
                          }
                        >
                          {q.passed ? "PASS" : "FAIL"}
                        </span>{" "}
                        <span className="text-(--muted)">
                          {q.defectType}
                          {q.severity ? ` ${q.severity}` : ""} ·{" "}
                          {q.inspector?.name ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
          </Panel>

          <Panel title="Sales & delivery" icon={Truck} compact>
            {lot.billLines.length === 0 && lot.dispatchLines.length === 0 ? (
              <EmptyState text="Not billed yet. This lot is still free stock." />
            ) : (
              <ul className="space-y-1 text-[12px]">
                {lot.billLines.map((line) => (
                  <li key={line.id}>
                    <Link
                      href={`/sales/${line.bill.id}`}
                      className="font-semibold text-(--accent) hover:underline"
                    >
                      {line.bill.billNo}
                    </Link>{" "}
                    <span className={statusBadge(line.bill.status)}>
                      {line.bill.type}
                    </span>{" "}
                    <span className="text-(--muted)">
                      {formatQty(line.quantity)}
                      {line.unit}
                    </span>
                  </li>
                ))}
                {lot.dispatchLines.map((line) => (
                  <li key={line.id} className="text-(--muted)">
                    Delivered → {line.dispatch.party.name}
                    {line.dispatch.saleBill
                      ? ` · ${line.dispatch.saleBill.billNo}`
                      : ""}
                    {line.dispatch.vehicleNo
                      ? ` · ${line.dispatch.vehicleNo}`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Section>

      <Section title="Stock movements" icon={History}>
        <Panel flush>
          {lot.movements.length === 0 ? (
            <div className="p-2.5">
              <EmptyState text="No movements yet. Stock enters on a QC pass." />
            </div>
          ) : (
            <TableWrap maxHeight={340}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th className="num">Qty</th>
                    <th>Ref</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {lot.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="text-[11px] text-(--muted)">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td>
                        <span className={statusBadge(m.type)}>{m.type}</span>
                      </td>
                      <td className="num">
                        {formatQty(m.quantity)} {lot.unit}
                      </td>
                      <td className="text-[11px] text-(--muted)">
                        {m.referenceType ?? "—"}
                      </td>
                      <td className="text-(--muted)">{m.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <NextStep
          steps={[
            ...(avail > 0
              ? [
                  {
                    label: "Sell this lot",
                    href: "/sales",
                    hint: `${formatQty(avail)} ${lot.unit} available`,
                  },
                ]
              : []),
            {
              label: "Back to live stock",
              href: "/stock",
              hint: "Full inventory view",
            },
            ...(lot.millReturns.some((rf) => rf.status === "OPEN")
              ? [
                  {
                    label: "Send the open RF",
                    href: "/returns",
                    hint: "1-day mill SLA",
                  },
                ]
              : []),
          ]}
        />
      </Section>
    </div>
  );
}
