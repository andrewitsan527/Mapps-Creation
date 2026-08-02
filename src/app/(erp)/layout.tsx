import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ErpShell } from "@/components/erp-shell";
import { getWhatsAppProviderName } from "@/server/whatsapp";
import { getPipelineSnapshot } from "@/server/domain/pipeline";

/**
 * Start the pipeline read without awaiting it. The shell streams badges /
 * alerts in via Suspense so page content is not blocked by 16 count queries.
 */
export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const flowPromise = getPipelineSnapshot();

  return (
    <ErpShell
      user={user}
      whatsappProvider={getWhatsAppProviderName()}
      flowPromise={flowPromise}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </ErpShell>
  );
}
