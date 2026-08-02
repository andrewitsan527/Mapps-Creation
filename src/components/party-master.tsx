import Link from "next/link";
import type { PartyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createPartyMaster,
  setPartyActive,
} from "@/server/actions/parties";
import {
  PARTY_TYPE_LABELS,
  masterHref,
  type MasterPartyType,
} from "@/lib/parties";
import {
  EmptyState,
  Field,
  FieldGroup,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  Section,
  TableWrap,
  buttonClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import {
  Briefcase,
  Building2,
  PackageOpen,
  Scissors,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

const TAB_META: {
  type: MasterPartyType;
  label: string;
  addLabel: string;
  blurb: string;
  icon: LucideIcon;
}[] = [
  {
    type: "CLIENT",
    label: "Clients",
    addLabel: "Add client",
    blurb:
      "Buying parties. Their payment terms and interest rate drive every receivable.",
    icon: Users,
  },
  {
    type: "MILL",
    label: "Mills",
    addLabel: "Add mill",
    blurb:
      "Processing mills used on program cards and mill RF. WhatsApp is required to send programs.",
    icon: Building2,
  },
  {
    type: "WEAVER",
    label: "Weavers",
    addLabel: "Add weaver",
    blurb: "Weavers linked to grey, programs and QC escalations.",
    icon: Scissors,
  },
  {
    type: "AGENT",
    label: "Agents",
    addLabel: "Add agent",
    blurb: "Commission agents, linked to the parties, mills and weavers they cover.",
    icon: Briefcase,
  },
  {
    type: "GREY_SUPPLIER",
    label: "Suppliers",
    addLabel: "Add supplier",
    blurb: "Grey fabric suppliers for purchase orders.",
    icon: PackageOpen,
  },
];

export async function PartyMasterScreen({ type }: { type: MasterPartyType }) {
  const meta = TAB_META.find((t) => t.type === type) ?? TAB_META[0];

  const [rows, linkable] = await Promise.all([
    prisma.party.findMany({
      where: { type },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        agentLinks: {
          include: {
            relatedParty: {
              select: { id: true, name: true, type: true },
            },
          },
          orderBy: { relatedParty: { name: "asc" } },
        },
        linkedFromAgents: {
          include: {
            agent: { select: { id: true, name: true } },
          },
        },
      },
    }),
    type === "AGENT"
      ? prisma.party.findMany({
          where: {
            active: true,
            type: { in: ["CLIENT", "MILL", "WEAVER", "GREY_SUPPLIER"] },
          },
          select: { id: true, name: true, type: true },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        })
      : Promise.resolve(
          [] as { id: string; name: string; type: PartyType }[],
        ),
  ]);

  const active = rows.filter((p) => p.active).length;
  const withWhatsapp = rows.filter((p) => p.whatsapp).length;
  const avgTerms = rows.length
    ? Math.round(
        rows.reduce((sum, p) => sum + p.paymentTermsDays, 0) / rows.length,
      )
    : 0;

  return (
    <div className="space-y-3">
      <PageHeader
        title={meta.label}
        eyebrow="Masters"
        icon={meta.icon}
        description={meta.blurb}
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-(--line) bg-(--panel) p-1">
        {TAB_META.map((t) => {
          const Icon = t.icon;
          const current = t.type === type;
          return (
            <Link
              key={t.type}
              href={masterHref(t.type)}
              className={
                current
                  ? "flex items-center gap-1.5 rounded-md bg-(--accent) px-2.5 py-1 text-[11.5px] font-semibold text-white"
                  : "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium text-(--muted) transition hover:bg-(--panel-sunken) hover:text-(--ink)"
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>

      <MetricStrip className="grid-cols-2 sm:grid-cols-4">
        <Metric label="Total" value={rows.length} />
        <Metric label="Active" value={active} tone="accent" />
        <Metric
          label="On WhatsApp"
          value={withWhatsapp}
          tone={withWhatsapp < rows.length ? "warn" : "wa"}
          hint={
            withWhatsapp < rows.length
              ? `${rows.length - withWhatsapp} missing`
              : "all reachable"
          }
        />
        <Metric label="Avg terms" value={`${avgTerms}d`} />
      </MetricStrip>

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <Section title={meta.addLabel} icon={UserPlus} tone="accent">
          <Panel compact>
            <form action={createPartyMaster} className="space-y-2.5">
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="active" value="true" />
              <PartyFields defaultType={type} lockedType />
              {type === "AGENT" && linkable.length > 0 ? (
                <FieldGroup label="Coverage">
                  <Field label="Linked parties / mills / weavers">
                    <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-(--line) bg-(--panel-alt) p-1.5">
                      {linkable.map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[11px] hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            name="relatedPartyIds"
                            value={p.id}
                            className="accent-(--accent)"
                          />
                          <span className="truncate">
                            {p.name}{" "}
                            <span className="text-(--muted)">
                              ({PARTY_TYPE_LABELS[p.type]})
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </Field>
                </FieldGroup>
              ) : null}
              <button className={buttonClass + " w-full"} type="submit">
                Save
              </button>
            </form>
          </Panel>
        </Section>

        <Section
          title={`${meta.label} on file`}
          icon={meta.icon}
          description={`${rows.length} record(s)`}
        >
          <Panel flush>
            {rows.length === 0 ? (
              <div className="p-2.5">
                <EmptyState
                  icon={meta.icon}
                  text={`No ${meta.label.toLowerCase()} yet. Add the first one on the left.`}
                />
              </div>
            ) : (
              <TableWrap maxHeight={560}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Terms</th>
                      <th>{type === "AGENT" ? "Linked to" : "Agents"}</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const links =
                        type === "AGENT"
                          ? p.agentLinks.map(
                              (l) =>
                                `${l.relatedParty.name} (${PARTY_TYPE_LABELS[l.relatedParty.type]})`,
                            )
                          : p.linkedFromAgents.map((l) => l.agent.name);

                      return (
                        <tr key={p.id} className={p.active ? "" : "opacity-55"}>
                          <td className="font-semibold">{p.name}</td>
                          <td className="text-[11px]">
                            {p.whatsapp ? (
                              <span className="badge badge-wa">
                                {p.whatsapp}
                              </span>
                            ) : (
                              <span className="badge badge-muted">no WA</span>
                            )}
                            {p.gstin ? (
                              <div className="text-[10px] text-(--faint)">
                                {p.gstin}
                              </div>
                            ) : null}
                          </td>
                          <td className="text-[11px] tabular-nums">
                            {p.paymentTermsDays}d
                            <div className="text-[10px] text-(--faint)">
                              {String(p.interestRatePct)}% p.a.
                            </div>
                          </td>
                          <td className="max-w-52 text-[11px] text-(--muted)">
                            {links.length === 0 ? (
                              "—"
                            ) : (
                              <span className="line-clamp-2">
                                {links.join(", ")}
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={
                                p.active
                                  ? "badge badge-ok"
                                  : "badge badge-muted"
                              }
                            >
                              {p.active ? "Active" : "Off"}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              <Link
                                href={`/masters/parties/${p.id}`}
                                className={buttonTinyClass}
                              >
                                Edit
                              </Link>
                              <form action={setPartyActive}>
                                <input type="hidden" name="id" value={p.id} />
                                <input
                                  type="hidden"
                                  name="active"
                                  value={p.active ? "false" : "true"}
                                />
                                <button
                                  className={buttonTinyClass}
                                  type="submit"
                                >
                                  {p.active ? "Disable" : "Enable"}
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </Section>
      </div>
    </div>
  );
}

export function PartyFields({
  defaultType,
  lockedType,
  values,
}: {
  defaultType: PartyType;
  lockedType?: boolean;
  values?: {
    name?: string;
    type?: PartyType;
    whatsapp?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    address?: string | null;
    notes?: string | null;
    paymentTermsDays?: number;
    interestRatePct?: { toString(): string } | string | number;
    active?: boolean;
  };
}) {
  return (
    <>
      <FieldGroup label="Identity">
        <Field label="Name">
          <input
            className={inputClass}
            name="name"
            required
            defaultValue={values?.name ?? ""}
          />
        </Field>
        {lockedType ? null : (
          <Field label="Type">
            <select
              className={inputClass}
              name="type"
              defaultValue={values?.type ?? defaultType}
            >
              {(
                [
                  "CLIENT",
                  "MILL",
                  "WEAVER",
                  "AGENT",
                  "GREY_SUPPLIER",
                  "OTHER",
                ] as PartyType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {PARTY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="GSTIN">
          <input
            className={inputClass}
            name="gstin"
            defaultValue={values?.gstin ?? ""}
          />
        </Field>
      </FieldGroup>

      <FieldGroup label="Contact">
        <div className="grid grid-cols-2 gap-1.5">
          <Field
            label="WhatsApp"
            hint={lockedType ? undefined : "Country code, no +"}
          >
            <input
              className={inputClass}
              name="whatsapp"
              placeholder="91…"
              defaultValue={values?.whatsapp ?? ""}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              name="phone"
              defaultValue={values?.phone ?? ""}
            />
          </Field>
        </div>
        <Field label="Email">
          <input
            className={inputClass}
            name="email"
            type="email"
            defaultValue={values?.email ?? ""}
          />
        </Field>
        <Field label="Address">
          <textarea
            className={inputClass}
            name="address"
            rows={2}
            defaultValue={values?.address ?? ""}
          />
        </Field>
      </FieldGroup>

      <FieldGroup label="Credit">
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Payment terms (days)" hint="From dispatch">
            <input
              className={inputClass}
              name="paymentTermsDays"
              type="number"
              defaultValue={values?.paymentTermsDays ?? 30}
            />
          </Field>
          <Field label="Interest % / year">
            <input
              className={inputClass}
              name="interestRatePct"
              type="number"
              step="any"
              defaultValue={
                values?.interestRatePct != null
                  ? String(values.interestRatePct)
                  : "28.5"
              }
            />
          </Field>
        </div>
        <Field label="Notes">
          <input
            className={inputClass}
            name="notes"
            defaultValue={values?.notes ?? ""}
          />
        </Field>
        {values ? (
          <Field label="Status">
            <select
              className={inputClass}
              name="active"
              defaultValue={values.active === false ? "false" : "true"}
            >
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </Field>
        ) : null}
      </FieldGroup>
    </>
  );
}
