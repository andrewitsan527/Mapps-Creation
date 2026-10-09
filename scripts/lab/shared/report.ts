import type { LabDocument } from "./prepare.ts";

export function reportLabDocument(document: LabDocument) {
  console.log(`Document type: ${document.kind}`);
  console.log(`Selected file: ${document.filePath}`);
}
