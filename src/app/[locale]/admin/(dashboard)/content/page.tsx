import { setRequestLocale } from "next-intl/server";
import { ContentManager } from "@/components/admin/content-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: content }, { data: gallery }] = await Promise.all([
    supabase.from("homepage_content").select("*").eq("id", 1).single(),
    supabase.from("gallery_images").select("*").order("sort_order"),
  ]);
  if (!content) return null;
  return (
    <div>
      <PageHeader title="תוכן האתר" description="תמונת פתיחה, טקסטים בדף הבית וגלריית התמונות. מוצרים מומלצים מסומנים במסך המוצרים." />
      <ContentManager content={content} gallery={gallery ?? []} />
    </div>
  );
}
