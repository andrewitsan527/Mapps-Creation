/**
 * What a failed server action is allowed to say to the person using the app.
 *
 * Every server action begins with `if (!user) throw new Error("Unauthorized")`,
 * and the desks printed whatever arrived straight onto the screen. So an
 * expired session told an accountant "Unauthorized" — a word that means
 * nothing to them, and whose natural answer (refresh the page) throws away
 * whatever they had typed.
 *
 * Server errors come in three kinds, and only one of them is for the reader:
 *
 *   auth      "Unauthorized"                  — never shown; it is a state,
 *                                               not something they did wrong
 *   internal  "Grey bill not found."          — about rows and ids, not about
 *             "Invalid note type"              the work in front of them
 *   business  "Enter bill date."              — the real rules, worth reading
 *             "This inward is already completed."
 *
 * So this does not hide server messages. It hides the two kinds that were
 * never written for the person reading them, and lets the rest through.
 */

/** The session is gone: expired, signed out elsewhere, or deactivated. */
export const SESSION_LOST =
  "Session expired. Sign in again in another tab, then press Save. " +
  "Don’t refresh — you’ll lose this entry.";

/**
 * Messages that describe internal state rather than anything the reader can
 * act on. Matched loosely because they are phrased many different ways.
 */
const INTERNAL = [
  /^unauthorized/i,
  /^forbidden/i,
  /\bnot found\b/i,
  /^invalid /i,
  /\bis invalid\b/i,
  /^failed to /i,
  /^cannot /i,
  /^prisma/i,
  /^p\d{4}\b/i, // Prisma error codes, e.g. P2002
  /\bconstraint\b/i,
  /\bunique\b.*\bfailed\b/i,
];

export function isAuthError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return /^(unauthorized|forbidden)/i.test(err.message.trim());
}

/**
 * Turn a thrown value into something worth showing.
 *
 * @param err      whatever the action threw
 * @param fallback what this desk says when the real reason is not for reading
 */
export function friendlyError(err: unknown, fallback: string) {
  if (isAuthError(err)) return SESSION_LOST;
  if (!(err instanceof Error)) return fallback;

  const message = err.message.trim();
  if (!message) return fallback;
  if (INTERNAL.some((pattern) => pattern.test(message))) return fallback;

  return message;
}
