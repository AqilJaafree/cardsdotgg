import "./globals.css";
import "@/components/game/battle-animation.css";
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import AppShell from "@/components/game/AppShell";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `${BRAND} — Every card. A new possibility.`, description: "Discover your cards, enter the arena, and find a little magic in every pack." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
