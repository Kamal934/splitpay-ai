import { readReceipt } from "@/lib/ai";
import { fail, ok } from "@/lib/http";

export const maxDuration = 120;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Upload a receipt image");
    if (file.size > 5 * 1024 * 1024) throw new Error("Image too large (max 5 MB)");
    const type = TYPES.find((t) => t === file.type);
    if (!type) throw new Error("Use a JPG, PNG, WEBP or GIF image");
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return ok(await readReceipt(b64, type));
  } catch (e) {
    return fail(e);
  }
}
