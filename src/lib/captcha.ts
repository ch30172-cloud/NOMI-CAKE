import "server-only";

/**
 * Verifies a Cloudflare Turnstile token. When TURNSTILE_SECRET_KEY is not set
 * the check is skipped (returns true), so the site works before it is configured.
 */
export async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (e) {
    console.error("captcha verify failed", e);
    return false;
  }
}
