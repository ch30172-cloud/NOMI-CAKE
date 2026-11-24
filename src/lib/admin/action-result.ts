/** Uniform result for admin server actions used with useActionState / forms. */
export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = (message?: string, id?: string): ActionResult => ({ ok: true, message, id });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, error, fieldErrors });

export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "forbidden") return "פג תוקף ההתחברות או שאין הרשאה. רענני את הדף והתחברי מחדש.";
  if (msg === "mfa_required") return "נדרש קוד אימות דו-שלבי. רענני את הדף והזיני את הקוד מהאפליקציה.";
  return msg;
}
