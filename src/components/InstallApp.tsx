"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker and offers an "Install app" button (Android/desktop) or iOS instructions. */
export default function InstallApp() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!evt && !ios)) return null;

  return (
    <div className="mb-2">
      <button
        className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            setEvt(null);
          } else setShowIosHelp((v) => !v);
        }}
      >
        <Download className="h-[18px] w-[18px] shrink-0" aria-hidden /> Install app
      </button>
      {showIosHelp && (
        <div className="relative mt-1 rounded-lg border border-line bg-white p-3 text-xs text-muted shadow-sm">
          <button className="absolute right-2 top-2 text-slate-400 hover:text-ink" aria-label="Close" onClick={() => setShowIosHelp(false)}>
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="mb-1.5 font-medium text-ink">Install on iPhone</p>
          <p className="flex items-center gap-1.5">
            1. Tap <Share className="h-3.5 w-3.5" aria-label="Share" /> in Safari
          </p>
          <p className="mt-1 flex items-center gap-1.5">
            2. Choose <SquarePlus className="h-3.5 w-3.5" aria-hidden /> Add to Home Screen
          </p>
        </div>
      )}
    </div>
  );
}
