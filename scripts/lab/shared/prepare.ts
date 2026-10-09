import { existsSync } from "node:fs";
import path from "node:path";

export type LabDocumentKind = "bill" | "challan";

export type LabDocument = {
  kind: LabDocumentKind;
  filePath: string;
  extension: string;
};

const SUPPORTED = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function prepareLabDocument(kind: LabDocumentKind): LabDocument {
  const given = process.argv[2];
  if (!given?.trim()) {
    fail(
      `Provide a file path. Example: npm run lab:${kind} -- "path/to/${kind}.pdf"`,
    );
  }

  const filePath = path.resolve(given);
  if (!existsSync(filePath)) {
    fail(`File not found: ${filePath}`);
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED.has(extension)) {
    fail(
      `Unsupported file type "${extension || "(none)"}". Use PDF, JPG, JPEG, or PNG.`,
    );
  }

  return { kind, filePath, extension };
}
