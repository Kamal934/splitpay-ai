import Link from "next/link";
import Logo, { REPO } from "@/components/Logo";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <Link href="/#how" className="hover:text-ink">How it works</Link>
            <Link href="/#features" className="hover:text-ink">Features</Link>
            <Link href="/#agent" className="hover:text-ink">AI agent</Link>
            <Link href="/#safety" className="hover:text-ink">Safety</Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
          </nav>
          <Link href="/app" className="btn-primary">Open app</Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted">
              Snap the bill, say how to split it, and let an AI agent collect everyone&apos;s share through PayPal.
            </p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-medium text-ink">Product</p>
            <ul className="space-y-1.5 text-muted">
              <li><Link href="/app" className="hover:text-ink">Open app</Link></li>
              <li><Link href="/#how" className="hover:text-ink">How it works</Link></li>
              <li><Link href="/#safety" className="hover:text-ink">Safety & guardrails</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-medium text-ink">Project</p>
            <ul className="space-y-1.5 text-muted">
              <li><a href={REPO} target="_blank" rel="noreferrer" className="hover:text-ink">Source code</a></li>
              <li>Built for the PayPal AI Hackathon 2026</li>
              <li>MIT licensed</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-line py-4 text-center text-xs text-muted">Runs on the PayPal sandbox. No real money moves.</p>
      </footer>
    </div>
  );
}
