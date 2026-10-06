import { MillInwardDesk } from "@/components/mill-inward-desk";
import { listItems } from "@/server/actions/items";
import { listKnitters } from "@/server/actions/knitters";
import { listMillInwardEntries } from "@/server/actions/mill-inward-entries";
import { listMills } from "@/server/actions/mills";

export default async function MillInwardPage() {
  const [entries, knitters, mills, items] = await Promise.all([
    listMillInwardEntries(),
    listKnitters(),
    listMills(),
    listItems(),
  ]);
  return (
    <MillInwardDesk
      entries={entries}
      knitters={knitters}
      mills={mills}
      items={items}
    />
  );
}
