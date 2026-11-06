import { NextResponse } from "next/server";
import { readReceiptImage } from "@/lib/access";
import { fail } from "@/lib/http";

/** Serves a stored receipt photo. IDs are random 128-bit values, so they can't be guessed. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const img = await readReceiptImage((await params).id);
  if (!img) return fail("Receipt not found", 404);
  return new NextResponse(new Uint8Array(img.bytes), { headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=86400" } });
}
