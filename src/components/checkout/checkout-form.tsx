"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";
import { CartSummary } from "@/components/cart/cart-summary";
import { useCartQuote } from "@/components/cart/use-cart-quote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, dateKeyInTz } from "@/lib/availability/slots";
import { createOrderAction, fetchAvailability, fetchSlots, type DayAvailability } from "@/lib/orders/actions";
import { formatMoney } from "@/lib/pricing/money";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { cn } from "@/lib/utils";
import type { FulfillmentType } from "@/types/database";

interface City {
  id: string;
  name: string;
  feeAgorot: number;
}

const formSchema = z
  .object({
    fulfillment: z.enum(["pickup", "delivery"]),
    deliveryCityId: z.string().nullable(),
    deliveryAddress: z.string().trim(),
    scheduledDate: z.string().min(1, "date"),
    scheduledTime: z.string().min(1, "time"),
    name: z.string().trim().min(2, "name"),
    phone: z.string().trim().refine((v) => normalizePhone(v) !== null, "phone"),
    email: z.union([z.literal(""), z.string().trim().email("email")]),
    city: z.string().trim(),
    notes: z.string().trim().max(1000),
    website: z.string().max(0),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery") {
      if (!v.deliveryCityId) ctx.addIssue({ code: "custom", path: ["deliveryCityId"], message: "city" });
      if (v.deliveryAddress.length < 5) ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "address" });
    }
  });
