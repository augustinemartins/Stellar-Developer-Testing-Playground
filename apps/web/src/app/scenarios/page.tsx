import type { Metadata } from "next";
import { ScenariosView } from "@/components/scenarios-view";

export const metadata: Metadata = { title: "Saved scenarios" };

export default function ScenariosPage() {
  return <ScenariosView />;
}
