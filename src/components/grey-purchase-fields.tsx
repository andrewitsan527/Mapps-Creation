"use client";

import { useMemo, useState } from "react";
import { PartySelect } from "@/components/party-select";
import type { PartyOption } from "@/lib/parties";
import { Field, FieldGroup, inputClass } from "@/components/ui";

export function GreyPurchaseFields({
  weavers,
  mills,
  agents,
  millWeaverLinks,
  agentWeaverLinks,
}: {
  weavers: PartyOption[];
  mills: PartyOption[];
  agents: PartyOption[];
  millWeaverLinks: { millId: string; weaverId: string }[];
  agentWeaverLinks: { agentId: string; relatedPartyId: string }[];
}) {
  const [weaverId, setWeaverId] = useState("");

  const millsForWeaver = useMemo(() => {
    if (!weaverId) return [];
    const allowed = new Set(
      millWeaverLinks
        .filter((l) => l.weaverId === weaverId)
        .map((l) => l.millId),
    );
    return mills.filter((m) => allowed.has(m.id));
  }, [weaverId, mills, millWeaverLinks]);

  const agentsForWeaver = useMemo(() => {
    if (!weaverId) return [];
    const allowed = new Set(
      agentWeaverLinks
        .filter((l) => l.relatedPartyId === weaverId)
        .map((l) => l.agentId),
    );
    return agents.filter((a) => allowed.has(a.id));
  }, [weaverId, agents, agentWeaverLinks]);

  return (
    <>
      <FieldGroup label="Weaver">
        <select
          className={inputClass}
          name="supplierId"
          required
          value={weaverId}
          onChange={(event) => setWeaverId(event.target.value)}
        >
          <option value="">Select…</option>
          {weavers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </FieldGroup>

      <FieldGroup label="Grey agent">
        <PartySelect
          key={weaverId}
          name="agentId"
          options={agentsForWeaver}
          placeholder="Direct / no agent"
        />
        <span className="block text-[10px] text-(--faint)">
          Leave empty for direct / naked (no broker)
        </span>
      </FieldGroup>

      <FieldGroup label="Destination mill">
        <select
          className={inputClass}
          name="millId"
          required
          disabled={!weaverId}
          key={weaverId}
        >
          <option value="">
            {weaverId ? "Select…" : "Select a weaver first"}
          </option>
          {millsForWeaver.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="block text-[10px] text-(--faint)">
          {weaverId && millsForWeaver.length === 0
            ? "Assign this weaver to a mill in masters first"
            : "Only mills linked to the selected weaver"}
        </span>
      </FieldGroup>

      <FieldGroup label="Quantity">
        <div className="grid grid-cols-[1fr_84px] gap-1.5">
          <Field label="Quantity">
            <input
              className={inputClass}
              name="quantity"
              type="number"
              step="any"
              placeholder="0"
            />
          </Field>
          <Field label="Unit">
            <select className={inputClass} name="unit" defaultValue="kg">
              <option value="kg">kg</option>
            </select>
          </Field>
        </div>
        <Field
          label="Dyeing rate"
          hint="₹/kg"
        >
          <input
            className={inputClass}
            name="dyeingRate"
            type="number"
            step="any"
            placeholder="0"
          />
        </Field>
      </FieldGroup>
    </>
  );
}
