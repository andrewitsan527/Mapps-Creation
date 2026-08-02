import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  returnLotToMill,
  submitGoodsReturnQc,
} from "@/server/actions/returns";
import { formatDateTime, formatQty, relativeDays } from "@/lib/utils";
import { statusBadge } from "@/lib/format";
import { lotGoodsInclude, lotLabel } from "@/server/domain/goods";
import {
  GoodsReturnIntakeForm,
  type GrBillOption,
  type GrMarkaOption,
} from "@/components/goods-return-intake";
import { DefectChecklist } from "@/components/defect-checklist";
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
  buttonWaClass,
  inputClass,
} from "@/components/ui";
import {
  Boxes,
  ClipboardCheck,
  Inbox,
  MessageCircle,
  RotateCcw,
} from "lucide-react";

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

  const rfOverdue = openMillRfs.filter((rf) => rf.dueAt < now).length;
  const resaleQty = returnStock.reduce(
    (sum, lot) => sum + (Number(lot.onHand) - Number(lot.reserved)),
    0,
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="Goods return"
        eyebrow="Inventory"
        icon={RotateCcw}
        description="Take the goods back against the original bill, inspect them, then route the outcome: resale stock (MCSR), or straight back to the mill on an RF within one day."
        actions={
          <Link href="/qc" className={buttonTinyClass}>
            <ClipboardCheck className="h-3 w-3" />
            Program QC
          </Link>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
        <Metric
          label="Pending GR QC"
          value={pending.length}
          tone={pending.length ? "warn" : "neutral"}
          hint="Awaiting inspection"
        />
        <Metric
          label="Resale lots"
          value={returnStock.length}
          hint={`${formatQty(resaleQty)} m available`}
        />
        <Metric
          label="Open mill RF"
          value={openMillRfs.length}
          tone={rfOverdue ? "danger" : "neutral"}
          hint={rfOverdue ? `${rfOverdue} past SLA` : "1-day SLA"}
        />
        <Metric label="Returns logged" value={history.length} hint="Recent" />
      </MetricStrip>

      <Section
        title="Return intake & inspection"
        icon={Inbox}
        tone="accent"
        description="Every return starts from a sale bill line"
      >
        <div className="grid gap-1.5 xl:grid-cols-[320px_1fr]">
          <Panel
            title="Intake by sale bill"
            subtitle="Step 1"
            icon={Inbox}
            tone="info"
            compact
          >
            {billOptions.length === 0 ? (
              <EmptyState
                icon={Inbox}
                text="No sale bills yet — a return must reference the bill it went out on."
                action={
                  <Link href="/sales" className={buttonTinyClass}>
                    Go to sales
                  </Link>
                }
              />
            ) : (
              <GoodsReturnIntakeForm bills={billOptions} markas={markaOptions} />
            )}
          </Panel>

          <Panel
            title="GR QC pending"
            subtitle="Step 2"
            icon={ClipboardCheck}
            tone="warn"
            compact
            action={<span className="badge badge-muted">{pending.length}</span>}
          >
            {pending.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                text="No returns waiting for QC. Intake a return to inspect it here."
              />
            ) : (
              <div className="space-y-2">
                {pending.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-md border border-(--line) bg-(--panel-alt) p-2"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                      <span className="font-semibold">{r.returnNo}</span>
                      <span className={statusBadge(r.priority)}>
                        {r.priority}
                      </span>
                      <span className="text-(--muted)">
                        {r.party.name}
                        {r.saleBill ? ` · ${r.saleBill.billNo}` : ""}
                      </span>
                      <span className="tabular-nums">
                        {formatQty(r.quantity)} m
                      </span>
                      <span className="badge badge-info">
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

                    <form action={submitGoodsReturnQc} className="space-y-2">
                      <input type="hidden" name="returnId" value={r.id} />

                      <DefectChecklist columns={4} />

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

                      <Field
                        label="Marka photo (required)"
                        hint={`Must clearly show marka ${
                          r.millMarka?.code ?? "—"
                        } from ${r.millMarka?.mill.name ?? "the connected mill"}.`}
                      >
                        <input
                          className={inputClass}
                          name="markaPhoto"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          required
                        />
                      </Field>

                      <p className="rounded-md border border-(--line) bg-white px-2 py-1.5 text-[10.5px] leading-snug text-(--muted)">
                        Mill defect skips resale stock and opens a mill RF
                        immediately. Weaver defect is flagged HIGH on the control
                        tower.
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
      </Section>

      <Section
        title="Where returns end up"
        icon={Boxes}
        description="Resale inventory, or back to the mill"
      >
        <div className="grid gap-1.5 xl:grid-cols-2">
          <Panel
            title="Return inventory (MCSR — resale)"
            icon={Boxes}
            tone="accent"
            subtitle="Sells with a GR tag"
            flush
            action={
              <Link href="/sales" className={buttonTinyClass}>
                Sell these
              </Link>
            }
          >
            {returnStock.length === 0 ? (
              <div className="p-2.5">
                <EmptyState text="No return stock yet. Accept a GR QC to stock here." />
              </div>
            ) : (
              <TableWrap maxHeight={300}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Goods</th>
                      <th>Grade</th>
                      <th>Pri</th>
                      <th className="num">Avail</th>
                      <th>Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnStock.map((lot) => {
                      const avail = Number(lot.onHand) - Number(lot.reserved);
                      return (
                        <tr key={lot.id}>
                          <td>
                            <Link
                              href={`/stock/${lot.id}`}
                              className="font-semibold text-(--accent) hover:underline"
                            >
                              {lot.lotNumber}
                            </Link>
                          </td>
                          <td className="max-w-56 truncate text-[11px] text-(--muted)">
                            {lotLabel(lot)}
                          </td>
                          <td>{lot.qualityGrade}</td>
                          <td>
                            {lot.returnPriority ? (
                              <span
                                className={statusBadge(lot.returnPriority)}
                              >
                                {lot.returnPriority}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="num font-semibold text-(--accent-strong)">
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
              </TableWrap>
            )}
          </Panel>

          <Panel
            title="Mill RF — send within 1 day"
            icon={RotateCcw}
            tone="warn"
            subtitle={
              rfOverdue ? `${rfOverdue} overdue` : `${openMillRfs.length} open`
            }
            compact
          >
            {openMillRfs.length === 0 ? (
              <EmptyState text="No open mill RFs. Defect QC auto-creates MCRF and WhatsApps the mill." />
            ) : (
              <div className="space-y-1.5">
                {openMillRfs.map((rf) => {
                  const overdue = rf.dueAt < now;
                  return (
                    <form
                      key={rf.id}
                      action={returnLotToMill}
                      className={`flex flex-wrap items-end gap-1.5 rounded-md border p-1.5 ${
                        overdue
                          ? "border-(--danger)/40 bg-(--danger-soft)"
                          : "border-(--line) bg-(--panel-alt)"
                      }`}
                    >
                      <input type="hidden" name="lotId" value={rf.lotId} />
                      <div className="min-w-40 flex-1 text-[12px]">
                        <p className="font-semibold">
                          {rf.rfNo} ·{" "}
                          <Link
                            href={`/stock/${rf.lot.id}`}
                            className="text-(--accent) hover:underline"
                          >
                            {rf.lot.lotNumber}
                          </Link>
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
                              ? "text-[11px] font-semibold text-(--danger)"
                              : "text-[11px] text-(--muted)"
                          }
                        >
                          Due {formatDateTime(rf.dueAt)} ·{" "}
                          {relativeDays(rf.dueAt, now)} ·{" "}
                          {rf.whatsappSent ? "WA sent" : "WA pending"}
                        </p>
                      </div>
                      <input
                        className={`${inputClass} max-w-40`}
                        name="remarks"
                        placeholder="Send notes"
                      />
                      <button className={buttonWaClass} type="submit">
                        <MessageCircle className="h-3 w-3" />
                        Mark sent + WA mill
                      </button>
                    </form>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Section>

      <Section title="Return history" icon={RotateCcw}>
        <Panel flush>
          {history.length === 0 ? (
            <div className="p-2.5">
              <EmptyState text="No goods returns yet." />
            </div>
          ) : (
            <TableWrap maxHeight={320}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>MCSR</th>
                    <th>Bill</th>
                    <th>Party</th>
                    <th className="num">Qty</th>
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
                            className="text-(--accent) hover:underline"
                          >
                            {r.returnNo}
                          </Link>
                        ) : (
                          r.returnNo
                        )}
                      </td>
                      <td>{r.saleBill?.billNo ?? "—"}</td>
                      <td className="text-(--muted)">{r.party.name}</td>
                      <td className="num">{formatQty(r.quantity)}</td>
                      <td>
                        <span className={statusBadge(r.priority)}>
                          {r.priority}
                        </span>
                      </td>
                      <td>
                        <span className={statusBadge(r.status)}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.qualityGrade ?? "—"}</td>
                      <td className="text-[11px] text-(--muted)">
                        {r.millMarka
                          ? `${r.millMarka.code} · ${r.millMarka.mill.name}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>

        <NextStep
          steps={[
            {
              label: "Sell resale stock",
              href: "/sales",
              hint: "MCSR lots carry a GR tag",
              count: returnStock.length || undefined,
            },
            {
              label: "Issue a credit note",
              href: "/finance",
              hint: "Adjust the client's bill",
            },
          ]}
        />
      </Section>
    </div>
  );
}
