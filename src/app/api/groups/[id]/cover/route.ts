import { saveReceiptImage } from "@/lib/access";
import { getGroup, updateGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Upload a cover photo for the group (served from /api/receipts/<id>, same as receipt photos). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    if (!(await getGroup(id))) return fail("Group not found", 404);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new Error("Choose an image");
    if (file.size > 5 * 1024 * 1024) throw new Error("Image too large (max 5 MB)");
    const type = TYPES.find((t) => t === file.type);
    if (!type) throw new Error("Use a JPG, PNG, WEBP or GIF image");
    const coverId = await saveReceiptImage(Buffer.from(await file.arrayBuffer()), type);
    return ok(await updateGroup(id, (g) => {
      g.coverId = coverId;
    }));
  } catch (e) {
    return fail(e);
  }
}

/** Remove the cover photo. */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok(await updateGroup((await params).id, (g) => {
      delete g.coverId;
    }));
  } catch (e) {
    return fail(e);
  }
}
