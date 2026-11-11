import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = intl(request);
  // Refresh the Supabase session cookie on every page request (admin area relies on it).
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|branding|.*\..*).*)"],
};
