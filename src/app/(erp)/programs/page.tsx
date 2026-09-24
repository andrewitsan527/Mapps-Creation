import Link from "next/link";
import { prisma } from "@/lib/db";
import { createProgram, sendProgramWhatsApp } from "@/server/actions/programs";
import { MillInwardForm } from "@/components/mill-inward-form";
import { MillReturnCompleteForm } from "@/components/mill-return-complete-form";
import { programQtySummary } from "@/server/domain/mill-inward";
import { listMillWeaverLinks, listPartyOptions } from "@/lib/parties";
import { statusBadge } from "@/lib/format";
import { formatDate, formatQty } from "@/lib/utils";
import { ProgramGreyWeaverFields } from "@/components/program-grey-weaver-fields";
import {
  EmptyState,
  Field,
  FieldGroup,
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
  ClipboardCheck,
  Eye,
  Inbox,
  MessageCircle,
  PlusCircle,
  ScrollText,
} from "lucide-react";

type IdName = { id: string; name: string };
type ShadeOption = {
  id: string;
  name: string;
  code: string;
  hex: string | null;
  colorFamily: { name: string };
};
type GreyOption = {
  id: string;
  poNumber: string;
  weaverId: string;
  weaverName: string;
  millId: string | null;
  millName: string | null;
  quantity: string | null;
  unit: string;
  dyeingRate: string | null;
  fabricNotes: string | null;
};
type ProgramRow = {
  id: string;
  programNo: string;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
  gsm: { toString(): string } | null;
  width: { toString(): string } | null;
  mill: IdName;
  weaver: IdName | null;
  fabricType: IdName;
  shade: ShadeOption;
  finishType: IdName | null;
  greyOrder: { poNumber: string } | null;
  lots: { id: string; lotNumber: string }[];
  qty: { unit: string; planned: number | null; received: number; remaining: number | null };
  returnCompletedAt: Date | null;
  shortageQty: number | null;
  inwards: { id: string; inwardNo: string; quantity: string; unit: string; inwardDate: Date }[];
};

const stageGroups = [
  {
    id: "draft",
    title: "Draft — not sent to mill",
    tone: "warn" as const,
    hint: "WhatsApp the card to start the clock",
    match: (p: ProgramRow) => p.status === "DRAFT",
  },
  {
    id: "at-mill",
    title: "At mill — awaiting goods",
    tone: "info" as const,
    hint: "Log the mill return on the QC desk when fabric lands",
    match: (p: ProgramRow) =>
      (p.status === "SENT_TO_MILL" || p.status === "IN_PROCESS") &&
      p.lots.length === 0,
  },
  {
    id: "returned",
    title: "Returned — pending QC",
    tone: "danger" as const,
    hint: "Lot created, quality not cleared yet",
    match: (p: ProgramRow) =>
      p.status === "RETURNED" ||
      ((p.status === "SENT_TO_MILL" || p.status === "IN_PROCESS") &&
        p.lots.length > 0),
  },
  {
    id: "closed",
    title: "Closed",
    tone: "accent" as const,
    hint: "QC passed and stock taken in",
    match: (p: ProgramRow) => p.status === "CLOSED" || p.status === "CANCELLED",
  },
];

