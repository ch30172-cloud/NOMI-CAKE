import { z } from "zod";
import { normalizePhone } from "@/lib/whatsapp/phone";

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(500),
  notes: z.string().trim().max(500).default(""),
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(100),
    locale: z.enum(["he", "en"]),
    fulfillment: z.enum(["pickup", "delivery"]),
    deliveryCityId: z.string().uuid().nullable(),
    deliveryAddress: z.string().trim().max(300).default(""),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, "time"),
    customer: z.object({
      name: z.string().trim().min(2, "name").max(100, "name"),
      phone: z
        .string()
        .trim()
        .transform((v, ctx) => {
          const e164 = normalizePhone(v);
          if (!e164) {
            ctx.addIssue({ code: "custom", message: "phone" });
            return z.NEVER;
          }
          return e164;
        }),
      email: z.union([z.literal(""), z.string().trim().email("email").max(200, "email")]).default(""),
      city: z.string().trim().max(100).default(""),
    }),
    notes: z.string().trim().max(1000).default(""),
    couponCode: z.string().trim().max(50).default(""),
    items: z.array(cartItemSchema).min(1, "emptyCart").max(50),
    // Honeypot field: bots fill it, humans never see it.
    website: z.string().max(0).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery") {
      if (!v.deliveryCityId) ctx.addIssue({ code: "custom", path: ["deliveryCityId"], message: "city" });
      if (v.deliveryAddress.length < 5) ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "address" });
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
