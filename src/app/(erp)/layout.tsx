import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ErpShell } from "@/components/erp-shell";
import { getWhatsAppProviderName } from "@/server/whatsapp";

export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <ErpShell user={user} whatsappProvider={getWhatsAppProviderName()}>
      {children}
    </ErpShell>
  );
}
