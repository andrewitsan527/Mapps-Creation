import Link from "next/link";
import { prisma } from "@/lib/db";
import { createProgram, sendProgramWhatsApp } from "@/server/actions/programs";
import { listPartyOptions, type PartyOption } from "@/lib/parties";
import { statusBadge } from "@/lib/format";
import { formatDate } from "@/lib/utils";
import { PartySelect } from "@/components/party-select";
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
type GreyOption = { id: string; poNumber: string };
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
  const [mills, weavers, fabrics, shades, finishes, greys, programs] =
    (await Promise.all([
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
        select: { id: true, poNumber: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
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
          greyOrder: { select: { poNumber: true } },
          lots: { select: { id: true, lotNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
    ])) as [
      PartyOption[],
      PartyOption[],
      IdName[],
      ShadeOption[],
      IdName[],
      GreyOption[],
      ProgramRow[],
    ];

  const grouped = stageGroups.map((group) => ({
    ...group,
    rows: programs.filter(group.match),
  }));
  const counts = Object.fromEntries(
    grouped.map((g) => [g.id, g.rows.length]),
  ) as Record<string, number>;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Mill programs"
        eyebrow="Produce"
        icon={ScrollText}
        description="One card per mill instruction. Send it on WhatsApp, track it at the mill, then hand it to QC when the fabric returns."
        actions={
          <Link href="/qc" className={buttonTinyClass}>
            <ClipboardCheck className="h-3 w-3" />
            QC desk
          </Link>
        }
      />

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
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
                <Field label="Mill">
                  <PartySelect name="millId" options={mills} required />
                </Field>
                <Field label="Weaver (optional)">
                  <PartySelect
                    name="weaverId"
                    options={weavers}
                    placeholder="—"
                  />
                </Field>
                <Field label="Grey PO (optional)" hint="Links program to procurement">
                  <select className={inputClass} name="greyOrderId">
                    <option value="">—</option>
                    {greys.map((g: GreyOption) => (
                      <option key={g.id} value={g.id}>
                        {g.poNumber}
                      </option>
                    ))}
                  </select>
                </Field>
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
                <Field label="Remarks">
                  <textarea className={inputClass} name="remarks" rows={2} />
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

          <NextStep
            steps={[
              {
                label: "Log mill return & run QC",
                href: "/qc",
                hint: "Create the lot, inspect it",
                count: counts["at-mill"] || undefined,
              },
              {
                label: "Check live stock",
                href: "/stock",
                hint: "What cleared QC is sellable",
              },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
