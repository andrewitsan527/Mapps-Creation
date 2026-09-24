import { prisma } from "@/lib/db";
import {
  createCode,
  createColour,
  createQuality,
} from "@/server/actions/masters";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  Section,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { Droplet, Hash, Palette, Tag } from "lucide-react";

type MasterRow = { id: string; name: string; active: boolean };

function MasterList({
  rows,
  emptyIcon: Icon,
  emptyText,
}: {
  rows: MasterRow[];
  emptyIcon: typeof Tag;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={Icon} text={emptyText} />;
  }
  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li
          key={row.id}
          className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${
            row.active
              ? "border-(--line) bg-(--panel-alt)"
              : "border-dashed border-(--line) opacity-55"
          }`}
        >
          <span className="truncate text-[12px] font-medium">{row.name}</span>
          <span
            className={row.active ? "badge badge-ok" : "badge badge-muted"}
          >
            {row.active ? "Active" : "Off"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ColorsPage() {
  const [qualities, codes, colours] = await Promise.all([
    prisma.quality.findMany({
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.code.findMany({
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.colour.findMany({
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Colors & shades"
        eyebrow="Masters"
        icon={Palette}
        description="Independent Quality, Code and Colour lists. Programs, stock and sale will pick a combination later — these values are not linked to each other."
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <Section title="Quality" icon={Tag} tone="accent">
          <Panel compact>
            <form action={createQuality} className="space-y-1.5">
              <Field label="Quality name">
                <input
                  className={inputClass}
                  name="name"
                  placeholder="Alpino, Mario…"
                  required
                />
              </Field>
              <button className={buttonClass + " w-full"} type="submit">
                Add Quality
              </button>
            </form>
          </Panel>
          <Panel
            compact
            title="Quality list"
            subtitle={`${qualities.length} value(s)`}
          >
            <MasterList
              rows={qualities}
              emptyIcon={Tag}
              emptyText="No qualities yet."
            />
          </Panel>
        </Section>

        <Section title="Code" icon={Hash} tone="info">
          <Panel compact>
            <form action={createCode} className="space-y-1.5">
              <Field label="Code">
                <input
                  className={inputClass}
                  name="name"
                  placeholder="A1, C1…"
                  required
                />
              </Field>
              <button className={buttonClass + " w-full"} type="submit">
                Add Code
              </button>
            </form>
          </Panel>
          <Panel compact title="Code list" subtitle={`${codes.length} value(s)`}>
            <MasterList
              rows={codes}
              emptyIcon={Hash}
              emptyText="No codes yet."
            />
          </Panel>
        </Section>

        <Section title="Colour" icon={Droplet}>
          <Panel compact>
            <form action={createColour} className="space-y-1.5">
              <Field label="Colour name">
                <input
                  className={inputClass}
                  name="name"
                  placeholder="Maroon, Blue…"
                  required
                />
              </Field>
              <button className={buttonClass + " w-full"} type="submit">
                Add Colour
              </button>
            </form>
          </Panel>
          <Panel
            compact
            title="Colour list"
            subtitle={`${colours.length} value(s)`}
          >
            <MasterList
              rows={colours}
              emptyIcon={Droplet}
              emptyText="No colours yet."
            />
          </Panel>
        </Section>
      </div>
    </div>
  );
}
