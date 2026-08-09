import type { Metadata } from "next";
import { Explorer } from "../Explorer";

export const metadata: Metadata = {
  title: "Read the evidence | Blorenge landscape",
  description: "Read an accessible, bilingual non-map account of landscape, wildfire and observed vegetation-change evidence around the Blorenge.",
};

export default function EvidencePage() {
  return <Explorer initialView="list" />;
}
