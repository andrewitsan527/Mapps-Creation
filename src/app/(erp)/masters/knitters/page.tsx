import { KnitterMasterDesk } from "@/components/knitter-master-desk";
import { listKnitters } from "@/server/actions/knitters";

export default async function KnittersPage() {
  const knitters = await listKnitters();
  return <KnitterMasterDesk knitters={knitters} />;
}
