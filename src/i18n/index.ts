"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "en" | "th";
export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "th", label: "ภาษาไทย", flag: "🇹🇭" },
];

interface I18nStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "purrnet-locale" }
  )
);

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
type TranslationDict = Record<string, unknown>;

function get(obj: TranslationDict, path: string): string {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as TranslationDict)[k];
    return undefined;
  }, obj) as string ?? path;
}

const cache: Partial<Record<Locale, TranslationDict>> = {};

function loadSync(locale: Locale): TranslationDict {
  if (cache[locale]) return cache[locale]!;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require(`./locales/${locale}.json`) as TranslationDict;
    cache[locale] = data;
    return data;
  } catch {
    return {};
  }
}

export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const dict = loadSync(locale);
  return (key: string, fallback?: string): string => get(dict, key) || fallback || key;
}

export function t(key: string, locale: Locale = "en", fallback?: string): string {
  const dict = loadSync(locale);
  return get(dict, key) || fallback || key;
}
