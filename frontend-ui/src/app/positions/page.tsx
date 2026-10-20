import { redirect } from "next/navigation";

/** Legacy route: leveraged trading now lives exclusively in /trade. */
export default function PositionsPage() {
  redirect("/trade");
}
