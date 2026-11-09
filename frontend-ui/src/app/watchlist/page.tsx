import { redirect } from "next/navigation";

export default function LegacyWatchlistPage() {
  redirect("/markets?tab=favorites");
}
