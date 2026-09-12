import { COMPANY } from "@/lib/company";

/** Absolute app origin for public PDF / card links. */
export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function programPdfUrl(programId: string, baseUrl?: string) {
  return `${baseUrl || appBaseUrl()}/api/pdf/program/${programId}`;
}

export function greyPoPdfUrl(orderId: string, baseUrl?: string) {
  return `${baseUrl || appBaseUrl()}/api/pdf/grey/${orderId}`;
}

export { COMPANY };
