/** Tiny in-page event channel so one part of the group screen can trigger an action owned by another. */
export type UiEvent =
  | "request-payments"
  | "check-payments"
  | "open-autopilot"
  | "add-expense"
  | "open-ledger"
  | "remind-request"
  | "cancel-request";

export function emit(e: UiEvent, detail?: string) {
  window.dispatchEvent(new CustomEvent(`splitpay:${e}`, { detail }));
}

export function on(e: UiEvent, fn: (detail?: string) => void) {
  const h = (ev: Event) => fn((ev as CustomEvent<string | undefined>).detail);
  window.addEventListener(`splitpay:${e}`, h);
  return () => window.removeEventListener(`splitpay:${e}`, h);
}
