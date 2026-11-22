import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth / magic-link callback. Exchanges the code for a session, then goes to the admin. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/he/admin";
  // Only same-site paths: block "//host", "/\host" and anything that resolves to another origin.
  let safeNext = "/he/admin";
  if (next.startsWith("/") && !next.startsWith("//") && !/[\\\s]/.test(next)) {
    try {
      if (new URL(next, url.origin).origin === url.origin) safeNext = next;
    } catch {
      /* keep default */
    }
  }
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/he/admin/login?error=oauth", url.origin));
}
