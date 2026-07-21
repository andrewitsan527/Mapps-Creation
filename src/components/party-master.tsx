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
  PageHeader,
  Panel,
  buttonClass,
  buttonGhostClass,
  inputClass,
} from "@/components/ui";

const TAB_META: {
  type: MasterPartyType;
  label: string;
  addLabel: string;
  blurb: string;
}[] = [
  {
    type: "CLIENT",
    label: "Parties",
    addLabel: "Add party",
    blurb: "Buying clients — terms, WhatsApp, GST.",
  },
  {
    type: "MILL",
    label: "Mills",
    addLabel: "Add mill",
    blurb: "Processing mills used on program cards.",
  },
  {
    type: "WEAVER",
    label: "Weavers",
    addLabel: "Add weaver",
    blurb: "Weavers linked to grey / programs / QC.",
  },
  {
    type: "AGENT",
    label: "Agents",
    addLabel: "Add agent",
    blurb: "Commission agents with linked parties, mills, weavers.",
  },
  {
    type: "GREY_SUPPLIER",
    label: "Suppliers",
    addLabel: "Add supplier",
    blurb: "Grey fabric suppliers for purchase orders.",
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

  return (
    <div>
      <PageHeader title={meta.label} description={meta.blurb} />

      <div className="mb-1.5 flex flex-wrap gap-1">
        {TAB_META.map((t) => (
          <Link
            key={t.type}
            href={masterHref(t.type)}
            className={
              t.type === type
                ? "rounded border border-(--accent) bg-(--accent-soft) px-2 py-1 text-[11px] font-semibold text-(--accent-strong)"
                : "rounded border border-(--line) bg-white px-2 py-1 text-[11px] text-(--muted) hover:border-(--accent)"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-1.5 lg:grid-cols-[300px_1fr]">
        <Panel title={meta.addLabel} compact>
          <form action={createPartyMaster} className="space-y-1.5">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="active" value="true" />
            <PartyFields defaultType={type} lockedType />
            {type === "AGENT" && linkable.length > 0 ? (
              <Field label="Linked parties / mills / weavers">
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-(--line) p-1.5">
                  {linkable.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-1.5 text-[11px]"
                    >
                      <input
                        type="checkbox"
                        name="relatedPartyIds"
                        value={p.id}
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
            ) : null}
            <button className={buttonClass} type="submit">
              Save
            </button>
          </form>
        </Panel>

        <Panel title={`${meta.label} (${rows.length})`} compact>
          {rows.length === 0 ? (
            <EmptyState text={`No ${meta.label.toLowerCase()} yet.`} />
          ) : (
            <div className="overflow-x-auto">
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
                      <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                        <td className="font-semibold">{p.name}</td>
                        <td className="text-[11px]">
                          <div>{p.whatsapp ?? p.phone ?? "—"}</div>
                          {p.gstin ? (
                            <div className="text-(--muted)">{p.gstin}</div>
                          ) : null}
                        </td>
                        <td className="tabular-nums text-[11px]">
                          {p.paymentTermsDays}d
                        </td>
                        <td className="max-w-52 text-[11px]">
                          {links.length === 0 ? (
                            <span className="text-(--muted)">—</span>
                          ) : (
                            <span className="line-clamp-2">
                              {links.join(", ")}
                            </span>
                          )}
                        </td>
                        <td>{p.active ? "Active" : "Off"}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            <Link
                              href={`/masters/parties/${p.id}`}
                              className={buttonGhostClass}
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
                              <button className={buttonGhostClass} type="submit">
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
            </div>
          )}
        </Panel>
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
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="WhatsApp">
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
      <Field label="GSTIN">
        <input
          className={inputClass}
          name="gstin"
          defaultValue={values?.gstin ?? ""}
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
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Payment terms (days)">
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
    </>
  );
}
