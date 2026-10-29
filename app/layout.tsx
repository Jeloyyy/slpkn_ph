import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SLPKN PH | Salpakan",
  description:
    "Play SLPKN PH online: create private invitation rooms, join public Salpakan challenges, or spectate a match.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
