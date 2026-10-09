import { prepareLabDocument } from "../shared/prepare.ts";
import { extractBill, printBillReport } from "./extract.ts";

const document = prepareLabDocument("bill");

try {
  const bill = await extractBill(document);
  printBillReport(document.filePath, bill);
} catch (error) {
  const message = error instanceof Error ? error.message : "Bill extraction failed.";
  console.error(message);
  process.exit(1);
}
