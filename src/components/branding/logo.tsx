import Image from "next/image";
import { cn } from "@/lib/utils";

export const DEFAULT_LOGO_PATH = "/branding/logo-original.jpg";

interface LogoProps {
  /** Resolved logo URL (see lib/data/logo.ts). null => typographic wordmark. */
  src: string | null;
  businessName?: string;
  tagline?: string;
  /** Rendered height in px (width follows the image aspect ratio). */
  height?: number;
  priority?: boolean;
  className?: string;
  /** Also render the typographic name next to the image. */
  withText?: boolean;
}

/**
 * Reusable brand logo. Keeps the original artwork untouched (no crops, borders or effects):
 * the image is rendered with its own aspect ratio inside a fixed height.
 */
export function Logo({
  src,
  businessName = "Nomi Nebentzhal",
  tagline = "CAKES AND BOUTIQUE CONDITORIA",
  height = 56,
  priority = false,
  className,
  withText = false,
}: LogoProps) {
  if (!src) {
    return <Wordmark businessName={businessName} tagline={tagline} className={className} />;
  }
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative block shrink-0" style={{ height, width: height * 1.6 }}>
        <Image
          src={src}
          alt={`${businessName} – ${tagline}`}
          fill
          sizes={`${Math.round(height * 3.2)}px`}
          className="object-contain object-center"
          priority={priority}
          unoptimized={!src.startsWith("/")}
        />
      </span>
      {withText && (
        <span className="flex flex-col leading-tight" dir="ltr">
          <span className="font-display text-lg tracking-wide text-foreground">{businessName}</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{tagline}</span>
        </span>
      )}
    </span>
  );
}

/** Typographic fallback used when no logo image is available. */
export function Wordmark({
  businessName = "Nomi Nebentzhal",
  tagline = "CAKES AND BOUTIQUE CONDITORIA",
  className,
  size = "md",
}: Pick<LogoProps, "businessName" | "tagline" | "className"> & { size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex flex-col leading-tight", className)} dir="ltr">
      <span className={cn("font-display tracking-wide text-foreground", size === "lg" ? "text-4xl sm:text-5xl" : "text-xl")}>{businessName}</span>
      <span className={cn("uppercase tracking-[0.25em] text-muted-foreground", size === "lg" ? "text-xs" : "text-[10px]")}>{tagline}</span>
    </span>
  );
}
