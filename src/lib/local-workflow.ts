export const STORAGE_KEYS = {
  GREY_PURCHASE: "mapps.local.greyPurchase.v1",
  PURCHASE_ORDERS: "mapps.local.purchaseOrders.v1",
  MILL_INWARD: "mapps.local.millInward.v1",
  MILL_PROGRAM: "mapps.local.millProgram.v1",
  FINISHED_WORK: "mapps.local.finishedWork.v1",
  QC: "mapps.local.qc.v1",
  SALES_AGENTS: "mapps.local.salesAgents.v1",
  PURCHASE_AGENTS: "mapps.local.purchaseAgents.v1",
  SALES_MASTERS: "mapps.local.salesMasters.v1",
  KNITTERS: "mapps.local.knitters.v1",
  MILLS: "mapps.local.mills.v1",
  TRANSPORTERS: "mapps.local.transporters.v1",
  JOBS: "mapps.local.jobs.v1",
  HASTES: "mapps.local.hastes.v1",
  ITEMS: "mapps.local.items.v1",
  SALES: "mapps.local.sales.v1",
} as const;

export type LocalRoll = {
  id: string;
  weight: string;
};

export type LocalGpItem = {
  id: string;
  name: string;
  rolls: string;
  qty: string;
  rate: string;
};

export type LocalGreyPurchase = {
  id: string;
  srNo: string;
  date: string;
  dateOfIssue?: string;
  billNo: string;
  challanNo: string;
  knitter: string;
  mill: string;
  agent: string;
  remarks: string;
  freightRate: string;
  items: LocalGpItem[];
  rolls: LocalRoll[];
};

export type InwardSourceType = "GREY_PURCHASE" | "MANUAL" | "QC_RETURN";
export type MillInwardKind = "NORMAL" | "QC_RETURN";

export type LocalQcReturnLine = {
  id: string;
  rolls: string;
  codeNo: string;
  colour: string;
};

export type LocalMillInward = {
  id: string;
  srNo: string;
  date: string;
  dateOfIssue: string | null;
  knitter: string;
  mill: string;
  item: string;
  quantity: string;
  remarks: string;
  rolls: LocalRoll[];
  items: LocalGpItem[];
  status: "pending" | "completed" | "PENDING" | "SENT";
  sentOn: string | null;
  sourceType: InwardSourceType;
  sourceId: string | null;
  type?: MillInwardKind;
  sourceQcId?: string | null;
  sourceFinishedWorkId?: string | null;
  sourceMillProgramId?: string | null;
  qcSrNo?: string;
  finishedWorkSrNo?: string;
  programSrNo?: string;
  knitterChallanNo?: string;
  challanNo?: string;
  code?: string;
  colour?: string;
  failedRolls?: number;
  failedKg?: string;
  grade?: string;
  defectType?: string;
  sendNote?: string;
  sentAt?: string | null;
  returnLines?: LocalQcReturnLine[];
};

export type LocalMillProgramLine = {
  id: string;
  rolls: string;
  codeNo: string;
  colour: string;
};

export type LocalMillProgram = {
  id: string;
  srNo: string;
  date: string;
  dateOfIssue: string | null;
  mill: string;
  item: string;
  knitter: string;
  challanNo: string;
  inwardId: string;
  inwardSrNo: string;
  typeOfFinish: string;
  gsm: string;
  width: string;
  lines: LocalMillProgramLine[];
  programmedRolls: number;
  remainingRolls: number;
  originalRolls: number;
  status: "saved" | "sent" | "draft";
  sentAt: string | null;
};

export type LocalFinishedWork = {
  id: string;
  srNo: string;
  date: string;
  gpNo: string;
  mill: string;
  knitterChallanNo: string;
  challanNo: string;
  lotNo: string;
  item: string;
  rolls: string;
  greyKg: string;
  finishedKg: string;
  rate: string;
};

export type LocalQcLine = {
  id: string;
  rolls: string;
  codeNo: string;
  colour: string;
};

