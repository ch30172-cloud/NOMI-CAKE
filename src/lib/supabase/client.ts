"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { publicSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