type FormValues = z.infer<typeof formSchema>;

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutForm({ cities, pickupAddress }: { cities: City[]; pickupAddress: string }) {
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const locale = useLocale() as "he" | "en";
  const router = useRouter();
  const { items, couponCode, hydrated } = useCart();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [minLeadDays, setMinLeadDays] = useState(0);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { fulfillment: "pickup", deliveryCityId: null, deliveryAddress: "", scheduledDate: "", scheduledTime: "", name: "", phone: "", email: "", city: "", notes: "", website: "" },
  });
  const fulfillment = form.watch("fulfillment") as FulfillmentType;
  const deliveryCityId = form.watch("deliveryCityId");
  const scheduledDate = form.watch("scheduledDate");
  const { quote, loading: quoteLoading } = useCartQuote(fulfillment === "delivery" ? deliveryCityId : null);

  // Load day availability for the next 8 weeks whenever fulfillment type changes.
  useEffect(() => {
    const today = dateKeyInTz(new Date());
    fetchAvailability(today, addDays(today, 56), fulfillment).then((r) => {
      setDays(r.days);
      setMinLeadDays(r.minLeadDays);
    });
    form.setValue("scheduledDate", "");
    form.setValue("scheduledTime", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment]);

  useEffect(() => {
    if (!scheduledDate) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    fetchSlots(scheduledDate, fulfillment)
      .then(setSlots)
      .finally(() => setSlotsLoading(false));
    form.setValue("scheduledTime", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledDate, fulfillment]);

  const weeks = useMemo(() => {
    const rows: DayAvailability[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [days]);

  useEffect(() => {
    if (hydrated && items.length === 0 && !submitting) router.replace("/cart");
  }, [hydrated, items.length, router, submitting]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const result = await createOrderAction({
        idempotencyKey,
        locale,
        fulfillment: values.fulfillment,
        deliveryCityId: values.fulfillment === "delivery" ? values.deliveryCityId : null,
        deliveryAddress: values.deliveryAddress,
        scheduledDate: values.scheduledDate,
        scheduledTime: values.scheduledTime,
        customer: { name: values.name, phone: values.phone, email: values.email, city: values.city },
        notes: values.notes,
        couponCode: couponCode ?? "",
        website: values.website,
        items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, notes: i.notes })),
      });
      if (!result.ok) {
        setServerError(result.error);
        toast.error(t(`errors.${isKnownError(result.error) ? result.error : "generic"}`));
        setSubmitting(false);
        return;
      }
      router.push(`/order/${result.orderId}?t=${result.token}`);
    } catch {
      setServerError("generic");
      setSubmitting(false);
    }
  }

  const err = (field: keyof FormValues) => {
    const m = form.formState.errors[field]?.message;
    return m ? <p className="mt-1 text-xs text-destructive">{t(`errors.${m as "name"}`)}</p> : null;
  };

  const dayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", { weekday: "short", timeZone: "Asia/Jerusalem" });
    return (d: string) => fmt.format(new Date(`${d}T12:00:00Z`));
  }, [locale]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_360px]" noValidate>
      <div className="space-y-8">
        {/* Fulfillment */}
        <section className="card-elegant p-5">
          <h2 className="mb-4 text-xl">{t("fulfillment")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["pickup", "delivery"] as const).map((kind) => (
              <label
                key={kind}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  fulfillment === kind ? "border-accent bg-blush/50" : "border-rose/30 bg-white hover:bg-secondary/50",
                  kind === "delivery" && cities.length === 0 && "cursor-not-allowed opacity-60"
                )}
              >
                <input type="radio" value={kind} {...form.register("fulfillment")} className="mt-1 accent-[var(--accent)]" disabled={kind === "delivery" && cities.length === 0} />
                {kind === "pickup" ? <MapPin className="mt-0.5 size-5 text-accent" aria-hidden /> : <Truck className="mt-0.5 size-5 text-accent" aria-hidden />}
                <span>
                  <span className="block font-medium">{t(kind)}</span>
                  {kind === "pickup" && pickupAddress && <span className="block text-sm text-muted-foreground">{pickupAddress}</span>}
                  {kind === "delivery" && cities.length === 0 && <span className="block text-sm text-muted-foreground">{t("noCities")}</span>}
                </span>
              </label>
            ))}
          </div>
          {fulfillment === "delivery" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="deliveryCityId">{t("city")}</Label>
                <select
                  id="deliveryCityId"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                  value={deliveryCityId ?? ""}
                  onChange={(e) => form.setValue("deliveryCityId", e.target.value || null, { shouldValidate: true })}
                >
                  <option value="">{t("chooseCity")}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {formatMoney(c.feeAgorot, locale)}
                    </option>
                  ))}
                </select>
                {err("deliveryCityId")}
              </div>
              <div>
                <Label htmlFor="deliveryAddress">{t("address")}</Label>
                <Input id="deliveryAddress" className="mt-1 bg-white" {...form.register("deliveryAddress")} autoComplete="street-address" />
                {err("deliveryAddress")}
              </div>
            </div>
          )}
        </section>

        {/* Schedule */}
        <section className="card-elegant p-5">
          <h2 className="mb-1 text-xl">{t("date")}</h2>
          {minLeadDays > 0 && <p className="mb-3 text-xs text-muted-foreground">{t("leadNote", { days: minLeadDays })}</p>}
          <div className="space-y-1.5 overflow-x-auto">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid min-w-[420px] grid-cols-7 gap-1.5">
                {week.map((d) => {
                  const selected = scheduledDate === d.date;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      disabled={!d.isAvailable}
                      onClick={() => form.setValue("scheduledDate", d.date, { shouldValidate: true })}
                      aria-pressed={selected}
                      title={d.reason ? t(`dateReasons.${d.reason as "closed"}`) : undefined}
                      className={cn(
                        "flex flex-col items-center rounded-lg border px-1 py-1.5 text-xs transition-colors",
                        selected ? "border-accent bg-accent text-accent-foreground" : d.isAvailable ? "border-rose/30 bg-white hover:bg-secondary" : "border-transparent bg-muted text-muted-foreground line-through"
                      )}
                    >
                      <span>{dayNames(d.date)}</span>
                      <span className="text-sm font-medium">{Number(d.date.slice(8, 10))}</span>
                      <span className="text-[10px] opacity-70">{d.date.slice(5, 7)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {err("scheduledDate")}

          {scheduledDate && (
            <div className="mt-5">
              <h3 className="mb-2 text-base">{t("time")}</h3>
              {slotsLoading ? (
                <div className="h-9 w-40 animate-pulse rounded-full bg-blush/50" />
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const selected = form.watch("scheduledTime") === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => form.setValue("scheduledTime", s, { shouldValidate: true })}
                        className={cn("rounded-full border px-3 py-1.5 text-sm", selected ? "border-accent bg-accent text-accent-foreground" : "border-rose/30 bg-white hover:bg-secondary")}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}
              {err("scheduledTime")}
            </div>
          )}
        </section>

        {/* Customer */}
        <section className="card-elegant p-5">
          <h2 className="mb-4 text-xl">{t("fullName")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">{t("fullName")}</Label>
              <Input id="name" className="mt-1 bg-white" autoComplete="name" {...form.register("name")} />
              {err("name")}
            </div>
            <div>
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" className="mt-1 bg-white" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder={t("phoneHint")} {...form.register("phone")} />
              {err("phone")}
            </div>
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" className="mt-1 bg-white" type="email" dir="ltr" autoComplete="email" {...form.register("email")} />
              {err("email")}
            </div>
            <div>
              <Label htmlFor="city">{t("customerCity")}</Label>
              <Input id="city" className="mt-1 bg-white" autoComplete="address-level2" {...form.register("city")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea id="notes" className="mt-1 bg-white" {...form.register("notes")} />
            </div>
            <div className="hidden" aria-hidden>
              <label htmlFor="website">website</label>
              <input id="website" tabIndex={-1} autoComplete="off" {...form.register("website")} />
            </div>
          </div>
        </section>
      </div>

      <aside className="card-elegant h-fit space-y-4 p-5 lg:sticky lg:top-24">
        <h2 className="text-xl">{t("summary")}</h2>
        {quote && (
          <ul className="space-y-1 text-sm">
            {quote.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-2">
                <span>
                  {locale === "en" && l.nameEn ? l.nameEn : l.nameHe}
                  {l.variantHe && <span className="text-muted-foreground"> ({locale === "en" && l.variantEn ? l.variantEn : l.variantHe})</span>} × {l.quantity}
                </span>
                <span className="shrink-0">{l.lineTotalAgorot === null ? tc("partialTotal") : formatMoney(l.lineTotalAgorot, locale)}</span>
              </li>
            ))}
          </ul>
        )}
        {quote && <CartSummary quote={quote} showDelivery={fulfillment === "delivery"} />}
        {serverError && <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{t(`errors.${isKnownError(serverError) ? serverError : "generic"}`)}</p>}
        <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting || quoteLoading || !quote || quote.lines.some((l) => l.error)}>
          {submitting ? t("submitting") : t("submit")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("terms")}</p>
      </aside>
    </form>
  );
}

const KNOWN = new Set([
  "name", "phone", "email", "address", "city", "date", "time", "emptyCart", "date_too_soon", "date_too_far", "date_blocked", "date_closed", "date_full",
  "time_outside_hours", "time_blocked", "time_not_aligned", "city_unavailable", "product_unavailable", "coupon_invalid", "coupon_expired",
  "coupon_exhausted", "coupon_min_order", "rate_limited", "not_configured", "generic",
]);
function isKnownError(code: string): code is "generic" {
  return KNOWN.has(code);
}
