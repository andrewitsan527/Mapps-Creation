import type { LocalGpItem, LocalRoll } from "@/lib/local-workflow";

/** Same record shape written by the Purchase Order screen. */
export type StoredPurchaseOrder = {
  id: string;
  srNo: string;
  knitter: string;
  quality: string;
  qtyUnits: number;
  rate: number;
  agent: string;
  remark: string;
  createdAt: string;
};

export type MatchGreyBill = {
  id: string;
  date: string;
  knitter: string;
  agent: string;
  items: LocalGpItem[];
  rolls: LocalRoll[];
};

export type ScorePart = {
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type PoCandidate = {
  po: StoredPurchaseOrder;
  score: number;
  parts: ScorePart[];
  orderedTaka: number;
  receivedTaka: number;
  orderedRate: number;
  billRate: number | null;
  rateExact: boolean;
  qtyExact: boolean;
  dayGap: number;
};

export type MatchOutcome =
  | { kind: "none" }
  | { kind: "high" | "variance"; candidate: PoCandidate; others: PoCandidate[] }
  | { kind: "multiple"; candidates: PoCandidate[] };

const CLOSE_SCORE_GAP = 5;

function norm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function identityEqual(left: string, right: string) {
  const a = norm(left);
  const b = norm(right);
  return a.length > 0 && a === b;
}

function num(raw: string | number) {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function moneyEqual(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

function qtyEqual(left: number, right: number) {
  return Math.round(left * 1000) === Math.round(right * 1000);
}

/** Whole days from the PO date to the bill date. Negative means the PO is later. */
export function daysBeforeBill(poDate: string, billDate: string) {
  const po = new Date(`${poDate}T12:00:00`);
  const bill = new Date(`${billDate}T12:00:00`);
  if (Number.isNaN(po.getTime()) || Number.isNaN(bill.getTime())) return null;
  return Math.round((bill.getTime() - po.getTime()) / 86_400_000);
}

/**
 * Ranking only. No maximum age.
 * Same day = 5. One day earlier = 2.5. Older dates keep a smaller share: 5 / (1 + days).
 */
export function dateProximityPoints(dayGap: number) {
  if (dayGap < 0) return 0;
  return 5 / (1 + dayGap);
}

function matchingLines(bill: MatchGreyBill, quality: string) {
  return bill.items.filter((item) => identityEqual(item.name, quality));
}

function scoreCandidate(
  bill: MatchGreyBill,
  po: StoredPurchaseOrder,
  dayGap: number,
): PoCandidate | null {
  if (!identityEqual(bill.knitter, po.knitter)) return null;
  if (!identityEqual(bill.agent, po.agent)) return null;
  const lines = matchingLines(bill, po.quality);
  if (lines.length === 0) return null;

  const orderedTaka = num(po.qtyUnits);
  const receivedTaka = lines.reduce((sum, item) => sum + num(item.rolls), 0);
  const orderedRate = num(po.rate);
  const rates = [...new Set(lines.map((item) => Math.round(num(item.rate) * 100)))];
  const billRate = rates.length === 1 ? rates[0] / 100 : null;
  const rateExact = billRate != null && moneyEqual(billRate, orderedRate);
  const qtyExact = qtyEqual(receivedTaka, orderedTaka);
  const datePoints = dateProximityPoints(dayGap);

  const parts: ScorePart[] = [
    {
      label: "Knitter",
      points: 30,
      max: 30,
      detail: "Matched",
    },
    {
      label: "Purchase agent",
      points: 25,
      max: 25,
      detail: "Matched",
    },
    {
      label: "Item / quality",
      points: 25,
      max: 25,
      detail: "Matched",
    },
    {
      label: "Rate",
      points: rateExact ? 10 : 0,
      max: 10,
      detail: rateExact ? "Exact match" : "Different — counted as variance, not a rejection",
    },
    {
      label: "Quantity / taka",
      points: qtyExact ? 5 : 0,
      max: 5,
      detail: qtyExact ? "Exact match" : "Different — counted as variance, not a rejection",
    },
    {
      label: "Date proximity",
      points: datePoints,
      max: 5,
      detail:
        dayGap === 0
          ? "Same day as the bill. Points = 5 ÷ (1 + days before the bill)."
          : `${dayGap} day${dayGap === 1 ? "" : "s"} before the bill. Points = 5 ÷ (1 + ${dayGap}).`,
    },
  ];

  const score = parts.reduce((sum, part) => sum + part.points, 0);
  return {
    po,
    score,
    parts,
    orderedTaka,
    receivedTaka,
    orderedRate,
    billRate,
    rateExact,
    qtyExact,
    dayGap,
  };
}

export function rankPurchaseOrders(
  bill: MatchGreyBill,
  orders: StoredPurchaseOrder[],
  takenPoIds: ReadonlySet<string>,
): MatchOutcome {
  const candidates = orders
    .filter((po) => po.id && !takenPoIds.has(po.id))
    .map((po) => {
      const dayGap = daysBeforeBill(po.createdAt, bill.date);
      if (dayGap == null || dayGap < 0) return null;
      return scoreCandidate(bill, po, dayGap);
    })
    .filter((row): row is PoCandidate => row != null)
    .sort((a, b) => b.score - a.score || a.dayGap - b.dayGap || a.po.srNo.localeCompare(b.po.srNo));

  if (candidates.length === 0) return { kind: "none" };

  const [leader, next] = candidates;
  const close = next != null && leader.score - next.score <= CLOSE_SCORE_GAP;
  if (close) return { kind: "multiple", candidates };
  if (leader.rateExact && leader.qtyExact) {
    return { kind: "high", candidate: leader, others: candidates.slice(1) };
  }
  return { kind: "variance", candidate: leader, others: candidates.slice(1) };
}

export function displayScore(score: number) {
  return Math.round(score);
}
