import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/http";
import { deleteShare, readShare, readShareFile } from "@/lib/shares";

/** GET ?file=1 returns the shared image bytes; otherwise the share's metadata (and text for chats). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (new URL(req.url).searchParams.get("file")) {
    const f = await readShareFile(token);
    if (!f) return fail("Shared file not found or expired", 404);
    return new NextResponse(new Uint8Array(f.bytes), { headers: { "Content-Type": f.mime, "Cache-Control": "no-store" } });
  }
  const meta = await readShare(token);
  return meta ? ok(meta) : fail("This share has expired. Share it again from WhatsApp.", 404);
}

/** Delete once it's been imported. */
export async function DELETE(_: Request, { params }: { params: Promise<{ token: string }> }) {
  await deleteShare((await params).token);
  return ok({ ok: true });
}
