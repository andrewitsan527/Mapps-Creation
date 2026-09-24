"use client";

import { useMemo, useState } from "react";
import { PartySelect } from "@/components/party-select";
import type { PartyOption } from "@/lib/parties";
import { Field, inputClass } from "@/components/ui";

export type GreyPoOption = {
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

export function ProgramGreyWeaverFields({
  greys,
  mills,
  weavers,
  millWeaverLinks,
}: {
  greys: GreyPoOption[];
  mills: PartyOption[];
  weavers: PartyOption[];
  millWeaverLinks: { millId: string; weaverId: string }[];
}) {
  const [greyOrderId, setGreyOrderId] = useState("");
  const [millId, setMillId] = useState("");
  const selected = greys.find((g) => g.id === greyOrderId);

  const weaversForMill = useMemo(() => {
    if (!millId) return [];
    const allowed = new Set(
      millWeaverLinks
        .filter((l) => l.millId === millId)
        .map((l) => l.weaverId),
    );
    return weavers.filter((w) => allowed.has(w.id));
  }, [millId, weavers, millWeaverLinks]);

  const remarksDefault = selected?.fabricNotes ?? "";

  return (
    <>
      <Field
        label="Grey PO (optional)"
        hint="Selecting a PO sets mill, weaver, qty, dyeing rate and notes from that purchase"
      >
        <select
          className={inputClass}
          name="greyOrderId"
          value={greyOrderId}
          onChange={(event) => {
            const next = event.target.value;
            setGreyOrderId(next);
            const grey = greys.find((g) => g.id === next);
            setMillId(grey?.millId ?? "");
          }}
        >
          <option value="">—</option>
          {greys.map((g) => (
            <option key={g.id} value={g.id}>
              {g.poNumber} · {g.weaverName}
              {g.millName ? ` → ${g.millName}` : ""}
            </option>
          ))}
        </select>
      </Field>

      {selected ? (
        <>
          {selected.millId ? (
            <input type="hidden" name="millId" value={selected.millId} />
          ) : null}
          <input type="hidden" name="weaverId" value={selected.weaverId} />
          <Field
            label="Destination mill"
            hint={
              selected.millId
                ? "From the selected grey purchase"
                : "This older PO has no mill — assign mill/weaver in masters, then pick mill below"
            }
          >
            {selected.millId ? (
              <p className="rounded-md border border-(--border) bg-(--muted)/30 px-2 py-1.5 text-sm">
                {selected.millName}
              </p>
            ) : (
              <select
                className={inputClass}
                name="millId"
                required
                value={millId}
                onChange={(event) => setMillId(event.target.value)}
              >
                <option value="">Select…</option>
                {mills.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Weaver" hint="From the selected grey purchase">
            <p className="rounded-md border border-(--border) bg-(--muted)/30 px-2 py-1.5 text-sm">
              {selected.weaverName}
            </p>
          </Field>
          <Field label="Planned quantity" hint="From the grey purchase">
            <p className="rounded-md border border-(--border) bg-(--muted)/30 px-2 py-1.5 text-sm">
              {selected.quantity
                ? `${selected.quantity} ${selected.unit}`
                : "—"}
            </p>
          </Field>
          <Field
            label="Dyeing rate"
            hint={
              selected.dyeingRate
                ? `₹ per ${selected.unit}`
                : "From the grey purchase"
            }
          >
            <p className="rounded-md border border-(--border) bg-(--muted)/30 px-2 py-1.5 text-sm">
              {selected.dyeingRate
                ? `₹ ${selected.dyeingRate} / ${selected.unit}`
                : "—"}
            </p>
          </Field>
        </>
      ) : (
        <>
          <Field label="Mill">
            <select
              className={inputClass}
              name="millId"
              required
              value={millId}
              onChange={(event) => setMillId(event.target.value)}
            >
              <option value="">Select…</option>
              {mills.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Weaver (optional)"
            hint={
              millId && weaversForMill.length === 0
                ? "Assign weavers to this mill in masters first"
                : "Only weavers linked to this mill"
            }
          >
            <PartySelect
              key={millId}
              name="weaverId"
              options={weaversForMill}
              placeholder="—"
            />
          </Field>
        </>
      )}

      <Field label="Remarks" hint="Grey purchase notes are used as the default">
        <textarea
          key={`${greyOrderId}-${remarksDefault}`}
          className={inputClass}
          name="remarks"
          rows={2}
          defaultValue={remarksDefault}
        />
      </Field>
    </>
  );
}
