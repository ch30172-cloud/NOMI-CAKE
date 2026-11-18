"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface CarouselImage {
  url: string;
  alt: string;
}

/**
 * Swipeable image carousel (native scroll-snap, so touch swipe works everywhere).
 * - variant "full": product page, with arrows, counter and thumbnails.
 * - variant "card": catalog card, with small arrows and dots; slides link to the product.
 * Works in RTL and LTR; arrows always point the way the photos move.
 */
export function ImageCarousel({
  images,
  variant,
  href,
  priority = false,
  sizes,
  label,
}: {
  images: CarouselImage[];
  variant: "full" | "card";
  href?: string;
  priority?: boolean;
  sizes: string;
  label: string;
}) {
  const t = useTranslations("product");
  const rtl = useLocale() === "he";
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      const next = (i + count) % count;
      const slide = track.children[next] as HTMLElement | undefined;
      // Scroll the track only (scrollIntoView would also scroll the page).
      if (slide) track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: "smooth" });
      setIndex(next);
    },
    [count]
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track || count < 2) return;
    const onScroll = () => {
      const i = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
      setIndex(Math.min(Math.max(i, 0), count - 1));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [count]);

  if (count === 0) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-blush/40", variant === "full" ? "text-7xl" : "text-5xl")} aria-hidden>
        🎂
      </div>
    );
  }

  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const arrowBase =
    "absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md ring-1 ring-black/5 transition hover:bg-white";
  const arrowSize = variant === "full" ? "size-10" : "size-8 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100";

  const slide = (img: CarouselImage, i: number) => {
    const pic = (
      <Image
        src={img.url}
        alt={img.alt}
        fill
        sizes={sizes}
        priority={priority && i === 0}
        className={cn("object-cover", variant === "card" && "transition-transform duration-500 group-hover:scale-[1.03]")}
        unoptimized={!img.url.startsWith("/")}
        draggable={false}
      />
    );
    return (
      <div
        key={img.url + i}
        className="relative h-full w-full shrink-0 snap-start snap-always"
        role="group"
        aria-roledescription="slide"
        aria-label={t("imageOf", { n: i + 1, total: count })}
        aria-hidden={count > 1 && i !== index ? true : undefined}
      >
        {href ? (
          <Link href={href} tabIndex={-1} aria-hidden className="block h-full w-full">
            {pic}
          </Link>
        ) : (
          pic
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div
        className={cn("group relative overflow-hidden bg-blush/40", variant === "full" ? "aspect-square rounded-3xl" : "aspect-[4/3]")}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        onKeyDown={(e) => {
          if (count < 2) return;
          if (e.key === "ArrowRight") goTo(rtl ? index - 1 : index + 1);
          if (e.key === "ArrowLeft") goTo(rtl ? index + 1 : index - 1);
        }}
      >
        <div
          ref={trackRef}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map(slide)}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => goTo(index - 1)} aria-label={t("prevImage")} className={cn(arrowBase, arrowSize, "start-2")}>
              <PrevIcon className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => goTo(index + 1)} aria-label={t("nextImage")} className={cn(arrowBase, arrowSize, "end-2")}>
              <NextIcon className="size-5" aria-hidden />
            </button>
            {variant === "full" ? (
              <span className="absolute bottom-3 end-3 z-10 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white" aria-live="polite">
                {index + 1} / {count}
              </span>
            ) : (
              <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5" aria-hidden>
                {images.map((img, i) => (
                  <span key={img.url + i} className={cn("size-1.5 rounded-full shadow transition-all", i === index ? "w-4 bg-white" : "bg-white/60")} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {variant === "full" && count > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("thumbnails")}>
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t("imageOf", { n: i + 1, total: count })}
              aria-current={i === index}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition sm:size-20",
                i === index ? "ring-accent" : "opacity-70 ring-transparent hover:opacity-100"
              )}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" unoptimized={!img.url.startsWith("/")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
