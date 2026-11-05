import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SplitPay AI: snap the bill, AI settles it",
  description:
    "Snap a receipt, describe the split in plain English, and an AI agent sends everyone a PayPal request and follows up until the group is settled.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d4ed8" };

const REPO = "https://github.com/Kamal934/splitpay-ai";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-lg text-white shadow-sm">÷</span>
      <span className="text-lg">
        SplitPay <span className="text-brand-600">AI</span>
      </span>
    </Link>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col overflow-x-clip antialiased`}>
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Logo />
            <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
              <Link href="/#how" className="hover:text-slate-900">How it works</Link>
              <Link href="/#features" className="hover:text-slate-900">Features</Link>
              <Link href="/#agent" className="hover:text-slate-900">AI agent</Link>
              <Link href="/#safety" className="hover:text-slate-900">Safety</Link>
              <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-slate-900">GitHub</a>
            </nav>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 sm:inline">Sandbox</span>
              <Link href="/app" className="btn-primary">Open app →</Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-3 max-w-sm text-sm text-slate-500">
                Snap the bill, say how to split it, and let an AI agent collect everyone&apos;s share through PayPal.
              </p>
            </div>
            <div className="text-sm">
              <p className="mb-2 font-semibold">Product</p>
              <ul className="space-y-1.5 text-slate-500">
                <li><Link href="/app" className="hover:text-slate-900">Open app</Link></li>
                <li><Link href="/#how" className="hover:text-slate-900">How it works</Link></li>
                <li><Link href="/#safety" className="hover:text-slate-900">Safety & guardrails</Link></li>
              </ul>
            </div>
            <div className="text-sm">
              <p className="mb-2 font-semibold">Project</p>
              <ul className="space-y-1.5 text-slate-500">
                <li><a href={REPO} target="_blank" rel="noreferrer" className="hover:text-slate-900">Source code</a></li>
                <li>Built for the PayPal AI Hackathon 2026</li>
                <li>MIT licensed</li>
              </ul>
            </div>
          </div>
          <p className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
            Runs on the PayPal sandbox. No real money moves.
          </p>
        </footer>
      </body>
    </html>
  );
}
