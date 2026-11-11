/**
 * One-off catalog import from the owner's price list ("עוגות ומחירים.docx") and photo folder.
 * - Resizes photos (max 1600px, JPEG q82) and uploads them to Supabase Storage.
 * - Inserts categories/products/variants/images. Safe to re-run: products are matched by slug.
 *
 *   IMPORT_SOURCE_DIR="D:\Users\User\Pictures\תמונות עוגות" node scripts/import-catalog.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const SRC = process.env.IMPORT_SOURCE_DIR;
if (!SRC) throw new Error("IMPORT_SOURCE_DIR is required");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ILS = (n: number) => Math.round(n * 100);

type Variant = { label_he: string; label_en: string; price_agorot: number };
type Product = {
  slug: string;
  category: string; // category slug
  name_he: string;
  name_en: string;
  description_he: string;
  description_en: string;
  pricing_type: "fixed" | "by_size" | "custom";
  base_price_agorot: number | null;
  min_quantity?: number;
  is_featured?: boolean;
  variants?: Variant[];
  photos: string; // filename prefix in the source folder
};

const NEW_CATEGORY = { slug: "cakes-and-pies", name_he: "עוגות ופאים", name_en: "Cakes & Pies", sort_order: 0 };

const PRODUCTS: Product[] = [
  {
    slug: "yeast-cake", category: "cakes-and-pies", photos: "שמרים שוקולד",
    name_he: "עוגת שמרים", name_en: "Yeast cake",
    description_he: "עוגת שמרים ביתית במילוי לבחירה: שוקולד, קינמון או גבינה. המחיר לפס אחד. מינימום הזמנה: 2 פסים.",
    description_en: "Homemade yeast cake with your choice of filling: chocolate, cinnamon or cheese. Price per loaf. Minimum order: 2 loaves.",
    pricing_type: "by_size", base_price_agorot: null, min_quantity: 2,
    variants: [
      { label_he: "שוקולד", label_en: "Chocolate", price_agorot: ILS(50) },
      { label_he: "קינמון", label_en: "Cinnamon", price_agorot: ILS(50) },
      { label_he: "גבינה", label_en: "Cheese", price_agorot: ILS(50) },
    ],
  },
  {
    slug: "cheesecake-with-fruit", category: "cheesecakes", photos: "עוגת גבינה בעיטור פירות", is_featured: true,
    name_he: "עוגת גבינה עגולה בעיטור פירות", name_en: "Round cheesecake with fruit",
    description_he: "עוגת גבינה עגולה, קרמית ועדינה, מעוטרת בפירות טריים.", description_en: "A round, creamy cheesecake topped with fresh fruit.",
    pricing_type: "fixed", base_price_agorot: ILS(300),
  },
  {
    slug: "lemon-pie", category: "individual-desserts", photos: "פאי לימון", is_featured: true,
    name_he: "פאי לימון", name_en: "Lemon pie",
    description_he: "פאי לימון חמצמץ ומרענן. ניתן להזמין כסט של 30 כוסיות או 30 טארטלטים.", description_en: "Tangy, refreshing lemon pie. Available as a set of 30 cups or 30 tartlets.",
    pricing_type: "by_size", base_price_agorot: null,
    variants: [
      { label_he: "30 כוסיות", label_en: "30 cups", price_agorot: ILS(350) },
      { label_he: "30 טארטלטים", label_en: "30 tartlets", price_agorot: ILS(350) },
    ],
  },
  {
    slug: "banana-liqueur-cake", category: "cakes-and-pies", photos: "ליקר בננה",
    name_he: "עוגת ליקר בננה", name_en: "Banana liqueur cake",
    description_he: "עוגת ליקר בננה עסיסית. 60 חתיכות.", description_en: "Moist banana liqueur cake. 60 pieces.",
    pricing_type: "fixed", base_price_agorot: ILS(300),
  },
  {
    slug: "nougat-mousse-cups", category: "desserts-in-cups", photos: "כוסיות מוס נוגט וקרמבל אגוזים", is_featured: true,
    name_he: "כוסיות מוס נוגט וקראמבל אגוזים", name_en: "Nougat mousse cups with nut crumble",
    description_he: "מוס נוגט קטיפתי עם קראמבל אגוזים פריך. סט של 30 כוסיות.", description_en: "Velvety nougat mousse with crunchy nut crumble. Set of 30 cups.",
    pricing_type: "fixed", base_price_agorot: ILS(350),
  },
  {
    slug: "lotus-milky-cups", category: "desserts-in-cups", photos: "כוסיות מילקי לוטוס",
    name_he: "כוסיות מילקי לוטוס", name_en: "Lotus milky cups",
    description_he: "קרם מילקי עם לוטוס. סט של 30 כוסיות.", description_en: "Milky cream with Lotus biscuit. Set of 30 cups.",
    pricing_type: "fixed", base_price_agorot: ILS(350),
  },
  {
    slug: "carrot-cake", category: "cakes-and-pies", photos: "עוגת גזר בציפוי שמנת",
    name_he: "עוגת גזר בציפוי שמנת", name_en: "Carrot cake with cream cheese frosting",
    description_he: "עוגת גזר לחה בציפוי קרם שמנת. המחיר לפס אחד. מינימום הזמנה: 2 פסים.", description_en: "Moist carrot cake with cream cheese frosting. Price per loaf. Minimum order: 2 loaves.",
    pricing_type: "fixed", base_price_agorot: ILS(70), min_quantity: 2,
  },
  {
    slug: "marble-cake", category: "cakes-and-pies", photos: "",
    name_he: "עוגת שיש", name_en: "Marble cake",
    description_he: "עוגת שיש קלאסית, וניל ושוקולד.", description_en: "Classic vanilla and chocolate marble cake.",
    pricing_type: "fixed", base_price_agorot: ILS(120),
  },
  {
    slug: "bee-sting-cake", category: "cakes-and-pies", photos: "עוקץ הדבורה",
    name_he: "עוגת עוקץ הדבורה", name_en: "Bee sting cake",
    description_he: "עוגת עוקץ הדבורה עם קרם ושקדים מקורמלים. 60 חתיכות.", description_en: "Bee sting cake with cream and caramelized almonds. 60 pieces.",
    pricing_type: "fixed", base_price_agorot: ILS(300),
  },
  {
    slug: "coffee-ganache-pie", category: "individual-desserts", photos: "פאי גנש קפה",
    name_he: "פאי גנאש קפה", name_en: "Coffee ganache pie",
    description_he: "פאי גנאש קפה עשיר. סט של 30 יחידות.", description_en: "Rich coffee ganache pie. Set of 30 pieces.",
    pricing_type: "fixed", base_price_agorot: ILS(350),
  },
  {
    slug: "patissiere-fruit-pie", category: "individual-desserts", photos: "פאי קרם פטיסייר בעיטור פרות",
    name_he: "פאי קרם פטיסייר בעיטור פירות", name_en: "Crème pâtissière pie with fruit",
    description_he: "פאי קרם פטיסייר מעוטר בפירות טריים. סט של 30 יחידות.", description_en: "Crème pâtissière pie topped with fresh fruit. Set of 30 pieces.",
    pricing_type: "fixed", base_price_agorot: ILS(380),
  },
  {
    slug: "passionfruit-pistachio-cups", category: "desserts-in-cups", photos: "קומפוט פסיפלורה ופיסטוק",
    name_he: "כוסיות פסיפלורה ופיסטוק", name_en: "Passion fruit & pistachio cups",
    description_he: "קומפוט פסיפלורה עם קרם פיסטוק. סט של 30 כוסיות.", description_en: "Passion fruit compote with pistachio cream. Set of 30 cups.",
    pricing_type: "fixed", base_price_agorot: ILS(350),
  },
  {
    slug: "dessert-boxes", category: "dessert-boxes", photos: "מארזים", is_featured: true,
    name_he: "מארזי קינוחים", name_en: "Dessert boxes",
    description_he: "מארז קינוחים מעוצב לפי בחירה. המחיר נקבע בתיאום אישי לפי גודל המארז והקינוחים.", description_en: "Custom dessert box. Price agreed individually according to box size and selection.",
    pricing_type: "custom", base_price_agorot: null,
  },
];

function photosFor(prefix: string): string[] {
  if (!prefix) return [];
  const seen = new Set<string>();
  return readdirSync(SRC!)
    .filter((f) => /\.(jpe?g|png)$/i.test(f) && f.startsWith(prefix))
    .map((f) => path.join(SRC!, f))
    .filter((p) => statSync(p).size > 10_000) // skip the broken 285-byte files
    .filter((p) => {
      const key = String(statSync(p).size); // identical copies ("(1)" duplicates) share a size
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort();
}

async function upload(bucket: string, folder: string, file: string): Promise<{ url: string; path: string }> {
  const buf = await sharp(file).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const storagePath = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buf, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return { url: supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl, path: storagePath };
}

async function main() {
  // Category for cakes & pies
  const { data: cat } = await supabase.from("categories").upsert(NEW_CATEGORY, { onConflict: "slug" }).select("id").single();
  const { data: cats } = await supabase.from("categories").select("id, slug");
  const catId = (slug: string) => cats!.find((c) => c.slug === slug)!.id;
  console.log("categories ok", cat?.id ? "(cakes-and-pies ready)" : "");

  for (const [i, p] of PRODUCTS.entries()) {
    const row = {
      slug: p.slug, category_id: catId(p.category), name_he: p.name_he, name_en: p.name_en,
      description_he: p.description_he, description_en: p.description_en, en_translation_status: "approved" as const,
      pricing_type: p.pricing_type, base_price_agorot: p.base_price_agorot, min_quantity: p.min_quantity ?? 1,
      is_featured: p.is_featured ?? false, is_available: true, sort_order: i + 1,
    };
    const { data: prod, error } = await supabase.from("products").upsert(row, { onConflict: "slug" }).select("id").single();
    if (error) throw error;
    const id = prod.id;

    if (p.variants) {
      const { data: existing } = await supabase.from("product_variants").select("id").eq("product_id", id);
      if (!existing?.length) {
        const { error: vErr } = await supabase.from("product_variants").insert(p.variants.map((v, j) => ({ product_id: id, kind: "size" as const, label_he: v.label_he, label_en: v.label_en, price_agorot: v.price_agorot, sort_order: j + 1 })));
        if (vErr) throw vErr;
      }
    }

    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", id);
    if (!count) {
      const files = photosFor(p.photos);
      for (const [j, f] of files.entries()) {
        const up = await upload("product-images", id, f);
        const { error: iErr } = await supabase.from("product_images").insert({ product_id: id, url: up.url, storage_path: up.path, alt_he: p.name_he, alt_en: p.name_en, sort_order: j + 1 });
        if (iErr) throw iErr;
      }
      console.log(`${p.name_he}: ${files.length} photos`);
    } else {
      console.log(`${p.name_he}: already has images, skipped`);
    }
  }

  // Brand photos ("תמונה לוגו") -> hero image + gallery
  const brand = photosFor("תמונה לוגו");
  const { data: home } = await supabase.from("homepage_content").select("hero_image_url").eq("id", 1).single();
  if (brand.length && !home?.hero_image_url) {
    const up = await upload("site-media", "homepage", brand[0]);
    await supabase.from("homepage_content").update({ hero_image_url: up.url }).eq("id", 1);
    console.log("hero image set");
  }
  const { count: gcount } = await supabase.from("gallery_images").select("id", { count: "exact", head: true });
  if (!gcount) {
    let order = 0;
    for (const f of [...brand, ...photosFor("מארזים").slice(0, 2), ...photosFor("עוגת טארט ווניל")]) {
      const up = await upload("site-media", "gallery", f);
      await supabase.from("gallery_images").insert({ url: up.url, storage_path: up.path, sort_order: ++order });
    }
    console.log(`gallery: ${order} photos`);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
