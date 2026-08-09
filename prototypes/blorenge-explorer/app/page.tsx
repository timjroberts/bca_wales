import type { Metadata } from "next";
import { Explorer } from "./Explorer";

export const metadata: Metadata = {
  title: "Explore the map | Blorenge landscape",
  description: "Explore landscape, wildfire and observed vegetation change around the Blorenge on an accessible bilingual map.",
};

export default function MapPage() {
  return <Explorer initialView="map" />;
}
