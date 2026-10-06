"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import {
  EmptyState,
  Field,
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
import { type LocalHaste } from "@/lib/local-workflow";
import {
  createHaste,
  updateHaste,
  type HasteInput,
  type HasteRecord,
} from "@/server/actions/hastes";

function blankHaste(): LocalHaste {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    hasteName: "",
    address: "",
    cityName: "",
    distance: "",
    phone: "",
    mobile: "",
    fax: "",
    email: "",
    residentNo: "",
    manager: "",
    kstNo: "",
    gujaratState: "",
    cstNo: "",
    transport: "",
    tinNo: "",
    policyNo: "",
    panNo: "",
    gstin: "",
    compositeNo: "",
    registrationDate: "",
    receiverName: "",
    createdAt: now,
    updatedAt: now,
  };
}

function toLocal(row: HasteRecord): LocalHaste {
  return row;
}

function toInput(entry: LocalHaste): HasteInput {
  return {
    hasteName: entry.hasteName,
    receiverName: entry.receiverName,
    cityName: entry.cityName,
    distance: entry.distance,
    manager: entry.manager,
    address: entry.address,
    phone: entry.phone,
    mobile: entry.mobile,
    fax: entry.fax,
    email: entry.email,
    residentNo: entry.residentNo,
    kstNo: entry.kstNo,
    gujaratState: entry.gujaratState,
    cstNo: entry.cstNo,
    transport: entry.transport,
    tinNo: entry.tinNo,
    policyNo: entry.policyNo,
    panNo: entry.panNo,
    gstin: entry.gstin,
    compositeNo: entry.compositeNo,
    registrationDate: entry.registrationDate,
  };
}

