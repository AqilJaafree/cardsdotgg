import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { ConnectBar } from "@/components/ConnectBar";
import { NetworkGuard } from "@/components/NetworkGuard";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: BRAND, description: "Yield-funded card battles on Monad testnet" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ConnectBar />
          <main>
            <NetworkGuard>{children}</NetworkGuard>
          </main>
          <footer>Testnet prototype. tUSD and tGOLD are testnet tokens; yield payouts are reserve-funded.</footer>
        </Providers>
      </body>
    </html>
  );
}
