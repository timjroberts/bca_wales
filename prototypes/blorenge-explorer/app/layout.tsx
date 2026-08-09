import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blorenge landscape explorer — interaction prototype",
  description: "An accessible bilingual interaction prototype for exploring landscape, wildfire and observed vegetation change around the Blorenge.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
