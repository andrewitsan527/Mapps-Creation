import { SalesDesk } from "@/components/sales-desk";
import { listSaleBills, listSaleLookups } from "@/server/actions/sales-bills";

export default async function SalesPage() {
  const [records, lookups] = await Promise.all([
    listSaleBills(),
    listSaleLookups(),
  ]);
  return (
    <SalesDesk
      records={records}
      customers={lookups.customers}
      agents={lookups.agents}
      hastes={lookups.hastes}
      transports={lookups.transports}
      items={lookups.items}
    />
  );
}
