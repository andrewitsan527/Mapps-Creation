import { TransportMasterDesk } from "@/components/transport-master-desk";
import { listTransports } from "@/server/actions/transports";

export default async function TransportMasterPage() {
  const transports = await listTransports();
  return <TransportMasterDesk transports={transports} />;
}