export type LocalQcResult = "pass" | "fail";
export type LocalQcGrade = "A" | "B" | "C" | "REJECT";
export type LocalQcDefect = "MILL" | "WEAVER" | "DYEING" | "MINOR";

export type LocalQc = {
  id: string;
  srNo: string;
  date: string;
  finishedWorkId: string;
  programId: string;
  knitterChallanNo: string;
  lines: LocalQcLine[];
  qcRolls: number;
  result: LocalQcResult;
  grade: LocalQcGrade | "";
  defectType: LocalQcDefect | "";
  remarks: string;
  createdAt: string;
};

export type LocalAgentMasterType = "SALES AGENT" | "PURCHASE AGENT";

export type LocalAgent = {
  id: string;
  name: string;
  accountType: string;
  address: string;
  city: string;
  phone: string;
  mobile: string;
  fax: string;
  residentNo: string;
  email: string;
  pan: string;
  gstin: string;
  compositeNo: string;
  registrationDate: string;
  contactPerson: string;
  masterType: LocalAgentMasterType;
  blackListed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LocalSalesMaster = {
  id: string;
  accountName: string;
  accountType: string;
  salesAgentId: string;
  group: string;
  salesman: string;
  gstin: string;
  compositeNo: string;
  ecoSgstin: string;
  registrationDate: string;
  panNo: string;
  tanNo: string;
  kstNo: string;
  cstNo: string;
  gujaratState: string;
  tinNo: string;
  policyNo: string;
  receiverName: string;
  address: string;
  cityName: string;
  distance: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  residentNo: string;
  address2: string;
  cityName2: string;
  manager: string;
  creditLimit: string;
  creditDays: string;
  references: string;
  openingBalance: string;
  crDr: "" | "CR" | "DR";
  tds: string;
  tcsApplicable: boolean;
  payment: string;
  transName: string;
  discountPercentage: string;
  rdPcs: string;
  mts: string;
  excessRate: string;
  commissionPercentage: string;
  bankDetail: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  udyamNo: string;
  enterpriseType: string;
  enterpriseActivity: string;
  blackListed: boolean;
  masterType: "SALES";
  createdAt: string;
  updatedAt: string;
};

export type LocalKnitter = {
  id: string;
  knitterName: string;
  accountType: string;
  group: string;
  agent: string;
  gstin: string;
  compositeNo: string;
  ecoSgstin: string;
  registrationDate: string;
  receiverName: string;
  address: string;
  cityName: string;
  distance: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  residentNo: string;
  address2: string;
  cityName2: string;
  manager: string;
  creditLimit: string;
  creditDays: string;
  references: string;
  openingBalance: string;
  crDr: "" | "CR" | "DR";
  tds: string;
  panNo: string;
  tanNo: string;
  kstNo: string;
  cstNo: string;
  gujaratState: string;
  tinNo: string;
  transName: string;
  discountPercentage: string;
  rdPcs: string;
  mts: string;
  commissionPercentage: string;
  bankDetail: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  udyamNo: string;
  enterpriseType: string;
  enterpriseActivity: string;
  tcsApplicable: boolean;
  payment: string;
  blackListed: boolean;
  masterType: "KNITTER";
  createdAt: string;
  updatedAt: string;
};

export type LocalMill = {
  id: string;
  millName: string;
  accountType: string;
  group: string;
  agent: string;
  gstin: string;
  compositeNo: string;
  ecoSgstin: string;
  registrationDate: string;
  receiverName: string;
  address: string;
  cityName: string;
  distance: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  residentNo: string;
  address2: string;
  cityName2: string;
  manager: string;
  creditLimit: string;
  creditDays: string;
  references: string;
  openingBalance: string;
  crDr: "" | "CR" | "DR";
  tds: string;
  tdsAccount: string;
  tdsLimit: string;
  dob: string;
  panNo: string;
  tanNo: string;
  kstNo: string;
  cstNo: string;
  gujaratState: string;
  tinNo: string;
  transName: string;
  discountPercentage: string;
  rdPcs: string;
  mts: string;
  commissionPercentage: string;
  bankDetail: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  udyamNo: string;
  enterpriseType: string;
  enterpriseActivity: string;
  tcsApplicable: boolean;
  payment: string;
  blackListed: boolean;
  masterType: "MILL";
  createdAt: string;
  updatedAt: string;
};

export type LocalTransporter = {
  id: string;
  transportName: string;
  address: string;
  phone: string;
  email: string;
  transIdGstin: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalJob = {
  id: string;
  accountName: string;
  accountType: string;
  group: string;
  agent: string;
  salesman: string;
  gstin: string;
  compositeNo: string;
  ecoSgstin: string;
  registrationDate: string;
  panNo: string;
  tanNo: string;
  kstNo: string;
  cstNo: string;
  gujaratState: string;
  tinNo: string;
  policyNo: string;
  receiverName: string;
  address: string;
  cityName: string;
  distance: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  residentNo: string;
  address2: string;
  cityName2: string;
  manager: string;
  creditLimit: string;
  creditDays: string;
  references: string;
  openingBalance: string;
  creditDebit: string;
  tds: string;
  tdsAccount: string;
  tdsLimit: string;
  dob: string;
  transName: string;
  discountPercent: string;
  rdPcs: string;
  mts: string;
  commissionPercent: string;
  bankDetail: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  branch: string;
  udyamRegNo: string;
  enterpriseType: string;
  enterpriseActivity: string;
  jobType: string;
  blackListed: boolean;
  masterType: "JOB";
  createdAt: string;
  updatedAt: string;
};

export type LocalHaste = {
  id: string;
  hasteName: string;
  address: string;
  cityName: string;
  distance: string;
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  residentNo: string;
  manager: string;
  kstNo: string;
  gujaratState: string;
  cstNo: string;
  transport: string;
  tinNo: string;
  policyNo: string;
  panNo: string;
  gstin: string;
  compositeNo: string;
  registrationDate: string;
  receiverName: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalItem = {
  id: string;
  itemName: string;
  quality: string;
  itemCategories: string;
  itemGroup: string;
  hsnCode: string;
  gstPercent: string;
  descriptionForGst: string;
  itemRatePer: string;
  openingPcs: string;
  openingMts: string;
  openingValue: string;
  ratePerPcs: string;
  ratePerMts: string;
  purchaseRatePerPcs: string;
  purchaseRatePerMts: string;
  itemFold: string;
  imagePath1: string;
  imagePath2: string;
  imagePath3: string;
  imagePath4: string;
  imagePath5: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalSaleRoll = {
  id: string;
  weight: string;
};

export type LocalSaleLine = {
  id: string;
  itemId: string;
  itemName: string;
  colourCode: string;
  hsn: string;
  noOfRolls: string;
  rolls: LocalSaleRoll[];
  weightKg: string;
  rate: string;
};

export type LocalSaleBill = {
  id: string;
  billNo: string;
  billDate: string;
  challanNo: string;
  customerId: string;
  customerName: string;
  agentId: string;
  agentName: string;
  hasteId: string;
  hasteName: string;
  lrNo: string;
  transportId: string;
  transportName: string;
  noOfParcel: string;
  ewayNumber: string;
  lrDate: string;
  destination: string;
  lines: LocalSaleLine[];
  paymentWithinDays: string;
  discount: string;
  addLessAmount: string;
  freight: string;
  cgstPct: string;
  sgstPct: string;
  cgstAmount: string;
  sgstAmount: string;
  grossAmount: string;
  netAmount: string;
  totalRolls: string;
  totalWeightKg: string;
  status: "OPEN" | "DRAFT";
  createdAt: string;
  updatedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function loadRecords<T>(key: string): T[] | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function saveRecords<T>(key: string, rows: T[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(rows));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateStamp(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}${m}${y}`;
}

export function nextDatedSrNo(srNos: string[], isoDate: string) {
  const stamp = dateStamp(isoDate);
  const used = srNos
    .filter((srNo) => srNo.endsWith(`-${stamp}`))
    .map((srNo) => Number(srNo.slice(0, 3)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${String(next).padStart(3, "0")}-${stamp}`;
}

function num(raw: string) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function greyDateOfIssue(entry: LocalGreyPurchase) {
  return entry.dateOfIssue || entry.date;
}

function itemLabel(items: LocalGpItem[]) {
  const names = items.map((item) => item.name.trim()).filter(Boolean);
  return names.join(" · ") || "—";
}

function totalQuantity(entry: LocalGreyPurchase) {
  const rollKg = entry.rolls.reduce((sum, roll) => sum + num(roll.weight), 0);
  if (rollKg > 0) return rollKg.toFixed(3);
  const itemKg = entry.items.reduce((sum, item) => sum + num(item.qty), 0);
  return itemKg.toFixed(3);
}

export function upsertPendingInwardFromGrey(entry: LocalGreyPurchase) {
  const existing =
    loadRecords<LocalMillInward>(STORAGE_KEYS.MILL_INWARD) ?? [];
  const already = existing.some(
    (row) =>
      row.sourceType === "GREY_PURCHASE" && row.sourceId === entry.id,
  );
  if (already) return false;

  const today = new Date().toISOString().slice(0, 10);
  const created: LocalMillInward = {
    id: crypto.randomUUID(),
    srNo: nextDatedSrNo(
      existing.map((row) => row.srNo),
      today,
    ),
    date: today,
    dateOfIssue: greyDateOfIssue(entry),
    knitter: entry.knitter,
    mill: entry.mill,
    item: itemLabel(entry.items),
    quantity: totalQuantity(entry),
    remarks: entry.remarks,
    rolls: entry.rolls.map((roll) => ({ ...roll })),
    items: entry.items.map((item) => ({ ...item })),
    status: "pending",
    sentOn: null,
    sourceType: "GREY_PURCHASE",
    sourceId: entry.id,
  };

  saveRecords(STORAGE_KEYS.MILL_INWARD, [created, ...existing]);
  return true;
}

export function createQcReturnFromFail(input: {
  qc: LocalQc;
  work: LocalFinishedWork | null;
  program: LocalMillProgram | null;
}):
  | { ok: true; created: boolean; srNo: string }
  | { ok: false; reason: string } {
  const { qc, work, program } = input;
  if (!work) {
    return {
      ok: false,
      reason:
        "Finished Work for this QC is missing. QC Return was not created.",
    };
  }
  if (!program) {
    return {
      ok: false,
      reason:
        "Mill Program for this QC is missing. QC Return was not created.",
    };
  }
  const mill = work.mill.trim() || program.mill.trim();
  const item = work.item.trim() || program.item.trim();
  if (!mill || !item) {
    return {
      ok: false,
      reason: "Mill or item is missing. QC Return was not created.",
    };
  }

  const existing =
    loadRecords<LocalMillInward>(STORAGE_KEYS.MILL_INWARD) ?? [];
  const already = existing.find(
    (row) =>
      (row.type === "QC_RETURN" || row.sourceType === "QC_RETURN") &&
      row.sourceQcId === qc.id,
  );
  if (already) return { ok: true, created: false, srNo: already.srNo };

  const returnLines: LocalQcReturnLine[] = qc.lines.map((line) => ({
    id: crypto.randomUUID(),
    rolls: line.rolls,
    codeNo: line.codeNo,
    colour: line.colour,
  }));
  const codes = [
    ...new Set(returnLines.map((line) => line.codeNo.trim()).filter(Boolean)),
  ];
  const colours = [
    ...new Set(returnLines.map((line) => line.colour.trim()).filter(Boolean)),
  ];
  const date = qc.date || new Date().toISOString().slice(0, 10);
  const created: LocalMillInward = {
    id: crypto.randomUUID(),
    srNo: nextDatedSrNo(
      existing.map((row) => row.srNo),
      date,
    ),
    date,
    dateOfIssue: null,
    knitter: program.knitter,
    mill,
    item,
    quantity: work.finishedKg,
    remarks: qc.remarks,
    rolls: [],
    items: [],
    status: "PENDING",
    sentOn: null,
    sentAt: null,
    sourceType: "QC_RETURN",
    sourceId: qc.id,
    type: "QC_RETURN",
    sourceQcId: qc.id,
    sourceFinishedWorkId: work.id,
    sourceMillProgramId: program.id,
    qcSrNo: qc.srNo,
    finishedWorkSrNo: work.srNo,
    programSrNo: program.srNo,
    knitterChallanNo: qc.knitterChallanNo || work.knitterChallanNo,
    challanNo: work.challanNo || program.challanNo,
    code: codes.join(" · "),
    colour: colours.join(" · "),
    failedRolls: qc.qcRolls,
    failedKg: work.finishedKg,
    grade: qc.grade,
    defectType: qc.defectType,
    sendNote: "",
    returnLines,
  };

  saveRecords(STORAGE_KEYS.MILL_INWARD, [created, ...existing]);
  return { ok: true, created: true, srNo: created.srNo };
}

export function inwardOriginalRolls(inward: LocalMillInward) {
  const filled = inward.rolls.filter((roll) => roll.weight.trim() !== "");
  if (filled.length > 0) return filled.length;
  const itemRolls = inward.items.reduce((sum, item) => sum + num(item.rolls), 0);
  return itemRolls > 0 ? itemRolls : 0;
}

export function programLineRolls(lines: LocalMillProgramLine[]) {
  return lines.reduce((sum, line) => sum + num(line.rolls), 0);
}

export function allocatedProgramRolls(
  programs: LocalMillProgram[],
  inwardId: string,
  excludeId?: string | null,
) {
  return programs
    .filter(
      (row) =>
        row.status !== "draft" &&
        row.inwardId === inwardId &&
        row.id !== excludeId,
    )
    .reduce((sum, row) => sum + row.programmedRolls, 0);
}

export function greyChallanForInward(inward: LocalMillInward) {
  if (inward.sourceType !== "GREY_PURCHASE" || !inward.sourceId) return "";
  const bills = loadRecords<LocalGreyPurchase>(STORAGE_KEYS.GREY_PURCHASE) ?? [];
  return bills.find((bill) => bill.id === inward.sourceId)?.challanNo ?? "";
}

export function finishedWorkCalc(entry: Pick<
  LocalFinishedWork,
  "greyKg" | "finishedKg" | "rate"
>) {
  const greyKg = num(entry.greyKg);
  const finishedKg = num(entry.finishedKg);
  const rate = num(entry.rate);
  const shortageKg = greyKg - finishedKg;
  const shortagePct = greyKg > 0 ? (shortageKg / greyKg) * 100 : 0;
  return {
    greyKg,
    finishedKg,
    rate,
    shortageKg,
    shortagePct,
    amount: finishedKg * rate,
  };
}

export function qcLineRolls(lines: LocalQcLine[]) {
  return lines.reduce((sum, line) => sum + num(line.rolls), 0);
}

export function allocatedQcRolls(
  entries: LocalQc[],
  programId: string,
  excludeId?: string | null,
) {
  return entries
    .filter((row) => row.programId === programId && row.id !== excludeId)
    .reduce((sum, row) => sum + row.qcRolls, 0);
}

export function findProgramForFinishedWork(
  programs: LocalMillProgram[],
  work: LocalFinishedWork,
) {
  const challan = work.knitterChallanNo.trim().toLowerCase();
  const byChallan = programs.find(
    (row) => row.challanNo.trim().toLowerCase() === challan && challan,
  );
  if (byChallan) return byChallan;
  return (
    programs.find(
      (row) =>
        row.mill.trim().toLowerCase() === work.mill.trim().toLowerCase() &&
        row.item.trim().toLowerCase() === work.item.trim().toLowerCase(),
    ) ?? null
  );
}
