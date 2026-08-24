import type { Metadata } from "next";
import "./globals.css";

const title = "ArcScope — Live Arc Testnet Intelligence";
const description = "A designer-built, real-time network analytics dashboard powered by live Arc Testnet JSON-RPC data.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title, description, applicationName: "ArcScope",
  keywords: ["Arc", "Arc Testnet", "Web3 dashboard", "blockchain analytics", "USDC"],
  openGraph: { title, description, type: "website", siteName: "ArcScope", images: [{ url: "/og.png", width: 1200, height: 630, alt: "ArcScope — Live intelligence for Arc Testnet" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
