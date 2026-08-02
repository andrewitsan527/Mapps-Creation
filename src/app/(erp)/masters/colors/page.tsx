import { prisma } from "@/lib/db";
import { createColorFamily, createShade } from "@/server/actions/masters";
import { ColorHexField } from "@/components/color-hex-field";
import {
  EmptyState,
  Field,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  Section,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { Palette, PlusCircle } from "lucide-react";

export default async function ColorsPage() {
  const families = await prisma.colorFamily.findMany({
    include: {
      shades: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      _count: { select: { shades: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const totalShades = families.reduce((sum, f) => sum + f._count.shades, 0);
  const emptyFamilies = families.filter((f) => f._count.shades === 0).length;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Colors & shades"
        eyebrow="Masters"
        icon={Palette}
        description="Families group shades for filters and program cards. A shade code travels with the lot all the way to the sale bill."
      />

      <MetricStrip className="grid-cols-3">
        <Metric label="Families" value={families.length} />
        <Metric label="Shades" value={totalShades} tone="accent" />
        <Metric
          label="Empty families"
          value={emptyFamilies}
          tone={emptyFamilies ? "warn" : "neutral"}
          hint="No shades yet"
        />
      </MetricStrip>

      <div className="grid gap-3 xl:grid-cols-[260px_280px_1fr]">
        <Section title="New family" icon={PlusCircle} tone="accent">
          <Panel compact>
            <form action={createColorFamily} className="space-y-1.5">
              <Field
                label="Family name"
                hint="Black → Jet Black, Soft Black, Black-01"
              >
                <input
                  className={inputClass}
                  name="name"
                  placeholder="Maroon, Olive, Sky…"
                  required
                />
              </Field>
              <button className={buttonClass + " w-full"} type="submit">
                Add color family
              </button>
            </form>
          </Panel>
        </Section>

        <Section title="New shade" icon={Palette} tone="info">
          <Panel compact>
            <form action={createShade} className="space-y-1.5">
              <Field label="Under color family">
                <select className={inputClass} name="colorFamilyId" required>
                  <option value="">Select family…</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f._count.shades})
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Shade code">
                  <input
                    className={inputClass}
                    name="code"
                    placeholder="MRN-01"
                    required
                  />
                </Field>
                <Field label="Shade name">
                  <input
                    className={inputClass}
                    name="name"
                    placeholder="Deep Maroon"
                    required
                  />
                </Field>
              </div>
              <Field
                label="Shade color"
                hint="Pick with the swatch — hex fills in automatically"
              >
                <ColorHexField name="hex" defaultValue="#808080" />
              </Field>
              <button className={buttonClass + " w-full"} type="submit">
                Add shade
              </button>
            </form>
          </Panel>
        </Section>

        <Section
          title="Shade library"
          icon={Palette}
          description={`${families.length} families · ${totalShades} shades`}
        >
          {families.length === 0 ? (
            <Panel compact>
              <EmptyState
                icon={Palette}
                text="No color families yet — add your first scheme on the left."
              />
            </Panel>
          ) : (
            <div className="space-y-1.5">
              {families.map((family) => (
                <Panel
                  key={family.id}
                  title={family.name}
                  subtitle={`${family._count.shades} shades`}
                  compact
                >
                  {family.shades.length === 0 ? (
                    <p className="text-[11px] text-(--muted)">
                      No shades yet — add one in the middle form.
                    </p>
                  ) : (
                    <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                      {family.shades.map((shade) => (
                        <li
                          key={shade.id}
                          className="flex items-center gap-2 rounded-md border border-(--line) bg-(--panel-alt) px-2 py-1.5"
                        >
                          <span
                            className="h-6 w-6 shrink-0 rounded-md border border-(--line-strong)"
                            style={{ backgroundColor: shade.hex || "#cbd5e1" }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-medium">
                              {shade.name}
                            </span>
                            <span className="block truncate text-[10px] text-(--muted)">
                              {shade.code}
                              {shade.hex ? ` · ${shade.hex}` : ""}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
