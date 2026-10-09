export type GreyBillExtract = {
  billNo: string;
  billDate: string;
  knitter: string;
  mill: string;
  agent: string;
  item: string;
  quantityRolls: string;
  quantityKg: string;
  rate: string;
  remark: string;
  freight: string;
  sgst: string;
  cgst: string;
  netAmount: string;
};

export type GreyChallanExtract = {
  challanNo: string;
  quantityRolls: string;
  quantityKg: string;
  /** One entry per printed row, in document order. An empty string is an unread weight. */
  slots: string[];
  unreadable: string[];
};

export type GreyUploadReview = {
  billNo: string;
  billDate: string;
  challanNo: string;
  challanDate: string;
  knitter: string;
  mill: string;
  agent: string;
  item: string;
  totalRolls: string;
  totalKg: string;
  rate: string;
  amount: string;
  freight: string;
  cgst: string;
  sgst: string;
  netAmount: string;
  remarks: string;
  weights: string[];
  notes: string[];
};

export function uploadMismatch(review: Pick<GreyUploadReview, "totalRolls" | "totalKg" | "weights">) {
  const rolls = Number(review.totalRolls);
  const kg = Number(review.totalKg);
  const weights = review.weights.map((weight) => Number(weight));
  const readable = weights.every((weight) => Number.isFinite(weight));
  const sum = readable ? weights.reduce((total, weight) => total + weight, 0) : Number.NaN;
  const countOk = Number.isFinite(rolls) && readable && weights.length === rolls;
  const weightOk = Number.isFinite(kg) && readable && Math.abs(sum - kg) <= 0.001;
  const messages: string[] = [];
  if (!countOk) {
    messages.push(
      `Roll count does not match. ${weights.length} weights were extracted and total rolls is ${review.totalRolls || "blank"}.`,
    );
  }
  if (!weightOk) {
    messages.push(
      `Weight total does not match. The weights add up to ${Number.isFinite(sum) ? sum : "an unreadable value"} KG and total KG is ${review.totalKg || "blank"}.`,
    );
  }
  return { countOk, weightOk, sum, messages };
}
