import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { DEFAULT_LOGO_PATH } from "@/components/branding/logo";
import type { BusinessSettingsRow } from "@/types/database";

/**
 * Resolves the logo to display: the uploaded logo from settings, else the bundled
 * original file if it exists in /public/branding, else null (typographic wordmark).
 */
export function resolveLogoUrl(settings: BusinessSettingsRow | null): string | null {
  if (settings?.logo_url) return settings.logo_url;
  const bundled = path.join(process.cwd(), "public", DEFAULT_LOGO_PATH);
  return existsSync(bundled) ? DEFAULT_LOGO_PATH : null;
}
