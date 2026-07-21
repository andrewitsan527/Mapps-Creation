import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  returnLotToMill,
  submitGoodsReturnQc,
} from "@/server/actions/returns";
import { formatQty } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { lotGoodsInclude, lotLabel } from "@/server/domain/goods";
import {
  GoodsReturnIntakeForm,
  type GrBillOption,
  type GrMarkaOption,
} from "@/components/goods-return-intake";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

export default async function ReturnsPage() {
  const now = new Date();
  const [bills, millMarkas, pending, returnStock, openMillRfs, history] =
    await Promise.all([
      prisma.saleBill.findMany({
        where: { type: "SALE", status: "ISSUED" },
        select: {
          id: true,
          billNo: true,
          party: { select: { name: true } },
          lines: {
            select: {
              id: true,
              lotId: true,
              lotNumber: true,
              fabricName: true,
              colorFamily: true,
              shadeName: true,
              millName: true,
              weaverName: true,
              finishName: true,
              width: true,
              gsm: true,
              quantity: true,
              unit: true,
              lot: { select: { millId: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.millMarka.findMany({
        where: { active: true, mill: { active: true, type: "MILL" } },
        select: { id: true, millId: true, code: true, label: true },
        orderBy: [{ mill: { name: "asc" } }, { code: "asc" }],
      }),
      prisma.salesReturn.findMany({
        where: { status: "PENDING_QC" },
        include: {
          party: { select: { name: true } },
          saleBill: { select: { billNo: true } },
          millMarka: {
            select: { code: true, label: true, mill: { select: { name: true } } },
          },
          newLot: {
            include: {
              fabricType: { select: { name: true } },
              shade: {
                select: {
                  name: true,
                  colorFamily: { select: { name: true } },
                },
              },
              mill: { select: { name: true } },
              weaver: { select: { name: true } },
            },
          },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }),
      prisma.lot.findMany({
        where: {
          origin: "SALES_RETURN",
          active: true,
        },
        include: {
          ...lotGoodsInclude,
          salesReturnAsNew: { select: { markaPhotoUrl: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      prisma.millReturn.findMany({
        where: { status: "OPEN" },
        include: {
          lot: {
            select: {
              id: true,
              lotNumber: true,
              quantity: true,
              unit: true,
              origin: true,
              defectType: true,
            },
          },
          mill: { select: { name: true, whatsapp: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 40,
      }),
      prisma.salesReturn.findMany({
        include: {
          party: { select: { name: true } },
          saleBill: { select: { billNo: true } },
          newLot: { select: { lotNumber: true, qualityGrade: true } },
          millMarka: { select: { code: true, mill: { select: { name: true } } } },
          originalLot: { select: { lotNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

  const billOptions: GrBillOption[] = bills.map((b) => ({
    id: b.id,
    billNo: b.billNo,
    partyName: b.party.name,
    lines: b.lines.map((l) => ({
      id: l.id,
      lotNumber: l.lotNumber,
      fabricName: l.fabricName,
      colorFamily: l.colorFamily,
      shadeName: l.shadeName,
      millName: l.millName,
      millId: l.lot?.millId ?? null,
      weaverName: l.weaverName,
      finishName: l.finishName,
      width: l.width?.toString() ?? null,
      gsm: l.gsm?.toString() ?? null,
      quantity: l.quantity.toString(),
      unit: l.unit,
      lotId: l.lotId,
    })),
  }));
  const markaOptions: GrMarkaOption[] = millMarkas;

  return (
    <div>
      <PageHeader
        title="Goods return"
        description="Bill intake → GR QC (mill/weaver/dyeing/minor). Mill defect opens RF + WhatsApp mill (1-day send SLA). Weaver = dashboard HIGH."
      />

      <div className="grid gap-1.5 xl:grid-cols-[300px_1fr]">
        <Panel title="1. Intake (by sale bill)" compact>
          {billOptions.length === 0 ? (
            <EmptyState text="No sale bills yet." />
          ) : (
            <GoodsReturnIntakeForm bills={billOptions} markas={markaOptions} />
          )}
        </Panel>

        <Panel title={`2. GR QC pending (${pending.length})`} compact>
          {pending.length === 0 ? (
            <EmptyState text="No returns waiting for QC." />
          ) : (
            <div className="space-y-2">
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="rounded border border-(--line) p-2"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-semibold">{r.returnNo}</span>
                    <span className={statusBadge(r.priority)}>{r.priority}</span>
                    <span className="text-(--muted)">
                      {r.party.name}
                      {r.saleBill ? ` · ${r.saleBill.billNo}` : ""}
                    </span>
                    <span className="tabular-nums">
                      {formatQty(r.quantity)} m
                    </span>
                    <span className="font-medium">
                      Marka {r.millMarka?.code ?? "missing"}
                    </span>
                  </div>
                  {r.newLot ? (
                    <p className="mb-1.5 text-[11px] text-(--muted)">
                      {r.newLot.fabricType.name} ·{" "}
                      {r.newLot.shade.colorFamily.name}/{r.newLot.shade.name}
                      {r.newLot.mill ? ` · mill ${r.newLot.mill.name}` : ""}
                      {r.newLot.weaver
                        ? ` · weaver ${r.newLot.weaver.name}`
                        : ""}
                    </p>
                  ) : null}

                  <form action={submitGoodsReturnQc} className="space-y-1.5">
                    <input type="hidden" name="returnId" value={r.id} />
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                      <label className="flex items-center gap-1 text-[11px]">
                        <input
                          type="checkbox"
                          name="checklistWeaver"
                          value="true"
                        />
                        Weaver defect
                      </label>
                      <label className="flex items-center gap-1 text-[11px]">
                        <input
                          type="checkbox"
                          name="checklistMill"
                          value="true"
                        />
                        Mill defect
                      </label>
                      <label className="flex items-center gap-1 text-[11px]">
                        <input
                          type="checkbox"
                          name="checklistDying"
                          value="true"
                        />
                        Dyeing defect
                      </label>
                      <label className="flex items-center gap-1 text-[11px]">
                        <input
                          type="checkbox"
                          name="checklistMinor"
                          value="true"
                        />
                        Minor defect
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      <Field label="Priority">
                        <select
                          className={inputClass}
                          name="priority"
                          defaultValue={r.priority}
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                      </Field>
                      <Field label="Grade">
                        <select
                          className={inputClass}
                          name="grade"
                          defaultValue="B"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </Field>
                      <Field label="Decision">
                        <select
                          className={inputClass}
                          name="accept"
                          defaultValue="true"
                        >
                          <option value="true">Accept → return stock</option>
                          <option value="false">Reject — no stock</option>
                        </select>
                      </Field>
                      <Field label="Remarks">
                        <input
                          className={inputClass}
                          name="remarks"
                          defaultValue={r.reason ?? ""}
                          placeholder="Defect detail"
                          required
                        />
                      </Field>
                    </div>
                    <Field label="Marka photo (required)">
                      <input
                        className={inputClass}
                        name="markaPhoto"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        required
                      />
                    </Field>
                    <p className="text-[10px] text-(--muted)">
                      Photo must clearly show marka {r.millMarka?.code ?? "—"}{" "}
                      from {r.millMarka?.mill.name ?? "the connected mill"}. Mill
                      defect skips return stock and opens mill RF immediately.
                      Weaver defect is HIGH on the dashboard.
                    </p>
                    <button className={buttonClass} type="submit">
                      Save GR QC report
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-1.5 grid gap-1.5 xl:grid-cols-2">
        <Panel title="Return inventory (MCSR — resale)" compact>
          {returnStock.length === 0 ? (
            <EmptyState text="No return stock yet. Accept a GR QC to stock here." />
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Goods</th>
                  <th>Grade</th>
                  <th>Pri</th>
                  <th>Avail</th>
                  <th>Proof</th>
                </tr>
              </thead>
              <tbody>
                {returnStock.map((lot) => {
                  const avail =
                    Number(lot.onHand) - Number(lot.reserved);
                  return (
                    <tr key={lot.id}>
                      <td>
                        <Link
                          href={`/stock/${lot.id}`}
                          className="font-semibold underline-offset-2 hover:underline"
                        >
                          {lot.lotNumber}
                        </Link>
                      </td>
                      <td className="max-w-56 truncate text-[11px]">
                        {lotLabel(lot)}
                      </td>
                      <td>{lot.qualityGrade}</td>
                      <td>
                        {lot.returnPriority ? (
                          <span className={statusBadge(lot.returnPriority)}>
                            {lot.returnPriority}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="tabular-nums font-semibold text-(--accent-strong)">
                        {formatQty(avail)}
                      </td>
                      <td>
                        {lot.salesReturnAsNew?.markaPhotoUrl ? (
                          <a
                            href={lot.salesReturnAsNew.markaPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-(--accent) hover:underline"
                          >
                            Photo
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-1.5 text-[10px] text-(--muted)">
            These lots appear in Sales with a GR tag — sell to clients who take
            return / lower grade goods.
          </p>
        </Panel>

        <Panel title="Mill RF — send within 1 day" compact>
          {openMillRfs.length === 0 ? (
            <EmptyState text="No open mill RFs. Defect QC auto-creates MCRF + WhatsApp." />
          ) : (
            <div className="space-y-1.5">
              {openMillRfs.map((rf) => {
                const overdue = rf.dueAt < now;
                return (
                  <form
                    key={rf.id}
                    action={returnLotToMill}
                    className="flex flex-wrap items-end gap-1.5 rounded border border-(--line) p-1.5"
                  >
                    <input type="hidden" name="lotId" value={rf.lotId} />
                    <div className="min-w-40 flex-1 text-[12px]">
                      <p className="font-semibold">
                        {rf.rfNo} · {rf.lot.lotNumber}
                      </p>
                      <p className="text-[11px] text-(--muted)">
                        {rf.mill.name}
                        {rf.mill.whatsapp ? ` · WA ${rf.mill.whatsapp}` : ""} ·{" "}
                        {formatQty(rf.lot.quantity)} {rf.lot.unit} ·{" "}
                        {rf.lot.origin === "SALES_RETURN" ? "GR" : "Program"} ·{" "}
                        {rf.lot.defectType}
                      </p>
                      <p
                        className={
                          overdue
                            ? "text-[11px] font-semibold text-red-700"
                            : "text-[11px] text-(--muted)"
                        }
                      >
                        Due{" "}
                        {rf.dueAt.toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {overdue ? " · overdue" : ""}
                        {rf.whatsappSent ? " · WA sent" : " · WA pending"}
                      </p>
                    </div>
                    <input
                      className={`${inputClass} max-w-40`}
                      name="remarks"
                      placeholder="Send notes"
                    />
                    <button className={buttonClass} type="submit">
                      Mark sent + WA mill
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Return history" className="mt-1.5" compact>
        {history.length === 0 ? (
          <EmptyState text="No goods returns yet." />
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>MCSR</th>
                <th>Bill</th>
                <th>Party</th>
                <th>Qty</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Grade</th>
                <th>Marka</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">
                    {r.newLot ? (
                      <Link
                        href={`/stock/${r.newLotId}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {r.returnNo}
                      </Link>
                    ) : (
                      r.returnNo
                    )}
                  </td>
                  <td>{r.saleBill?.billNo ?? "—"}</td>
                  <td>{r.party.name}</td>
                  <td className="tabular-nums">{formatQty(r.quantity)}</td>
                  <td>
                    <span className={statusBadge(r.priority)}>{r.priority}</span>
                  </td>
                  <td>
                    <span className={statusBadge(r.status)}>{r.status}</span>
                  </td>
                  <td>{r.qualityGrade ?? "—"}</td>
                  <td>
                    {r.millMarka
                      ? `${r.millMarka.code} · ${r.millMarka.mill.name}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
