/**
 * Email capture, behind one swappable module.
 *
 * MailerLite is EU-resident (Vilnius; DE/NL data centres, all sub-processors
 * EU-based), so there is no Chapter V transfer to disclose in the privacy note.
 * For a man selling privacy-first architecture to German enterprise that is
 * on-message rather than merely compliant. Its jsonp embed endpoint returns
 * `Access-Control-Allow-Origin: *` and needs no API key, so nothing secret ever
 * reaches the client of a public repo.
 *
 * To switch to Buttondown: change PUBLIC_SUBSCRIBE_ENDPOINT to
 * https://buttondown.com/api/emails/embed-subscribe/{username} and the body to
 * `email=...&embed=1`. Nothing outside this file needs to change.
 */

export type SubscribeReason =
  | "invalid"
  | "spam"
  | "network"
  | "server"
  | "unconfigured";

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: SubscribeReason };

export interface SubscribeOptions {
  /** Hidden field. Bots fill it; humans never see it. */
  honeypot: string;
  /** Timestamp the form was rendered, for the time trap. */
  renderedAt: number;
  /** 'lattice' | 'book' — tells us which offer actually converts. */
  placement: string;
}

const ENDPOINT = import.meta.env.PUBLIC_SUBSCRIBE_ENDPOINT as string | undefined;

/** Deliberately permissive. The provider does real validation; this only
 *  catches obvious typos before we cost the user a round trip. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** No human reads a book pitch and submits in under three seconds. */
const MIN_DWELL_MS = 3000;

export async function subscribe(
  email: string,
  opts: SubscribeOptions
): Promise<SubscribeResult> {
  if (opts.honeypot.trim() !== "") return { ok: false, reason: "spam" };
  if (Date.now() - opts.renderedAt < MIN_DWELL_MS) {
    return { ok: false, reason: "spam" };
  }
  if (!EMAIL_RE.test(email.trim())) return { ok: false, reason: "invalid" };
  if (!ENDPOINT) return { ok: false, reason: "unconfigured" };

  const body = new URLSearchParams({
    "fields[email]": email.trim(),
    "fields[source]": opts.placement,
    "ml-submit": "1",
    anticsrf: "true",
  });

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    // fetch only rejects on network/CORS failure, never on 4xx/5xx — so this
    // check above the catch is what lets the error copy distinguish "you are
    // offline" from "that address was rejected".
    if (!res.ok) return { ok: false, reason: "server" };

    const data = await res.json().catch(() => ({ success: true }));
    if (data?.success === false) return { ok: false, reason: "invalid" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
