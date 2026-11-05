import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SplitPay AI: snap the bill, AI settles it",
  description:
    "Snap a receipt, describe the split in plain English, and an AI agent sends everyone a PayPal request and follows up until the group is settled.",
  manifest: "/manifest.webmanifest",
  applicationName: "SplitPay AI",
  appleWebApp: { capable: true, title: "SplitPay", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7c3aed" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen overflow-x-clip antialiased`}>{children}</body>
    </html>
  );
}
