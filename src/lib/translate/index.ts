import "server-only";

/**
 * Automatic translation behind a provider interface. API keys never leave the server.
 * Supported: TRANSLATE_PROVIDER=google (Cloud Translation v2) | deepl.
 * Returns null when no provider is configured so the UI can say so honestly.
 */
export async function translateText(text: string, from: "he" | "en", to: "he" | "en"): Promise<string | null> {
  const provider = process.env.TRANSLATE_PROVIDER;
  const key = process.env.TRANSLATE_API_KEY;
  if (!provider || !key || !text.trim()) return null;

  if (provider === "google") {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: from, target: to, format: "text" }),
    });
    if (!res.ok) throw new Error(`translate failed: ${res.status}`);
    const json = (await res.json()) as { data?: { translations?: { translatedText?: string }[] } };
    return json.data?.translations?.[0]?.translatedText ?? null;
  }

  if (provider === "deepl") {
    const host = key.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
    const res = await fetch(`https://${host}/v2/translate`, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text], source_lang: from.toUpperCase(), target_lang: to === "en" ? "EN-US" : "HE" }),
    });
    if (!res.ok) throw new Error(`translate failed: ${res.status}`);
    const json = (await res.json()) as { translations?: { text?: string }[] };
    return json.translations?.[0]?.text ?? null;
  }

  throw new Error(`unknown TRANSLATE_PROVIDER ${provider}`);
}

export function isTranslationConfigured(): boolean {
  return Boolean(process.env.TRANSLATE_PROVIDER && process.env.TRANSLATE_API_KEY);
}
