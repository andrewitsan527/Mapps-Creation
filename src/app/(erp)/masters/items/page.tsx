import { ItemMasterDesk } from "@/components/item-master-desk";
import { listItems } from "@/server/actions/items";

export default async function ItemsPage() {
  const items = await listItems();
  return <ItemMasterDesk items={items} />;
}
