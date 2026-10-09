"use server";

import { getSessionUser } from "@/lib/auth";
import type { GreyBillExtract, GreyChallanExtract } from "@/lib/grey-upload-check";
import { extractGreyBillFile, extractGreyChallanFile } from "@/server/grey-upload";

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
}

function uploadedFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Select a PDF or image.");
  return file;
}

export async function extractGreyPurchaseBill(formData: FormData): Promise<GreyBillExtract> {
  await requireUser();
  const file = uploadedFile(formData);
  return extractGreyBillFile({
    fileName: file.name,
    bytes: Buffer.from(await file.arrayBuffer()),
  });
}

export async function extractGreyPurchaseChallan(formData: FormData): Promise<GreyChallanExtract> {
  await requireUser();
  const file = uploadedFile(formData);
  return extractGreyChallanFile({
    fileName: file.name,
    bytes: Buffer.from(await file.arrayBuffer()),
  });
}
