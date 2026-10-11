"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import { ErpModal as Overlay } from "@/components/erp-modal";
import { useUnsavedClose } from "@/components/unsaved-changes";
import { statusBadge } from "@/lib/format";
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
import { type LocalMill } from "@/lib/local-workflow";
import {
  createMill,
  updateMill,
  type MillInput,
  type MillRecord,
} from "@/server/actions/mills";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function blankMill(): LocalMill {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    millName: "",
    accountType: "",
    group: "",
    agent: "",
    gstin: "",
    compositeNo: "",
    ecoSgstin: "",
    registrationDate: "",
    receiverName: "",
    address: "",
    cityName: "",
    distance: "",
    phone: "",
    mobile: "",
    fax: "",
    email: "",
    residentNo: "",
    address2: "",
    cityName2: "",
    manager: "",
    creditLimit: "",
    creditDays: "",
    references: "",
    openingBalance: "",
    crDr: "",
    tds: "",
    tdsAccount: "",
    tdsLimit: "",
    dob: "",
    panNo: "",
    tanNo: "",
    kstNo: "",
    cstNo: "",
    gujaratState: "",
    tinNo: "",
    transName: "",
    discountPercentage: "",
    rdPcs: "",
    mts: "",
    commissionPercentage: "",
    bankDetail: "",
    bankName: "",
    accountNo: "",
    ifscCode: "",
    branch: "",
    udyamNo: "",
    enterpriseType: "",
    enterpriseActivity: "",
    tcsApplicable: false,
    payment: "",
    blackListed: false,
    masterType: "MILL",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeMill(raw: unknown): LocalMill {
  const row = (raw && typeof raw === "object" ? raw : {}) as Partial<LocalMill> & {
    city?: string;
  };
  const base = blankMill();
  const crDr = row.crDr === "CR" || row.crDr === "DR" ? row.crDr : "";
  return {
    ...base,
    id: text(row.id) || base.id,
    millName: text(row.millName),
    accountType: text(row.accountType),
    group: text(row.group),
    agent: text(row.agent),
    gstin: text(row.gstin),
    compositeNo: text(row.compositeNo),
    ecoSgstin: text(row.ecoSgstin),
    registrationDate: text(row.registrationDate),
    receiverName: text(row.receiverName),
    address: text(row.address),
    cityName: text(row.cityName) || text(row.city),
    distance: text(row.distance),
    phone: text(row.phone),
    mobile: text(row.mobile),
    fax: text(row.fax),
    email: text(row.email),
    residentNo: text(row.residentNo),
    address2: text(row.address2),
    cityName2: text(row.cityName2),
    manager: text(row.manager),
    creditLimit: text(row.creditLimit),
    creditDays: text(row.creditDays),
    references: text(row.references),
    openingBalance: text(row.openingBalance),
    crDr,
    tds: text(row.tds),
    tdsAccount: text(row.tdsAccount),
    tdsLimit: text(row.tdsLimit),
    dob: text(row.dob),
    panNo: text(row.panNo),
    tanNo: text(row.tanNo),
    kstNo: text(row.kstNo),
    cstNo: text(row.cstNo),
    gujaratState: text(row.gujaratState),
    tinNo: text(row.tinNo),
    transName: text(row.transName),
    discountPercentage: text(row.discountPercentage),
    rdPcs: text(row.rdPcs),
    mts: text(row.mts),
    commissionPercentage: text(row.commissionPercentage),
    bankDetail: text(row.bankDetail),
    bankName: text(row.bankName),
    accountNo: text(row.accountNo),
    ifscCode: text(row.ifscCode),
    branch: text(row.branch),
    udyamNo: text(row.udyamNo),
    enterpriseType: text(row.enterpriseType),
    enterpriseActivity: text(row.enterpriseActivity),
    tcsApplicable: row.tcsApplicable === true,
    payment: text(row.payment),
    blackListed: row.blackListed === true,
    masterType: "MILL",
    createdAt: text(row.createdAt) || base.createdAt,
    updatedAt: text(row.updatedAt) || base.updatedAt,
  };
}

function toLocal(row: MillRecord): LocalMill {
  return row;
}

function toInput(entry: LocalMill): MillInput {
  return {
    millName: entry.millName,
    accountType: entry.accountType,
    group: entry.group,
    agent: entry.agent,
    gstin: entry.gstin,
    compositeNo: entry.compositeNo,
    ecoSgstin: entry.ecoSgstin,
    registrationDate: entry.registrationDate,
    receiverName: entry.receiverName,
    address: entry.address,
    cityName: entry.cityName,
    distance: entry.distance,
    phone: entry.phone,
    mobile: entry.mobile,
    fax: entry.fax,
    email: entry.email,
    residentNo: entry.residentNo,
    address2: entry.address2,
    cityName2: entry.cityName2,
    manager: entry.manager,
    creditLimit: entry.creditLimit,
    creditDays: entry.creditDays,
    references: entry.references,
    openingBalance: entry.openingBalance,
    crDr: entry.crDr,
    tds: entry.tds,
    tdsAccount: entry.tdsAccount,
    tdsLimit: entry.tdsLimit,
    dob: entry.dob,
    panNo: entry.panNo,
    tanNo: entry.tanNo,
    kstNo: entry.kstNo,
    cstNo: entry.cstNo,
    gujaratState: entry.gujaratState,
    tinNo: entry.tinNo,
    transName: entry.transName,
    discountPercentage: entry.discountPercentage,
    rdPcs: entry.rdPcs,
    mts: entry.mts,
    commissionPercentage: entry.commissionPercentage,
    bankDetail: entry.bankDetail,
    bankName: entry.bankName,
    accountNo: entry.accountNo,
    ifscCode: entry.ifscCode,
    branch: entry.branch,
    udyamNo: entry.udyamNo,
    enterpriseType: entry.enterpriseType,
    enterpriseActivity: entry.enterpriseActivity,
    tcsApplicable: entry.tcsApplicable,
    payment: entry.payment,
    blackListed: entry.blackListed,
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
    <section className="min-w-0">
      {collapsible ? (
        <button
          type="button"
          className="mb-2 flex items-center gap-1.5"
          onClick={onToggle}
          aria-expanded={visible}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-(--muted) transition ${
              visible ? "rotate-90" : ""
            }`}
          />
          <span className="text-[13px] font-semibold text-(--ink)">{title}</span>
        </button>
      ) : (
        <h3 className="mb-2 border-b border-(--line) pb-1 text-[13px] font-semibold text-(--ink)">
          {title}
        </h3>
      )}
      <div className={visible ? "min-w-0" : "hidden"}>{children}</div>
    </section>
  );
}

const formGrid =
  "grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-4";
const controlClass = `${inputClass} !h-9 !py-0`;
const areaClass = `${inputClass} max-h-24 min-h-9 resize-y py-1.5`;

export function MillMasterDesk({ mills }: { mills: MillRecord[] }) {
  const [rows, setRows] = useState<LocalMill[]>(() => mills.map(toLocal));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<LocalMill | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openExtra, setOpenExtra] = useState({
    contact: false,
    statutory: false,
    commercial: false,
    status: false,
  });

  useEffect(() => {
    setRows(mills.map(toLocal));
  }, [mills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.millName.toLowerCase().includes(q));
  }, [query, rows]);

  function patch(partial: Partial<LocalMill>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function resetSections() {
    setOpenExtra({
      contact: false,
      statutory: false,
      commercial: false,
      status: false,
    });
  }

  function toggleSection(key: keyof typeof openExtra) {
    setOpenExtra((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openCreate() {
    setDraft(blankMill());
    setMode("create");
    setError(null);
    resetSections();
  }

  function openEdit(row: LocalMill) {
    setDraft(normalizeMill(row));
    setMode("edit");
    setError(null);
    resetSections();
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

  function validate(entry: LocalMill) {
    if (!entry.millName.trim()) return "Enter mill name.";
    if (entry.email.trim() && !emailLooksValid(entry.email)) {
      return "Enter a valid email ID.";
    }
    if (
      entry.registrationDate &&
      Number.isNaN(Date.parse(entry.registrationDate))
    ) {
      return "Enter a valid registration date.";
    }
    if (entry.dob && Number.isNaN(Date.parse(entry.dob))) {
      return "Enter a valid date of birth.";
    }
    return null;
  }

  async function saveMill() {
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
          ? await createMill(toInput(draft))
          : await updateMill(draft.id, toInput(draft));
      const local = toLocal(saved);
      setRows((prev) =>
        mode === "create"
          ? [local, ...prev]
          : prev.map((row) => (row.id === local.id ? local : row)),
      );
      closeModal();
      setNotice(
        mode === "create"
          ? `${local.millName} saved.`
          : `${local.millName} updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save mill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Mill"
        eyebrow="Masters"
        icon={Building2}
        description="Processing mills where grey is sent for finishing."
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add Mill
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
        <Metric label="Total mills" value={rows.length} />
        <Metric
          label="Active"
          value={rows.filter((row) => !row.blackListed).length}
          tone="accent"
        />
        <Metric
          label="Black listed"
          value={rows.filter((row) => row.blackListed).length}
          tone={rows.some((row) => row.blackListed) ? "warn" : "neutral"}
        />
      </MetricStrip>

      <Panel
        title="Mills"
        flush
        action={
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
            <input
              className={`${inputClass} w-56`}
              placeholder="Search mill name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={Building2} text="No mill records." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Mill Name</th>
                  <th>Mobile</th>
                  <th>City</th>
                  <th>GSTIN</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer hover:bg-(--panel-sunken) ${
                      row.blackListed ? "opacity-70" : ""
                    }`}
                    onClick={() => openEdit(row)}
                  >
                    <td className="font-medium">{row.millName}</td>
                    <td className="tabular-nums">{row.mobile || "—"}</td>
                    <td>{row.cityName || "—"}</td>
                    <td className="tabular-nums">{row.gstin || "—"}</td>
                    <td>
                      {row.blackListed ? (
                        <span className={statusBadge("MEDIUM")}>
                          Black Listed
                        </span>
                      ) : (
                        <span className={statusBadge("OPEN")}>Active</span>
                      )}
                    </td>
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
          title={mode === "create" ? "New Mill" : "Edit Mill"}
          onClose={unsaved.requestClose}
          flushBody
          frameWidthClass="max-h-[calc(100%-4rem)] min-h-0 w-[min(1360px,calc(100%-8vw))] max-w-[calc(100%-8vw)]"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-4">
              {error ? (
                <p className="rounded-md border border-(--danger)/40 bg-(--danger-soft) px-2 py-1.5 text-[11px] text-(--danger)">
                  {error}
                </p>
              ) : null}

              <FormSection title="Basic">
                <div className={formGrid}>
                  <Field label="Mill Name" className="sm:col-span-2 xl:col-span-3">
                    <input
                      className={controlClass}
                      value={draft.millName}
                      required
                      onChange={(e) => patch({ millName: e.target.value })}
                    />
                  </Field>
                  <Field label="Agent">
                    <input
                      className={controlClass}
                      value={draft.agent}
                      onChange={(e) => patch({ agent: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Registration and Contact">
                <div className={formGrid}>
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
                  <Field label="Receiver Name" className="sm:col-span-2">
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
                  <Field label="Phone No.">
                    <input
                      className={controlClass}
                      value={draft.phone}
                      inputMode="tel"
                      onChange={(e) => patch({ phone: e.target.value })}
                    />
                  </Field>
                  <Field label="City Name">
                    <input
                      className={controlClass}
                      value={draft.cityName}
                      onChange={(e) => patch({ cityName: e.target.value })}
                    />
                  </Field>
                  <Field label="PAN No.">
                    <input
                      className={controlClass}
                      value={draft.panNo}
                      onChange={(e) => patch({ panNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Address" className="sm:col-span-2 xl:col-span-3">
                    <textarea
                      className={areaClass}
                      rows={2}
                      value={draft.address}
                      onChange={(e) => patch({ address: e.target.value })}
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
                </div>
              </FormSection>

              <FormSection title="Bank Details">
                <div className={formGrid}>
                  <Field label="Bank Detail" className="sm:col-span-2">
                    <input
                      className={controlClass}
                      value={draft.bankDetail}
                      onChange={(e) => patch({ bankDetail: e.target.value })}
                    />
                  </Field>
                  <Field label="Bank Name" className="sm:col-span-2">
                    <input
                      className={controlClass}
                      value={draft.bankName}
                      onChange={(e) => patch({ bankName: e.target.value })}
                    />
                  </Field>
                  <Field label="A/C No.">
                    <input
                      className={controlClass}
                      value={draft.accountNo}
                      onChange={(e) => patch({ accountNo: e.target.value })}
                    />
                  </Field>
                  <Field label="IFSC Code">
                    <input
                      className={controlClass}
                      value={draft.ifscCode}
                      onChange={(e) => patch({ ifscCode: e.target.value })}
                    />
                  </Field>
                  <Field label="Branch" className="sm:col-span-2">
                    <input
                      className={controlClass}
                      value={draft.branch}
                      onChange={(e) => patch({ branch: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="MSME Details">
                <div className={formGrid}>
                  <Field
                    label="Udyam Registration Number"
                    className="sm:col-span-2"
                  >
                    <input
                      className={controlClass}
                      value={draft.udyamNo}
                      onChange={(e) => patch({ udyamNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Enterprise Type">
                    <input
                      className={controlClass}
                      value={draft.enterpriseType}
                      onChange={(e) =>
                        patch({ enterpriseType: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Enterprise Activity">
                    <input
                      className={controlClass}
                      value={draft.enterpriseActivity}
                      onChange={(e) =>
                        patch({ enterpriseActivity: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Accounting and Payment">
                <div className={formGrid}>
                  <Field label="Opening Balance">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.openingBalance}
                      inputMode="decimal"
                      onChange={(e) =>
                        patch({ openingBalance: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Cr. / Dr.">
                    <select
                      className={controlClass}
                      value={draft.crDr}
                      onChange={(e) =>
                        patch({ crDr: e.target.value as "" | "CR" | "DR" })
                      }
                    >
                      <option value="">Select</option>
                      <option value="CR">Cr.</option>
                      <option value="DR">Dr.</option>
                    </select>
                  </Field>
                  <Field label="TDS">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.tds}
                      inputMode="decimal"
                      onChange={(e) => patch({ tds: e.target.value })}
                    />
                  </Field>
                  <Field label="TDS Limit">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.tdsLimit}
                      inputMode="decimal"
                      onChange={(e) => patch({ tdsLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="TDS A/c">
                    <input
                      className={controlClass}
                      value={draft.tdsAccount}
                      onChange={(e) => patch({ tdsAccount: e.target.value })}
                    />
                  </Field>
                  <Field label="Payment">
                    <input
                      className={controlClass}
                      value={draft.payment}
                      onChange={(e) => patch({ payment: e.target.value })}
                    />
                  </Field>
                  <Field label="Credit Limit">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.creditLimit}
                      inputMode="decimal"
                      onChange={(e) => patch({ creditLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="Credit Days">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.creditDays}
                      inputMode="numeric"
                      onChange={(e) => patch({ creditDays: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Additional Contact / Address"
                collapsible
                open={openExtra.contact}
                onToggle={() => toggleSection("contact")}
              >
                <div className={formGrid}>
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
                  <Field label="City Name 2">
                    <input
                      className={controlClass}
                      value={draft.cityName2}
                      onChange={(e) => patch({ cityName2: e.target.value })}
                    />
                  </Field>
                  <Field label="DOB">
                    <input
                      className={controlClass}
                      type="date"
                      value={draft.dob}
                      onChange={(e) => patch({ dob: e.target.value })}
                    />
                  </Field>
                  <Field label="Address 2" className="sm:col-span-2">
                    <textarea
                      className={areaClass}
                      rows={2}
                      value={draft.address2}
                      onChange={(e) => patch({ address2: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Other Tax Identification"
                collapsible
                open={openExtra.statutory}
                onToggle={() => toggleSection("statutory")}
              >
                <div className={formGrid}>
                  <Field label="Composite No.">
                    <input
                      className={controlClass}
                      value={draft.compositeNo}
                      onChange={(e) => patch({ compositeNo: e.target.value })}
                    />
                  </Field>
                  <Field label="ECO/SGSTIN">
                    <input
                      className={controlClass}
                      value={draft.ecoSgstin}
                      onChange={(e) => patch({ ecoSgstin: e.target.value })}
                    />
                  </Field>
                  <Field label="TAN No.">
                    <input
                      className={controlClass}
                      value={draft.tanNo}
                      onChange={(e) => patch({ tanNo: e.target.value })}
                    />
                  </Field>
                  <Field label="KST No.">
                    <input
                      className={controlClass}
                      value={draft.kstNo}
                      onChange={(e) => patch({ kstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="CST No.">
                    <input
                      className={controlClass}
                      value={draft.cstNo}
                      onChange={(e) => patch({ cstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Gujarat State">
                    <input
                      className={controlClass}
                      value={draft.gujaratState}
                      onChange={(e) => patch({ gujaratState: e.target.value })}
                    />
                  </Field>
                  <Field label="TIN No.">
                    <input
                      className={controlClass}
                      value={draft.tinNo}
                      onChange={(e) => patch({ tinNo: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Commercial"
                collapsible
                open={openExtra.commercial}
                onToggle={() => toggleSection("commercial")}
              >
                <div className={formGrid}>
                  <Field label="Trans-Name">
                    <input
                      className={controlClass}
                      value={draft.transName}
                      onChange={(e) => patch({ transName: e.target.value })}
                    />
                  </Field>
                  <Field label="Disc. Perc.">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.discountPercentage}
                      inputMode="decimal"
                      onChange={(e) =>
                        patch({ discountPercentage: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="R.D. / Pcs">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.rdPcs}
                      inputMode="decimal"
                      onChange={(e) => patch({ rdPcs: e.target.value })}
                    />
                  </Field>
                  <Field label="Mts">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.mts}
                      inputMode="decimal"
                      onChange={(e) => patch({ mts: e.target.value })}
                    />
                  </Field>
                  <Field label="Comm. Perc.">
                    <input
                      className={`${controlClass} text-right`}
                      value={draft.commissionPercentage}
                      inputMode="decimal"
                      onChange={(e) =>
                        patch({ commissionPercentage: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="References and Status"
                collapsible
                open={openExtra.status}
                onToggle={() => toggleSection("status")}
              >
                <div className={formGrid}>
                  <Field label="Group">
                    <input
                      className={controlClass}
                      value={draft.group}
                      onChange={(e) => patch({ group: e.target.value })}
                    />
                  </Field>
                  <Field label="Master Type">
                    <p className="flex h-9 items-center text-[13px] font-semibold">
                      MILL
                    </p>
                  </Field>
                  <Field label="References" className="sm:col-span-2">
                    <textarea
                      className={areaClass}
                      rows={2}
                      value={draft.references}
                      onChange={(e) => patch({ references: e.target.value })}
                    />
                  </Field>
                  <Field label="TCS Applicable">
                    <label className="flex h-9 items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={draft.tcsApplicable}
                        onChange={(e) =>
                          patch({ tcsApplicable: e.target.checked })
                        }
                      />
                      Applicable
                    </label>
                  </Field>
                  <Field label="Black Listed">
                    <label className="flex h-9 items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={draft.blackListed}
                        onChange={(e) =>
                          patch({ blackListed: e.target.checked })
                        }
                      />
                      Mark as black listed
                    </label>
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
                onClick={() => void saveMill()}
              >
                {mode === "create" ? "Save Mill" : "Update Mill"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
