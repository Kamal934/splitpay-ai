/**
 * Starts the autopilot scheduler when the Node server boots.
 * Set AUTOPILOT_SCHEDULER=off to disable it (e.g. if you trigger /api/autopilot/tick from an external cron instead).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AUTOPILOT_SCHEDULER === "off") return;
  const g = globalThis as unknown as { __splitpayScheduler?: boolean };
  if (g.__splitpayScheduler) return;
  g.__splitpayScheduler = true;
  const { tickAll } = await import("./lib/autopilot");
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await tickAll();
    } catch (e) {
      console.error("[autopilot] tick failed", e);
    } finally {
      busy = false;
    }
  }, 60_000);
  console.log("[autopilot] scheduler started (checks every minute)");
}
