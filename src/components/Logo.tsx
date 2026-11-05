import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">÷</span>
      <span>
        SplitPay <span className="text-brand-600">AI</span>
      </span>
    </Link>
  );
}

export const REPO = "https://github.com/Kamal934/splitpay-ai";
