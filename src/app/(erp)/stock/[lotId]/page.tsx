import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatQty, availableQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { formatDec, rollsDetailText } from "@/server/domain/goods";
import {
  PageHeader,
  Panel,
  buttonGhostClass,
} from "@/components/ui";

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

  return (
    <div>
      <PageHeader
        title={lot.lotNumber}
        description={`${lot.fabricType.name} · ${lot.shade.colorFamily.name}/${lot.shade.name}`}
        actions={
          <Link href="/stock" className={buttonGhostClass}>
            Back to stock
          </Link>
        }
      />

      <div className="mb-1.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Spec
          </p>
          <p className="mt-0.5 text-[12px] font-semibold">
            W {formatDec(lot.width)} · GSM {formatDec(lot.gsm)}
          </p>
          <p className="text-[11px] text-(--muted)">Finish {finishName}</p>
        </Panel>
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Size
          </p>
          <p className="mt-0.5 text-[12px] font-semibold tabular-nums">
            {formatDec(lot.lengthM ?? lot.quantity)} m · {lot.rollCount} rolls
          </p>
          <p className="text-[11px] text-(--muted)">
            Wt {formatDec(lot.weightKg)} kg · grade {lot.qualityGrade}
          </p>
        </Panel>
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Mill / weaver
          </p>
          <p className="mt-0.5 text-[12px] font-semibold">{millName}</p>
          <p className="text-[11px] text-(--muted)">
            {weaverName}
            {lot.millMarka ? ` · marka ${lot.millMarka.code}` : ""}
          </p>
        </Panel>
        <Panel compact>
          <p className="text-[10px] font-semibold tracking-wide text-(--muted) uppercase">
            Live stock
          </p>
          <p className="mt-0.5 text-[12px] font-semibold tabular-nums">
            avail {formatQty(avail)}
          </p>
          <p className="text-[11px] text-(--muted)">
            on hand {formatQty(lot.onHand)} · res {formatQty(lot.reserved)}
          </p>
        </Panel>
      </div>

      <Panel title="Roll breakdown" className="mb-1.5" compact>
        {lot.salesReturnAsNew?.markaPhotoUrl ? (
          <p className="mb-1.5 text-[11px]">
            Verified marka: <strong>{lot.millMarka?.code ?? lot.marka}</strong>
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
            {rollsDetailText(lot as unknown as Parameters<typeof rollsDetailText>[0])} ·
            marka {lot.marka ?? "—"}
            {lot.rollNumber ? ` · roll ${lot.rollNumber}` : ""}
          </p>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Roll</th>
                <th>Length (m)</th>
                <th>Weight (kg)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {lot.rolls.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.rollNo}</td>
                  <td className="tabular-nums">{formatDec(r.lengthM)}</td>
                  <td className="tabular-nums">{formatDec(r.weightKg)}</td>
                  <td>{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {lot.millReturns.length > 0 ? (
        <Panel title="Mill RF" className="mb-1.5" compact>
          <table className="erp-table">
            <thead>
              <tr>
                <th>RF</th>
                <th>Mill</th>
                <th>Status</th>
                <th>Due</th>
                <th>WA</th>
              </tr>
            </thead>
            <tbody>
              {lot.millReturns.map((rf) => (
                <tr key={rf.id}>
                  <td className="font-semibold">{rf.rfNo}</td>
                  <td>{rf.mill.name}</td>
                  <td>
                    <span className={statusBadge(rf.status)}>{rf.status}</span>
                  </td>
                  <td className="tabular-nums text-[11px]">
                    {rf.dueAt.toLocaleString("en-IN")}
                    {rf.sentAt
                      ? ` · sent ${rf.sentAt.toLocaleString("en-IN")}`
                      : ""}
                  </td>
                  <td>{rf.whatsappSent ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      <div className="mb-1.5 grid gap-1.5 xl:grid-cols-2">
        <Panel title="Origin trail" compact>
          <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-[12px]">
            {lot.origin === "SALES_RETURN" ? (
              <>
                <dt className="text-(--muted)">Goods return</dt>
                <dd>
                  {lot.sourceSaleBill ? (
                    <Link
                      href={`/sales/${lot.sourceSaleBill.id}`}
                      className="font-medium hover:underline"
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
              {greyPo?.poNumber ?? "—"}
              {greySupplierName ? ` · ${greySupplierName}` : ""}
            </dd>
            <dt className="text-(--muted)">Program</dt>
            <dd>
              {lot.program
                ? `${lot.program.programNo} · mill ${lot.program.mill.name}${
                    lot.program.weaver
                      ? ` · weaver ${lot.program.weaver.name}`
                      : ""
                  }`
                : "—"}
            </dd>
            <dt className="text-(--muted)">QC</dt>
            <dd>
              {lot.qualityChecks.length === 0
                ? "Pending"
                : lot.qualityChecks
                    .map((q) => {
                      const result = q.passed ? "PASS" : "FAIL";
                      return `${result} ${q.defectType}${
                        q.severity ? ` ${q.severity}` : ""
                      } · ${q.inspector?.name ?? "—"}`;
                    })
                    .join(" · ")}
            </dd>
          </dl>
        </Panel>
        <Panel title="Sales & delivery" compact>
          {lot.billLines.length === 0 && lot.dispatchLines.length === 0 ? (
            <p className="text-[11px] text-(--muted)">Not billed yet.</p>
          ) : (
            <ul className="space-y-1 text-[12px]">
              {lot.billLines.map((line) => (
                <li key={line.id}>
                  <Link
                    href={`/sales/${line.bill.id}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {line.bill.billNo}
                  </Link>{" "}
                  <span className="text-(--muted)">
                    {line.bill.type} · {formatQty(line.quantity)}
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

      <Panel title="Stock movements" compact>
        <table className="erp-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Ref</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {lot.movements.map((m) => (
              <tr key={m.id}>
                <td>{m.createdAt.toLocaleString("en-IN")}</td>
                <td>
                  <span className={statusBadge(m.type)}>{m.type}</span>
                </td>
                <td className="tabular-nums">
                  {formatQty(m.quantity)} {lot.unit}
                </td>
                <td className="text-[11px] text-(--muted)">
                  {m.referenceType ?? "—"}
                </td>
                <td>{m.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
