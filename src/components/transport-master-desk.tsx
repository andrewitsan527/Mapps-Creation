"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import {
  EmptyState,
  Field,
  FieldGroup,
  Metric,
  MetricStrip,
  PageHeader,
  Panel,
  TableWrap,
  buttonClass,
  buttonGhostClass,
  buttonTinyClass,
  inputClass,
} from "@/components/ui";
import { type LocalTransporter } from "@/lib/local-workflow";
import {
  createTransport,
  updateTransport,
  type TransportInput,
  type TransportRecord,
} from "@/server/actions/transports";

function blankTransport(): LocalTransporter {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    transportName: "",
    address: "",
    phone: "",
    email: "",
    transIdGstin: "",
    createdAt: now,
    updatedAt: now,
  };
}

function toLocal(row: TransportRecord): LocalTransporter {
  return row;
}

function toInput(entry: LocalTransporter): TransportInput {
  return {
    transportName: entry.transportName,
    phone: entry.phone,
    email: entry.email,
    transIdGstin: entry.transIdGstin,
    address: entry.address,
  };
}

function emailLooksValid(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

export function TransportMasterDesk({
  transports,
}: {
  transports: TransportRecord[];
}) {
  const [rows, setRows] = useState<LocalTransporter[]>(() =>
    transports.map(toLocal),
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<LocalTransporter | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(transports.map(toLocal));
  }, [transports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.transportName.toLowerCase().includes(q),
    );
  }, [query, rows]);

  function patch(partial: Partial<LocalTransporter>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function openCreate() {
    setDraft(blankTransport());
    setMode("create");
    setError(null);
  }

  function openEdit(row: LocalTransporter) {
    setDraft({ ...row });
    setMode("edit");
    setError(null);
  }

  function closeModal() {
    setDraft(null);
    setMode(null);
    setError(null);
  }

  const unsaved = useUnsavedClose({
    active: mode != null && draft != null,
    current: draft,
    onDiscard: closeModal,
  });

  function validate(entry: LocalTransporter) {
    if (!entry.transportName.trim()) return "Enter transport name.";
    if (entry.email.trim() && !emailLooksValid(entry.email)) {
      return "Enter a valid email ID.";
    }
    return null;
  }

  async function saveTransport() {
    if (!draft || !mode || saving) return;
    const message = validate(draft);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    try {
      const saved =
        mode === "create"
          ? await createTransport(toInput(draft))
          : await updateTransport(draft.id, toInput(draft));
      const local = toLocal(saved);
      setRows((prev) =>
        mode === "create"
          ? [local, ...prev]
          : prev.map((row) => (row.id === local.id ? local : row)),
      );
      closeModal();
      setNotice(
        mode === "create"
          ? `${local.transportName} saved.`
          : `${local.transportName} updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save transport.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Transport"
        eyebrow="Masters"
        icon={Truck}
        description="Carriers used later on delivery / dispatch."
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add Transport
          </button>
        }
      />

      {notice ? (
        <div className="flex items-center justify-between rounded-md border border-(--line) bg-(--panel-alt) px-2.5 py-1.5 text-[12px]">
          <span>{notice}</span>
          <button
            type="button"
            className={buttonTinyClass}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <MetricStrip className="grid-cols-2 sm:grid-cols-3">
        <Metric label="Total transports" value={rows.length} />
      </MetricStrip>

      <Panel
        title="Transport"
        flush
        action={
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
            <input
              className={`${inputClass} w-56`}
              placeholder="Search transport name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={Truck} text="No transport records." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Transport Name</th>
                  <th>Phone No.</th>
                  <th>Email ID</th>
                  <th>Trans ID / GSTIN</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-(--panel-sunken)"
                    onClick={() => openEdit(row)}
                  >
                    <td className="font-medium">{row.transportName}</td>
                    <td className="tabular-nums">{row.phone || "—"}</td>
                    <td>{row.email || "—"}</td>
                    <td className="tabular-nums">{row.transIdGstin || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className={buttonTinyClass}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {unsaved.dialog}
      {draft && mode ? (
        <Overlay
          title={mode === "create" ? "New Transport" : "Edit Transport"}
          onClose={unsaved.requestClose}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-2 px-4 py-2.5">
              {error ? (
                <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                  {error}
                </p>
              ) : null}

              <FieldGroup label="Transport details" className="space-y-1">
                <div className="grid grid-cols-4 gap-x-2 gap-y-1.5">
                  <Field label="Transport Name" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.transportName}
                      onChange={(e) =>
                        patch({ transportName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Phone No." className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.phone}
                      inputMode="tel"
                      onChange={(e) => patch({ phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Email ID" className="col-span-2">
                    <input
                      className={inputClass}
                      type="email"
                      value={draft.email}
                      onChange={(e) => patch({ email: e.target.value })}
                    />
                  </Field>
                  <Field label="Trans ID / GSTIN" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.transIdGstin}
                      onChange={(e) =>
                        patch({ transIdGstin: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Address" className="col-span-4">
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={draft.address}
                      onChange={(e) => patch({ address: e.target.value })}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </div>

            <div className="flex shrink-0 justify-end gap-1.5 border-t border-(--line) bg-(--panel) px-4 py-2.5">
              <button
                type="button"
                className={buttonGhostClass}
                onClick={unsaved.requestClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={saving}
                onClick={() => void saveTransport()}
              >
                {mode === "create" ? "Save Transport" : "Update Transport"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