export default async function ProgramsPage() {
  const [mills, weavers, fabrics, shades, finishes, greyRows, millWeaverLinks, programs] =
    await Promise.all([
      listPartyOptions("MILL"),
      listPartyOptions("WEAVER"),
      prisma.fabricType.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.shade.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          code: true,
          hex: true,
          colorFamily: { select: { name: true } },
        },
        orderBy: [{ colorFamily: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.finishType.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.greyPurchaseOrder.findMany({
        where: { status: "OPEN" },
        select: {
          id: true,
          poNumber: true,
          quantity: true,
          unit: true,
          dyeingRate: true,
          fabricNotes: true,
          supplier: { select: { id: true, name: true } },
          mill: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      listMillWeaverLinks(),
      prisma.millProgram.findMany({
        select: {
          id: true,
          programNo: true,
          status: true,
          sentAt: true,
          createdAt: true,
          gsm: true,
          width: true,
          mill: { select: { id: true, name: true } },
          weaver: { select: { id: true, name: true } },
          fabricType: { select: { id: true, name: true } },
          shade: {
            select: {
              id: true,
              name: true,
              code: true,
              hex: true,
              colorFamily: { select: { name: true } },
            },
          },
          finishType: { select: { id: true, name: true } },
          greyOrder: { select: { poNumber: true, quantity: true, unit: true } },
          returnCompletedAt: true,
          shortageQty: true,
          lots: { select: { id: true, lotNumber: true } },
          inwards: {
            select: {
              id: true,
              inwardNo: true,
              quantity: true,
              unit: true,
              inwardDate: true,
            },
            orderBy: { inwardDate: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
    ]);

  const programRows: ProgramRow[] = programs.map((p) => {
    const qty = programQtySummary(p);
    return {
      ...p,
      greyOrder: p.greyOrder ? { poNumber: p.greyOrder.poNumber } : null,
      qty,
      shortageQty:
        p.shortageQty != null ? Number(p.shortageQty.toString()) : null,
      inwards: p.inwards.map((row) => ({
        id: row.id,
        inwardNo: row.inwardNo,
        quantity: row.quantity.toString(),
        unit: row.unit,
        inwardDate: row.inwardDate,
      })),
    };
  });

  const inwardable = programRows
    .filter(
      (p) =>
        p.status !== "DRAFT" &&
        p.status !== "CLOSED" &&
        p.status !== "CANCELLED" &&
        (p.qty.remaining == null || p.qty.remaining > 0),
    )
    .map((p) => ({
      id: p.id,
      programNo: p.programNo,
      millName: p.mill.name,
      unit: p.qty.unit,
      remaining: p.qty.remaining,
    }));

  const greys: GreyOption[] = greyRows.map((g) => ({
    id: g.id,
    poNumber: g.poNumber,
    weaverId: g.supplier.id,
    weaverName: g.supplier.name,
    millId: g.mill?.id ?? null,
    millName: g.mill?.name ?? null,
    quantity: g.quantity != null ? g.quantity.toString() : null,
    unit: g.unit,
    dyeingRate: g.dyeingRate != null ? g.dyeingRate.toString() : null,
    fabricNotes: g.fabricNotes,
  }));

  const grouped = stageGroups.map((group) => ({
    ...group,
    rows: programRows.filter(group.match),
  }));
  const counts = Object.fromEntries(
    grouped.map((g) => [g.id, g.rows.length]),
  ) as Record<string, number>;

  return (
    <div className="tx-page tx-page-programs">
      <div className="tx-stage space-y-3">
      <div className="tx-chrome">
      <PageHeader
        title="Mill programs"
        eyebrow="Produce"
        icon={ScrollText}
        description="One card per mill instruction. Send it on WhatsApp, record mill inwards as goods return, then hand each inward to QC."
        actions={
          <Link href="/qc" className={buttonTinyClass}>
            <ClipboardCheck className="h-3 w-3" />
            QC desk
          </Link>
        }
      />
      </div>

      <MetricStrip className="tx-metrics divide-x-0 grid-cols-2 sm:grid-cols-4">
        <Metric
          label="Draft"
          value={counts.draft ?? 0}
          tone={counts.draft ? "warn" : "neutral"}
          hint="Not sent yet"
        />
        <Metric
          label="At mill"
          value={counts["at-mill"] ?? 0}
          tone="info"
          hint="Awaiting goods"
        />
        <Metric
          label="Pending QC"
          value={counts.returned ?? 0}
          tone={counts.returned ? "danger" : "neutral"}
          hint="Lot in, not cleared"
        />
        <Metric label="Closed" value={counts.closed ?? 0} tone="accent" />
      </MetricStrip>

      <div className="grid gap-3 xl:grid-cols-[320px_1fr]">
        <Section title="New program card" step={1} icon={PlusCircle} tone="accent">
          <Panel compact>
            <form action={createProgram} className="space-y-2.5">
              <FieldGroup label="Who makes it">
                <ProgramGreyWeaverFields
                  greys={greys}
                  mills={mills}
                  weavers={weavers}
                  millWeaverLinks={millWeaverLinks}
                />
              </FieldGroup>

              <FieldGroup label="What to make">
                <Field label="Fabric type">
                  <select className={inputClass} name="fabricTypeId" required>
                    <option value="">Select…</option>
                    {fabrics.map((f: IdName) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Shade / color scheme">
                  <select className={inputClass} name="shadeId" required>
                    <option value="">Select shade…</option>
                    {shades.map((s: ShadeOption) => (
                      <option key={s.id} value={s.id}>
                        {s.colorFamily.name} · {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Finish">
                  <select className={inputClass} name="finishTypeId">
                    <option value="">—</option>
                    {finishes.map((f: IdName) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </FieldGroup>

              <FieldGroup label="Specification">
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label="Width">
                    <input
                      className={inputClass}
                      name="width"
                      type="number"
                      step="any"
                    />
                  </Field>
                  <Field label="GSM">
                    <input
                      className={inputClass}
                      name="gsm"
                      type="number"
                      step="any"
                    />
                  </Field>
                </div>
                <Field label="Feel / fall">
                  <input className={inputClass} name="feelFallNotes" />
                </Field>
                <Field label="Extra mods">
                  <input className={inputClass} name="extraMods" />
                </Field>
              </FieldGroup>

              <button className={buttonClass + " w-full"} type="submit">
                Save program card
              </button>
            </form>
          </Panel>
        </Section>

        <Section
          title="Program pipeline"
          step={2}
          icon={ScrollText}
          description="Grouped by where each card actually is"
        >
          {programs.length === 0 ? (
            <Panel compact>
              <EmptyState
                icon={ScrollText}
                text="No programs yet. Add shades under Masters → Colors if the shade list is empty."
              />
            </Panel>
          ) : (
            <div className="space-y-1.5">
              {grouped
                .filter((group) => group.rows.length > 0)
                .map((group) => (
                  <Panel
                    key={group.id}
                    title={group.title}
                    subtitle={group.hint}
                    tone={group.tone}
                    icon={ScrollText}
                    flush
                    action={
                      <span className="badge badge-muted">
                        {group.rows.length}
                      </span>
                    }
                  >
                    <TableWrap maxHeight={340}>
                      <table className="erp-table">
                        <thead>
                          <tr>
                            <th>Program</th>
                            <th>Shade</th>
                            <th>Spec</th>
                            <th>Mill / weaver</th>
                            <th>Inward</th>
                            <th>Lot</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <p className="font-semibold">{p.programNo}</p>
                                <p className="text-[10.5px] text-(--muted)">
                                  {p.fabricType.name}
                                  {p.greyOrder
                                    ? ` · ${p.greyOrder.poNumber}`
                                    : ""}
                                </p>
                                <p className="text-[10px] text-(--faint)">
                                  {p.sentAt
                                    ? `sent ${formatDate(p.sentAt)}`
                                    : formatDate(p.createdAt)}
                                </p>
                              </td>
                              <td>
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-(--line)"
                                    style={{ background: p.shade.hex || "#999" }}
                                  />
                                  <span className="truncate">
                                    {p.shade.colorFamily.name}/{p.shade.name}
                                  </span>
                                </span>
                              </td>
                              <td className="text-[11px] text-(--muted)">
                                {p.gsm ? `${p.gsm} GSM` : "—"} ·{" "}
                                {p.width ? `${p.width}"` : "—"}
                                {p.finishType ? (
                                  <div>{p.finishType.name}</div>
                                ) : null}
                              </td>
                              <td>
                                {p.mill.name}
                                {p.weaver ? (
                                  <div className="text-[10.5px] text-(--muted)">
                                    {p.weaver.name}
                                  </div>
                                ) : null}
                              </td>
                              <td className="text-[11px] tabular-nums text-(--muted)">
                                {p.qty.planned != null ? (
                                  <>
                                    {formatQty(p.qty.planned)} {p.qty.unit} planned
                                    <div>
                                      {formatQty(p.qty.received)} recv
                                      {p.status === "CLOSED"
                                        ? ` · ${formatQty(
                                            p.shortageQty ??
                                              Math.max(
                                                0,
                                                p.qty.planned - p.qty.received,
                                              ),
                                          )} difference`
                                        : ` · ${formatQty(p.qty.remaining ?? 0)} left`}
                                    </div>
                                  </>
                                ) : p.qty.received > 0 ? (
                                  <>
                                    {formatQty(p.qty.received)} {p.qty.unit} recv
                                  </>
                                ) : (
                                  "—"
                                )}
                                {p.inwards.length > 0 ? (
                                  <ul className="mt-0.5 text-[10px] text-(--faint)">
                                    {p.inwards.map((row) => (
                                      <li key={row.id}>
                                        {row.inwardNo} · {formatQty(row.quantity)}{" "}
                                        {row.unit}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </td>
                              <td>
                                {p.lots.length > 0 ? (
                                  <Link
                                    href={`/stock/${p.lots[0].id}`}
                                    className="font-medium text-(--accent) hover:underline"
                                  >
                                    {p.lots[0].lotNumber}
                                  </Link>
                                ) : (
                                  <span className={statusBadge(p.status)}>
                                    {p.status}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  <Link
                                    href={`/programs/${p.id}/card`}
                                    className={buttonTinyClass}
                                    title="Preview / print / PDF"
                                  >
                                    <Eye className="h-3 w-3" />
                                    Card
                                  </Link>
                                  {p.status === "DRAFT" ||
                                  p.status === "SENT_TO_MILL" ? (
                                    <form action={sendProgramWhatsApp}>
                                      <input
                                        type="hidden"
                                        name="id"
                                        value={p.id}
                                      />
                                      <button
                                        className={buttonWaClass}
                                        type="submit"
                                      >
                                        <MessageCircle className="h-3 w-3" />
                                        {p.sentAt ? "Resend" : "WhatsApp"}
                                      </button>
                                    </form>
                                  ) : (
                                    <Link
                                      href="/qc"
                                      className={buttonTinyClass}
                                    >
                                      QC
                                    </Link>
                                  )}
                                  {p.qty.planned != null &&
                                  p.qty.remaining != null &&
                                  p.qty.remaining > 0 &&
                                  p.status !== "DRAFT" &&
                                  p.status !== "CLOSED" &&
                                  p.status !== "CANCELLED" ? (
                                    <MillReturnCompleteForm
                                      programId={p.id}
                                      programNo={p.programNo}
                                      planned={p.qty.planned}
                                      received={p.qty.received}
                                      remaining={p.qty.remaining}
                                      unit={p.qty.unit}
                                    />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableWrap>
                  </Panel>
                ))}
            </div>
          )}

          {inwardable.length > 0 ? (
            <Section
              title="Mill inward"
              step={3}
              icon={Inbox}
              description="Record each physical return. Remaining is not treated as shortage."
            >
              <Panel compact>
                <MillInwardForm programs={inwardable} />
              </Panel>
            </Section>
          ) : null}

          <div className="tx-next">
          <NextStep
            steps={[
              {
                label: "Record mill inward & run QC",
                href: "/qc",
                hint: "Inward, then QC; lot is created on PASS",
                count: inwardable.length || undefined,
              },
              {
                label: "Check live stock",
                href: "/stock",
                hint: "What cleared QC is sellable",
              },
            ]}
          />
          </div>
        </Section>
      </div>
      </div>
    </div>
  );
}