function emailLooksValid(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function FormSection({
  title,
  collapsible,
  open,
  onToggle,
  children,
}: {
  title: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const visible = !collapsible || open;
  return (
    <div className="border-b border-(--line) pb-1.5 last:border-b-0">
      {collapsible ? (
        <button
          type="button"
          className="mb-1 flex w-full items-center gap-1 text-left"
          onClick={onToggle}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-(--muted) ${
              visible ? "rotate-90" : ""
            }`}
          />
          <span className="band-label mb-0">{title}</span>
        </button>
      ) : (
        <p className="band-label mb-1">{title}</p>
      )}
      {visible ? children : null}
    </div>
  );
}

export function HasteMasterDesk({ hastes }: { hastes: HasteRecord[] }) {
  const [rows, setRows] = useState<LocalHaste[]>(() => hastes.map(toLocal));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<LocalHaste | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);

  useEffect(() => {
    setRows(hastes.map(toLocal));
  }, [hastes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.hasteName.toLowerCase().includes(q));
  }, [query, rows]);

  function patch(partial: Partial<LocalHaste>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function openCreate() {
    setDraft(blankHaste());
    setMode("create");
    setError(null);
    setTaxOpen(false);
  }

  function openEdit(row: LocalHaste) {
    setDraft({ ...row });
    setMode("edit");
    setError(null);
    setTaxOpen(false);
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

  function validate(entry: LocalHaste) {
    if (!entry.hasteName.trim()) return "Enter haste name.";
    if (entry.email.trim() && !emailLooksValid(entry.email)) {
      return "Enter a valid email ID.";
    }
    return null;
  }

  async function saveHaste() {
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
          ? await createHaste(toInput(draft))
          : await updateHaste(draft.id, toInput(draft));
      const local = toLocal(saved);
      setRows((prev) =>
        mode === "create"
          ? [local, ...prev]
          : prev.map((row) => (row.id === local.id ? local : row)),
      );
      closeModal();
      setNotice(
        mode === "create"
          ? `${local.hasteName} saved.`
          : `${local.hasteName} updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save haste.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Haste"
        eyebrow="Masters"
        icon={MapPin}
        description="Consignee / shipping destinations. Sales Bill link comes later."
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add Haste
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
        <Metric label="Total hastes" value={rows.length} />
        <Metric
          label="With GSTIN"
          value={rows.filter((row) => row.gstin.trim()).length}
          tone="accent"
        />
        <Metric
          label="With city"
          value={rows.filter((row) => row.cityName.trim()).length}
        />
      </MetricStrip>

      <Panel
        title="Haste"
        flush
        action={
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
            <input
              className={`${inputClass} w-56`}
              placeholder="Search haste name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={MapPin} text="No haste records." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Haste Name</th>
                  <th>Receiver Name</th>
                  <th>City</th>
                  <th>Mobile</th>
                  <th>GSTIN</th>
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
                    <td className="font-medium">{row.hasteName}</td>
                    <td>{row.receiverName || "—"}</td>
                    <td>{row.cityName || "—"}</td>
                    <td className="tabular-nums">{row.mobile || "—"}</td>
                    <td>{row.gstin || "—"}</td>
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
          title={mode === "create" ? "New Haste" : "Edit Haste"}
          onClose={unsaved.requestClose}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-2">
              {error ? (
                <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                  {error}
                </p>
              ) : null}

              <FormSection title="Basic details">
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Haste Name" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.hasteName}
                      onChange={(e) => patch({ hasteName: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Contact / address">
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Receiver Name">
                    <input
                      className={inputClass}
                      value={draft.receiverName}
                      onChange={(e) => patch({ receiverName: e.target.value })}
                    />
                  </Field>
                  <Field label="City Name">
                    <input
                      className={inputClass}
                      value={draft.cityName}
                      onChange={(e) => patch({ cityName: e.target.value })}
                    />
                  </Field>
                  <Field label="Distance">
                    <input
                      className={inputClass}
                      value={draft.distance}
                      onChange={(e) => patch({ distance: e.target.value })}
                    />
                  </Field>
                  <Field label="Manager">
                    <input
                      className={inputClass}
                      value={draft.manager}
                      onChange={(e) => patch({ manager: e.target.value })}
                    />
                  </Field>
                  <Field label="Address" className="col-span-4">
                    <textarea
                      className={inputClass}
                      rows={1}
                      value={draft.address}
                      onChange={(e) => patch({ address: e.target.value })}
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
                  <Field label="Mobile No.">
                    <input
                      className={inputClass}
                      value={draft.mobile}
                      inputMode="tel"
                      onChange={(e) => patch({ mobile: e.target.value })}
                    />
                  </Field>
                  <Field label="Fax No.">
                    <input
                      className={inputClass}
                      value={draft.fax}
                      onChange={(e) => patch({ fax: e.target.value })}
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
                  <Field label="Resident No.">
                    <input
                      className={inputClass}
                      value={draft.residentNo}
                      onChange={(e) => patch({ residentNo: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Tax / registration"
                collapsible
                open={taxOpen}
                onToggle={() => setTaxOpen((prev) => !prev)}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="KST No.">
                    <input
                      className={inputClass}
                      value={draft.kstNo}
                      onChange={(e) => patch({ kstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Gujarat State">
                    <input
                      className={inputClass}
                      value={draft.gujaratState}
                      onChange={(e) => patch({ gujaratState: e.target.value })}
                    />
                  </Field>
                  <Field label="CST No.">
                    <input
                      className={inputClass}
                      value={draft.cstNo}
                      onChange={(e) => patch({ cstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Transport">
                    <input
                      className={inputClass}
                      value={draft.transport}
                      onChange={(e) => patch({ transport: e.target.value })}
                    />
                  </Field>
                  <Field label="TIN No.">
                    <input
                      className={inputClass}
                      value={draft.tinNo}
                      onChange={(e) => patch({ tinNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Policy No.">
                    <input
                      className={inputClass}
                      value={draft.policyNo}
                      onChange={(e) => patch({ policyNo: e.target.value })}
                    />
                  </Field>
                  <Field label="PAN No.">
                    <input
                      className={inputClass}
                      value={draft.panNo}
                      onChange={(e) => patch({ panNo: e.target.value })}
                    />
                  </Field>
                  <Field label="GSTIN">
                    <input
                      className={inputClass}
                      value={draft.gstin}
                      onChange={(e) => patch({ gstin: e.target.value })}
                    />
                  </Field>
                  <Field label="Composite No.">
                    <input
                      className={inputClass}
                      value={draft.compositeNo}
                      onChange={(e) => patch({ compositeNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Registration Date">
                    <input
                      className={inputClass}
                      type="date"
                      value={draft.registrationDate}
                      onChange={(e) =>
                        patch({ registrationDate: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>
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
                onClick={() => void saveHaste()}
              >
                {mode === "create" ? "Save Haste" : "Update Haste"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
