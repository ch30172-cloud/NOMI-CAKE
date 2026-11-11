import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("orderConfirm");
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-7xl text-rose">404</p>
      <Link href="/" className="text-accent underline">
        {t("backHome")}
      </Link>
    </div>
  );
}
