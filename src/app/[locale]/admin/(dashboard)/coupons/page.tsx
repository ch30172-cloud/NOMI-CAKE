import { setRequestLocale } from "next-intl/server";
import { CouponManager } from "@/components/admin/coupon-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export default async function CouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: coupons }, { data: products }, { data: categories }] = await Promise.all([
    supabase.from("coupons").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("products").select("id, name_he").is("deleted_at", null).order("name_he"),
    supabase.from("categories").select("id, name_he").is("deleted_at", null).order("sort_order"),
  ]);
  return (
    <div>
      <PageHeader title="קופונים והנחות" description="תקינות הקופון נבדקת בשרת. מספר השימושים נספר אטומית בעת יצירת ההזמנה ומשוחרר בביטול." />
      <CouponManager coupons={coupons ?? []} products={products ?? []} categories={categories ?? []} />
    </div>
  );
}
