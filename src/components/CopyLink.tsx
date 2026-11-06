"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

/** Copies a member's private link (/me/<token>) so the organiser can send it on WhatsApp. */
export default function CopyLink({ token, name }: { token?: string; name: string }) {
  const [done, setDone] = useState(false);
  if (!token) return null;
  const url = () => `${window.location.origin}/me/${token}`;
  return (
    <button
      className="btn-ghost h-7 px-2 text-xs"
      title={`Copy ${name}'s private link`}
      onClick={async () => {
        try {
          if (navigator.share && /android|iphone|ipad/i.test(navigator.userAgent)) {
            await navigator.share({ title: "Your share on SplitPay", text: `Hi ${name.split(" ")[0]}, here's your share and every receipt:`, url: url() });
          } else {
            await navigator.clipboard.writeText(url());
          }
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copy this link", url());
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
      {done ? "Copied" : "Link"}
    </button>
  );
}
