import { MillMasterDesk } from "@/components/mill-master-desk";
import { listMills } from "@/server/actions/mills";

export default async function ProcessMillsPage() {
  const mills = await listMills();
  return <MillMasterDesk mills={mills} />;
}
