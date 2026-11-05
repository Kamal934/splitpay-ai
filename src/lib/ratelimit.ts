import "server-only";

/**
 * Small in-memory rate limit for the AI endpoints, so a public demo URL can't
 * burn through the Claude budget. Per client IP, sliding window.
 */
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = Number(process.env.AI_RATE_LIMIT || 40);

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Throws a friendly error when this client has made too many AI calls recently. */
export function checkAiLimit(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    const err = new Error("You're going a bit fast. Please wait a few minutes and try again.");
    (err as Error & { status?: number }).status = 429;
    throw err;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
}
