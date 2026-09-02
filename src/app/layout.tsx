import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muscle Map",
  description: "Daily muscle tracking with an interactive body map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
