import "server-only";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Uploads an image as the signed-in admin (storage RLS requires is_admin()).
 * Validates MIME type and size; file names are randomized so nothing user-supplied reaches the path.
 */
export async function uploadImage(bucket: "product-images" | "site-media", folder: string, file: File): Promise<{ url: string; path: string }> {
  if (!ALLOWED.has(file.type)) throw new Error("סוג קובץ לא נתמך (JPG, PNG, WEBP, AVIF בלבד)");
  if (file.size > MAX_BYTES) throw new Error("הקובץ גדול מדי (עד 8MB)");
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function removeImage(bucket: "product-images" | "site-media", path: string | null) {
  if (!path) return;
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove([path]);
}
