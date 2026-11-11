import "server-only";
import { headers } from "next/headers";

/**
 * Minimal in-memory rate limiter (per server instance). Good enough to stop
 * accidental double submits and simple spam. On serverless platforms each
 * instance keeps its own counters, so for strict limits add Upstash/Redis.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function clientKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}
