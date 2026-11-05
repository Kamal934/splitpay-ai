import "server-only";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * Short-lived storage for things shared into SplitPay from other apps
 * (a WhatsApp chat export, a receipt photo). Each share gets a random token
 * and is deleted after it's used or after 24 hours.
 */
const DIR = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "shares");
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ShareMeta = { token: string; kind: "chat" | "image"; createdAt: string; mime?: string; ext?: string; text?: string };

const valid = (t: string) => /^[a-f0-9]{32}$/.test(t);

async function cleanup() {
  try {
    const now = Date.now();
    for (const f of await fs.readdir(DIR)) {
      const st = await fs.stat(path.join(DIR, f));
      if (now - st.mtimeMs > MAX_AGE_MS) await fs.rm(path.join(DIR, f), { force: true });
    }
  } catch {
    /* nothing to clean */
  }
}

export async function saveShare(input: { text?: string; image?: { bytes: Buffer; mime: string } }): Promise<ShareMeta> {
  await fs.mkdir(DIR, { recursive: true });
  void cleanup();
  const token = crypto.randomBytes(16).toString("hex");
  const meta: ShareMeta = { token, kind: input.image ? "image" : "chat", createdAt: new Date().toISOString() };
  if (input.image) {
    const ext = input.image.mime.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "img";
    meta.mime = input.image.mime;
    meta.ext = ext;
    await fs.writeFile(path.join(DIR, `${token}.${ext}`), input.image.bytes);
  } else {
    meta.text = (input.text ?? "").slice(0, 20000);
  }
  await fs.writeFile(path.join(DIR, `${token}.json`), JSON.stringify(meta));
  return meta;
}

export async function readShare(token: string): Promise<ShareMeta | null> {
  if (!valid(token)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${token}.json`), "utf8")) as ShareMeta;
  } catch {
    return null;
  }
}

export async function readShareFile(token: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const meta = await readShare(token);
  if (!meta || meta.kind !== "image" || !meta.ext || !meta.mime) return null;
  try {
    return { bytes: await fs.readFile(path.join(DIR, `${token}.${meta.ext}`)), mime: meta.mime };
  } catch {
    return null;
  }
}

export async function deleteShare(token: string) {
  const meta = await readShare(token);
  if (!meta) return;
  await fs.rm(path.join(DIR, `${token}.json`), { force: true });
  if (meta.ext) await fs.rm(path.join(DIR, `${token}.${meta.ext}`), { force: true });
}
