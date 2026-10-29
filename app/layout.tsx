import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SLPKN PH | Game of the Generals",
  description:
    "A local two-player strategy game inspired by Game of the Generals. Arrange your army, conceal your ranks, and capture the Flag.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
