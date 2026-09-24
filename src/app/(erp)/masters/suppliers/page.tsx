import { redirect } from "next/navigation";

/** Grey supplier is the same master as Weaver. */
export default function SuppliersPage() {
  redirect("/masters/weavers");
}
