import { NextResponse } from "next/server";
import { sendPendingNotifications } from "@/lib/email/notifications";

export const dynamic = "force-dynamic";

/** Retries queued email notifications. Called by Vercel Cron (see vercel.json) or manually. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendPendingNotifications(25);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
