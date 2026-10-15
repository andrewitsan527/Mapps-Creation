"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MapPin, Plus, Search, X } from "lucide-react";
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
    <section className="ms-block">
      {collapsible ? (
        <button
          type="button"
          className="ms-block-head ms-block-toggle"
          onClick={onToggle}
          aria-expanded={visible}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 transition ${
              visible ? "rotate-90" : ""
            }`}
          />
          <span>{title}</span>
        </button>
      ) : (
        <p className="ms-block-head">{title}</p>
      )}
      <div className={visible ? "ms-block-body" : "hidden"}>{children}</div>
    </section>
  );
}

const formGrid = "ms-grid";
const controlClass = inputClass;
const areaClass = `${inputClass} max-h-24 min-h-9 resize-y py-1.5`;

export function HasteMasterDesk({ hastes }: { hastes: HasteRecord[] }) {
  const [rows, setRows] = useState<LocalHaste[]>(() => hastes.map(toLocal));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<LocalHaste | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openExtra, setOpenExtra] = useState({
    contact: false,
    tax: false,
  });

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
    setOpenExtra({ contact: false, tax: false });
  }

  function openEdit(row: LocalHaste) {
    setDraft({ ...row });
    setMode("edit");
    setError(null);
    setOpenExtra({ contact: false, tax: false });
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
        className="ms-panel"
        action={
          <div className="ms-bar-tools">
            <label className="aw-search">
              <span className="sr-only">Search haste name</span>
              <input
                value={query}
                placeholder="Search haste name"
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
            Add Haste
          </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={MapPin} text="No haste records." />
          </div>
        ) : (
          <TableWrap maxHeight={false}>
            <table className="erp-table erp-register ms-reg w-full">
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
                {filtered.length > 0 ? (
                  <tr className="ms-filler" aria-hidden>
                    <td />
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
          title={mode === "create" ? "New Haste" : "Edit Haste"}
          onClose={unsaved.requestClose}
          flushBody
          frameWidthClass="ms-sheet ms-sheet-md max-h-[calc(100%-4rem)] min-h-0"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="ms-form ms-form-fill">
              {error ? (
                <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                  {error}
                </p>
              ) : null}

              <FormSection title="Basic Details">
                <div className={formGrid}>
                  <Field
                    label="Haste Name"
                    className="ms-span-2"
                  >
                    <input
                      className={controlClass}
                      autoFocus
                      value={draft.hasteName}
                      required
                      onChange={(e) => patch({ hasteName: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Contact / Address">
                <div className={formGrid}>
                  <Field label="Receiver Name" className="ms-span-2">
                    <input
                      className={controlClass}
                      value={draft.receiverName}
                      onChange={(e) => patch({ receiverName: e.target.value })}
                    />
                  </Field>
                  <Field label="Mobile No.">
                    <input
                      className={controlClass}
                      value={draft.mobile}
                      inputMode="tel"
                      onChange={(e) => patch({ mobile: e.target.value })}
                    />
                  </Field>
                  <Field label="City Name">
                    <input
                      className={controlClass}
                      value={draft.cityName}
                      onChange={(e) => patch({ cityName: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Address"
                    className="ms-span-2"
                  >
                    <textarea
                      className={areaClass}
                      rows={2}
                      value={draft.address}
                      onChange={(e) => patch({ address: e.target.value })}
                    />
                  </Field>
                  <Field label="GSTIN">
                    <input
                      className={controlClass}
                      value={draft.gstin}
                      onChange={(e) => patch({ gstin: e.target.value })}
                    />
                  </Field>
                  <Field label="Registration Date">
                    <input
                      className={controlClass}
                      type="date"
                      value={draft.registrationDate}
                      onChange={(e) =>
                        patch({ registrationDate: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Transport">
                <div className={formGrid}>
                  <Field label="Transport" className="ms-span-2">
                    <input
                      className={controlClass}
                      value={draft.transport}
                      onChange={(e) => patch({ transport: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Additional Contact Details"
                collapsible
                open={openExtra.contact}
                onToggle={() =>
                  setOpenExtra((prev) => ({ ...prev, contact: !prev.contact }))
                }
              >
                <div className={formGrid}>
                  <Field label="Phone No.">
                    <input
                      className={controlClass}
                      value={draft.phone}
                      inputMode="tel"
                      onChange={(e) => patch({ phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Distance">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.distance}
                      inputMode="decimal"
                      onChange={(e) => patch({ distance: e.target.value })}
                    />
                  </Field>
                  <Field label="Manager">
                    <input
                      className={controlClass}
                      value={draft.manager}
                      onChange={(e) => patch({ manager: e.target.value })}
                    />
                  </Field>
                  <Field label="Fax No.">
                    <input
                      className={controlClass}
                      value={draft.fax}
                      onChange={(e) => patch({ fax: e.target.value })}
                    />
                  </Field>
                  <Field label="Email ID">
                    <input
                      className={controlClass}
                      type="email"
                      value={draft.email}
                      onChange={(e) => patch({ email: e.target.value })}
                    />
                  </Field>
                  <Field label="Resident No.">
                    <input
                      className={controlClass}
                      value={draft.residentNo}
                      onChange={(e) => patch({ residentNo: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Additional Tax / Registration Details"
                collapsible
                open={openExtra.tax}
                onToggle={() =>
                  setOpenExtra((prev) => ({ ...prev, tax: !prev.tax }))
                }
              >
                <div className={formGrid}>
                  <Field label="KST No.">
                    <input
                      className={controlClass}
                      value={draft.kstNo}
                      onChange={(e) => patch({ kstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Gujarat State">
                    <input
                      className={controlClass}
                      value={draft.gujaratState}
                      onChange={(e) => patch({ gujaratState: e.target.value })}
                    />
                  </Field>
                  <Field label="CST No.">
                    <input
                      className={controlClass}
                      value={draft.cstNo}
                      onChange={(e) => patch({ cstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="TIN No.">
                    <input
                      className={controlClass}
                      value={draft.tinNo}
                      onChange={(e) => patch({ tinNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Policy No.">
                    <input
                      className={controlClass}
                      value={draft.policyNo}
                      onChange={(e) => patch({ policyNo: e.target.value })}
                    />
                  </Field>
                  <Field label="PAN No.">
                    <input
                      className={controlClass}
                      value={draft.panNo}
                      onChange={(e) => patch({ panNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Composite No.">
                    <input
                      className={controlClass}
                      value={draft.compositeNo}
                      onChange={(e) => patch({ compositeNo: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>
            </div>

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
                onClick={() => void saveHaste()}
              >
                {mode === "create" ? "Save Haste" : "Update Haste"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
      </div>
    </div>
  );
}
