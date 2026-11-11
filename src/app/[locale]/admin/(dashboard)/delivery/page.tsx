import { setRequestLocale } from "next-intl/server";
import { DeliveryManager } from "@/components/admin/delivery-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export default async function DeliveryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_cities").select("*").is("deleted_at", null).order("sort_order").order("name_he");
  return (
    <div>
      <PageHeader title="משלוחים" description="ערים ומחירי משלוח. לקוחות יכולים להזמין משלוח רק לעיר פעילה. כתובת האיסוף העצמי נמצאת בהגדרות." />
      <DeliveryManager cities={data ?? []} />
    </div>
  );
}
