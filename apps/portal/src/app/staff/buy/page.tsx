import { redirect } from "next/navigation";

export default function BuyMaterialsPage() {
  redirect("/staff/activity?mode=purchase");
}
