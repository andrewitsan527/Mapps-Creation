import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ErpShell } from "@/components/erp-shell";
import { getWhatsAppProviderName } from "@/server/whatsapp";
import { getPipelineSnapshot } from "@/server/domain/pipeline";

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <div className="h-8 w-48 rounded-md bg-(--line-soft)" />
      <div className="h-24 rounded-xl border border-(--line) bg-(--panel)" />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="h-40 rounded-xl border border-(--line) bg-(--panel)" />
        <div className="h-40 rounded-xl border border-(--line) bg-(--panel)" />
      </div>
    </div>
  );
}

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
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </ErpShell>
  );
}
