import { ColorCodeMasterDesk } from "@/components/color-code-master-desk";
import { listColorQualities } from "@/server/actions/color-codes";

export default async function ColorCodesPage() {
  const qualities = await listColorQualities();
  return <ColorCodeMasterDesk qualities={qualities} />;
}
