import Link from "next/link";
import DemoButton from "@/components/DemoButton";

const STEPS = [
  {
    n: "01",
    title: "Snap the bill",
    text: "Upload or photograph any receipt. Claude reads every line, tax, service charge and tip, and checks it all adds up.",
  },
  {
    n: "02",
    title: "Say how to split it",
    text: "“Kamal is vegetarian, Priya had both desserts, tip split equally.” Plain English becomes an exact, item-by-item split.",
  },
  {
    n: "03",
    title: "The agent collects",
    text: "Everyone gets a PayPal request for exactly their share. The agent tracks who paid and sends polite reminders.",
  },
];

const FEATURES = [
  { icon: "📸", title: "Receipt vision", text: "Reads messy, real-world receipts, including modifiers, combos and service charges." },
  { icon: "💬", title: "Plain-English splits", text: "Handles “didn't drink”, “had two”, “skip the meat” and flags names that aren't in the group." },
  { icon: "🧮", title: "Exact to the cent", text: "The AI decides who shares what. Deterministic math does the money, so the shares always add up to the total." },
  { icon: "📨", title: "PayPal requests", text: "One click sends each person a PayPal invoice, built on the official PayPal Agent Toolkit." },
  { icon: "🔄", title: "Live payment status", text: "Statuses sync from PayPal: sent, paid, cancelled. Balances update the moment someone pays." },
  { icon: "📊", title: "Group ledger", text: "A sortable, filterable ledger of every expense and each person's share, with totals." },
];

const GUARDS = [
  { title: "The AI never sets amounts", text: "Request amounts always come from the ledger. The agent can only choose who to ask." },
  { title: "Spending caps", text: "Any single request above the configured limit is blocked before it reaches PayPal." },
  { title: "No double-charging", text: "Amounts already requested and still open are subtracted automatically." },
  { title: "Checks before nudging", text: "The agent refreshes PayPal status before reminding, so nobody who has paid gets nagged." },
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-8 -z-10 rounded-[2rem] bg-brand-50" />
      {/* Receipt */}
      <div className="card rotate-[-2deg] p-4 font-mono text-xs shadow-lg">
        <p className="text-center font-bold">MOKU HAWAIIAN GRILL</p>
        <div className="my-2 border-t border-dashed border-slate-300" />
        {[
          ["Moku Regular", "10.74"],
          ["Fountain - LRG", "2.29"],
          ["Moku Large", "12.24"],
          ["Sales tax 8.6%", "2.17"],
          ["Tip", "1.00"],
        ].map(([a, b]) => (
          <div key={a} className="flex justify-between py-0.5">
            <span>{a}</span>
            <span>{b}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-slate-300" />
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>$28.44</span>
        </div>
      </div>
      {/* AI split */}
      <div className="card relative mt-3 ml-10 rotate-[1deg] p-4 shadow-xl">
        <p className="text-xs font-semibold text-brand-700">🤖 “Kamal skips the Moku Large, he&apos;s vegetarian”</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {[
            ["You", "$8.27"],
            ["Kamal", "$3.67"],
            ["Priya", "$8.25"],
            ["Sam", "$8.25"],
          ].map(([n, v]) => (
            <div key={n} className="flex justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
              <span>{n}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </div>
      {/* PayPal status */}
      <div className="card relative -mt-4 mr-10 rotate-[-1deg] p-4 shadow-xl">
        <p className="mb-2 text-xs font-semibold text-muted">PAYPAL REQUESTS</p>
        {[
          ["Kamal", "$3.67", "Paid", "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"],
          ["Priya", "$8.25", "Paid", "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"],
          ["Sam", "$8.25", "Pending", "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"],
        ].map(([n, v, s, c]) => (
          <div key={n} className="flex items-center justify-between py-1 text-sm">
            <span className="font-medium">{n}</span>
            <span className="flex items-center gap-2">
              {v}
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${c}`}>{s}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> PayPal Agent Toolkit × Claude
            </span>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Snap the bill.
              <br />
              <span className="text-brand-600">AI settles it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              After every trip or dinner, one friend pays and then spends a week chasing everyone. SplitPay reads the
              receipt, understands how you want to split it, and has an AI agent collect every share through PayPal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <DemoButton className="h-11 px-5" />
              <Link href="/app" className="btn-secondary h-11 px-5">
                Start a group
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">No sign-up needed. The demo runs on the PayPal sandbox.</p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center md:grid-cols-4">
          {[
            ["~8 sec", "to read a receipt"],
            ["1 sentence", "to describe the split"],
            ["1 click", "to request everyone"],
            ["$0.00", "rounding errors"],
          ].map(([a, b]) => (
            <div key={b}>
              <p className="num text-2xl font-semibold text-ink">{a}</p>
              <p className="text-sm text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <p className="text-sm font-medium text-brand-600">How it works</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">From receipt to settled in three steps</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card card-pad">
              <span className="num text-sm font-medium text-brand-600">Step {s.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-y border-line bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-medium text-brand-600">Features</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Everything the group chat can&apos;t do</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card card-pad transition-shadow hover:shadow-md">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-2xl">{f.icon}</div>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent */}
      <section id="agent" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-brand-600">AI agent</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Just tell it what you need</h2>
          <p className="mt-4 text-muted">
            The SplitPay agent works on your group&apos;s real data. It can check balances, add expenses from a sentence,
            send PayPal requests, look up who has paid and nudge whoever hasn&apos;t, all through the PayPal Agent Toolkit.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            {["Who still owes me money?", "Send PayPal requests to everyone who owes", "I paid $48 for the cab, split with Kamal and Priya", "Remind whoever hasn't paid"].map((q) => (
              <li key={q} className="flex items-center gap-2">
                <span className="text-brand-600">→</span> “{q}”
              </li>
            ))}
          </ul>
        </div>
        <div className="card overflow-hidden shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold">🤖 SplitPay Agent</div>
          <div className="space-y-3 p-4 text-sm">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl bg-brand-600 px-3 py-2 text-white">Has anyone paid yet? Remind whoever hasn&apos;t.</p>
            </div>
            <div className="max-w-[90%] rounded-2xl bg-slate-100 px-3 py-2">
              <p>I just checked PayPal:</p>
              <p className="mt-1">• <b>Kamal</b>: $3.67, paid ✅</p>
              <p>• <b>Priya</b>: $8.25, paid ✅</p>
              <p>• <b>Sam</b>: $8.25, not paid yet</p>
              <p className="mt-1">I sent Sam a friendly reminder.</p>
              <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-emerald-700">✓ Reminded Sam via PayPal</p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="scroll-mt-20 border-y border-line bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-medium text-brand-600">Safety</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">An agent that handles money needs guardrails</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {GUARDS.map((g) => (
              <div key={g.title} className="rounded-xl border border-line bg-canvas p-6">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-sm text-success">✓</span>
                <h3 className="mt-3 font-semibold text-ink">{g.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{g.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built with */}
      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <p className="eyebrow">Built with</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm font-semibold text-muted">
          {["PayPal Agent Toolkit", "PayPal Invoicing API", "Claude (Anthropic)", "AG Grid", "Next.js", "Render"].map((t) => (
            <span key={t} className="rounded-lg border border-line bg-white px-3.5 py-1.5">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl bg-brand-600 px-6 py-14 text-center text-white">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Stop chasing friends for money</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">Try it with a sample trip: upload a receipt, split it in a sentence, and watch the agent collect.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <DemoButton className="h-11 bg-white! px-5 text-brand-700! hover:bg-brand-50!" />
            <Link href="/app" className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium text-white ring-1 ring-white/40 hover:bg-white/10">
              Start your own group
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
