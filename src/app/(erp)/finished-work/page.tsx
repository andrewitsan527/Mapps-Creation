import { FinishedWorkDesk } from "@/components/finished-work-desk";
import { listFinishedWork } from "@/server/actions/finished-work-entries";
import { listItems } from "@/server/actions/items";
import { listMills } from "@/server/actions/mills";

export default async function FinishedWorkPage() {
  const [entries, mills, items] = await Promise.all([
    listFinishedWork(),
    listMills(),
    listItems(),
  ]);
  return (
    <FinishedWorkDesk
      entries={entries}
      mills={mills.map((mill) => ({ id: mill.id, name: mill.millName }))}
      items={items.map((item) => ({ id: item.id, name: item.itemName }))}
    />
  );
}
