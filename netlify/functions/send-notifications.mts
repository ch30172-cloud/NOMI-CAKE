import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function: every 10 minutes, retries queued emails by calling
 * the protected cron route (same job Vercel Cron does via vercel.json).
 */
export default async function handler(): Promise<Response> {
  const site = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return new Response("not configured", { status: 200 });
  const res = await fetch(`${site}/api/cron/notifications`, { headers: { authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: 200 });
}

export const config: Config = { schedule: "*/10 * * * *" };
