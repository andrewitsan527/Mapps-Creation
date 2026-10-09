import { prepareLabDocument } from "../shared/prepare.ts";
import { extractChallan, printChallanReport } from "./extract.ts";

const document = prepareLabDocument("challan");

try {
  const { challan, unreadable } = await extractChallan(document);
  printChallanReport(document.filePath, challan, unreadable);
} catch (error) {
  const message = error instanceof Error ? error.message : "Challan extraction failed.";
  console.error(message);
  process.exit(1);
}
