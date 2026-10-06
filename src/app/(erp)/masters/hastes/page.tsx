import { HasteMasterDesk } from "@/components/haste-master-desk";
import { listHastes } from "@/server/actions/hastes";

export default async function HastesPage() {
  const hastes = await listHastes();
  return <HasteMasterDesk hastes={hastes} />;
}
