import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ErpShell } from "@/components/erp-shell";

export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <ErpShell user={user}>{children}</ErpShell>;
}
