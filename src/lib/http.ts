import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(e: unknown, status = 400) {
  const message = e instanceof Error ? e.message : String(e);
  const s = (e as { status?: number })?.status;
  if (typeof s === "number") status = s;
  console.error("[api]", message);
  return NextResponse.json({ error: message }, { status });
}
