import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pongal Boys Fitness 🏆",
  description: "Workout and food logging challenge with normalized scoring run by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
