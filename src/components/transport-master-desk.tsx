"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Truck, X } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import {
  EmptyState,
  Field,
  Metric,
  MetricStrip,
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
    <div className="ms-page">
      <div className="ms-stage">

      {notice ? (
        <div className="gb-toast-wrap" role="status" aria-live="polite">
          <div className="gb-toast" data-tone="ok">
            <span className="gb-toast-text">{notice}</span>
            <button
              type="button"
              className="gb-toast-close"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <MetricStrip className="aw-metrics ms-metrics grid-cols-2 sm:grid-cols-3">
        <Metric label="Total transports" value={rows.length} />
      </MetricStrip>

      <Panel
        title="Transport"
        flush
        className="ms-panel"
        action={
          <div className="ms-bar-tools">
            <label className="aw-search">
              <span className="sr-only">Search transport name</span>
              <input
                value={query}
                placeholder="Search transport name"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="aw-search-clear"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <Search className="aw-search-icon h-3.5 w-3.5" aria-hidden />
              )}
            </label>
            <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add Transport
          </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={Truck} text="No transport records." />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register ms-reg w-full">
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
                {filtered.length > 0 ? (
                  <tr className="ms-filler" aria-hidden>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      {unsaved.dialog}
      {draft && mode ? (
        <Overlay
          frameWidthClass="ms-sheet ms-sheet-sm"
          title={mode === "create" ? "New Transport" : "Edit Transport"}
          onClose={unsaved.requestClose}
        >
          <div className="ms-form">
            {error ? (
              <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                {error}
              </p>
            ) : null}

            <section className="ms-block">
              <p className="ms-block-head">Transport details</p>
              <div className="ms-block-body ms-grid">
                <Field label="Transport Name">
                  <input
                    className={inputClass}
                    autoFocus
                    required
                    value={draft.transportName}
                    onChange={(e) =>
                      patch({ transportName: e.target.value })
                    }
                  />
                </Field>
                <Field label="Phone No.">
                  <input
                    className={inputClass}
                    value={draft.phone}
                    inputMode="tel"
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </Field>
                <Field label="Email ID">
                  <input
                    className={inputClass}
                    type="email"
                    value={draft.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </Field>
                <Field label="Trans ID / GSTIN">
                  <input
                    className={inputClass}
                    value={draft.transIdGstin}
                    onChange={(e) =>
                      patch({ transIdGstin: e.target.value })
                    }
                  />
                </Field>
                <Field label="Address">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={draft.address}
                    onChange={(e) => patch({ address: e.target.value })}
                  />
                </Field>
              </div>
            </section>
            <div className="ms-foot">
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
    </div>
  );
}
