import { NextResponse } from "next/server";
import { saveShare } from "@/lib/shares";

/**
 * Android's share sheet POSTs here when someone shares to the installed SplitPay app
 * (manifest.webmanifest → share_target). We keep the shared item briefly and send the
 * user to /share to choose which group it belongs to.
 */
export async function POST(req: Request) {
  // iOS Shortcuts call this with ?json=1 and then open the returned URL.
  const json = new URL(req.url).searchParams.get("json") === "1";
  const back = (path: string) => (json ? NextResponse.json({ url: new URL(path, req.url).toString() }) : NextResponse.redirect(new URL(path, req.url), 303));
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const image = files.find((f) => f.type.startsWith("image/"));
    const txt = files.find((f) => f.type === "text/plain" || f.name.toLowerCase().endsWith(".txt"));

    if (image) {
      if (image.size > 5 * 1024 * 1024) return back("/share?error=too-large");
      const meta = await saveShare({ image: { bytes: Buffer.from(await image.arrayBuffer()), mime: image.type } });
      return back(`/share?t=${meta.token}`);
    }

    const text = [txt ? await txt.text() : "", String(form.get("text") ?? ""), String(form.get("title") ?? "")]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
    if (!text) return back("/share?error=empty");
    const meta = await saveShare({ text });
    return back(`/share?t=${meta.token}`);
  } catch {
    return back("/share?error=failed");
  }
}

/** Opening the URL directly just goes to the app. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/app", req.url), 303);
}
