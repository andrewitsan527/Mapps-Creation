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
  Field,
  PageHeader,
  Panel,
  buttonClass,
  buttonGhostClass,
  inputClass,
} from "@/components/ui";

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
    <div>
      <PageHeader
        title={`Edit · ${party.name}`}
        description={PARTY_TYPE_LABELS[party.type]}
        actions={
          <Link href={masterHref(party.type)} className={buttonGhostClass}>
            Back
          </Link>
        }
      />

      <div className="grid gap-1.5 lg:grid-cols-[360px_1fr]">
        <Panel title="Details" compact>
          <form action={updatePartyMaster} className="space-y-1.5">
            <input type="hidden" name="id" value={party.id} />
            <input type="hidden" name="type" value={party.type} />
            <PartyFields
              defaultType={party.type}
              lockedType
              values={party}
            />

            {party.type === "AGENT" ? (
              <Field label="Linked parties / mills / weavers">
                {linkable.length === 0 ? (
                  <p className="text-[11px] text-(--muted)">
                    Add clients, mills, or weavers first, then link them here.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-0.5 overflow-y-auto rounded border border-(--line) p-1.5">
                    {linkable.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-1.5 text-[11px]"
                      >
                        <input
                          type="checkbox"
                          name="relatedPartyIds"
                          value={p.id}
                          defaultChecked={selected.has(p.id)}
                        />
                        <span>
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
            ) : null}

            <button className={buttonClass} type="submit">
              Update
            </button>
          </form>
        </Panel>

        <Panel title="Links" compact>
          {party.type === "MILL" ? (
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold">
                  Valid physical markas
                </p>
                {party.millMarkas.length === 0 ? (
                  <p className="text-[11px] text-(--muted)">
                    No marka registered. Goods carrying this mill cannot be
                    accepted as a return.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {party.millMarkas.map((marka) => (
                      <form
                        key={marka.id}
                        action={updateMillMarka}
                        className="grid grid-cols-[110px_1fr_80px_auto] gap-1"
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
                        <button className={buttonGhostClass} type="submit">
                          Save
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
              <form
                action={addMillMarka}
                className="grid grid-cols-[110px_1fr_auto] gap-1 border-t border-(--line) pt-1.5"
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
            </div>
          ) : party.type === "AGENT" ? (
            selected.size === 0 ? (
              <p className="text-[11px] text-(--muted)">
                No linked parties yet. Tick them on the left and save.
              </p>
            ) : (
              <ul className="space-y-0.5 text-[12px]">
                {linkable
                  .filter((p) => selected.has(p.id))
                  .map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/masters/parties/${p.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </Link>{" "}
                      <span className="text-(--muted)">
                        ({PARTY_TYPE_LABELS[p.type]})
                      </span>
                    </li>
                  ))}
              </ul>
            )
          ) : party.linkedFromAgents.length === 0 ? (
            <p className="text-[11px] text-(--muted)">
              No agents linked. Open an agent master and tick this{" "}
              {PARTY_TYPE_LABELS[party.type].toLowerCase()}.
            </p>
          ) : (
            <ul className="space-y-0.5 text-[12px]">
              {party.linkedFromAgents.map((l) => (
                <li key={l.id}>
                  Agent{" "}
                  <Link
                    href={`/masters/parties/${l.agent.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {l.agent.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
