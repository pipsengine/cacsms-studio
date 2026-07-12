import type { Metadata } from "next";
import type React from "react";
import { PlatformShell } from "@/components/platform-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "CACSMS Autonomous Media Studio",
  description: "Configuration-driven autonomous multimedia production studio."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PlatformShell>{children}</PlatformShell>
      </body>
    </html>
  );
}
