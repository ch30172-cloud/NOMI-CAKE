import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth / magic-link callback. Exchanges the code for a session, then goes to the admin. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/he/admin";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/he/admin";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/he/admin/login?error=oauth", url.origin));
}
