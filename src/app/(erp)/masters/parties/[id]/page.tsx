import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  addMillMarka,
  updateMillMarka,
  updatePartyMaster,
} from "@/server/actions/parties";
import { PARTY_TYPE_LABELS, masterHref } from "@/lib/parties";
import { PartyFields } from "@/components/party-master";
import {
  Breadcrumbs,
  EmptyState,
  Field,
  FieldGroup,
  PageHeader,
  Panel,
  Section,
  buttonClass,
  buttonGhostClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import { Link2, ScanBarcode, UserCog } from "lucide-react";

export default async function EditPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const party = await prisma.party.findUnique({
    where: { id },
    include: {
      agentLinks: {
        select: { relatedPartyId: true },
      },
      linkedFromAgents: {
        include: { agent: { select: { id: true, name: true } } },
      },
      millMarkas: { orderBy: [{ active: "desc" }, { code: "asc" }] },
    },
  });

  if (!party) notFound();

  const linkable =
    party.type === "AGENT"
      ? await prisma.party.findMany({
          where: {
            active: true,
            type: { in: ["CLIENT", "MILL", "WEAVER", "GREY_SUPPLIER"] },
          },
          select: { id: true, name: true, type: true },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        })
      : [];

  const selected = new Set(party.agentLinks.map((l) => l.relatedPartyId));

  return (
    <div className="space-y-3">
      <Breadcrumbs
        items={[
          { label: "Masters", href: masterHref(party.type) },
          {
            label: PARTY_TYPE_LABELS[party.type],
            href: masterHref(party.type),
          },
          { label: party.name },
        ]}
      />

      <PageHeader
        title={party.name}
        eyebrow="Masters"
        icon={UserCog}
        description={`${PARTY_TYPE_LABELS[party.type]} · ${party.paymentTermsDays}d terms · ${String(party.interestRatePct)}% p.a. after due`}
        actions={
          <Link href={masterHref(party.type)} className={buttonGhostClass}>
            Back
          </Link>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <Section title="Details" icon={UserCog} tone="accent">
          <Panel compact>
            <form action={updatePartyMaster} className="space-y-2.5">
              <input type="hidden" name="id" value={party.id} />
              <input type="hidden" name="type" value={party.type} />
              <PartyFields
                defaultType={party.type}
                lockedType
                values={party}
              />

              {party.type === "AGENT" ? (
                <FieldGroup label="Coverage">
                  <Field label="Linked parties / mills / weavers">
                    {linkable.length === 0 ? (
                      <p className="text-[11px] text-(--muted)">
                        Add clients, mills, or weavers first, then link them
                        here.
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border border-(--line) bg-(--panel-alt) p-1.5">
                        {linkable.map((p) => (
                          <label
                            key={p.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[11px] hover:bg-white"
                          >
                            <input
                              type="checkbox"
                              name="relatedPartyIds"
                              value={p.id}
                              defaultChecked={selected.has(p.id)}
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
                    )}
                  </Field>
                </FieldGroup>
              ) : null}

              <button className={buttonClass + " w-full"} type="submit">
                Update
              </button>
            </form>
          </Panel>
        </Section>

        <Section
          title={party.type === "MILL" ? "Markas & links" : "Links"}
          icon={party.type === "MILL" ? ScanBarcode : Link2}
        >
          {party.type === "MILL" ? (
            <Panel
              title="Valid physical markas"
              icon={ScanBarcode}
              tone="info"
              subtitle="Goods returns must match one of these"
              compact
            >
              {party.millMarkas.length === 0 ? (
                <EmptyState
                  icon={ScanBarcode}
                  text="No marka registered. Goods carrying this mill cannot be accepted as a return."
                />
              ) : (
                <div className="space-y-1">
                  {party.millMarkas.map((marka) => (
                    <form
                      key={marka.id}
                      action={updateMillMarka}
                      className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr_80px_auto]"
                    >
                      <input type="hidden" name="id" value={marka.id} />
                      <input
                        className={inputClass}
                        name="code"
                        defaultValue={marka.code}
                        required
                      />
                      <input
                        className={inputClass}
                        name="label"
                        defaultValue={marka.label ?? ""}
                        placeholder="Label"
                      />
                      <select
                        className={inputClass}
                        name="active"
                        defaultValue={marka.active ? "true" : "false"}
                      >
                        <option value="true">Active</option>
                        <option value="false">Off</option>
                      </select>
                      <button className={buttonTinyClass} type="submit">
                        Save
                      </button>
                    </form>
                  ))}
                </div>
              )}

              <form
                action={addMillMarka}
                className="mt-2 grid grid-cols-1 gap-1 border-t border-(--line-soft) pt-2 sm:grid-cols-[110px_1fr_auto]"
              >
                <input type="hidden" name="millId" value={party.id} />
                <input
                  className={inputClass}
                  name="code"
                  placeholder="Marka code"
                  required
                />
                <input
                  className={inputClass}
                  name="label"
                  placeholder="Description (optional)"
                />
                <button className={buttonClass} type="submit">
                  Add marka
                </button>
              </form>
            </Panel>
          ) : party.type === "AGENT" ? (
            <Panel title="Covers" icon={Link2} compact>
              {selected.size === 0 ? (
                <EmptyState text="No linked parties yet. Tick them on the left and save." />
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {linkable
                    .filter((p) => selected.has(p.id))
                    .map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/masters/parties/${p.id}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-(--line) bg-(--panel-alt) px-2 py-1.5 text-[12px] transition hover:border-(--accent) hover:bg-(--accent-soft)"
                        >
                          <span className="truncate font-medium">
                            {p.name}
                          </span>
                          <span className="badge badge-muted">
                            {PARTY_TYPE_LABELS[p.type]}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          ) : (
            <Panel title="Agents covering this party" icon={Link2} compact>
              {party.linkedFromAgents.length === 0 ? (
                <EmptyState
                  text={`No agents linked. Open an agent master and tick this ${PARTY_TYPE_LABELS[
                    party.type
                  ].toLowerCase()}.`}
                  action={
                    <Link href="/masters/agents" className={buttonTinyClass}>
                      Agents
                    </Link>
                  }
                />
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {party.linkedFromAgents.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/masters/parties/${l.agent.id}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-(--line) bg-(--panel-alt) px-2 py-1.5 text-[12px] transition hover:border-(--accent) hover:bg-(--accent-soft)"
                      >
                        <span className="truncate font-medium">
                          {l.agent.name}
                        </span>
                        <span className="badge badge-muted">Agent</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </Section>
      </div>
    </div>
  );
}
