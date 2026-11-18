"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Accessibility, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Toggle = "contrast" | "grayscale" | "links" | "readable" | "noMotion" | "bigCursor";
interface Prefs {
  fontStep: number; // 0..4, each step +12.5%
  toggles: Record<Toggle, boolean>;
}

const STORAGE_KEY = "nomi-a11y-v1";
const DEFAULTS: Prefs = { fontStep: 0, toggles: { contrast: false, grayscale: false, links: false, readable: false, noMotion: false, bigCursor: false } };
const CLASS: Record<Toggle, string> = {
  contrast: "a11y-contrast",
  grayscale: "a11y-grayscale",
  links: "a11y-links",
  readable: "a11y-readable",
  noMotion: "a11y-no-motion",
  bigCursor: "a11y-big-cursor",
};

function apply(p: Prefs) {
  const html = document.documentElement;
  html.style.fontSize = p.fontStep ? `${100 + p.fontStep * 12.5}%` : "";
  for (const k of Object.keys(CLASS) as Toggle[]) html.classList.toggle(CLASS[k], p.toggles[k]);
}

/**
 * Accessibility menu: text size, high contrast, grayscale, link highlighting,
 * readable font, stop animations, large cursor. Preferences persist per device.
 * Keyboard: opens with Enter/Space, closes with Escape, focus returns to the button.
 */
export function AccessibilityMenu() {
  const t = useTranslations("a11y");
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = { ...DEFAULTS, ...JSON.parse(raw) } as Prefs;
        p.toggles = { ...DEFAULTS.toggles, ...p.toggles };
        setPrefs(p);
        apply(p);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const update = useCallback((next: Prefs) => {
    setPrefs(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (k: Toggle) => update({ ...prefs, toggles: { ...prefs.toggles, [k]: !prefs.toggles[k] } });
  const items: { key: Toggle; label: string }[] = [
    { key: "contrast", label: t("contrast") },
    { key: "grayscale", label: t("grayscale") },
    { key: "links", label: t("links") },
    { key: "readable", label: t("readable") },
    { key: "noMotion", label: t("noMotion") },
    { key: "bigCursor", label: t("bigCursor") },
  ];

  return (
    // Bottom-LEFT in both languages: the hosting badge occupies the bottom-right corner.
    <div className="a11y-root fixed bottom-4 left-4 z-[2147483647] print:hidden">
      {open && (
        <div
          ref={panelRef}
          id="a11y-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="a11y-title"
          className="mb-3 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-rose/30 bg-white p-4 text-foreground shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 id="a11y-title" className="font-sans text-base font-semibold">
              {t("title")}
            </h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label={t("close")}
              className="rounded-full p-1 hover:bg-secondary"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="mb-3">
            <p className="mb-1 text-sm" id="a11y-font">
              {t("fontSize")}
            </p>
            <div className="flex gap-2" role="group" aria-labelledby="a11y-font">
              <button
                type="button"
                className="flex-1 rounded-lg border px-2 py-1.5 text-sm hover:bg-secondary disabled:opacity-40"
                onClick={() => update({ ...prefs, fontStep: Math.max(0, prefs.fontStep - 1) })}
                disabled={prefs.fontStep === 0}
                aria-label={t("smaller")}
              >
                A−
              </button>
              <span className="flex min-w-12 items-center justify-center text-sm" aria-live="polite">
                {100 + prefs.fontStep * 12.5}%
              </span>
              <button
                type="button"
                className="flex-1 rounded-lg border px-2 py-1.5 text-sm hover:bg-secondary disabled:opacity-40"
                onClick={() => update({ ...prefs, fontStep: Math.min(4, prefs.fontStep + 1) })}
                disabled={prefs.fontStep === 4}
                aria-label={t("bigger")}
              >
                A+
              </button>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2">
            {items.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  aria-pressed={prefs.toggles[it.key]}
                  onClick={() => toggle(it.key)}
                  className={cn(
                    "h-full w-full rounded-lg border px-2 py-2 text-sm leading-tight transition-colors",
                    prefs.toggles[it.key] ? "border-accent bg-accent text-accent-foreground" : "hover:bg-secondary"
                  )}
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between text-sm">
            <button type="button" className="underline hover:text-accent" onClick={() => update(DEFAULTS)}>
              {t("reset")}
            </button>
            <Link href="/accessibility" className="underline hover:text-accent" onClick={() => setOpen(false)}>
              {t("statement")}
            </Link>
          </div>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-label={t("open")}
        className="flex size-12 items-center justify-center rounded-full bg-[#1d4ed8] text-white shadow-lg ring-2 ring-white hover:bg-[#1e40af]"
      >
        <Accessibility className="size-7" aria-hidden />
      </button>
    </div>
  );
}
