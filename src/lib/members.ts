/** Shared member validation, used by the API and by the forms (same rules in both places). */

export const normEmail = (e: string) => e.trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MemberInput = { id?: string; name: string; email: string };

/**
 * Returns a list of problems (empty if valid):
 *  - every person needs a name and a valid email
 *  - no two people can share an email (PayPal would invoice the same account twice)
 *  - no two people can share a name (the AI matches people by name)
 */
export function memberProblems(members: MemberInput[]): string[] {
  const out: string[] = [];
  const byEmail = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const m of members) {
    const name = m.name.trim();
    const email = normEmail(m.email);
    if (!name) out.push("Every person needs a name.");
    if (!email) out.push(`${name || "Someone"} needs a PayPal email.`);
    else if (!EMAIL_RE.test(email)) out.push(`“${m.email.trim()}” isn't a valid email.`);
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), name || "someone"]);
    if (name) byName.set(name.toLowerCase(), [...(byName.get(name.toLowerCase()) ?? []), name]);
  }
  for (const [email, names] of byEmail)
    if (names.length > 1) out.push(`${email} is used by ${names.join(" and ")}. Each person needs their own PayPal email.`);
  for (const [, names] of byName) if (names.length > 1) out.push(`Two people are called “${names[0]}”. Add a surname or initial so they can be told apart.`);
  return [...new Set(out)];
}

/** Indexes of rows whose email is shared with another row (for highlighting in forms). */
export function duplicateEmailRows(members: MemberInput[]): Set<number> {
  const seen = new Map<string, number[]>();
  members.forEach((m, i) => {
    const e = normEmail(m.email);
    if (e) seen.set(e, [...(seen.get(e) ?? []), i]);
  });
  return new Set([...seen.values()].filter((v) => v.length > 1).flat());
}
