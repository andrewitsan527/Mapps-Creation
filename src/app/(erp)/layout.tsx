import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ErpShell, type ShellAlert } from "@/components/erp-shell";
import { getWhatsAppProviderName } from "@/server/whatsapp";
import { getPipelineSnapshot } from "@/server/domain/pipeline";

export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const flow = await getPipelineSnapshot();

  const badges = {
    "/qc": flow.qc.queue,
    "/returns": flow.grQcPending + flow.millRfOpen,
    "/dispatch": flow.delivery.queue,
    "/payments": flow.payment.alert,
  };

  const alerts: ShellAlert[] = [
    {
      label: "RF overdue",
      count: flow.millRfOverdue,
      href: "/returns",
      tone: "danger",
    },
    {
      label: "past due",
      count: flow.payment.alert,
      href: "/payments",
      tone: "danger",
    },
    {
      label: "weaver HIGH",
      count: flow.weaverHigh,
      href: "/qc",
      tone: "warn",
    },
  ];

  return (
    <ErpShell
      user={user}
      whatsappProvider={getWhatsAppProviderName()}
      badges={badges}
      alerts={alerts}
    >
      {children}
    </ErpShell>
  );
}
