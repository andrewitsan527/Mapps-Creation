"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Hammer, Plus, Search } from "lucide-react";
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
import { type LocalJob } from "@/lib/local-workflow";
import {
  createJob,
  updateJob,
  type JobInput,
  type JobRecord,
} from "@/server/actions/jobs";

const ACCOUNT_TYPES = ["Sundry Debtors", "Sundry Creditors", "Other"] as const;

/** Placeholder options — replace after client confirmation. */
const JOB_TYPES = ["Job Work"] as const;

function blankJob(): LocalJob {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    accountName: "",
    accountType: "",
    group: "",
    agent: "",
    salesman: "",
    gstin: "",
    compositeNo: "",
    ecoSgstin: "",
    registrationDate: "",
    panNo: "",
    tanNo: "",
    kstNo: "",
    cstNo: "",
    gujaratState: "",
    tinNo: "",
    policyNo: "",
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
    creditDebit: "",
    tds: "",
    tdsAccount: "",
    tdsLimit: "",
    dob: "",
    transName: "",
    discountPercent: "",
    rdPcs: "",
    mts: "",
    commissionPercent: "",
    bankDetail: "",
    bankName: "",
    accountNo: "",
    ifscCode: "",
    branch: "",
    udyamRegNo: "",
    enterpriseType: "",
    enterpriseActivity: "",
    jobType: "",
    blackListed: false,
    masterType: "JOB",
    createdAt: now,
    updatedAt: now,
  };
}

function toLocal(row: JobRecord): LocalJob {
  return row;
}

