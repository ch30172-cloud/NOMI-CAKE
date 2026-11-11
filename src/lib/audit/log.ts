import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/** Writes an audit row as the signed-in admin (RPC checks is_admin()). */
export async function logAudit(action: string, entity: string, entityId: string | null, before: Json | null, after: Json | null) {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_audit", { p_action: action, p_entity: entity, p_entity_id: entityId, p_before: before, p_after: after });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
