/** Tiny in-page event channel so a top-level call to action can trigger an existing section's action. */
export type UiEvent = "request-payments" | "check-payments" | "open-autopilot";

export function emit(e: UiEvent) {
  window.dispatchEvent(new CustomEvent(`splitpay:${e}`));
}

export function on(e: UiEvent, fn: () => void) {
  const h = () => fn();
  window.addEventListener(`splitpay:${e}`, h);
  return () => window.removeEventListener(`splitpay:${e}`, h);
}
