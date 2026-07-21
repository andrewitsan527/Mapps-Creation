import { prisma } from "@/lib/db";
import { createColorFamily, createShade } from "@/server/actions/masters";
import { ColorHexField } from "@/components/color-hex-field";
import {
  EmptyState,
  Field,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";

export default async function ColorsPage() {
  const families = await prisma.colorFamily.findMany({
    include: {
      shades: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      _count: { select: { shades: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Color schemes & shades"
        description="Color families and shade codes."
      />
      <div className="grid gap-1.5 lg:grid-cols-[260px_280px_1fr]">
        <Panel title="New color family" compact>
          <form action={createColorFamily} className="space-y-1.5">
            <Field label="Family name">
              <input
                className={inputClass}
                name="name"
                placeholder="e.g. Maroon, Olive, Sky"
                required
              />
            </Field>
            <button className={buttonClass} type="submit">
              Add color family
            </button>
          </form>
          <p className="mt-3 text-[12px] leading-snug text-(--muted)">
            Families group shades for filters and program cards. Example: Black →
            Jet Black, Soft Black, Black-01.
          </p>
        </Panel>

        <Panel title="New shade" compact>
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
            <Field label="Shade color">
              <ColorHexField name="hex" defaultValue="#808080" />
              <span className="mt-1 block text-[11px] text-(--muted)">
                Use the color box to pick — hex fills in automatically.
              </span>
            </Field>
            <button className={buttonClass} type="submit">
              Add shade
            </button>
          </form>
        </Panel>

        <Panel title={`Library (${families.length} families)`} compact>
          {families.length === 0 ? (
            <EmptyState text="No color families yet — add your first scheme on the left." />
          ) : (
            <div className="space-y-1.5">
              {families.map((family) => (
                <div key={family.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <h3 className="text-[12px] font-semibold">{family.name}</h3>
                    <span className="text-[11px] text-(--muted)">
                      {family._count.shades} shades
                    </span>
                  </div>
                  {family.shades.length === 0 ? (
                    <p className="text-[12px] text-(--muted)">
                      No shades — add one in the middle form.
                    </p>
                  ) : (
                    <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                      {family.shades.map((shade) => (
                        <li
                          key={shade.id}
                          className="flex items-center gap-2 rounded-md border border-(--line) px-2.5 py-1.5 text-[13px]"
                        >
                          <span
                            className="h-5 w-5 shrink-0 rounded border border-(--line)"
                            style={{ backgroundColor: shade.hex || "#cbd5e1" }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {shade.name}
                            </span>
                            <span className="block truncate text-[11px] text-(--muted)">
                              {shade.code}
                              {shade.hex ? ` · ${shade.hex}` : ""}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
