"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Group } from "@/lib/types";
import { api } from "./api";

export default function DemoButton({ className = "", label = "Try the live demo" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`btn-primary ${className}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const g = await api<Group>("/api/demo", { method: "POST" });
          router.push(`/groups/${g.id}`);
        } catch {
          setBusy(false);
        }
      }}
    >
      <Play className="h-4 w-4" aria-hidden />
      {busy ? "Setting up the demo…" : label}
    </button>
  );
}