function toInput(entry: LocalJob): JobInput {
  return {
    accountName: entry.accountName,
    accountType: entry.accountType,
    group: entry.group,
    agent: entry.agent,
    salesman: entry.salesman,
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
    cityName2: entry.cityName2,
    address2: entry.address2,
    gstin: entry.gstin,
    compositeNo: entry.compositeNo,
    ecoSgstin: entry.ecoSgstin,
    registrationDate: entry.registrationDate,
    panNo: entry.panNo,
    tanNo: entry.tanNo,
    kstNo: entry.kstNo,
    cstNo: entry.cstNo,
    gujaratState: entry.gujaratState,
    tinNo: entry.tinNo,
    policyNo: entry.policyNo,
    creditLimit: entry.creditLimit,
    creditDays: entry.creditDays,
    openingBalance: entry.openingBalance,
    creditDebit: entry.creditDebit,
    tds: entry.tds,
    tdsAccount: entry.tdsAccount,
    tdsLimit: entry.tdsLimit,
    dob: entry.dob,
    references: entry.references,
    transName: entry.transName,
    discountPercent: entry.discountPercent,
    rdPcs: entry.rdPcs,
    mts: entry.mts,
    commissionPercent: entry.commissionPercent,
    bankDetail: entry.bankDetail,
    bankName: entry.bankName,
    accountNo: entry.accountNo,
    ifscCode: entry.ifscCode,
    branch: entry.branch,
    udyamRegNo: entry.udyamRegNo,
    enterpriseType: entry.enterpriseType,
    enterpriseActivity: entry.enterpriseActivity,
    jobType: entry.jobType,
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

export function JobMasterDesk({ jobs }: { jobs: JobRecord[] }) {
  const [rows, setRows] = useState<LocalJob[]>(() => jobs.map(toLocal));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<LocalJob | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openExtra, setOpenExtra] = useState({
    tax: false,
    credit: false,
    commercial: false,
    bank: false,
    msme: false,
    job: false,
    status: false,
  });

  useEffect(() => {
    setRows(jobs.map(toLocal));
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.accountName.toLowerCase().includes(q));
  }, [query, rows]);

  function resetSections() {
    setOpenExtra({
      tax: false,
      credit: false,
      commercial: false,
      bank: false,
      msme: false,
      job: false,
      status: false,
    });
  }

  function toggleSection(key: keyof typeof openExtra) {
    setOpenExtra((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function patch(partial: Partial<LocalJob>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setError(null);
  }

  function openCreate() {
    setDraft(blankJob());
    setMode("create");
    setError(null);
    resetSections();
  }

  function openEdit(row: LocalJob) {
    setDraft({ ...row });
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

  function validate(entry: LocalJob) {
    if (!entry.accountName.trim()) return "Enter account name.";
    if (entry.email.trim() && !emailLooksValid(entry.email)) {
      return "Enter a valid email ID.";
    }
    return null;
  }

  async function saveJob() {
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
          ? await createJob(toInput(draft))
          : await updateJob(draft.id, toInput(draft));
      const local = toLocal(saved);
      setRows((prev) =>
        mode === "create"
          ? [local, ...prev]
          : prev.map((row) => (row.id === local.id ? local : row)),
      );
      closeModal();
      setNotice(
        mode === "create"
          ? `${local.accountName} saved.`
          : `${local.accountName} updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save job.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Job Master"
        eyebrow="Masters"
        icon={Hammer}
        description="Initial job accounts — fields will be confirmed with the client."
        actions={
          <button className={buttonClass} type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add Job
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
        <Metric label="Total jobs" value={rows.length} />
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
        title="Job Master"
        flush
        action={
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--muted)" />
            <input
              className={`${inputClass} w-56`}
              placeholder="Search account name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="p-2.5">
            <EmptyState icon={Hammer} text="No job master records." />
          </div>
        ) : (
          <TableWrap>
            <table className="erp-table erp-register">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Job Type</th>
                  <th>Phone No.</th>
                  <th>City</th>
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
                    <td className="font-medium">{row.accountName}</td>
                    <td>{row.jobType || "—"}</td>
                    <td className="tabular-nums">{row.phone || "—"}</td>
                    <td>{row.cityName || "—"}</td>
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
          title={mode === "create" ? "New Job" : "Edit Job"}
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
                  <Field label="Account Name">
                    <input
                      className={inputClass}
                      value={draft.accountName}
                      onChange={(e) => patch({ accountName: e.target.value })}
                    />
                  </Field>
                  <Field label="Account Type">
                    <select
                      className={inputClass}
                      value={draft.accountType}
                      onChange={(e) => patch({ accountType: e.target.value })}
                    >
                      <option value="">Select</option>
                      {ACCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Group">
                    <input
                      className={inputClass}
                      value={draft.group}
                      onChange={(e) => patch({ group: e.target.value })}
                    />
                  </Field>
                  <Field label="Agent">
                    <input
                      className={inputClass}
                      value={draft.agent}
                      onChange={(e) => patch({ agent: e.target.value })}
                    />
                  </Field>
                  <Field label="Salesman">
                    <input
                      className={inputClass}
                      value={draft.salesman}
                      onChange={(e) => patch({ salesman: e.target.value })}
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
                  <Field label="City Name 2">
                    <input
                      className={inputClass}
                      value={draft.cityName2}
                      onChange={(e) => patch({ cityName2: e.target.value })}
                    />
                  </Field>
                  <Field label="Address 2" className="col-span-4">
                    <textarea
                      className={inputClass}
                      rows={1}
                      value={draft.address2}
                      onChange={(e) => patch({ address2: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Tax / registration"
                collapsible
                open={openExtra.tax}
                onToggle={() => toggleSection("tax")}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
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
                  <Field label="ECO/SGSTIN">
                    <input
                      className={inputClass}
                      value={draft.ecoSgstin}
                      onChange={(e) => patch({ ecoSgstin: e.target.value })}
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
                  <Field label="PAN No.">
                    <input
                      className={inputClass}
                      value={draft.panNo}
                      onChange={(e) => patch({ panNo: e.target.value })}
                    />
                  </Field>
                  <Field label="TAN No.">
                    <input
                      className={inputClass}
                      value={draft.tanNo}
                      onChange={(e) => patch({ tanNo: e.target.value })}
                    />
                  </Field>
                  <Field label="KST No.">
                    <input
                      className={inputClass}
                      value={draft.kstNo}
                      onChange={(e) => patch({ kstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="CST No.">
                    <input
                      className={inputClass}
                      value={draft.cstNo}
                      onChange={(e) => patch({ cstNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Gujarat State">
                    <input
                      className={inputClass}
                      value={draft.gujaratState}
                      onChange={(e) => patch({ gujaratState: e.target.value })}
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
                </div>
              </FormSection>

              <FormSection
                title="Credit / accounting"
                collapsible
                open={openExtra.credit}
                onToggle={() => toggleSection("credit")}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Credit Limit">
                    <input
                      className={inputClass}
                      value={draft.creditLimit}
                      onChange={(e) => patch({ creditLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="Credit Days">
                    <input
                      className={inputClass}
                      value={draft.creditDays}
                      onChange={(e) => patch({ creditDays: e.target.value })}
                    />
                  </Field>
                  <Field label="Opening Balance">
                    <input
                      className={inputClass}
                      value={draft.openingBalance}
                      onChange={(e) =>
                        patch({ openingBalance: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Cr. / Dr.">
                    <select
                      className={inputClass}
                      value={draft.creditDebit}
                      onChange={(e) => patch({ creditDebit: e.target.value })}
                    >
                      <option value="">Select</option>
                      <option value="CR">Cr.</option>
                      <option value="DR">Dr.</option>
                    </select>
                  </Field>
                  <Field label="TDS">
                    <input
                      className={inputClass}
                      value={draft.tds}
                      onChange={(e) => patch({ tds: e.target.value })}
                    />
                  </Field>
                  <Field label="TDS A/c">
                    <input
                      className={inputClass}
                      value={draft.tdsAccount}
                      onChange={(e) => patch({ tdsAccount: e.target.value })}
                    />
                  </Field>
                  <Field label="TDS Limit">
                    <input
                      className={inputClass}
                      value={draft.tdsLimit}
                      onChange={(e) => patch({ tdsLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="DOB">
                    <input
                      className={inputClass}
                      type="date"
                      value={draft.dob}
                      onChange={(e) => patch({ dob: e.target.value })}
                    />
                  </Field>
                  <Field label="References" className="col-span-4">
                    <textarea
                      className={inputClass}
                      rows={1}
                      value={draft.references}
                      onChange={(e) => patch({ references: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Transaction / commercial"
                collapsible
                open={openExtra.commercial}
                onToggle={() => toggleSection("commercial")}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Trans-Name">
                    <input
                      className={inputClass}
                      value={draft.transName}
                      onChange={(e) => patch({ transName: e.target.value })}
                    />
                  </Field>
                  <Field label="Discount Percentage">
                    <input
                      className={inputClass}
                      value={draft.discountPercent}
                      onChange={(e) =>
                        patch({ discountPercent: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="R.D. / Pcs">
                    <input
                      className={inputClass}
                      value={draft.rdPcs}
                      onChange={(e) => patch({ rdPcs: e.target.value })}
                    />
                  </Field>
                  <Field label="Mts">
                    <input
                      className={inputClass}
                      value={draft.mts}
                      onChange={(e) => patch({ mts: e.target.value })}
                    />
                  </Field>
                  <Field label="Commission Percentage">
                    <input
                      className={inputClass}
                      value={draft.commissionPercent}
                      onChange={(e) =>
                        patch({ commissionPercent: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Bank details"
                collapsible
                open={openExtra.bank}
                onToggle={() => toggleSection("bank")}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Bank Detail">
                    <input
                      className={inputClass}
                      value={draft.bankDetail}
                      onChange={(e) => patch({ bankDetail: e.target.value })}
                    />
                  </Field>
                  <Field label="Bank Name">
                    <input
                      className={inputClass}
                      value={draft.bankName}
                      onChange={(e) => patch({ bankName: e.target.value })}
                    />
                  </Field>
                  <Field label="A/C No.">
                    <input
                      className={inputClass}
                      value={draft.accountNo}
                      onChange={(e) => patch({ accountNo: e.target.value })}
                    />
                  </Field>
                  <Field label="IFSC Code">
                    <input
                      className={inputClass}
                      value={draft.ifscCode}
                      onChange={(e) => patch({ ifscCode: e.target.value })}
                    />
                  </Field>
                  <Field label="Branch">
                    <input
                      className={inputClass}
                      value={draft.branch}
                      onChange={(e) => patch({ branch: e.target.value })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="MSME details"
                collapsible
                open={openExtra.msme}
                onToggle={() => toggleSection("msme")}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Udyam Registration Number" className="col-span-2">
                    <input
                      className={inputClass}
                      value={draft.udyamRegNo}
                      onChange={(e) => patch({ udyamRegNo: e.target.value })}
                    />
                  </Field>
                  <Field label="Enterprise Type">
                    <input
                      className={inputClass}
                      value={draft.enterpriseType}
                      onChange={(e) =>
                        patch({ enterpriseType: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Enterprise Activity">
                    <input
                      className={inputClass}
                      value={draft.enterpriseActivity}
                      onChange={(e) =>
                        patch({ enterpriseActivity: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Job information"
                collapsible
                open={openExtra.job}
                onToggle={() => toggleSection("job")}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Job Type">
                    <select
                      className={inputClass}
                      value={draft.jobType}
                      onChange={(e) => patch({ jobType: e.target.value })}
                    >
                      <option value="">Select</option>
                      {JOB_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Status"
                collapsible
                open={openExtra.status}
                onToggle={() => toggleSection("status")}
              >
                <div className="grid grid-cols-4 gap-x-2 gap-y-1">
                  <Field label="Black Listed">
                    <label className="flex items-center gap-2 py-1.5 text-[12.5px]">
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
                onClick={() => void saveJob()}
              >
                {mode === "create" ? "Save Job" : "Update Job"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
